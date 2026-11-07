import React, { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const initialTasks = [
  {
    id: "brief",
    title: "Plan the weekend",
    detail: "A compact itinerary with weather-aware options",
    state: "Ready",
    color: "coral",
    icon: "✦",
    time: "just now",
  },
  {
    id: "research",
    title: "Research local models",
    detail: "Compare small multimodal models for a laptop",
    state: "Paused",
    color: "amber",
    icon: "◌",
    time: "12 min ago",
  },
  {
    id: "writing",
    title: "Rewrite project notes",
    detail: "Turn rough notes into a clean project brief",
    state: "Complete",
    color: "mint",
    icon: "✓",
    time: "Yesterday",
  },
];

const activities = [
  { time: "14:28", label: "Local model connected", detail: "Qwen2.5-Coder 3B · CPU GGUF", kind: "mint" },
  { time: "14:26", label: "Web access ready", detail: "Browser tool is waiting for approval", kind: "blue" },
  { time: "14:21", label: "Workspace indexed", detail: "24 files · 3 folders · 0 uploads", kind: "amber" },
];

function Icon({ name }) {
  const paths = {
    spark: "M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z",
    plus: "M12 5v14M5 12h14",
    globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.3 2.5 3.4 5.5 3.4 9S14.3 18.5 12 21c-2.3-2.5-3.4-5.5-3.4-9S9.7 5.5 12 3Z",
    settings: "M12 15.4a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8ZM19.4 13.5a7.8 7.8 0 0 0 0-3l2-1.5-2-3.4-2.3.9a7.8 7.8 0 0 0-2.6-1.5L14.2 2h-4l-.3 2.9a7.8 7.8 0 0 0-2.6 1.5L5 5.6 3 9l2 1.5a7.8 7.8 0 0 0 0 3L3 15l2 3.4 2.3-.9a7.8 7.8 0 0 0 2.6 1.5l.3 3h4l.3-3a7.8 7.8 0 0 0 2.6-1.5l2.3.9 2-3.4-2-1.5Z",
    arrow: "M5 12h13M13 6l6 6-6 6",
    check: "m5 12 4 4L19 6",
    file: "M6 3h8l4 4v14H6V3Zm8 0v5h4M9 13h6M9 17h4",
    clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    lock: "M7 10V8a5 5 0 0 1 10 0v2m-11 0h12v10H6V10Z",
  };
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="icon">
      <path d={paths[name]} />
    </svg>
  );
}

