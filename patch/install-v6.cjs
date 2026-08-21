#!/usr/bin/env node
/**
 * dsh-raw-html —— 万能安装器（任意状态 → v6 全量补丁）
 *
 * 面向「全新电脑 / 其他 agent 环境」的一键安装入口。
 * 无论目标 dsh-web-frontend 的 dist bundle 处于哪个历史状态
 * （原始未打补丁 / v1·v2 加速引擎 / v4·v5 中间态），都能一步打到
 * 当前完整能力（v6）：
 *
 *   A. case"html" 分支 → 调 window.__vcpStable.render（流式稳定区固化：
 *      已闭合块缓存、只重渲染尾巴；图片 Markdown 转 <img> 与安全白名单
 *      由 v6 模块接管）
 *   B. vc() 属性循环 → v6 最终形态：onclick="input('...')" 桥接 +
 *      style 危险属性剥离（content 词边界正则，防误伤 justify-content）+
 *      href/src URL 协议白名单 + style 文字属性 ref 回调 !important 锁定
 *      （防皮肤覆盖）；原始态额外补 script/iframe/object/embed 过滤
 *   C. vc() 定义前注入 v6 稳定区模块（patch/v6-inject.js：扫描器 + 状态机 +
 *      KaTeX 数学公式 + Mermaid 查看器 + SVG 流式占位，挂 window.__vcpStable）
 *
 * 实现策略：区间替换 + 幂等 + 多级安全网
 *   - case"html" 分支：原始态精确替换；增强态（v1/v2/v4/v5 均形如
 *     `case"html":return function(){...return n.value}();`）按「起止锚点」
 *     区间替换，不依赖各版本完整文本 → 对未知中间态更鲁棒
 *   - vc 属性循环：同上（增强态形如 `for(const c of i.attributes){...s[c.name]=c.value}`）
 *   - 幂等：bundle 已含 window.__vcpStable → 跳过
 *   - 备份：index-*.js.bak-installv6-<时间戳>；每个锚点要求恰好命中，
 *     写回后 node --check + v6 特征校验，失败自动回滚
 *
 * 用法：
 *   node patch/install-v6.cjs [bundle路径]     # 省略路径时自动探测
 */
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

