# 單手影片控制器 One-Hand Video Controller

在手機上單手更容易控制網頁影片。控制列固定在畫面**下半部（拇指區）**，按鈕都很大，可切左右手。

功能：播放/暫停、⏪⏩ 快轉倒退 10 秒、🐢🐇 播放速度（0.5x–3x）、🔉🔊 音量、🔇 靜音、🌙 螢幕變暗（替代亮度）、⛶ 全螢幕、可拖曳進度條、🎬 可拖曳的浮動啟動鈕。

適用於任何用標準 HTML5 `<video>` 播放的網頁（YouTube 手機版、一般影片站等）。

---

## ⚠️ 先讀這個：手機 Chrome 的現實

**手機版 Chrome（Android/iOS）在架構上無法安裝任何擴充功能**，這是 Google/Apple 的限制，沒有例外。因此本專案提供兩種安裝方式：

| 方式 | 適用 | 是否需換瀏覽器 |
|------|------|----------------|
| **A. 書籤小工具 (bookmarklet)** | 你現在的手機 Chrome ✅ | 不用 |
| **B. 擴充功能 (extension)** | 桌面 Chrome / Edge、Kiwi、Quetta、Firefox 等 | 需支援擴充功能的瀏覽器 |

> 想在原生手機 Chrome 上用 → 選 **方式 A**。這是唯一可行的做法，體驗和擴充功能一模一樣，只差在要手動從網址列點一下書籤來啟動。

**最簡單的安裝入口：直接打開 `install.html`**（用手機瀏覽器打開這個檔案），裡面有「一鍵複製書籤」按鈕和圖解步驟。

---

## 方式 A：書籤小工具（手機 Chrome 推薦）

1. 用手機打開本資料夾裡的 **`install.html`**，點「📋 複製書籤程式碼」。
   （或直接打開 `bookmarklet/bookmarklet.txt`，全選複製整段。）
2. 手機 Chrome 任一網頁 → 右上 `⋮` → 星號 `☆` 加入書籤。
3. `⋮` → **書籤** → 找到剛剛的書籤 → **編輯（鉛筆）**。
4. 把「網址」欄位清空，**貼上**剛剛複製的程式碼，名稱改成「單手控制」，存檔。
5. 之後在任何影片頁，於**網址列輸入「單手控制」**，點出現的書籤 → 控制列從下方跳出。再點一次可收起。

> 桌面 Chrome 使用者：打開 `install.html`，把「🎬 單手控制」按鈕直接拖到書籤列即可。

## 方式 B：擴充功能

`extension/` 是標準 Manifest V3 擴充功能。

- **桌面 Chrome / Edge**：`chrome://extensions` → 開「開發人員模式」→「載入未封裝項目」→ 選 `extension` 資料夾。
- **Kiwi Browser (Android)**：`⋮` → Extensions → 開「開發人員模式」→ 從資料夾/zip 載入。
- **Quetta Browser (Android)**：設定 → 擴充功能 → 本機載入。

安裝後點瀏覽器工具列的 🎬 圖示叫出/收起控制列。

---

## 檔案結構

```
web-video-player-extension/
├─ install.html              ← 從這裡開始（安裝說明 + 一鍵複製書籤）
├─ README.md
├─ src/
│  └─ controller.js          ← 核心控制邏輯（唯一要維護的檔案）
├─ extension/                ← Manifest V3 擴充功能
│  ├─ manifest.json
│  ├─ background.js          ← 點圖示時注入 controller.js
│  ├─ controller.js          ← 由 src/ 複製而來
│  └─ icons/ (icon48.png, icon128.png)
└─ bookmarklet/
   ├─ controller.min.js      ← 壓縮版
   ├─ bookmarklet.txt        ← 完整的 javascript: 書籤字串
   └─ build.md               ← 重新產生 bookmarklet 的指令
```

## 修改後如何重建

核心只有一個檔案 `src/controller.js`。改完後：

```bash
# 1) 更新擴充功能用的副本
cp src/controller.js extension/controller.js

# 2) 重新壓縮並產生 bookmarklet（需要 node/npx）
npx terser src/controller.js -c -m -o bookmarklet/controller.min.js
# 然後用 bookmarklet/build.md 裡的小段 python 產生 bookmarklet.txt 與 install.html
```

## 已知限制

- **亮度**：手機真正的螢幕亮度屬於作業系統層級，網頁無法控制，因此「🌙 暗」是用半透明黑色遮罩把畫面調暗（適合夜間護眼），不是真的降低背光。
- **音量**：部分行動瀏覽器（尤其 iOS Safari）會忽略網頁設定的音量、由硬體音量鍵控制；此時音量鈕可能無效，但靜音仍可用。
- 少數把影片包在自訂 Web Component / Shadow DOM 或跨網域 iframe 裡的網站，可能偵測不到 `<video>`。
