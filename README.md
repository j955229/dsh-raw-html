# dsh-raw-html · VCP 视觉通感协议规范插件

在 DeepSeek Harness Web GUI 中实现 **VCP（Visual-Synesthesia，视觉通感）协议**：
消息里的 HTML 从「一坨源码」变成真正渲染的界面，并让 agent 按一套**可维护的设计规范**输出。

**即插即用**：现代 DSH 直接安装本插件 + 打开浏览器「</>」开关（渲染/美学双开关）→
浏览器开始渲染 HTML（含 SVG 卡片 / Mermaid 图表 / KaTeX 公式），agent 开始按规范输出（设计原则 / 中文排版 / 字体搭配）。

> DeepSeek Harness 0.1.2-alpha.1 及其他具备官方 `conversation.chat.node` / `assistant-step`
> slot 的环境无需修改 `dsh-web-frontend/dist`。旧版 DSH 才使用 `patch/install-all.cjs` 兼容路径。

**[English README](./README.en.md) · [更新记录](./CHANGELOG.md)**

## ✨ 效果展示（Gallery）

> 真实会话中的 VCP 卡片渲染效果（宣传图 5 张）：

![效果图 1](docs/images/banner-1.jpg)
![效果图 2](docs/images/banner-2.jpg)
![效果图 3](docs/images/banner-3.jpg)
![效果图 4](docs/images/banner-4.jpg)
![效果图 5](docs/images/banner-5.jpg)

## 📣 近期更新（v0.7.0 · 官方 assistant slot）

- **现代渲染链路**：通过官方 `conversation.chat.node` 的 `assistant-step` keyed slot 注册 priority `-1` renderer；普通 Markdown 继续使用官方 Assistant component。
- **生命周期修复**：官方 `assistant-step` 晚于插件注册时，订阅 slot entry mutation 自动接管；注册后去重，卸载时取消订阅并移除 renderer。
- **安全与兼容**：VCP 内容在 Shadow DOM 中隔离；默认严格过滤，Trusted Mode 的 script / iframe / WebGL / fetch 执行载体已迁入现代 renderer；legacy patch 完整保留。

- **自愈层 v6.37/v6.38（2026-08-29）**：卡片渲染撕裂根治——CommonMark 块级标签不能打断段落（文字+换行+`<div>` 撕裂）与卡片内部空行拆分问题，`fixVcpBlank` 补空行/压缩空行，整卡回归单一 htmlFlow（稳定测试 105 断言全绿）。
- **消息主体渲染器 VCP 接管（2026-08-29）**：主 markdown 渲染器接入 VCP 渲染，消息卡片从此真正渲染为界面（此前官方策略是当源码文本显示）。
- 早期更新（v0.3.0 · 2026-08-24）：

- **修复（2026-08-24）**：适配新版前端 **0.1.0-rc.8 / 0.1.1-rc.x**（压缩器改名 Xu/jd 的新锚点组，自动探测、旧版兼容）；消除 schemastery 静态依赖导致的启动「模块找不到」故障（动态加载 + 降级，缺依赖也能正常启动）。
- **新能力（2026-08-24）**：声明式配色 `data-vcp-preset`（内置 VCPColorEngine 确定性生成整套色板，对比度/色域闭环保证）；流式锚定锁 + ref 闭包缓存（流式更稳不抖）。
- **协议（2026-08-24）**：渲染/美学双开关分层；主动视觉通感（不再被动等指令）；心流纪律常驻（实测输出 −4.6K token/轮、费用 −¥0.056）。
- **安全（P0）**：修复 `on*` 事件属性透传缺口（只放行 `onclick` 桥接）；性能计时器诊断修复；文档引用对齐。
- **性能（P1）**：正则快速守卫、mermaid 监听器泄漏修复、协议文本瘦身约 74%。
- **字体（P2）**：内置 12 款商业字库 → **7 款开源字体**（全 OFL 授权）。
- **增强**：`prefers-reduced-motion` 无障碍、键盘焦点态、魔数收拢。
- 完整变更见 [CHANGELOG.md](./CHANGELOG.md)。

## 版本

- **插件版本**：`package.json` 的 `version`（当前 **0.7.0**），现代 DSH 使用官方 slot，随 `dsh plugin` 升级。
- **Legacy 补丁代号**：`patch/` 注入模块当前为 **v6.38**，只用于没有官方 assistant slot 的旧 DSH；与插件版本独立演进。
- 详细变更见 [CHANGELOG.md](./CHANGELOG.md)。

