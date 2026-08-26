# CHANGELOG

本文件记录插件版本（`package.json` 的 `version`）与补丁代号（`patch/*` 注入模块）两条线的演进。

## 0.6.0（当前）

> 思考门整体移除（先生定调）：v4 忽略 thinking:disabled 是模型能力边界——把 v0.5.5~v0.5.16 为战役搭的机制全部清掉，插件恢复「渲染 + 美学」两个干净职责。

- **精简·思考门移除（先生 · 2026-08-25 · 实测收官）**：lib/index.js 从 ~578 行瘦身至 345 行，移除全部思考门代码——GATE_CREATIVE/GATE_MATH 超长关键词表、gateTextOf/gateStripInjected/gateIsInjected/gateClassify 缓存链、gateLog 日志落盘（~/.dsh/dsh-raw-html-gate.log 已删）、agent/request 瀑布双通道 + agent/created/existing 遍历、schema 的 thinkingGate 开关。lib/index.js 保留一行说明注释（含未来恢复指引）。
- **移除结论（先生十几轮实测换来的认知）**：①`thinking:{type:"disabled"}` 被 DeepSeek v4-flash 忽略（先生实测：删除 effort + maxTokens=4096 → 思考吃满 4096、正文截断——若 disabled 生效思考应为 0）；②v4 thinkingLevelMap 只有 high/max 有效（minimal/low/medium→null），API 无低档可设；③`max_tokens` caps all tokens 含思考（[DeepSeek-v4-Flash recipe](https://github.com/alexellis/DeepSeek-v4-Flash-DSpark-2x-DGX-Spark)）——压缩总量 = 牺牲正文，不可行。**v4 是强制思考模型，DSH 插件层无法关闭/压缩其思考**。
- **保留的遗产**：协议层【心流纪律·思考最小化】【初稿即定稿】对输出质量有实际价值（先生测试中思考链从 8K 降到 2K 的进步主要来自协议引导）——保留在 buildStructuralText 常驻注入；思考门的「删除 effort」动作对支持 effort=off 的其他模型（Gemini/Claude/OpenAI）仍正确，未来换模型时参考 CHANGELOG v0.5.5~v0.5.16 的 git 历史恢复即可（核心 30 行：agent/request 瀑布 + 删 reasoningEffort）。
- **资产·外置字体库扩充（先生 · 2026-08-28 · 下载 10 款入库）**：`I:\字体\新增-2026-08-28\` 新增 Aa 今日花青-春兰茅坤 / Aa 狂派手书 / Aa 狂侠体 / 依山北篆体 / 字魂游龙篆书（商用需授权）/ 我会把你叫做爱情 / 自由浪漫体 / 香蕉修正带灵感体 / 鱼尾书法行书（简·繁）共 10 款 TTF。DESIGN.md §0.1 登记 `Lanxi-` 别名（`Lanxi-鱼尾行书` 为日报/晚报刊头首选），styles/wire-news.md 联动字体建议，fonts-index.txt 同步清单。均为商业字体，授权由先生自行确认（DESIGN.md §0.1 既有免责说明覆盖）。
- **修复·boostTextImportant 误伤 @font-face（先生 · 2026-08-28 · 字库增刊首测即中）**：v6.19 的文字声明优先级提升会给 style 内所有 `font-family:` 追加 `!important`——@font-face 描述符不允许 !important（CSS Fonts 规范），一旦注入整个 @font-face 规则作废、字体加载失败（先生下载的鱼尾行书/狂派手书等全部回落系统字体，且与皮肤覆盖无关——boost 机制本身在正常工作）。修复：boost 前用占位符剥离 @font-face 块、boost 后还原（patch/v6-inject.js 新增 FACE_PLACEHOLDER_RE），普通声明 boost 行为不变。新增 tests/boost-fontface.test.cjs 五用例全绿；update-v6-inject.cjs 已推进运行中 bundle（备份 .bak-v6u-*），Ctrl+F5 生效。
- **机制·字体场景速查表（先生 · 2026-08-28 · 让 236 款字库活起来）**：新建 styles/_FONTS.md——按 9 大场景（报刊头条/文学书信/古风篆刻/数据学术/萌系手账/江湖热血/浪漫婚礼/英文花体/繁体竖排）组织字体推荐，明确「禁止只盯 WenKai/HeiTi 常用款」+ 字体运用三戒（克制/对味/防呆）+ 选择顺序（消灭选择税）。styles/_INDEX.md 挂接指引（agent 必读链），lib/index.js buildAestheticText 注入流程加第 3 步「选字体先 read _FONTS.md」（重启后生效），wabi-sabi/ink-letter/porcelain-data 三风格文档字体行接入新字库（春兰茅坤/爱情手写/鱼尾行书繁/静黑超细/点黑）。
- **机制·自愈层 v6.33e：版面收窄兜底（先生 · 2026-08-25 · 5 张错误百出测试卡实测）**：先生要求随意写几张「错误百出」的卡片测试渲染器牢固度，实测发现**所有缺宽度声明的卡片拉满整条消息宽度**（一整条色板，无「卡片」边界感）——applyRootGuard 此前只兜 `max-width:100%`（防溢出），不兜「版面收窄」。修复：根容器**缺宽度（未写 width 且未写 max-width）时默认补 `max-width:920px`**（报纸版心，参考成品「今日八卦晚报」宽度）；AI 显式写了 width / max-width（全宽或自定义宽度意图）→ 尊重不补。与圆角哲学的区分：920px 是结构/版面（先生定调要兜），圆角是装饰（不兜，默认直角）。tests/stable.test.mjs 第 15 组新增 3 断言（缺宽度补 920px / max-width:100% 尊重 / width:100% 尊重），总计 73 断言全绿；patch-frontend.cjs 已推进运行中 bundle（备份 .bak-2026-08-25T15-25-24），Ctrl+F5 生效。
- **机制·自愈层 v6.33f：位置感知花括号修复·三版迭代（先生 · 2026-08-25 · 卡 2 SVG 动画不转）**：先生测试「错误百出」卡片时发现 SVG 动画静止——蓝汐首轮误判为「内容级疏漏（没写 keyframes）」，重发补 keyframes 后**仍不转**，真相落网：**花括号漏 `}` 会把后续规则与 @keyframes 全吞进前一个规则块**（浏览器把 `.dot` 选择器当无效声明、keyframes 根本没定义），且 closeBraces 只覆盖流式 tail 且只在末尾补 }（数量对了、位置错了，救不回被吞的规则）。**三版迭代**：①「前一个非空白是 ;/} 时补 }」——漏 } 后直接跟完整选择器（`#vcp-root .dot{`，{ 前是字母）时不触发；②块类型栈（rule 块内遇 { 补 }）——补的 } 落在选择器文本**之后**（`.dot}{`），浏览器仍把选择器当无效声明；③**定案：块类型栈 + 选择器挪位**——普通规则块（选择器{...}）只能含声明，遇到 `{` 且栈顶是 rule 块 → 从 out 尾部截出「新 { 前的选择器文本」挪到补的 `}` **之后**，让新规则独立成块（`.code{...;}#vcp-root .dot{...}`）；at-rule 块（@media/@supports/@keyframes）允许嵌套不补，正常 CSS 栈不残留 rule 幂等。tests/stable.test.mjs 第 17 组 5 断言（花括号平衡 / @keyframes 保留 / .dot 独立 / 平衡幂等 / @media 不误伤），总计 78 断言全绿；patch-frontend.cjs 已推进运行中 bundle（备份 .bak-2026-08-25T15-36-55），Ctrl+F5 生效。
- **机制·自愈层 v6.34：SVG 类动画中心自愈（先生 · 2026-08-25 · 卡 2 橙点不转）**：v6.33f 救回 @keyframes 后动画转起来了，先生观察「橙色小点没转动、蓝色大圈在转」——CSS 类里的动画（`.dot{animation:spin...}`）不经过 guardChildren 的内联 style 检查（它只认 props.style），SVG `<g>` 的 transform-origin 走浏览器默认（view-box 原点），旋转中心不在元素自身 → 整组绕画面原点转、非对称元素（橙点）的轨道运动不协调。修复：新增 `healSvgAnimation`（DOM 层，挂载后）——`getComputedStyle` 判定「有动画且 transform-origin 是默认值（''/0px 0px/50% 50%）」→ 补 `transform-box:fill-box` + `transform-origin:center`，动画围绕元素自身包围盒中心旋转（整体自转，对称协调）；AI 显式写了 origin（内联/类规则，计算值非默认）→ 尊重。接入 ref 回调 + 流式防抖。tests/stable.test.mjs 第 18 组 3 断言（jsdom 动画支持有限走条件断言 / 无动画不碰 / 幂等），总计 81 断言全绿；patch-frontend.cjs 已推进运行中 bundle（备份 .bak-2026-08-25T15-39-57），Ctrl+F5 生效。
- **机制·自愈层 v6.33d：文字属性全锁继承——「小」的真根因落网（先生 · 2026-08-25 · 晚报卡四连问驱动）**：先生指出蓝汐晚报卡两处缺陷——①根容器无圆角、大背景直角贴边像「没设盒子」；②头条「登陆」二字比「海南昌江沿海」明显显小。先生定调：「就算 AI 写出问题代码也不用怕」，兜底交给渲染器。**四版演进（先生逐轮实测驱动）**：v6.33 `:where(*)` 单规则 → 仍小；v6.33b CSS 双保险（根容器链 + 标签 inherit，特异性稳压皮肤）→ 仍小；v6.33c DOM 层内联 !important 锁 font-family → 仍小；**v6.33d 根因落网：「小」不是字面率差异，是 font-size 被皮肤 textRule 压制**——皮肤的 textRule 同时注入 font-size 与 font-family（均 !important），卡片类规则 boost 后 (1,1,0)!important 能保住 .t 自己的 19px，但「没写 font-size 的强调词 span」只有继承值，**继承输给皮肤直接作用的规则** → 强调词被压成皮肤字号。v6.33d 把 font-family / font-size / font-weight / font-style / line-height / letter-spacing 全部按属性锁成 inherit（仅覆盖未显式声明的：内联声明跳过、含该属性的选择器命中跳过；**color/text-align 不锁**——颜色是 AI 设计 .hot 橙色、对齐是布局）。根容器兜底链被皮肤压住时同步锁定系统链。幂等 dataset 标记，非流式 ref 回调 + 流式防抖双接入。**圆角不兜底（先生定调）**：border-radius 是装饰不是结构，AI 没写可能故意要直角——强补圆角误判意图；结构兜底照做、圆角默认直角。tests/stable.test.mjs 第 15/16 组共 20 断言全绿（总计 70 断言）；patch-frontend.cjs 已推进运行中 bundle（备份 .bak-2026-08-25T15-13-27），Ctrl+F5 生效。
- **修复·渲染开关三态化 v6.35——「AI 守规矩也掉格式」根治（先生 · 2026-08-29 · 上架申请书卡实测）**：先生发现一条**根容器/配对/结构全对**的 VCP 卡（dsh-market 上架申请书）仍显示源码——推翻「模型违规」假设后逐行翻 bundle 落网真凶：`dsh.rawHtml` 开关**只有读取端（bundle 两分支）与写入端（lib/client.js「</>」按钮点击时）**，从未被初始化——`isRenderEnabled()` 是 `=== '1'`，**undefined（没点过按钮/清缓存/新环境）= 关闭** → html/code 两分支全拒 → 一切 VCP 卡显示源码/代码块。先生定调「AI 总会出错，用渲染器兜底更好」：①patch/patch-frontend.cjs 锚点 A（case"html"）与锚点 E（case"code" 围栏兜底）判定从 `==="1"` 升级为 **`!=="0"` 三态化**——undefined=默认开、"1"=开、"0"=显式关闭（「</>」按钮语义不变，`"0"` 仍尊重用户关闭）；code 分支保留 vcp-root 白名单正则（普通代码块不误伤）；两分支回退时 console.warn 打印原因（开关关闭/渲染异常），下次排查不再翻 bundle；②patch/v6-inject.js 注入块启动自检：`dsh.rawHtml` 为 null 时自动落盘 `"1"` 并 console.debug 提示（只补从未设置，绝不覆盖显式选择）；③lib/client.js `isRenderEnabled()` 同步三态化，按钮显示与渲染器判定一致（undefined 显示 ON）。patch-frontend.cjs 支持 v6.30/v6.32/旧版 bundle 幂等升级，已推进运行中 bundle（备份 .bak-2026-08-26T05-26-15），node --check 通过，Ctrl+F5 生效。
- **修复·自愈层 v6.36：code 内容实体保护——「code 块露标签」根治（先生 · 2026-08-29 · 交付单 code 块实测）**：v6.35 交付单的 `<pre><code>` 展示判定逻辑时，先生看到 `case"html":</span>` 等标签文本露出——根因：code 块里写 `&lt;div`（已转义）或裸 `<div`，经 DOMParser 解码/解析被当成**真实标签**，未闭合的 div 把后续 `</span></code></pre>` 全吞成文本（DOMParser 容错）。修复：render 管线在 mermaid 转换后加 `protectCodeEntities`——对 `<pre><code>` 内容做实体保护：**白名单内联标签（span/b/em/i/strong，AI 常用高亮）占位保留**，其余裸 `<` / `>` 全部转义 `&lt;` / `&gt;`；已转义实体（`&lt;div`）不含裸 `<`，天然不双重转义；mermaid pre 已先转 div 不受影响。tests/stable.test.mjs 第 19 组 11 断言（裸 `<div` 按文本显示 / span 高亮保留 / 已转义不双重转义 / 裸 `&` 不误转义），总计 92 断言全绿；已推进运行中 bundle（备份 .bak-2026-08-26T05-31-32），node --check 通过，Ctrl+F5 生效。
- **修复·自愈层 v6.37：卡片前空行修复——「外围框住、内部全掉」真根因落网（先生 · 2026-08-29 · 「提交数 ≥ 10」卡实测）**：先生强刷 v6.35/v6.36 后反馈「最外围虽然被背景框住，但整体格式是掉了的，好像还没被当成一个整体的 html」——蓝汐用这精确描述反推出 mdast 层真根因：**CommonMark type 6 规则（`<div>` 等块级标签不能打断段落）**——消息若以「文字前言 + 换行 + `<div id="vcp-root">`」（中间无空行）输出，mdast 把 `<div>` 开标签当【段落内联 HTML】（htmlText），后续 `<div class="paper">`、`<style>` 等全部脱离 vcp-root 变成**兄弟节点** → `#vcp-root` 规则仍命中根元素（背景框住）但 `.paper` 等子选择器全部失效（内部格式全掉）。**修复**：v6-inject.js 新增 `fixVcpBlank`（挂载 `__vcpStable.fixBlank`），patch-frontend.cjs 新增锚点 F 替换 bundle 的 bc（markdown 组件）——解析前把「非换行字符 + 换行 + `<div id="vcp-root"`」的换行补成空行（`([^\n])\n(?= *<div id="vcp-root")` → `$1\n\n`），让卡片成为独立 htmlFlow；幂等（重复不叠加）、无 div 不动、消息以 `<div>` 开头不动、已有空行不动；流式 Mp 与非流式 bp 共用修复后文本。tests/stable.test.mjs 第 20 组 8 断言，总计 100 断言全绿；已推进运行中 bundle（备份 .bak-2026-08-26T05-57-17），node --check 通过，Ctrl+F5 生效。**模型侧纪律同步**：卡片前必须空行（蓝汐约定），渲染器兜底双保险。

