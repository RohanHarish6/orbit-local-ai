# Contributing to Orbit

Thanks for helping make local AI more useful, private, and understandable.

## Development setup

Requirements:

- Windows, macOS, or Linux
- Node.js 20+
- Python 3.12+
- A local GGUF model or another configured Transformers-compatible model

Install dependencies and run the web app:

```powershell
npm install
npm run build
npm run dev
```

In another terminal, start the local gateway:

```powershell
npm run server
```

## Before opening a pull request

- Keep changes focused and explain the user-visible outcome.
- Preserve local-first behavior and do not add hidden network calls.
- Never commit API keys, model weights, generated installers, or personal data.
- Run `npm run build`.
- Run `npm run eval:local` when changing routing, inference, or verification.
- Update the README or relevant docs when setup or behavior changes.

## Pull requests

Use a descriptive title and include:

- what changed and why;
- how you tested it;
- screenshots or a short recording for UI changes;
- known limitations or follow-up work.

Please open an issue before large architectural changes so the direction can be
discussed with maintainers and contributors.
