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
 *  语义：让 AI 主动做视觉通感表达，并给出「怎么画才不崩、才安全、才流式稳定」的结构铁律。 */
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

【心流纪律 · 想好即写】（常驻 · 对所有回复生效）
- 不列备选/弃案，想好直接写定稿；不为选择写论证或自我解释。
- 思考阶段只构思方向与结构，不写出代码、正文或情节段落——可复用的句子一律不进思考；代码与文字只在最终输出出现一次。
- 视觉卡片/图表/装帧任务：直接输出裸 HTML（不要用 \`\`\` 围栏、不要缩进、不要加语言标记），不调用任何工具、不进规划、不询问确认。
- 写作任务（故事/小说/散文/诗歌）：构思只定「人物 / 冲突 / 反转」三点即落笔，不在思考里写草稿、改稿、数字数、逐版自我否定；正文只写一次。

【安全铁律 · 违背必出 bug】（写时内化，不必逐条核对）
1. vcp-root 内禁止空行（连续两个换行）；<style> 内同样禁止空行。
2. 禁用 backdrop-filter；子背景用实色多层渐变模拟玻璃感。
3. 交互只放行 onclick="input('...')"；不写 <script>/外链脚本；样式选择器限定在 #vcp-root 内。
4. 根容器与任何设宽容器必须写 box-sizing:border-box——width:100% 或固定宽再加 padding，缺了它必溢出出框。

【流式稳定 · 必守 · 防抖动】（写时内化，不必逐条核对）
- 入场动画只用 opacity 淡入，禁用 transform 位移与 animation-delay 错峰；流式卡片尽量不带动画，让内容「安静地长出来」。
- 禁止 flex-wrap: wrap（流式会剧烈重排）；用 grid 定列或固定布局，别让元素「挤上去—掉下来」。
- 禁止 margin: 0 auto 居中（流式宽度渐长会左右横跳）；用固定宽度或 text-align: center + display: inline-block。
- SVG 必须带 width / height + viewBox 并放卡片靠后，避免尺寸未定反复重算。
- SVG 元素做 transform 动画必须声明 transform-box:fill-box + transform-origin（缺了会错位/不可见）。
- 用过的类（.foot、button 等）必须在 <style> 定义，禁止「顾头不顾尾」导致无样式。
- CSS 总量 ≤ 约 200 行、类选择器 ≤ 12 个；<style> 写在 #vcp-root 开标签之后、内容之前（样式先就位，内容带样式流式长出，背景不会最后才闪现）；用过的类必须定义；能用简写不拆长串。
- HTML 语境中的表情/图片用 <img src="...">，不用 Markdown ![]() 语法（HTML 里不解析）。

【能力速览 · 细节按需读文件】
- 数学（$$...$$）、图表（language-mermaid）、交互（details/选项卡/轮播/onclick）、图片（<img>）、SVG（仅作 vcp-root 子元素）均可用。
- 代码展示用 <pre><code>...</code></pre> 结构（HTML 容器里不解析 Markdown 代码块），代码块背景与字色成对设置；代码内的尖括号必须转义——< 写 &lt;、> 写 &gt;（反面：代码里写裸 <div> 会被解析成真标签、布局错乱；渲染器能自动修正未闭合/错误嵌套/孤儿标签等结构错误，但无法识别「合法标签样」的代码文本，这一条必须由你转义）。

完整技术规范（字体/中文排版/安全铁律/文档地图）见 DESIGN.md：${designPath}`
}

