/*__DSH_V6_INJECT_START__*/
/**
 * dsh-raw-html v6.18 —— 稳定区固化模块（注入 dsh-web-frontend bundle 用）。
 *
 * v6.17：声明式配色桥接（chromeForProps/applyColorVars/injectRootChrome/makeMathRef）
 *        + 流式锚定锁（anchorLock/anchorUnlock）+ ref 闭包缓存（__vcpRefSetter）。
 * v6.18：__vcpVc/__vcpHp 宿主别名（兼容 rc.8+ 的 Xu/jd/Sd 改名）+ anchorUnlock 环境守卫。
 *
 * 本文件无 import/export，直接以文本形式注入到 bundle 的 vc()/Xu() 定义之前：
 * 依赖 bundle 模块作用域内的 vc / hp / f（React）与全局 window/DOMParser。
 * rc.8+ 前端压缩器改名（vc→Xu、hp→jd/Sd），经 __vcpVc/__vcpHp 别名探测兼容两代。
 * 注入方式见 patch-frontend.cjs 的锚点 C。
 *
 * 核心：VCPChat 式增量渲染的 vdom 轻量版——
 *   - 每帧用轻量 HTML 扫描器把流式内容切成「已闭合块 + 尾巴」
 *   - 已闭合块解析一次并缓存（元素引用跨帧不变 → React 跳过 diff → DOM 不重建 → 动画真循环）
 *   - vcp-root 未闭合期间：内部闭合子块照样固化，容器开标签单独解析并包裹组装
 *   - 每帧只解析新增段；前缀失配（回退/多消息切换）与容器闭合帧走全量兜底
 *
 * 测试：tests/stable.test.mjs 用 node:vm 加载本文件并 stub 依赖后驱动流式帧序列。
 */
