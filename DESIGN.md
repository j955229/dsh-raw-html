# 蓝汐 · 视觉设计系统（DESIGN.md）

> 定位：**纯技术参考手册**——字体资产、中文排版、安全铁律、色板速查。
> 审美（编辑感 / 四色系 / 视觉词汇库）见 [EDITORIAL.md](./EDITORIAL.md)；灵魂（呼吸法）见 [BREATH.md](./BREATH.md)。
> AI 本身具备基础审美，本文件不教「怎么好看」，只给「会崩 / 会错 / 先生骂过」的技术约束与资产。

---

## 0. 字体库（内置精选 + 外置全量 双源）

> `/fonts/` 服务解析两个来源：① **插件内置精选**（assets/fonts，随插件分发，任何电脑装上即可用，woff2 子集共 8.9MB）；② **外置大库**（settings `raw-html.fontsRoot` 可配置，默认 `I:\字体`，本机 219 款全量；其他电脑可指向自己的字体库或留空）。

### 0.0 内置精选（随插件分发 · 无需配置 · 直接可用 · 全部开源授权）

> 用法：`@font-face{font-family:'Lanxi-WenKai';src:url('/fonts/Lanxi-WenKai.woff2');}` 后引用。由 `tools/subset_fonts.py` 生成（GB2312 一级 3755 字 + 标点 + 数字序号）。全部为开源授权字体（OFL/Apache），随包分发无授权风险。

| 领域 | font-family 名 | /fonts/ 路径 | 体积 |
|---|---|---|---|
| 楷书 | `Lanxi-WenKai` | Lanxi-WenKai.woff2 | 883KB |
| 楷书·细 | `Lanxi-WenKaiLight` | Lanxi-WenKaiLight.woff2 | 921KB |
| 手写楷 | `Lanxi-MaShanZheng` | Lanxi-MaShanZheng.woff2 | 1.7MB |
| 黑体 | `Lanxi-HeiTi` | Lanxi-HeiTi.woff2 | 1.3MB |
| 黑体·细 | `Lanxi-HeiTiLight` | Lanxi-HeiTiLight.woff2 | 1.3MB |
| 黑体·粗 | `Lanxi-HeiTiBold` | Lanxi-HeiTiBold.woff2 | 1.4MB |
| 英文花体 | `Lanxi-GreatVibes` | Lanxi-GreatVibes.woff2 | 44KB |

### 0.1 外置全量（可选配置字体根目录后可用 · 参考清单 · 用户自备）

> ⚠️ 外置大库为用户**自备**字体（非随包分发），下列清单仅供参考；其中可能含商业字库，授权由用户自行确认。内置精选（0.0）已全部开源。

| 风格 | 字体（font-family 名） | 相对路径（/fonts/ 之后） |
|---|---|---|
| 书法·皇家 | `Lanxi-瘦金书` | `方正所有字体/02/FZfonts/FZSZJW.TTF` |
| 书法·石刻 | `Lanxi-魏碑` | `方正所有字体/02/FZfonts/FZWBJW.TTF` |
| 书法·隶意 | `Lanxi-隶书` | `方正所有字体/02/FZfonts/FZLSJW.TTF` |
| 书法·狂草 | `Lanxi-行草` | `方正所有字体/02/FZfonts/FZXBSJW.TTF` |
| 书法·简牍 | `Lanxi-汉简` | `方正所有字体/02/FZfonts/FZHCJW.TTF` |
| 书法·铁筋 | `Lanxi-铁筋隶书` | `方正所有字体/02/FZfonts/FZTJLSJW.TTF` |
| 书法·手写 | `Lanxi-叶根友` | `bb1213/bb1213/叶根友特色简体升级版.ttf` |
| 书法·舒体 | `Lanxi-舒体` | `方正所有字体/02/FZfonts/FZSTJW.TTF` |
| 艺术·装饰 | `Lanxi-黄金时代` | `造字工房最全字体-2016-01-06更新/艺术字体/MFTheGoldenEra_Noncommercial-Bold.ttf` |
| 艺术·优雅 | `Lanxi-尚雅` | `造字工房最全字体-2016-01-06更新/艺术字体/MFShangYa_Noncommercial-Regular.ttf` |
| 艺术·前卫 | `Lanxi-点黑` | `造字工房最全字体-2016-01-06更新/黑体系列/MFDianHei_Noncommercial-Regular.ttf` |
| 艺术·几何 | `Lanxi-菱心体` | `常用字体/汉仪菱心体简.ttf` |
| 艺术·海报 | `Lanxi-海报体` | `常用字体/华康海报体W12(P).ttf` |
| 艺术·综艺 | `Lanxi-综艺` | `方正所有字体/02/FZfonts/FZZHYJW.TTF` |
| 极细·空灵 | `Lanxi-静黑超细` | `造字工房最全字体-2016-01-06更新/黑体系列/MFJingHei_Noncommercial-UltLight.ttf` |
| 极细·秀美 | `Lanxi-浪倩` | `造字工房最全字体-2016-01-06更新/艺术字体/MFLangQian_Noncommercial-Regular.ttf` |
| 可爱·萌系 | `Lanxi-喵喵` | `造字工房最全字体-2016-01-06更新/艺术字体/MFMiaoMiao_Noncommercial-Regular.ttf` |
| 可爱·手绘 | `Lanxi-叮叮` | `造字工房最全字体-2016-01-06更新/手绘字体/MFDingDing_Noncommercial-Regular.ttf` |
| 可爱·卡通 | `Lanxi-卡通` | `常用字体/迷你简卡通.TTF` |
| 宋体·精致 | `Lanxi-品宋` | `造字工房最全字体-2016-01-06更新/宋体系列/MFPinSong_Noncommercial-Regular.ttf` |
| 宋体·颜韵 | `Lanxi-颜宋` | `造字工房最全字体-2016-01-06更新/宋体系列/MFYanSong_Noncommercial-Regular.ttf` |
| 冲击·超粗 | `Lanxi-超粗黑` | `方正所有字体/02/FZfonts/FZCCHJW.TTF` |
| 花体·英文 | `Lanxi-GreatVibes` | `Great-Vibes/GreatVibes-Regular-2.otf` |

