# 重新產生 bookmarklet

改完 `src/controller.js` 後,依序執行:

```bash
# 1. 同步擴充功能用的副本
cp src/controller.js extension/controller.js

# 2. 壓縮
npx terser src/controller.js -c -m -o bookmarklet/controller.min.js

# 3. 產生 bookmarklet.txt (javascript: 字串)
python3 - <<'PY'
import urllib.parse
code = open('bookmarklet/controller.min.js','r',encoding='utf-8').read().strip()
if not code.endswith(';'): code += ';'
code += 'void 0;'
bm = 'javascript:' + urllib.parse.quote(code, safe="")
open('bookmarklet/bookmarklet.txt','w',encoding='utf-8').write(bm)
print('len', len(bm))
PY
```

`install.html` 內嵌了 bookmarklet 字串。重建後若要更新安裝頁,把 `install.html` 裡
那段 `javascript:...` 換成新的 `bookmarklet.txt` 內容(共有兩處:href 與 `var BM`)。
