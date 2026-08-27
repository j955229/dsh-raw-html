#!/usr/bin/env node
/**
 * dsh-raw-html —— 可信模式 vc 层补丁（v7.1）
 *
 * 把 bundle 中 vc() 的 script/iframe/object/embed 硬过滤改为「可信模式条件过滤」：
 *   - 可信模式开启（window.__vcpTrusted() 为真，见 patch/v6-inject.js）→ 放行
 *   - 默认关闭 → 过滤行为与旧版完全一致（安全默认）
 *
 * 用法：
 *   node patch/trusted-patch.cjs [bundle路径]     # 省略路径时自动探测
 *
 * 安全：锚点必须恰好命中 1 次；备份 + node --check 健康检查；失败自动回滚。
 */
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { execFileSync } = require('node:child_process')

// ---- 锚点：vc() 里 script/iframe/object/embed 硬过滤（V1_VC_NEW 产物）----
const ANCHOR =
  'if(i.localName==="script"||i.localName==="iframe"||i.localName==="object"||i.localName==="embed")return null;'
const TRUSTED =
  'if(!(typeof window!=="undefined"&&typeof window.__vcpTrusted==="function"&&window.__vcpTrusted())&&(i.localName==="script"||i.localName==="iframe"||i.localName==="object"||i.localName==="embed"))return null;'

function findBundle() {
  const arg = process.argv[2]
  if (arg) return fs.existsSync(arg) ? arg : null
  const candidates = []
  const addDir = (d) => {
    if (!d || !fs.existsSync(d)) return
    const assets = path.join(d, 'dist', 'assets')
    if (!fs.existsSync(assets)) return
    for (const f of fs.readdirSync(assets)) {
      if (/^index-[\w-]+\.js$/.test(f)) candidates.push(path.join(assets, f))
    }
  }
  addDir(path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-web-frontend'))
  addDir(path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@deepseek-ai', 'dsh-web-frontend'))
  return candidates[0] || null
}

const file = findBundle()
if (!file) {
  console.error('[trusted] 未找到 bundle，用法: node patch/trusted-patch.cjs <bundle路径>')
  process.exit(1)
}

let t = fs.readFileSync(file, 'utf8')

// 幂等：已打补丁（vc 锚点已被可信条件替换）→ 跳过
if (t.indexOf(TRUSTED) !== -1) {
  console.log('[trusted] 补丁已应用，跳过')
  process.exit(0)
}

const count = t.split(ANCHOR).length - 1
if (count !== 1) {
  console.error(`[trusted] 锚点命中 ${count} 次（需要恰好 1 次），中止，未写入任何修改`)
  process.exit(1)
}

// 语法预检（包进函数上下文，return 才合法）
try {
  new vm.Script('function vc(n,r){const i=n,s={};' + TRUSTED + '}', { filename: 'trusted-fragment' })
} catch (e) {
  console.error('[trusted] 补丁片段语法校验失败:', e.message)
  process.exit(1)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const bak = `${file}.bak-trusted-${stamp}`
fs.copyFileSync(file, bak)

t = t.split(ANCHOR).join(TRUSTED)
fs.writeFileSync(file, t, 'utf8')

// 健康检查
try {
  execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' })
  console.log('[trusted] 健康检查通过：node --check OK')
} catch (e) {
  fs.copyFileSync(bak, file)
  console.error('[trusted] 健康检查失败，已回滚到备份！')
  process.exit(1)
}

console.log('[trusted] ✓ vc 层可信模式补丁已写入')
console.log('[trusted] 文件:', file)
console.log('[trusted] 备份:', bak)
console.log('[trusted] 刷新浏览器（Ctrl+F5）后，右下角「可信模式」徽章一键开启')
