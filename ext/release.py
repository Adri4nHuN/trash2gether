#!/usr/bin/env python3
"""Új Trash2Gether verzió kiadása.

Használat (a repó gyökeréből):
    python3 ext/release.py patch      1.3 -> 1.3.1
    python3 ext/release.py minor      1.3 -> 1.4
    python3 ext/release.py 2.0        pontosan erre
    python3 ext/release.py rebuild    verzióváltás nélkül csak újraépít

Mit csinál:
  1. átírja a verziót a trash2gether.user.js fejlécében (@version) és a SCRIPT_VERSION sorban;
  2. elkészíti a trash2gether.meta.js-t (csak a fejléc – a Tampermonkey ezt nézi, van-e újabb);
  3. megépíti a böngészőbővítményt (ext/dist: Chrome és Firefox zip);
  4. frissíti az updates.json-t (a Mozillánál aláíratott Firefox-bővítmény ebből frissül).
Utána: git commit + push, és a Tampermonkey-s gépek pár órán belül (vagy kézi „Frissítések keresése”
után azonnal) maguktól frissülnek.
"""
import json, os, re, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SRC = os.path.join(ROOT, 'trash2gether.user.js')
META = os.path.join(ROOT, 'trash2gether.meta.js')
UPD = os.path.join(ROOT, 'updates.json')
REPO = 'Adri4nHuN/trash2gether'
GECKO_ID = 'trash2gether@t2g'

if len(sys.argv) != 2:
    sys.exit(__doc__)
src = open(SRC, encoding='utf-8').read()
cur = re.search(r'^// @version\s+(\S+)$', src, re.M).group(1)
parts = [int(x) for x in cur.split('.')]
arg = sys.argv[1]
if arg == 'patch':
    parts = (parts + [0, 0])[:3]; parts[2] += 1; new = '.'.join(map(str, parts))
elif arg == 'minor':
    new = f'{parts[0]}.{(parts + [0])[1] + 1}'
elif arg == 'rebuild':
    new = cur
elif re.fullmatch(r'\d+(\.\d+){0,3}', arg):
    new = arg
else:
    sys.exit('Ismeretlen verzió: ' + arg)
key = lambda v: [int(x) for x in v.split('.')] + [0] * 4
if arg != 'rebuild' and key(new) <= key(cur):
    sys.exit(f'Az új verzió ({new}) nem nagyobb a mostaninál ({cur}) – a böngészők nem frissítenének.')

src = re.sub(r'^(// @version\s+)\S+$', lambda m: m.group(1) + new, src, count=1, flags=re.M)
src, n = re.subn(r"const SCRIPT_VERSION = '[^']*';", f"const SCRIPT_VERSION = '{new}';", src, count=1)
if not n:
    sys.exit('Nincs SCRIPT_VERSION sor a scriptben.')
open(SRC, 'w', encoding='utf-8').write(src)

head = re.search(r'// ==UserScript==\n.*?// ==/UserScript==\n', src, re.S).group(0)
open(META, 'w', encoding='utf-8').write(head)

subprocess.run([sys.executable, os.path.join(ROOT, 'ext', 'build.py'), SRC, os.path.join(ROOT, 'ext', 'dist')], check=True)

# Firefox önfrissítés: az aláírt .xpi-t a GitHub kiadáshoz kell feltölteni ezen a néven.
upd = {'addons': {GECKO_ID: {'updates': [{'version': new,
        'update_link': f'https://github.com/{REPO}/releases/download/v{new}/trash2gether-{new}.xpi'}]}}}
with open(UPD, 'w', encoding='utf-8') as f:
    json.dump(upd, f, indent=2)
    f.write('\n')

print(f'\n{cur} -> {new} kész. Következő lépések:')
print(f'  git add -A && git commit -m "v{new}" && git tag v{new} && git push && git push --tags')
print('  (bővítmény) a Chrome/Firefox zip az ext/dist mappában; a Firefoxhoz aláíratott .xpi-t a v'
      f'{new} kiadáshoz töltsd fel trash2gether-{new}.xpi néven.')