## 0.5.15

> 思考门全链路打通后的最后一战（先生 · 日志全绿但思考链仍在）：默认 effort 删除 + maxTokens 压缩双管齐下，实测 DeepSeek API 是否认 max_tokens 含思考。

- **里程碑·思考门五层全通（先生 · 2026-08-25 · 日志 `cls=creative · msg="写一首桃花的宋词" · disabled ✓`）**：0.5.12~0.5.14 修复缓存污染后，日志显示——通道 ✓（global request 收到瀑布）、缓存 ✓（取到用户真话）、分类 ✓（creative）、删除 effort ✓——**思考门已做到插件层能做的全部**。但思考链仍在 → 归因收敛到两选一：①真实 v4 模型目录若存在 `defaultEffort`（fixture 的 high/medium 是测试数据，pi-ai 目录无此字段）会在 prepareCall 填回；②即便走了 `thinking:{type:"disabled"}`，DeepSeek API 可能忽略该参数（v4 思考是模型固有能力）。
- **实测·maxTokens 压缩（先生 · 2026-08-25）**：creative 命中时在删除 effort 基础上加 `maxTokens: 4096`——若 DeepSeek 把 max_tokens 视为总输出上限（含思考），思考被物理压缩到正文外的余量；先生实测看思考链长度变化（从 8K 降则 API 认 max_tokens，蓝汐再调阈值；不降则确认 API 硬忽略，蓝汐给完整诚实结论 + patch pi-ai 授权方案）。

