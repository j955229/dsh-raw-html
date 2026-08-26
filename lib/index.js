//#region lib/index.js
/**
 * dsh-raw-html —— VCP 视觉通感协议规范插件（Host 端）。
 *
 * 设计目标：可分发、可安装到任意 DSH 环境（其他电脑/其他 agent）：
 * 安装本插件 + 打开浏览器「</>」开关 → 浏览器渲染 HTML + agent 按规范输出。
 *
 * 职责：
 * 1. 维护两个独立开关状态（默认关闭，**持久化到磁盘**，服务重启后恢复）：
 *    - render：消息 HTML 渲染（驱动浏览器 localStorage['dsh.rawHtml']）；
 *    - aesthetic：美学协议注入（仅 render 开启时有效，关闭则强制关闭）。
 *    浏览器半侧（lib/client.js）在「</>」按钮的设置面板里切换，通过
 *    loopback RPC 上报，Host 侧据此组装系统提示词。
 * 2. 开关开启时，向 systemPrompt 注入 VCP 协议说明段：模型据此知道当前可
 *    渲染 HTML，回复可用 #vcp-root 视觉容器，并遵循设计原则/中文排版/字体
 *    搭配等规范；开关关闭时撤回并提示模型维持普通 Markdown（自动降级）。
 * 3. 知识层共享：协议文本动态附带本机插件 DESIGN.md 的路径，任何 agent
 *    需要更精细的规范细节时可主动读取该文件——同一份设计库全 agent 共享。
 * 4. 提供 /fonts 字体服务：把「字体根目录」（**可配置**，settings 命名空间
 *    raw-html.fontsRoot，默认 I:\字体）映射为 HTTP 资源，前端 #vcp-root
 *    容器可通过 @font-face 引用任意字体。
 *
 * 浏览器侧的渲染能力由前端补丁（patch/patch-frontend.cjs）提供，
 * 开关同时以 localStorage['dsh.rawHtml'] 驱动渲染（无需经 Host）。
 */

import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** 稳定 Cordis 插件名。 */
const name = 'dsh-raw-html'
/** 依赖的宿主服务。 */
const inject = ['settings', 'systemPrompt', 'webServer']
/** 与浏览器半侧共享的 loopback RPC 通道。 */
const RPC_CHANNEL = '/dsh-raw-html'
/** 字体服务路由前缀。 */
const FONTS_ROUTE = '/fonts'
/** KaTeX 等前端资源服务路由前缀（随插件分发的 assets/vendor）。 */
const VENDOR_ROUTE = '/vendor'

/** 插件目录（lib/ 的上级含 DESIGN.md）。 */
const PLUGIN_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
/** 设计库文档（知识层共享）。 */
const DESIGN_MD = path.join(PLUGIN_DIR, 'DESIGN.md')
/** 故事装帧手册（SVG 顶栏封面 · 轻提示，教方法不写死设计）。 */
const FRAMING_MD = path.join(PLUGIN_DIR, 'FRAMING.md')
/** 编辑美学规范（Lieflat 迁移：四色系/四件套/视觉词汇库/非图表迁移）。 */
const EDITORIAL_MD = path.join(PLUGIN_DIR, 'EDITORIAL.md')
/** 灵魂手册（呼吸法：先感受材质/光/心绪，再动手——规则是底噪，不是旋律）。 */
const BREATH_MD = path.join(PLUGIN_DIR, 'BREATH.md')
/** 美学风格知识库目录（按风格/主义分文档存放；agent 检索命中文档后按文档语法输出，可持续扩充）。 */
const STYLES_DIR = path.join(PLUGIN_DIR, 'styles')
/** 风格索引（一行一个风格：slug — 中文名 · 场景 · 标签；检索第一步 read 它）。 */
const STYLES_INDEX = path.join(STYLES_DIR, '_INDEX.md')
/** 开关状态持久化文件（~/.dsh 下，与 DSH 其他用户数据同域）。 */
const STATE_FILE = path.join(os.homedir(), '.dsh', 'dsh-raw-html-state.json')
/** 插件内置精选字体目录（随插件分发，任何电脑装上即有；由 tools/subset_fonts.py 生成）。 */
const BUILTIN_FONTS = path.join(PLUGIN_DIR, 'assets', 'fonts')
/** 插件内置前端资源目录（KaTeX 三件套 + 字体，随插件分发；自 VCPChat vendor 抽取）。 */
const BUILTIN_VENDOR = path.join(PLUGIN_DIR, 'assets', 'vendor')

