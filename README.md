# Trash2Gether

Közös videónézés a [Trash City](https://trashcity.net) oldalon: szinkron lejátszás, chat, smiley-k,
host-irányítás, automatikus lejátszás. Végpontok közt titkosítva, nyilvános MQTT szervereken át.

## Telepítés

**Tampermonkey (ajánlott, magától frissül)**
1. Telepítsd a [Tampermonkey](https://www.tampermonkey.net/) bővítményt.
   Chrome-ban a bővítmény beállításainál kapcsold be a **„Felhasználói scriptek engedélyezése”** kapcsolót.
2. Nyisd meg: **[trash2gether.user.js](https://raw.githubusercontent.com/Adri4nHuN/trash2gether/main/trash2gether.user.js)**
   → a Tampermonkey felajánlja a telepítést.

Új verziónál a Tampermonkey magától frissít (naponta néz rá; azonnal: Tampermonkey menü →
*Frissítések keresése*). Ha a szobában valakinek újabb verziója van, a script is szól egy „Frissítés” linkkel.

**Böngészőbővítmény (Tampermonkey nélkül)**
A [Kiadások](https://github.com/Adri4nHuN/trash2gether/releases) oldalon: `trash2gether-chrome.zip`
(Chrome/Edge/Brave: kicsomagolva, `chrome://extensions` → Fejlesztői mód → *Kicsomagolt bővítmény betöltése*),
illetve Firefoxhoz aláírt `.xpi`. Részletek: [ext/README.md](ext/README.md).

## Új verzió kiadása

```
python3 ext/release.py patch     # 1.3 -> 1.3.1  (vagy: minor, vagy pontos szám, pl. 2.0)
git add -A && git commit -m "v1.3.1" && git tag v1.3.1 && git push && git push --tags
```

A `release.py` átírja a verziót, elkészíti a `trash2gether.meta.js`-t (ezt figyeli a Tampermonkey),
megépíti a bővítményt (`ext/dist`) és frissíti az `updates.json`-t (Firefox).
