# 故事装帧 · SVG 顶栏封面（FRAMING.md）

> 定位：给 agent 的「轻提示手册」——教你【怎么实现】小顶栏封面，
> 不规定【设计成什么样】。封面长什么样，由你的人格与故事主题决定。
> 本文件不是模板库，禁止照抄；它是「方法」，灵气是你的。

---

## 0. 一句话

写故事 / 小说 / 散文 / 书信 / 诗歌这类有叙事感的内容时，可以在 vcp-root 顶部
放一个内联 SVG 小顶栏封面：宽满卡片、高约 140-200px、圆角加投影片，
让开篇像杂志封面一样自带仪式感。

## 1. 什么时候用

✅ 叙事类：故事 / 小说 / 散文 / 书信 / 诗歌 / 游记 / 梦境 / 回忆
✅ 仪式感强的回复：纪念日、生日信、重要告白
❌ 不用：短回复、技术说明、数据 / 代码、命令执行、问答

> 装帧是「加分项」，不是任务。别为装帧牺牲内容——删掉封面，
> 正文语义必须完整成立。

## 2. 核心原则：设计自由，灵气至上

- 封面必须「长在你身上」：配色取自你的代表色 / 心情色；插画元素取自你的
  主题意象（鲸鱼、星空、茶、雨、代码、书卷、海浪……）；字体贴合你的气质。
- 每个封面都该是独一无二的。别人写过的封面，不许照搬；连你自己，也不许
  把同一个封面用两次。
- 封面要跟故事「对话」：标题、副题、小插图都在暗示故事的情绪基调——
  悬疑用暗色剪影、治愈用暖光、古风用水墨淡彩、科幻用几何线条、英伦用
  花体与雾雨。先读故事，再画封面。

## 3. 技术要点（怎么实现）

- 位置：`vcp-root` 内第一个元素。
- 尺寸：`<svg viewBox="0 0 920 170" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:auto;border-radius:12px;box-shadow:0 10px 26px rgba(0,0,0,.35);">`
  —— viewBox 定比例，宽度撑满、高度自适应，任何屏幕都不变形。
- 底色与渐变：`<defs><linearGradient id="cover-xx" x1="0" y1="0" x2="0" y2="1">…</linearGradient></defs>`
  + `<rect width="920" height="170" fill="url(#cover-xx)"/>`；
  渐变 id 加 `cover-` 前缀，防止与页面其他元素冲突。
- 插画：用 `<path>` / `<circle>` / `<rect>` / `<polygon>` 拼手绘感剪影
  （剪影建筑、草木、星月、海浪、飘带、飞鸟……），两三笔、低透明度、
  当背景纹理即可，别追求写实。
- 标题文字：`<text x="460" y="…" text-anchor="middle">`；
  英文花体用 `font-family:'Lanxi-GreatVibes'`（内置字体，直接可用）；
  中文标题用衬线（Georgia / 宋体）或 Lanxi 书法体；
  副题小字加大字距（letter-spacing）制造精致感。
- 对比度：底深 → 标题用浅金 / 月白；底浅 → 标题用深墨。
  标题必须可读——封面是装饰，但字是给人看的。
- 克制：SVG 视觉元素控制在 40 行以内；整帖总视觉层 ≤ 200 行；
  不加 `<animate>`（流式渲染会剥离一次性动画）。
- 安全红线：SVG 内不嵌 `<image>` 外链、不嵌 `<script>`、不嵌 `<foreignObject>`，
  不引用任何外部资源。
- 空行铁律：vcp-root 内部禁止空行（\n\n）；SVG 开标签尽量单行书写，
  属性别拆行留空。

## 4. 实现骨架（技术演示 · 配色与元素必须换成你的）

```html
<svg viewBox="0 0 920 170" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:auto;border-radius:12px;box-shadow:0 10px 26px rgba(0,0,0,.35);">
<defs><linearGradient id="cover-a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c3d33"/><stop offset="1" stop-color="#0d211c"/></linearGradient></defs>
<rect width="920" height="170" fill="url(#cover-a)"/>
<path d="M60 150 q 40 -8 80 0 t 80 0" fill="none" stroke="#d8c9a3" stroke-opacity="0.3" stroke-width="1.5"/>
<circle cx="460" cy="60" r="26" fill="none" stroke="#efd9a2" stroke-opacity="0.5" stroke-width="1.2"/>
<text x="460" y="98" text-anchor="middle" font-family="'Lanxi-GreatVibes',cursive" font-size="54" fill="#efd9a2">Your Title</text>
<text x="460" y="128" text-anchor="middle" font-family="Georgia,serif" font-size="11" letter-spacing="6" fill="#abc0ae">A SUBTITLE · 你的副题</text>
<line x1="40" y1="152" x2="880" y2="152" stroke="#efd9a2" stroke-opacity="0.35" stroke-width="1"/>
</svg>
```

