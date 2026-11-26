# Trash2Gether böngészőbővítmény

A bővítmény ugyanaz a kód, mint a userscript, csak Tampermonkey nélkül fut. A forrás továbbra is
a `trashcity-watch-together.user.js`: módosítás után a `build.py` újraépíti belőle a bővítményt.

## Telepítés

**Chrome, Edge, Brave, Opera (Chrome 111+)**
1. Csomagold ki a `trash2gether-chrome.zip`-et egy mappába (ez a mappa maradjon meg).
2. `chrome://extensions` → jobb fent **Fejlesztői mód** be.
3. **Kicsomagolt bővítmény betöltése** → válaszd ki a mappát.

**Firefox (128+)**
- Kipróbáláshoz: `about:debugging#/runtime/this-firefox` → **Ideiglenes kiegészítő betöltése…** → válaszd a
  `trash2gether-firefox.zip`-et. Ez a Firefox újraindításáig marad.
- Végleges telepítéshez a Firefox csak aláírt kiegészítőt fogad el: töltsd fel az addons.mozilla.org-ra
  **„Saját terjesztés” (unlisted)** módban. Ingyenes, nem lesz nyilvános, és egy aláírt `.xpi`-t kapsz,
  amit bárki telepíthet.

Ha a userscript is telepítve van, az sem baj: csak az egyik fut. Érdemes a Tampermonkeyben kikapcsolni.

## Újraépítés

```
python3 build.py [userscript.user.js] [kimeneti mappa]
```

Alapból a `../trashcity-watch-together.user.js`-ből a `dist/` mappába épít. A név, a verzió, a leírás és
az oldalak listája a userscript fejlécéből jön. Az `mqtt.min.js` ugyanaz a fájl, amit a userscript
`@require`-ja tölt; a build ellenőrzi, hogy egyezik-e az ott megadott sha256 ellenőrzőösszeggel.
Új verzió kiadásakor a userscript `@version` sorát kell átírni, a bővítmény verziója abból jön
(a böngészők csak nagyobb verziószámot frissítenek).
