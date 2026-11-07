import { chooseAgent, agents, generationAdapters } from "./agents.mjs";
import { availableProviders, providerConfig, providerRequest, ProviderError } from "./provider.mjs";

export const capabilityTiers = [
  {
    id: "local-draft",
    label: "Local draft",
    capabilities: ["route", "generate"],
    maxAttempts: 1,
  },
  {
    id: "local-context",
    label: "Local context",
    capabilities: ["route", "memory", "generate"],
    maxAttempts: 2,
  },
  {
    id: "verified-workflow",
    label: "Verified workflow",
    capabilities: ["route", "memory", "generate", "verify", "repair"],
    maxAttempts: 3,
  },
  {
    id: "provider-escalation",
    label: "Configured provider",
    capabilities: ["route", "memory", "generate", "verify", "repair", "external-provider"],
    maxAttempts: 3,
  },
];

function complexity(prompt, output) {
  const text = `${prompt} ${output}`.toLowerCase();
  let score = 0;
  if (text.length > 240) score += 1;
  if (/\b(latest|research|sources|cite|compare|web)\b/.test(text)) score += 2;
  if (/\b(code|debug|test|implement|refactor|api|database)\b/.test(text)) score += 1;
  if (/\b(pdf|docx|image|video|file|export)\b/.test(text)) score += 1;
  if (/\b(autonomous|verify|reliable|production|all|complete)\b/.test(text)) score += 1;
  return Math.min(4, score);
}

function chooseTier(prompt, output, configuredProvider = false) {
  const score = complexity(prompt, output);
  if (configuredProvider && score >= 3) return { tier: capabilityTiers[3], score };
  if (score >= 3) return { tier: capabilityTiers[2], score };
  if (score >= 1) return { tier: capabilityTiers[1], score };
  return { tier: capabilityTiers[0], score };
}

function verify(result, prompt, output) {
  const content = String(result?.content || "");
  const checks = [
    { id: "non-empty", passed: content.trim().length >= 40 },
    { id: "honest-scope", passed: !/\b(I searched the web|I created the file|I ran the code)\b/i.test(content) || /\b(local|configured|provided)\b/i.test(content) },
  ];
  if (output === "html") checks.push({ id: "html-document", passed: content.trim().startsWith("<!doctype html>") });
  if (/\b(code|python|javascript|typescript|sql)\b/i.test(prompt)) {
    checks.push({ id: "code-shaped", passed: /```|function\s+\w+|def\s+\w+|SELECT\s+/i.test(content) });
  }
  return { passed: checks.every((check) => check.passed), checks };
}

function repairPrompt(prompt, result, verification) {
  const failed = verification.checks.filter((check) => !check.passed).map((check) => check.id).join(", ");
  return [
    prompt,
    "",
    "Return a corrected final answer only.",
    `The previous draft failed these checks: ${failed || "quality review"}.`,
    "Do not claim tools, web access, file writes, or execution unless they actually occurred.",
    `Previous draft:\n${String(result?.content || "").slice(0, 4000)}`,
  ].join("\n");
}

export async function runAutonomous({ prompt, output = "markdown", requestedAgent, nativeRequest, configuredProvider = false }) {
  const agent = agents[requestedAgent] ? requestedAgent : chooseAgent(prompt);
  const adapter = generationAdapters[output] || generationAdapters.markdown;
  const selected = chooseTier(prompt, output, configuredProvider);
  const steps = [];
  let currentPrompt = prompt;
  let result = null;
  let verification = null;
  const providerAttempts = [];
  let providers = availableProviders();
  const attemptedProviders = new Set();

  for (let attempt = 1; attempt <= selected.tier.maxAttempts; attempt += 1) {
    steps.push({ tier: selected.tier.id, action: attempt === 1 ? "generate" : "repair", attempt });
    if (selected.tier.id === "provider-escalation" && providers.length) {
      let completed = false;
      while (providers.length && !completed) {
        const provider = providers.shift();
        if (attemptedProviders.has(provider.id)) continue;
        attemptedProviders.add(provider.id);
        try {
          result = await providerRequest({ prompt: currentPrompt, agent, output: adapter.id, provider });
          providerAttempts.push({ provider: provider.name, model: provider.model, status: "completed", usage: result.usage || null });
          completed = true;
        } catch (error) {
          const category = error instanceof ProviderError ? error.category : "provider";
          providerAttempts.push({ provider: provider.name, model: provider.model, status: "failed", category, message: error.message });
          if (error instanceof ProviderError && error.partialContent) {
            currentPrompt = [
              prompt,
              "",
              "Continue and complete the task without repeating finished sections.",
              `A previous provider stopped early. Preserve useful content and finish accurately:\n${error.partialContent.slice(0, 5000)}`,
            ].join("\n");
          }
        }
      }
      if (!result) {
        result = await nativeRequest({ action: "execute", prompt: currentPrompt, agent, output: adapter.id });
        providerAttempts.push({ provider: "local-fallback", status: "completed" });
      }
    } else {
      result = await nativeRequest({ action: "execute", prompt: currentPrompt, agent, output: adapter.id });
    }
    verification = verify(result, prompt, adapter.id);
    if (verification.passed || !selected.tier.capabilities.includes("repair")) break;
    currentPrompt = repairPrompt(prompt, result, verification);
    providers = availableProviders().filter((provider) => !attemptedProviders.has(provider.id));
  }

  return {
    ...result,
    agent,
    capabilityTier: selected.tier.id,
    tierLabel: selected.tier.label,
    complexityScore: selected.score,
    capabilitiesUsed: selected.tier.capabilities.filter((capability) => capability !== "external-provider"),
    steps,
    verification,
    provider: result?.provider || null,
    providerAttempts,
    providerPool: providerConfig().providers,
    escalation: selected.tier.id === "provider-escalation"
      ? `Used configured online provider ${result?.provider || "provider"} for a higher-capability pass.`
      : selected.score >= 3 ? "Escalated through local verification and repair." : "Completed at the lowest sufficient local tier.",
  };
}
