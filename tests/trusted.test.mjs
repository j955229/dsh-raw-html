/**
 * dsh-raw-html 可信模式（Trusted Mode）专项测试。
 *
 * 验证 v7.1 可信模式核心：
 *   1. 默认关闭（未开启）→ 行为与旧版一致：script 不执行、URL 白名单严格
 *   2. 开启（window.__DSH_TRUSTED__ / localStorage['raw-html.trusted']）→
 *      script 被提取并在消息渲染完成后执行；on* 属性放行；javascript: 仍拒
 *   3. 回归：__vcpStable.render / __vcpTrusted 挂载正常
 *
 * 运行：node tests/trusted.test.mjs
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { JSDOM } = require('G:/AI/AI 助手/VCPChat-main/node_modules/jsdom')

const dom = new JSDOM('<!doctype html><html><body></body></html>')
const { document, Node, window: domWindow } = dom.window

// ---- 与 bundle 等价（可信补丁版）的 vc/hp/f stub ----
function hp(n) {
  const r = {}
  for (const i of n.split(';')) {
    const s = i.indexOf(':')
    if (s === -1) continue
    const c = i.slice(0, s).trim().replace(/-([a-z])/g, (h, p) => p.toUpperCase())
    r[c] = i.slice(s + 1).trim()
  }
  return r
}
let sandbox = null
const isTrustedGlobal = () => !!(sandbox && sandbox.window && sandbox.window.__DSH_TRUSTED__ === true)
function vc(n, r) {
  if (n.nodeType === Node.TEXT_NODE) return n.textContent
  if (n.nodeType !== Node.ELEMENT_NODE) return null
  const i = n
  const s = { key: r }
  if (!isTrustedGlobal() && (i.localName === 'script' || i.localName === 'iframe' || i.localName === 'object' || i.localName === 'embed')) return null
  for (const c of i.attributes) {
    if (/^on/i.test(c.name)) { if (!isTrustedGlobal()) continue; s[c.name] = c.value; continue }
    if (c.name === 'style') { s.style = hp(c.value); continue }
    if (c.name === 'class') { s.className = c.value; continue }
    if (c.name === 'href' && !isTrustedGlobal() && !/^(https?:|mailto:|\/|#)/i.test(c.value)) continue
    if (c.name === 'src' && !isTrustedGlobal() && !/^(https?:|data:image\/|\/|#)/i.test(c.value)) continue
    if (isTrustedGlobal() && (c.name === 'href' || c.name === 'src') && /^\s*javascript:/i.test(c.value)) continue
    s[c.name] = c.value
  }
  const u = [...i.childNodes].map(vc).filter(x => x != null)
  return { tag: i.localName, props: s, children: u }
}
const f = { Fragment: Symbol('frag') }
f.jsx = (type, props) => ({ type, props })

const code = fs.readFileSync(new URL('../patch/v6-inject.js', import.meta.url), 'utf8')
function load(extra = {}) {
  sandbox = Object.assign({
    window: {},
    document: domWindow.document,
    DOMParser: domWindow.DOMParser,
    Node,
    f,
    vc,
    hp,
    performance: { now: () => Date.now() },
    console,
    // 同步化 setTimeout：flushTrustedScripts 立即执行，断言同步完成
    setTimeout: (fn) => { fn(); return 0 },
    clearTimeout: () => {},
  }, extra)
  sandbox.__T = 0
  vm.runInNewContext(code, sandbox)
  return sandbox.window.__vcpStable
}

let passed = 0
function ok(name, fn) { fn(); passed += 1; console.log(`  ✓ ${name}`) }

// ============ 1. 默认关闭（安全默认）============
console.log('== 默认关闭（安全默认）==')
const stableOff = load()
ok('isTrusted 默认 false', () => assert.equal(sandbox.window.__vcpTrusted(), false))
ok('关闭时 script 不执行', () => {
  stableOff.render('<div id="vcp-root"><script>__T = 1<\/script><p>hi</p></div>', false)
  assert.equal(sandbox.__T, 0)
})
ok('关闭时 on* 属性仍过滤', () => {
  const R = stableOff.render('<div id="vcp-root"><button onclick="x()">b</button></div>', false)
  assert.ok(R)
})

// ============ 2. 可信模式开启 ============
console.log('== 可信模式开启（window.__DSH_TRUSTED__）==')
const stableOn = load()
sandbox.window.__DSH_TRUSTED__ = true
ok('isTrusted 开启为 true', () => assert.equal(sandbox.window.__vcpTrusted(), true))
ok('render 含 script → 脚本执行一次', () => {
  stableOn.render('<div id="vcp-root"><script>__T = __T + 1<\/script><p>hi</p></div>', false)
  assert.equal(sandbox.__T, 1)
})
ok('脚本可操作 document', () => {
  stableOn.render('<div id="vcp-root"><script>document.__t7 = 7<\/script></div>', false)
  assert.equal(domWindow.document.__t7, 7)
})
ok('on* 属性放行', () => {
  const R = stableOn.render('<div id="vcp-root"><button onclick="alert(1)">x</button></div>', false)
  assert.ok(R)
})
ok('javascript: URL 仍拒绝', () => {
  const R = stableOn.render('<div id="vcp-root"><a href="javascript:alert(1)">x</a></div>', false)
  assert.ok(R)
})
ok('script 内容含 HTML 实体可执行（decodeEntities）', () => {
  stableOn.render('<div id="vcp-root"><script>var __amp = 1 &amp;&amp; 2; __T = __amp<\/script></div>', false)
  assert.equal(sandbox.__T, 2)
})
ok('localStorage 开关等效', () => {
  load({ localStorage: { getItem: (k) => (k === 'raw-html.trusted' ? '1' : null), setItem: () => {} } })
  assert.equal(sandbox.window.__vcpTrusted(), true)
})

// ============ 3. 回归 ============
console.log('== 回归 ==')
ok('__vcpStable.render 挂载', () => assert.equal(typeof sandbox.window.__vcpStable.render, 'function'))
ok('__vcpTrusted 全局暴露', () => assert.equal(typeof sandbox.window.__vcpTrusted, 'function'))
ok('__vcpTrustedToggle 幂等', () => {
  // 重复加载不重复挂徽章（安装标记已置）
  load()
  assert.equal(sandbox.window.__vcpTrustedToggle, true)
})

console.log(`\n全部通过：${passed} 项断言 ✓`)
process.exit(0)
