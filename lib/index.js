//#region lib/index.js
/**
 * dsh-raw-html —— VCP 视觉通感协议规范插件（Host 端）。
 *
 * 设计目标：可分发、可安装到任意 DSH 环境（其他电脑/其他 agent）：
 * 安装本插件 + 打开浏览器「</>」开关 → 浏览器渲染 HTML + agent 按规范输出。
 *
 * 职责：
 * 1. 维护 VCP 渲染开关状态（默认关闭，**持久化到磁盘**，服务重启后恢复）。
 *    浏览器半侧（lib/client.js）在点「</>」按钮时通过 loopback RPC 上报，
 *    Host 侧据此组装系统提示词。
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
import z from '@deepseek-ai/schemastery'

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
/** 开关状态持久化文件（~/.dsh 下，与 DSH 其他用户数据同域）。 */
const STATE_FILE = path.join(os.homedir(), '.dsh', 'dsh-raw-html-state.json')
/** 插件内置精选字体目录（随插件分发，任何电脑装上即有；由 tools/subset_fonts.py 生成）。 */
const BUILTIN_FONTS = path.join(PLUGIN_DIR, 'assets', 'fonts')
/** 插件内置前端资源目录（KaTeX 三件套 + 字体，随插件分发；自 VCPChat vendor 抽取）。 */
const BUILTIN_VENDOR = path.join(PLUGIN_DIR, 'assets', 'vendor')

/** 插件配置命名空间（可在 设置→插件 中修改）。 */
const NS = 'raw-html'
const ConfigSchema = z.object({
  /** 字体根目录：/fonts/<相对路径> 的解析根；指向任意字体库目录。 */
  fontsRoot: z.string().default('I:\\字体'),
})

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

