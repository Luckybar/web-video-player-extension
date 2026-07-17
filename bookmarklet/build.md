# 重新產生 bookmarklet

改完 `src/controller.js` 後執行:

```bash
# 1. 壓縮
npx terser src/controller.js -c -m -o bookmarklet/controller.min.js

# 2. 產生 bookmarklet.txt (javascript: 字串)
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

`install.html` 內嵌了 bookmarklet 字串,若重建請一併把新的 `bookmarklet.txt` 內容更新進去
(搜尋 install.html 裡的 `javascript:` 字串替換,或重跑當初的產生腳本)。