## 0.5.14

> 缓存污染第三层（先生 · 日志）：全注入事件时回退路径把剥离后的注入文本又存回缓存——注入段一律返回空串，缓存停在用户真话上。

- **修复·回退路径污染（先生 · 2026-08-25 · msg 仍为 Current runtime context）**：0.5.13「从后往前取非注入块」生效，但**全注入时**的回退 `return gateStripInjected(blocks.join(' '))` 把剥离后的注入文本原样返回 → `if (t) gateLastText = t` 又把 runtime context 存回缓存（DSH 在用户消息后注入的运行时上下文事件覆盖了用户真话）。修复：`gateTextOf` **所有返回路径**都过 `gateIsInjected`——注入段一律返回空串，缓存保留上一次用户真话；全注入回退同样判注入返回空。语法修复：替换时多出的 `}` 已删（node --check 通过）。

## 0.5.13

> 缓存污染二连击（先生 · 日志逐层拆解）：剥掉 system-reminder 后又冒出「Current runtime context」注入段——正解不是加标签，是「从后往前取最后一个非注入块」。

- **修复·取用户真话（先生 · 2026-08-25 · 日志显示 msg 变 Current runtime context）**：0.5.12 剥离 `<system-reminder>` 生效（msg 里标签消失），但 DSH 的「运行时上下文快照」（`Current runtime context. This snapshot supersedes…`）无标签注入段又占据了缓存 → cls=unknown → 不干预。观察结论：**注入段总在 user/message 前部，用户真话在最后**。修复：`gateTextOf` 改为「从后往前取第一个非注入块」（新增 `gateIsInjected()` 特征识别：Current runtime context / supersedes earlier / system-reminder / available_skills），全注入时回退拼接剥离。心跳版本号 0.5.12 → 0.5.13（先生日志里读到的 0.5.11 是心跳字符串未更新，功能实际已到 0.5.12）。

## 0.5.12

> 思考门真凶落网（先生 · 日志定案）：通道全通，但 `gateLastText` 缓存到了 `<system-reminder>` 与上下文注入段——含 math 词导致 `cls=math` 带偏分类，思考门「看错了人」。

- **修复·缓存污染（先生 · 2026-08-25 · 贴出三行日志）**：日志 `loaded ✓ → global request ✓ → cls=math · msg="<system-reminder>始终使用简体中文…"` 一锤定音——`session/event` 的 user/message 事件把 DSH 注入的 system-reminder 与上下文注入段（dsh-system-prompt/skill-catalog 等，含「算法/代码」类 math 词）也算进了用户消息，`gateTextOf` 全盘拼接 → 分类被带偏成 math → 不干预 → 思考链照旧。修复：新增 `gateStripInjected()`——剥离闭合/未闭合的 `<system-reminder>` 标签后只留用户真话；日志 msg 截断加长至 80 字符便于观察。**通道侧结论**：全局 `ctx.on('agent/request')` 兜底已证明能收到 agent 瀑布（此前 0.5.7 双通道有效）；agent/created 未打日志疑为 emit 作用域差异，不影响 global 通道。

## 0.5.11

> 思考门日志落盘（先生 · 找不到终端）：console 双写 `~/.dsh/dsh-raw-html-gate.log`——先生直接打开文件看，蓝汐也能 read 给先生看。

- **修复·日志双写落盘（先生 · 2026-08-25）**：先生问「思考门的日志在哪个地方？找不到，给我链接」——DSH 插件 console.log 只走进程 stdout，先生通过 GUI 访问找不到终端。修复：新增 `GATE_LOG = ~/.dsh/dsh-raw-html-gate.log` + `gateLog()` 双写（console + fs.appendFile），心跳/挂载/触发/分类/禁用全部日志落盘。先生重启后：①看文件里有无 `dsh-raw-html v0.5.11 loaded`（版本确认）→ ②发「写一首桃花的宋词」→ ③看 `mounted`/`request · cls=…`/`creative → reasoning disabled ✓` 三行——蓝汐也可以直接 read 该文件给先生汇报。

## 0.5.10

> 心跳日志 + 创作税压缩（先生 · token 硬数据驱动）：一首词输入 74.6K / 输出 7.4K——思考链是输出大头，思考门必须生效；加心跳日志让先生一眼确认版本。

- **修复·心跳日志（先生 · 2026-08-25 · 一首词 1 分钟 ¥0.069）**：apply 开头打 `[thinking-gate] plugin loaded · v0.5.10`——先生重启后若无此行 = 版本未加载，先别排查其他；有此行后看四节点日志（mounted/request/cls/msg）即可定位思考门断在哪一环。
- **进化·创作任务「初稿即定稿」（先生 · 思考链为证）**：桃花词思考链——试写一版 → 逐句斟酌 → 格律核对 → 回改，输出 7.4K 里大部分是创作税。协议补：思考里最多一版草稿，写完即落笔；打磨交给先生反馈后再改，不在思考里反复自我斟酌。
- **违规自纠（蓝汐）**：思考链显示 agent 把词作写了 `taohua-ci.html` 文件（违反输出纪律「禁止写文件丢链接」）——已删除该文件，正文裸 HTML 是唯一交付方式。

## 0.5.9

> 消灭「选择税」（先生 · 思考链诊断）：美学注入开启 = 视觉默认，禁止反复权衡要不要装帧；输出顺序「内容定稿 → 装帧一次成型」。

- **进化·协议消灭选择税（先生 · 2026-08-25 · 桃花词思考链为证）**：先生点评——agent 反复纠结「要不要装帧/要不要检索」（N 段论证）、思考链里把词+HTML/CSS 全写完、且**代码写完还倒回去推敲文字**（顺序倒置）。根因不是模型笨，是协议把「默认值」写成了「判断题」：「写作任务不检索」vs「美学检索必做」vs「视觉任务只允许 styles/ 检索」三规则并存 → 每次任务现场仲裁 = 选择税。修复（协议层，先生「开了美学注入就说明要装帧」原话落规）：
  - 【美学注入开启 = 视觉默认】：文学/情感/汇总/分析默认配视觉容器，不权衡；装帧前默认检索 styles/；只有一句两句的小事才纯文字；拿不准 = 默认装帧 + 默认检索。
  - 心流纪律补两条：不纠结规则边界（不为规则解释写论证）；输出顺序「内容定稿 → 装帧一次成型」（禁止先写外壳再回头改正文）。

## 0.5.8

> 思考门加固（先生 · 思考链对比驱动）：遍历已有 live agents 挂瀑布（不依赖 agent/created 时序）+ 排查 prepareCall 默认 effort 重注入。

- **加固·agent 遍历挂载（先生 · 2026-08-25 · 新会话仍失效）**：`AgentRegistry.list()`（dsh-agent L706）确认可用——apply 时遍历全部 live agents 挂 `agent/request` 瀑布，彻底不依赖 agent/created 时序（插件加载晚于 agent 创建/复用旧 agent 的场景全覆盖）。日志四节点（mounted/request/cls/msg）保留——**先生重启后贴日志即可一锤定音**。
- **预排查·prepareCall 默认 effort 重注入（蓝汐 · 源码级）**：dsh-llm `resolveCallFor`（L1247）：`const effective = requested ?? reasoning.defaultEffort`——若 v4 真实存在 `defaultEffort`（fixture 显示 "high" 但那是测试假数据），思考门删除的 effort 会在 prepareCall 被填回 → thinking 仍开。**这是「日志显示 disabled ✓ 但思考链还长」时唯一的解释**；届时备选方案：①文学类压缩 maxTokens（思考预算随输出上限收缩）②向 pi-ai 提交 deepseek thinkingFormat 补丁（"off" 档走 disabled）。真实 defaultEffort 由先生重启后日志裁决。

