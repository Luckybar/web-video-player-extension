# 單手影片控制器 One-Hand Video Controller

超精簡、單手為主的網頁影片控制。在畫面**下半部**蓋左右兩大塊觸控區(手比較好按),底部有一條一直顯示、可單手拖拉的進度條;中間留一條縫,原生的播放/暫停照常點得到。**全螢幕影片也能用。**

## 操作方式

| 手勢 | 動作 |
|------|------|
| **右塊 · 點一下** | 快轉 30 秒 |
| **右塊 · 長按** | 臨時 2 倍速快進,放開手指回到原速 |
| **左塊 · 點一下** | 倒退 30 秒 |
| **左塊 · 長按** | 臨時 0.5 倍速慢放,放開回原速 |
| **底部進度條** | 一直顯示,直接拖到任意位置(單手可拖) |
| **中間縫** | 不攔截,照常點影片叫出原生播放/暫停 |
| **頂部小膠囊** | 暫時關閉/開啟觸控區(要捲動網頁時用) |

觸控區位於畫面下半部、避開最底部的進度條;長按加速採「按住臨時變速、放開回原速」(像 YouTube 按住 2x),不會改動你原本的播放速度設定。全螢幕時控制層會自動跟著移到全螢幕元素上。

適用於任何用標準 HTML5 `<video>` 播放的網頁。

---

## ⚠️ 手機 Chrome 裝不了擴充功能

手機版 Chrome 架構上無法安裝任何擴充功能。因此提供兩種方式:

| 方式 | 適用 | 需換瀏覽器 |
|------|------|-----------|
| **A. 書籤小工具 (bookmarklet)** | 你現在的手機 Chrome ✅ | 不用 |
| **B. 擴充功能 (extension)** | 桌面 Chrome / Edge、Kiwi、Quetta 等 | 需支援擴充功能的瀏覽器 |

**最簡單:用手機打開 `install.html`**,裡面有「一鍵複製書籤」和圖解步驟。

### 方式 A:書籤小工具(手機 Chrome 推薦)

1. 打開 `install.html` → 點「📋 複製書籤程式碼」(或打開 `bookmarklet/bookmarklet.txt` 全選複製)。
2. 手機 Chrome 任一網頁 → 右上 `⋮` → 星號 `☆` 加入書籤。
3. `⋮` → 書籤 → 找到它 → 編輯(鉛筆)。
4. 「網址」欄清空,貼上程式碼,名稱改「單手控制」,存檔。
5. 影片頁在網址列輸入「單手控制」點一下 → 觸控區出現。再點一次收起。

### 方式 B:擴充功能

`extension/` 為標準 Manifest V3。

- 桌面 Chrome / Edge:`chrome://extensions` → 開發人員模式 → 載入未封裝項目 → 選 `extension`。
- Kiwi / Quetta (Android):擴充功能頁 → 開發人員模式 → 從資料夾/zip 載入。

裝好後點工具列 🎬 圖示開啟/收起。

---

## 檔案結構

```
web-video-player-extension/
├─ install.html              ← 從這裡開始(安裝說明 + 一鍵複製書籤)
├─ README.md
├─ src/
│  └─ controller.js          ← 核心邏輯(唯一要維護的檔案)
├─ extension/                ← Manifest V3 擴充功能
│  ├─ manifest.json
│  ├─ background.js
│  ├─ controller.js          ← 由 src/ 複製
│  └─ icons/ (icon48.png, icon128.png)
└─ bookmarklet/
   ├─ controller.min.js
   ├─ bookmarklet.txt         ← javascript: 書籤字串
   └─ build.md                ← 重新產生指令
```

## 想調整參數

打開 `src/controller.js` 最上面的 tweakables:

```js
var JUMP_SECONDS = 30;    // 點一下跳幾秒
var FAST_RATE    = 2;     // 右塊長按的倍速
var SLOW_RATE    = 0.5;   // 左塊長按的倍速
var HOLD_MS      = 220;   // 按多久算「長按」(否則算點擊)
var ZONE_TOP     = '46%'; // 觸控區從畫面多高處開始(數字越大越靠下)
var BAR_SPACE    = 70;    // 底部保留給進度條的高度(px)
```

改完後依 `bookmarklet/build.md` 重新產生 min 與 bookmarklet,並 `cp src/controller.js extension/controller.js`。

## 已知限制

- 觸控區蓋在影片上會攔截該區域的原生手勢;需要捲動網頁或用原生控制時,點底部小膠囊暫時關閉,或點中間縫。
- 少數把影片包在自訂 Web Component / Shadow DOM 或跨網域 iframe 的網站,可能偵測不到 `<video>`。