## 组成

| 部件 | 位置 | 作用 |
|---|---|---|
| 现代 slot renderer | `lib/client.js` | 通过官方 `assistant-step` slot 分流消息；VCP 使用 Shadow DOM、安全过滤、稳定增量 DOM、KaTeX、Mermaid、VCPColorEngine、下载与 input bridge；Trusted Mode 执行载体也在此处 |
| Legacy 一键安装器 | `patch/install-all.cjs` | **仅旧版 DSH**：一条命令安装 `install-v6.cjs` + `trusted-patch.cjs`；幂等 + 备份回滚 + `node --check` |
| Legacy 渲染模块 | `patch/v6-inject.js` | 只供没有官方 assistant slot 的旧环境注入 dist bundle；保留 vcp-fast、自愈层、KaTeX 与 Mermaid |
| **vcp-fast 加速引擎** | `patch/v6-inject.js` | 容器感知块级增量：已闭合块缓存（元素引用跨帧不变 → React 跳过 diff → 动画真循环），只重渲染尾巴；实测缓存命中 **1200~6800 倍**、增量 **12 倍** 提速 |
| 插件（Host 半侧） | `lib/index.js` | 渲染/美学双开关状态（**落盘持久化**）+ 系统提示词分层注入（结构铁律必注入 + 美学工具包可选）+ `/fonts` 字体服务（**内置精选 + 外置大库双源**）+ 知识层共享（协议附带本机 DESIGN.md 路径，任何 agent 可读） |
| 插件（浏览器半侧） | `lib/client.js` | 官方 assistant slot renderer + late-registration 生命周期 + Shadow DOM；同时提供「</>」设置、Trusted Mode 与 `window.__dshInput` |
| **内置精选字体** | `assets/fonts/` | **7 款开源字体（woff2 子集，共约 7.6MB）随插件分发**——文楷/文楷细/马善政楷书/思源黑/思源细黑/思源粗黑/GreatVibes 花体，全部 OFL 授权，任何电脑装上即可用，无需任何配置 |
| 设计系统文档 | `DESIGN.md` | 完整规范库：字体清单/色板/中文排版/安全铁律（知识层，agent 可按需读取） |
| 回归测试 | `tests/` | modern slot 生命周期/安全/Trusted/稳定 DOM + legacy stable/security/smoke/math/mermaid/trusted；bundle 测试在提供旧版 dist 时单独运行 |
| 性能基准 | `patch/vcp-fast-bench.cjs` | domino 真实 DOM 解析环境对比新旧路径耗时与提速倍数（自动下载依赖，零安装） |
| 子集化工具 | `tools/subset_fonts.py` | 维护者用：把新字体裁剪为常用字子集 + woff2 压缩（需 Python + fonttools + brotli） |

## 文档地图（一规则一权威）

每份规范只在一处权威声明，其余位置挂指针。改规则前先找到它的权威源：

| 文档 | 唯一权威职责 | 读者 |
|---|---|---|
| `DESIGN.md` | 「怎么不崩、怎么不丑」的硬规则：字体库 / 色板 / 中文排版 / **安全铁律 §4（落笔后唯一确认点）** | agent 按需读 |
| `EDITORIAL.md` | 「编辑感 / 数据可视化语法」：四色系 / 卡片四件套 / 明度契约 / 视觉词汇库 / 动效 / 非图表迁移 | agent 按需读 |
| `BREATH.md` | 「为什么而画」：三步呼吸法 / 规则三层 / 破规时机 / 动笔前三问 | agent 先读 |
| `FRAMING.md` | 「封面怎么实现」：SVG 顶栏技术要点 / 骨架 / 风格示例 | agent 按需读 |
| `VCP-INTERACTIONS.md` | 「交互元素 + 渲染层安全白名单」 | agent 按需读 |
| `PROGRESS.md` | 会话交接快照（进度 / 血泪教训 / 路线图） | 维护者 |
| `CHANGELOG.md` | 变更流水（插件版本 + 补丁代号） | 维护者 |

**铁律定位**：`vcp-root 禁止空行` 权威在 DESIGN.md §4；交互 / 安全白名单权威在 VCP-INTERACTIONS.md。新增规则先判断归属，只写进权威源，别处挂指针。

## 安装

### 现代 DSH（推荐）