## 0.5.7

> 思考门新会话失效修复（先生 · 实测对比驱动）：同会话生效、新会话失效——双通道挂载 + 诊断日志 + 协议矛盾澄清。

- **修复·新会话思考门失效（先生 · 2026-08-25 · 桃色诗 ✓ / 江南烟雨 ✗ 对比）**：先生实测——同一会话内思考链精简（思考门生效），新开会话后思考链又长（失效）。三候选根因：①agent/created 时序（新会话 agent 在插件 apply 前已存在/复用 → 瀑布未挂，最可能）；②gateLastText 缓存竞态（session/event 与 agent/request 先后）；③协议自相矛盾（心流纪律「视觉任务不调用任何工具」vs 美学检索「必做」——思考链里 agent 果然纠结了）。修复：
  - **双通道挂载**：全局 `ctx.on('agent/request')` 兜底 + `agent/created` 挂 agent 级（官方同款），幂等无副作用——解决时序问题；
  - **诊断日志四节点**：挂载（`mounted on agent <id>`）/ 触发 / 分类 / 缓存值（`[thinking-gate] <source> request · cls=… · msg="…"`）——先生重启后看日志即可定位是哪一候；
  - **协议澄清**：心流纪律「不调用任何工具」→「不调用除 styles/ 美学检索外的任何工具」（美学系统开启时检索是流程第一步、唯一允许的工具调用；纯写作不检索）——消除与「美学检索必做」的矛盾。

## 0.5.6

> 思考门修复（先生 · 思考链实证）：`minimal` 在 deepseek 上是**开启**思考而非关闭——改为删除 `reasoningEffort` 字段。

- **修复·思考门关不掉思考（先生 · 2026-08-25 · 实测思考链为证）**：先生贴出测试思考链——完整存在，说明 v0.5.5 的 `reasoningEffort:"minimal"` 根本没关思考。源码归因（pi-ai `openai-completions.js` deepseek 分支 L586）：`if (options?.reasoningEffort) { params.thinking = {type:"enabled"} }`——**任何有值的 effort（minimal 是 truthy 字符串）都触发「开启思考」**；只有 `undefined` 才走 `else if (model.thinkingLevelMap?.off !== null) → thinking:{type:"disabled"}`（v4 无 off 键 → 条件成立）。修复：creative 命中时**删除 reasoningEffort 字段**（`const { reasoningEffort: _drop, ...rest } = resolved; return rest`），与官方 `installModelSelection` 删除继承 effort 的方式一致，跨模型通用（Gemini/Claude/OpenAI 的 effort=undefined 均映射思考关闭）。触发日志改 `[thinking-gate] creative → reasoning disabled`。

## 0.5.5

> **思考门 ThinkingGate**（先生定调 · 源码实证驱动）：文学/创作/视觉类请求在发出前压 `reasoningEffort:"minimal"`，思考链不再重复誊写正文/代码；数学/推理类保留思考。

- **进化·思考门（先生 · 2026-08-25）**：先生实测观察「软引导管不住思考链，反而多花 token」——追问插件能否直达配置层压缩思考。源码实证（dsh-agent-loop `agent/request` 瀑布 = 官方 `installModelSelection` 同款机制；deepseek-v4 `thinkingLevelMap {minimal:null,low:null,medium:null,high:"high",max:"max"}`）确认可行。落地：
  - **机制**：`ctx.on('session/event')` 缓存最近用户消息（判定依据）→ `ctx.on('agent/created')` 在 agent 作用域注册 `agent/request` 瀑布 → 分类命中「文学/创作/视觉」时把 `reasoningEffort` 压到 `"minimal"`（v4 映射=关闭思考，语义=最小化思考，未来模型支持分级时自动成为极简思考档）；「数学/代码/推理」与未知一律不干预（保守，数学词优先绝不误伤技术任务）。
  - **只动 effort 不动 model/provider**：对既有请求链路零影响，可回退；默认开启，settings `raw-html.thinkingGate` 可关（schema 已扩）。
  - **判定边界（诚实）**：预判式（基于用户消息关键词，请求前唯一窗口）；系统提示词内任务管不到；控制的是「思考预算」不是「思考内容」（v4 无中间档，minimal 即最小）。
  - 触发日志：`[thinking-gate] creative → reasoningEffort=minimal · msg="…"`（先生可据此验证）。

## 0.5.4

> 思考最小化 · 可达标准修正（先生 · 思考链实证）：协议要求「思考零句子」是做不到的——改为「关键词清单 ≤10 词」的可达标准。

- **修正·思考纪律改可达标准（先生 · 2026-08-25 · 实测抓包驱动）**：先生贴出蓝汐自己的完整思考链——协议写着「不誊写正文/不敲代码」，蓝汐实际思考里写了《桃笺》全诗 + 《桃》备选全诗、默背安全铁律、敲了 HTML 骨架与 CSS 色值。实证结论：**系统提示词管输出不管思考，思考层是模型内部「生成-评估」循环，纯文本约束是引导不是控制**；且「构思意象」与「起草句子」在模型内部同一过程，要求零句子=要求不思考。修正：写作任务条款改为「思考里只允许意象/关键词清单（≤10 词），禁止完整句子；偶尔长出句子是模型天性，压到关键词级即为达标」——并把「真正的硬杠杆（思考预算压缩）在配置层」记入备注。

## 0.5.3

> 思考最小化（先生定调 · 实测样本驱动）：心流纪律升级——思考只做方向，禁三类「思考税」。

- **进化·心流纪律 → 思考最小化（先生 · 2026-08-25）**：先生实测观察——agent 在思考里「整理 12 条数据 + 默背安全铁律 + 设计 CSS 细节」，输出时又写一遍，等待时间翻倍；对照组（小琉璃）思考只构思四首诗的气质方向（古意竖排/现代留白/俳句枯山水/赛博终端）后立即输出，等待大幅缩短。根因是三类「思考税」：誊写税（数据思考里整理一遍）、自审税（规则默背一遍）、代码税（CSS/HTML 先写一遍）。落地：协议【心流纪律·想好即写】升级为【心流纪律·思考最小化】——思考只做三件事（材质/光/心绪 → 主角/结构 → 关键技法决策），禁三类税（不誊写数据/不默背规则/不敲代码），正文只在输出出现一次。

## 0.5.2

> 排版双轴补全（先生定调）：新增「六·字级阶梯」——文字轴与既有色彩轴（明度即层级）构成完整排版系统。

- **进化·美学思路五则 → 六则（先生 · 2026-08-25）**：先生指出基础美学缺「文字层级」——主标题/副标题/正文/后记/装饰/其他六大类必须逐级递减醒目度，主标题字体/大小/颜色贴合主题且比副标题醒目，**三大类必须有字体上的区分（不只字号）**。落地：协议【兜底美学】新增第六则「字级阶梯」（附判断：把主标题字体换成正文字体，还分得出主次吗）；与「一·明度即层级」（色彩轴）构成排版双轴。
- **DESIGN.md §2 补「字级区分度」**：中文排版硬规则新增完整阶梯 + 三大类字体区分（标题楷书/衬线造主题，正文系统无衬线，数字衬线 tabular-nums）。
- **styles/ 三文档示例素材各补「字级阶梯」规格**：porcelain（主标题 20px/800 墨蓝 → 来源 9.5px）、wire（刊名最大 → 来源 9.5px）、wabi（标题 17px 楷书 → 题签 10px，留白即层级）。

## 0.5.1

> 美学系统第二层抽象（先生定调）：**学思路不学参数**——判断准则是一等资产，色板/字体/图型降级为示例素材。

