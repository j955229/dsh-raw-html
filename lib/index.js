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
本 GUI 支持消息 HTML 渲染。回复时把全部内容包在单个 <div id="vcp-root" style="..."> 里，用 HTML5/CSS3/SVG 构建契合语境的视觉界面（理性/代码→终端风蓝灰；情感/文学→纸质衬线；警告/错误→高对比警示）。

【三条铁律 · 违背必出 bug】
1. vcp-root 内禁止空行（连续两个换行）——markdown 会把卡片拆成多个节点、背景只包顶部一条、内容溢出；子元素用单个换行或单行排列。<style> 内同样禁止空行（否则 @keyframes 丢失、CSS 泄漏为文本）。
2. 禁用 backdrop-filter（大容器高度塌陷）；子背景用实色多层渐变模拟玻璃感。
3. 交互只放行 onclick="input('...')"；不写 <script>/外链脚本；样式选择器限定在 #vcp-root 内。

【排版底线】关键排版属性（text-indent/font-size/letter-spacing 等）写内联 style（<style> 只放 @font-face 与 @keyframes）；文字-背景对比 ≥ 4.5:1；同一帖主色 ≤ 2 个 + 中性色；正文系统无衬线、中文段落首行缩进 2em；克制：视觉层 ≤ 约 200 行、动效每轮至多 2 个。先观察界面明暗再定基底（浅色界面勿用深色卡）；场景色板参考 DESIGN.md 1.3 节（勿趋同单一色板）。

【能力速览 · 细节按需读文件】
- 数学：$$...$$ / \\[...\\] / \\(...\\)；单美元 $...$ 仅明确数学表达式时渲染（价格/路径不误判）。
- 图表：<pre class="language-mermaid">…</pre>，自动白底蓝灰 + 缩放工具栏（classDef 分色见 VCP-INTERACTIONS.md 第 7 节）。
- 交互：<details> 折叠、radio/checkbox 选项卡、CSS 轮播、onclick 按钮。
- 字体：内置 7 款开源字体（文楷/马善政楷书/思源黑/英文花体等），@font-face 引用 /fonts/Lanxi-*.woff2，必须 !important 且选择器 #vcp-root 前缀；搭配清单见 DESIGN.md。
- 图片：::表情名:: 或 <img src="...">。
- SVG：一律作为 vcp-root 子元素，禁止顶层 <svg>（流式会显示源码）。

完整设计规范（字体清单/色板/中文排版/自检）见 DESIGN.md：${designPath}
故事装帧（SVG 顶栏封面）见 FRAMING.md：${framingPath}
交互示例（折叠/选项卡/轮播/按钮）见 VCP-INTERACTIONS.md（与 DESIGN.md 同目录）`

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
