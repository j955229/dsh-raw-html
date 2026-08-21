# CHANGELOG

本文件记录插件版本（`package.json` 的 `version`）与补丁代号（`patch/*` 注入模块）两条线的演进。

## 0.3.0（当前）

- 补丁代号：**v6**（稳定区固化模块 `patch/v6-inject.js` + 万能安装器 `patch/install-v6.cjs`）
- 2026-08-21 克莉丝审计整改（进化清单落地）：
  - **安全（P0）**：修复 `on*` 事件属性透传缺口——`parseOpen` 与 `VC_V6` 现只放行 `onclick="input('...')"` 桥接，其余 `onerror`/`onload`/`onmouseover`/`onfocus`/`oninput` 等一律拒收（原实现会把它们透传为活的事件处理器）。
  - **性能（P0）**：修复 `[vcp-stable]` 诊断计时器——`t0` 归位到 `render()` 入口，`avg=` 现显示非零毫秒值。
  - **文档（P0）**：修正发布包引用失配——`package.json` `files` 补 `tests`/`VCP-INTERACTIONS.md`/`FRAMING.md`；README 安装入口对齐 v6（`install-v6.cjs`）；发布包补回 `tools/`、`tests/`。
  - **性能（P1）**：`imgConvert`/`sanitizeStyle` 加快速守卫（无 `![` / `<style` 直接返回，省每帧全量正则）。
  - **修复（P1）**：`enhanceMermaid` 拖拽由 document 级监听改为 pointer 事件 + `setPointerCapture`（挂在元素自身，消除长会话监听器泄漏）。
  - **token（P1）**：`buildProtocolText` 协议文本瘦身约 74%（核心铁律 + 排版底线 + 能力速览 + 文件指针，细节下沉到 DESIGN.md / VCP-INTERACTIONS.md / FRAMING.md）。
  - **字体授权（P2 · 5.3）**：内置 12 款商业字库（方正/造字工房/华康）替换为 **7 款开源字体**（霞鹜文楷 GB-Lite / 马善政楷书 / 思源黑体 ×3 字重 / Great Vibes，全部 OFL 授权）；源存 `tools/font-src/`，`subset_fonts.py` 清单已更新，子集化后共约 7.6MB。
  - **代码质量（P2 · 3.1）**：安全过滤器加「两处一致性测试」（`security.test.mjs` 第 6 节），钉住 `parseOpen` 与 `VC_V6` 的过滤正则/逻辑一致，防漂移。
  - **审美（P2 · 2.1）**：DESIGN.md 1.3 补「胶片黄昏」「青瓷素雅」两套色板；协议加「勿趋同单一色板」。
  - **审美（P2 · 2.2）**：协议加「先观察界面明暗再定基底」轻规则（浅色界面勿用深色卡）。
  - **规范（P2 · 5.2）**：README 加「版本」小节，区分插件版本（0.3.0）与补丁代号（v6）。
  - **无障碍（增强 · 2.3）**：注入 `prefers-reduced-motion` CSS 降级——系统开启「减少动态效果」时自动关闭卡片动画/过渡（纯 CSS，不动渲染逻辑，默认用户零影响）。
  - **无障碍（增强 · 2.4）**：VCP-INTERACTIONS.md 交互示例补 `:focus-visible` 焦点态；DESIGN.md 自检清单加第 8 条「键盘焦点态」。
  - **代码质量（增强 · 3.4）**：v6-inject.js 魔数收拢为具名常量（CACHE_MAX / LOG_THROTTLE_MS / MERMAID_CACHE_MAX / MERMAID_MAX_HEIGHT / MERMAID_RETRY_MS / KATEX_RETRY_MAX / KATEX_RETRY_MS / MATH_DEBOUNCE_MS）。

## 历史补丁（v1 → v6）

- **v1**：HTML 渲染 + `onclick` 桥接 + script/iframe/object/embed 过滤
- **v2**：缓存 + 增量加速引擎（vcp-fast）
- **v4/v5**：动画防闪、循环动画（infinite 保留）、安全白名单（URL 协议 / style 危险属性）
- **v6**：稳定区固化模块（容器感知块级增量 + 流式尾巴占位）
- **v6.12+**：KaTeX 数学公式 + Mermaid 查看器 + SVG 流式占位

> 详细血泪与演进见 `PROGRESS.md`（会话交接文档）。