适用于具备官方 `conversation.chat.node` / `assistant-step` slot 的环境，例如 DeepSeek Harness 0.1.2-alpha.1：

```powershell
# 1. 安装插件（卸载用 dsh plugin --profile web remove dsh-raw-html）
dsh plugin --profile web add "本插件路径"

# 2. 重启 dsh 服务并刷新浏览器
# 3. 打开「</>」；需要脚本能力时再打开右下角「可信模式」
```

现代路径不会修改 `@deepseek-ai/dsh-web-frontend/dist/assets/index-*.js`，不依赖 bundle hash、minifier 改名或 `vc` / `Xu` / `jd` 等内部符号。

### Legacy DSH（兼容路径）

只有环境缺少官方 assistant slot、安装插件后仍把 `#vcp-root` 显示为源码时，才执行：


```powershell
node "本插件路径\patch\install-all.cjs"
# 探测失败时可显式传入旧版 bundle：
node "...\patch\install-all.cjs" "C:\...\dsh-web-frontend\dist\assets\index-*.js"
```

这是 **legacy compatibility only**。插件运行时不会偷偷修改 `node_modules`；是否使用旧补丁由用户明确决定。

## 渲染稳定性

现代 slot renderer 在 Shadow DOM 内做节点级增量同步：流式追加时保留已完成节点的 DOM 身分，避免动画、canvas / WebGL 与交互状态被整卡重建。它不依赖 `window.__vcpStable`。

以下 `window.__vcpFast` 说明只针对 Legacy patch：

在 v1 渲染补丁基础上新增的「缓存 + 增量」双引擎（`window.__vcpFast`）：

- **精确缓存**：HTML 字符串未变时，直接返回缓存的 React 元素引用——React 对引用相同的元素跳过整个子树 reconciliation。历史消息滚动 / 切会话 / React 重渲染 → 零重建。
- **增量追加**：内容 = 旧内容 + 追加段，且旧内容以闭合标签结尾时，稳定部分引用不变，只解析渲染新增段。
- **安全边界**：仅非流式 + 开关开启时生效；旧值未闭合或内容重写时自动回退全量；缓存上限 200 条自动清理；onclick 桥接与 script/iframe 过滤能力不变。
- **验证**：DevTools console 可见 `[vcp-fast] HIT/BUILD` 日志（每 2 秒节流）；基准数字见 `patch/vcp-fast-bench.cjs`（真实 DOM 解析环境实测：缓存命中约 1200~6800 倍、增量约 12 倍提速）。

## ⚠️ 常见坑：vcp-root 内部禁止空行（重要！）

**markdown 的 HTML 块遇到空行（`\n\n`）就结束**——如果 `<div id="vcp-root">` 内部出现连续两个换行，
卡片会被解析成多个独立节点：开头部分被 DOMParser 自动补全成「只有顶部一条背景」的小卡片，
其余内容全部溢出到背景外面。症状：**深蓝背景只包顶部一条横框，下方内容没有背景**（2026-08-19 实测确认）。

**铁律**：
- vcp-root 内所有子元素用**单个换行**或**单行**排列，任何地方不要出现 `\n\n`；
- 需要视觉分组时用 `margin`，不要用空行；
- 写完检查：卡片 HTML 字符串中 `\n\n` 出现次数必须为 0。

> 此铁律的唯一权威源见 [DESIGN.md §4](./DESIGN.md) 安全铁律（含根因与完整修正），本节仅作运维速查。

## 配置

- **内置精选字体**（推荐）：7 款开源字体随插件分发（全部 OFL 授权），装上即用，**零配置**。
- **外置大库**（可选）：默认 `I:\字体`。其他电脑可把字体库目录配置到
  「设置 → 插件 → raw-html → fontsRoot」（或直接修改 `lib/index.js` 里的默认值）。
  没有外置大库也能用：内置 7 款开源字体 + 系统字体兜底。
- **开关状态**：`渲染 HTML` 与 `美学注入` 两个独立开关，持久化在 `~/.dsh/dsh-raw-html-state.json`，服务重启后自动恢复；渲染关闭时美学自动强制关闭。

## 使用

- 输入框（composer）发送按钮旁点 **「</>」按钮** 弹出设置面板，可分别开关「渲染 HTML」与「美学注入」；按钮三态：`</> OFF`（关）/ `</> 渲染`（仅渲染）/ `</> ON`（渲染+美学）；
- 开启后**新消息**中的 HTML 即时渲染；历史消息刷新页面后按新状态重渲染；
- agent 收到注入的 VCP 协议 → 自动按规范输出 `#vcp-root` 视觉容器；
  关闭时协议撤回 → agent 自动回到普通 Markdown（降级）。