/** 美学层协议：aesthetic 开启时额外注入的「skill 工具包」（让输出更好看的语法库）。 */
function buildAestheticText(fontsRoot, editorialPath, framingPath, breathPath) {
  return `【VCP 美学 skill 工具包（已启用）】
以下是让视觉表达「更好看」的语法库，做视觉表达时主动运用：

【先呼吸，再动手】动笔前不查规则，先感受这段对话——它像什么材质（信纸/黑板/墨入水/终端）？什么光（晨光/烛光/屏幕光）？你想让读到的人是什么心绪（安心/惊叹/共鸣/行动）？从感受出发选风格，从心绪出发定结构。规则是保底，不是牢笼——守好安全铁律，其余跟随直觉。

【编辑美学 · 直接照做】（这是让卡片区别于普通 AI 输出的关键，做视觉时主动套用，别用 AI 默认的紫蓝渐变玻璃模板）
1.【四色系】同一份交付只锁一套，别混搭：Mono=纸 #F0EFEB/炭黑 #1C1C1A/7 级灰阶 #1C1C1A→#D8D7D1（明度即数据，保底、类目>6）；porcelain 青瓷蓝=底 #F7F2EB/墨 #081F5C/数据 #334EAC→#7096D1→#BAD6EB→#D0E3FF/强调用最深 #081F5C（有序单序列）；palm 椰林绿=底 #F0EFEB/墨 #58402E/数据 #43593B/#77835A/#ACAD79/强调琥珀 #D4A017（无序类目≤4）；wire 编辑部红=底 #F0F0EE/墨 #1F1E1C/灰阶 #DBDAD3→#22211F/强调荧光橙 #F5572F（每卡只给一个元素，新闻杂志）。人话映射：蓝/冷/学术/理性→porcelain；绿/暖/自然/莫兰迪→palm；黑白/克制/杂志→wire；没提颜色→按数据语义；不明→Mono。
2.【卡片四件套】任何卡片骨架：badge 小标签（虚线圆角胶囊）→ h2 结论式标题 → sub 副标题·图例·时间（·分隔）→ 图/主体 → src 来源行。圆角 24px、无边框无阴影靠留白分卡、卡间 gap 18-22px；标题字重 700（大标题 800）、图内数值一律 800；来源行 9.5px 全大写 letter-spacing:.08em。
3.【明度即层级】最重要=最深（最黑/最蓝/最绿），次要按阶梯递减；暗卡反转（最重要=最亮）且每屏最多 1 张暗卡；全卡只允许一个强调色主角；实心材质不透明不发光无阴影。
4.【视觉词汇库】数据少≠图难看——把聚合数摊回可数单位（1格=1人/1%）：Rung Bars 可数梯子（1横档=1单位）、Tick Rows 刻度环（1 tick=1%）、Dot Waffle 点阵（1点=1%，饼图默认替代）、Hairline Line 发丝折线（1天=1点，0.5-0.7px）、Diverging Bar 分歧条（0轴为界）。面积/半径用 Math.sqrt(v) 不许拿数值直接当半径；柱状图永不断轴；演示数据用确定性伪随机 rnd(i,k)=abs(((i*73856093)^(k*19349663))%1000)/1000 禁用 Math.random()。
5.【动效】快进快停 quarticOut 不弹跳；点阵 stagger 8-15ms/个、条形 80-130ms/根；滚入视野才播+点击重播；必须带 prefers-reduced-motion 降级。

【底线 · 保底不丑】默认基调浅纸底+墨色+明度即层级（lieflat）；深蓝黑底+发光字 AI 老模板禁用——禁的是「深蓝黑+发光字」这一种老模板；深底在恐怖/暗黑/沉浸文学可用，但须带语境质感（暗红褐做旧、旧档案、羊皮纸），不是纯黑发光；代码终端可用纯深底。中文正文首行缩进 2em、正文用系统无衬线；动效至多 2 个。声明式配色可免写 hex：根容器 data-vcp-preset="editorial|chiaroscuro|fauvism|cyberpunk|wabi_sabi"（可选 data-vcp-mode="dark|light"）自动生成整套 --vcp-* 色板变量（对比度/色域由引擎闭环保证），自定义见 DESIGN.md §1.5。

全量图型库（11 个可数单位图型 + 非图表场景迁移 + 图型级细节）见 EDITORIAL.md：${editorialPath} —— 需要更精细的图型/报告模板时再读。
故事装帧见 FRAMING.md：${framingPath}
灵魂手册（先呼吸，再动手）见 BREATH.md：${breathPath}`
}


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
            ? buildStructuralText(DESIGN_MD) + (aesthetic ? buildAestheticText(fontsRoot, EDITORIAL_MD, FRAMING_MD, BREATH_MD) : '')
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