### 0.3 @font-face 模板（直接抄）

```css
@font-face{font-family:'Lanxi-WenKai';src:url('/fonts/Lanxi-WenKai.woff2');}
#vcp-root .title{font-family:'Lanxi-WenKai','Lanxi-HeiTi',serif;}
```

### 0.4 注意
- 单帖最多 1-2 款艺术字体（woff2 子集 0.9-1.7MB，克制）；正文永远系统无衬线。
- 内置字体源存 `tools/font-src/`，改动后重跑 `tools/subset_fonts.py`。
- **皮肤覆盖对抗（技术铁律）**：maid-atelier 皮肤会注入带 `!important` 的全局字体覆盖（特异性 (0,2,0)），强制换消息区字体。对策：`font-family` 声明**必须加 `!important`** 且选择器以 `#vcp-root` 前缀（特异性 (1,1,0) 压过）；或加 `data-skin-chrome` 属性绕开。字号同理。

---

## 1. 色板参考（色纸卡 · 只查值）

> **默认基调（先生定调）**：浅纸底 + 墨色 + 明度即层级（lieflat）；深色系黑底 + 白字+对比撞色。
> 四色系（Mono / porcelain / palm / wire）与选色逻辑见 [EDITORIAL.md §1](./EDITORIAL.md)。

| 色板 | 基底 | 正文 | accent | 描边 |
|---|---|---|---|---|
| 深海琉璃（仅大屏/终端） | `linear-gradient(165deg,#051322,#0a2540 42%,#0e3a5c 72%,#06283f)` | `#e8f2fb` | `#7fd4ff`/`#40dcff` | `rgba(170,225,255,.16)` |
| 暖纸书房 | `#faf6ef` | `#2b2b28` | `#8a6d3b` | `#e4dccb` |
| 终端绿幕（仅终端） | `#0d1117` | `#c9d1d9` | `#3fb950` | — |
| 胶片黄昏 | `linear-gradient(165deg,#1a0f0a,#3a1f14 55%,#5c2e1c)` | `#f4e9d8` | `#e0a458` | `rgba(224,164,88,.18)` |
| 青瓷素雅 | `linear-gradient(165deg,#eef4f1,#e3ede8 60%,#d7e4dd)` | `#2a3a33` | `#4e8a6e` | `#c8d8cf` |

### 1.5 声明式配色（可选 · 免写 hex · 渲染层色彩引擎代劳）

不想手写色值时，在根容器声明预设，渲染层自动生成整套 `--vcp-*` 色板变量 + 卡片基座（背景/文字色/内边距 20px/圆角 16px/边框），对比度与色域由引擎闭环保证（正文≥4.5:1）。子元素用 `var(--vcp-base)` / `var(--vcp-surface)` / `var(--vcp-border)` / `var(--vcp-text-primary)` / `var(--vcp-text-muted)` / `var(--vcp-accent-primary)` / `var(--vcp-code-bg)` / `var(--vcp-danger)` 取值；显式声明过的样式不会被覆盖。

```html
<div id="vcp-root" data-vcp-preset="editorial"><!-- 内容 --></div>
```