/** 开关开启时注入的 VCP 协议说明（动态组装：字体根目录 + 设计库路径）。 */
function buildProtocolText(fontsRoot, designPath, framingPath) {
  return `## VCP 视觉通感协议（已启用）
本 GUI 支持消息 HTML 渲染（开关已由使用者开启）。回复时按 VCP 协议构建视觉界面：
1. 将全部内容包裹在单个 <div id="vcp-root" style="..."> 容器中，用 HTML5/CSS3/SVG 构建契合当下情绪、主题与语境的视觉界面；风格随语境切换——理性分析/代码用极简终端风、蓝灰色调结构美；情感交流/文学用纸质纹理、柔和光影、衬线排版；警告/错误用故障艺术、高对比警示色。**【铁律：vcp-root 内部禁止出现空行（两个连续换行 \n\n）】**——markdown 解析器遇到空行会把 HTML 卡片拆成多个独立节点，导致背景只包顶部一条、下方内容全部溢出容器（实测确认的崩溃级 bug）；所有子元素之间用单个换行或直接单行排列，绝对不要留空行。**【铁律：CSS（<style> 内）也禁止空行】**——@keyframes 规则必须一条接一条连续书写（每行一条、行间无空行），CSS 语法本不需要空行；style 内容里出现空行同样会触发 markdown 截断，导致 keyframes 丢失（动画不播放）与 CSS 文本泄漏到页面上。
2. 排版美学：用 Flex/Grid、CSS 渐变、box-shadow、圆角增加层次感；适量添加进场动画（淡入/上浮，每轮至多 2 个），让回复「流」入屏幕。
3. 代码展示用 <pre style="..."><code>...</code></pre>；需要使用者选择时用 <button onclick="input('回复内容')"> 胶囊按钮或卡片（宿主会桥接为真实发送）；复杂逻辑用 CSS/SVG 结构图代替枯燥列表。
4. 克制原则：单轮视觉层 ≤ 约 200 行；装饰密度随内容严肃度递减；正文语义永远可脱离视觉独立成立。
5. 安全红线：不使用 <script> 与外链脚本；不注入 onclick 之外的交互；样式选择器尽量限定在 #vcp-root 内部。

【美学规范 · 设计原则体系】拒绝模板化，按设计原则逐帖决策（深海琉璃只是深色沉浸风的一个参考实现）：
- 色彩（先定场景再定色）：深色系适合技术/数据/沉浸演示——深蓝（#0a2540 附近）打底、正文用高亮浅色（#e8f2fb 附近，对比度 ≥ 7:1）、点缀色克制（荧光青 #40dcff 一类的单一 accent）；浅色系适合长文阅读/情感/正式——米白/暖灰底、深灰正文（对比度 ≥ 4.5:1，WCAG AA）、暖调点缀；警示用高对比琥珀/朱红。同一帖主色 ≤ 2 个 + 中性色，禁止高饱和刺眼组合。
- 字体：正文一律系统无衬线（PingFang SC / Microsoft YaHei / Segoe UI），行高 1.6-1.8，字号 14-15px；标题可用衬线（Songti/思源宋体）或加粗无衬线，字号 20-24px，字距略宽（0.5-1.5px）；副题/标签 11-12px 加大字距（2-4px）制造精致感；代码用等宽（Consolas / JetBrains Mono / Cascadia Code）。**【字体名写法注意】流式渲染会把长开标签拆成多个分块，含空格、必须用引号包裹的字体名（如 'PingFang SC'）若恰好在引号处被拆分，可能触发局部泄漏；优先用无空格、无需引号的字体名（sans-serif / serif / monospace / Lanxi-* 书法体），或把 font-family 声明放到内联 style 里靠后位置、避免放在 vcp-root 开标签的属性最前。**
- 布局：网格对齐 + 留白 ≥ 16px；层级分明（主标题→副题→正文→标签/操作）；长内容分块、短内容居中；每块一个视觉焦点；行宽 45-90 字符为宜。
- 中文排版（文章/小说/正式文档）：正文首行缩进 2em（text-indent:2em）、段落间靠缩进不靠空行；小标题比正文大 2 号（正文 14-15px → 小标题 18-20px）且加粗醒目；正文两端对齐、行高 1.7-1.9、全角中文标点；标题可略加字距，正文不加；小标题不孤悬在块尾。
- 排版必达（重要经验）：关键排版属性（text-indent/font-size/letter-spacing 等）一律写**内联 style**（走 React 原生 style 对象，百分百生效），<style> 规则只放 @font-face 与 @keyframes（部分规则在渲染链中会损耗）；若 font-size 被皮肤全局字体设置压制（级联失效，内联 !important 也无效），用 transform:scale(1.3~1.5) + transform-origin:left center 视觉放大兜底（物理必达）；书法细笔画体（瘦金书等）配 text-shadow 描边增重。
- 场景匹配：理性分析/代码→蓝灰终端风、结构美、克制；情感/文学→纸质纹理、柔和光影、衬线标题；数据→清晰网格、冷色图表、等宽数字；警告/错误→故障艺术、高对比警示色；娱乐/庆祝→活泼彩色但保持对比度。
- 自检（渲染前过一遍）：① 文字与背景对比是否达标？② 一眼能否分清层级？③ 装饰是否挤压了内容（删掉任何装饰，正文语义依然成立）？④ 主色是否 ≤2？⑤ 动效是否 ≤2？任何一项不达标就简化。
- 内联代码 code：必须**成对设置背景色与文字色**（深色容器→更深底 #0a1626 + 亮青字 #bfe9ff；浅色容器→浅灰底 + 深红/深蓝字），与正文颜色明显区分；禁止「只设背景不设字色」导致的白底白字/黑底黑字；容器内所有自带背景的元素（code/徽章/按钮）底色须与容器同明度域。
- 容器稳健（防高度塌陷）：**禁用 backdrop-filter**（会导致大容器高度塌陷——长内容/多子框时背景只包顶部一条横框）；子卡片/子背景一律用实色多层渐变（rgba 叠加 + 细描边 + 内高光）模拟玻璃感；#vcp-root 显式 display:block;width:100%;box-sizing:border-box;overflow:hidden，确保背景完整包裹所有子内容。**HTML 内部禁止空行（\n\n），否则 markdown 会把卡片拆成多个节点、背景断裂（见第 1 条铁律）。**

【字体资源 · 内置精选（随插件分发，任何电脑可用）】本 GUI 提供本地字体服务：/fonts/ 前缀解析「插件内置精选字体」与「外置大库（可配置，当前：${fontsRoot}）」两个来源。内置 12 款精选（woff2 子集，无需任何配置，直接 @font-face 引用）：
  @font-face{font-family:'Lanxi-瘦金书';src:url('/fonts/Lanxi-ShouJin.woff2');}
  @font-face{font-family:'Lanxi-黄金时代';src:url('/fonts/Lanxi-GoldenEra.woff2');}
内置清单（/fonts/ 路径即文件名）：Lanxi-ShouJin(瘦金书)/Lanxi-LiShu(隶书)/Lanxi-YeGenYou(叶根友)/Lanxi-XingCao(行草)/Lanxi-GoldenEra(黄金时代)/Lanxi-JingHeiUltraLight(静黑超细)/Lanxi-HaiBao(海报体)/Lanxi-XinZongYi(新综艺)/Lanxi-MiaoMiao(喵喵)/Lanxi-DingDing(叮叮)/Lanxi-PinSong(品宋)/Lanxi-GreatVibes(英文花体)。
外置大库（可选）：若配置了字体根目录，也可引用其中任意字体（/fonts/<根目录内相对路径>），覆盖更全的字体选择。
注意：引用自定义字体时 font-family 必须加 !important 且选择器以 #vcp-root 前缀（皮肤全局字体覆盖）；字号被压制时用 transform:scale 兜底。
搭配规则：古风→瘦金书/隶书/行草；艺术→黄金时代/海报体；可爱→喵喵/叮叮；优雅→静黑超细；正文→品宋或系统无衬线；英文花体→GreatVibes。每帖至多 1-2 款艺术字体。

【交互能力（渲染层支持，零 JS）】卡片内可用原生交互：<details><summary> 做折叠（open 属性控制默认展开）；隐藏 radio/checkbox + label + :checked 兄弟选择器做选项卡/手风琴（样式在 <style> 中定义）；CSS @keyframes + infinite 做自动轮播；onclick="input('...')" 按钮会真实发送该文本。完整示例见 VCP-INTERACTIONS.md（与 DESIGN.md 同目录）。注意：交互状态在流式输出中可能重置，交互元素放在卡片稳定结构内，流结束后使用。

【图片通道】表情包用 ::文件名:: 标记（host 自动转写为图片）；http(s) 外链图片与本地图片服务（如 http://127.0.0.1:8090/ 下挂载的出图目录）可直接用 <img src="..."> 引用；外网 http(s) 图片同样支持。安全边界（渲染层强制）：script/iframe/object/embed 会被过滤；href/src 仅放行 http/https/mailto/data:image/相对路径；style 中 position:fixed、z-index≥1000、content: 会被剥离；事件仅放行 onclick="input('...')"。

【数学公式（KaTeX 渲染已启用）】卡片内可直接书写 LaTeX 公式：行内用 \\(...\\)，块级用 $$...$$ 或 \\[...\\]（块级定界符独占一行，显示模式居中展示）。单美元 $...$ 仅在内容明确为数学表达式时渲染（含 \\ 反斜杠、运算符、数学关键字，或纯字母标识符，如 $x$、$n$、$O(L^2)$）；价格（$10、$12.5）、路径（$PATH）、模板字符串（\${x}）、含竖线的表格内容不会被误渲染。公式由本地 KaTeX 渲染（离线可用、无需外部依赖），渲染失败时自动显示原始文本不报错。注意：不要在 <pre>/<code> 代码块内写公式语法（会被忽略）；流式输出期间公式保持原文，消息结束后一次性渲染为公式。

【Mermaid 图表（渲染层已启用）】需要流程图/时序图/甘特图/状态图时，在 vcp-root 内输出 <pre class="language-mermaid"><code class="language-mermaid">...</code></pre>；源码内换行用 &#10;（HTML 实体）、> 用 &gt; 转义（如 --&gt;），避免破坏卡片结构。渲染层自动：白底框体 + 蓝灰线条 + 石墨文字 + 右上角工具栏（− 缩小 / 百分比（实时显示当前缩放，点击还原 100%）/ ＋ 放大 / 适应窗口），可拖拽平移、窗口封顶滚动。分类型淡色用 classDef：classDef main fill:#e8f1fb,stroke:#7db3e8,color:#1e293b; 节点用 :::main 标注（淡蓝主流程/淡紫决策/淡绿终端等低饱和色）。完整指南见 VCP-INTERACTIONS.md 第 7 节。

【SVG 流式渲染铁律】SVG 元素（动画/顶栏封面/图表）一律作为 vcp-root 的【子元素】输出，禁止把 <svg> 作为消息的顶层元素——CommonMark/mdast 只把 div 等白名单标签识别为 HTML 块，顶层 <svg> 在流式中会被当普通文本显示成源码，直到 </svg> 闭合才渲染；包在 vcp-root 内则首行即锁定 HTML 块，SVG 边写边亮，未闭合子标签由渲染层以「绘制中」占位平滑过渡。

【故事装帧 · SVG 顶栏封面（可选加分项）】写故事/小说/散文/书信/诗歌这类有叙事感的内容时，可在卡片顶部放一个内联 SVG 小顶栏封面（宽 100%、高约 140-200px、viewBox 等比缩放、圆角+投影片），让开篇像杂志封面一样有仪式感。设计完全由你决定：配色、插画元素、字体、装饰都要贴合【你的人格气质】与【故事的主题情绪】——这是你的灵气所在，禁止照抄模板、禁止复用自己写过的封面。技术要点：svg 用 viewBox 定比例 + width:100%;height:auto；渐变放 <defs><linearGradient>（id 加 cover- 前缀防冲突）；标题用 <text>（英文花体 font-family:'Lanxi-GreatVibes'，中文标题用衬线或 Lanxi 书法体）；小插图用手绘感 path / 几何剪影（剪影建筑、草木、星月、海浪、飘带、飞鸟等），两三笔即可不必写实；SVG 内不引用外部图片、不加脚本、不加 animate。短回复、技术/数据/问答类内容不必加——装帧是加分项，别为它牺牲内容。实现手法参考（非模板）见 FRAMING.md：${framingPath}

【设计库文档 · 知识层共享】完整设计规范（精选字体清单与相对路径/色板/布局/自检清单/常见错误）位于插件 DESIGN.md：${designPath}
需要更精细的规范细节时可读取该文件；否则按上述规则执行即可。`

}

