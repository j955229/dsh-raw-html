# dsh-raw-html

为 DeepSeek Harness 提供 VCP HTML 渲染。开启后，模型输出的 `<div id="vcp-root">...</div>` 会在聊天中渲染为真实界面，而不是显示为 HTML 源码。

支持 SVG、Mermaid、KaTeX、内置字体、交互按钮，以及可选的 Trusted Mode。

**[English](./README.en.md)**

## 效果展示

![效果图 1](docs/images/banner-1.jpg)
![效果图 2](docs/images/banner-2.jpg)
![效果图 3](docs/images/banner-3.jpg)
![效果图 4](docs/images/banner-4.jpg)
![效果图 5](docs/images/banner-5.jpg)

## 相比原版 0.6.0 的变化

- **适配 DeepSeek Harness 0.1.2-alpha.1**：直接使用官方 `conversation.chat.node / assistant-step` slot 渲染 VCP，不再修改 `dsh-web-frontend/dist`。
- **兼容 DSH Desktop**：修复 `assistant-step` 晚注册时无法接管的问题，插件会等待官方 renderer 出现后再注册。
- **普通消息不受影响**：普通 Markdown 继续使用 DSH 原生 Assistant renderer，只有 `#vcp-root` 进入 VCP Shadow DOM。
- **Trusted Mode 不再依赖旧 bundle patch**：现代路径直接在插件内支持 script、iframe、WebGL、fetch 等能力。
- **旧版 DSH 仍可用**：原有 legacy patch 保留，只作为旧环境兼容方案。

## 安装

### DSH Desktop 2.0.4

DSH Desktop 2.0.4 内置 DeepSeek Harness 0.1.2-alpha.1。请从 DSH Desktop 打开 **DSH 终端**，确认终端顶部显示当前 Profile（默认是 `desktop`），然后执行：

```powershell
$dir = Join-Path $HOME "dsh-plugins\dsh-raw-html"
git clone https://github.com/plolpl789/dsh-raw-html.git $dir
dsh plugin add $dir
```

在 DSH Desktop 自带终端里，**不带 `--profile` 的 `dsh plugin` 命令会安装到当前激活的 Desktop profile**。`--profile web` 会改到 Web profile，不是 Desktop 当前 profile。

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

DeepSeek Harness **0.1.2-alpha.1** 使用官方 `conversation.chat.node` / `assistant-step` slot，**不需要修改 frontend bundle，也不需要运行 patch 安装器**。

DeepSeek Harness **0.1.1-rc.x 及更早版本**继续使用 legacy patch：

```powershell
$dir = Join-Path $HOME "dsh-plugins\dsh-raw-html"
node "$dir\patch\install-all.cjs"
```

Legacy patch 会修改旧版 DSH 的 frontend bundle。DeepSeek Harness 0.1.2-alpha.1 不应运行它。

## Trusted Mode

Trusted Mode 默认关闭。插件加载后，页面右下角会显示 **「可信模式·关」** 徽章；点击后会切换为 **「可信模式·开」** 并刷新页面。

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
