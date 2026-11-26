#!/usr/bin/env python3
"""Trash2Gether böngészőbővítmény építése a userscriptből.

Használat:  python3 ext/build.py [userscript.user.js] [kimeneti mappa]   (alapból: ../trash2gether.user.js -> ext/dist)
Eredmény:   <kimenet>/chrome/  és  <kimenet>/firefox/  (kicsomagolva, betölthető)
            <kimenet>/trash2gether-chrome.zip, <kimenet>/trash2gether-firefox.zip

A userscript marad az egyetlen forrás: a fejlécéből jön a név, verzió, leírás és az oldalak listája,
a törzse változatlanul kerül a bővítménybe. Az mqtt.js ugyanaz a fájl, amit a userscript @require-ja tölt
(az ellenőrzőösszeget is ellenőrizzük), csak itt a bővítménnyel együtt van csomagolva.
"""
import hashlib, json, os, re, shutil, sys, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'trash2gether.user.js')
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, 'dist')
MQTT = os.path.join(HERE, 'mqtt.min.js')
ICONS = os.path.join(HERE, 'icons')
GECKO_ID = 'trash2gether@t2g'
REPO = 'Adri4nHuN/trash2gether'

src = open(SRC, encoding='utf-8').read()
m = re.search(r'// ==UserScript==\n(.*?)// ==/UserScript==\n', src, re.S)
if not m:
    sys.exit('Nincs userscript fejléc: ' + SRC)
meta = {}
for line in m.group(1).splitlines():
    mm = re.match(r'//\s*@(\S+)\s+(.*\S)', line)
    if mm:
        meta.setdefault(mm.group(1), []).append(mm.group(2))
body = src[m.end():]
sv = re.search(r"const SCRIPT_VERSION = '([^']*)';", body)
if not sv or sv.group(1) != meta['version'][0]:
    sys.exit('A @version és a SCRIPT_VERSION nem egyezik – használd az ext/release.py-t.')
# a bővítményben a frissítés-értesítő a kiadások oldalára mutasson (a .user.js linkje a Tampermonkey-nek szól)
body = re.sub(r"const UPDATE_URL = '[^']*';", f"const UPDATE_URL = 'https://github.com/{REPO}/releases/latest';", body, count=1)

# az mqtt.js egyezzen a userscript által kért (sha256-tal rögzített) változattal
req = [r for r in meta.get('require', []) if 'mqtt' in r]
want = re.search(r'sha256=([0-9a-f]{64})', req[0]).group(1) if req else None
mq = open(MQTT, 'rb').read()
if want and hashlib.sha256(mq).hexdigest() != want:
    sys.exit('Az ext/mqtt.min.js nem egyezik a userscript @require ellenőrzőösszegével.')


def manifest(firefox):
    mf = {
        'manifest_version': 3,
        'name': meta['name'][0],
        'version': meta['version'][0],
        'description': meta.get('description', [''])[0],
        'icons': {s: f'icons/icon{s}.png' for s in ('16', '32', '48', '128')},
        'content_scripts': [{
            'matches': meta['match'],
            'exclude_matches': meta.get('exclude', []),
            'js': ['mqtt.min.js', 't2g.js'],
            'run_at': 'document_idle',
            # Ugyanaz a környezet, mint a userscript @grant none beállításával: az oldal saját világa.
            'world': 'MAIN',
            'all_frames': False,
        }],
    }
    if firefox:
        # a content script "world": "MAIN" Firefoxban a 128-as verziótól működik
        mf['browser_specific_settings'] = {'gecko': {'id': GECKO_ID, 'strict_min_version': '128.0',
                                                     # aláírt, saját terjesztésű változat innen frissül (release.py írja)
                                                     'update_url': f'https://raw.githubusercontent.com/{REPO}/main/updates.json',
                                                     'data_collection_permissions': {'required': ['none']}}}
    else:
        mf['minimum_chrome_version'] = '111'
    return mf


os.makedirs(OUT, exist_ok=True)
for kind in ('chrome', 'firefox'):
    d = os.path.join(OUT, kind)
    shutil.rmtree(d, ignore_errors=True)
    os.makedirs(os.path.join(d, 'icons'))
    with open(os.path.join(d, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest(kind == 'firefox'), f, ensure_ascii=False, indent=2)
    shutil.copy(MQTT, os.path.join(d, 'mqtt.min.js'))
    with open(os.path.join(d, 't2g.js'), 'w', encoding='utf-8') as f:
        f.write('// ' + meta['name'][0] + ' ' + meta['version'][0] + ' – a userscriptből építve (ext/build.py)\n' + body)
    for s in ('16', '32', '48', '128'):
        shutil.copy(os.path.join(ICONS, f'icon{s}.png'), os.path.join(d, 'icons', f'icon{s}.png'))
    z = os.path.join(OUT, f'trash2gether-{kind}.zip')
    with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, _, files in os.walk(d):
            for fn in sorted(files):
                p = os.path.join(root, fn)
                zf.write(p, os.path.relpath(p, d))
    print('kész:', d, '+', z)