- 五大流派预设：`editorial`（编辑部）/ `chiaroscuro`（明暗法）/ `fauvism`（野兽派）/ `cyberpunk`（赛博）/ `wabi_sabi`（侘寂）；另有 `cyber-hacker` / `jiangnan-scholar`（江南书生）/ `void-prophet`（虚空先知）人格。
- 自定义：`data-vcp-mode="dark|light"`、`data-vcp-soul="色温K,愉悦度,激惹度,熵"`（如 `18000,-0.2,0.6,0.1`）、`data-vcp-accent="#00ff66"` 或色相角（如 `140`）。
- 依赖渲染层色彩引擎（浏览器经 /vendor 加载，未就绪时自动降级——根容器需自带 style 兜底）。

---

## 2. 中文排版（硬规则 · 先生骂过）

- **首行缩进**：正文自然段首行缩进 **2 汉字宽**（`text-indent: 2em`）；段间**不靠空行区分**、靠缩进（网页可加段距，缩进必须保留）。
- **字号阶梯**：正文 **14-15px（五号）**，小标题 **18-20px（四号~小三）＝比正文大 2 号**，大标题 **22-24px（二号~小一）**。
- **行距**：正文行高 **1.6-1.8**；标题 1.2-1.35。
- **对齐**：正文两端对齐（`text-align: justify`）；中文正文不居中（标题/诗歌除外）。
- **标点**：一律全角中文标点（，。！？「」……）；弯引号「」『』优先。
- **字距**：正文不加字距（`letter-spacing: 0`）；标题可略加 0.5-2px。
- **背题孤行**：小标题不与后段分离（标题+首段同块）；正文避免孤行。
- **中西混排**：英文/数字用半角，中西文之间加空格（如「iOS 与 Android」）。

---

## 3. 落笔后：只确认会不会崩（不逐条自查）

审美与灵魂在动笔前已内化——灵魂三问见 BREATH.md §4，数据可视化契约见 EDITORIAL.md，装帧克制见 FRAMING.md。落笔后**唯一**要确认的是下面「§4 安全铁律」那 8 条会不会崩；不要逐条自查、不要为自检延长思考。

---

## 4. 安全铁律（违反必出 bug）

0. **输出纪律（最高优先级）**：视觉内容**直接输出 HTML 到回复正文**，由 GUI 自动渲染——这是 VCP 的唯一交付方式。**禁止**把 HTML 写入 .html 文件再丢路径/链接给用户（除非先生明确要求保存文件，此时正文仍须同步呈现核心内容）。「先生看不见的视觉」等于没做。
1. **vcp-root 内禁止空行**（`\n\n`）——markdown HTML 块遇空行即拆，背景只包顶部一条、下方溢出。子元素单换行或单行，分组用 margin。写完查 `\n\n` 次数为 0。
2. **禁 backdrop-filter**——子背景用实色多层渐变（rgba 叠加 + 细描边 + 内高光）；`#vcp-root` 显式 `display:block;width:100%;box-sizing:border-box;overflow:hidden`。
3. **交互只放行 `onclick="input('...')"`**——不写 `<script>`/外链脚本/其他 `on*` 事件（安全白名单见 [VCP-INTERACTIONS.md](./VCP-INTERACTIONS.md)）。
4. **流式三规则**——① 开标签后**紧贴**首元素（勿换行/空格）；② `<style>` 写在 #vcp-root 开标签后、内容之前；③ 子块少换行。违反则整卡一次性展开、无流式。
5. **code 成对设色**——深容器「更深底 #0a1626 + 亮青 #bfe9ff」；浅容器「浅灰底 #f0f0ea + 深红 #b03a2e / 深蓝 #1f5fa8」。禁止只设一面。
6. **关键排版属性内联 style**——`<style>` 只放 @font-face 与 @keyframes（级联损耗，部分规则不达）。
7. **字号被皮肤压制**——内联 `!important`（`#vcp-root` 前缀）或 `transform:scale(1.3~1.5)`+`transform-origin:left center` 兜底；书法细体配 `text-shadow` 增重。
8. **容器内元素同明度域**——深色容器内的 code/徽章/按钮背景也须深色，禁白块亮块抢戏。

---

## 5. 交互元素

> 交互元素（折叠 / 选项卡 / 手风琴 / 轮播 / 按钮）与渲染层安全白名单的唯一权威见 [VCP-INTERACTIONS.md](./VCP-INTERACTIONS.md)。

## 6. 故事装帧 · SVG 顶栏封面

> 叙事类回复（故事 / 小说 / 散文 / 书信 / 诗歌）可在卡片顶部加内联 SVG 小顶栏封面。
> 完整手册见 [FRAMING.md](./FRAMING.md)（怎么实现 + 骨架 + 风格示例，示例仅演示手法、禁止照搬）。

*—— 蓝汐 · 深蓝深海频道 · 美学是理解，不是模板 ——*