// ---- bundle 探测（与 patch-frontend.cjs 一致）-------------------------------
function findBundle() {
  const arg = process.argv[2]
  if (arg) return fs.existsSync(arg) ? arg : null

  if (process.env.DSH_WEB_FRONTEND_DIST) {
    const p = process.env.DSH_WEB_FRONTEND_DIST
    if (fs.existsSync(p)) return p
  }

  const candidates = []
  const addDir = (d) => {
    if (!d || !fs.existsSync(d)) return
    try {
      const assets = path.join(d, 'dist', 'assets')
      if (!fs.existsSync(assets)) return
      for (const f of fs.readdirSync(assets)) {
        if (/^index-[\w-]+\.js$/.test(f)) candidates.push(path.join(assets, f))
      }
    } catch {}
  }
  addDir(path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-web-frontend'))
  addDir(path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@deepseek-ai', 'dsh-web-frontend'))
  addDir(path.join(process.env.USERPROFILE || '', '.dsh', 'profiles', 'web', 'node_modules', '@deepseek-ai', 'dsh-web-frontend'))
  addDir(path.join(process.env.USERPROFILE || '', '.dsh', 'profiles', 'node_modules', '@deepseek-ai', 'dsh-web-frontend'))
  return candidates[0] || null
}

// ---- 锚点常量（String.raw 保证正则字面量原样匹配）---------------------------
// 原始态
const CASE_ORIG = String.raw`case"html":return n.value;`
const VC_ORIG = String.raw`for(const c of i.attributes)c.name==="class"?s.className=c.value:c.name==="style"?s.style=hp(c.value):s[c.name]=c.value;`

// 增强态起止锚点（v1/v2/v4/v5 通用）
const CASE_ENHANCED_START = String.raw`case"html":return function(){`
const CASE_ENHANCED_END = String.raw`return n.value}();`
const VC_ENHANCED_START = String.raw`for(const c of i.attributes){`
const VC_ENHANCED_END = String.raw`s[c.name]=c.value}`

// v6 最终形态
const CASE_V6 = String.raw`case"html":return function(){if(typeof localStorage!=="undefined"&&localStorage.getItem("dsh.rawHtml")==="1"){try{var vr=window.__vcpStable&&window.__vcpStable.render(n.value,i.streaming);if(vr!==null&&vr!==undefined)return vr}catch(e){}}return n.value}();`

const SCRIPT_FILTER = String.raw`if(i.localName==="script"||i.localName==="iframe"||i.localName==="object"||i.localName==="embed")return null;`

// v6 最终形态（含 onclick 桥 + style 过滤词边界 + href/src 白名单 + ref 锁定）
const VC_V6 = String.raw`for(const c of i.attributes){if(c.name==="onclick"){const m=/^input\s*\(\s*['"]([\s\S]*?)['"]\s*\)\s*;?\s*$/.exec(c.value);if(m)s.onClick=function(){const fn=window.__dshInput;fn&&fn(m[1])};continue}if(/^on/i.test(c.name))continue;if(c.name==="style"){let sv=c.value;sv=sv.replace(/position\s*:\s*fixed\s*;?/gi,"").replace(/z-index\s*:\s*\d{4,}\s*;?/gi,"").replace(/(?<![\w-])content\s*:[^;]*;?/gi,"");s.style=hp(sv);s.ref=function(el){if(el)for(const d of sv.split(";")){const j=d.indexOf(":");if(j===-1)continue;const p=d.slice(0,j).trim(),v=d.slice(j+1).trim();if(v&&/^(color|font-family|font-size|font-weight|font-style|line-height|letter-spacing|text-align|text-shadow)$/.test(p))el.style.setProperty(p,v,"important")}};continue}if(c.name==="class"){s.className=c.value;continue}if(c.name==="href"&&!/^(https?:|mailto:|\/|#)/i.test(c.value))continue;if(c.name==="src"&&!/^(https?:|data:image\/|\/|#)/i.test(c.value))continue;s[c.name]=c.value}`

// 注入 v6 稳定区模块的锚点
const VC_DEF_BEFORE = String.raw`}function vc(n,r){`
const V6_MARK = 'window.__vcpStable'

// ---- 工具 ------------------------------------------------------------------
function countOccurrences(text, needle) {
  return text.split(needle).length - 1
}

/** 精确替换：锚点必须恰好命中 1 次，否则返回 null。 */
function replaceOnce(text, from, to, label) {
  const n = countOccurrences(text, from)
  if (n !== 1) {
    console.error(`[install-v6] 锚点 "${label}" 命中 ${n} 次（需要恰好 1 次）。`)
    return null
  }
  return text.split(from).join(to)
}

/** 区间替换：start 锚点必须恰好 1 次，end 锚点取 start 后第一处；找不到返回 null。 */
function replaceRange(text, startMark, endMark, to, label) {
  const n = countOccurrences(text, startMark)
  if (n !== 1) {
    console.error(`[install-v6] 区间锚点 "${label}" 起点命中 ${n} 次（需要恰好 1 次）。`)
    return null
  }
  const s = text.indexOf(startMark)
  const e = text.indexOf(endMark, s)
  if (e === -1) {
    console.error(`[install-v6] 区间锚点 "${label}" 未找到终点 "${endMark}"。`)
    return null
  }
  const end = e + endMark.length
  return text.slice(0, s) + to + text.slice(end)
}

// ---- 主流程 -----------------------------------------------------------------
function main() {
  const file = findBundle()
  if (!file) {
    console.error('[install-v6] 未自动找到 dsh-web-frontend 的 dist bundle。')
    console.error('[install-v6] 用法: node patch/install-v6.cjs <bundle路径>')
    process.exit(1)
  }

  console.log('[install-v6] bundle:', file)
  let t = fs.readFileSync(file, 'utf8')

  // 幂等：已是 v6
  if (t.includes(V6_MARK)) {
    console.log('[install-v6] 该 bundle 已是 v6（含 window.__vcpStable），无需操作，跳过。')
    return
  }

  // 备份
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const bak = `${file}.bak-installv6-${stamp}`
  fs.copyFileSync(file, bak)
  console.log('[install-v6] 备份:', bak)

  let next = t

  // 1) case"html" 分支 → v6
  if (countOccurrences(next, CASE_ORIG) === 1) {
    next = replaceOnce(next, CASE_ORIG, CASE_V6, 'case"html"(原始)')
  } else if (countOccurrences(next, CASE_ENHANCED_START) === 1 && countOccurrences(next, CASE_ENHANCED_END) >= 1) {
    next = replaceRange(next, CASE_ENHANCED_START, CASE_ENHANCED_END, CASE_V6, 'case"html"(增强态)')
  } else {
    console.error('[install-v6] ✗ case"html" 分支：既非原始态也非已补丁增强态，无法识别。')
    console.error('[install-v6]   可能是 dsh 版本过新导致压缩代码变化，已安全中止（备份已保留，未写入修改）。')
    process.exit(1)
  }
  if (next === null) {
    console.error('[install-v6] case"html" 替换失败，中止（备份已保留）。')
    process.exit(1)
  }
  console.log('[install-v6] ✓ case"html" 分支 → v6')

  // 2) vc() 属性循环 → v6
  if (countOccurrences(next, VC_ORIG) === 1) {
    // 原始态：无 script 过滤，需补上（与 v1 补丁行为一致）
    next = replaceOnce(next, VC_ORIG, SCRIPT_FILTER + VC_V6, 'vc 属性循环(原始)')
  } else if (countOccurrences(next, VC_ENHANCED_START) === 1) {
    next = replaceRange(next, VC_ENHANCED_START, VC_ENHANCED_END, VC_V6, 'vc 属性循环(增强态)')
  } else {
    console.error('[install-v6] ✗ vc 属性循环：既非原始态也非已补丁增强态，无法识别。')
    console.error('[install-v6]   已安全中止（备份已保留，未写入修改）。')
    process.exit(1)
  }
  if (next === null) {
    console.error('[install-v6] vc 属性循环替换失败，中止（备份已保留）。')
    process.exit(1)
  }
  console.log('[install-v6] ✓ vc 属性循环 → v6')

  // 3) 注入 v6 稳定区模块
  let v6Inject = ''
  try {
    v6Inject = fs.readFileSync(path.join(__dirname, 'v6-inject.js'), 'utf8')
  } catch (e) {
    console.error('[install-v6] 读取 patch/v6-inject.js 失败：', e.message)
    process.exit(1)
  }
  next = replaceOnce(next, VC_DEF_BEFORE, '}' + v6Inject + ';function vc(n,r){', 'vc 定义前注入 v6 模块')
  if (next === null) {
    console.error('[install-v6] v6 模块注入失败，中止（备份已保留）。')
    process.exit(1)
  }
  console.log('[install-v6] ✓ vc 定义前注入 v6 稳定区模块')

  // 4) 写回
  fs.writeFileSync(file, next, 'utf8')

  // 5) 健康检查：node --check + v6 特征
  let ok = true
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' })
    console.log('[install-v6] 健康检查通过：node --check OK')
  } catch (e) {
    ok = false
    console.error('[install-v6] 健康检查失败：', String(e.stderr || e.message).split('\n')[0])
  }

  const written = fs.readFileSync(file, 'utf8')
  const features = [
    [V6_MARK, 'v6 标记 window.__vcpStable'],
    ['window.__dshInput', 'onclick 交互桥 __dshInput'],
    [String.raw`(?<![\w-])content`, 'content 词边界正则'],
    ['if(/^on/i.test(c.name))continue;', 'on* 属性安全过滤'],
    ['setProperty(p,v,"important")', '文字属性 !important 锁定'],
  ]
  for (const [mark, label] of features) {
    if (!written.includes(mark)) {
      ok = false
      console.error(`[install-v6] 特征缺失：${label}`)
      const idx = written.indexOf(VC_ENHANCED_START)
      if (idx !== -1) console.error('[install-v6] debug vc 循环附近 >>>', JSON.stringify(written.slice(idx, idx + 260)))
    }
  }
  if (countOccurrences(written, CASE_ORIG) !== 0) {
    ok = false
    console.error('[install-v6] 特征异常：仍存在原始 case"html" 分支')
  }

  if (!ok) {
    fs.copyFileSync(bak, file)
    console.error('[install-v6] 校验未通过，已回滚到备份，未留下损坏产物！')
    process.exit(1)
  }

  console.log('[install-v6] 完成：任意历史状态 → v6 全量补丁已写入')
  console.log('[install-v6] 下一步：重启 dsh 服务 → 浏览器强刷（Ctrl+F5）→ 点「</>」开关开启')
  console.log('[install-v6] 验证：任意 VCP 消息卡片正常渲染；DevTools console 可见 [vcp-stable] 日志')
}

main()
