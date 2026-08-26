/**
 * dsh-raw-html —— VCP 视觉通感协议支持（浏览器半侧）。
 *
 * 职责：
 * 1. 在 composer 尾部工具栏（发送按钮旁）注入「</>」按钮：点击弹出设置面板，
 *    内含两个独立开关：
 *    - 渲染 HTML：驱动 localStorage['dsh.rawHtml']（前端渲染补丁读取）；
 *    - 美学注入：驱动 Host 侧美学协议注入（仅渲染开启时可用，置灰即强制关闭）。
 *    切换任一开关后自动强制刷新页面（新状态立即生效、全部消息重渲染）；
 *    面板底部另备「强制刷新页面」按钮，供调试注入代码时手动刷新。
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

    var RENDER_KEY = 'dsh.rawHtml'
    var AESTHETIC_KEY = 'dsh.rawHtmlAesthetic'
    var BTN_ID = 'dsh-raw-html-toggle'
    var PANEL_ID = 'dsh-raw-html-panel'
    /** 切换开关后延迟强制刷新页面的等待时间（ms）：先让状态落盘 + 上报 Host，再整页重载。 */
    var RELOAD_DELAY = 250
    /** Host 侧 RPC 调用器（可空）：开关切换时上报渲染/美学状态，驱动系统提示词注入。 */
    var hostRpc = null
    /** 延迟刷新定时器（防连点：后一次切换重置前一次）。 */
    var reloadTimer = null
    /** 面板内两个开关行的刷新回调（面板打开时挂载，关闭时清空）。 */
    var renderRowRefresh = null
    var aestheticRowRefresh = null

    // ---- 状态 ------------------------------------------------------------

    // v6.35 三态化（先生定调 2026-08-29）：渲染开关与渲染器判定一致——
    // undefined（从未点过「</>」）= 默认开启；"1" = 开；"0" = 显式关闭。
    // 旧实现 === '1' 会把「从未设置」当作关闭，与 v6-inject 启动自检默认开启冲突。
    function isRenderEnabled() {
      try { return window.localStorage.getItem(RENDER_KEY) !== '0' } catch (e) { return true }
    }
    function setRenderEnabled(on) {
      try { window.localStorage.setItem(RENDER_KEY, on ? '1' : '0') } catch (e) {}
    }
    /** 美学开关：无记录默认关闭（渲染/美学已解耦）。旧版单开关迁移见 migrateState。 */
    function isAestheticEnabled() {
      try { return window.localStorage.getItem(AESTHETIC_KEY) === '1' } catch (e) { return false }
    }
    function setAestheticEnabled(on) {
      try { window.localStorage.setItem(AESTHETIC_KEY, on ? '1' : '0') } catch (e) {}
    }
    /** 旧版单开关迁移：曾开启渲染（dsh.rawHtml=1）但无美学键 → 视为美学也开（保持旧体验，仅一次）。 */
    function migrateState() {
      try {
        if (window.localStorage.getItem(RENDER_KEY) === '1' && window.localStorage.getItem(AESTHETIC_KEY) === null) {
          window.localStorage.setItem(AESTHETIC_KEY, '1')
        }
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

    // 读取 DSH 原生 UI 当前生效的字体（跟随主人字体插件的设置）。
    // 下载按钮挂在 body 下，font-family:inherit 只继承 body 的默认字体，
    // 而主人用「另一个插件」统一改的是 DSH 面板/设置栏/左侧栏/composer 等
    // 原生 UI 区域的字体、body 未变 → 下载按钮字体不同步。故每次显示下载
    // 按钮时，从 DSH 原生元素（composer）读取计算后的字体同步过去。
    function nativeUIFontFamily() {
      try {
        var composer = findComposer()
        if (!composer) return null
        var ref = findTrailing(composer) || composer
        return window.getComputedStyle(ref).fontFamily || null
      } catch (e) { return null }
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

    // ---- 「</>」按钮 + 设置面板（自 B 移植 · 2026-08-24）-------------------
    // 主题令牌（跟随皮肤）：--dsw-alias-* 为 DSH 设计系统别名层，各皮肤都会映射——
    // 按钮/面板自动契合用户切换的深色/浅色主题，看起来像原生 DSH 控件。
    var STYLE_OFF =
      'display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 10px;' +
      'border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.12));border-radius:999px;' +
      'background:var(--dsw-alias-button-tool-bar-fill,rgba(84,85,87,.5));color:var(--dsw-alias-label-secondary,#555);font-size:12px;' +
      'font-family:inherit;cursor:pointer;white-space:nowrap;margin:0 6px;' +
      'transition:all .15s ease;'
    var STYLE_ON =
      'display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 10px;' +
      'border:1px solid var(--dsw-alias-brand-primary,transparent);border-radius:999px;' +
      'background:var(--dsw-alias-button-primary-fill,#0d1f33);' +
      'color:var(--dsw-alias-label-primary-inverted,#fff);font-size:12px;font-family:inherit;cursor:pointer;' +
      'white-space:nowrap;margin:0 6px;font-weight:600;' +
      'transition:all .15s ease;'
    // 渲染开启但美学关闭：用 dimmed 主色，示意「纯净渲染」
    var STYLE_PURE =
      'display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 10px;' +
      'border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.12));border-radius:999px;' +
      'background:var(--dsw-alias-button-primary-dimmed,rgba(0,0,0,.08));color:var(--dsw-alias-label-primary,#111);font-size:12px;' +
      'font-family:inherit;cursor:pointer;white-space:nowrap;margin:0 6px;' +
      'transition:all .15s ease;'

    function buttonLabel() {
      if (!isRenderEnabled()) return '</> OFF'
      return isAestheticEnabled() ? '</> ON' : '</> 渲染'
    }

    function refreshButton(btn) {
      if (!btn) btn = document.getElementById(BTN_ID)
      if (!btn) return
      var render = isRenderEnabled()
      btn.setAttribute('aria-pressed', render ? 'true' : 'false')
      btn.textContent = buttonLabel()
      btn.style.cssText = render ? (isAestheticEnabled() ? STYLE_ON : STYLE_PURE) : STYLE_OFF
    }

    function createButton() {
      var btn = document.createElement('button')
      btn.id = BTN_ID
      btn.type = 'button'
      btn.setAttribute('aria-haspopup', 'true')
      btn.title = 'VCP 渲染设置：点击打开面板，可分别开关「渲染 HTML」与「美学注入」（切换后自动强制刷新）'
      btn.addEventListener('click', function (e) {
        e.stopPropagation()
        togglePanel(btn)
      })
      refreshButton(btn)
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

    // 面板内状态变化：刷新按钮 + 面板开关行 + 上报 Host
    function onChange() {
      refreshButton()
      if (renderRowRefresh) renderRowRefresh()
      if (aestheticRowRefresh) aestheticRowRefresh()
      syncHostState(hostRpc, isRenderEnabled(), isAestheticEnabled())
      window.dispatchEvent(new window.CustomEvent('dsh-raw-html-toggle', {
        detail: { render: isRenderEnabled(), aesthetic: isAestheticEnabled() },
      }))
    }

    /** 强制刷新浏览器：延迟一拍让 localStorage 状态落盘、Host 上报发出，再整页重载。
     *  刷新后渲染补丁以新状态重新加载、全部消息重渲染——方便观察开关效果与调试注入代码。 */
    function scheduleForceReload(sw) {
      if (reloadTimer) window.clearTimeout(reloadTimer)
      if (sw) {
        sw.textContent = '⟳ 刷新中'
        sw.style.opacity = '0.6'
      }
      reloadTimer = window.setTimeout(function () {
        window.location.reload()
      }, RELOAD_DELAY)
    }

    /** 生成一行开关：label + 描述 + ON/OFF 胶囊按钮。 */
    function makeRow(label, desc, getter, setter, disabledGetter) {
      var row = document.createElement('div')
      row.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:8px 2px;'
      var left = document.createElement('div')
      left.style.cssText = 'flex:1;min-width:0;'
      var name = document.createElement('div')
      name.textContent = label
      name.style.cssText = 'font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary,#111);line-height:1.4;'
      var d = document.createElement('div')
      d.textContent = desc
      d.style.cssText = 'font-size:11px;color:var(--dsw-alias-label-tertiary,#666);line-height:1.45;margin-top:2px;'
      left.appendChild(name)
      left.appendChild(d)
      var sw = document.createElement('button')
      sw.type = 'button'
      function refresh() {
        var on = getter()
        var dis = disabledGetter()
        sw.textContent = on ? 'ON' : 'OFF'
        sw.disabled = dis
        sw.style.cssText =
          'min-width:44px;height:24px;padding:0 10px;border-radius:999px;font-size:11px;font-weight:600;flex:none;' +
          (dis ? 'opacity:.35;cursor:not-allowed;' : 'cursor:pointer;') +
          (on
            ? 'background:var(--dsw-alias-button-primary-fill,#0d1f33);color:var(--dsw-alias-label-primary-inverted,#fff);border:1px solid var(--dsw-alias-brand-primary,transparent);'
            : 'background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06));color:var(--dsw-alias-label-secondary,#555);border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.12));')
      }
      sw.addEventListener('click', function () {
        if (disabledGetter()) return
        setter(!getter())
        onChange()
        scheduleForceReload(sw) // 切换后自动强制刷新：新状态立即生效，全部消息重渲染
      })
      row.appendChild(left)
      row.appendChild(sw)
      refresh()
      return { row: row, refresh: refresh }
    }

    function createPanel() {
      var panel = document.createElement('div')
      panel.id = PANEL_ID
      panel.setAttribute('role', 'menu')
      panel.style.cssText =
        'position:fixed;z-index:99999;width:248px;padding:10px 12px;' +
        'background:var(--dsw-alias-bg-overlay,#fff);border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08));' +
        'border-radius:var(--dsl-web-radius,12px);box-shadow:0 12px 34px rgba(0,0,0,.28);' +
        'font-family:inherit;color:var(--dsw-alias-label-primary,#111);'
      var title = document.createElement('div')
      title.textContent = 'VCP 渲染设置'
      title.style.cssText = 'font-size:11px;letter-spacing:.14em;color:var(--dsw-alias-label-secondary,#555);margin:0 2px 8px;'
      panel.appendChild(title)

      var hint = document.createElement('div')
      hint.textContent = '切换任一开关将自动强制刷新页面，立即以新状态重渲染全部消息'
      hint.style.cssText = 'font-size:10px;line-height:1.45;color:var(--dsw-alias-label-tertiary,#777);margin:0 2px 8px;'
      panel.appendChild(hint)

      var renderRow = makeRow(
        '渲染 HTML',
        '把消息中的 HTML 渲染为真实界面（含公式/Mermaid/SVG）',
        isRenderEnabled,
        function (on) {
          setRenderEnabled(on)
          if (!on) setAestheticEnabled(false) // 渲染关闭 → 美学强制关闭
        },
        function () { return false }
      )
      renderRowRefresh = renderRow.refresh
      panel.appendChild(renderRow.row)

      var aesRow = makeRow(
        '美学注入',
        '注入四色系/明度/字体/SVG 装帧等规范，让输出更好看（仅渲染开启时可用）',
        isAestheticEnabled,
        setAestheticEnabled,
        function () { return !isRenderEnabled() }
      )
      aestheticRowRefresh = aesRow.refresh
      panel.appendChild(aesRow.row)

      var reloadBtn = document.createElement('button')
      reloadBtn.type = 'button'
      reloadBtn.textContent = '⟳ 强制刷新页面'
      reloadBtn.title = '立即强制刷新浏览器：重新加载渲染补丁并以当前状态重渲染全部消息（调试注入代码用）'
      reloadBtn.style.cssText =
        'width:100%;height:26px;margin-top:8px;border:1px dashed var(--dsw-alias-border-l2,rgba(0,0,0,.2));' +
        'border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#666);' +
        'font-size:11px;font-family:inherit;cursor:pointer;'
      reloadBtn.addEventListener('click', function () {
        reloadBtn.textContent = '⟳ 正在刷新…'
        reloadBtn.disabled = true
        scheduleForceReload()
      })
      panel.appendChild(reloadBtn)
      return panel
    }

    function openPanel(anchor) {
      closePanel()
      var panel = createPanel()
      document.body.appendChild(panel)
      var rect = anchor.getBoundingClientRect()
      var left = Math.min(Math.max(8, rect.left + rect.width / 2 - 124), Math.max(8, window.innerWidth - 256))
      var top = rect.bottom + 6
      if (top + 236 > window.innerHeight) top = Math.max(8, rect.top - 242)
      panel.style.top = Math.round(top) + 'px'
      panel.style.left = Math.round(left) + 'px'

      var outside = function (e) {
        if (panel.contains(e.target)) return
        if (e.target === anchor || anchor.contains(e.target)) return
        closePanel()
      }
      var key = function (e) { if (e.key === 'Escape') closePanel() }
      panel._outside = outside
      panel._key = key
      // 延迟绑定，避免「打开面板的那次点击」立即触发关闭
      window.setTimeout(function () {
        document.addEventListener('click', outside)
      }, 0)
      document.addEventListener('keydown', key)
    }

    function closePanel() {
      renderRowRefresh = null
      aestheticRowRefresh = null
      var p = document.getElementById(PANEL_ID)
      if (!p) return
      if (p._outside) document.removeEventListener('click', p._outside)
      if (p._key) document.removeEventListener('keydown', p._key)
      p.remove()
    }

    function togglePanel(anchor) {
      if (document.getElementById(PANEL_ID)) {
        closePanel()
        return
      }
      openPanel(anchor)
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

    function syncHostState(rpc, render, aesthetic) {
      if (!rpc) return
      try {
        rpc('/dsh-raw-html', 'set-state', { render: render, aesthetic: aesthetic }).catch(function () {})
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

    // VCP 色彩引擎（data-vcp-preset → --vcp-* 色板变量 · 自 B 移植 2026-08-24）
    // 模型只写声明（data-vcp-preset / data-vcp-soul / data-vcp-accent），hex 由引擎
    // 确定性生成（流式重建结果恒定、对比度/色域闭环保证）。/vendor 秒加载；引擎未就绪时
    // 渲染层 chromeForProps/applyColorVars 静默跳过，下一帧重试。
    function ensureColorEngine() {
      if (window.VCPColorEngine || window.__vcpColor) return
      loadScriptOnce('dsh-raw-html-color-engine', '/vendor/VCPColorEngine.js', null)
    }

    // ---- 卡片下载：hover 浮出「⤓ 下载 HTML」按钮 ----------------------------
    // 需求：渲染出的 VCP 卡片（装帧小说 / 图表 / 卡片）可下载为【自包含 HTML】存档。
    // 实现要点：
    //  - 全局单例浮动按钮（position:fixed 跟随 hover 的 #vcp-root 卡片右上角），
    //    事件委托定位，不往 React DOM 里插节点 → 对流式重建免疫。
    //  - 下载时取 card.outerHTML，把卡片内 <style> 的 @font-face 字体转 data URI 内嵌：
    //    · 内置精选 /fonts/Lanxi-*.woff2（7 款 OFL 开源）→ 内嵌
    //    · KaTeX /vendor/fonts/*.woff2（OFL 开源）→ 内嵌（只 woff2，删 woff/ttf 声明省体积）
    //    · 外置大库 /fonts/<子目录>/*.ttf（可能商业授权）→ 不内嵌，保留相对路径（本机可看）
    //  - Mermaid 已渲染为内联 SVG，自包含；表情包 <img> 为绝对 URL，本机打开仍可加载。

    var DL_BTN_ID = 'dsh-raw-html-dl'
    var dlBtn = null
    var dlCard = null
    var dlHideTimer = null
    var dlInitDone = false

    function blobToDataUri(blob) {
      return new window.Promise(function (resolve, reject) {
        var fr = new window.FileReader()
        fr.onload = function () { resolve(fr.result) }
        fr.onerror = function () { reject(fr.error) }
        fr.readAsDataURL(blob)
      })
    }

    function escapeHtml(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }

    function extractCardTitle(card) {
      var h = card.querySelector('h1, h2, h3, .title')
      var t = h ? h.textContent.replace(/\s+/g, ' ').trim() : ''
      if (!t) {
        var m = card.querySelector('.motto, .headline')
        if (m) t = m.textContent.replace(/\s+/g, ' ').trim().slice(0, 20)
      }
      t = t.replace(/[\\/:*?"<>|\n\r]+/g, '').trim().slice(0, 40)
      return t || 'vcp-card-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    }

    // 收集「沉在卡尾」的 <style> 兄弟：VCP 规范要求 <style> 写在 #vcp-root 之后
    // （卡尾），渲染后它是 card 的【兄弟元素】而非子元素——downloadCard 只取
    // card.outerHTML 会漏掉它，导致下载的 HTML 丢失背景/字体等全部样式。
    // 按本消息唯一 id（#vcp-msg-N）过滤，只收属于这张卡、且不在 card 内部的 style。
    function collectSiblingStyles(card) {
      var root = card.parentElement
      if (!root) return ''
      var id = card.getAttribute('id')
      var styles = root.querySelectorAll('style[data-plugin="vcp-message"]')
      var out = []
      for (var i = 0; i < styles.length; i++) {
        var s = styles[i]
        if (card.contains(s)) continue
        if (id && s.textContent.indexOf('#' + id) === -1) continue
        out.push(s.outerHTML)
      }
      return out.join('\n')
    }

    function downloadCard(card) {
      var html = card.outerHTML
      // v6.19 修复：把沉卡尾的兄弟 <style> 拼回下载内容（否则下载丢背景/字体）。
      var siblingStyle = collectSiblingStyles(card)
      if (siblingStyle) html = siblingStyle + '\n' + html
      // 开源字体白名单：内置精选 Lanxi + KaTeX woff2；外置大库字体不在此列，保留相对路径
      var urlRe = /url\(\s*(['"]?)(\/fonts\/Lanxi-[A-Za-z0-9]+\.woff2|\/vendor\/fonts\/[^'"()\s]+\.woff2)\1\s*\)/g
      var urls = {}
      var m
      while ((m = urlRe.exec(html))) urls[m[2]] = true

      var katexCss = ''
      var katexPromise = window.Promise.resolve()
      if (card.querySelector('.katex')) {
        katexPromise = window.fetch('/vendor/katex-vd.css')
          .then(function (r) { return r.text() })
          .then(function (kc) {
            kc = kc.replace(/,url\(fonts\/[^)]*\.woff\)\s*format\([^)]*\)/g, '')
            kc = kc.replace(/,url\(fonts\/[^)]*\.ttf\)\s*format\([^)]*\)/g, '')
            var kre = /url\(fonts\/([^)]*\.woff2)\)/g
            var km
            while ((km = kre.exec(kc))) urls['/vendor/fonts/' + km[1]] = true
            katexCss = kc
          })
          .catch(function () {})
      }

      katexPromise.then(function () {
        var map = {}
        var jobs = Object.keys(urls).map(function (u) {
          return window.fetch(u)
            .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.blob() })
            .then(blobToDataUri)
            .then(function (uri) { map[u] = uri })
            .catch(function () {})
        })
        return window.Promise.all(jobs).then(function () { return map })
      }).then(function (map) {
        html = html.replace(urlRe, function (all, q, u) {
          return map[u] ? 'url(' + map[u] + ')' : all
        })
        if (katexCss) {
          katexCss = katexCss.replace(/url\(fonts\/([^)]*\.woff2)\)/g, function (all, name) {
            var u = '/vendor/fonts/' + name
            return map[u] ? 'url(' + map[u] + ')' : all
          })
        }
        var title = extractCardTitle(card)
        var doc =
          '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n' +
          '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
          '<title>' + escapeHtml(title) + '</title>\n' +
          (katexCss ? '<style>' + katexCss + '</style>\n' : '') +
          '</head>\n<body style="margin:0;">\n' + html + '\n</body>\n</html>'

        var blob = new window.Blob([doc], { type: 'text/html;charset=utf-8' })
        var a = document.createElement('a')
        var objUrl = window.URL.createObjectURL(blob)
        a.href = objUrl
        a.download = title + '.html'
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.setTimeout(function () { window.URL.revokeObjectURL(objUrl) }, 10000)
      })
    }

    function buildDlButton() {
      var btn = document.createElement('button')
      btn.id = DL_BTN_ID
      btn.type = 'button'
      btn.textContent = '⤓ 下载 HTML'
      btn.title = '下载此卡片为自包含 HTML（内嵌开源字体，任何地方打开都保持装帧效果）'
      btn.style.cssText =
        'display:none;position:fixed;z-index:2147483000;top:0;right:0;height:28px;padding:0 12px;' +
        'border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.12));border-radius:999px;' +
        'background:var(--dsw-alias-bg-overlay,#fff);' +
        'color:var(--dsw-alias-label-primary,#111);' +
        'font-size:11px;font-family:inherit;font-weight:600;cursor:pointer;white-space:nowrap;' +
        'box-shadow:0 4px 14px rgba(0,0,0,.14);'
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation()
        ev.preventDefault()
        var c = dlCard
        if (c) downloadCard(c)
      })
      return btn
    }

    function positionDlButton(card) {
      var r = card.getBoundingClientRect()
      dlBtn.style.top = Math.max(6, r.top + 8) + 'px'
      dlBtn.style.right = Math.max(6, window.innerWidth - r.right + 8) + 'px'
    }

    function scheduleDlHide() {
      if (dlHideTimer) window.clearTimeout(dlHideTimer)
      dlHideTimer = window.setTimeout(function () {
        if (dlBtn) dlBtn.style.display = 'none'
        dlCard = null
      }, 260)
    }

    function showDlFor(card) {
      if (!dlBtn || !dlBtn.isConnected) {
        dlBtn = buildDlButton()
        document.body.appendChild(dlBtn)
      }
      dlCard = card
      // 每次显示时同步 DSH 原生 UI 的字体（跟随主人字体插件的实时设置）
      var nf = nativeUIFontFamily()
      if (nf) dlBtn.style.fontFamily = nf
      positionDlButton(card)
      dlBtn.style.display = 'inline-block'
      if (dlHideTimer) window.clearTimeout(dlHideTimer)
    }

    function initDownload() {
      if (dlInitDone) return
      dlInitDone = true
      document.addEventListener('mouseover', function (ev) {
        var t = ev.target
        if (!t || !t.closest) return
        if (dlBtn && (t === dlBtn || dlBtn.contains(t))) {
          if (dlHideTimer) window.clearTimeout(dlHideTimer)
          return
        }
        var card = t.closest('[id="vcp-root"],[id^="vcp-msg-"]')
        if (card) showDlFor(card)
      })
      document.addEventListener('mouseout', function (ev) {
        var t = ev.target
        if (!t || !t.closest) return
        var rt = ev.relatedTarget
        if (rt && rt.closest) {
          if (dlBtn && (rt === dlBtn || dlBtn.contains(rt))) return
          if (rt.closest('[id="vcp-root"],[id^="vcp-msg-"]') === dlCard) return
        }
        if (t.closest('[id="vcp-root"],[id^="vcp-msg-"]')) scheduleDlHide()
      })
    }

    // ---- 应用 ------------------------------------------------------------

    function apply(ctx) {
      // 旧版单开关状态迁移（仅一次）
      migrateState()

      // 暴露 input 桥（渲染补丁的 onclick 处理器调用）
      window.__dshInput = sendText

      // 卡片 hover 下载：全局单例浮动按钮 + 事件委托（不插 React DOM）
      initDownload()

      // 加载 KaTeX 数学公式资源（改名版 CSS + katex.js → auto-render.js 链式）
      ensureMathAssets()
      // 加载 Mermaid 图表引擎（异步，未就绪时渲染层轮询重试）
      ensureMermaidAssets()
      // 加载 VCP 色彩引擎（data-vcp-preset 声明式配色，未就绪时渲染层静默降级）
      ensureColorEngine()

      // 初始化 Host RPC 并上报当前开关状态（Host 据此注入/撤回 VCP 协议说明）
      hostRpc = makeHostRpc(ctx)
      syncHostState(hostRpc, isRenderEnabled(), isAestheticEnabled())

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
        closePanel()
      })
    }

    exports.apply = apply
    return module.exports
  },
})