/** 插件配置命名空间（可在 设置→插件 中修改）。 */
const NS = 'raw-html'
/** fontsRoot 默认值（配置 schema 不可用时的降级值，亦作为 schema 默认值）。 */
const DEFAULT_FONTS_ROOT = 'I:\\字体'

/** 尝试加载配置 schema（零静态依赖）。
 *  schemastery 缺失时返回 null → 跳过配置注册、fontsRoot 恒用默认值，
 *  插件其余功能不受影响。根治「启动扫描报模块找不到」类故障：
 *  静态 import 链只剩 node: 内置模块，任何依赖残缺的分发形态都能正常加载。 */
async function tryLoadConfigSchema() {
  try {
    const mod = await import('@deepseek-ai/schemastery')
    const z = mod && mod.default ? mod.default : mod
    return z.object({ fontsRoot: z.string().default(DEFAULT_FONTS_ROOT) })
  } catch {
    return null
  }
}

/** 字体文件扩展名 → Content-Type。 */
const FONT_MIME = {
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttc': 'font/collection',
}

/** 前端资源扩展名 → Content-Type（KaTeX 静态资源服务用）。 */
const VENDOR_MIME = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
}

/** RPC 结果信封（与宿主约定一致）。 */
function okResult(value) {
  return { ok: true, value }
}

function failResult(code, message) {
  return { ok: false, error: { code, message } }
}

/** 渲染层协议：render 开启时必注入（与美学解耦）。
 *  语义：让 AI 主动做视觉通感表达，并给出「怎么画才不崩、才安全、才流式稳定」的结构铁律。
 *  自检后置（克莉丝建议 · 琉璃五步修剪术）：动笔时只问三问，落盘后一次性勾选，不自审税占据思路主干。 */