- VCP 按钮 `onclick="input('回复内容')"` 点击后把内容填入输入框并发送。

## 维护 / 升级

- 每次修改后：`node --check lib/client.js && node --check lib/index.js` 验语法；
  client 改动刷新即生效；host 改动需重启 dsh 服务。
- 现代 DSH 升级后通常只需正常升级/重启插件，不需要重跑 patch；官方 slot 契约不变时，普通 frontend rebuild、hash 或 minifier 改名不会影响本插件。
- 只有 Legacy 环境升级覆盖了已打补丁的 dist 文件时，才重跑 `patch/install-all.cjs`。
- **依赖声明铁律**（2026-08-19 崩溃事件教训）：`import` 的每一个第三方包
  **必须显式声明**在 package.json（dependencies 或 peerDependencies）——
  依赖解析靠运行环境存量 node_modules 碰运气 = 把生命线交给风浪。
  每次改动后运行 `node tools/check-deps.cjs` 核对；目录重构/移动 node_modules/
  打包资源后，务必验证 `import('@deepseek-ai/schemastery')` 可解析。
- 想改进设计规范 → 编辑 `DESIGN.md`（agent 会在需要时读取）+ 同步协议文本
  （`lib/index.js` 的 `buildProtocolText`）。
- 想扩充内置字体 → 编辑 `tools/subset_fonts.py` 的 FONTS 清单 + 跑一次
  （需 Python + fonttools + brotli），自动输出 woff2 子集到 `assets/fonts/`。

## 卸载 / 恢复

```powershell
# 现代 DSH 直接移除插件；Legacy 环境另把补丁备份改回原名：
dsh plugin --profile web remove dsh-raw-html
```

## 安全提示

开启后，模型输出中的 HTML 会被渲染为界面。现代 renderer 做了脚本/事件/危险协议过滤
（事件只放开 `onclick="input('...')"` 受控通道；
`script/iframe/object/embed` 与 `javascript:` 协议丢弃），但样式与外部图片仍然可达——
请只对可信模型开启。

## 可信模式（Trusted Mode · v7.2 插件化）

> 先生定调 2026-08-29：本会话为**双人私密会话**，内容由双方共同产出、双方可信——
> 公共论坛的存储型 XSS 威胁模型不适用。因此为「正文可执行脚本」提供显式开关。

- **默认关闭（安全默认）**：未开启时行为与旧版完全一致（script 截断、白名单严格）。
- **开启方式**：页面右下角「盾锁 SVG 徽章 · 可信模式·关」一键开启（写入 `localStorage['raw-html.trusted']='1'` 并刷新）；
  或 DevTools 设置 `localStorage.setItem('raw-html.trusted','1')`；或 `window.__DSH_TRUSTED__=true`。
  徽章图标为内联 SVG 盾锁（先生 2026-08-29 定稿方案 A）：关态=盾+锁孔，开态=盾+对勾。
- **开启后放行**：消息正文 `<script>` 被提取并在渲染完成后执行（WebGL/Shader/fetch 由此解锁）；
  `iframe/object/embed` 放行；`on*` 事件属性放行；`href/src` 白名单放宽（`blob:` 可用）。
  仍拒绝：`javascript:` 协议。
- **机制**：闭合 `<script>` 在解析阶段被提取，Shadow DOM 挂载完成后只执行一次；
  scoped `document` 优先查找卡片内部节点，因此 WebGL canvas 脚本不因 Shadow DOM 隔离而失效。
- **v7.2 插件化（先生定调）**：可信模式的**状态与开关 UI 全部迁入插件 client 层**
  （`lib/client.js`）——`isTrusted()`、`window.__vcpTrusted` 定义、右下角徽章。
  现代路径的状态、徽章、过滤与执行载体都在 `lib/client.js`，不依赖主 bundle patch；
  插件停用后 renderer、订阅、徽章与执行能力一并清理。Legacy 路径仍由 v6-inject 防御式读取同一开关。
- **测试**：`tests/trusted.test.mjs`（21 项断言，覆盖默认关闭回归、插件层状态、
  徽章切换、渲染层防御式调用与联动）。
- **回退**：徽章再点一次即关闭；或 `localStorage.setItem('raw-html.trusted','0')`。
