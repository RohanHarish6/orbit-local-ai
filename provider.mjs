const DEFAULT_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const providerState = new Map();

function parsePool() {
  const raw = process.env.ORBIT_PROVIDER_POOL;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => item && item.endpoint && item.model && (item.apiKey || item.key));
      }
    } catch {
      // Invalid optional configuration is reported through providerConfig().
    }
  }
  const apiKey = process.env.ORBIT_PROVIDER_API_KEY || process.env.OPENROUTER_API_KEY || "";
  const model = process.env.ORBIT_PROVIDER_MODEL || "";
  return apiKey && model
    ? [{ name: process.env.ORBIT_PROVIDER_NAME, endpoint: process.env.ORBIT_PROVIDER_ENDPOINT, model, apiKey }]
    : [];
}

function normalize(item, index) {
  const endpoint = item.endpoint || DEFAULT_ENDPOINT;
  return {
    id: item.id || item.name || `${endpoint}:${item.model}:${index}`,
    name: item.name || (endpoint.includes("openrouter.ai") ? "openrouter" : "openai-compatible"),
    endpoint,
    model: item.model,
    apiKey: item.apiKey || item.key,
    tokenBudget: Number(item.tokenBudget || process.env.ORBIT_PROVIDER_TOKEN_BUDGET || 100000),
    priority: Number(item.priority || index),
  };
}

function stateFor(provider) {
  if (!providerState.has(provider.id)) {
    providerState.set(provider.id, { usedTokens: 0, exhausted: false, failures: 0, lastError: null });
  }
  return providerState.get(provider.id);
}

export function providerConfig() {
  const providers = parsePool().map(normalize).sort((a, b) => a.priority - b.priority);
  return {
    configured: providers.length > 0,
    count: providers.length,
    provider: providers[0]?.name || (process.env.ORBIT_PROVIDER_ENDPOINT?.includes("openrouter.ai") ? "openrouter" : "openai-compatible"),
    model: providers[0]?.model || null,
    endpoint: providers[0]?.endpoint || DEFAULT_ENDPOINT,
    providers: providers.map((provider) => {
      const state = stateFor(provider);
      return {
        id: provider.id,
        name: provider.name,
        model: provider.model,
        available: !state.exhausted && state.usedTokens < provider.tokenBudget,
        usedTokens: state.usedTokens,
        tokenBudget: provider.tokenBudget,
        exhausted: state.exhausted,
        lastError: state.lastError,
      };
    }),
  };
}

function classifyFailure(status, message) {
  const text = String(message || "").toLowerCase();
  if (status === 401 || status === 403) return "configuration";
  if (status === 402 || status === 429 || /quota|token limit|rate limit|insufficient.*credit|exhausted/.test(text)) return "exhausted";
  if (status >= 500 || /timeout|temporar|network|fetch failed|overloaded/.test(text)) return "transient";
  return "provider";
}

export class ProviderError extends Error {
  constructor(message, category, provider, usage = {}, partialContent = "") {
    super(message);
    this.name = "ProviderError";
    this.category = category;
    this.provider = provider;
    this.usage = usage;
    this.partialContent = partialContent;
  }
}

export function availableProviders() {
  return parsePool().map(normalize).sort((a, b) => a.priority - b.priority).filter((provider) => {
    const state = stateFor(provider);
    return !state.exhausted && state.usedTokens < provider.tokenBudget;
  });
}

export async function providerRequest({ prompt, agent, output = "markdown", provider }) {
  const config = provider || availableProviders()[0];
  if (!config) throw new ProviderError("No online provider is available.", "unavailable", null);
  const state = stateFor(config);
  const system = [
    `You are Orbit's ${agent} specialist.`,
    "Produce a high-quality answer, reason carefully, and do not claim tools or actions that were not performed.",
    output === "html" ? "Return a complete HTML document beginning with <!doctype html>." : "Use clear headings and concise, actionable detail.",
  ].join(" ");
  let response;
  try {
    response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
        ...(config.name === "openrouter" ? {
          "http-referer": "http://127.0.0.1:4317",
          "x-title": "Orbit local workspace",
        } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 1200,
      }),
      signal: AbortSignal.timeout(120000),
    });
  } catch (error) {
    state.failures += 1;
    state.lastError = error.message;
    throw new ProviderError(`Online provider request failed: ${error.message}`, "transient", config);
  }
  const payload = await response.json().catch(() => ({}));
  const message = payload.error?.message || response.statusText;
  if (!response.ok) {
    const category = classifyFailure(response.status, message);
    state.lastError = message;
    if (category === "exhausted" || category === "configuration") state.exhausted = true;
    throw new ProviderError(`Online provider failed (${response.status}): ${message}`, category, config);
  }
  const usage = payload.usage || {};
  const usedTokens = Number(usage.total_tokens || usage.prompt_tokens || 0);
  state.usedTokens += usedTokens;
  if (state.usedTokens >= config.tokenBudget) state.exhausted = true;
  const finishReason = payload.choices?.[0]?.finish_reason;
  const content = payload.choices?.[0]?.message?.content;
  if (finishReason === "length") {
    state.exhausted = true;
    throw new ProviderError("Online provider ended at its output token limit.", "exhausted", config, usage, String(content || ""));
  }
  if (!content) throw new ProviderError("Online provider returned no message content.", "provider", config, usage);
  return {
    ok: true,
    content: String(content).trim(),
    model: config.model,
    provider: config.name,
    providerId: config.id,
    localOnly: false,
    usage,
  };
}
