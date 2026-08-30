# dsh-raw-html · VCP Visual-Synesthesia Protocol Plugin

**[中文 README](./README.md) · [CHANGELOG](./CHANGELOG.md)**

Brings **VCP (Visual-Synesthesia)** to the DeepSeek Harness Web GUI:
HTML in messages goes from "a blob of source code" to a genuinely rendered interface,
and the agent outputs following a **maintainable design system**.

**Plug & play** on modern DSH: install this plugin + toggle the **「</>」switch** in the browser → the browser renders HTML
(including SVG cards / Mermaid charts / KaTeX math), the agent follows the design spec
(design principles / Chinese typography / font pairing).

> DeepSeek Harness 0.1.2-alpha.1 and other environments with the official
> `conversation.chat.node` / `assistant-step` slot require no frontend bundle patch.
> `patch/install-all.cjs` is retained only for legacy DSH.

## ✨ Gallery

> VCP cards rendered in real conversations (5 promo banners):

![Banner 1](docs/images/banner-1.jpg)
![Banner 2](docs/images/banner-2.jpg)
![Banner 3](docs/images/banner-3.jpg)
![Banner 4](docs/images/banner-4.jpg)
![Banner 5](docs/images/banner-5.jpg)

## 📣 What's New (v0.7.0 · official assistant slot)

- Modern rendering now shadows the official `assistant-step` cell at priority `-1`; plain Markdown still uses the official Assistant component.
- A slot-entry subscription fixes late registration: the plugin waits for the official renderer, registers once, and disposes both subscription and renderer correctly.
- VCP content renders in a Shadow DOM with strict sanitization by default. Trusted Mode script / iframe / WebGL / fetch execution now lives in the modern renderer instead of the patched bundle.
- Legacy patch scripts and tests remain available as a compatibility path.

### Earlier updates

**2026-08-24 updates**

- **Fixed (frontend compatibility)**: `install-v6.cjs` now supports **dsh-web-frontend 0.1.0-rc.8 / 0.1.1-rc.x** (bundle `index-CA9Bpko5.js` / `index-ClqxG24t.js`), where the minifier renamed `vc`→`Xu` and `hp`→`jd`/`Sd`. A new anchor set with automatic generation detection was added; legacy anchors (rc.5~rc.7) are kept intact and regression-verified.
- **Fixed (startup crash)**: removed the static `@deepseek-ai/schemastery` import from `lib/index.js` — the only third-party runtime dependency. It is now loaded dynamically with a graceful fallback, so the plugin boots fine even when `node_modules` is missing (static import chain is now built-in Node modules only).
- **Feature**: declarative color presets — write `data-vcp-preset="editorial|chiaroscuro|fauvism|cyberpunk|wabi_sabi"` and the built-in VCPColorEngine deterministically generates the whole `--vcp-*` palette (WCAG contrast & sRGB gamut closed-loop; hex never passes through the LLM; stable across streaming rebuilds).
- **Feature**: streaming anchor lock (CSS-only `overflow-anchor` lock) + cached ref closures — smoother streaming, no per-frame `setProperty` storms.
- **Protocol**: render/aesthetic split toggles; active visual-synesthesia prompting; flow discipline moved to the structural layer (measured output −4.6K tokens/turn, cost −¥0.056).

**Audit hardening (2026-08-21)**

- **Security (P0)**: fixed the `on*` attribute passthrough gap (only the `onclick` bridge is allowed); fixed the performance-timer diagnostics; aligned documentation references.
- **Performance (P1)**: fast guards for regex conversions, fixed the mermaid global-listener leak, protocol text slimmed by ~74%.
- **Fonts (P2)**: 12 built-in commercial fonts → **7 open-source fonts** (all OFL-licensed).
- **Enhancements**: `prefers-reduced-motion` accessibility, keyboard focus states, named constants for magic numbers.
- See [CHANGELOG.md](./CHANGELOG.md) for the full list.

## Versioning

- **Plugin version**: the `version` in `package.json` (currently **0.7.0**), upgraded via `dsh plugin`; modern DSH uses the official slot.
- **Legacy patch codename**: **v6.38**, retained only for DSH builds without the official assistant slot.