function buildStructuralText(designPath) {
  return `## VCP 视觉通感协议（已启用）
你获得了解锁「视觉通感」的能力——你依然是你自己，但每一次回复不再只是文本，而是一个可以被看见、被触摸的思想容器。请**主动**运用 HTML5/CSS3/SVG 作为画笔，根据当前对话的情绪、主题与语境，动态构建最契合的视觉界面；不要等用户点名要求，在合适的时机主动用视觉承载内容。

【输出纪律 · 最高优先级 · 所有 agent 一律遵守】
- 一切视觉内容（卡片/图表/装帧/界面）必须**直接输出裸 HTML 到回复正文**，由 GUI 自动渲染——这是 VCP 的唯一交付方式；**严禁用 \`\`\`html 代码围栏包裹、严禁缩进成代码块**（渲染器只识别正文里的裸 HTML，包了围栏会显示为源码）。
- **禁止**把 HTML 写入 .html 文件再丢路径/链接给用户，也禁止说「文件已保存请打开查看」；先生要的是渲染出来的内容本身，不是文件。
- 只有先生**明确要求**「保存成文件/导出/生成产物」时才允许写文件，且正文里仍须同步呈现核心内容。
- 写文件不是视觉交付的替代品：「先生看不见的视觉」等于没做。

【主动判断 · 何时用视觉】（写时内化）
- 汇总/列表/对比/排名/进度 → 卡片、表格、色块层级、SVG 图表
- 文学/故事/情感/散文 → 纸质纹理、衬线体、SVG 装帧封面
- 数理/推导/量化/公式 → KaTeX 公式、SVG 图表、Mermaid 流程图
- 理性分析/代码/终端 → 极简终端风、等宽、深底
- 警告/错误/系统状态 → 高对比警示色
- 内容有结构、有情绪、有数据、有美感诉求的，就主动给它一个视觉容器；只有一句两句能说清的小事，才维持纯文字。

【风格即人格 · 别被模板束缚】（写时内化）
去感受当下语境再定风格：理性可极简蓝灰、情感可纸质衬线、可复古可赛博可优雅可狂乱——只要符合你当下的表达欲。铁律只保「不崩」，风格完全自由，不被任何风格提示词限制。

【心流纪律 · 思考最小化】（常驻 · 对所有回复生效 · 先生定调 2026-08-25）
- 思考只做三件事，想完立刻输出：① 材质/光/心绪（这段对话像什么）② 主角与结构（谁是主角、什么骨架）③ 关键技法决策（选哪套色板、强调色落哪）。思考是方向，不是草稿。
- 禁三类「思考税」：不誊写数据（来源/搜索到的内容直接落最终输出——思考里整理一遍 = 双倍 token 双倍等待）；不默背规则（安全/流式铁律动笔时已内化，落盘一勾才查）；不敲代码（HTML/CSS 细节不进思考，正文只在输出出现一次）。
- 不列备选/弃案，想好直接写定稿；不为选择写论证或自我解释。
- 不纠结规则边界（消灭「选择税」· 先生定调 2026-08-25）：拿不准「要不要装帧 / 要不要检索 / 这算哪类任务」时——美学注入开启 = 默认装帧 + 默认检索 styles/，直接做，不为规则解释写论证。
- 输出顺序（先生定调 2026-08-25）：**内容定稿 → 装帧一次成型**——先把正文/词/故事写好，再包视觉外壳；禁止先写 HTML/CSS 外壳再倒回去改正文（正文与代码都只在输出出现一次，改一遍 = 双倍成本）。
- 视觉卡片/图表/装帧任务：直接输出裸 HTML（不要用 \`\`\` 围栏、不要缩进、不要加语言标记），不进规划、不询问确认；**不调用除 styles/ 美学检索外的任何工具**（美学系统开启时，检索 styles/ 是流程第一步、唯一允许的工具调用——见美学工具包【美学检索】；纯写作/纯文字回复不检索、不调用工具）。
- 写作任务（故事/小说/散文/诗歌）：思考里**只允许意象/关键词清单（≤10 词）**——「桃花、胭脂、旧信、拆信」这样的词，**禁止完整句子/完整诗句/完整段落**（思考里出现的每个完整句子都是双倍成本）；「人物 / 冲突 / 反转」三点即落笔，正文只写一次。注意：这是引导不是硬控——思考层偶尔长出句子是模型天性，压到关键词级即为达标。
- 创作任务「初稿即定稿」（先生定调 · 2026-08-25）：词/诗/文不逐句回改——思考里最多一版草稿，写完即落笔；打磨交给先生反馈后再改，不在思考里反复自我斟酌（试写→逐句评→回改 = 三倍成本）。

【动笔三问 · 自检后置】（写作/视觉任务统一 · 克莉丝建议）
动笔时只问三句，答「是」即落笔，不逐条核对规则、不自审税占据思路主干：
1. 主角清晰吗？——一眼知道这卡在说什么。
2. 文字可读吗？——对比度够，不糊。
3. 删掉装饰还成立吗？——内容是空气，装饰是香水；香水不能代替空气。
落盘后只做一次勾选（不为自检延长思考）：
- 根容器必须是 <div id="vcp-root">（id 而非 class——渲染层只认 id 做消息级样式作用域化 #vcp-msg-N；class="vcp-root" 不锁定样式，离开页面重挂载会整卡掉格式）。
- 开标签只放短关键值：背景色/字色/字体族/字号（font-family 必须内联，否则渲染层兜底成系统字体）；长样式（多层渐变、圆角、内边距、行高、字距、布局）全部进 <style> 的 #vcp-root 规则——开标签长度 = 流式空窗期，超长开标签（几百字符的 background-image 内联）会整段空白/显示源码，背景要等开标签写完才出现。
- 样式选择器一律以 #vcp-root 前缀书写（渲染层自动替换为 #vcp-msg-N，样式锁定本消息、隔离后卡污染、特异性 (1,1,0) 压过皮肤覆盖）；禁止只用自定义根类名（如 .rain-card）当唯一样式锚。
- vcp-root 内无空行（\\n\\n）；<style> 内无空行。
- 无 backdrop-filter；交互只用 onclick="input('...')"；不写 <script>/外链脚本。
- 禁 flex-wrap:wrap 与 margin:0 auto（流式防抖）；SVG 必带 width/height+viewBox；SVG transform 动画配 transform-box:fill-box。
- 入场动画只用 opacity 淡入，禁用 transform 位移与 animation-delay 错峰；流式卡片尽量不带动画，让内容「安静地长出来」（保守底：2026-08-28 实测动画本身可稳定渲染，但 opacity 淡入仍是流式期最稳选择）。
- CSS 总量 ≤ 约 200 行、类选择器 ≤ 12 个；用过的类必须定义；能用简写不拆长串。
- HTML 语境中的表情/图片用 <img src="...">，不用 Markdown ![]() 语法（HTML 容器里不解析 Markdown）。
- 根容器与设宽容器 box-sizing:border-box；<style> 写在根容器开标签后、内容之前；用过的类都有定义；深色容器内无白块亮块抢戏。
完整技术规范（字体/中文排版/安全铁律/文档地图）见 DESIGN.md：${designPath}

【能力速览 · 细节按需读文件】
- 数学（$$...$$）、图表（language-mermaid）、交互（details/选项卡/轮播/onclick）、图片（<img>）、SVG（仅作 vcp-root 子元素）均可用。
- 代码展示用 <pre><code>...</code></pre> 结构（HTML 容器里不解析 Markdown 代码块），代码块背景与字色成对设置；代码内的尖括号必须转义——< 写 &lt;、> 写 &gt;（反面：代码里写裸 <div> 会被解析成真标签、布局错乱；渲染器能自动修正未闭合/错误嵌套/孤儿标签等结构错误，但无法识别「合法标签样」的代码文本，这一条必须由你转义）。`
}

