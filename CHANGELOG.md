# CHANGELOG

本文件记录插件版本（`package.json` 的 `version`）与补丁代号（`patch/*` 注入模块）两条线的演进。

## 0.4.0（当前）

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