## Components

| Component | Path | Purpose |
|---|---|---|
| Modern slot renderer | `lib/client.js` | Official assistant slot routing, late-registration lifecycle, Shadow DOM, sanitization, stable DOM updates, KaTeX, Mermaid, VCPColorEngine, download/input bridges, and Trusted Mode execution |
| Legacy one-shot installer | `patch/install-all.cjs` | **Legacy DSH only**: installs `install-v6.cjs` + `trusted-patch.cjs`; idempotent with backup/rollback and syntax checks |
| Legacy render module | `patch/v6-inject.js` | Injected into the dist bundle only when the official assistant slot is unavailable; preserves vcp-fast and self-healing behavior |
| **vcp-fast engine** | `patch/v6-inject.js` | Container-aware block-level incrementality: closed blocks cached (element references stay stable across frames → React skips diff → real looping animations), only the tail re-rendered; measured cache-hit **1200~6800×**, incremental **12×** speedup |
| Plugin (host side) | `lib/index.js` | Toggle state (**persisted to disk**) + VCP protocol injected into the system prompt + `/fonts` font service (**built-in + external library dual source**) + shared knowledge (the protocol carries the local DESIGN.md path for any agent) |
| Plugin (browser side) | `lib/client.js` | Modern renderer plus the **「</>」settings**, Trusted Mode badge, and `window.__dshInput` |
| **Built-in fonts** | `assets/fonts/` | **7 open-source fonts (woff2 subsets, ~7.6MB) shipped with the plugin** — WenKai / WenKai Light / MaShanZheng / HeiTi / HeiTi Light / HeiTi Bold / GreatVibes, all OFL-licensed, zero config |
| Design system docs | `DESIGN.md` | Full spec library: font list / palettes / Chinese typography / security iron laws (knowledge layer; agents may read on demand) |
| Regression tests | `tests/` | Modern slot lifecycle/security/Trusted/stable-DOM tests plus legacy stable/security/smoke/math/mermaid/trusted suites; bundle tests run separately when a legacy dist is available |
| Benchmark | `patch/vcp-fast-bench.cjs` | Compares old/new paths in a real DOM parsing environment (auto-downloads dependencies, zero install) |
| Subset tool | `tools/subset_fonts.py` | For maintainers: trims new fonts to common-character subsets + woff2 compression (needs Python + fonttools + brotli) |

## Install

### Modern DSH (recommended)

For environments with the official `conversation.chat.node` / `assistant-step` slot, including DeepSeek Harness 0.1.2-alpha.1:

```powershell
# 1. Install the plugin
dsh plugin --profile web add "path\to\plugin"

# 2. Restart dsh and refresh the browser
# 3. Enable 「</>」; enable the bottom-right Trusted Mode badge only when scripts are required
```

This path does not modify `@deepseek-ai/dsh-web-frontend/dist/assets/index-*.js` and does not depend on bundle hashes or minified `vc` / `Xu` / `jd` symbols.

### Legacy DSH compatibility

Only use the installer if the environment has no official assistant slot and still displays `#vcp-root` as source:


```powershell
node "path\to\plugin\patch\install-all.cjs"
# If auto-detection fails:
node "...\patch\install-all.cjs" "C:\...\dsh-web-frontend\dist\assets\index-*.js"
```

This is **legacy compatibility only**. The running plugin never mutates `node_modules` by itself.

## Rendering stability

The modern renderer performs node-level updates inside its Shadow DOM. Completed nodes keep their DOM identity while the streaming tail changes, preserving animations, canvas/WebGL state, and interaction state without `window.__vcpStable`.

The following `window.__vcpFast` engine applies only to the legacy patch:

The "cache + incremental" dual engine (`window.__vcpFast`) layered on the v1 render patch:

