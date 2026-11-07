# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user: a technically curious individual who wants one calm local workspace for everyday research, planning, writing, document creation, and creative production. They may be working at a desk with local files, a browser, and one or more locally hosted AI models.

## Product Purpose

Create a local-first AI workspace that can understand a request, plan a multi-step task, use the internet when explicitly enabled, and produce useful artifacts such as documents, images, videos, and PDFs without sending the core conversation or files to a hosted AI provider.

Success means the user can open one dashboard, describe an outcome in plain language, see what the agent is doing, review the result, and export or continue the work without navigating a cluttered collection of tools.

## Positioning

The product's distinctive mechanism is a transparent local task runtime: a locally running model coordinates bounded tools and artifact generators, while the dashboard makes the plan, permissions, sources, and outputs visible instead of hiding them behind a chat-only interface.

## Operating Context

The product runs on the user's machine and may connect to the internet for web research and user-approved remote resources. Its primary model path is a native Python worker using an optional local Transformers-compatible model, with an Orbit Micro fallback that needs no model server. It should treat files, prompts, tool calls, and generated artifacts as local workspace data.

## Capabilities and Constraints

- The first slice should provide a dashboard shell, task composer, local model status, activity feed, source visibility, and artifact output states.
- Web access is an explicit capability with visible source provenance and a clear disabled state.
- Document, PDF, image, and video generation are adapter-based capabilities; the app must not claim a generator exists until a compatible local provider is configured.
- The architecture should support local model routing, tool permissions, task plans, resumable jobs, and artifact manifests.
- Inferred constraint: the prototype should be runnable with common Node.js tooling and should remain useful in demo mode without a configured model.
- Open decision: the user's preferred local model runner and GPU/CPU budget are not yet specified.
- Open decision: the exact document and media generation backends are not yet specified.

## Brand Commitments

The user explicitly asked for a dashboard that is breathtakingly beautiful, interactive, minimal, and non-confusing. The product should feel capable and calm rather than noisy or gamified.

## Evidence on Hand

No existing code, assets, customer evidence, or production integrations were provided. The prototype must label simulated activity and synthetic preview content clearly.

## Product Principles

1. Local by default: private work stays on the device unless the user enables an external capability.
2. Show the work: plans, permissions, sources, and outputs are inspectable.
3. One calm surface: reduce tool sprawl and keep the next action obvious.
4. Adapters over promises: provider capabilities are discovered, not assumed.
5. Useful before magical: the system should still help when a model or generator is unavailable.

## Accessibility & Inclusion

Use keyboard-operable controls, visible focus states, readable contrast, reduced-motion support, descriptive labels, and status text that does not rely on color alone.