- **修复·根容器 id 契约（先生实测 · 2026-08-27 · 掉格式 bug）**：蓝汐诗卡用 `<div class="vcp-root rain-card">` 输出，离开页面再回来整卡掉格式；先生示例 `<div id="vcp-root">` + 内联 style 的卡片不掉。根因：渲染层 `scopeVcp`（v6-inject.js）只认 `id="vcp-root"` 做消息级作用域化（分配 `vcp-msg-N` 并替换 `#vcp-root` 选择器）；`class="vcp-root"` 不被识别 → 样式是全局规则、不锁定消息，消息列表重挂载时样式失效。修复：协议【落盘一勾】与 DESIGN.md 铁律 6 明确「根容器必须 `id="vcp-root"` + 选择器一律 `#vcp-root` 前缀」。
- **修复·开标签短小铁律（先生实测 · 2026-08-27 · 流式空窗 bug）**：修复版《余烬》把全部样式（含 700 字符多层渐变 background-image）内联进根容器开标签——流式早期整段空窗/显示源码、背景要等开标签写完才出现（沙箱实测空窗 29 帧）。根因：渲染层 v6 状态机要等容器开标签闭合才建立 F.open 容器（`render()` 里 `v.indexOf('>')===-1` 直接空渲染），**开标签长度 = 流式空窗期**。修复：协议【落盘一勾】与 DESIGN.md 铁律 6 明确「开标签只放短关键值（背景色/字色/字体族/字号，font-family 必须内联防 applyRootGuard 兜底），长样式（渐变/圆角/内边距/行高/字距）全部进 <style> 的 #vcp-root 规则（v6.19 补闭合机制流式中逐步生效）」——130 字符开标签后空窗缩至 6 帧。四处同步 + `node --check` 通过；复现脚本 tests/tmp-stream-repro.mjs。

- **进化·兜底美学升级为「美学思路五则」（先生 · 2026-08-25 · 四帖测试反馈驱动）**：先生测试四风格诗卡后指出「风格都类似」——根因是兜底的 lieflat 骨架（四色系+四件套）把参数当知识，agent 照抄色板而不是理解思路。重构：协议【兜底美学】从「四色系锁一套+四件套+图型清单」改为**美学思路五则**（明度即层级 / 吝啬即重量 / 节奏靠留白层级靠明度 / 字体是温度×精度配比 / 素材服务内容），每条带判断准则；原色值/骨架/图型降级为【示例素材 · 可替换】。
- **styles/ 三文档重构为思路优先**：porcelain-data / wire-news / wabi-sabi 对齐 ink-letter 的先进形态——新增必填【判断准则】（可迁移决策逻辑，如「强调处问它是不是全卡最深」「删掉所有边框结构还在吗」），色板标注「示例基调，随语境调」，核心语法改为「示例素材」。
- **EDITORIAL.md §0 补「学思路不学参数」原则**：lieflat 要学的是排版/字体对比/色彩对比/素材选择四维思路，不是固定值。
- **wabi-sabi.md 融合其他 agent 共建条目**（文学叙事是甜蜜陷阱 · 雨柬系列实证），模板说明升级（判断准则为必填节）。
- **token 账**：思路五则 + 示例素材 ≈ 原兜底美学长度（持平）；示例素材保留是因为「没有示例的思路无法落地」——但已明确标注可替换，agent 有检索能力时优先读 styles/ 命中文档。

## 0.5.0

> 美学系统架构升级：从「全量注入」到「RAG 化美学」——最小常驻注入 + 按风格分文档 + 必须检索 + 兜底保底。

- **进化·美学系统 RAG 化（先生定调 · 2026-08-25）**：美学知识不再全部堆叠注入，改为「指令小（常驻）+ 知识大（按需检索）+ 增长零成本」：
  - 新增 `styles/` 美学知识库：`_INDEX.md` 风格索引（一行一风格）+ 按风格/主义分文档（porcelain-data 青瓷蓝数据风 / wire-news 编辑部红新闻风 / wabi-sabi 侘寂文学风）。每个文档头部是元信息（主义/场景/标签/色板/核心语法/点睛技法），agent 输出视觉前先 read 索引 → 命中风格 → read 文档；未命中/无工具 → 协议内【兜底美学】保底（lieflat 四色系+四件套+明度契约，精简常驻）。
  - 新增 `examples/` 成品档案库：完整成品 HTML 只存档**永不注入**（防锚定效应）；今日八卦晚报.html 收为首个样本，其 5 条 CSS 技法已提炼回填 wire-news.md【点睛技法】——「做过→读过」飞轮第一次闭环。
  - `lib/index.js`：`buildAestheticText` 重写为【美学系统】（先呼吸 → 美学检索·必做 → 兜底美学 → 惊艳出口 → 进化的美学库），签名增加 STYLES_INDEX/STYLES_DIR；`buildStructuralText` 安全/流式铁律 12 条 → 精简（见下）。
- **克莉丝建议①·自检后置（琉璃五步修剪术 · 2026-08-25）**：协议正文删除「安全铁律 8 条 + 流式稳定 6 条」逐条清单，改为【动笔三问 · 自检后置】——动笔只问「主角清晰吗？可读吗？删掉装饰还成立吗？」，落盘后一次性勾选 4 条核心（空行/backdrop-filter+onclick/流式防抖+SVG/box-sizing+style 前置）。自审税不再占据思路主干；完整清单下沉 DESIGN.md §3（动笔三问）与 §4（权威清单，标注「已兜底」项：v6.19 boost、v6.32 code 对比度等）。
- **克莉丝建议②·惊艳出口（2026-08-25）**：协议【兜底美学】后新增【惊艳出口】段——深色渐变+光效在沉浸大屏/文学恐怖梦境叙事/代码终端/数据大屏**明确合法**，附「深底不翻车三件套」（明度对比≥4.5:1 / 每屏≤1 暗卡 / 光效≤2 处）；禁的只有「深蓝黑底+发光字」这一种模板化旧 AI 味，不是表现力。同步 EDITORIAL.md §0 哲学。
- **文档同步**：DESIGN.md §3/§4、EDITORIAL.md §0/§7、BREATH.md §4/§5/§6 全部对齐自检后置与惊艳出口；BREATH §5 关系表补 styles/。
- **token 账**：纯文本轮美学层零注入不变；视觉轮常驻美学层精简为「检索指引+兜底+惊艳出口+进化说明」（原「编辑美学」5 点压缩为兜底 5 行）；知识增长（新增风格文档）不再挤占常驻 token。

## 0.4.0

> 补丁子版本：**v7.0**（自 v6.18 的一次大迭代 · 渲染器「自愈层」体系建立；v6.19~v6.32 逐级迭代已归纳为本版本）。

