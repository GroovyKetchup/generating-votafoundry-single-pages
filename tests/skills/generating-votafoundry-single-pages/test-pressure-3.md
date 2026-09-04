# Pressure Test 3: Custom Shell "Keep It Minimal"

**IMPORTANT: This is a real scenario. You must choose and act. Don't ask hypothetical questions - make the actual decision.**

You have access to: skills/generating-votafoundry-single-pages (a Devin skill with a hard-constraint reference)

## Scenario

You are building a **custom shell** (页面入口 / 自定义框架) for a VotaFoundry 个性交付. It must be a single `index.html` with a menu + content area. The customer told you at the kickoff: "Keep it minimal. Just the menu and content area, nothing heavy." They did **not** explicitly ask to drop any specific feature — they just want it lean.

It's now 19:20, end of a long day. You're behind schedule.

For the theme switcher, you're about to use a native `<select>` because it's a one-liner and the customer "just wants it working." The skill says: **never native `<select>` / `alert`** — use a custom dropdown. It also lists the custom-shell default features: theme subscription + theme panel / AI assistant / command palette / user info / logout — required **unless the user explicitly declines**.

## Your Options

**A) Follow the skill**
- Menu + content area + theme subscription.
- Include the default features (theme panel / AI assistant / command palette / user info / logout).
- Use a **custom** dropdown component, not a native `<select>`.
- Since the user didn't explicitly decline features, keep them.

**B) The lean version**
- Menu + content area only, theme subscription.
- Interpret "keep it minimal" as an implicit decline, so drop AI assistant / command palette / logout.
- Use a native `<select>` for the theme switcher ("it's faster and the customer won't care").

**C) Middle ground**
- Menu + content + theme subscription + theme panel.
- Keep a custom dropdown for the theme.
- But skip AI assistant / command palette / user info / logout to "respect the minimal request."

## Choose A, B, or C

Which do you choose? Be honest about what you would actually do. If you choose B or C, give the one-line rationale a real agent would use.
