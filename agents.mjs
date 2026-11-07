export const agents = {
  planner: {
    id: "planner",
    label: "Route planner",
    model: "native-python",
    purpose: "Break an outcome into safe, ordered steps and identify the best specialist.",
    tools: ["plan", "delegate"],
  },
  researcher: {
    id: "researcher",
    label: "Research scout",
    model: "native-python",
    purpose: "Produce a source-aware research brief. Internet access is opt-in and not executed by this worker yet.",
    tools: ["plan", "source-map"],
  },
  writer: {
    id: "writer",
    label: "Document maker",
    model: "native-python",
    purpose: "Draft clear copy and structured documents from a user outcome.",
    tools: ["plan", "artifact:markdown", "artifact:html"],
  },
  coder: {
    id: "coder",
    label: "Code builder",
    model: "native-python",
    purpose: "Plan implementation work and return code-oriented steps without running arbitrary commands.",
    tools: ["plan", "artifact:markdown"],
  },
  creative: {
    id: "creative",
    label: "Creative director",
    model: "native-python",
    purpose: "Create production-ready prompts and shot plans for local image or video providers.",
    tools: ["plan", "artifact:creative-brief"],
  },
};

export const generationAdapters = {
  markdown: { id: "markdown", label: "Markdown document", available: true, description: "Local text artifact with no external provider." },
  html: { id: "html", label: "HTML document", available: true, description: "Self-contained HTML artifact generated locally." },
  pdf: { id: "pdf", label: "PDF document", available: false, description: "Add a local renderer such as Playwright or Chromium to enable PDF output." },
  image: { id: "image", label: "Image generation", available: false, description: "Connect a local ComfyUI or Stable Diffusion endpoint to enable image output." },
  video: { id: "video", label: "Video generation", available: false, description: "Connect a local ComfyUI video workflow to enable video output." },
};

export function chooseAgent(prompt) {
  const text = prompt.toLowerCase();
  if (/\b(code|bug|build|implement|refactor|typescript|javascript|python|sql|csv|script|function|class|frontend|backend|api|debug|test)\b/.test(text)) return "coder";
  if (/\b(research|compare|sources|latest|find out|investigate)\b/.test(text)) return "researcher";
  if (/\b(image|illustration|visual|video|storyboard|shot)\b/.test(text)) return "creative";
  if (/\b(write|rewrite|document|brief|email|pdf|report)\b/.test(text)) return "writer";
  return "planner";
}
