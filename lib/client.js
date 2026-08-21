/**
 * dsh-raw-html —— VCP 视觉通感协议支持（浏览器半侧）。
 *
 * 职责：
 * 1. 在 composer 尾部工具栏（发送按钮旁）注入「</>」开关按钮：
 *    控制 localStorage['dsh.rawHtml']（前端渲染补丁读取同一键，见
 *    patch/patch-frontend.cjs）。开启后消息中的 HTML 被渲染为真实界面
 *    （VCP 协议）；关闭时维持原有行为（HTML 显示为转义源码）。
 * 2. 注入 window.__dshInput(text)：VCP 按钮 onclick="input('...')"
 *    经渲染补丁桥接到这里，把文本填入输入框并发送。
 *
 * 本文件为手工维护的 __ModuleLoader__.load bundle（与 dsh-maid-emoji
 * 约定一致），不含 JSX；修改后执行 `node --check lib/client.js` 验证语法，
 * 刷新页面即生效。
 */
window.__ModuleLoader__.load({
  id: 'dsh-raw-html',
  factory: function (require) {
    var module = { exports: {} }
    var exports = module.exports

    var STORAGE_KEY = 'dsh.rawHtml'
    var BTN_ID = 'dsh-raw-html-toggle'
    /** Host 侧 RPC 调用器（可空）：按钮切换时上报开关状态，驱动系统提示词注入。 */
    var hostRpc = null

    // ---- 状态 ------------------------------------------------------------

    function isEnabled() {
      try {
        return window.localStorage.getItem(STORAGE_KEY) === '1'
      } catch (e) {
        return false
      }
    }

    function setEnabled(on) {
      try {
        window.localStorage.setItem(STORAGE_KEY, on ? '1' : '0')
      } catch (e) {}
    }

    // ---- DOM 定位（官方 data-* 标记，与 maid-atelier 皮肤同源）-------------

    function findComposer() {
      return document.querySelector('[data-composer-card]')
    }

    /** 尾部工具栏（发送按钮所在容器），找不到时回退到首行 / 卡片本身。 */
    function findTrailing(composer) {
      if (!composer) return null
      var t = composer.querySelector('[class*="trailing"]')
      if (t) return t
      var row = composer.querySelector(':scope > [class*="row"]')
      return row || composer
    }

    function findTextarea(composer) {
      if (!composer) return null
      return composer.querySelector('textarea') || composer.querySelector('[contenteditable="true"]')
    }

    function findSendButton(composer) {
      if (!composer) return null
      var primary = composer.querySelector('button[class*="primary"]')
      if (primary) return primary
      var btns = composer.querySelectorAll('button')
      for (var i = 0; i < btns.length; i++) {
        var aria = btns[i].getAttribute('aria-label') || ''
        if (/send|发送|submit/i.test(aria)) return btns[i]
      }
      return null
    }

    // ---- window.__dshInput：VCP 按钮 → 真实发送 ---------------------------

    /** 用原生 value setter 绕过 React 受控组件，再触发 input 事件。 */
    function setTextareaValue(ta, text) {
      var proto = ta.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
      var setter = Object.getOwnPropertyDescriptor(proto, 'value').set
      setter.call(ta, text)
      ta.dispatchEvent(new window.Event('input', { bubbles: true }))
    }

    function clickSend(composer) {
      var btn = findSendButton(composer)
      if (btn && !btn.disabled) {
        btn.click()
        return true
      }
      return false
    }

    /** 填入输入框并轮询点击发送（等待 React 状态同步后按钮解除 disabled）。 */
    function sendText(text) {
      var composer = findComposer()
      var ta = findTextarea(composer)
      if (!ta) {
        if (window.alert) window.alert('[dsh-raw-html] 未找到输入框，无法发送')
        return false
      }
      setTextareaValue(ta, String(text))
      var tries = 0
      var timer = window.setInterval(function () {
        tries += 1
        if (clickSend(composer) || tries > 20) window.clearInterval(timer)
      }, 100)
      return true
    }

    // ---- 「</>」开关按钮 --------------------------------------------------

    var STYLE_OFF =
      'display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 10px;' +
      'border:1px solid rgba(64,180,255,.45);border-radius:999px;' +
      'background:rgba(64,180,255,.08);color:#6fa8cc;font-size:12px;' +
      'font-family:inherit;cursor:pointer;white-space:nowrap;margin:0 6px;' +
      'transition:all .15s ease;'
    var STYLE_ON =
      'display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 10px;' +
      'border:1px solid rgba(64,220,255,.8);border-radius:999px;' +
      'background:linear-gradient(120deg,rgba(64,180,255,.35),rgba(64,220,255,.18));' +
      'color:#eaf8ff;font-size:12px;font-family:inherit;cursor:pointer;' +
      'white-space:nowrap;margin:0 6px;font-weight:600;' +
      'box-shadow:0 0 12px rgba(64,220,255,.35);transition:all .15s ease;'

    function createButton() {
      var btn = document.createElement('button')
      btn.id = BTN_ID
      btn.type = 'button'
      btn.setAttribute('aria-pressed', isEnabled() ? 'true' : 'false')
      btn.title = 'VCP 视觉通感渲染开关：开启后消息中的 HTML 将被渲染为界面；新消息即时生效，历史消息刷新页面后按新状态重渲染'
      btn.textContent = isEnabled() ? '</> ON' : '</> OFF'
      btn.style.cssText = isEnabled() ? STYLE_ON : STYLE_OFF
      btn.addEventListener('click', function () {
        var on = !isEnabled()
        setEnabled(on)
        btn.setAttribute('aria-pressed', on ? 'true' : 'false')
        btn.textContent = on ? '</> ON' : '</> OFF'
        btn.style.cssText = on ? STYLE_ON : STYLE_OFF
        syncHostState(hostRpc, on)
        window.dispatchEvent(new window.CustomEvent('dsh-raw-html-toggle', { detail: { enabled: on } }))
      })
      return btn
    }

    function ensureButton() {
      if (document.getElementById(BTN_ID)) return true
      var composer = findComposer()
      if (!composer) return false
      var host = findTrailing(composer)
      if (!host) return false
      host.appendChild(createButton())
      return true
    }

    // ---- Host 状态同步（驱动系统提示词里的 VCP 协议注入）-------------------

    function makeHostRpc(ctx) {
      try {
        var connection = (ctx && (ctx.get ? ctx.get('connection') : undefined)) || (ctx && ctx.connection)
        if (connection && connection.rpc && connection.rpc.call) {
          return connection.rpc.call.bind(connection.rpc)
        }
      } catch (e) {}
      return null
    }

    function syncHostState(rpc, enabled) {
      if (!rpc) return
      try {
        rpc('/dsh-raw-html', 'set-state', { enabled: enabled }).catch(function () {})
      } catch (e) {}
    }

    // ---- KaTeX 数学公式：自备全套（改名 CSS 防与 DSH 冲突）-------------------
    // DSH 前端内置 KaTeX（0.16.x）但为【延迟加载】：消息渲染（终帧挂载）时可能
    // 未就绪——JS 缺失则公式不渲染，或 CSS/字体未注册则公式 fallback 成普通字体
    // （先生实测「无报错但字体都是普通字体」的根因）。因此自备：
    //   - katex.min.js + auto-render.min.js：保证 window.katex / renderMathInElement 可用
    //   - katex-vd.css：katex.min.css 的【字体名全部加 _VD 后缀】（font-family 改名、
    //     url 文件名保留）→ 与 DSH 自带的 KaTeX_* 字体名【零冲突】，字体匹配唯一确定
    // 实测（puppeteer + 真实 Edge，v14/v15）：改名 CSS + 自备 JS → /vendor 字体 200
    // 加载、document.fonts.check('26px KaTeX_Main_VD')=true，黑板体/花体/哥特体/手写体
    // 全部正常；而注入原版 katex.min.css 会与 DSH 的 @font-face 同名冲突 → 公式
    // fallback 普通字体（v8 诊断证实：移除后 check 变 true）。
    // 生成方式：node 对 katex.min.css 做 (?<![\w/])KaTeX_[A-Za-z0-9]+ → $&_VD。

    function loadScriptOnce(id, src, onLoad) {
      var existing = document.getElementById(id)
      if (existing) {
        if (onLoad) onLoad()
        return
      }
      var s = document.createElement('script')
      s.id = id
      s.src = src
      s.async = true
      s.onload = function () { if (onLoad) onLoad() }
      document.head.appendChild(s)
    }

    function ensureMathAssets() {
      if (document.getElementById('dsh-raw-html-math-css')) return
      var css = document.createElement('link')
      css.id = 'dsh-raw-html-math-css'
      css.rel = 'stylesheet'
      css.href = '/vendor/katex-vd.css'
      document.head.appendChild(css)
      loadScriptOnce('dsh-raw-html-math-katex', '/vendor/katex.min.js', function () {
        loadScriptOnce('dsh-raw-html-math-autorender', '/vendor/auto-render.min.js', null)
      })
    }

    // Mermaid 图表引擎（VCP 卡片内 language-mermaid 代码块 → SVG）
    // 独立加载（不依赖 KaTeX 链）；本地 /vendor 资源秒加载，mermaid 未就绪时
    // 渲染层 processMath 轮询重试（同 KaTeX 模式）。
    // 加载完成后调用渲染层 warmupMermaid()：提前 initialize 引擎，首次图表
    // 渲染省去初始化时间（首图更快出现）。
    function ensureMermaidAssets() {
      loadScriptOnce('dsh-raw-html-mermaid', '/vendor/mermaid.min.js', function () {
        if (window.__vcpMath && typeof window.__vcpMath.warmupMermaid === 'function') {
          try { window.__vcpMath.warmupMermaid() } catch (e) { /* 预热失败不阻断 */ }
        }
      })
    }

    // ---- 应用 ------------------------------------------------------------

    function apply(ctx) {
      // 暴露 input 桥（渲染补丁的 onclick 处理器调用）
      window.__dshInput = sendText

      // 加载 KaTeX 数学公式资源（改名版 CSS + katex.js → auto-render.js 链式）
      ensureMathAssets()
      // 加载 Mermaid 图表引擎（异步，未就绪时渲染层轮询重试）
      ensureMermaidAssets()

      // 初始化 Host RPC 并上报当前开关状态（Host 据此注入/撤回 VCP 协议说明）
      hostRpc = makeHostRpc(ctx)
      syncHostState(hostRpc, isEnabled())

      // 启动：等 composer 出现后挂按钮
      function boot() {
        if (ensureButton()) return
        window.setTimeout(boot, 400)
      }
      boot()

      // React 重渲染会移除注入节点：用 MutationObserver 补回
      var mo = new window.MutationObserver(function () {
        if (!document.getElementById(BTN_ID)) ensureButton()
      })
      mo.observe(document.body, { childList: true, subtree: true })
      window.addEventListener('pagehide', function () {
        mo.disconnect()
      })
    }

    exports.apply = apply
    return module.exports
  },
})