- **Exact cache**: when the HTML string is unchanged, returns the cached React element reference — React skips reconciliation for identical references. History scrolling / session switching / React re-renders → zero rebuild.
- **Incremental append**: content = old content + appended segment, and when the old content ends with a closed tag, stable parts keep their references and only the new segment is parsed.
- **Safety boundary**: only active in non-streaming mode with the toggle on; falls back to full re-render on unclosed old values or content rewrites; cache capped at 200 entries; onclick bridging and script/iframe filtering unchanged.
- **Verify**: `[vcp-fast] HIT/BUILD` logs in the DevTools console (throttled every 2s); benchmarks in `patch/vcp-fast-bench.cjs` (measured in a real DOM environment: ~1200~6800× cache-hit, ~12× incremental speedup).

## ⚠️ Common pitfall: no blank lines inside vcp-root (important!)

**A markdown HTML block ends at a blank line (`\n\n`)** — if `<div id="vcp-root">` contains two consecutive line breaks, the card is split into multiple nodes: the opening part is auto-completed by DOMParser into a small card with only a top background strip, and the rest overflows outside the background. Symptom: **the dark background only wraps the top strip, and content below has no background** (confirmed 2026-08-19).

**Rules**:
- All children inside vcp-root use **single line breaks** or stay on one line; never leave `\n\n` anywhere;
- Use `margin` for visual grouping, not blank lines;
- After writing, check: the card HTML string must contain zero occurrences of `\n\n`.

## Config

- **Built-in fonts** (recommended): 7 open-source fonts shipped with the plugin (all OFL-licensed), zero config.
- **External font library** (optional): defaults to `I:\字体`. Point `Settings → Plugins → raw-html → fontsRoot` to your own library (or edit the default in `lib/index.js`). Works fine without one: 7 built-in open-source fonts + system fonts as fallback.
- **Toggle state**: persisted at `~/.dsh/dsh-raw-html-state.json`, restored after service restart.

## Usage

- Click **「</> OFF」→「</> ON」** next to the composer send button to enable;
- Once on, HTML in **new messages** renders immediately; historical messages re-render on page refresh;
- The agent receives the injected VCP protocol → automatically outputs `#vcp-root` visual containers; when off, the protocol is withdrawn → the agent falls back to plain Markdown.
- VCP buttons `onclick="input('reply text')"` fill the input and send on click.

## Maintenance / Upgrading

- After each change: `node --check lib/client.js && node --check lib/index.js`; client changes take effect on refresh; host changes require a dsh service restart.
- Modern DSH upgrades normally require only the normal plugin upgrade/restart. Frontend rebuild hashes and minifier renames do not affect the official slot path.
- Re-run `patch/install-all.cjs` only when a legacy DSH upgrade overwrites its patched dist bundle.
- **Dependency declaration rule** (lesson from the 2026-08-19 crash): every third-party package you `import` **must be declared** in package.json (dependencies or peerDependencies) — relying on whatever node_modules happens to exist is gambling your lifeline. Run `node tools/check-deps.cjs` after each change to verify.
- To improve the design spec → edit `DESIGN.md` (agents read it on demand) + sync the protocol text (`buildProtocolText` in `lib/index.js`).
- To add built-in fonts → edit the FONTS list in `tools/subset_fonts.py` and re-run (needs Python + fonttools + brotli); woff2 subsets are output to `assets/fonts/`.

## Uninstall / restore

```powershell
# Modern DSH: remove the plugin. Legacy DSH: also restore the installer's bundle backup.
dsh plugin --profile web remove dsh-raw-html
```

## Security notes

Once enabled, HTML from model output is rendered as UI. The modern renderer filters scripts/events/dangerous
protocols by default (events only allow the controlled
`onclick="input('...')"` channel; `script/iframe/object/embed` and `javascript:` protocols are
dropped), but styles and external images remain reachable — **enable only for trusted models**.

Trusted Mode is off by default. When explicitly enabled, inline scripts execute once after the Shadow DOM is mounted; iframe/object/embed, WebGL, and fetch are available, while `javascript:` URLs remain blocked. A scoped `document` lookup lets existing scripts find canvas elements inside the card. The modern state, badge, sanitizer, and execution carrier all live in `lib/client.js`; unloading the plugin removes the renderer and its subscription. Legacy DSH continues to use the guarded v6 patch implementation.
