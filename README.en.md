# dsh-raw-html

Adds VCP HTML rendering to DeepSeek Harness. When enabled, model output containing `<div id="vcp-root">...</div>` is rendered as a real interface instead of HTML source text.

Supports SVG, Mermaid, KaTeX, bundled fonts, interactive buttons, and an optional Trusted Mode.

**[简体中文](./README.md)**

## Install

### DSH Desktop

Run in PowerShell:

```powershell
$dir = Join-Path $HOME "dsh-plugins\dsh-raw-html"
git clone https://github.com/plolpl789/dsh-raw-html.git $dir
dsh plugin add $dir
```

Then:

1. Fully quit and restart DSH Desktop.
2. Find the `</>` button next to the composer.
3. Enable **Render HTML**. Enable **Aesthetic injection** only when you also want the agent to proactively use the VCP visual style.

The local plugin is installed as a link, so keep `$HOME\dsh-plugins\dsh-raw-html`.

### DSH Web / CLI profile

```powershell
$dir = Join-Path $HOME "dsh-plugins\dsh-raw-html"
git clone https://github.com/plolpl789/dsh-raw-html.git $dir
dsh plugin --profile web add $dir
```

Restart the DSH service and refresh the browser.

### Update

```powershell
$dir = Join-Path $HOME "dsh-plugins\dsh-raw-html"
git -C $dir pull
```

Restart DSH after updating.

## Usage

The `</>` button has three states:

- `</> OFF`: HTML rendering disabled.
- `</> Render`: VCP HTML rendering only.
- `</> ON`: HTML rendering plus VCP / aesthetic prompt injection.

Plain Markdown continues to use the native DSH renderer. Only content containing `#vcp-root` is handled by the VCP renderer.

Interactive VCP buttons can use:

```html
onclick="input('reply text')"
```

to fill the composer and send the reply.

## Compatibility

DeepSeek Harness 0.1.2-alpha.1 and other modern DSH builds exposing the official `conversation.chat.node` / `assistant-step` slot **do not require frontend bundle patching and should not run the patch installer**.

Use the legacy patch only on an older DSH build that is known not to provide those official slots:

```powershell
$dir = Join-Path $HOME "dsh-plugins\dsh-raw-html"
node "$dir\patch\install-all.cjs"
```

The legacy installer modifies the old DSH frontend bundle. Modern DSH should not use it.

## Trusted Mode

Trusted Mode is disabled by default.

When enabled, it relaxes HTML restrictions and allows model-generated content to use capabilities such as `script`, `iframe`, `object`, `embed`, WebGL, and `fetch`.

**Enabling Trusted Mode allows model-generated page code to execute in your local browser context. Enable it only when you fully trust the model output and its content sources.**

`javascript:` URLs remain blocked.

## Uninstall

DSH Desktop:

```powershell
dsh plugin remove dsh-raw-html
```

DSH Web / CLI profile:

```powershell
dsh plugin --profile web remove dsh-raw-html
```

After the plugin has been removed, you may delete the local checkout:

```powershell
Remove-Item -Recurse -Force (Join-Path $HOME "dsh-plugins\dsh-raw-html")
```

If you previously used the legacy patch on an older DSH build, also restore the frontend bundle from the backup created by the installer.