;(function () {
  // 无障碍：系统开启「减少动态效果」时，关闭卡片内所有动画/过渡（纯 CSS 降级，不动渲染逻辑）。
  try {
    if (typeof document !== 'undefined' && document.head && !document.getElementById('vcp-reduced-motion')) {
      var _rm = document.createElement('style')
      _rm.id = 'vcp-reduced-motion'
      _rm.textContent = '@media (prefers-reduced-motion: reduce){#vcp-root,[id^="vcp-msg-"],#vcp-root *,[id^="vcp-msg-"] *{animation:none !important;transition:none !important}}'
      document.head.appendChild(_rm)
    }
  } catch (e) {}
  // 宿主函数别名（跨前端代际兼容）：rc.5~rc.7 为 vc/hp；rc.8+ 压缩器改名 Xu/jd（rc.8 为 Sd）。
  // 运行时 typeof 探测——两代 bundle 通用，行为与旧版直接调用完全一致。
  function __vcpVc() {
    var fn = typeof vc === 'function' ? vc : (typeof Xu === 'function' ? Xu : null)
    return fn && fn.apply(null, arguments)
  }
  function __vcpHp(s) {
    var fn = typeof hp === 'function' ? hp : (typeof jd === 'function' ? jd : (typeof Sd === 'function' ? Sd : null))
    return fn ? fn(s) : {}
  }
  var F = window.__vcpFast || (window.__vcpFast = {
    c: new Map(),           // 整串缓存（v → 元素）
    open: null,             // 当前未闭合容器 { raw, end, props, tag }
    openRaw: '',            // 上帧容器开标签源码（props 缓存判据）
    inner: [],              // 容器内已固化块 [{ s, el }]
    outer: [],              // 容器外已固化块 [{ s, el }]
    src: '',                // 全部固化块源码拼接（inner 在前 outer 在后）
    colored: typeof WeakSet !== 'undefined' ? new WeakSet() : null, // 色彩注入幂等（自 B 移植）
    hits: 0, builds: 0, ms: 0, lastLog: 0, last: '', el: null
  })

  var VOID_TAGS = { area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1, input: 1, link: 1, meta: 1, param: 1, source: 1, track: 1, wbr: 1 }
  var RAWTEXT = { script: 1, style: 1 }
  var IMG_RE = /!\[([^\]]*)\]\(([^)]+)\)/g
  var ANIM_RE = /animation:([^;"']*);?/g

  // ---- 具名常量（魔数收拢 · 克莉丝 3.4）----
  var CACHE_MAX = 200                // 整串缓存上限（F.c）
  var LOG_THROTTLE_MS = 2000         // [vcp-stable] 日志节流间隔
  var MERMAID_CACHE_MAX = 30         // mermaid SVG 渲染缓存上限
  var MERMAID_MAX_HEIGHT = '520px'   // mermaid 视图封顶高度
  var MERMAID_RETRY_MS = 200         // mermaid 未生成 SVG 重试间隔
  var KATEX_RETRY_MAX = 30           // KaTeX 未就绪轮询次数上限
  var KATEX_RETRY_MS = 200           // KaTeX 轮询间隔
  var MATH_DEBOUNCE_MS = 600         // 流式公式防抖停顿

  // ---- 工具 ----
  function imgConvert(text) {
    if (text.indexOf('![') === -1) return text
    return text.replace(IMG_RE, function (m, a, u) {
      u = u.trim()
      if (!/^(https?:|data:image\/|\/)/i.test(u)) return m
      return '<img alt="' + (a || '').replace(/"/g, '&quot;') + '" src="' + u.replace(/"/g, '&quot;') + '">'
    })
  }

  function stripOneShotAnim(text) {
    return text.replace(ANIM_RE, function (m, x) { return /infinite/.test(x) ? m : '' })
  }

  // ---- 流式尾巴占位（v6.5 · 方案 B）----
  // DOMParser 会把「未闭合标签」（半标签，如 <circle cx="50"）整体丢弃，
  // 流式中 tail 出现半标签时页面会空窗或泄漏属性文本（观感像卡住/显示代码）。
  // 解决：把 tail 末尾的未闭合标签替换为「绘制中」占位 span；已闭合内容照常
  // 渲染；下一帧标签写完，占位自然消失、真实元素出现。零成本、零闪烁。
  var TAIL_INCOMPLETE_RE = /<[a-zA-Z][a-zA-Z0-9:-]*(?:\s[^>]*)?$/
  var TAIL_PH_TAGS = /^(svg|path|circle|rect|line|polygon|polyline|g|defs|text|animate|animateTransform|animateMotion|use|filter|mask|linearGradient|radialGradient|stop|clipPath|ellipse)$/i
  function tailPlaceholder(text) {
    if (!text || text.indexOf('<') === -1) return text
    var m = TAIL_INCOMPLETE_RE.exec(text)
    if (!m) return text
    var tag = (/^<([a-zA-Z0-9:-]+)/.exec(m[0]) || [])[1] || ''
    var label = TAIL_PH_TAGS.test(tag) ? 'SVG 绘制中…' : '元素绘制中…'
    var ph = '<span class="vcp-tail-ph" style="display:inline-block;background:rgba(64,180,255,.09);border:1px dashed rgba(64,180,255,.45);border-radius:6px;padding:2px 12px;margin:2px;color:rgba(191,233,255,.75);font-size:12px;letter-spacing:1px;vertical-align:middle;">' + label + '</span>'
    return text.slice(0, m.index) + ph
  }

  // 防御：移除 <style> 内容里的空行（CSS 语法不需要空行；避免残留空行引发
  // 解析层面的截断类问题）。仅对「完整闭合的 style」生效。
  function sanitizeStyle(text) {
    if (text.indexOf('<style') === -1) return text
    return text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, function (m) {
      return m.replace(/\n\s*\n/g, '\n')
    })
  }

  // ---- 消息级作用域化（v6.12）：根治「后卡样式污染前卡」----
  // 现象：历史消息的 <style> 永不移除 + 所有消息共用 id="vcp-root" + CSS
  // 层叠「同特异性后写覆盖先写」→ 后一条消息的样式会把前面所有消息染掉。
  // 解法：每条消息的根容器分配唯一 id（vcp-msg-N），并把该消息 <style> 内的
  // #vcp-root 选择器同步替换为 #vcp-msg-N——样式只命中自己的容器，互不串扰。
  // 流式稳定性：同一消息跨帧复用同一 uid（前缀匹配判定），缓存键 v 不抖动，
  // v6 增量缓存/固化块引用不受影响；多消息切换（前缀失配）自动换 uid。
  var scopeLast = null
  var scopeSeq = 0
  function scopeVcp(raw) {
    if (!raw || raw.indexOf('vcp-root') === -1) return raw
    var hasRoot = /<div[^>]*\bid=["']vcp-root["']/i.test(raw)
    if (!hasRoot && raw.indexOf('#vcp-root') === -1) return raw
    var uid
    if (scopeLast && raw.indexOf(scopeLast.raw) === 0) {
      uid = scopeLast.uid
    } else {
      uid = 'vcp-msg-' + (++scopeSeq)
    }
    scopeLast = { raw: raw, uid: uid }
    var out = raw.replace(/(<div[^>]*\bid=)["']vcp-root["']/i, '$1"' + uid + '"')
    if (out.indexOf('#vcp-root') !== -1) {
      out = out.replace(/(<style[^>]*>[\s\S]*?<\/style>)/gi, function (m) {
        return m.replace(/#vcp-root/g, '#' + uid)
      })
    }
    return out
  }

  function resetF() {
    F.open = null; F.openRaw = ''; F.inner = []; F.outer = []; F.src = ''; F.c.clear()
  }

  // ---- 轻量 HTML 标签扫描 ----
  function tagEndAt(str, lt) {
    var q = null, i = lt + 1
    for (; i < str.length; i++) {
      var c = str[i]
      if (q) { if (c === q) q = null; continue }
      if (c === '"' || c === "'") { q = c; continue }
      if (c === '>') return i
    }
    return -1
  }

  // 从 from 起找下一个标签 token；返回 {type,name,start,end} 或 null
  // type: open | close | self | comment | decl | unknown | incomplete
  function nextTag(str, from) {
    var lt = str.indexOf('<', from)
    if (lt === -1) return null
    if (str.slice(lt, lt + 4) === '<!--') {
      var ce = str.indexOf('-->', lt + 4)
      return { type: 'comment', start: lt, end: ce === -1 ? str.length : ce + 3 }
    }
    var c1 = str[lt + 1]
    if (c1 === '!' || c1 === '?') {
      var de = tagEndAt(str, lt)
      return { type: 'decl', start: lt, end: de === -1 ? str.length : de + 1 }
    }
    var te = tagEndAt(str, lt)
    if (te === -1) return { type: 'incomplete', start: lt, end: str.length }
    var raw = str.slice(lt + 1, te)
    var m = /^\/?\s*([a-zA-Z][a-zA-Z0-9:-]*)/.exec(raw)
    if (!m) return { type: 'unknown', start: lt, end: te + 1 }
    var isClose = raw.trim().charCodeAt(0) === 47 // '/'
    return {
      type: isClose ? 'close' : (/\/\s*$/.test(raw) ? 'self' : 'open'),
      name: m[1].toLowerCase(),
      start: lt,
      end: te + 1
    }
  }

  /**
   * 从 start 扫描 str，切出已闭合块与未闭合容器。
   * 两种模式：
   *   inContainer=false（顶层）：只切「顶层完整闭合块」到 outer；
   *     未闭合的最外层结构作为「容器候选」输出到 open（其内部子块留待
   *     状态机以 inContainer 模式固化）；块间出现任何非空内容（文本/注释/
   *     声明/孤儿闭标签）→ 从该处起归 tail（阻止后续固化，保源码顺序）。
   *   inContainer=true（状态机已知容器内部）：只切「容器内闭合子块」到
   *     inner；遇到闭合状态机容器的闭标签 → closed=true；子块间裸文本 → tail。
   * 返回 { open, inner, innerTail, outer, tailStart, closed }
   * 规则：script/style 内容按 rawtext 跳过；void 标签视为自闭合。
   */
  function scan(str, start, inContainer) {
    var out = { open: null, inner: [], innerTail: -1, outer: [], tailStart: start, closed: false }
    var stack = []        // 未闭合 open 标签
    var curStart = -1     // 当前累积块起点（顶层/容器）
    var subStart = -1     // 容器内当前子块起点（仅 inContainer）
    var i = start

    while (i < str.length) {
      var tok = nextTag(str, i)
      if (!tok) break

      // token 之前的裸文本
      if (tok.start > i) {
        if (inContainer) {
          if (subStart === -1) { out.innerTail = i; return out }
        } else {
          if (stack.length === 0) { out.tailStart = i; return out }
        }
        // 块内文本：属于当前块内容，正常继续
      }

      if (tok.type === 'comment' || tok.type === 'decl' || tok.type === 'unknown') {
        // 块间注释/声明 → 归 tail（保顺序）；块内跳过
        if (inContainer) { if (subStart === -1) { out.innerTail = tok.start; return out } }
        else if (stack.length === 0) { out.tailStart = tok.start; return out }
        i = tok.end
        continue
      }
      if (tok.type === 'incomplete') {
        // 流式中开标签未闭合：起点后的内容都算 tail；未闭合容器候选交给循环结束输出
        if (inContainer) { if (subStart === -1) out.innerTail = tok.start; return out }
        if (stack.length === 0) { out.tailStart = tok.start; return out }
        out.innerTail = tok.start
        break
      }

      if (tok.type === 'open' && RAWTEXT[tok.name]) {
        // script/style 原始文本：完整闭合时整个块直接固化；
        // 未闭合时「跳过该标签」继续扫描——绝不把其后内容归 tail，
        // 否则文字里的 <style> 字样（反引号示例）会被误判为真标签并吞掉后续内容。
        var closeIdx = str.toLowerCase().indexOf('</' + tok.name, tok.end)
        if (closeIdx === -1) {
          i = tok.end
          continue
        }
        var ct = nextTag(str, closeIdx)
        var rawEnd = ct ? ct.end : str.length
        if (inContainer) {
          if (subStart === -1) out.inner.push(str.slice(tok.start, rawEnd))
        } else if (stack.length === 0 && curStart === -1) {
          out.outer.push(str.slice(tok.start, rawEnd))
        }
        i = rawEnd
        continue
      }

      if (tok.type === 'open' && VOID_TAGS[tok.name]) { tok.type = 'self' }

      if (tok.type === 'open') {
        if (stack.length === 0) {
          if (curStart === -1) curStart = tok.start
          if (inContainer && subStart === -1) subStart = tok.start
        } else if (inContainer && stack.length === 1 && subStart === -1) {
          subStart = tok.start
        }
        stack.push(tok)
        i = tok.end
        continue
      }

      if (tok.type === 'close') {
        var found = -1
        for (var k = stack.length - 1; k >= 0; k--) if (stack[k].name === tok.name) { found = k; break }
        if (found === -1) {
          // 闭合扫描起点之前的内容（状态机容器收尾 / 顶层孤儿闭标签）→ 剩余全归 tail
          out.closed = inContainer
          out.innerTail = tok.start
          return out
        }
        stack.splice(found)
        if (stack.length === 0) {
          if (inContainer) {
            if (subStart >= 0) { out.inner.push(str.slice(subStart, tok.end)); subStart = -1 }
          } else if (curStart >= 0) {
            out.outer.push(str.slice(curStart, tok.end))
            curStart = -1
          }
        }
        i = tok.end
        continue
      }

      if (tok.type === 'self') {
        if (inContainer) {
          if (stack.length === 0 && subStart === -1) out.inner.push(str.slice(tok.start, tok.end))
        } else if (stack.length === 0 && curStart === -1) {
          out.outer.push(str.slice(tok.start, tok.end))
        }
        i = tok.end
        continue
      }
    }

    if (inContainer) {
      out.open = null
      out.innerTail = subStart >= 0 ? subStart : str.length
    } else if (stack.length > 0) {
      var first = stack[0]
      out.open = { raw: str.slice(first.start, first.end), end: first.end }
      if (out.innerTail === -1) out.innerTail = subStart >= 0 ? subStart : str.length
    } else {
      out.tailStart = curStart >= 0 ? curStart : str.length
    }
    return out
  }

  // ---- 解析 ----
  // 注意：DOMParser 解析「片段」时，<style>/<link> 会被 HTML 解析器放入 head
  // （head 是样式容器，规范行为），body 里取不到——必须把 head 里的样式元素也收集。
  // 顺序：head 样式在前、body 内容在后（与源码顺序一致）。
  // 防御：把「其后没有闭合标签」的 <style>/<script> 开标签转义为文本——
  // 文字里的伪标签字样（反引号示例等）不应被 DOMParser 当真标签吞掉后续内容；
  // 完整闭合的标签（真样式块）不受影响。
  function escapeUnclosedRawtext(html, isTail) {
    return html.replace(/<(style|script)(\s[^>]*)?>/gi, function (m, name) {
      var after = html.slice(html.indexOf(m) + m.length).toLowerCase()
      if (after.indexOf('</' + name.toLowerCase() + '>') === -1) {
        // 未闭合：tail 场景 → 截断（丢弃未闭合标签及其后内容，避免泄漏）；
        // 块场景 → 转义为文本（文字里的伪标签字样原样显示）。
        return isTail ? '\u0000' : '&lt;' + m.slice(1)
      }
      return m
    })
  }

  function parseFrag(html, isTail) {
    if (!html) return null
    html = escapeUnclosedRawtext(html, isTail)
    if (isTail) {
      // 流式 tail：丢弃未闭合的 style/script 及其后所有内容（正在输出，暂不渲染）
      var cut = html.indexOf('\u0000')
      if (cut !== -1) html = html.slice(0, cut)
    }
    // 防认领：给「闭合的 <style>」打 data-plugin 标记——DSH 插件系统会
    // 把页面里「未标记的 style」认领（claimStyles）并在插件热更新时移除
    // （removeOwnedStyles）；用永不冲突的假 id 标记消息自己的 style，避免被误删。
    html = html.replace(/<style(\s[^>]*)?>/gi, '<style$1 data-plugin="vcp-message">')
    var doc = new DOMParser().parseFromString(html, 'text/html')
    var o = []
    var h = doc.head
    if (h) {
      for (var k = 0; k < h.childNodes.length; k++) {
        var hn = h.childNodes[k]
        if (hn.nodeType === 1 && (hn.localName === 'style' || hn.localName === 'link')) o.push(__vcpVc(hn, o.length))
      }
    }
    var b = doc.body
    for (var j = 0; j < b.childNodes.length; j++) o.push(__vcpVc(b.childNodes[j], o.length))
    if (!o.length) return null
    return o.length === 1 ? o[0] : f.jsx(f.Fragment, { children: o })
  }

  // 解析容器开标签 → { tag, props }（复用 vc 的安全过滤，不含 children）
  function parseOpen(raw) {
    try {
      var el = new DOMParser().parseFromString(raw, 'text/html').body.firstChild
      if (!el || el.nodeType !== 1) return null
      var props = {}
      for (var ci = 0; ci < el.attributes.length; ci++) {
        var c = el.attributes[ci]
        if (/^on/i.test(c.name)) continue
        if (c.name === 'style') {
          var sv = c.value
            .replace(/position\s*:\s*fixed\s*;?/gi, '')
            .replace(/z-index\s*:\s*\d{4,}\s*;?/gi, '')
            .replace(/(?<![\w-])content\s*:[^;]*;?/gi, '')
          props.style = __vcpHp(sv)
          // 锁定文字属性优先级：容器开标签里的文字样式不被其他字体/主题插件覆盖
          props.ref = function (el) {
            if (!el) return
            for (var di = 0; di < sv.split(';').length; di++) {
              var decl = sv.split(';')[di]
              var j = decl.indexOf(':')
              if (j === -1) continue
              var p = decl.slice(0, j).trim()
              var val = decl.slice(j + 1).trim()
              if (val && /^(color|font-family|font-size|font-weight|font-style|line-height|letter-spacing|text-align|text-shadow)$/.test(p)) el.style.setProperty(p, val, 'important')
            }
          }
          continue
        }
        if (c.name === 'class') { props.className = c.value; continue }
        if (c.name === 'href' && !/^(https?:|mailto:|\/|#)/i.test(c.value)) continue
        if (c.name === 'src' && !/^(https?:|data:image\/|\/|#)/i.test(c.value)) continue
        props[c.name] = c.value
      }
      return { tag: el.localName, props: props }
    } catch (e) { return null }
  }

  function commit(blocks, list) {
    for (var i = 0; i < blocks.length; i++) {
      var s = blocks[i]
      var el = parseFrag(s)
      if (el) { list.push({ s: s, el: el }); F.src += s }
    }
  }

  function innerLen() {
    var n = 0
    for (var i = 0; i < F.inner.length; i++) n += F.inner[i].s.length
    return n
  }

  function fullRender(v, streaming) {
    resetF()
    var R = parseFrag(v)
    if (R) {
      injectRootChrome(R)
      attachMathRef(R, streaming)
      if (streaming) scheduleMath()
      F.c.set((streaming ? 's:' : 'f:') + v, R)
    }
    return R
  }

  // ---- 主入口 ----
  // 源码层 mermaid 块转换：把已闭合的 <pre class="language-mermaid"><code>…</code></pre>
  // 在进 React 之前转成 <div class="mermaid">…</div>——vdom 与 DOM 结构一致，
  // React 重建时 div.mermaid 保留（不再 pre↔div 冲突 → 根治「图表叠在第一个框体」）；
  // 流式中未闭合的 pre 不转换（等闭合后下一帧转换），流式期间显示代码块。
  var MERMAID_PRE_RE = /<pre([^>]*\blanguage-mermaid[^>]*)>([\s\S]*?)<\/pre>/gi
  function mermaidBlockConvert(text) {
    if (!text || text.indexOf('language-mermaid') === -1) return text
    return text.replace(MERMAID_PRE_RE, function (m, attrs, inner) {
      var src = inner.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '$1')
      src = src.replace(/<code[^>]*>/gi, '').replace(/<\/code>/gi, '')
      return '<div class="mermaid" style="position:relative;display:block;width:100%;box-sizing:border-box;margin:14px 0;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 1px 4px rgba(15,23,42,.06);"><div class="vcp-mermaid-view" style="overflow:auto;max-height:' + MERMAID_MAX_HEIGHT + ';padding:16px 14px;text-align:center;">' + src + '</div></div>'
    })
  }
  function render(raw, streaming) {
    var t0 = typeof performance !== 'undefined' && performance.now ? performance.now() : 0
    var v = sanitizeStyle(imgConvert(scopeVcp(raw || '')))
    if (streaming) v = mathPlaceholder(v, true)
    v = mermaidBlockConvert(v)
    if (!v) return null
    if (!streaming) {
      // 非流式（流式结束后的最终帧 / 历史消息）：直接完整渲染，
      // 清空状态机，避免流式期间残留的残缺状态被复用导致泄漏。
      followStop()
      return fullRender(v, false)
    }
    // 流式：未闭合标签防御——仅当整个 html 连一个 '>' 都没有（首个开标签写到一半）
    // 才不渲染；末尾标签未闭合是流式常态，交给 v6 的 incomplete/tail 增量处理。
    if (v.indexOf('>') === -1) return f.jsx(f.Fragment, { children: [] })
    var key = 's:' + v
    if (F.c.has(key)) { F.hits++; return F.c.get(key) }

    // 状态延续检查：前缀失配（回退 / 多消息切换 / 容器样式重写）→ 重置后全量
    if (F.src !== '' && !v.startsWith((F.open ? F.open.raw : '') + F.src)) {
      return fullRender(v, streaming)
    }

    var r
    var tailFrom
    if (F.open) {
      r = scan(v, F.open.end + innerLen(), true)
      if (r.closed) { return fullRender(v, streaming) } // 容器闭合帧：全量重建（一帧代价，简单可靠）
      commit(r.inner, F.inner)
      tailFrom = r.innerTail >= 0 ? r.innerTail : v.length
    } else {
      r = scan(v, F.src.length, false)
      commit(r.outer, F.outer)
      if (r.open) {
        F.open = r.open
        var o = parseOpen(r.open.raw)
        if (!o) return fullRender(v, streaming) // 容器解析失败兜底
        F.openRaw = r.open.raw
        F.open.tag = o.tag
        F.open.props = o.props
        commit(r.inner, F.inner)
        tailFrom = r.open.end
      } else {
        tailFrom = r.tailStart
      }
    }

    // 尾巴：容器内用 innerTail，顶层用 tailStart；流式中剥一次性动画；
    // 未闭合标签（半标签）替换为「绘制中」占位，避免 DOMParser 丢弃导致空窗
    var tailSrc = v.slice(tailFrom)
    var tailEl = parseFrag(streaming ? tailPlaceholder(stripOneShotAnim(tailSrc)) : tailSrc, true)

    var R
    if (F.open) {
      var kids = []
      for (var i = 0; i < F.inner.length; i++) kids.push(F.inner[i].el)
      if (tailEl) kids.push(tailEl)
      var cProps = Object.assign({}, F.open.props, { children: kids })
      var ch = chromeForProps(F.open.props)
      if (ch) cProps.style = Object.assign({}, cProps.style, ch.vars, ch.base)
      if (!F.open.mathRef) F.open.mathRef = makeMathRef(F.open.props.ref)
      cProps.ref = F.open.mathRef
      R = f.jsx(F.open.tag, cProps)
      var outers = []
      for (var j = 0; j < F.outer.length; j++) outers.push(F.outer[j].el)
      if (outers.length > 0) R = f.jsx(f.Fragment, { children: [R].concat(outers) })
    } else {
      var all = []
      for (var m = 0; m < F.outer.length; m++) all.push(F.outer[m].el)
      if (tailEl) all.push(tailEl)
      R = all.length === 0 ? null : (all.length === 1 ? all[0] : f.jsx(f.Fragment, { children: all }))
    }

    if (R) {
      attachMathRef(R, true)
      scheduleMath()
      ensureStreamingNoFollow()
      F.c.set(key, R)
      if (F.c.size > CACHE_MAX) F.c.clear()
    }
    F.last = v; F.el = R; F.builds++
    if (t0) {
      F.ms += performance.now() - t0
      if (performance.now() - F.lastLog > LOG_THROTTLE_MS) {
        F.lastLog = performance.now()
        console.debug('[vcp-stable] builds=' + F.builds + ' hits=' + F.hits + ' inner=' + F.inner.length + ' outer=' + F.outer.length + ' avg=' + (F.ms / F.builds).toFixed(2) + 'ms')
      }
    }
    return R
  }

  // ---- P3 数学公式（KaTeX）：单美元安全判定 + 渲染 --------------------------
  // 策略同 VCPChat：流式期间不渲染公式（保持原文，避免半成品闪烁），
  // 消息结束后（非流式终帧）挂载时一次性 KaTeX 渲染。
  // 单美元判定规则移植自 VCPChat contentProcessor.js：区分公式与价格/路径/模板字符串。
  function looksLikeSafeSingleDollarMath(content) {
    var t = (content || '').trim()
    if (!t) return false
    var hasExplicitMathSignal = /\\|[\^_=+\-*/<>]|[A-Za-z]\s*\(|\b(?:lim|sum|int|frac|sqrt|text|mathrm|mathbf|alpha|beta|gamma|theta|lambda|mu|sigma|pi|infty)\b/i.test(t)
    var isSimpleNumericMath = /^[+-]?(?:\d+(?:[.,]\d+)*|\.\d+)(?:\s*(?:%|\\%|‰|°))?$/.test(t)
    var isSimpleIdentifierMath = /^[A-Za-z_][A-Za-z0-9_]*$/.test(t)
    // 数字开头且无数学信号 → 价格（$10、$12.5）不放行；$1$、$2^n$ 等明确数学放行。
    if (/^\d/.test(t) && !hasExplicitMathSignal && !isSimpleNumericMath) return false
    // 路径 / 模板表达式 / 表格跨列不放行。
    if (t.charAt(0) === '/') return false
    if (t.charAt(0) === '{' && t.charAt(t.length - 1) === '}') return false
    if (t.indexOf('|') !== -1) return false
    return hasExplicitMathSignal || isSimpleNumericMath || isSimpleIdentifierMath
  }

  // 字符级扫描：把文本中「安全的 $...$」转成 \(...\)。不安全的候选只释放开头 $，
  // 不吞掉后续内容——"$12.5 ... $2.49 ... $\Delta...$" 不会因价格误配跳过后续真公式。
  function convertSafeDollarMath(text) {
    var result = ''
    var index = 0
    while (index < text.length) {
      var openIndex = text.indexOf('$', index)
      if (openIndex === -1) { result += text.slice(index); break }
      result += text.slice(index, openIndex)
      var prev = text.charAt(openIndex - 1)
      var nextOpen = text.charAt(openIndex + 1)
      if (prev === '\\' || prev === '$' || nextOpen === '$' || /\w/.test(prev)) {
        result += '$'; index = openIndex + 1; continue
      }
      var closeIndex = -1
      var cursor = openIndex + 1
      while (cursor < text.length) {
        var dollarIndex = text.indexOf('$', cursor)
        if (dollarIndex === -1) break
        if (text.charAt(dollarIndex - 1) === '\\') { cursor = dollarIndex + 1; continue }
        if (!/\w/.test(text.charAt(dollarIndex + 1))) { closeIndex = dollarIndex; break }
        cursor = dollarIndex + 1
      }
      if (closeIndex === -1) { result += '$'; index = openIndex + 1; continue }
      var content = text.slice(openIndex + 1, closeIndex)
      if (content.length > 1200 || content.indexOf('\n') !== -1 || !looksLikeSafeSingleDollarMath(content)) {
        result += '$'; index = openIndex + 1; continue
      }
      result += '\\(' + content.trim() + '\\)'
      index = closeIndex + 1
    }
    return result
  }

  // 流式公式占位：流式中把已闭合的公式源码（$$..$$ / \[..\] / \(..\)）包成
  // 「浅蓝底 + 斜体 + 公式渲染中」占位 span（源码层替换 → React vdom 一致，
  // 重建不丢）；未闭合的公式保持原文（等写完整再占位）。流结束 processMath
  // 先解占位（unwrap）再 KaTeX 渲染，占位样式不会残留。
  var MATH_PH_RE = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g
  var MATH_PH_HTML = '<span class="vcp-math-ph" style="display:inline-block;background:rgba(64,180,255,.09);border:1px dashed rgba(64,180,255,.45);border-radius:6px;padding:1px 10px;margin:2px;font-style:italic;color:rgba(191,233,255,.85);vertical-align:middle;">$&<span class="vcp-math-ph-badge" style="font-size:10px;color:#7fa8c9;margin-left:8px;white-space:nowrap;">公式渲染中…</span></span>'
  function mathPlaceholder(text, streaming) {
    if (!streaming || !text || text.indexOf('$') === -1 && text.indexOf('\\(') === -1 && text.indexOf('\\[') === -1) return text
    return text.replace(MATH_PH_RE, MATH_PH_HTML)
  }
  // 解占位：unwrap span.vcp-math-ph（移除徽标、把公式源码文本放回原位），
  // 供 auto-render 直接渲染。幂等：无占位时零操作。
  function undecorateMathPlaceholders(root) {
    if (!root || !root.querySelectorAll) return
    try {
      var phs = root.querySelectorAll('span.vcp-math-ph')
      for (var i = phs.length - 1; i >= 0; i--) {
        var ph = phs[i]
        var parent = ph.parentNode
        if (!parent) continue
        var badge = ph.querySelector('.vcp-math-ph-badge')
        if (badge && badge.parentNode === ph) badge.remove()
        while (ph.firstChild) parent.insertBefore(ph.firstChild, ph)
        parent.removeChild(ph)
      }
    } catch (e) { /* 解占位失败不阻断渲染 */ }
  }

  // DOM 层兜底：TreeWalker 扫文本节点（排除 pre/code/script/style/textarea/.katex），
  // 把残留的安全 $...$ 转成 \(...\)（同 VCPChat normalizeSafeSingleDollarMathInTextNodes）。
  // NodeFilter 常量用数字字面量（SHOW_TEXT=4 / FILTER_ACCEPT=1 / FILTER_REJECT=2），
  // 避免依赖 NodeFilter 全局（jsdom vm 与旧环境可能缺失）。
  function normalizeMathTextNodes(root) {
    if (!root || typeof document === 'undefined' || !document.createTreeWalker) return
    try {
      var walker = document.createTreeWalker(root, 4, {
        acceptNode: function (node) {
          var parent = node.parentElement
          if (!parent) return 2
          if (parent.closest && parent.closest('pre, code, script, style, textarea, .katex')) return 2
          return node.nodeValue && node.nodeValue.indexOf('$') !== -1 ? 1 : 2
        }
      })
      var nodes = []
      var node
      while ((node = walker.nextNode())) nodes.push(node)
      for (var i = 0; i < nodes.length; i++) {
        var nv = convertSafeDollarMath(nodes[i].nodeValue)
        if (nv !== nodes[i].nodeValue) nodes[i].nodeValue = nv
      }
    } catch (e) { /* 兜底失败不阻断渲染 */ }
  }

  // KaTeX 渲染：只注册 $$ / \[ / \( —— 故意不注册宽松 $...$（防价格误配，同 VCPChat）。
  function renderMathInContent(container) {
    var fn = window.renderMathInElement
    if (typeof fn !== 'function') return false
    try {
      fn(container, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false }
        ],
        ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
        throwOnError: false
      })
      return true
    } catch (e) { return false }
  }

  // KaTeX 字体映射：根据 span 的 class 推断其应使用的字体（改名版 _VD）。
  // 主题/皮肤插件的全局 `!important` 会覆盖 .katex 的 font-family 声明与
  // \textcolor 的内联 color → 公式 fallback 普通字体 + 颜色全单色（先生实测）。
  // 解法：渲染后对每个 span 用【内联 !important】锁回正确字体/颜色（内联
  // important 是 CSS 优先级天花板，任何样式表规则都无法覆盖）。
  function katexFontFor(cls) {
    if (!cls) return 'KaTeX_Main_VD'
    if (cls.indexOf('mathbb') !== -1 || cls.indexOf('amsrm') !== -1) return 'KaTeX_AMS_VD'
    if (cls.indexOf('mathcal') !== -1) return 'KaTeX_Caligraphic_VD'
    if (cls.indexOf('mathfrak') !== -1) return 'KaTeX_Fraktur_VD'
    if (cls.indexOf('mathscr') !== -1) return 'KaTeX_Script_VD'
    if (cls.indexOf('mathsf') !== -1 || cls.indexOf('textsf') !== -1) return 'KaTeX_SansSerif_VD'
    if (cls.indexOf('mathtt') !== -1 || cls.indexOf('texttt') !== -1) return 'KaTeX_Typewriter_VD'
    if (cls.indexOf('mathnormal') !== -1 || cls.indexOf('mathit') !== -1 || cls.indexOf('textit') !== -1) return 'KaTeX_Math_VD'
    return 'KaTeX_Main_VD'
  }

  // KaTeX 渲染后锁定字体与颜色（抵御主题插件全局 !important 覆盖）。
  // 只处理 HTML span（KaTeX 的 SVG 符号多用 path 矢量，不依赖字体）。
  function lockKatexStyles(container) {
    if (!container || !container.querySelectorAll) return
    try {
      var els = container.querySelectorAll('.katex span')
      for (var i = 0; i < els.length; i++) {
        var el = els[i]
        var cls = el.className || ''
        var font = katexFontFor(cls)
        if (font) el.style.setProperty('font-family', font, 'important')
        var inlineColor = el.style.color
        if (inlineColor) el.style.setProperty('color', inlineColor, 'important')
      }
    } catch (e) { /* 锁定失败不阻断渲染 */ }
  }

  // ---- Mermaid 图表（VCP 卡片内 language-mermaid 代码块 → SVG）----------
  // 对齐 KaTeX 模式：流式防抖触发 processMath 时一并渲染；mermaid 未就绪轮询重试。
  // 检测 <pre><code class="language-mermaid">…</code></pre>（模型在 vcp-root 内输出
  // HTML 形态代码块）或 <pre class="language-mermaid"> 或 .mermaid 元素。
  // 渲染失败回退为代码块（保留源码可读），不闪错误。
  function mermaidFixSmartChars(code) {
    return (code || '').replace(/[—–－]/g, '--')
  }
  // Mermaid 主题配置（白底高级蓝灰 · 低饱和淡色），预热与首次渲染共用
  var MERMAID_THEME = {
    startOnLoad: false,
    theme: 'base',
    themeVariables: {
      fontFamily: 'PingFang SC, Microsoft YaHei, Segoe UI, sans-serif',
      fontSize: '13px',
      primaryColor: '#f4f8fc',
      primaryTextColor: '#1e293b',
      primaryBorderColor: '#94a3b8',
      lineColor: '#475569',
      textColor: '#1e293b',
      secondaryColor: '#f5f0fa',
      tertiaryColor: '#f0f4f8',
      clusterBkg: '#f8fafc',
      clusterBorder: '#cbd5e1',
      edgeLabelBackground: '#ffffff',
      actorBkg: '#e8f0f8',
      actorBorder: '#94a3b8',
      actorTextColor: '#1e293b',
      actorLineColor: '#94a3b8',
      signalColor: '#475569',
      signalTextColor: '#1e293b',
      labelBoxBkgColor: '#e2e8f0',
      labelBoxBorderColor: '#94a3b8',
      labelTextColor: '#1e293b',
      taskBkgColor: '#dbeafe',
      taskBorderColor: '#60a5fa',
      taskTextColor: '#0f172a',
      taskTextOutsideColor: '#475569',
      activeTaskBkgColor: '#93c5fd',
      activeTaskBorderColor: '#3b82f6',
      doneTaskBkgColor: '#e2e8f0',
      doneTaskBorderColor: '#94a3b8',
      sectionBkgColor: '#f0f4f8',
      sectionTextColor: '#334155'
    }
  }
  // 引擎预热：client.js 加载 mermaid.min.js 完成后调用，提前 initialize（引擎内部
  // 解析器/渲染器就绪），首次图表渲染省去初始化时间（首图更快出现）
  function warmupMermaid() {
    if (typeof window.mermaid !== 'object' || window.__mermaidInitialized) return
    try {
      window.mermaid.initialize(MERMAID_THEME)
      window.__mermaidInitialized = true
    } catch (e) { /* 预热失败不阻断，首次渲染时再初始化 */ }
  }
  // 图表缩放工具栏 + 拖拽平移（双层结构）：
  //   div.mermaid（外层，position:relative，不滚动）→ 控制条挂这里，永不动
  //   div.vcp-mermaid-view（内层，overflow:auto + max-height）→ 图表滚动/拖拽在这层
  // el 参数 = vcp-mermaid-view（滚动容器）；外层 = el.parentNode
  function enhanceMermaid(el) {
    if (!el || el.dataset.vcpMermaidEnhanced === 'true') return
    var outer = el.parentNode
    if (!outer) return
    var svg = el.querySelector('svg')
    if (!svg || svg.dataset.vcpMermaidScaled === 'true') return
    el.dataset.vcpMermaidEnhanced = 'true'
    var rect = svg.getBoundingClientRect ? svg.getBoundingClientRect() : null
    // 原始尺寸优先取 viewBox（SVG 设计尺寸），布局缩放的基础
    var vb = (svg.getAttribute('viewBox') || '').split(/\s+/)
    var rawW = (vb.length === 4 ? parseFloat(vb[2]) : 0) || (rect && rect.width) || 400
    var rawH = (vb.length === 4 ? parseFloat(vb[3]) : 0) || (rect && rect.height) || 300
    var state = { scale: 1 }
    // 控制条挂【外层】（不滚动容器）→ 图表内容滚动/拖拽时控制条纹丝不动
    var tb = document.createElement('div')
    tb.className = 'vcp-mermaid-toolbar'
    tb.style.cssText = 'position:absolute;top:6px;right:8px;z-index:5;display:flex;gap:4px;align-items:center;background:rgba(255,255,255,.94);border:1px solid #e2e8f0;border-radius:8px;padding:3px;box-shadow:0 1px 3px rgba(15,23,42,.08);'
    tb.style.position = 'absolute' // jsdom cssstyle 解析长 cssText 兜底
    var bstyle = 'min-width:30px;height:26px;padding:0 8px;border:1px solid #cbd5e1;border-radius:6px;background:#ffffff;color:#475569;cursor:pointer;font-size:13px;line-height:1;font-family:Consolas,monospace;'
    // 匹配窗口缩放值（宽高同时适配，基于内层 viewport 尺寸）
    var fitScale = function () {
      var cw = el.clientWidth - 24
      var ch = (el.clientHeight || 400) - 60
      var s = 1
      if (cw > 40 && rawW > 40) s = Math.min(s, cw / rawW)
      if (ch > 40 && rawH > 40) s = Math.min(s, ch / rawH)
      return Math.max(0.2, +(s).toFixed(2))
    }
    // 百分比按钮：实时显示当前缩放（如 62%），点击还原 100%
    var pctBtn
    var apply = function () {
      // 用真实 width/height 缩放（布局尺寸变化 → 内层可滚动 → 拖拽/滚动查看溢出部分）
      svg.style.width = Math.max(1, Math.round(rawW * state.scale)) + 'px'
      svg.style.height = Math.max(1, Math.round(rawH * state.scale)) + 'px'
      svg.style.maxWidth = 'none'
      if (pctBtn) {
        pctBtn.textContent = Math.round(state.scale * 100) + '%'
        pctBtn.title = '当前 ' + Math.round(state.scale * 100) + '%，点击还原 100%'
      }
    }
    var mkBtn = function (label, title, fn) {
      var b = document.createElement('button')
      b.type = 'button'
      b.textContent = label
      b.title = title
      b.style.cssText = bstyle
      b.addEventListener('click', fn)
      return b
    }
    tb.appendChild(mkBtn('−', '缩小', function () { state.scale = Math.max(0.3, +(state.scale - 0.2).toFixed(2)); apply() }))
    pctBtn = mkBtn('100%', '原始大小', function () { state.scale = 1; apply() })
    tb.appendChild(pctBtn)
    tb.appendChild(mkBtn('＋', '放大', function () { state.scale = Math.min(4, +(state.scale + 0.2).toFixed(2)); apply() }))
    tb.appendChild(mkBtn('适应', '匹配窗口（宽高最佳）', function () { state.scale = fitScale(); apply() }))
    // 默认适应窗口：渲染完成即按窗口缩放，用户按需自行缩放/还原
    state.scale = fitScale()
    apply()
    outer.appendChild(tb)
    // 小手拖拽平移：绑定内层滚动容器（el），工具栏区域不触发。
    // 用 pointer 事件 + setPointerCapture 挂在 el 自身（不再挂 document）——
    // el 随 React 重建被移除时监听器一并回收，长会话不累积（修复全局监听器泄漏）。
    el.style.cursor = 'grab'
    el.style.touchAction = 'none'
    var pan = { on: false, x0: 0, y0: 0, sl0: 0, st0: 0 }
    el.addEventListener('pointerdown', function (e) {
      if (e.target && e.target.closest && e.target.closest('.vcp-mermaid-toolbar')) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      pan.on = true
      pan.x0 = e.clientX
      pan.y0 = e.clientY
      pan.sl0 = el.scrollLeft
      pan.st0 = el.scrollTop
      el.style.cursor = 'grabbing'
      if (el.setPointerCapture) { try { el.setPointerCapture(e.pointerId) } catch (err) {} }
      if (e.preventDefault) e.preventDefault()
    })
    el.addEventListener('pointermove', function (e) {
      if (!pan.on) return
      el.scrollLeft = pan.sl0 - (e.clientX - pan.x0)
      el.scrollTop = pan.st0 - (e.clientY - pan.y0)
    })
    function endPan() { pan.on = false; el.style.cursor = 'grab' }
    el.addEventListener('pointerup', endPan)
    el.addEventListener('pointercancel', endPan)
  }
  function renderMermaidInContent(container) {
    if (!container || !container.querySelectorAll) return false
    if (typeof window.mermaid !== 'object' || typeof window.mermaid.run !== 'function') return false
    try {
      var blocks = container.querySelectorAll('pre.language-mermaid, pre > code.language-mermaid, div.mermaid')
      var pres = []
      var seen = []
      for (var i = 0; i < blocks.length; i++) {
        var b = blocks[i]
        // div.mermaid：已是目标形态（源码层转换或历史消息），升级/确保双层结构
        if (b.tagName === 'DIV' && b.className.indexOf('mermaid') !== -1) {
          // done=已渲染、pending=渲染中 → 都跳过（标记在 view 上，兼容旧单层查外层）
          var v0 = b.querySelector(':scope > .vcp-mermaid-view')
          var busy = v0
            ? (v0.dataset.vcpMermaidDone === 'true' || v0.dataset.vcpMermaidPending === 'true')
            : (b.dataset.vcpMermaidDone === 'true' || b.dataset.vcpMermaidPending === 'true')
          if (busy) continue
          if (!b.isConnected) continue
          if (seen.indexOf(b) !== -1) continue
          seen.push(b)
          // 外层固定（控制条挂这层，不滚动）；内层 viewport 滚动
          b.style.position = 'relative'
          b.style.overflow = 'visible'
          b.style.maxHeight = 'none'
          var view = b.querySelector(':scope > .vcp-mermaid-view')
          if (!view) {
            view = document.createElement('div')
            view.className = 'vcp-mermaid-view'
            view.style.cssText = 'overflow:auto;max-height:' + MERMAID_MAX_HEIGHT + ';padding:16px 14px;text-align:center;'
            while (b.firstChild) view.appendChild(b.firstChild)
            b.appendChild(view)
          }
          // SVG 渲染缓存：同一源码已渲染过 → 直接 innerHTML 恢复（跳过 mermaid.run
          // 重解析——流式中 React 重建反复触发时第二次起秒出，不再卡）
          var cacheSrc = (view.textContent || '').trim()
          var cache = window.__vcpMermaidCache || (window.__vcpMermaidCache = {})
          if (cacheSrc && cache[cacheSrc]) {
            view.innerHTML = cache[cacheSrc]
            view.dataset.vcpMermaidDone = 'true'
            enhanceMermaid(view)
            continue
          }
          pres.push(view)
          continue
        }
        var pre = b.tagName === 'PRE' ? b : b.parentNode
        if (!pre || pre.dataset.vcpMermaidDone === 'true') continue
        // pre 已被 React 重置/移除 → 跳过（下轮重建后再处理）
        if (!pre.isConnected || !pre.parentNode) continue
        if (seen.indexOf(pre) !== -1) continue
        seen.push(pre)
        var codeEl = pre.querySelector('code') || pre
        var src = mermaidFixSmartChars(codeEl.textContent || '')
        if (!src.trim()) continue
        // 双层结构：外层 div.mermaid（固定，控制条挂这里）+ 内层 view（滚动）
        var div = document.createElement('div')
        div.className = 'mermaid'
        div.style.cssText = 'position:relative;display:block;width:100%;box-sizing:border-box;margin:14px 0;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 1px 4px rgba(15,23,42,.06);'
        div.style.position = 'relative'
        var view = document.createElement('div')
        view.className = 'vcp-mermaid-view'
        view.style.cssText = 'overflow:auto;max-height:' + MERMAID_MAX_HEIGHT + ';padding:16px 14px;text-align:center;'
        view.textContent = src
        div.appendChild(view)
        if (pre.parentNode) pre.parentNode.replaceChild(div, pre)
        pres.push(view)
      }
      if (pres.length === 0) return false
      if (!window.__mermaidInitialized) {
        // 白底高级蓝灰主题（见 MERMAID_THEME 常量）；预热已完成时直接跳过
        window.mermaid.initialize(MERMAID_THEME)
        window.__mermaidInitialized = true
      }
      for (var j = 0; j < pres.length; j++) {
        ;(function (el) {
          try {
            el.dataset.vcpMermaidPending = 'true'
            // 布局让位：setTimeout(0) 让 React commit 完成、浏览器布局就绪后再 run
            // （sequence/gantt 渲染依赖容器几何，紧贴 React 提交时可能测量异常）
            // SVG 未生成则清锁重试（自愈）
            var runMermaid = function () {
              if (el.isConnected === false) { el.dataset.vcpMermaidPending = ''; return }
              var cacheSrc = (el.textContent || '').trim()
              window.mermaid.run({ nodes: [el] }).then(function () {
                el.dataset.vcpMermaidPending = ''
                if (el.isConnected === false) return
                var svg = el.querySelector('svg')
                if (!svg) { setTimeout(runMermaid, MERMAID_RETRY_MS); return }
                el.dataset.vcpMermaidDone = 'true'
                // SVG 自适应：撑满容器宽度、按 viewBox 等比缩放、居中
                if (svg) {
                  svg.style.maxWidth = '100%'
                  svg.style.height = 'auto'
                  svg.style.display = 'block'
                  svg.style.margin = '0 auto'
                }
                // 渲染结果缓存：源码 → SVG HTML（流式中 React 重建后直接恢复，免重解析）
                if (cacheSrc) {
                  var cache = window.__vcpMermaidCache || (window.__vcpMermaidCache = {})
                  var ck = Object.keys(cache)
                  if (ck.length > MERMAID_CACHE_MAX) {
                    cache = {}
                    window.__vcpMermaidCache = cache
                  }
                  cache[cacheSrc] = el.innerHTML
                }
                // 缩放工具栏（- / 100% / + / 适应）
                enhanceMermaid(el)
              }).catch(function (err) {
                el.dataset.vcpMermaidPending = ''
                console.debug('[vcp-mermaid] 渲染失败，回退源码:', err && err.message)
                var pre2 = document.createElement('pre')
                pre2.className = 'language-mermaid'
                var code2 = document.createElement('code')
                code2.className = 'language-mermaid'
                code2.textContent = el.textContent || ''
                pre2.appendChild(code2)
                if (el.parentNode) el.parentNode.replaceChild(pre2, el)
              })
            }
            setTimeout(runMermaid, 0)
          } catch (e) { console.debug('[vcp-mermaid] run 异常:', e && e.message) }
        })(pres[j])
      }
      return true
    } catch (e) { return false }
  }

  // 幂等入口：单容器处理一次；KaTeX 未就绪时轮询重试（本地资源加载很快，上限 ~6 秒）。
  function processMath(container) {
    if (!container || container.nodeType !== 1) return
    if (container.dataset.vcpMathDone === 'true') return
    var katexReady = typeof window.katex === 'object' && typeof window.renderMathInElement === 'function'
    var mermaidReady = typeof window.mermaid === 'object' && typeof window.mermaid.run === 'function'
    if (!katexReady) {
      // KaTeX 未就绪 → 轮询重试（mermaid 就绪与否不阻塞 KaTeX 渲染）
      var tries = parseInt(container.dataset.vcpMathTries || '0', 10) + 1
      container.dataset.vcpMathTries = String(tries)
      if (tries <= KATEX_RETRY_MAX && container.isConnected !== false) {
        setTimeout(function () { processMath(container) }, KATEX_RETRY_MS)
      }
      return
    }
    try {
      undecorateMathPlaceholders(container)
      normalizeMathTextNodes(container)
      renderMathInContent(container)
      lockKatexStyles(container)
      if (mermaidReady) renderMermaidInContent(container)
    } catch (e) { /* 渲染异常保留原文 */ }
    container.dataset.vcpMathDone = 'true'
  }

  // 流式防抖：DSH 流式结束从不发 streaming=false 帧（实测 45 帧全 true），
  // 只能用「流式停顿」判定结束。每次流式 render 帧重置计时器，停顿 600ms 后
  // 对最近挂载的容器 DOM 跑一次 KaTeX（幂等；未闭合公式会被 auto-render 忽略）。
  var lastMathEl = null
  var mathTimer = null
  function scheduleMath() {
    if (mathTimer) clearTimeout(mathTimer)
    mathTimer = setTimeout(function () {
      if (lastMathEl && lastMathEl.isConnected !== false && window.__vcpMath) {
        window.__vcpMath.processMath(lastMathEl)
      }
      followStop()
    }, MATH_DEBOUNCE_MS)
  }

  // ---- VCP 色彩引擎：data-vcp-* → --vcp-* CSS 变量（自 B 移植 · 克莉丝 2026-08-24）----
  // 引擎（assets/vendor/VCPColorEngine.js）由 client.js 经 /vendor 加载，挂 window.VCPColorEngine。
  // 模型只写声明（data-vcp-preset / data-vcp-soul / data-vcp-accent），hex 由引擎确定性生成
  // ——流式重建结果恒定、对比度/色域闭环保证。变量注入走 style 对象或 el.style.setProperty，
  // 统一只写 hex（引擎 generate() 已做 sRGB 色域裁剪，无需 oklch 二次映射）。
  function chromeForProps(props) {
    if (!props || typeof props !== 'object') return null
    if ('__vcpChrome' in props) return props.__vcpChrome
    var wants = props['data-vcp-preset'] || props['data-vcp-movement'] || props['data-vcp-soul'] || props['data-vcp-accent'] || props['data-vcp-mode']
    if (!wants) { props.__vcpChrome = null; return null }
    var engine = window.__vcpColor || window.VCPColorEngine
    if (!engine || typeof engine.generate !== 'function') return null // 引擎未就绪：不缓存，下帧重试
    try {
      var opts = {}
      if (props['data-vcp-preset']) opts.movement = props['data-vcp-preset']
      else if (props['data-vcp-movement']) opts.movement = props['data-vcp-movement']
      if (props['data-vcp-mode']) opts.mode = props['data-vcp-mode']
      if (props['data-vcp-soul']) {
        var sp = props['data-vcp-soul'].split(',')
        var s0 = parseFloat(sp[0]); if (!isNaN(s0)) opts.thermalSoul = s0
        var s1 = parseFloat(sp[1]); if (!isNaN(s1)) opts.valence = s1
        var s2 = parseFloat(sp[2]); if (!isNaN(s2)) opts.arousal = s2
        var s3 = parseFloat(sp[3]); if (!isNaN(s3)) opts.entropy = s3
      }
      if (props['data-vcp-accent']) {
        if (props['data-vcp-accent'].charAt(0) === '#') opts.accentHex = props['data-vcp-accent']
        else opts.accentHue = parseFloat(props['data-vcp-accent'])
      }
      var pal = engine.generate(opts)
      var hex = pal.hex || {}
      var vars = {}
      for (var k in hex) {
        if (!Object.prototype.hasOwnProperty.call(hex, k)) continue
        vars['--vcp-' + k.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase() })] = hex[k]
      }
      var st = props.style || null
      var has = function (p) { return !!(st && st[p]) }
      var base = {}
      if (!has('background') && !has('backgroundColor')) base.background = 'var(--vcp-base)'
      if (!has('color')) base.color = 'var(--vcp-text-primary)'
      if (!has('padding') && !has('paddingTop') && !has('paddingLeft')) base.padding = '20px'
      if (!has('borderRadius')) base.borderRadius = '16px'
      if (!has('border') && !has('borderColor')) base.border = '1px solid var(--vcp-border)'
      if (!has('boxSizing')) base.boxSizing = 'border-box'
      if (!has('fontFamily')) base.fontFamily = "ui-sans-serif,system-ui,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif"
      if (!has('lineHeight')) base.lineHeight = '1.6'
      if (!has('display')) base.display = 'block'
      if (!has('width')) base.width = '100%'
      props.__vcpChrome = { vars: vars, base: base }
      return props.__vcpChrome
    } catch (e) { return null }
  }

  // DOM 层幂等注入（挂载 ref 触发）：dataset 声明 → --vcp-* + 基座；引擎未就绪时
  // 清标记返回，下帧重试。数据声明（data-vcp-*）用后即删，DOM 保持干净。
  function applyColorVars(el) {
    if (!el || el.nodeType !== 1 || !el.dataset) return
    if (F.colored && F.colored.has(el)) return
    if (el.dataset.vcpColorDone === 'true') return
    var ds = el.dataset
    var wants = ds.vcpPreset || ds.vcpMovement || ds.vcpSoul || ds.vcpAccent
    if (!wants) return
    el.dataset.vcpColorDone = 'true'
    var engine = window.__vcpColor || window.VCPColorEngine
    if (!engine || typeof engine.generate !== 'function') { el.dataset.vcpColorDone = ''; return }
    try {
      var opts2 = {}
      if (ds.vcpPreset) opts2.movement = ds.vcpPreset
      else if (ds.vcpMovement) opts2.movement = ds.vcpMovement
      if (ds.vcpMode) opts2.mode = ds.vcpMode
      if (ds.vcpSoul) {
        var sp2 = ds.vcpSoul.split(',')
        var t0 = parseFloat(sp2[0]); if (!isNaN(t0)) opts2.thermalSoul = t0
        var t1 = parseFloat(sp2[1]); if (!isNaN(t1)) opts2.valence = t1
        var t2 = parseFloat(sp2[2]); if (!isNaN(t2)) opts2.arousal = t2
        var t3 = parseFloat(sp2[3]); if (!isNaN(t3)) opts2.entropy = t3
      }
      if (ds.vcpAccent) {
        if (ds.vcpAccent.charAt(0) === '#') opts2.accentHex = ds.vcpAccent
        else opts2.accentHue = parseFloat(ds.vcpAccent)
      }
      var pal = engine.generate(opts2)
      if (F.colored) F.colored.add(el)
      var hex = pal.hex || {}
      for (var k in hex) {
        if (!Object.prototype.hasOwnProperty.call(hex, k)) continue
        var kebab = k.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase() })
        el.style.setProperty('--vcp-' + kebab, hex[k])
      }
      try {
        var bs = el.style
        var has2 = function (p) { return !!(bs.getPropertyValue(p) || '') }
        if (!has2('background') && !has2('background-color')) bs.setProperty('background', 'var(--vcp-base)')
        if (!has2('color')) bs.setProperty('color', 'var(--vcp-text-primary)')
        if (!has2('padding') && !has2('padding-top') && !has2('padding-left')) bs.setProperty('padding', '20px')
        if (!has2('border-radius')) bs.setProperty('border-radius', '16px')
        if (!has2('border') && !has2('border-color')) bs.setProperty('border', '1px solid var(--vcp-border)')
        if (!has2('box-sizing')) bs.setProperty('box-sizing', 'border-box')
        if (!has2('font-family')) bs.setProperty('font-family', "ui-sans-serif,system-ui,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif")
        if (!has2('line-height')) bs.setProperty('line-height', '1.6')
        if (!has2('display')) bs.setProperty('display', 'block')
        if (!has2('width')) bs.setProperty('width', '100%')
      } catch (e) { /* 基座补齐失败不影响 */ }
      try {
        delete el.dataset.vcpPreset
        delete el.dataset.vcpMovement
        delete el.dataset.vcpSoul
        delete el.dataset.vcpMode
        delete el.dataset.vcpAccent
        delete el.dataset.vcpColorDone
      } catch (e) { /* dataset 清理失败不影响 */ }
    } catch (e) { /* 颜色注入失败不影响渲染 */ }
  }

  // 全量路径根容器基座：fullRender（流式切片/历史/终帧）给带 data-vcp-* 的根容器
  // 注入 --vcp-* 变量与卡片基座——背景从第一帧就在场。
  function injectRootChrome(R) {
    if (!R || typeof R !== 'object') return
    var el = R
    if (el.type === f.Fragment && el.props && Array.isArray(el.props.children) && el.props.children.length) {
      el = el.props.children[0]
    }
    if (!el || typeof el !== 'object' || !el.props) return
    var ch = chromeForProps(el.props)
    if (!ch) return
    try { el.props.style = Object.assign({}, el.props.style, ch.vars, ch.base) } catch (e) { /* 注入失败不影响 */ }
  }

  // 流式容器 ref（自 B 移植）：挂载时一次性注入色彩变量并登记数学处理目标。
  // 闭包缓存在 F.open.mathRef 上跨帧复用——容器 jsx 每帧重建，但 ref 身份必须稳定，
  // 否则 React 每帧 old(null)/new(el) 重新调用 → 每帧 setProperty('important') 风暴。
  function makeMathRef(oldRef) {
    var mr = function (el) {
      if (oldRef) oldRef(el)
      if (el && el.nodeType === 1) {
        applyColorVars(el)
        if (window.__vcpMath) lastMathEl = el
      }
    }
    mr.__vcpMathRef = true
    return mr
  }

  // ---- 流式期间禁用自动下滚（自 B 移植 · 全局锚定锁，CSS-only）----------------
  // 抖动的最小公因数是「流式期间视口每帧移动」：浏览器原生锚定（overflow-anchor）
  // 在内容增长时强制贴底，视口一动就与 fill-box 动画叠加而闪；视口静止则几乎零抖动。
  // 流式期间注入 `html,body,html *{overflow-anchor:none!important}` 强制关闭原生锚定，
  // 停顿 600ms（scheduleMath 防抖）后移除，行为恢复原样。普通 Markdown 流式不经
  // render()，不受影响。（B 的 scrollTop setter 劫持版追踪器因属性遮蔽泄漏风险未移植，
  // 留待需要时再上——锚定锁已覆盖绝大多数场景。）
  var NFS = { lockEl: null }
  function anchorLock() {
    if (NFS.lockEl || typeof document === 'undefined' || !document.head) return
    var st = document.createElement('style')
    st.id = 'vcp-anchor-lock'
    st.setAttribute('data-plugin', 'vcp-render')
    st.textContent = 'html,body,html *{overflow-anchor:none!important}'
    document.head.appendChild(st)
    NFS.lockEl = st
    try { document.documentElement.style.overflowAnchor = 'none' } catch (e) {}
    if (document.body) { try { document.body.style.overflowAnchor = 'none' } catch (e) {} }
  }
  function anchorUnlock() {
    var st = NFS.lockEl
    if (st && st.parentNode) st.parentNode.removeChild(st)
    NFS.lockEl = null
    if (typeof document === 'undefined') return
    try { document.documentElement.style.overflowAnchor = '' } catch (e) {}
    if (document.body) { try { document.body.style.overflowAnchor = '' } catch (e) {} }
  }
  function ensureStreamingNoFollow() {
    if (NFS.lockEl || typeof document === 'undefined') return
    anchorLock()
  }
  function followStop() {
    anchorUnlock()
  }

  // 给 React 元素树顶层元素挂「挂载后处理」ref。
  // 非流式：挂载时立即 KaTeX 渲染；流式：记录最近挂载的容器（交给 scheduleMath 防抖）。
  // 【关键】React 18 的 createElement/jsx 会把 props.ref 提取到元素的【顶层 ref 字段】，
  // 所以这里必须写 node.ref 而非 node.props.ref（否则 ref 不生效、processMath 永不触发）。
  // 兼容测试 stub（{tag,props,children}，ref 在 props.ref）用 'ref' in node 区分。
  function attachMathRef(node, streaming) {
    if (!node || typeof node !== 'object') return
    var isEl = (node.type && node.type !== f.Fragment) || !!node.tag
    if (isEl) {
      var curRef = ('ref' in node ? node.ref : (node.props && node.props.ref)) || null
      if (curRef && curRef.__vcpMathRef) return
      var cached = node.__vcpRefSetter
      if (!cached) {
        cached = node.__vcpRefSetter = function (el) {
          if (curRef) curRef(el)
          if (el && el.nodeType === 1) {
            applyColorVars(el)
            if (window.__vcpMath) {
              if (streaming) {
                lastMathEl = el
              } else {
                window.__vcpMath.processMath(el)
              }
            }
          }
        }
        cached.__vcpMathRef = true
      }
      if ('ref' in node) node.ref = cached
      else node.props.ref = cached
      return
    }
    var ch = node.props && node.props.children
    if (Array.isArray(ch)) { for (var i = 0; i < ch.length; i++) attachMathRef(ch[i], streaming) }
    else if (ch && typeof ch === 'object') attachMathRef(ch, streaming)
  }

  window.__vcpMath = {
    looksLikeSafeSingleDollarMath: looksLikeSafeSingleDollarMath,
    convertSafeDollarMath: convertSafeDollarMath,
    mathPlaceholder: mathPlaceholder,
    undecorateMathPlaceholders: undecorateMathPlaceholders,
    mermaidBlockConvert: mermaidBlockConvert,
    normalizeMathTextNodes: normalizeMathTextNodes,
    renderMathInContent: renderMathInContent,
    mermaidFixSmartChars: mermaidFixSmartChars,
    warmupMermaid: warmupMermaid,
    renderMermaidInContent: renderMermaidInContent,
    enhanceMermaid: enhanceMermaid,
    processMath: processMath,
    katexFontFor: katexFontFor,
    lockKatexStyles: lockKatexStyles,
    applyColorVars: applyColorVars,
    chromeForProps: chromeForProps
  }

  window.__vcpStable = { render: render }
})()
/*__DSH_V6_INJECT_END__*/