function App() {
  const [scenePhase, setScenePhase] = useState(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return "dawn";
    if (hour >= 11 && hour < 17) return "day";
    if (hour >= 17 && hour < 21) return "dusk";
    return "night";
  });
  const [tasks, setTasks] = useState(initialTasks);
  const [activeTask, setActiveTask] = useState("brief");
  const [webAccess, setWebAccess] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [notice, setNotice] = useState("Your workspace is ready.");
  const [runtime, setRuntime] = useState({ provider: "checking", models: [] });
  const [planning, setPlanning] = useState(false);
  const [plan, setPlan] = useState("");
  const [output, setOutput] = useState("");
  const [route, setRoute] = useState(null);
  const [agentCatalog, setAgentCatalog] = useState([]);
  const [training, setTraining] = useState({ state: "idle", progress: 0, phase: "idle" });
  const [lastExecutionOnline, setLastExecutionOnline] = useState(false);

  useEffect(() => {
    const updateScene = () => {
      const hour = new Date().getHours();
      setScenePhase(hour >= 5 && hour < 11 ? "dawn" : hour >= 11 && hour < 17 ? "day" : hour >= 17 && hour < 21 ? "dusk" : "night");
    };
    const sceneInterval = window.setInterval(updateScene, 60000);
    fetch("http://127.0.0.1:4317/api/health")
      .then((response) => response.json())
      .then((body) => {
        setRuntime(body);
        setNotice(body.models?.length ? `Connected to ${body.models[0].name}.` : "No capable local model is configured.");
      })
      .catch(() => setNotice("Start the local gateway to connect Orbit to your models."));
    fetch("http://127.0.0.1:4317/api/agents")
      .then((response) => response.json())
      .then((body) => setAgentCatalog(body.agents || []))
      .catch(() => setAgentCatalog([]));
    const pollTraining = () => fetch("http://127.0.0.1:4317/api/training/status")
      .then((response) => response.json())
      .then((body) => setTraining(body.training || { state: "idle", progress: 0, phase: "idle" }))
      .catch(() => {});
    pollTraining();
    const interval = window.setInterval(pollTraining, 2000);
    return () => {
      window.clearInterval(interval);
      window.clearInterval(sceneInterval);
    };
  }, []);

  const active = useMemo(() => tasks.find((task) => task.id === activeTask) ?? tasks[0], [activeTask, tasks]);

  async function runTask(event) {
    event.preventDefault();
    const text = prompt.trim();
    if (!text) {
      setNotice("Describe an outcome to start a task.");
      return;
    }
    const newTask = {
      id: `task-${Date.now()}`,
      title: text.length > 32 ? `${text.slice(0, 32)}…` : text,
      detail: "New local task · waiting for a plan",
      state: "Planning",
      color: "coral",
      icon: "✦",
      time: "now",
    };
    setTasks((current) => [newTask, ...current]);
    setActiveTask(newTask.id);
    setPrompt("");
    setNotice("Routing your task to the right local specialist…");
    try {
      const response = await fetch("http://127.0.0.1:4317/api/route", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Routing failed.");
      setRoute(body.route);
      setTasks((current) => current.map((task) => task.id === newTask.id
        ? { ...task, detail: `${body.route.agent} agent · ${body.route.needsWeb ? "web-aware" : "local-only"}`, state: "Routed" }
        : task));
      setNotice(`Routed to ${body.route.agent}. Ready for autonomous execution.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Local routing failed.");
    }
  }

  function selectTask(id) {
    setActiveTask(id);
    setNotice("Task brought to the desk.");
  }

  async function startPlan() {
    setPlanning(true);
    setPlan("");
    setNotice("Asking the local model for a focused plan…");
    try {
      const response = await fetch("http://127.0.0.1:4317/api/autonomous", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: active.title, agent: route?.agent, output: "markdown" }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Execution failed.");
      setOutput(body.content || body.execution?.content || "");
      setPlan(body.content || body.execution?.content || "");
      setLastExecutionOnline(body.localOnly === false);
      setTasks((current) => current.map((task) => task.id === active.id
        ? { ...task, detail: `${body.agent} agent · local artifact ready`, state: "Complete" }
        : task));
      setNotice(`Orbit completed a ${body.tierLabel || "local"} pass with verification.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Local execution failed.");
    } finally {
      setPlanning(false);
    }
  }

  function exportPlan() {
    if (!plan) {
      setNotice("Run a local plan first, then export it.");
      return;
    }
    const blob = new Blob([`# ${active.title}\n\n${plan}\n`], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${active.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Markdown artifact exported locally.");
  }

  return (
    <main className="app-shell" data-scene={scenePhase}>
      <a className="skip-link" href="#main-content">Skip to workspace</a>
      <div className="scenery" aria-hidden="true">
        <div className="scenery-glow scenery-glow-one" />
        <div className="scenery-glow scenery-glow-two" />
        <div className="scenery-moon" />
        <div className="scenery-sun" />
        <div className="scenery-cloud scenery-cloud-one" />
        <div className="scenery-cloud scenery-cloud-two" />
        <div className="scenery-horizon" />
        <div className="scenery-stars scenery-stars-one" />
        <div className="scenery-stars scenery-stars-two" />
      </div>
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark"><Icon name="spark" /></div>
          <div>
            <div className="brand-name">orbit</div>
            <div className="brand-caption">local intelligence</div>
          </div>
        </div>

        <nav className="primary-nav" aria-label="Primary">
          <button className="nav-item is-active"><span className="nav-glyph">◉</span> Workspace</button>
          <button className="nav-item"><span className="nav-glyph">⌁</span> Library <span className="nav-count">24</span></button>
          <button className="nav-item"><span className="nav-glyph">◇</span> Automations</button>
        </nav>

        <div className="sidebar-divider" />
        <div className="sidebar-section-label">Local routes</div>
        <div className="route-list">
          <div className="route-row"><span className={`route-dot ${runtime.models?.length ? "mint" : "coral"}`} /> Native runtime <span className="route-status">{runtime.models?.length ? "online" : runtime.provider === "checking" ? "checking" : "offline"}</span></div>
          <div className="route-row"><span className="route-dot mint" /> Browser tools <span className="route-status">ready</span></div>
          <div className="route-row"><span className={`route-dot ${runtime.onlineProvider?.configured ? "blue" : ""}`} /> Online escalation <span className="route-status">{runtime.onlineProvider?.configured ? runtime.onlineProvider.model : "not set"}</span></div>
          <div className="route-row is-muted"><span className="route-dot" /> Image lab <span className="route-status">not set</span></div>
        </div>

        <div className="sidebar-bottom">
          <div className="privacy-badge"><Icon name="lock" /><span><strong>Private by default</strong><small>Nothing leaves this device without your say.</small></span></div>
          <button className="settings-button"><Icon name="settings" /> Settings</button>
          <div className="profile-row"><div className="avatar">RH</div><div><strong>Rohan</strong><small>Personal workspace</small></div><span className="profile-more">•••</span></div>
        </div>
      </aside>

      <section className="workspace" id="main-content">
        <header className="topbar">
          <div className="breadcrumbs"><span className="orbit-wordmark">orbit</span><span className="crumb-slash">/</span><strong>Today</strong></div>
          <div className="topbar-actions"><div className="sync-status"><span className="pulse-dot" /> Local runtime active</div><button className="icon-button" aria-label="Open settings"><Icon name="settings" /></button></div>
        </header>

        <div className="content">
          <section className="hero-line">
            <div>
              <span className="hero-kicker"><span className="hero-kicker-dot" /> YOUR PERSONAL INTELLIGENCE SPACE</span>
              <h1>Good afternoon, Rohan.</h1>
              <p>Bring a thought. Orbit turns it into forward motion.</p>
            </div>
            <div className="date-stamp"><span>{new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date()).toUpperCase()}</span><strong>{new Intl.DateTimeFormat(undefined, { day: "2-digit" }).format(new Date())}</strong><small>{new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(new Date()).toUpperCase()}</small></div>
          </section>

          <section className="desk-grid">
            <div className="desk-panel">
              <div className="panel-topline"><span className="eyebrow"><span className="live-dot" /> ACTIVE DESK</span><span className="task-id">ROUTE 01</span></div>
              <div className="desk-content">
                <div className="task-marker coral"><span>{active.icon}</span></div>
                <div className="task-heading">
                  <h2>{active.title}</h2>
                  <p>{active.detail}</p>
                </div>
                <button className="more-button" aria-label="More task options">•••</button>
              </div>

              <div className="plan-strip">
              <div className="plan-label">{output ? "LOCAL OUTPUT" : "NEXT MOVE"} <span>›</span></div>
              <div className="plan-body"><strong>{output ? output.split("\n")[0] : route ? `Run with ${route.agent} agent` : "Draft a focused plan"}</strong><span>{output ? (lastExecutionOnline ? "Escalated through configured online model" : "Generated on this device") : route ? `${route.tools?.join(" · ") || "bounded tools"} · ${route.needsWeb ? "web permission required" : "local-only"}` : runtime.models?.length ? "Ask the native worker · no web needed yet" : "Start the native runtime to run this step"}</span></div>
              <button className="start-button" onClick={startPlan} disabled={planning}>{planning ? "Working…" : output ? "Run again" : "Start"} <Icon name="arrow" /></button>
              </div>

              <div className="desk-footer">
                <div className="capability-row"><span><Icon name="spark" /> {runtime.models?.length ? runtime.models[0].name : "Local model"}</span><span><Icon name="check" /> {agentCatalog.length || 5} agents ready</span><button className="artifact-link" onClick={exportPlan}><Icon name="file" /> Export .md</button>{webAccess && <span><Icon name="globe" /> Web enabled</span>}</div>
                <span className="desk-updated"><Icon name="clock" /> Updated just now</span>
              </div>
            </div>

            <aside className="brief-panel">
              <div className="panel-topline"><span className="eyebrow">TASK SIGNAL</span><button className="tiny-action">Edit</button></div>
              <div className="signal-chart" aria-label="Task activity signal">
                <div className="chart-line chart-line-one" />
                <div className="chart-line chart-line-two" />
                <div className="chart-orbit orbit-one" />
                <div className="chart-orbit orbit-two" />
                <div className="chart-core"><span>72</span><small>clarity</small></div>
              </div>
              <div className="signal-footer"><span><i className="legend coral" /> momentum</span><span><i className="legend blue" /> context</span></div>
            </aside>
          </section>

          {output && (
            <section className="conversation-panel" aria-live="polite">
              <div className="conversation-heading">
                <div className="assistant-avatar"><Icon name="spark" /></div>
                <div><span className="eyebrow">ORBIT RESPONSE</span><strong>{lastExecutionOnline ? "Escalated answer" : "Local answer"}</strong></div>
                <span className="conversation-badge">{lastExecutionOnline ? "online tier" : "on device"}</span>
              </div>
              <div className="conversation-body">{output}</div>
              <div className="conversation-footer"><span><Icon name="check" /> Verified pass</span><span>{route?.agent || "planner"} specialist</span><button className="text-button" onClick={exportPlan}>Save response <Icon name="arrow" /></button></div>
            </section>
          )}

          <section className="task-rail-section">
            <div className="section-heading"><div><span className="eyebrow">YOUR ROUTES</span><h3>Work in motion</h3></div><button className="text-button" onClick={() => setNotice("All tasks are already visible in this desk.")}>View all <Icon name="arrow" /></button></div>
            <div className="task-rail">
              {tasks.map((task, index) => (
                <button key={task.id} className={`task-card ${task.id === activeTask ? "is-selected" : ""}`} onClick={() => selectTask(task.id)}>
                  <div className={`task-card-icon ${task.color}`}>{task.icon}</div>
                  <div className="task-card-copy"><strong>{task.title}</strong><span>{task.detail}</span></div>
                  <div className="task-card-meta"><span className={`state-dot ${task.color}`} />{task.state}<small>{task.time}</small></div>
                  {index === 0 && <span className="task-card-line" />}
                </button>
              ))}
              <button className="new-task-card" onClick={() => document.getElementById("prompt")?.focus()}><span><Icon name="plus" /></span><strong>New task</strong><small>Start from an outcome</small></button>
            </div>
          </section>

          <section className="lower-grid">
            <div className="activity-panel">
              <div className="section-heading compact"><div><span className="eyebrow">SYSTEM TRACE</span><h3>Quietly keeping up</h3></div><span className="trace-count">3 events</span></div>
              <div className="activity-list">
                {activities.map((item) => <div className="activity-row" key={item.time}><span className={`activity-dot ${item.kind}`} /><time>{item.time}</time><div><strong>{item.label}</strong><span>{item.detail}</span></div></div>)}
              </div>
            </div>
            <div className="access-panel">
              <div className="section-heading compact"><div><span className="eyebrow">PERMISSIONS</span><h3>Your boundaries</h3></div><button className={`toggle ${webAccess ? "is-on" : ""}`} onClick={() => { setWebAccess((value) => !value); setNotice(`Web access ${webAccess ? "paused" : "enabled"}.`); }} aria-label="Toggle web access"><span /></button></div>
              <p>Orbit can browse the web when you allow it. Every source will be attached to the task, never hidden inside the answer.</p>
              <div className="permission-row"><span><Icon name="globe" /> Internet research</span><strong>{webAccess ? "Allowed" : "Paused"}</strong></div>
              <div className="permission-row"><span><Icon name="file" /> Local files</span><strong>Allowed</strong></div>
            </div>
          </section>
          <section className="training-panel">
            <div className="section-heading compact"><div><span className="eyebrow">MODEL TRAINING</span><h3>Orbit fine-tune</h3></div><strong className="training-state">{training.state}</strong></div>
            <div className="training-meta"><span>{training.phase || "idle"}</span><span>{training.step || 0}/{training.totalSteps || 0} steps</span><strong>{training.progress || 0}%</strong></div>
            <div className="training-track"><span style={{ width: `${Math.min(100, Math.max(0, training.progress || 0))}%` }} /></div>
            <p>Offline LoRA workflow · provenance-tagged data · local adapter output</p>
          </section>

          <form className="composer" onSubmit={runTask}>
            <div className="composer-icon"><Icon name="spark" /></div>
            <input id="prompt" name="prompt" autoComplete="off" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ask Orbit anything… e.g. “Plan my week”" aria-label="Describe a task" />
            <div className="composer-actions"><button type="button" className={`web-chip ${webAccess ? "is-on" : ""}`} onClick={() => setWebAccess((value) => !value)}><Icon name="globe" /> Web {webAccess ? "on" : "off"}</button><button type="submit" className="send-button" aria-label="Create task"><Icon name="arrow" /></button></div>
          </form>
          <div className="notice" role="status" aria-live="polite"><span className="notice-line" />{notice}</div>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<StrictMode><App /></StrictMode>);