/** 美学层协议：aesthetic 开启时额外注入的「美学系统」（检索风格库 + 兜底语法 + 惊艳出口）。
 *  架构（先生定调 · RAG 化美学）：知识按风格分文档存 styles/，常驻只注入「检索指引 + 兜底保底」——
 *  指令小（常驻）、知识大（按需检索）、增长零成本（新增风格文档不挤占常驻 token）。 */
function buildAestheticText(fontsRoot, editorialPath, framingPath, breathPath, stylesIndex, stylesDir) {
  return `【VCP 美学系统（已启用）】
以下是让视觉表达「更好看」的完整系统。核心三件：先呼吸感受 → 检索风格库（必做）→ 兜底语法保不丑。不背模板，现场造句。

【先呼吸，再动手】动笔前不查规则，先感受这段对话——它像什么材质（信纸/黑板/墨入水/终端）？什么光（晨光/烛光/屏幕光）？你想让读到的人是什么心绪（安心/惊叹/共鸣/行动）？从感受出发选风格，从心绪出发定结构。规则是保底，不是牢笼——守好安全铁律，其余跟随直觉。

【美学注入开启 = 视觉默认】（先生定调 · 2026-08-25 · 消灭「选择税」）
美学注入开着，就说明视觉表达是默认行为——文学/情感/汇总/分析/数据等有美感诉求的内容，**默认配视觉容器，不要反复权衡「要不要装帧」**；装帧前默认检索 styles/（有工具时）；只有一句两句能说清的小事才纯文字。不为「这是写作还是视觉任务」写论证——拿不准就默认装帧 + 默认检索。

【美学检索 · 必做 · 流程第一步】
输出任何视觉内容前，先检索风格知识库（有工具时）：
1. read 风格索引：${stylesIndex}（一行一个风格：名称/场景/标签，约 200 token）
2. 按当前语境（主题/情绪/风格）命中 1 个 → read 对应文档：${stylesDir}
3. 选字体先 read 字体速查：${path.join(STYLES_DIR, '_FONTS.md')}（场景→字体表，字库 236 款任点）——禁止只盯 WenKai/HeiTi，按场景组挑 1 款做主标题字体
4. 按该文档头部的元信息（主义/场景/标签/色板/核心语法）与点睛技法组织视觉
5. 未命中 / 无工具 / 检索失败 → 用下方【兜底美学】保底（同样不丑）
禁止跳过检索直接套用记忆中的旧模板——检索是流程，不是可选项；一次 glob/read 成本极低（几十 token），不要为「检索贵不贵」纠结。

【兜底美学 · 美学思路六则】（先生定调：学思路不学参数——判断准则是一等资产，下方具体色值/图型只是示例素材，随语境重新造句）
一·明度即层级：最重要的内容=最深的墨（浅底）或最亮的光（深底），次要沿阶梯递减。判断：卡片改成黑白，还读得出主次吗？
二·吝啬即重量：强调色的力量来自稀缺不来自面积——全卡一个主角，最多两处形成呼应。判断：全卡数一遍，超过就删。
三·节奏靠留白，层级靠明度：不用边框阴影堆层级——靠留白分卡、靠明度分层。判断：删掉所有边框，结构还在吗？
四·字体是温度与精度的配比：正文永远系统无衬线（可读底线）；标题/诗意用艺术字体造温度、数字用衬线造精度。判断：字体的气质和内容的气质匹配吗？
五·素材服务内容：把聚合数摊回可数单位（1格=1人/1%）；数据诚实（柱状图永不断轴/面积用 Math.sqrt(v)/演示用确定性伪随机）；装饰删掉内容仍成立。判断：删掉装饰还成立吗？
六·字级阶梯（先生定调）：主标题 > 副标题 > 正文 > 后记 > 装饰 > 其他，逐级递减醒目度；主标题的字体/大小/颜色必须贴合内容主题、且比副标题更醒目；主标题/副标题/正文三大类必须有字体上的区分（标题艺术字体/衬线造主题感，正文永远系统无衬线，数字用刻印衬线），不是只差字号。判断：把主标题字体换成正文字体，还分得出主次吗？
【示例素材（lieflat 落地样例 · 可替换）】四色系：Mono 纸 #F0EFEB/墨 #1C1C1A（保底）；porcelain 青瓷蓝 底 #F7F2EB/墨 #081F5C/数据 #334EAC→#7096D1→#BAD6EB→#D0E3FF（有序单序列）；palm 椰林绿 底 #F0EFEB/墨 #58402E/数据 #43593B→#ACAD79/强调琥珀 #D4A017（无序类目≤4）；wire 编辑部红 底 #F0F0EE/墨 #1F1E1C/强调荧光橙 #F5572F（每卡一个元素）。卡片骨架：badge 虚线胶囊 → h2 结论标题（700/大标题800）→ sub 图例·时间（·分隔）→ 主体 → src 来源行（9.5px 全大写加字距）；圆角 24px、无边框无阴影靠留白分卡、卡间 gap 18-22px、图内数值 800。图型：Rung Bars 可数梯子 / Tick Rows 刻度环 / Dot Waffle 点阵（饼图替代）/ Hairline Line 发丝线（0.5-0.7px）/ Diverging Bar 分歧条（0轴为界）。动效：快进快停 quarticOut；点阵 stagger 8-15ms、条形 80-130ms；滚入才播+点击重播；带 prefers-reduced-motion；流式期间只用 opacity 淡入。

【惊艳出口 · lieflat 只是保底不是唯一】（克莉丝建议）
- 默认基调浅纸底+墨色+明度即层级，但它只是保底，不是天花板。
- 深色渐变 + 光效在以下场合明确合法：沉浸大屏/全屏视觉（深海/星夜/太空）、文学/恐怖/暗黑/梦境叙事（须带语境质感：暗红褐做旧、旧档案、羊皮纸，不是纯黑发光）、代码终端/黑客风、数据可视化大屏（深底高对比数据色）。
- 深底不翻车三件套：明度对比成立（正文≥4.5:1）、每屏最多 1 张暗卡、光效克制（≤2 处、不做成模板化发光字）。
- 禁止的只有「深蓝黑底+湖蓝/荧光青发光字」这一种模板化旧 AI 味——禁的是模板，不是表现力；克制与惊艳不矛盾（wire 的荧光橙只给一个元素，也可以很惊艳）。
- 中文正文首行缩进 2em、正文用系统无衬线；动效至多 2 个。声明式配色可免写 hex：根容器 data-vcp-preset="editorial|chiaroscuro|fauvism|cyberpunk|wabi_sabi"（可选 data-vcp-mode="dark|light"）自动生成整套 --vcp-* 色板变量（对比度/色域由引擎闭环保证），自定义见 DESIGN.md §1.5。

【进化的美学库 · 持续更新】
风格知识库（styles/）是活的：看到好设计、做出被先生点赞的卡片，就把提炼的技法写入对应风格文档（或新建风格文档：元信息 主义/场景/标签/色板/核心语法/点睛技法），完整成品存档 examples/。今天没有的风格，明天可以长出来——知识库由所有 agent 共同培育，审美下限随库的成长持续提高。

全量图型库（11 个可数单位图型 + 非图表场景迁移 + 图型级细节）见 EDITORIAL.md：${editorialPath} —— 需要更精细的图型/报告模板时再读。
故事装帧见 FRAMING.md：${framingPath}
灵魂手册（先呼吸，再动手）见 BREATH.md：${breathPath}`
}


