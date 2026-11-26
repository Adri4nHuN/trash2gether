# Trash2Gether böngészőbővítmény

A bővítmény ugyanaz a kód, mint a userscript, csak Tampermonkey nélkül fut. A forrás a repó gyökerében
lévő `trash2gether.user.js`; a bővítményt ebből építi a `build.py` (kiadáskor a `release.py` hívja meg).

## Telepítés

**Chrome, Edge, Brave, Opera (Chrome 111+)**
1. Csomagold ki a `trash2gether-chrome.zip`-et egy mappába (ez a mappa maradjon meg).
2. `chrome://extensions` → jobb fent **Fejlesztői mód** be.
3. **Kicsomagolt bővítmény betöltése** → válaszd ki a mappát.

Így betöltve nem frissül magától: új verziónál a mappa tartalmát kell lecserélni, majd a
`chrome://extensions` oldalon a bővítmény frissítés (↻) gombjára kattintani.

**Firefox (128+)**
- Kipróbáláshoz: `about:debugging#/runtime/this-firefox` → **Ideiglenes kiegészítő betöltése…** → válaszd a
  `trash2gether-firefox.zip`-et. Ez a Firefox újraindításáig marad.
- Végleges telepítéshez a Firefox csak aláírt kiegészítőt fogad el: töltsd fel az addons.mozilla.org-ra
  **„On your own” (saját terjesztés)** módban. Ingyenes, nem lesz nyilvános, és egy aláírt `.xpi`-t kapsz.
  Ha az aláírt `.xpi`-t a GitHub-kiadáshoz `trash2gether-<verzió>.xpi` néven feltöltöd, a telepített
  bővítmény a repó `updates.json` fájlja alapján magától frissül.

Ha a userscript is telepítve van, az sem baj: csak az egyik fut. Érdemes a Tampermonkeyben kikapcsolni.

## Építés

```
python3 ext/release.py patch     # új verzió: verziószám, meta.js, updates.json és a bővítmény
python3 ext/release.py rebuild   # verzióváltás nélkül csak újraépít
python3 ext/build.py             # csak a bővítmény (ext/dist)
```

A név, a verzió, a leírás és az oldalak listája a userscript fejlécéből jön. Az `mqtt.min.js` ugyanaz a
fájl, amit a userscript `@require`-ja tölt; a build ellenőrzi, hogy egyezik-e az ott megadott sha256
ellenőrzőösszeggel, és azt is, hogy a fejléc `@version` sora és a kód `SCRIPT_VERSION` értéke egyezik.