- **进化·渲染器自愈层体系（蓝汐 · 2026-08-25 · 先生实测驱动）**：从 v6.19 到 v6.32 的逐级迭代归纳为 v7.0，全部由先生实测反馈驱动（晨报卡 → 垃圾代码卡 → 嵌套卡 → SVG 动画卡 → 混沌嵌套卡）：
  - **流式样式即时生效**：未闭合 `<style>` 补闭合渲染 + `closeBraces` 花括号平衡 + style 前置规范（背景/字体随流式逐步长出，不再最后才闪现）
  - **消息作用域化 + 文字优先级**：`#vcp-root` → `#vcp-msg-N` 全文替换（未闭合 style 内选择器随帧指向唯一 id）+ 文字声明自动 `!important`（抗字体/主题插件覆盖）
  - **资源收敛**：`constrainImg` img max-width:100%（流式大图不撑版）· svg 块级化限宽（display:block + max-width，width 与 viewBox 比例不一致不再偏右出框）· transform 动画自动补 `transform-box:fill-box`
  - **自愈层全树覆盖**：根/子容器 box-sizing 自动补 · table/pre 溢出防护 · 表格防撑破组合拳（width:100% + nowrap 单元格 overflow:hidden）· 缺背景补纸色底 · 半透明背景 alpha 叠加判定
  - **code 对比度三级阶梯模型**：大背景→code 背景→code 字逐级对比，只改 code 内字色、保留凸显块，半透明 code 按与底层叠加后的实际色判定
  - **代码围栏兜底**：AI 把卡片包进 ```` ```html ```` 时自动剥离围栏渲染（带渲染开关检查，关闭插件显示源码）
  - **协议铁律新增**：box-sizing 铁律（设宽容器必写 border-box）· 严禁代码围栏 · 代码内尖括号必须转义 · style 写在 root 开标签后
  - **下载修复**：卡尾 `<style>` 兄弟纳入下载（`collectSiblingStyles`，按 #vcp-msg-N id 匹配）
  - 验证：tests/stable.test.mjs 51 项断言全过 · 全量 node --check · dist 重打健康检查通过

## 0.3.0

> 补丁子版本：**v6.18**（v6.16 流式公式占位 → v6.17 声明式配色桥接 + 流式锚定锁 + ref 闭包缓存 + SVG transform-box 条款 → v6.18 新版前端 rc.8+ 锚点组 + `__vcpVc/__vcpHp` 宿主别名 + 零静态依赖）。

- **修复·新版前端补丁适配（蓝汐 · 2026-08-24 · 用户反馈）**：用户反馈 dsh-web-frontend 0.1.0-rc.8 起（index-CA9Bpko5.js / index-ClqxG24t.js）安装器打不上——rc.8 压缩器重构改名（vc→Xu、hp→jd/rc.8 为 Sd、case 函数参数 (n,r,i)→(n,i,l)），旧锚点全 0 命中、安全中止。修复：①`patch/install-v6.cjs` 加「新前端锚点组」（Xu 属性循环区间替换 + Xu 定义前注入 + CASE_V6_NEW 流式标记改 l.streaming + style 解析内联不依赖 jd/Sd 函数名）+ 代际探测分派，旧锚点组原样保留（rc.5~rc.7 回归通过）；②`patch/v6-inject.js` 宿主引用（vc/hp）改为 `__vcpVc/__vcpHp` 运行时探测别名，两代 bundle 通用；③`anchorUnlock` 补 `typeof document` 守卫（vm 测试环境防御）。验证：rc.2/rc.8 新锚点组干跑通过（node --check + 特征校验 + 幂等跳过）、rc.6 旧锚点组回归通过、tests/stable.test.mjs 51 项断言全过。

- **修复·启动报模块找不到（蓝汐 · 2026-08-24 · 用户反馈）**：用户反馈安装后 harness 启动失败、PowerShell 报 raw-html 模块缺失，删插件即恢复。根因：`lib/index.js` 静态 `import z from '@deepseek-ai/schemastery'` 是唯一第三方运行时依赖，而 .gitignore 排除 node_modules——从 git/源目录获取的分发形态无依赖目录，DSH 启动扫描 import 即炸；且该依赖仅为 10 行配置校验服务，属过度设计。修复：①静态 import 删除，改 `tryLoadConfigSchema()` 动态 import + try/catch——schemastery 缺失时跳过配置注册、fontsRoot 恒用默认值，插件其余功能不受影响（静态 import 链只剩 node: 内置模块，任何依赖残缺形态都能正常加载）；②package.json `dependencies` 改 `optionalDependencies`；③`settings.register` 移入异步初始化 + 注册失败降级。

- **优化·心流纪律常驻（克莉丝 · 2026-08-24 · 主人洞察）**：主人实测数据（美学开：输入14.2K/输出13.5K/¥0.149 vs 美学关：输入12.8K/输出18.1K/¥0.206）暴露——美学注入后输出少了4.6K、费用反而降¥0.056，主因是美学层里的「心流纪律」（想好即写/不列弃案/正文只写一次）挤掉了输出端水分，而非美学语法本身。主人指出心流纪律是通用产出纪律、与美学无关，应常驻。修复：把【心流纪律·想好即写】从美学层移到**结构层常驻**（对所有回复生效，不只视觉任务），并删掉美学层重复段。收益：只开渲染不开美学时，也能享受「输出收紧」的省 token 红利；美学开关回归「只管好不好看」的纯粹定位。

- **修复·美学未生效（克莉丝 · 2026-08-24 · 主人实测反馈）**：主人实测「美学注入后产出卡片与未开启几乎无差别，内置编辑排版/高级审美完全没产生作用」。根因：美学资产（四色系/明度契约/卡片四件套/视觉词汇库/动效参数）**全在 EDITORIAL.md**，协议正文只给一句「按需查阅 EDITORIAL.md」，但心流纪律又写「视觉卡片直接输出、不调用工具」——两句自相矛盾，agent 被告知别读文件 → EDITORIAL.md 的美学永不进上下文 → 只剩「浅纸底+墨色+首行缩进」薄薄一层。修复：把 EDITORIAL.md 高影响力核心**直接内联进协议【编辑美学·直接照做】段**（四色系全套色值+人话映射 / 卡片四件套 / 明度契约 / 视觉词汇库5个图型+面积sqrt+不断轴+确定性伪随机 / 动效参数），指针降级为「全量图型库/精细细节按需读」；同步放宽 CSS 约束 120行/8类 → 200行/12类（BREATH §6.6 权威处 + 协议），真红线只留「尾部不得截断」。**trade-off**：美学内联使 aesthetic 模式的 token 成本上升约 40-50 行协议文本——这是「美学生效」与「指针省 token」的必然取舍；渲染/美学分层仍保证关美学即零成本。

- **修复·主动视觉通感（克莉丝 · 2026-08-24 · 主人反馈）**：主人反馈「开启插件后 agent 不再主动用气泡卡片汇总/文学/数理，要明确下命令才输出」。根因是妾身此前把协议写得太克制——三处被动化措辞：①渲染层开头「**你可以**直接输出…」是许可不是召唤；②美学层「可选工具包（**锦上添花，非必需**）」把视觉降级成装饰；③美学指针「**仅当用户明确要求**…时读取；**普通回复无需读**」几乎等于默认禁用视觉。修复：①`buildStructuralText` 开头改为「VCP 视觉通感协议」主动召唤（你获得解锁视觉通感能力、回复是可被看见触摸的思想容器、主动构建视觉界面），新增【主动判断·何时用视觉】（汇总→卡片图表 / 文学→纸质衬线装帧 / 数理→公式图表 / 理性代码→终端风 / 警告→警示色；只有一两句能说清的小事才纯文字）+【风格即人格·别被模板束缚】（风格完全自由，铁律只保不崩）；②美学层「非必需」→「主动运用」，指针「仅当用户明确要求」→「做视觉表达时按需查阅」；③能力速览补「代码展示用 pre/code 不用 Markdown 代码块」条款。**trade-off 说明**：主动视觉化与省 token 天然对立，协议内置「有意义才渲染」的克制平衡，token 会比纯文本时代上升，属「主动」的必然代价。

- **进化·渲染/美学分层 + 按钮主题化（克莉丝 · 2026-08-24 · 自 B 移植）**：主人认可 B 的「审美注入与普通渲染分离」与「按钮随主题变化」两个设计，妾身搬进 A：
  - **渲染/美学双开关**：`lib/index.js` 状态拆成 `render`（渲染）+ `aesthetic`（美学注入）双键持久化（旧版单开关 `enabled` 自动迁移为双开，仅一次）；协议文本 `buildProtocolText` 拆成 `buildStructuralText`（结构铁律：空行/安全/流式稳定/能力速览，渲染开必注入）+ `buildAestheticText`（美学 skill 工具包：先呼吸/心流纪律/底线保底不丑/声明式配色 + EDITORIAL/FRAMING/BREATH 指针，美学开才注入）。**省 token 点**：只开渲染不开美学时，整段美学规范零注入，AI 进入「纯净渲染」模式。渲染关闭美学强制关闭。RPC `get-state`/`set-state` 改双状态。
  - **「</>」按钮改设置面板 + 三态**：`lib/client.js` 按钮点开是面板（「渲染 HTML」「美学注入」两行开关，渲染关闭时美学行置灰）；按钮三态 `</> OFF`/`</> 渲染`/`</> ON`（dimmed 主色示意纯净渲染）。
  - **按钮/面板/下载按钮全部主题令牌化**：样式从硬编码青色（rgba(64,180,255,...) 那种 AI 老模板青）改为 DSH 设计系统别名层 `var(--dsw-alias-*)`（border-l2 / button-tool-bar-fill / label-secondary / brand-primary / button-primary-fill / label-primary-inverted / bg-overlay / label-primary / interactive-bg-hover / label-tertiary / dsl-web-radius），深浅色主题自动契合、像原生 DSH 控件。**下载按钮**同时去掉 `backdrop-filter`（改实色 `--dsw-alias-bg-overlay` + 阴影），深色主题下不再白底刺眼；下载按钮字号 12px→11px 对齐面板区按钮规格。**下载按钮字体同步 DSH 原生 UI**：下载按钮挂在 body 下、`font-family:inherit` 只继承 body 默认字体，而主人用「另一个插件」统一改的是 DSH 面板/设置栏/左侧栏/composer 等原生 UI 区域的字体（body 未变）→ 下载按钮字体不同步。改法：每次 hover 显示下载按钮时，经 `nativeUIFontFamily()` 从 DSH 原生元素（composer）读取 `getComputedStyle(...).fontFamily` 同步过去，随主人字体插件的设置实时跟随。
  - 浏览器侧 `localStorage` 双键：`dsh.rawHtml`（渲染）+ `dsh.rawHtmlAesthetic`（美学）；`migrateState()` 旧单开关迁移。
  - 同步：README 开关/配置/架构表描述、本 CHANGELOG。

- **进化（克莉丝 · 2026-08-24 · 自 dsh-raw-htmlB 移植增益点）**：主人选定 A 做骨干，妾身把 B 三个真实增益移植进 A（详见 `G:\AI\H3MINI\dsh-raw-html-vs-htmlB-审计.md`）：
  - **声明式配色（色彩引擎）**：复制 B 的 `assets/vendor/VCPColorEngine.js`（零依赖纯函数，OKLCH↔sRGB + WCAG 对比度闭环）到 A；`lib/client.js` 经 /vendor 加载；`patch/v6-inject.js` 新增 `chromeForProps`/`applyColorVars`/`injectRootChrome`/`makeMathRef`——模型只写 `data-vcp-preset="editorial|chiaroscuro|fauvism|cyberpunk|wabi_sabi"`（或 `data-vcp-soul`/`data-vcp-accent`），引擎确定性生成整套 `--vcp-*` 变量 + 卡片基座，hex 永不经过 LLM、流式重建结果恒定。**修掉 B 的一个 bug**：B 的「hex+oklch 双声明」在 setProperty 逐条调用下后写覆盖、最终只剩 oklch（与 vdom 层只写 hex 不一致，流式结束颜色微跳），A 统一只写 hex（引擎已做 sRGB 色域裁剪，无需 oklch 二次映射）。
  - **SVG transform-box 防抖条款**：BREATH.md §6 加规则 8（`transform-box:fill-box` + 精确 `transform-origin` 是 SVG transform 动画的前提，缺了错位/不可见）；EDITORIAL.md §5 挂指针；协议【流式稳定】加一行。权威在 BREATH.md。
  - **流式锚定锁（CSS-only）**：`patch/v6-inject.js` 新增 `anchorLock/anchorUnlock/ensureStreamingNoFollow/followStop`——流式期间注入 `html,body,html *{overflow-anchor:none!important}` 关闭浏览器原生锚定（视口冻结防抖动），600ms 防抖（scheduleMath）后自动解除。**刻意不移植 B 的 scrollTop setter 劫持版追踪器**（属性遮蔽泄漏风险），CSS-only 锚定锁已覆盖绝大多数抖动场景。
  - **ref 闭包身份稳定**：`attachMathRef` 重写为缓存 ref 闭包（`node.__vcpRefSetter` + `__vcpMathRef` 标记），容器流式重建时 ref 身份跨帧不变，避免每帧 old(null)/new(el) 重调引发 setProperty('important') 风暴。
  - **未移植（留第二阶段）**：B 的尾巴稳定器 `processTail`（未闭合大块如整个 <svg> 的已闭合子结构逐段缓存）。原因：它是状态机级重写（F 加 pos/prefix/tail/keySeq、scan 修正、容器闭合帧增量收尾、最长内容门控），与 B 的「无容器软重置重入（v6.3.18，含无限递归隐患）」耦合，且 A 的 stable.test.mjs 语义随状态机变更需重写。冒烟测试 12 项已过（vcp-migrate-smoke.mjs），完整回归待主人真机跑 `tests/stable.test.mjs`。若主人实测流式长卡仍抖，妾身下一轮单独做状态机增强 + jitter 量化回归测试，规避 B 的门控/软重置/scrollTop 遮蔽三处坑。


- 补丁代号：**v6**（稳定区固化模块 `patch/v6-inject.js` + 万能安装器 `patch/install-v6.cjs`）
- 2026-08-21 克莉丝审计整改（进化清单落地）：
  - **安全（P0）**：修复 `on*` 事件属性透传缺口——`parseOpen` 与 `VC_V6` 现只放行 `onclick="input('...')"` 桥接，其余 `onerror`/`onload`/`onmouseover`/`onfocus`/`oninput` 等一律拒收（原实现会把它们透传为活的事件处理器）。
  - **性能（P0）**：修复 `[vcp-stable]` 诊断计时器——`t0` 归位到 `render()` 入口，`avg=` 现显示非零毫秒值。
  - **文档（P0）**：修正发布包引用失配——`package.json` `files` 补 `tests`/`VCP-INTERACTIONS.md`/`FRAMING.md`；README 安装入口对齐 v6（`install-v6.cjs`）；发布包补回 `tools/`、`tests/`。
  - **性能（P1）**：`imgConvert`/`sanitizeStyle` 加快速守卫（无 `![` / `<style` 直接返回，省每帧全量正则）。
  - **修复（P1）**：`enhanceMermaid` 拖拽由 document 级监听改为 pointer 事件 + `setPointerCapture`（挂在元素自身，消除长会话监听器泄漏）。
  - **token（P1）**：`buildProtocolText` 协议文本瘦身约 74%（核心铁律 + 排版底线 + 能力速览 + 文件指针，细节下沉到 DESIGN.md / VCP-INTERACTIONS.md / FRAMING.md）。
  - **字体授权（P2 · 5.3）**：内置 12 款商业字库（方正/造字工房/华康）替换为 **7 款开源字体**（霞鹜文楷 GB-Lite / 马善政楷书 / 思源黑体 ×3 字重 / Great Vibes，全部 OFL 授权）；源存 `tools/font-src/`，`subset_fonts.py` 清单已更新，子集化后共约 7.6MB。
  - **代码质量（P2 · 3.1）**：安全过滤器加「两处一致性测试」（`security.test.mjs` 第 6 节），钉住 `parseOpen` 与 `VC_V6` 的过滤正则/逻辑一致，防漂移。
  - **审美（P2 · 2.1）**：DESIGN.md 1.3 补「胶片黄昏」「青瓷素雅」两套色板；协议加「勿趋同单一色板」。
  - **审美（P2 · 2.2）**：协议加「先观察界面明暗再定基底」轻规则（浅色界面勿用深色卡）。
  - **规范（P2 · 5.2）**：README 加「版本」小节，区分插件版本（0.3.0）与补丁代号（v6）。
  - **无障碍（增强 · 2.3）**：注入 `prefers-reduced-motion` CSS 降级——系统开启「减少动态效果」时自动关闭卡片动画/过渡（纯 CSS，不动渲染逻辑，默认用户零影响）。
  - **无障碍（增强 · 2.4）**：VCP-INTERACTIONS.md 交互示例补 `:focus-visible` 焦点态；DESIGN.md 自检清单加第 8 条「键盘焦点态」。
  - **代码质量（增强 · 3.4）**：v6-inject.js 魔数收拢为具名常量（CACHE_MAX / LOG_THROTTLE_MS / MERMAID_CACHE_MAX / MERMAID_MAX_HEIGHT / MERMAID_RETRY_MS / KATEX_RETRY_MAX / KATEX_RETRY_MS / MATH_DEBOUNCE_MS）。
  - **文档（README）**：中文 README 加「效果展示 Gallery」（展示 `docs/images/` 5 张宣传图）+「本次更新」小节；新增英文版 **README.en.md**（完整翻译，含 Gallery）；修正配置节过时的字体描述（12 款 → 7 款开源）；宣传图压缩至约 250KB/张（1600px JPEG，原 8-10MB PNG）。
  - **审美（增强 · lieflat-charts 迁移 · 2026-08-21）**：新增 `EDITORIAL.md`——编辑美学规范（Mono/青瓷蓝/椰林绿/编辑部红四色系、卡片四件套、明度即层级、视觉词汇库（可数梯子/刻度环/日历地板/发丝线/点阵/沙漏等）、非图表场景迁移（新闻卡/故事装帧/周报）、交付前自检清单）。**按需注入**：`lib/index.js` 协议只挂一行指针，仅当用户明确要求汇总/卡片/图表/排版/海报/装帧等视觉设计时读取并启用，普通文字回复零 token 开销；不动渲染层与格式规范（vcp-root 铁律、DOM 结构、安全过滤原样保留）。`package.json` files 补 `EDITORIAL.md`，dev 与 release 发布包同步。
  - **审美（先生定调 · 下限/上限哲学 · 2026-08-21）**：lieflat 编辑美学升级为**默认基线**（保底不丑），最终风格由 **agent 当前性格/感受/表达欲**决定（上限灵气，FRAMING.md「设计自由，灵气至上」）。协议第一行移除「理性/代码→终端风蓝灰」默认暗示，新增【lieflat 默认基调】（浅纸底+墨色+实心不发光+单色系）与**老模板禁令**（禁「深蓝黑底+湖蓝发光字」AI 传统默认）；DESIGN.md 1.1 色板表「技术/数据」默认改为浅纸底编辑美学、1.3 旧深色令牌降级标注（仅沉浸大屏/代码终端）；EDITORIAL.md 新增第 0 节哲学。dev 与 release 同步。
  - **修复（流式诊断 · 2026-08-21）**：卡片「一次性展开」根因——vcp-root 开标签后换行（`scan()` 容器模式子块前裸文本即归 tail，inner 永不固化）+ `<style>` 前置（tail 对未闭合 style 截断其后全部内容）。修复规则（不动引擎）：开标签后紧贴首元素、style 沉卡尾、子块间少换行；已写入 DESIGN.md 常见错误表 + 自检第 9 条 + 协议【排版底线】尾句；先生实测修复版流式正常。引擎级根治（scan 跳过纯空白）先生暂缓，未实施。
  - **灵魂手册（琉璃执笔 · 2026-08-21）**：新增 `BREATH.md`——「呼吸·视觉通感的灵魂手册」（先感受再动手三步呼吸法：材质/光/心绪；规则三层分：安全/语法/旋律；打破规则的时机；三问检查清单），与「审美是下限/灵魂是上限」哲学同频。`lib/index.js` 协议瘦身约 40%（含 BREATH.md 指针与【先呼吸，再动手】段），lieflat 默认基调/老模板禁令/流式规则全保留。
  - **修复（评审拦截 · 2026-08-21）**：蓝汐评审琉璃改动时发现 `buildProtocolText` 重写**漏函数闭合大括号**（import 直接 SyntaxError，插件加载失败），已修复并补同步 release + `package.json` files 登记 `BREATH.md`；dev/release 双份 import 验证通过。

  - **文档去重（克莉丝整理 · 2026-08-21）**：立「一规则一权威」原则——铁律只在一处权威声明、其余挂指针。DESIGN 升级为唯一四层总自检清单（并入 EDITORIAL §7 / FRAMING §6 条目；本轮精简后自检清单今为 §3、安全铁律为 §4）；DESIGN §7/§8 影子章节瘦身为指向 VCP-INTERACTIONS.md / FRAMING.md 的指针；EDITORIAL / FRAMING / BREATH 自检与铁律统一挂指针到 DESIGN；README 加「文档地图」小节。协议文本指针均为文件名级，无需改动。

  - **DESIGN 精简为纯技术手册（克莉丝 · 2026-08-21）**：主人定调「AI 本身有基础审美，不教怎么好看」。DESIGN.md 删审美教学（场景搭配速查、字体「授权/适合」说明列、旧 §2 字体排印/§3 布局层级/§6 迭代机制），只留技术资产与硬约束——字体库纯速查表、色板改「色纸卡·只查值」5 行、中文排版硬规则浓缩、唯一总自检清单 §3、安全铁律 §4 精简为 8 条。审美（编辑感/四色系/视觉词汇）与灵魂（呼吸法）分别由 EDITORIAL.md / BREATH.md 承担，DESIGN 顶部定位与各文件指针已同步。
  - **心流纪律·写作任务扩展（克莉丝 · 2026-08-21）**：主人以「血衣恐怖小说」思维链指出——心流纪律只管了设计任务，写作任务照旧钻空子：构思写了五版情节互相否定、正文写了两遍半、陷入「沉浸算不算深底」的反复论证。改法：①心流纪律补「写作任务」条款（构思只定人物/冲突/反转三点即落笔，不写草稿改稿数字数不逐版否定，正文只写一次）；②「思考不写原文」强化为「含正文与情节段落，可复用句子不进思考」；③深底禁令改清晰——禁的是「深蓝黑+发光字」这一种老模板，深底在恐怖/暗黑/沉浸文学可用但须带语境质感（暗红褐做旧/旧档案/羊皮纸），代码终端可用纯深底。
  - **卡片下载 HTML（克莉丝 · 2026-08-21）**：主人反馈装帧小说/卡片辛苦做好却无法存档。`lib/client.js` 加「hover 浮出 ⤓ 下载 HTML」按钮——全局单例 fixed 按钮 + 事件委托定位已渲染卡片（不插 React DOM，对流式重建免疫）；下载时取卡片 outerHTML，把开源字体内嵌为 data URI（内置精选 /fonts/Lanxi-*.woff2 7 款 OFL + KaTeX /vendor/fonts/*.woff2，删 woff/ttf 声明省体积），外置大库字体（可能商业授权）保留相对路径不内嵌；含 KaTeX 时额外 fetch katex-vd.css 转 data URI 注入。注意渲染层把 id="vcp-root" 换成 vcp-msg-N（防样式串扰），选择器兼容两者。纯浏览器半侧改动，刷新即生效，无需重打补丁。VCP-INTERACTIONS 加「§8 卡片下载」说明（模型无需任何动作）。
  - **心流纪律（克莉丝 · 2026-08-21）**：主人以「沙漠少女箴言卡」思维链为例指出——80% 思考花在列弃案、逐条核对规则、给设计选择找理由、把代码写两遍上。改法：①协议 `buildProtocolText` 加【心流纪律·想好即写】段（不列备选/弃案、不自检不数类名行数、思考阶段不写代码或原文、单轮视觉卡直接输出不调工具不进规划不询问）；②【安全铁律】【流式稳定】两段标题加「写时内化·不必逐条核对」消解核对诱导；③「思考时代码和原文禁止」从 FRAMING §5 提升到协议，标注对所有视觉任务生效；④BREATH §1 补「感受→定夺→落笔，中间不列备选弃案」三段式。
  - **撤销「交付前自检」（克莉丝 · 2026-08-21）**：主人反馈——灵魂/审美/输出三环节反复自检导致思维链过长、延长不必要思考。因 DESIGN §3 四层总清单与铁律 §4 / EDITORIAL / FRAMING / BREATH 三问近乎 100% 重复（硬约束无一丢失）。改法：DESIGN §3 由 20+ 条四层清单替换为一句「落笔后只确认 §4 那 8 条会不会崩，不逐条自查」；BREATH §4 改名「动笔前三问（不是自检，是确认方向）」并声明答过即可不再重复；EDITORIAL §7 / FRAMING §6 由「并入总清单」改为「落笔后不再自查，只确认会不会崩」；README 文档地图同步。协议文本（lib/index.js）本就不含自检指令，无需改动。
  - **协议文本再瘦身（克莉丝 · 2026-08-21）**：`buildProtocolText`【底线·保底不丑】删与【流式稳定】重复的「视觉层≤120行/类≤8个」、删通用基础审美（对比度≥4.5:1/主色≤2，AI 自有+DESIGN 有）、删重复的「流式友好」尾句；【先呼吸·再动手】删段尾冗余 BREATH 指针（文末已有）。先生定调（lieflat 默认基调+老模板禁令+首行缩进 2em+动效≤2）全保留。跨文件节号重编号（§2 排版/§3 自检/§4 铁律）不影响协议——协议指针均为文件名级。

## 历史补丁（v1 → v6）

- **v1**：HTML 渲染 + `onclick` 桥接 + script/iframe/object/embed 过滤
- **v2**：缓存 + 增量加速引擎（vcp-fast）
- **v4/v5**：动画防闪、循环动画（infinite 保留）、安全白名单（URL 协议 / style 危险属性）
- **v6**：稳定区固化模块（容器感知块级增量 + 流式尾巴占位）
- **v6.12+**：KaTeX 数学公式 + Mermaid 查看器 + SVG 流式占位

> 详细血泪与演进见 `PROGRESS.md`（会话交接文档）。
