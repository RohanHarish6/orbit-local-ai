import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { agents, chooseAgent, generationAdapters } from "./agents.mjs";
import { runAutonomous } from "./autonomous.mjs";
import { providerConfig } from "./provider.mjs";

const port = Number(process.env.PORT || 4317);
const root = process.env.ORBIT_ROOT || process.cwd();
const pythonCommand = process.env.ORBIT_PYTHON || "python";

async function jsonResponse(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  return JSON.parse(raw || "{}");
}

function nativeRequest(payload) {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonCommand, ["native_runtime.py"], {
      cwd: root,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Native runtime timed out."));
    }, 120000);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new Error(`Native runtime unavailable: ${error.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0 && !stdout) {
        reject(new Error(stderr.trim() || `Native runtime exited with code ${code}.`));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim().split(/\r?\n/).pop() || "{}"));
      } catch {
        reject(new Error(stderr.trim() || "Native runtime returned invalid JSON."));
      }
    });
    child.stdin.end(`${JSON.stringify(payload)}\n`);
  });
}

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type" });
    response.end();
    return;
  }

  if (request.url === "/api/health") {
    try {
      const body = await nativeRequest({ action: "health" });
      await jsonResponse(response, body.ok && body.modelLoaded ? 200 : 503, {
        ...body,
        runtime: "local",
        models: body.model ? [{ name: body.model }] : [],
        onlineProvider: providerConfig(),
      });
    } catch (error) {
      await jsonResponse(response, 503, { ok: false, runtime: "local", provider: "native-python", error: error.message });
    }
    return;
  }

  if (request.url === "/api/task" && request.method === "POST") {
    try {
      const body = await readJson(request);
      await jsonResponse(response, 200, { ok: true, task: { title: body.prompt || "Untitled task", state: "queued", localOnly: true } });
    } catch {
      await jsonResponse(response, 400, { ok: false, error: "Task payload must be valid JSON." });
    }
    return;
  }

  if (request.url === "/api/plan" && request.method === "POST") {
    try {
      const body = await readJson(request);
      const prompt = String(body.prompt || "").trim();
      if (!prompt) {
        await jsonResponse(response, 400, { ok: false, error: "A prompt is required." });
        return;
      }

      const result = await nativeRequest({ action: "plan", prompt });
      await jsonResponse(response, result.ok ? 200 : 503, { ...result, plan: result.content });
    } catch (error) {
      await jsonResponse(response, 503, { ok: false, error: error.message });
    }
    return;
  }

  if (request.url === "/api/agents" && request.method === "GET") {
    await jsonResponse(response, 200, { ok: true, agents: Object.values(agents), adapters: Object.values(generationAdapters) });
    return;
  }

  if (request.url === "/api/provider" && request.method === "GET") {
    await jsonResponse(response, 200, { ok: true, provider: providerConfig() });
    return;
  }

  if (request.url === "/api/autonomous" && request.method === "POST") {
    try {
      const body = await readJson(request);
      const prompt = String(body.prompt || "").trim();
      if (!prompt) {
        await jsonResponse(response, 400, { ok: false, error: "A prompt is required." });
        return;
      }
      const result = await runAutonomous({
        prompt,
        output: body.output || "markdown",
        requestedAgent: body.agent,
        nativeRequest,
        configuredProvider: providerConfig().configured,
      });
      await jsonResponse(response, result.ok && result.verification?.passed ? 200 : 503, result);
    } catch (error) {
      await jsonResponse(response, 503, { ok: false, error: error.message });
    }
    return;
  }

  if (request.url === "/api/training/status" && request.method === "GET") {
    try {
      const raw = await readFile(`${root}/data/training_status.json`, "utf8");
      await jsonResponse(response, 200, { ok: true, training: JSON.parse(raw) });
    } catch {
      await jsonResponse(response, 200, { ok: true, training: { state: "idle", progress: 0, phase: "idle" } });
    }
    return;
  }

  if (request.url === "/api/route" && request.method === "POST") {
    try {
      const body = await readJson(request);
      const prompt = String(body.prompt || "").trim();
      if (!prompt) {
        await jsonResponse(response, 400, { ok: false, error: "A prompt is required." });
        return;
      }

      const result = await nativeRequest({ action: "route", prompt });
      const agent = agents[result.agent] ? result.agent : chooseAgent(prompt);
      await jsonResponse(response, result.ok ? 200 : 503, { ok: result.ok, route: { ...result, agent, model: "native-python", tools: agents[agent].tools } });
    } catch (error) {
      await jsonResponse(response, 503, { ok: false, error: error.message });
    }
    return;
  }

  if (request.url === "/api/execute" && request.method === "POST") {
    try {
      const body = await readJson(request);
      const prompt = String(body.prompt || "").trim();
      if (!prompt) {
        await jsonResponse(response, 400, { ok: false, error: "A prompt is required." });
        return;
      }

      const adapter = generationAdapters[body.output || "markdown"] || generationAdapters.markdown;
      const result = await nativeRequest({ action: "execute", prompt, agent: body.agent, output: adapter.id });
      await jsonResponse(response, 200, {
        ...result,
        execution: { agent: result.agent, model: result.model, output: adapter.id, outputAvailable: adapter.available, content: result.content, localOnly: true },
      });
    } catch (error) {
      await jsonResponse(response, 503, { ok: false, error: error.message });
    }
    return;
  }

  if (request.url === "/api/learn" && request.method === "POST") {
    try {
      const body = await readJson(request);
      const result = await nativeRequest({ action: "learn", ...body, id: randomUUID() });
      await jsonResponse(response, result.ok ? 200 : 400, result);
    } catch (error) {
      await jsonResponse(response, 503, { ok: false, error: error.message });
    }
    return;
  }

  await jsonResponse(response, 404, { ok: false, error: "Not found" });
});

export function startServer() {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      console.log(`Local Orbit gateway listening at http://127.0.0.1:${port}`);
      resolve(server);
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