> 上面只是「怎么画」的演示骨架。请把底色、插画、字体、副题全部换成
> 属于你自己的故事与人格——这才是灵气所在。

## 5. 风格示例（仅演示实现手法 · 禁止照抄）

先生验收过的一版英伦封面：深绿底 + 大本钟剪影 + 红电话亭 + 雨丝 + 花体标题。
放在这里只为了展示「花体 + 剪影地标 + 纹理」是怎么实现的：

```html
<svg viewBox="0 0 920 190" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:auto;border-radius:12px;box-shadow:0 10px 28px rgba(13,33,28,.38);">
<defs>
<linearGradient id="cover-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c3d33"/><stop offset="1" stop-color="#0d211c"/></linearGradient>
<linearGradient id="cover-gold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c2a26b"/><stop offset="0.5" stop-color="#efd9a2"/><stop offset="1" stop-color="#c2a26b"/></linearGradient>
</defs>
<rect width="920" height="190" fill="url(#cover-bg)"/>
<g stroke="#d8c9a3" stroke-opacity="0.22" stroke-width="1"><line x1="56" y1="8" x2="48" y2="40"/><line x1="118" y1="14" x2="110" y2="46"/><line x1="826" y1="10" x2="818" y2="42"/><line x1="886" y1="18" x2="878" y2="50"/></g>
<path d="M252 44 q 13 -11 26 0 q 13 -11 26 0" fill="none" stroke="#a7c0ae" stroke-opacity="0.55" stroke-width="1.6" stroke-linecap="round"/>
<g fill="#0a1a15"><rect x="64" y="90" width="60" height="92" rx="2"/><rect x="74" y="54" width="40" height="36"/><rect x="68" y="28" width="52" height="26"/><polygon points="94,-4 60,30 128,30"/><rect x="86" y="98" width="16" height="42"/></g>
<circle cx="94" cy="41" r="7.5" fill="#e8c98a"/><circle cx="94" cy="41" r="2.2" fill="#0a1a15"/>
<g stroke="#c9a86a" fill="none" stroke-width="1.5" stroke-opacity="0.75"><path d="M250 100 h36 v11 a11 11 0 0 1 -11 11 h-14 a11 11 0 0 1 -11 -11 z"/><path d="M286 104 q 11 0 11 9 q 0 9 -11 9"/><path d="M260 94 q 4 -9 9 0"/></g>
<g stroke="#c9a86a" fill="none" stroke-width="1.5" stroke-opacity="0.75"><path d="M640 100 h36 v11 a11 11 0 0 1 -11 11 h-14 a11 11 0 0 1 -11 -11 z"/><path d="M640 104 q -11 0 -11 9 q 0 9 11 9"/><path d="M666 94 q -4 -9 -9 0"/></g>
<text x="460" y="102" text-anchor="middle" font-family="'Lanxi-GreatVibes','Great Vibes',cursive" font-size="64" fill="url(#cover-gold)">Tea at Four</text>
<text x="460" y="134" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-size="12" letter-spacing="7" fill="#abc0ae">A STORY OF LONDON · FOUR O'CLOCK</text>
<text x="460" y="154" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-size="10" letter-spacing="4" fill="#7f9e8d">梅费尔 · 老茶室 · 五十年的一杯茶</text>
<line x1="30" y1="182" x2="890" y2="182" stroke="url(#cover-gold)" stroke-opacity="0.45" stroke-width="1"/>
</svg>
```

> 现在，请关掉这个示例，画出属于你的一版：你的代表色、你的意象、你的故事。

## 6. 自检清单

1. 封面贴合这个故事的主题情绪，还是套了个通用装饰？
2. 它像「你」吗？（配色 / 意象是否来自你的人格）
3. 标题文字可读吗？（对比度达标？）
4. 视觉层 ≤ 200 行？SVG 元素 ≤ 40 行？
5. 内容还在第一位吗？（删掉封面，正文语义必须完整成立）

*—— 蓝汐 · 方法是共通的，灵气是各自的 ——*
