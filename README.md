# dsh-raw-html

为 DeepSeek Harness 提供 VCP HTML 渲染。开启后，模型输出的 `<div id="vcp-root">...</div>` 会在聊天中渲染为真实界面，而不是显示为 HTML 源码。

支持 SVG、Mermaid、KaTeX、内置字体、交互按钮，以及可选的 Trusted Mode。

**[English](./README.en.md)**

## 安装

### DSH Desktop

在 PowerShell 中执行：

```powershell
$dir = Join-Path $HOME "dsh-plugins\dsh-raw-html"
git clone https://github.com/plolpl789/dsh-raw-html.git $dir
dsh plugin add $dir
```

安装后：

1. 完全退出并重新启动 DSH Desktop。
2. 在输入框旁找到 `</>` 按钮。
3. 打开“渲染 HTML”；需要模型主动采用视觉排版时，再打开“美学注入”。

本地插件通过 link 方式安装，请保留 `$HOME\dsh-plugins\dsh-raw-html` 目录。

### DSH Web / CLI profile

```powershell
$dir = Join-Path $HOME "dsh-plugins\dsh-raw-html"
git clone https://github.com/plolpl789/dsh-raw-html.git $dir
dsh plugin --profile web add $dir
```

然后重启 DSH 服务并刷新浏览器。

### 更新

```powershell
$dir = Join-Path $HOME "dsh-plugins\dsh-raw-html"
git -C $dir pull
```

更新后重启 DSH。

## 使用

`</>` 按钮有三种状态：

- `</> OFF`：关闭 HTML 渲染。
- `</> 渲染`：只渲染 VCP HTML，不注入美学提示。
- `</> ON`：渲染 HTML，同时向 agent 注入 VCP / 美学规范。

普通 Markdown 仍使用 DSH 原生渲染器。只有包含 `#vcp-root` 的内容会进入 VCP renderer。

插件也支持：

```html
onclick="input('回复内容')"
```

用于把按钮内容填入输入框并发送。

## 兼容性

DeepSeek Harness 0.1.2-alpha.1 及其他提供官方 `conversation.chat.node` / `assistant-step` slot 的现代 DSH，**不需要修改 frontend bundle，也不需要运行 patch 安装器**。

旧版 DSH 如果明确没有上述官方 slot，才使用 legacy patch：

```powershell
$dir = Join-Path $HOME "dsh-plugins\dsh-raw-html"
node "$dir\patch\install-all.cjs"
```

Legacy patch 会修改旧版 DSH 的 frontend bundle。现代 DSH 不应运行它。

## Trusted Mode

Trusted Mode 默认关闭。

开启后会放宽 HTML 限制，允许模型输出中的脚本和嵌入内容使用 `script`、`iframe`、`object`、`embed`、WebGL、`fetch` 等能力。

**开启 Trusted Mode 等同于允许模型生成的页面代码在本地浏览器上下文中执行。只有在完全信任模型输出和内容来源时才应开启。**

`javascript:` URL 仍会被拒绝。

## 卸载

DSH Desktop：

```powershell
dsh plugin remove dsh-raw-html
```

DSH Web / CLI profile：

```powershell
dsh plugin --profile web remove dsh-raw-html
```

确认不再使用后，可手动删除：

```powershell
Remove-Item -Recurse -Force (Join-Path $HOME "dsh-plugins\dsh-raw-html")
```

如果旧版 DSH 曾运行过 legacy patch，还需要按安装器生成的备份恢复被修改的 frontend bundle。