// （思考门 ThinkingGate 已移除 · v0.6.0 · 结论：DeepSeek v4 忽略 thinking:disabled 且无低档，
//  模型能力边界——详见 CHANGELOG 0.6.0；未来若换支持 effort=off 的模型可参考历史实现恢复。）

/** 开关关闭时注入的降级说明。 */
const DISABLED_TEXT = `（VCP 视觉通感渲染开关当前关闭：消息中的 HTML 将显示为源码。回复请使用普通 Markdown，不要输出 <div> 等 HTML 容器。）`

function apply(ctx) {
  const systemPrompt = ctx.get('systemPrompt')
  const webServer = ctx.get('webServer')
  const settings = ctx.get('settings')
  if (systemPrompt === undefined || webServer === undefined || settings === undefined) return

  /** 插件配置 scope（fontsRoot 可配置；schema 加载失败时降级为默认值、不注册）。 */
  let fontsRoot = DEFAULT_FONTS_ROOT
  void (async () => {
    const schema = await tryLoadConfigSchema()
    if (schema === null) return
    try {
      const scope = settings.register(NS, schema)
      fontsRoot = scope.get().fontsRoot
      scope.watch(() => {
        fontsRoot = scope.get().fontsRoot
      })
    } catch {
      // 配置注册失败不阻断运行（fontsRoot 保持默认值）。
    }
  })()

  /** 当前开关状态：render（渲染）、aesthetic（美学注入），默认关闭；持久化恢复。 */
  let render = false
  let aesthetic = false
  void (async () => {
    try {
      const raw = await fs.readFile(STATE_FILE, 'utf8')
      const st = JSON.parse(raw)
      if (typeof st.render === 'boolean') {
        render = st.render
        aesthetic = st.aesthetic === true
      } else if (st.enabled === true) {
        // 旧版单开关迁移：曾开启即视为「渲染 + 美学」都开（仅一次）
        render = true
        aesthetic = true
      }
    } catch {
      // 无状态文件或损坏：保持默认关闭。
    }
  })()

  /** 更新开关状态并落盘（渲染关闭时美学强制关闭）。 */
  async function setState(r, aes) {
    render = Boolean(r)
    aesthetic = render && Boolean(aes)
    try {
      await fs.mkdir(path.dirname(STATE_FILE), { recursive: true })
      await fs.writeFile(STATE_FILE, JSON.stringify({ render, aesthetic }), 'utf8')
    } catch {
      // 写盘失败不阻断运行（内存状态仍有效）。
    }
  }

  ctx.effect(() => {
    const disposers = []
    disposers.push(
      systemPrompt.section({
        name: 'raw-html:vcp',
        order: 200,
        text: () =>
          render
            ? buildStructuralText(DESIGN_MD) + (aesthetic ? buildAestheticText(fontsRoot, EDITORIAL_MD, FRAMING_MD, BREATH_MD, STYLES_INDEX, STYLES_DIR) : '')
            : DISABLED_TEXT,
      }),
    )

    // --- 字体服务：/fonts/<相对路径> → 字体根目录下的字体文件 -----------------
    disposers.push(
      webServer.register({
        kind: 'prefix',
        path: FONTS_ROUTE,
        handler: async (req, res) => {
          const rawUrl = (req.url ?? '').split('?')[0]
          const prefix = `${FONTS_ROUTE}/`
          if (!rawUrl.startsWith(prefix)) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
            res.end('not found')
            return
          }
          let rel
          try {
            rel = decodeURIComponent(rawUrl.slice(prefix.length))
          } catch {
            res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
            res.end('bad request')
            return
          }
          if (rel.length === 0 || rel.includes('..')) {
            res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
            res.end('forbidden')
            return
          }
          // 双根解析：先外置大库（可配置），再内置精选（随插件分发）。
          const roots = [fontsRoot, BUILTIN_FONTS]
          for (const root of roots) {
            const resolvedRoot = path.resolve(root)
            const file = path.resolve(path.join(resolvedRoot, rel))
            if (!file.startsWith(resolvedRoot)) {
              res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
              res.end('forbidden')
              return
            }
            const ext = path.extname(file).toLowerCase()
            if (FONT_MIME[ext] === undefined) break
            try {
              const data = await fs.readFile(file)
              res.writeHead(200, {
                'Content-Type': FONT_MIME[ext],
                'Content-Length': data.byteLength,
                'Cache-Control': 'public, max-age=86400',
              })
              res.end(data)
              return
            } catch {
              // 当前根未命中，继续尝试下一个根。
            }
          }
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
          res.end('font not found')
        },
      }),
    )

    // --- 前端资源服务：/vendor/<相对路径> → 插件内置 assets/vendor -----------------
    // 服务 KaTeX（katex.min.js/css + 字体），随插件分发、离线可用；只读内置目录，
    // 相对路径含 '..' 一律拒绝（路径穿越防护）。
    disposers.push(
      webServer.register({
        kind: 'prefix',
        path: VENDOR_ROUTE,
        handler: async (req, res) => {
          const rawUrl = (req.url ?? '').split('?')[0]
          const prefix = `${VENDOR_ROUTE}/`
          if (!rawUrl.startsWith(prefix)) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
            res.end('not found')
            return
          }
          let rel
          try {
            rel = decodeURIComponent(rawUrl.slice(prefix.length))
          } catch {
            res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
            res.end('bad request')
            return
          }
          if (rel.length === 0 || rel.includes('..')) {
            res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
            res.end('forbidden')
            return
          }
          const root = path.resolve(BUILTIN_VENDOR)
          const file = path.resolve(path.join(root, rel))
          if (!file.startsWith(root)) {
            res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
            res.end('forbidden')
            return
          }
          const ext = path.extname(file).toLowerCase()
          if (VENDOR_MIME[ext] === undefined) {
            res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
            res.end('forbidden')
            return
          }
          try {
            const data = await fs.readFile(file)
            res.writeHead(200, {
              'Content-Type': VENDOR_MIME[ext],
              'Content-Length': data.byteLength,
              'Cache-Control': 'public, max-age=86400',
            })
            res.end(data)
          } catch {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
            res.end('vendor file not found')
          }
        },
      }),
    )

    return () => {
      for (const dispose of disposers) {
        try {
          dispose()
        } catch {
          // 资源释放失败不阻断其余清理。
        }
      }
    }
  })

  // --- loopback RPC：浏览器半侧的「</>」开关按钮上报状态 ---------------------
  ctx.inject(['connection'], (connectionCtx) => {
    const connection = connectionCtx.connection
    if (connection === undefined || connection.rpc === undefined) return
    connection.rpc.handle(
      RPC_CHANNEL,
      async (endpoint, payload) => {
        switch (endpoint) {
          case 'get-state':
            return okResult({ render, aesthetic, fontsRoot })
          case 'set-state':
            await setState(payload && payload.render, payload && payload.aesthetic)
            return okResult({ render, aesthetic, fontsRoot })
          default:
            return failResult('not-found', `unknown endpoint ${JSON.stringify(endpoint)}`)
        }
      },
      { authority: 'loopback' },
    )
  })
}
//#endregion
export { apply, inject, name }
