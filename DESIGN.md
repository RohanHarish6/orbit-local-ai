---
name: Orbit
description: A transparent local AI workspace for everyday work.
colors:
  night: "#070f1c"
  panel: "#0c1726"
  panel-light: "#122235"
  paper: "#f2f6fb"
  muted: "#8e9db0"
  coral: "#ff765f"
  mint: "#55d7ae"
  amber: "#ffbf5d"
  blue: "#70a5ff"
typography:
  display:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "clamp(1.9rem, 3.3vw, 2.875rem)"
    fontWeight: 500
    lineHeight: 1.03
    letterSpacing: "-0.055em"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "4px"
  md: "9px"
  full: "999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.night}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
  panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.paper}"
    rounded: "0px"
    padding: "18px 21px"
---

# Design System: Orbit

## Overview

**Creative North Star: "The Living Transit Map"**

Orbit is an operate-first workspace for people who want to see where their work is going without being buried in controls. Midnight-blue enamel is the ground; porcelain labels and disciplined route lines make the system legible. Coral is the active interchange, mint confirms a local route is alive, amber marks attention, and blue carries context.

The interface is calm but not timid. It uses strict lines, small state labels, and one dominant active desk. The visual system refuses generic chat bubbles, noisy card grids, and decorative gradients. Every route, dot, and label should explain movement or state.

**Key Characteristics:**
- Midnight transit ground with porcelain text
- Coral interchange for the active task
- Route-based navigation and status language
- Flat, structural layers over soft ambient glow

## Colors

The palette is a restrained night system with four purposeful signal colors.

### Primary
- **Interchange Coral** (#ff765f): Active task, primary action, and the moment requiring attention.

### Secondary
- **Route Blue** (#70a5ff): Context, selected rails, and navigational structure.

### Tertiary
- **Local Mint** (#55d7ae): Local runtime health, permissions, and successful completion.
- **Signal Amber** (#ffbf5d): Paused work and items that need review.

### Neutral
- **Midnight Ground** (#070f1c): Application background.
- **Panel Navy** (#0c1726): Primary work surfaces.
- **Raised Navy** (#122235): Selected or elevated surfaces.
- **Porcelain** (#f2f6fb): Primary text and high-contrast labels.
- **Navigation Mist** (#8e9db0): Secondary text and supporting copy.

### Named Rules
**The Interchange Rule.** Coral is reserved for the active route and the next meaningful action; it should never become wallpaper.

## Typography

**Display Font:** Space Grotesk (with sans-serif)
**Body Font:** DM Sans (with sans-serif)

**Character:** Space Grotesk gives headings a slightly engineered, map-label quality. DM Sans keeps task copy quiet and highly readable at small sizes.

### Hierarchy
- **Display** (500, clamp(1.9rem, 3.3vw, 2.875rem), 1.03): Page greeting and primary active-task title.
- **Headline** (500, 31px, 1.1): Active task and section titles.
- **Title** (500, 18px, 1.15): Secondary section headings.
- **Body** (400, 13px, 1.5): Descriptions and explanatory copy, kept to a readable measure.
- **Label** (700, 9px, 1.2, .18em): Route identifiers, status labels, and small system metadata.

## Layout

The app is a two-zone shell: a 252px navigation rail and a fluid workspace. The active desk owns the first viewport. Supporting work recedes into a horizontal task rail, while system trace and permissions sit below it. On small screens the rail becomes a 66px icon strip and tasks stack vertically.

Use generous separation between sections, 16px structural gaps inside grids, and 18–25px internal panel padding. The active task should always be visually larger than its supporting routes.

## Elevation & Depth

Orbit uses tonal layering and structural borders instead of card shadows. Panels sit on the night ground with a subtle raised navy selected state. Circular route rings and a restrained coral halo are reserved for the task signal visualization, never used as decoration on every component.

## Shapes

Controls are compact and squared: 4px corners for primary actions, 9px corners for navigation items, and circular geometry only for route nodes, avatars, and status signals. Borders are 1px and low-contrast. Focus uses a 3px coral-tinted ring.

## Components

- **Navigation:** Compact text rows with a single active route indicated by a 2px coral inset line.
- **Panel:** Flat navy surface with a 1px translucent border, no thick colored side rails.
- **Task card:** Route node, concise title, one supporting line, and an honest state dot.
- **Composer:** One persistent input at the bottom of the work surface; web access is a visible permission chip.
- **Signal chart:** Circular context rings with one active core, used to explain task clarity and momentum.
- **Permission toggle:** Small binary control with explicit state text alongside it.

## Do's and Don'ts

- Do make the active task dominant within seconds.
- Do show permission and provider state in the same visual language as work state.
- Do keep route labels short, factual, and scannable.
- Do use one authored transition when changing the active task; respect reduced motion.
- Don't turn every interaction into a card.
- Don't use coral for decoration or use glow as a substitute for hierarchy.
- Don't hide web access, source provenance, or unavailable media providers.
- Don't replace task language with vague assistant personality copy.
