/**
 * dsh-raw-html v6 稳定区固化测试。
 *
 * 用 node:vm 加载 patch/v6-inject.js（注入 bundle 的模块），stub 依赖
 * （window / DOMParser / Node / f / vc / hp）后，直接驱动流式帧序列验证：
 *   1. 容器未闭合期间：内部闭合子块逐块固化（元素引用跨帧稳定）
 *   2. 固化块保留动画（含一次性动画）；tail 流式中剥一次性动画、保留 infinite
 *   3. 容器闭合帧走全量兜底；闭合后的顶层块增量固化
 *   4. 前缀失配（回退 / 多消息切换）→ 重置全量，不串扰
 *   5. 裸文本阻止固化、void 标签、rawtext（script）、incomplete 标签、注释
 *
 * 依赖 jsdom（借用 VCPChat 项目 node_modules，路径见下）。
 * 运行：node tests/stable.test.mjs
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { JSDOM } = require('G:/AI/AI 助手/VCPChat-main/node_modules/jsdom')

const dom = new JSDOM('<!doctype html><html><body></body></html>')
const { document, Node, window: domWindow } = dom.window

// ---- stub：与 bundle 等价的 vc / hp / f ----
function filterStyle(sv) {
  return sv
    .replace(/position\s*:\s*fixed\s*;?/gi, '')
    .replace(/z-index\s*:\s*\d{4,}\s*;?/gi, '')
    .replace(/(?<![\w-])content\s*:[^;]*;?/gi, '')
}
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
function allowHref(v) { return /^(https?:|mailto:|\/|#)/i.test(v) }
function allowSrc(v) { return /^(https?:|data:image\/|\/|#)/i.test(v) }

function vc(n, r) {
  if (n.nodeType === Node.TEXT_NODE) return n.textContent
  if (n.nodeType !== Node.ELEMENT_NODE) return null
  const i = n
  const s = { key: r }
  if (i.localName === 'script' || i.localName === 'iframe' || i.localName === 'object' || i.localName === 'embed') return null
  for (const c of i.attributes) {
    if (c.name === 'onclick') {
      const m = /^input\s*\(\s*['"]([\s\S]*?)['"]\s*\)\s*;?\s*$/.exec(c.value)
      if (m) s.onClick = function () { const fn = domWindow.__dshInput; fn && fn(m[1]) }
      continue
    }
    if (/^on/i.test(c.name)) continue
    if (c.name === 'style') { s.style = hp(filterStyle(c.value)); continue }
    if (c.name === 'class') { s.className = c.value; continue }
    if (c.name === 'href' && !allowHref(c.value)) continue
    if (c.name === 'src' && !allowSrc(c.value)) continue
    s[c.name] = c.value
  }
  const u = [...i.childNodes].map(vc).filter(x => x != null)
  return { tag: i.localName, props: s, children: u }
}

const f = { Fragment: Symbol('frag') }
f.jsx = (type, props) => ({ type, props })

// ---- vm 加载 v6-inject.js ----
const code = fs.readFileSync(new URL('../patch/v6-inject.js', import.meta.url), 'utf8')
const sandbox = {
  window: {},
  DOMParser: domWindow.DOMParser,
  Node,
  f,
  vc,
  hp,
  performance: { now: () => Date.now() },
  console,
  setTimeout: (fn, ms) => domWindow.setTimeout(fn, ms),
  clearTimeout: (id) => domWindow.clearTimeout(id),
}
vm.runInNewContext(code, sandbox)
const stable = sandbox.window.__vcpStable
assert.ok(stable && typeof stable.render === 'function', '__vcpStable.render 已挂载')

let passed = 0
function ok(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

// ---- 工具 ----
// 兼容两种元素风格：组装路径用 f.jsx（{type, props}），vc 转换路径用 {tag, props, children}
function collect(node, out = []) {
  if (!node || typeof node === 'string' || typeof node === 'number') return out
  if (node.type) { if (node.type !== f.Fragment) out.push(node) }
  else if (node.tag) out.push(node)
  const ch = node.children || (node.props && node.props.children)
  if (Array.isArray(ch)) for (const c of ch) collect(c, out)
  else if (ch && typeof ch === 'object') collect(ch, out)
  return out
}
function findTag(root, tag) {
  return collect(root).filter(n => n.tag === tag)
}
function resetCache() {
  // 每个用例前重置 F（模拟新会话/刷新）
  sandbox.window.__vcpFast = undefined
  const code2 = fs.readFileSync(new URL('../patch/v6-inject.js', import.meta.url), 'utf8')
  const sb2 = { window: {}, DOMParser: domWindow.DOMParser, Node, f, vc, hp, performance: { now: () => Date.now() }, console, setTimeout: (fn, ms) => domWindow.setTimeout(fn, ms), clearTimeout: (id) => domWindow.clearTimeout(id) }
  vm.runInNewContext(code2, sb2)
  return sb2.window.__vcpStable
}

console.log('== 1. 容器未闭合期间：内部子块固化 ==')
{
  const s = resetCache()
  const f1 = '<div id="vcp-root" style="background:#0a2540">'
  const f2 = f1 + '<h3 style="animation:lx-rise .5s ease both">标题</h3>'
  const f3 = f2 + '<p style="animation:lx-wave 1s ease-in-out infinite">循环'   // p 未闭合 → tail
  const f4 = f3 + '</p><p style="animation:lx-pop .4s both">一次性'            // p1 闭合固化；p2 未闭合 → tail

  const r1 = s.render(f1, true)
  ok('帧1：容器元素渲染（空内容）', () => {
    assert.equal(r1.type, 'div')
    assert.equal(r1.props.id, 'vcp-root')
    assert.equal(Array.isArray(r1.props.children), true)
    assert.equal(r1.props.children.length, 0)
  })

  const r2 = s.render(f2, true)
  ok('帧2：h3 成为容器子节点', () => {
    assert.equal(r2.type, 'div')
    const h3s = findTag(r2, 'h3')
    assert.equal(h3s.length, 1)
  })
  const h3_2 = findTag(r2, 'h3')[0]
  ok('帧2：固化块保留一次性动画', () => {
    assert.equal(h3_2.props.style.animation, 'lx-rise .5s ease both')
  })

  const r3 = s.render(f3, true)
  ok('帧3：h3 元素引用稳定（DOM 不重建 → 动画不闪）', () => {
    assert.equal(findTag(r3, 'h3')[0], h3_2)
  })
  ok('帧3：tail 中 infinite 动画保留', () => {
    const ps = findTag(r3, 'p')
    assert.equal(ps.length, 1)
    assert.equal(ps[0].props.style.animation, 'lx-wave 1s ease-in-out infinite')
  })

  const r4 = s.render(f4, true)
  ok('帧4：闭合的 p1 固化（引用稳定），tail 中 p2 一次性动画被剥除（防闪）', () => {
    const ps = findTag(r4, 'p')
    assert.equal(ps.length, 2)
    const p1 = ps.find(p => String(p.props.style.animation).includes('lx-wave'))
    const p2 = ps.find(p => p.props.style.animation === undefined || !String(p.props.style.animation).includes('lx-pop'))
    assert.ok(p1, 'p1（infinite）在固化块中')
    assert.equal(p1.props.style.animation, 'lx-wave 1s ease-in-out infinite')
    assert.ok(p2, 'p2（一次性）在 tail 中')
  })
  ok('帧4：h3 引用依旧稳定', () => {
    assert.equal(findTag(r4, 'h3')[0], h3_2)
  })
}

console.log('== 2. 容器闭合帧全量兜底 + 闭合后顶层块增量 ==')
{
  const s = resetCache()
  const f2 = '<div id="vcp-root" style="background:#0a2540"><h3>标题</h3>'
  const f3 = f2 + '</div>'
  const f4 = f3 + '<div style="color:red">新卡</div>'
  const f5 = f4 + '<div style="color:blue">新卡二</div>'

  const r2 = s.render(f2, true)
  const h3pre = findTag(r2, 'h3')[0]

  const r3 = s.render(f3, true) // 容器闭合 → 全量
  ok('帧3：容器闭合后结构完整（vcp-root 包裹 h3）', () => {
    const roots = collect(r3)
    assert.equal(roots[0].tag, 'div')
    assert.equal(roots[0].props.id, 'vcp-root')
    assert.equal(findTag(r3, 'h3').length, 1)
  })

  const r4 = s.render(f4, true)
  ok('帧4：闭合后顶层块增量固化（Fragment 平铺）', () => {
    assert.equal(r4.type, f.Fragment)
    const roots = topChildren(r4)
    assert.equal(roots.length, 2)
    assert.equal(roots[0].props.id, 'vcp-root')
    assert.equal(roots[1].props.style.color, 'red')
  })
  ok('帧4：vcp-root 块内部 h3 完整', () => {
    assert.equal(findTag(r4, 'h3').length, 1)
  })

  const r5 = s.render(f5, true)
  ok('帧5：继续增量固化（新卡二），且 vcp-root 引用稳定', () => {
    assert.equal(r5.type, f.Fragment)
    const roots = topChildren(r5)
    assert.equal(roots.length, 3)
    assert.equal(roots[2].props.style.color, 'blue')
    assert.equal(roots[0], topChildren(r4)[0])
  })
}

// 顶层直接子级（不递归）
function topChildren(node) {
  const ch = node.children || (node.props && node.props.children)
  if (!ch) return []
  if (!Array.isArray(ch)) return [ch]
  return ch.filter(c => c && typeof c === 'object')
}

// 递归收集全部文本（跳过 style/script 元素内部——CSS/JS 文本合法，不算泄漏）
function findTextOutside(node, out = []) {
  if (typeof node === 'string') out.push(node)
  if (node && node.tag && (node.tag === 'style' || node.tag === 'script')) return out
  if (node && node.children) {
    for (const c of node.children) findTextOutside(c, out)
  } else if (node && node.props && node.props.children) {
    const ch = node.props.children
    if (Array.isArray(ch)) for (const c of ch) findTextOutside(c, out)
    else findTextOutside(ch, out)
  }
  return out
}

// 递归收集全部文本
function findText(node, out = []) {
  if (typeof node === 'string') out.push(node)
  if (node && node.children) {
    for (const c of node.children) findText(c, out)
  } else if (node && node.props && node.props.children) {
    const ch = node.props.children
    if (Array.isArray(ch)) for (const c of ch) findText(c, out)
    else findText(ch, out)
  }
  return out
}

console.log('== 3. 前缀失配：回退 / 多消息切换不串扰 ==')
{
  const s = resetCache()
  s.render('<div id="a">x</div><b>y</b>', true)
  const rb = s.render('<div id="b">z</div>', true)
  ok('前缀失配 → 重置全量，渲染正确', () => {
    const roots = collect(rb)
    assert.equal(roots[0].props.id, 'b')
  })
  const rb2 = s.render('<div id="b">z</div>', true)
  ok('同内容整串缓存命中（同流式状态重复渲染）', () => {
    assert.equal(rb2, rb)
  })
}

console.log('== 4. 裸文本阻止固化（归 tail）==')
{
  const s = resetCache()
  const r1 = s.render('<div id="r">前文', true)
  const r2 = s.render('<div id="r">前文<b>后</b>', true)
  ok('裸文本后的块不固化（整体进容器 tail）', () => {
    assert.equal(r2.type, 'div')
    const roots = collect(r2)
    assert.equal(roots[0].props.id, 'r')
    const text = findText(r2)
    assert.ok(text.join('').includes('前文'))
    assert.equal(findTag(r2, 'b').length, 1)
  })
}

console.log('== 5. void 标签 / rawtext / incomplete / 注释 ==')
{
  const s = resetCache()
  const r1 = s.render('<div id="r"><img src="https://x/y.png"><b>y</b></div>', true)
  ok('void 标签 img 不破坏栈', () => {
    assert.equal(findTag(r1, 'img').length, 1)
    assert.equal(findTag(r1, 'b').length, 1)
  })

  const s2 = resetCache()
  const r2 = s2.render('<div id="r"><script>if(a<b){}</script><b>y</b></div>', false)
  ok('rawtext（script 内容含 <）不误判', () => {
    assert.equal(findTag(r2, 'script').length, 0) // vc 过滤
    assert.equal(findTag(r2, 'b').length, 1)
  })

  const s3 = resetCache()
  const r3 = s3.render('<div id="r"><p>文', true)
  ok('incomplete 标签（流式中开标签未闭合）→ 进 tail', () => {
    assert.equal(r3.type, 'div')
    const ps = findTag(r3, 'p')
    assert.equal(ps.length, 1) // DOMParser 容错解析出 <p>
  })

  const s4 = resetCache()
  const r4 = s4.render('<div id="r"><!-- 注释 --><b>y</b></div>', false)
  ok('注释标签跳过，后续块正常固化', () => {
    assert.equal(findTag(r4, 'b').length, 1)
  })
}

console.log('== 6. 最终帧（非流式）动画恢复 ==')
{
  const s = resetCache()
  const base = '<div id="vcp-root"><p style="animation:lx-pop .4s both">结束</p>'
  const rStream = s.render(base, true)
  ok('流式中一次性动画被剥', () => {
    assert.equal(findTag(rStream, 'p')[0].props.style.animation, undefined)
  })
  const rFinal = s.render(base, false)
  ok('最终帧一次性动画保留（播放一次）', () => {
    assert.equal(findTag(rFinal, 'p')[0].props.style.animation, 'lx-pop .4s both')
  })
}

console.log('== 7. 图片转换 + 安全过滤在 v6 管线内生效 ==')
{
  const s = resetCache()
  const r = s.render('<div id="r">![开心](http://127.0.0.1:3080/emoji/开心.png)</div>', false)
  ok('![..](..) 转为 img', () => {
    const imgs = findTag(r, 'img')
    assert.equal(imgs.length, 1)
    assert.ok(imgs[0].props.src.includes('/emoji/'))
  })
  const s2 = resetCache()
  const r2 = s2.render('<div id="r" style="position:fixed;z-index:99999;content:&quot;钓鱼&quot;;color:red">x</div>', false)
  ok('容器开标签 style 危险属性被过滤', () => {
    const st = collect(r2)[0].props.style
    assert.equal(st.position, undefined)
    assert.equal(st.zIndex, undefined)
    assert.equal(st.content, undefined)
    assert.equal(st.color, 'red')
  })
}

console.log('== 8. <style> 元素修复（keyframes 不丢失、不泄漏为文本）==')
{
  const s = resetCache()
  const f1 = '<div id="vcp-root" style="background:#0a2540">'
  const f2 = f1 + '<style>@keyframes lx-spin{to{transform:rotate(360deg)}}@keyframes lx-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}</style>'
  const f3 = f2 + '<div style="animation:lx-spin 1s linear infinite">A</div>'
  const f4 = f3 + '</div>'

  const r2 = s.render(f2, true)
  ok('帧2：<style> 渲染为元素（keyframes 内容保留）', () => {
    const st = findTag(r2, 'style')
    assert.equal(st.length, 1)
    assert.ok(st[0].children.join('').includes('lx-spin'))
    assert.ok(st[0].children.join('').includes('lx-bounce'))
  })

  const r3 = s.render(f3, true)
  ok('帧3：<style> 固化到 inner（仍存在、内容完整）', () => {
    const st = findTag(r3, 'style')
    assert.equal(st.length, 1)
    assert.ok(st[0].children.join('').includes('lx-bounce'))
    assert.equal(findTag(r3, 'div').filter(d => d.props.style && d.props.style.animation).length, 1)
  })
  const style3 = findTag(r3, 'style')[0]

  const r3b = s.render(f3 + '<p>更多</p>', true)
  ok('帧3b：<style> 固化后跨帧引用稳定（不重复解析）', () => {
    const st = findTag(r3b, 'style')
    assert.equal(st.length, 1)
    assert.equal(st[0], style3)
  })

  const r4 = s.render(f4, true) // 容器闭合 → 全量
  ok('帧4（闭合）：<style> 与动画元素都在，CSS 不泄漏为文本', () => {
    assert.equal(findTag(r4, 'style').length, 1)
    assert.equal(findTag(r4, 'div').filter(d => d.props.style && d.props.style.animation).length, 1)
    // 泄漏防护：style 元素之外不得出现 CSS 语法文本
    const texts = findTextOutside(r4)
    for (const tx of texts) {
      assert.ok(!/^\{|^@keyframes|^[a-zA-Z-]+:/.test(tx), '发现泄漏 CSS 文本: ' + tx.slice(0, 40))
    }
  })
}

console.log('== 9. 压力场景：容器内 style + 大量 SVG 动画图标 ==')
{
  const s = resetCache()
  // 简化压力卡：style + 5 个带动画的图标块
  let v = '<div id="vcp-root" style="background:#0a2540"><style>@keyframes lx-spin{to{transform:rotate(360deg)}}@keyframes lx-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}</style>'
  for (let i = 0; i < 5; i++) {
    v += '<div style="animation:' + (i % 2 ? 'lx-spin' : 'lx-bounce') + ' 1s linear infinite">图标' + i + '<svg width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg></div>'
    const r = s.render(v, true)
    if (i === 0) {
      ok('首个图标块渲染（含 style）', () => {
        assert.equal(findTag(r, 'style').length, 1)
        assert.equal(findTag(r, 'div').filter(d => d.props.style && d.props.style.animation).length, 1)
      })
    } else {
      ok('图标块 ' + i + ' 增量固化（引用稳定）', () => {
        assert.equal(findTag(r, 'div').filter(d => d.props.style && d.props.style.animation).length, i + 1)
      })
    }
  }
  ok('全部图标动画保留（infinite）', () => {
    const rF = s.render(v, true)
    const anims = findTag(rF, 'div').filter(d => d.props.style && d.props.style.animation)
    assert.equal(anims.length, 5)
    for (const a of anims) assert.ok(String(a.props.style.animation).includes('infinite'))
  })
}

console.log('== 10. 伪标签防御（文字里的 <style> 字样不污染）==')
{
  const s = resetCache()
  const html = '<div id="vcp-root" style="background:#0a2540"><div>参考代码：`<style>` 标签示例，CSS 规则如 @keyframes 需连续书写</div><div style="animation:lx-spin 1s linear infinite">A</div></div>'
  const r = s.render(html, false)
  ok('伪 <style> 字样不生成 style 元素', () => {
    assert.equal(findTag(r, 'style').length, 0)
  })
  ok('后续内容完整渲染（未被吞）', () => {
    const texts = findTextOutside(r)
    assert.ok(texts.join('').includes('标签示例'))
    assert.ok(texts.join('').includes('A'))
  })
  ok('动画元素正常', () => {
    const anims = findTag(r, 'div').filter(d => d.props.style && d.props.style.animation)
    assert.equal(anims.length, 1)
  })
}

console.log('== 11. justify-content + animation 不误伤（content 正则词边界）==')
{
  const s = resetCache()
  const html = '<div id="vcp-root" style="background:#0a2540"><style>@keyframes lx-spin{to{transform:rotate(360deg)}}</style><div style="width:52px;height:52px;display:flex;align-items:center;justify-content:center;animation:lx-spin 1s linear infinite">A</div></div>'
  const r = s.render(html, false)
  ok('animation 属性保留（不被 content 正则误伤）', () => {
    const d = findTag(r, 'div').find(x => x.props.style && x.props.style.animation)
    assert.ok(d, '动画 div 存在')
    assert.equal(d.props.style.animation, 'lx-spin 1s linear infinite')
  })
  ok('justify-content 属性保留', () => {
    const d = findTag(r, 'div').find(x => x.props.style && x.props.style.justifyContent)
    assert.equal(d.props.style.justifyContent, 'center')
  })
}

console.log('== 12. 未闭合标签占位（方案 B：半标签不空窗、不显示代码）==')
{
  const s = resetCache()
  // 帧1：vcp-root 内 svg 开标签完整、circle 半标签未闭合
  const f1 = '<div id="vcp-root" style="background:#0a2540"><svg viewBox="0 0 400 200">\n<circle cx="50" cy="50" r="40" fill="#40dcff"'
  const r1 = s.render(f1, true)
  ok('帧1：未闭合 circle → 「绘制中」占位 span（不空窗）', () => {
    const phs = findTag(r1, 'span').filter(sp => sp.props.className === 'vcp-tail-ph')
    assert.equal(phs.length, 1)
    assert.ok(phs[0].children.join('').includes('SVG'))
  })
  ok('帧1：已闭合的 svg 开标签照常渲染', () => {
    assert.equal(findTag(r1, 'svg').length, 1)
  })

  // 帧2：circle 写完闭合 → 占位消失、真实元素出现
  const r2 = s.render(f1 + '/>', true)
  ok('帧2：标签闭合后占位消失', () => {
    assert.equal(findTag(r2, 'span').filter(sp => sp.props.className === 'vcp-tail-ph').length, 0)
  })
  ok('帧2：真实 circle 元素出现（属性完整）', () => {
    const cs = findTag(r2, 'circle')
    assert.equal(cs.length, 1)
    assert.equal(cs[0].props.cx, '50')
  })

  // 帧3：顶层半标签（v 已含 >，tail 未闭合）→ 占位而非空白
  const s3 = resetCache()
  const r3 = s3.render('<svg viewBox="0 0 400 200">\n<circle cx="50"', true)
  ok('帧3：顶层 svg 内半标签 → 占位 span', () => {
    const phs = findTag(r3, 'span').filter(sp => sp.props.className === 'vcp-tail-ph')
    assert.equal(phs.length, 1)
    // F.open 组装的容器是 jsx 风格（type），vc 产物是 tag 风格——两种都认
    const svgs = collect(r3).filter(n => n.type === 'svg' || n.tag === 'svg')
    assert.equal(svgs.length, 1)
  })

  // 帧4：非流式不插入占位（保持原行为）
  const s4 = resetCache()
  const r4 = s4.render('<div id="vcp-root"><svg viewBox="0 0 400 200">\n<circle cx="50"', false)
  ok('非流式不插入占位（维持原行为）', () => {
    assert.equal(findTag(r4, 'span').filter(sp => sp.props.className === 'vcp-tail-ph').length, 0)
  })
}

console.log('== 13. on* 事件属性过滤（安全缺口 5.4 修复）==')
{
  const s = resetCache()
  const r = s.render('<div id="r"><img src="https://x/y.png" onerror="alert(1)"><button onclick="input(\'你好\')">点我</button><span onmouseover="x">t</span></div>', false)
  ok('子元素 onerror 被拒（img 上无 onerror）', () => {
    const imgs = findTag(r, 'img')
    assert.equal(imgs.length, 1)
    assert.equal(imgs[0].props.onerror, undefined)
  })
  ok('onclick="input(...)" 桥接为 onClick 函数', () => {
    const btns = findTag(r, 'button')
    assert.equal(btns.length, 1)
    assert.equal(typeof btns[0].props.onClick, 'function')
  })
  ok('子元素 onmouseover 被拒', () => {
    const spans = findTag(r, 'span')
    assert.equal(spans[0].props.onmouseover, undefined)
  })
  const s2 = resetCache()
  const r2 = s2.render('<div id="r" onload="x" style="color:red">', true)
  ok('容器开标签 onload 被拒（parseOpen 路径）', () => {
    const root = collect(r2)[0]
    assert.equal(root.props.onload, undefined)
    assert.equal(root.props.style.color, 'red')
  })
}

console.log(`\n全部通过：${passed} 项断言 ✓`)