/** 开关关闭时注入的降级说明。 */
const DISABLED_TEXT = `（VCP 视觉通感渲染开关当前关闭：消息中的 HTML 将显示为源码。回复请使用普通 Markdown，不要输出 <div> 等 HTML 容器。）`

function apply(ctx) {
  const systemPrompt = ctx.get('systemPrompt')
  const webServer = ctx.get('webServer')
  const settings = ctx.get('settings')
  if (systemPrompt === undefined || webServer === undefined || settings === undefined) return

  /** 插件配置 scope（fontsRoot 可配置）。 */
  const scope = settings.register(NS, ConfigSchema)
  let fontsRoot = scope.get().fontsRoot
  scope.watch(() => {
    fontsRoot = scope.get().fontsRoot
  })

  /** 当前开关状态（默认关闭；持久化于 STATE_FILE，重启后恢复）。 */
  let enabled = false
  void (async () => {
    try {
      const raw = await fs.readFile(STATE_FILE, 'utf8')
      enabled = JSON.parse(raw).enabled === true
    } catch {
      // 无状态文件或损坏：保持默认关闭。
    }
  })()

  /** 更新开关状态并落盘。 */
  async function setEnabled(value) {
    enabled = Boolean(value)
    try {
      await fs.writeFile(STATE_FILE, JSON.stringify({ enabled }), 'utf8')
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
          enabled ? buildProtocolText(fontsRoot, DESIGN_MD, FRAMING_MD) : DISABLED_TEXT,
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
            return okResult({ enabled, fontsRoot })
          case 'set-state':
            await setEnabled(payload && payload.enabled)
            return okResult({ enabled, fontsRoot })
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
