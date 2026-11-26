// ==UserScript==
// @name         Trash2Gether
// @namespace    t2g
// @version      1.5
// @description  Üdvözlendő hír hete
// @match        https://trashcity.net/*
// @match        https://www.trashcity.net/*
// @exclude      https://trashcity.net/embed/*
// @exclude      https://www.trashcity.net/embed/*
// @require      https://cdn.jsdelivr.net/npm/mqtt@5.16.1/dist/mqtt.min.js#sha256=75873d04a6400bbbac093b3602caf06f44ed92ee032925e1f4f21c03eba05a4e
// @noframes
// @grant        none
// @run-at       document-idle
// @homepageURL  https://github.com/Adri4nHuN/trash2gether
// @updateURL    https://raw.githubusercontent.com/Adri4nHuN/trash2gether/main/trash2gether.meta.js
// @downloadURL  https://raw.githubusercontent.com/Adri4nHuN/trash2gether/main/trash2gether.user.js
// ==/UserScript==

(function () {
  'use strict';
  // A jelző a lapon (DOM) van, nem csak a script saját világában: így ha a userscript és a böngészőbővítmény
  // is telepítve van, csak az egyik fut.
  const de = document.documentElement;
  if (window.__trash2gether || de.hasAttribute('data-trash2gether')) return;
  window.__trash2gether = true;
  de.setAttribute('data-trash2gether', '');

  // A fejléc @version sorával egyezzen (a release.py mindkettőt egyszerre írja át).
  const SCRIPT_VERSION = '1.5';
  // Ha valaki a szobában újabb változatot használ, felajánljuk a frissítést. A Tampermonkey a .user.js címet
  // megnyitva rögtön a frissítő oldalát mutatja; a bővítmény-kiadásban ez a projekt oldalára mutat (build.py).
  const UPDATE_URL = 'https://raw.githubusercontent.com/Adri4nHuN/trash2gether/main/trash2gether.user.js';
  // Saját frissítés-figyelés: a Tampermonkey alapból csak naponta egyszer néz rá, ezért mi is megnézzük (legfeljebb
  // félóránként) a kiadott fejlécet, és ha újabb van, szólunk egy kattintható értesítéssel.
  const META_URL = 'https://raw.githubusercontent.com/Adri4nHuN/trash2gether/main/trash2gether.meta.js';
  // Több nyilvános MQTT szerverre kapcsolódunk egyszerre, és mindegyikre ugyanazt küldjük; elég, ha kettőnek van
  // közös szervere. A népszerű HaGeZi DNS-/reklámszűrő listák (Pi-hole, AdGuard Home, NextDNS, uBlock Origin-be
  // importálva) tiltják a broker.emqx.io-t (és a HiveMQ-t is), aki ilyet használ, a többin át van a szobában.
  // Az Eclipse szerver böngészős (WebSocket) elérése 2026 végén nem működött, ezért jött a Mosquitto; az Eclipse a
  // helyén marad (a sorrend a régebbi változatokkal közös), ha visszajön, azt is használjuk. A Mosquitto nem küldi
  // el a „végakaratot”, ott a lezárt lapot a búcsúüzenet és a jelenlét lejárta jelzi.
  const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://mqtt.eclipseprojects.io:443/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];
  // tcwt10: aláírt üzenetek. A régebbi (aláírás nélküli) változatok más csatornán vannak, nem keverednek.
  const PREFIX = 'tcwt10/', OLD_PREFIX = 'tcwt9/';
  const KDF_SALT = 'trash2gether-room-v9';
  const KDF_ITER = 200000;
  const BEAT_MS = 4000;
  const HARD_DRIFT = 1.0;
  const SOFT_DRIFT = 0.15;
  const PRECISE_DRIFT = 0.35;
  const NAME_SAFETY = 100;
  const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&display=swap';
  const YT_FONT = 'https://fonts.cdnfonts.com/s/66594/YouTubeSans';

  const SMILEY_BASE = 'https://trashcity.net/smiley/';
  const SMILEYS = [
    'kacsacs%C5%91r-balra-z%C3%A1r%203.png', '(y).png', 'kacsacs%C5%91r-balra-nyit%20kettospont%20(.png',
    'kettospont%20@.png', 'kettospont%20).png', 'kettospont%20D.png', 'XD.png', "kettospont%20'D.png", ';).png',
    '%5E.png', 'kettospont%20csillag.png', 'B).png', 'kettospont%20I.png', 'kettospont%20perjel.png',
    'kettospont%20(.png', "kettospont%20'(.png", 'kettospont%20P.png', 'kettospont%20O.png', 'Oo.png',
    'kett%C5%91s%20boh%C3%B3c.png', 'mutogass.png', 'izomlaca.png', 'filmkill.png', 'hete.png', 'tiborsz3.png',
    'tibik%C3%A9s.png', 'jutka.png', 'b%C3%A9ka.png', 'sodr%C3%A1k2.png', 'sodi.png', 'pedo.png', 'meleg.png',
    'v%C3%ADv%C3%ADv%C3%AD.png', 'izom.png', 'polos.png', 'ananasz.png', 'gyulus2.png', 'toj%C3%A1s.png',
    'vk%C3%A1.png', 't%C3%B6kf%C5%91zi2.png', 'trutyi2.png', 'cica.png', 'martin.png', 'gun.png', 'p%C3%A9nz.png',
    'rend%C5%91r.png', 'ufo.png', 'illumi.png', 'hsp.png', 'hiba.png', 'skizo.png', 'f%C3%BCl%C5%B1.png', 'ali.png',
    'kamera.png', 'kett%C5%91spont%20x.png', 'bleh.png', 'erno.png', 'kifli.png', 'kiki.png', 'depi.png',
    'bariadd.png', 'diki.png', 'xpontx.png', 'kaki.png'
  ];
  const SMILEY_SET = new Set(SMILEYS);
  const TOKEN = /\[s:([^\]\s]{1,80})\]/g;   // smiley a szövegben: [s:fájlnév]

  // Ugyanazok a gépelhető kódok, amiket a Trash City hozzászólásai is átalakítanak (kipróbálva az oldalon).
  const SMILEY_SYMBOLS = {
    '<3': 'kacsacs%C5%91r-balra-z%C3%A1r%203.png', '(y)': '(y).png', '>:(': 'kacsacs%C5%91r-balra-nyit%20kettospont%20(.png',
    ':@': 'kettospont%20@.png', ':)': 'kettospont%20).png', ':D': 'kettospont%20D.png', 'XD': 'XD.png',
    ":'D": "kettospont%20'D.png", ';)': ';).png', '^^': '%5E.png', ':*': 'kettospont%20csillag.png', 'B)': 'B).png',
    ':I': 'kettospont%20I.png', ':(': 'kettospont%20(.png', ":'(": "kettospont%20'(.png", ':P': 'kettospont%20P.png',
    ':O': 'kettospont%20O.png', ':x': 'kett%C5%91spont%20x.png', 'x.x': 'xpontx.png'
  };
  // A szavas smiley-k kettősponttal kezdődnek (pl. :hete). Ékezet nélkül és a végén lévő szám nélkül is elfogadjuk.
  const smileyName = f => { try { return decodeURIComponent(f).replace(/\.png$/i, ''); } catch (e) { return f; } };
  const fold = w => w.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const SMILEY_WORDS = new Map();
  SMILEYS.forEach(f => {
    const n = smileyName(f);
    if (/kettospont|kettőspont|kacsacs|^[^a-zá-ű]|^(XD|Oo|B\)|\(y\))$/i.test(n)) return;
    const base = n.toLowerCase().replace(/\s+/g, '');
    [base, base.replace(/\d+$/, ''), fold(base), fold(base).replace(/\d+$/, '')].forEach(a => { if (a && !SMILEY_WORDS.has(':' + a)) SMILEY_WORDS.set(':' + a, f); });
  });
  SMILEY_WORDS.set(':bohóc', 'kett%C5%91s%20boh%C3%B3c.png');
  SMILEY_WORDS.set(':bohoc', 'kett%C5%91s%20boh%C3%B3c.png');
  const SYMBOL_MAP = new Map(Object.entries(SMILEY_SYMBOLS));
  function codesToSmileys(text) {
    let count = (text.match(TOKEN) || []).length;
    return text.split(/(\s+)/).map(tok => {
      if (!tok || /^\s+$/.test(tok) || count >= 30) return tok;
      const sym = SYMBOL_MAP.get(tok);
      if (sym) { count++; return '[s:' + sym + ']'; }
      const mm = /^(:[^\s.,!?]+)([.,!?]*)$/.exec(tok);
      const f = mm && SMILEY_WORDS.get(mm[1].toLowerCase());
      if (f) { count++; return '[s:' + f + ']' + mm[2]; }
      return tok;
    }).join('');
  }
  const smileyUrl = f => SMILEY_BASE + f;

  const mk = get => ({
    get: k => { try { return get().getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { get().setItem(k, v); } catch (e) {} },
    del: k => { try { get().removeItem(k); } catch (e) {} }
  });
  const store = mk(() => localStorage);
  const sess = mk(() => sessionStorage);
  // videókártyák adatai (lásd parseVideoPage)
  const VI_KEY = 'tcwt_vi3', VI_MAX = 40;   // 3: kategóriák is (a régebbi tárolt adatokból hiányoznak)
  try { sessionStorage.removeItem('tcwt_vi'); sessionStorage.removeItem('tcwt_vi2'); } catch (e) {}
  let vinfo = readSessJSON(VI_KEY);
  if (!vinfo || typeof vinfo !== 'object' || Array.isArray(vinfo)) vinfo = {};
  const viPending = new Set(), viWait = [], cardRec = new WeakMap();
  let viLeft = 16, viActive = 0;

  const rand = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => (b % 36).toString(36)).join('');
  const vidId = p => String(p || '').match(/^\/video\/(\d+)/)?.[1] || null;
  const sameVideo = (a, b) => !!vidId(a) && vidId(a) === vidId(b);
  const noDots = p => !/\/\.|%2e/i.test(p);
  const videoPath = p => typeof p === 'string' && p.length < 400 && /^\/video\/\d+(?:\/[^\s?#\\/]*)?$/.test(p) && noDots(p) ? p : null;
  // Nagyon hosszú (sok ékezetes, kódolt betűs) vagy szokatlan címnél a többiek elvetnék az útvonalat – ilyenkor
  // a rövid /video/<id> formát küldjük, azt is kiszolgálja az oldal.
  const VPATH = vidId(location.pathname) ? (videoPath(location.pathname) || '/video/' + vidId(location.pathname)) : null;
  // Videóváltáskor ?t= paraméterrel nyitjuk meg az oldalt (a Trash City lejátszója ebből indul, és így nem a
  // saját mentett pozíciódra ugrik). Mire ez lefut, a lejátszó már beolvasta, ezért kivesszük a címből.
  const URL_T = /[?&]t=/.test(location.search);
  // A Trash City lejátszója a 4 percnél hosszabb videóknál megjegyzi, hol hagytad abba, és onnan folytatja.
  // Ha ez a hely a videó legvége (pl. mert a szinkron a host végén 0,25 mp-cel a vége előtt tartotta a videót),
  // a videó megnyitáskor rögtön véget ér, és az automatikus lejátszás azonnal továbbugrik: ezt javítjuk.
  const RESUME_KEY = VPATH ? 'videoPlaybackPosition_' + vidId(VPATH) : '';
  const resumeAt = (() => { try { return RESUME_KEY ? parseFloat(localStorage.getItem(RESUME_KEY)) : NaN; } catch (e) { return NaN; } })();
  if (VPATH && sess.get('tcwt_tq') === vidId(VPATH) && /[?&]t=/.test(location.search)) {
    const q = new URLSearchParams(location.search);
    q.delete('t');
    const qs = q.toString();
    history.replaceState(history.state, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  }
  sess.del('tcwt_tq');
  const TITLE_MAX = 150;
  const cut = (s, n) => s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
  const pageTitle = () => cut(document.title.replace(/\s*-\s*Trash City\s*$/i, '').trim(), TITLE_MAX);
  function pageLabel() {
    const p = location.pathname.replace(/\/+$/, '');
    if (!p) return 'Kezdőlap';
    const u = p.match(/^\/user\/([^/]+)$/);
    if (u) { try { return decodeURIComponent(u[1]) + ' profilja'; } catch (e) {} }
    const h1 = document.querySelector('.well-filters h1');
    const t = h1 && h1.textContent.replace(/\s+/g, ' ').trim();
    return cut(t || pageTitle(), TITLE_MAX);
  }
  const clean = (s, n) => String(s ?? '?').replace(/[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u180e\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb]/g, '').slice(0, n || NAME_SAFETY);
  const nameChars = s => String(s || '').replace(/[^\p{L}\p{N} ._'!?()-]/gu, '').slice(0, 40);
  const cleanName = s => clean(s).replace(/\u{1F451}/gu, '').replace(/\(te\)\s*$/i, '').trim() || '?';
  const norm = s => String(s || '').trim().toLowerCase();
  const getVideo = () => VPATH ? (document.querySelector('video#video, .video-container video, .video-js video, video.vjs-tech') || document.querySelector('video')) : null;

  let cid = '';   // az eszköz azonosítója: a saját kulcsából számolódik (lent, idReady)
  const sid = rand(10);
  let tabId = sess.get('tcwt_tab');
  if (!tabId) { tabId = rand(10); sess.set('tcwt_tab', tabId); }
  const bc = (() => { try { return typeof BroadcastChannel === 'function' ? new BroadcastChannel('tcwt') : null; } catch (e) { return null; } })();
  const tabReady = new Promise(res => {
    if (!bc) { res(); return; }
    const nonce = rand(8);
    const onDup = e => { const d = e.data || {}; if (d.t === 'dup' && d.n === nonce) { tabId = rand(10); sess.set('tcwt_tab', tabId); } };
    bc.addEventListener('message', onDup);
    bc.postMessage({ t: 'who', tab: tabId, n: nonce });
    setTimeout(() => { bc.removeEventListener('message', onDup); res(); }, 250);
  });
  const ACTIVE_MS = 10 * 60 * 1000;

  let name = (store.get('tcwt_name') || '').trim();
  let acct = null, myUi = null;
  let client = null, room = '', isHost = false, connectedAt = 0;
  let locked = false, lockV = 0, lastState = null;
  let hostRec = null, hostGoneSince = 0, hostByeAt = 0, hostConfirmed = false, justMigrated = false;
  const HOST_GRACE = 20000;
  let roomV = videoPath(sess.get('tcwt_hv')), roomVT = roomV ? clean(sess.get('tcwt_hvt') || '', TITLE_MAX) : '', stateSeen = false;
  let sendTimer = null, hooked = null, pending = null, metaWait = false;
  let goneMsg = '', byeMsg = '', byeAt = 0, navIntent = 0;
  const expect = { play: 0, pause: 0, seek: 0 };
  let expectTimer = null;
  // A következő képkockánál rajzolunk; de ha a böngésző épp nem rajzol (pl. teljesen eltakart ablak, beágyazott
  // panel), a requestAnimationFrame nem fut le – ilyenkor időzítő a tartalék, hogy a lista azért frissüljön.
  const nextFrame = f => {
    if (document.hidden) { setTimeout(f, 30); return; }
    let done = false;
    const run = () => { if (!done) { done = true; f(); } };
    requestAnimationFrame(run);
    setTimeout(run, 150);
  };
  function expectEv(k) {
    expect[k] = 1;
    clearTimeout(expectTimer);
    expectTimer = setTimeout(function clear() {
      if (document.hidden) { expectTimer = setTimeout(clear, 1000); return; }
      expect.play = expect.pause = expect.seek = 0;
    }, 3000);
  }
  function consume(k) { if (expect[k] > 0) { expect[k] = 0; return true; } return false; }
  let unread = 0, panelOpen = false, navigating = false;
  const members = new Map();
  const ownTabs = new Set();

  let roomKey = null, roomTopic = '';
  const T = s => PREFIX + roomTopic + '/' + s;
  const enc = new TextEncoder(), dec = new TextDecoder();
  // Natív base64 (Chrome 140+, Firefox 133+, Safari 18.2+), régebbi böngészőn a klasszikus út.
  const toB64 = typeof Uint8Array.prototype.toBase64 === 'function' ? u8 => u8.toBase64()
    : u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
  const fromB64 = typeof Uint8Array.fromBase64 === 'function' ? s => Uint8Array.fromBase64(s)
    : s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const keyJobs = new Map();
  function deriveRoom(code) {
    if (!keyJobs.has(code)) {
      const job = deriveRoomNow(code);
      keyJobs.set(code, job);
      job.catch(() => keyJobs.delete(code));
    }
    return keyJobs.get(code);
  }
  async function deriveRoomNow(code) {
    let bits = null;
    try { const c = store.get('tcwt_k_' + code) || sess.get('tcwt_k_' + code); if (c) bits = fromB64(c); } catch (e) {}
    if (!bits || bits.length !== 48) {
      const base = await crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveBits']);
      bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(KDF_SALT), iterations: KDF_ITER }, base, 384));
    }
    store.set('tcwt_k_' + code, toB64(bits));
    const topic = Array.from(bits.subarray(0, 16), b => b.toString(16).padStart(2, '0')).join('');
    const key = await crypto.subtle.importKey('raw', bits.subarray(16), 'AES-GCM', false, ['encrypt', 'decrypt']);
    return { topic, key };
  }
  async function seal(str, sub, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(sub) }, key, enc.encode(str)));
    return toB64(iv) + '.' + toB64(ct);
  }
  async function unseal(str, sub, key) {
    const i = str.indexOf('.');
    if (i < 1) return null;
    try {
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(str.slice(0, i)), additionalData: enc.encode(sub) }, key, fromB64(str.slice(i + 1)));
      return dec.decode(pt);
    } catch (e) { return null; }
  }

  // ---------- Aláírás. Minden eszköznek saját ECDSA kulcspárja van (a böngészőben marad), az eszköz azonosítója
  // a nyilvános kulcs ujjlenyomata, és minden üzenet alá van írva. Így a szoba kódjával sem lehet más nevében
  // írni: hostnak, kitiltónak, kirúgónak kiadni magát, más búcsúját vagy chatüzenetét hamisítani.
  const SIG_KEY = { name: 'ECDSA', namedCurve: 'P-256' }, SIG_ALG = { name: 'ECDSA', hash: 'SHA-256' };
  const fpOf = async pk => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', fromB64(pk))).subarray(0, 16), b => (b % 36).toString(36)).join('');
  let signKey = null, myPk = '';
  const idReady = (async () => {
    const load = async raw => {
      const o = JSON.parse(raw || 'null');
      if (!o || typeof o.p !== 'string' || !o.d) throw new Error('no id');
      return { k: await crypto.subtle.importKey('jwk', o.d, SIG_KEY, false, ['sign']), p: o.p, c: await fpOf(o.p) };
    };
    let id = null;
    try { id = await load(store.get('tcwt_id')); } catch (e) {}
    if (!id) {
      const kp = await crypto.subtle.generateKey(SIG_KEY, true, ['sign', 'verify']);
      const p = toB64(new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey)));
      const d = await crypto.subtle.exportKey('jwk', kp.privateKey);
      try { id = await load(store.get('tcwt_id')); } catch (e) {}   // egy másik lap közben már létrehozta
      if (!id) { store.set('tcwt_id', JSON.stringify({ p, d })); id = { k: kp.privateKey, p, c: await fpOf(p) }; }
    }
    signKey = id.k; myPk = id.p; cid = id.c;
    store.set('tcwt_cid', cid);
  })();
  const roomTag = topic => String(topic || roomTopic).slice(0, 8);
  // Az aláírt szöveg: JSON + sortörés + aláírás. Benne van a csatorna (_t) és a szoba (_r) is, így egy aláírt
  // üzenet nem játszható vissza másik csatornán (pl. egy búcsú host-bejegyzésként) vagy másik szobában.
  function signedBody(sub, obj, topic) {
    return JSON.stringify(Object.assign({}, obj, { _t: sub, _r: roomTag(topic), pk: myPk }));
  }
  async function signText(body) {
    return body + '\n' + toB64(new Uint8Array(await crypto.subtle.sign(SIG_ALG, signKey, enc.encode(body))));
  }
  const verKeys = new Map();
  async function unwire(txt, sub, topic) {
    const i = typeof txt === 'string' ? txt.lastIndexOf('\n') : -1;
    if (i < 2) return null;
    const body = txt.slice(0, i);
    let m;
    try { m = JSON.parse(body); } catch (e) { return null; }
    if (!m || typeof m !== 'object' || Array.isArray(m) || m._t !== sub || m._r !== roomTag(topic) || typeof m.pk !== 'string' || m.pk.length > 120) return null;
    let k = verKeys.get(m.pk);
    if (!k) {
      try { k = { key: await crypto.subtle.importKey('raw', fromB64(m.pk), SIG_KEY, false, ['verify']), c: await fpOf(m.pk) }; } catch (e) { return null; }
      if (verKeys.size > 300) verKeys.clear();
      verKeys.set(m.pk, k);
    }
    let ok = false;
    try { ok = await crypto.subtle.verify(SIG_ALG, k.key, fromB64(txt.slice(i + 1)), enc.encode(body)); } catch (e) {}
    if (!ok) return null;
    m._s = k.c;   // az aláíró eszköz – ez az egyetlen megbízható „ki küldte”
    return m;
  }

  const validUi = x => /^\d{1,10}$/.test(String(x ?? '')) ? String(x) : null;
  const avatarUrl = ui => location.origin + '/media/users/' + ui + '.jpg';
  const RESERVED = /^(avatar|edit|password|email|delete|settings|logout|login|signup|videos|photos|albums|favorites|friends|messages|subscriptions|subscribers|playlists|blocked|privacy|notifications|upload)$/i;

  function nameFromHref(href) {
    try {
      const u = new URL(href, location.origin);
      if (u.hostname.replace(/^www\./, '') !== location.hostname.replace(/^www\./, '')) return null;
      const m = u.pathname.match(/^\/user\/([^/]+)\/?$/);
      const n = m && decodeURIComponent(m[1]).trim();
      return n && !RESERVED.test(n) ? n : null;
    } catch (e) { return null; }
  }

  function findName(d, finalUrl) {
    const byUrl = nameFromHref(finalUrl || '');
    if (byUrl) return byUrl;
    const count = new Map();
    d.querySelectorAll('a[href]').forEach(a => {
      try {
        const m = new URL(a.getAttribute('href'), location.origin).pathname
          .match(/^\/user\/([^/]+)\/(videos|favorites|albums|photos|friends|subscribers|subscriptions|playlists|blog|wall)\b/i);
        if (m) { const n = decodeURIComponent(m[1]); if (!RESERVED.test(n)) count.set(n, (count.get(n) || 0) + 1); }
      } catch (e) {}
    });
    if (count.size) return [...count].sort((a, b) => b[1] - a[1])[0][0];
    const lo = d.querySelector('a[href*="logout" i]');
    for (let box = lo && lo.parentElement, i = 0; box && i < 4; box = box.parentElement, i++) {
      for (const a of box.querySelectorAll('a[href]')) { const n = nameFromHref(a.getAttribute('href')); if (n) return n; }
    }
    return null;
  }

  function findAvatar(d) {
    const scan = list => {
      for (const img of list) {
        const m = (img.getAttribute('src') || img.getAttribute('data-src') || '').match(/\/media\/users\/(\d+)\.jpe?g/i);
        if (m) return m[1];
      }
      return null;
    };
    return scan(d.querySelectorAll('form img, main img, .avatar img, img.avatar')) || scan(d.querySelectorAll('img'));
  }

  async function fetchDoc(path) {
    const r = await fetch(path, { credentials: 'same-origin', cache: 'no-store', signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(6000) : undefined });
    return { url: r.url, doc: new DOMParser().parseFromString(await r.text(), 'text/html') };
  }

  async function getAccount() {
    try {
      const c = JSON.parse(store.get('tcwt_acct') || 'null');
      if (c && Date.now() - c.ts < 5 * 60 * 1000) return c.a;
    } catch (e) {}
    let a = null;
    try {
      const u = await fetchDoc('/user');
      if (!/^\s*bejelentkez/i.test(u.doc.title || '')) {
        const n = findName(u.doc, u.url);
        if (n) {
          let ui = null;
          try { ui = findAvatar((await fetchDoc('/user/avatar')).doc); } catch (e) {}
          a = { name: n, ui: validUi(ui || findAvatar(u.doc)) };
        }
      }
    } catch (e) { return null; }
    store.set('tcwt_acct', JSON.stringify({ a, ts: Date.now() }));
    return a;
  }

  // ---------- A szerverek együtt egy kliensként: az üzenet azon megy ki, amelyik épp elérhető (ha egyik sem,
  // rövid ideig várakozik), a mindkettőn beérkező ugyanazon üzenet csak egyszer számít. Az újrakapcsolódás
  // szerverenként, növekvő várakozással megy, így egy letiltott szervert sem ostromol 3 mp-enként.
  const RECONNECT_MS = 3000;
  function brokerSet(optsOf, autoReconnect) {
    const on = {}, subs = [], seen = new Map(), queue = [];
    const emit = (ev, ...a) => (on[ev] || []).forEach(f => { try { f(...a); } catch (e) {} });
    let up = false, ended = false;
    const set = {
      cs: [],
      get connected() { return set.cs.some(c => c.connected); },
      get mask() { return set.cs.reduce((m, c) => m | (c.connected ? 1 << c._i : 0), 0); },
      get failed() { return set.cs.every(c => c._closed && !c.connected); },
      on(ev, f) { (on[ev] = on[ev] || []).push(f); return set; },
      subscribe(list, cb) {
        subs.push(...list);
        let done = false;
        const once = err => { if (!done) { done = true; if (cb) cb(err); } };
        set.cs.forEach(c => { if (c.connected) c.subscribe(list, once); });
      },
      publish(topic, payload, opts) {
        const live = set.cs.filter(c => c.connected);
        if (live.length) live.forEach(c => { try { c.publish(topic, payload, opts); } catch (e) {} });
        else { queue.push([topic, payload, opts, Date.now()]); if (queue.length > 40) queue.shift(); }
      },
      reconnect() { set.cs.forEach(c => { if (!c.connected && !c.reconnecting && !ended) { c._wait = 0; clearTimeout(c._t); try { c.reconnect(); } catch (e) {} } }); },
      end(force) { ended = true; set.cs.forEach(c => { clearTimeout(c._t); try { c.end(force); } catch (e) {} }); }
    };
    BROKERS.forEach((url, i) => {
      let c;
      try { c = mqtt.connect(url, Object.assign({}, optsOf(i), { reconnectPeriod: 0, queueQoSZero: false })); } catch (e) { return; }
      c._wait = 0; c._i = i;
      set.cs.push(c);
      c.on('connect', () => {
        c._wait = 0; c._closed = false;
        if (subs.length) c.subscribe(subs);
        if (!up) {
          up = true;
          seen.clear();
          const old = queue.splice(0).filter(q => Date.now() - q[3] < 120000);
          old.forEach(q => { try { c.publish(q[0], q[1], q[2]); } catch (e) {} });
          emit('connect');
        } else emit('extra', i);
      });
      c.on('message', (topic, buf, pkt) => {
        const key = topic + '\n' + (buf ? buf.toString() : '');
        const now = Date.now();
        if (seen.has(key) && now - seen.get(key) < 60000) return;
        if (seen.size > 3000) { for (const [k, t] of seen) if (now - t > 60000) seen.delete(k); if (seen.size > 3000) seen.clear(); }
        seen.set(key, now);
        emit('message', topic, buf, pkt);
      });
      c.on('close', () => {
        c._closed = true;
        if (up && !set.connected) { up = false; emit('close'); }
        emit('change');
        if (ended || !autoReconnect || c._t) return;
        c._wait = Math.min(60000, c._wait ? c._wait * 2 : RECONNECT_MS);
        c._t = setTimeout(() => { c._t = null; if (!ended && !c.connected) { try { c.reconnect(); } catch (e) {} } }, c._wait);
      });
      c.on('connect', () => emit('change'));
      c.on('offline', () => emit('offline'));
      c.on('error', err => emit('error', err));
    });
    return set;
  }

  function resetRoomState() {
    [refreshTimer, sendTimer, saveTimer, histPubTimer].forEach(t => clearTimeout(t));
    saveTimer = null; saveRoom = '';
    leaveTimers.forEach(t => clearTimeout(t)); leaveTimers.clear();
    ghostTimers.forEach(t => clearTimeout(t)); ghostTimers.clear();
    histTimers.forEach(t => clearTimeout(t)); histTimers.clear();
    if (modArmed) { clearTimeout(modArmed.t); modArmed = null; }
    members.clear(); ownTabs.clear(); kickedAt.clear(); lastAt.clear(); presAt.clear(); chatRate.clear(); devSeen.clear(); joinedAt = 0; oldNoted = false;
    hostCands.clear(); authWait.ban.clear(); authWait.cfg.clear(); authWait.q.clear(); stateWait = null;
    queue = []; qV = 0;
    resetRate();
    if (baseRate !== 1) { const v = getVideo(); if (v) setRate(v, 1); baseRate = 1; }
    clearTimeout(stallTimer); stalled = false; holdShown = false;
    pendingAct = null; pending = null; seekFrom = null; posWait = null;
    hostRec = null; hostConfirmed = false; hostGoneSince = 0; hostByeAt = 0; isHost = false; adoptHost = false; justMigrated = false;
    bans = []; bansV = 0; locked = false; lockV = 0;
    lastState = null; roomName = ''; stateSeen = false; roomClock = null; roomVidC = ''; roomVidAt = 0;
    roomKey = null; roomTopic = ''; leaving = false; settleUntil = 0; hostSince = 0; connects = 0; lostAt = 0; outage = 0; hostInherited = false;
  }

  async function connect(code) {
    if (typeof mqtt === 'undefined') { note.textContent = 'Betöltési hiba – frissítsd az oldalt.'; return; }
    try { await idReady; } catch (e) { note.textContent = 'Ez a böngésző nem támogatott.'; return; }
    if (client) { const old = client; client = null; try { old.end(true); } catch (e) {} }
    resetRoomState();
    room = code;
    pruneStorage(code);
    hostRec = readSessJSON('tcwt_hrec_' + code);
    hostInherited = !!hostRec;
    const sb = readSessJSON('tcwt_bans_' + code);
    bans = sb && Array.isArray(sb.list) ? sb.list : [];
    bansV = sb && okVer(sb.v) ? sb.v : 0;
    lockV = +sess.get('tcwt_lockv_' + code) || 0;
    locked = sess.get('tcwt_lock_' + code) === '1';
    loadQueue(code);
    myJoin();
    isHost = ownsHost();
    initLead(code);
    sess.set('tcwt_room', code);
    markActive();
    restoreChat();
    setLive(true);
    setConn('wait');

    let keys;
    try { keys = await deriveRoom(code); }
    catch (e) { setConn('err'); setActivity('Ez a böngésző nem támogatott.'); return; }
    if (room !== code || client) return;
    roomKey = keys.key; roomTopic = keys.topic;
    // A „végakarat” (a szerver küldi el, ha a kapcsolat váratlanul megszakad) szerverenként külön: benne van, melyik
    // szerverről esett le a lap. Így ha csak az egyik kapcsolata szakad meg, a többiek nem hiszik, hogy kilépett.
    let wills;
    try {
      const at = Date.now();
      wills = await Promise.all(BROKERS.map(async (u, i) => seal(await signText(signedBody('p/' + sid, { gone: 1, c: cid, at, b: i })), 'p/' + sid, roomKey)));
      goneMsg = await seal(await signText(signedBody('p/' + sid, { gone: 1, c: cid, at })), 'p/' + sid, roomKey);
    }
    catch (e) { setConn('err'); setActivity('Ez a böngésző nem támogatott.'); return; }
    if (room !== code || client) return;

    client = brokerSet(i => ({
      clientId: 'tcwt_' + sid,
      keepalive: 60,
      connectTimeout: 10000,
      clean: true,
      will: { topic: T('p/' + sid), payload: wills[i], retain: true, qos: 0 }
    }), true);
    // Egy újabb szerver is elérhetővé vált: ott is feliratkozunk (azt a szerverkészlet intézi), és ott is
    // megjelenünk – hostként a szoba adataival együtt.
    client.on('extra', () => {
      if (room !== code) return;
      setConn('ok');
      announce();
      if (isHost) refreshRetained();
    });
    // Ha az egyik szerverrel megszakad a kapcsolat (de a másikkal él), jelezzük: így ha később a lap váratlanul
    // bezárul, a megmaradt szerver végakarata egyedül is elég ahhoz, hogy a többiek lássák, kilépett.
    let lastMask = 0, maskTimer = null;
    client.on('change', () => {
      if (room !== code || !client || !client.connected) return;
      setConn('ok');
      const mask = client.mask, lost = lastMask & ~mask;
      lastMask = mask;
      if (lost && !maskTimer) maskTimer = setTimeout(() => { maskTimer = null; if (room === code && client && client.connected && !leaving) announce(); }, 400);
    });
    client.on('connect', () => {
      connectedAt = Date.now();
      settleUntil = connectedAt + SETTLE_MS;
      leaving = false;
      connects++;
      if (connects === 1) joinedAt = connectedAt;
      outage = lostAt ? connectedAt - lostAt : 0;
      lostAt = 0;
      const before = new Map();
      members.forEach(m => { if (!before.has(m.c)) before.set(m.c, m); });
      members.clear();
      before.forEach((m, c) => addGhost(c, m, 30000));
      leaveTimers.forEach(t => clearTimeout(t));
      leaveTimers.clear();
      setConn('ok');
      restoreKnown(code);
      renderMembers();
      // Az állapot jöjjön a host-bejegyzés előtt (a szerver a feliratkozás sorrendjében küldi a visszatartott
      // üzeneteket): így a host új lapja előbb a szoba pozíciójára áll, és csak utána irányít.
      client.subscribe([T('state'), T('m'), T('h'), T('host'), T('cfg'), T('q'), T('ban'), T('p/+'), OLD_PREFIX + roomTopic + '/p/+']);
      announce();
      if (isHost) sendState();
      const prevSid = sess.get('tcwt_prevsid_' + code);
      if (prevSid && prevSid !== sid && /^[a-z0-9]{1,20}$/.test(prevSid)) clearRetained('p/' + prevSid);
      sess.set('tcwt_prevsid_' + code, sid);
      const nth = connects;
      setTimeout(() => {
        if (room !== code || nth !== connects) return;
        settleUntil = 0;
        if (!hostConfirmed) {
          // Nem jött host-bejegyzés (pl. valaki felülírta a helyét). Az előző oldalról ismert host marad, ha itt van.
          if (hostRec && devPresent(hostRec.c)) setHostRec(hostRec, true);
          else {
            hostConfirmed = true;
            hostRec = null;
            sess.del('tcwt_hrec_' + code);
            flushStateWait();
            if (store.get('tcwt_host_' + code) === '1' && !members.size) setHost(cid, shown(), tabId, true);
          }
        }
        settled();
      }, SETTLE_MS);
      requestFollowPos();
      setTimeout(sendPing, 1000);
      setTimeout(() => { if (room) publish('m', { id: sid, c: cid, k: 'histreq' }); }, 800);
      // Ha addig semmilyen érvényes előzmény nem jött (pl. valaki „válaszolt” helyettük szeméttel), még egyszer kérjük.
      histOk = false;
      setTimeout(() => { if (room === code && nth === connects && !histOk && members.size) publish('m', { id: sid, c: cid, k: 'histreq' }); }, 6000);
    });
    client.on('message', onMessage);
    // A kapcsolat bontásakor azonnal jelezzük (eddig a következő próbálkozásig „Csatlakozva” maradt),
    // hiba után is csak „Csatlakozás…”, mert a kliens magától újrapróbálja.
    const lost = () => {
      if (!client || client.connected) return;
      if (!lostAt) lostAt = Date.now();
      setConn(navigator.onLine === false ? 'off' : 'wait');
    };
    client.on('close', lost);
    client.on('offline', lost);
    client.on('error', lost);
  }

  function pruneStorage(keep) {
    try {
      const act = readJSON('tcwt_active');
      const keepSet = new Set([keep, act && act.code].filter(Boolean));
      const drop = [];
      for (let i = 0; i < localStorage.length; i++) {
        const mm = /^tcwt_(?:chatlast|j|host|lead|k)_(.+)$/.exec(localStorage.key(i) || '');
        if (mm && !keepSet.has(mm[1])) drop.push(mm[0]);
      }
      drop.forEach(k => store.del(k));
    } catch (e) {}
  }
  function markActive() {
    if (room) store.set('tcwt_active', JSON.stringify({ code: room, ts: Date.now() }));
  }
  function readJSON(k) { try { return JSON.parse(store.get(k) || 'null'); } catch (e) { return null; } }

  function readSessJSON(k) { try { return JSON.parse(sess.get(k) || 'null'); } catch (e) { return null; } }
  function myJoin() {
    let j = +store.get('tcwt_j_' + room) || 0;
    if (!j) { j = Date.now(); store.set('tcwt_j_' + room, String(j)); }
    return j;
  }

  const ownsHost = () => !!(hostConfirmed && hostRec && hostRec.c === cid && (!hostRec.tab || hostRec.tab === tabId));

  function roleCheck() {
    if (!room) return;
    if (adoptHost && hostConfirmed && hostRec) {
      adoptHost = false;
      if (hostRec.c === cid && hostRec.tab && hostRec.tab !== tabId && ownLead()) { setHost(cid, shown(), tabId, true); return; }
    }
    const want = ownsHost();
    if (want !== isHost) { isHost = want; afterRoleChange(); }
  }

  function hostPresent() {
    if (!hostRec) return false;
    if (hostRec.c === cid && (!hostRec.tab || hostRec.tab === tabId)) return true;
    return [...members.values()].some(m => m.c === hostRec.c && (!hostRec.tab || m.tb === hostRec.tab));
  }

  function candidates(exclude) {
    const list = [{ c: cid, j: myJoin(), n: shown(), tb: tabId }];
    members.forEach(m => { if (!m.ghost && !list.some(x => x.c === m.c)) list.push({ c: m.c, j: m.j || Infinity, n: m.n, tb: m.tb }); });
    list.sort((a, b) => (a.j - b.j) || (a.c < b.c ? -1 : 1));
    return list.filter(x => x.c !== exclude);
  }
  const successor = exclude => candidates(exclude)[0] || null;

  function electionCheck() {
    if (!client || !client.connected || !hostConfirmed || Date.now() - connectedAt < 8000) return;
    if (hostPresent()) { hostGoneSince = 0; hostByeAt = 0; return; }
    if (!hostGoneSince) { hostGoneSince = Date.now(); return; }
    const gone = Date.now() - hostGoneSince;
    // Ha a host bezárta a lapot (búcsút küldött), nem várunk 20 mp-et: pár mp az újratöltésre, utána jöhet az új host.
    const grace = hostRec && deviceOnline(hostRec.c) ? 60000 : (Date.now() - hostByeAt < 60000 ? 10000 : HOST_GRACE);
    if (gone < grace) return;
    let list = candidates(hostRec && hostRec.c);
    if (!list.length) list = candidates(null);
    const next = list[Math.min(Math.floor((gone - grace) / HOST_GRACE), list.length - 1)];
    if (next && next.c === cid) setHost(cid, shown(), tabId);
  }

  const nextVer = cur => Math.max(Date.now(), (+cur || 0) + 1);
  function setHost(c, n, tab, quiet) {
    const rec = { id: sid, c, n: clean(n), tab: tab || null, ts: nextVer(hostRec && hostRec.ts) };
    publish('host', rec, true);
    onHostRec(Object.assign({ _s: cid }, rec), !!quiet);
  }

  let modArmed = null;
  function armedFor(c, act) { return !!(modArmed && modArmed.c === c && modArmed.act === act); }
  function hostAction(m, act) {
    if (!isHost || !m || !m.c || m.c === cid) return;
    if (!armedFor(m.c, act)) {
      if (modArmed) clearTimeout(modArmed.t);
      modArmed = { c: m.c, act, t: setTimeout(() => { modArmed = null; renderMembers(); }, 3500) };
      renderMembers();
      return;
    }
    clearTimeout(modArmed.t);
    modArmed = null;
    if (act === 'host') setHost(m.c, m.n, m.tb);
    else if (act === 'kick') kickUser(m);
    else if (act === 'ban') banUser(m);
  }

  let bans = [], bansV = 0;
  const okVer = v => typeof v === 'number' && isFinite(v) && v > 0 && v < Date.now() + 3600000;
  function saveBans() { sess.set('tcwt_bans_' + room, JSON.stringify({ v: bansV, list: bans })); }
  const banHit = (b, c, nm, isAcc) => b.c === c || !!(isAcc && b.acc && norm(b.acc) === norm(nm));
  const isBanned = (c, nm, isAcc) => bans.some(b => banHit(b, c, nm, isAcc));
  const amBanned = () => isBanned(cid, acct ? acct.name : '', !!acct);

  function publishBans(bump) {
    if (bump !== false) bansV = nextVer(bansV);
    saveBans();
    publish('ban', { id: sid, c: cid, v: bansV, list: bans }, true);
  }
  function purgeBanned() {
    for (const [k, x] of members) if (isBanned(x.c, x.n, x.a)) members.delete(k);
  }
  const kickedAt = new Map();
  const seenNonce = new Set();
  function fresh(m) {
    if (typeof m.q !== 'string' || !okVer(m.ts) || Math.abs(Date.now() - m.ts) > 10 * 60 * 1000) return false;
    if (seenNonce.has(m.q)) return false;
    if (seenNonce.size > 500) seenNonce.clear();
    seenNonce.add(m.q);
    return true;
  }
  function kickUser(m) {
    kickedAt.set(m.c, Date.now());
    publish('m', { id: sid, c: cid, k: 'kick', to: m.c, n: m.n, ts: Date.now(), q: rand(8) });
    for (const [k, x] of members) if (x.c === m.c) members.delete(k);
    sysMsg('Kirúgtad: ' + m.n);
    renderMembers();
  }
  function banUser(m) {
    bans = bans.filter(b => b.c !== m.c).concat({ c: m.c, n: cleanName(m.n), acc: m.a ? cleanName(m.n) : null, ui: m.a ? validUi(m.ui) : null });
    publishBans();
    purgeBanned();
    sysMsg('Kitiltottad: ' + m.n, 'ban:' + m.c);
    renderMembers();
  }
  function unbanUser(c) {
    const b = bans.find(x => x.c === c);
    if (!isHost || !b) return;
    bans = bans.filter(x => x.c !== c);
    publishBans();
    sysMsg('Tiltás feloldva: ' + b.n, 'ban:' + c);
    renderMembers();
  }
  // Tiltólista és beállítás csak a hosttól jöhet. Ha még nem tudjuk, ki a host (csatlakozás eleje), vagy
  // a küldő később lesz host, félretesszük, és akkor érvényesítjük.
  function waitAuth(kind, m) {
    const w = authWait[kind], old = w.get(m._s);
    if (old && old.v >= m.v) return;
    w.delete(m._s); w.set(m._s, m);
    if (w.size > 8) w.delete(w.keys().next().value);
  }
  function applyAuthWait() {
    if (!hostRec) return;
    const b = authWait.ban.get(hostRec.c), f = authWait.cfg.get(hostRec.c), q = authWait.q.get(hostRec.c);
    authWait.ban.delete(hostRec.c); authWait.cfg.delete(hostRec.c); authWait.q.delete(hostRec.c);
    if (b) onBans(b, true);
    if (f) onCfg(f, true);
    if (q) onQueue(q);
  }
  function onBans(m, retained) {
    if (!Array.isArray(m.list) || !okVer(m.v)) return;
    // Csatlakozás közben csak akkor, ha a jelenlévők többsége is őt tartja hostnak: egy hamis „host” listája
    // különben kitilthatná az igazi hostot (és akkor az üzeneteit sem látnánk).
    if (!hostRec || m._s !== hostRec.c || !hostTrusted()) { waitAuth('ban', m); return; }
    if (m.v < bansV) return;
    const prev = bans;
    bansV = m.v;
    bans = m.list.filter(b => b && typeof b.c === 'string').slice(0, 200)
      .map(b => ({ c: b.c.slice(0, 20), n: cleanName(b.n), acc: typeof b.acc === 'string' ? cleanName(b.acc) : null, ui: validUi(b.ui) }));
    saveBans();
    if (amBanned()) { kickedOut('Ki vagy tiltva ebből a szobából.'); return; }
    if (!retained) {
      bans.filter(b => !prev.some(x => x.c === b.c)).forEach(b => sysMsg('Kitiltva: ' + b.n, 'ban:' + b.c));
      prev.filter(b => !bans.some(x => x.c === b.c)).forEach(b => sysMsg('Tiltás feloldva: ' + b.n, 'ban:' + b.c));
    }
    purgeBanned();
    renderMembers();
  }
  function onKick(m) {
    if (!hostConfirmed || !hostRec || m._s !== hostRec.c || !hostTrusted() || typeof m.to !== 'string' || !fresh(m)) return;
    if (m.to === cid) {
      // Ugyanazt a kirúgást (pl. valaki visszajátssza, amikor visszajöttünk) csak egyszer vesszük figyelembe.
      let used = [];
      try { used = JSON.parse(store.get('tcwt_kq') || '[]'); } catch (e) {}
      if (!Array.isArray(used)) used = [];
      if (used.includes(m.q)) return;
      store.set('tcwt_kq', JSON.stringify(used.concat(m.q).slice(-20)));
      kickedOut('Kirúgtak. A kóddal visszajöhetsz.');
      return;
    }
    kickedAt.set(m.to, Date.now());
    for (const [k, x] of members) if (x.c === m.to) members.delete(k);
    sysMsg('Kirúgva: ' + cleanName(m.n));
    renderMembers();
  }
  function kickedOut(msg) {
    leaveRoom();
    note.textContent = msg;
    togglePanel(true);
  }

  // Ki a host? Az aláírások miatt a szerepet csak a mostani host adhatja át (vagy viheti át másik lapjára), magát
  // pedig csak az jelölheti ki, aki már nem látja a hostot (választás). Ha két bejegyzés ütközik (pl. valaki a host
  // jelenlétében hirdette ki magát, vagy kapcsolatszakadás alatt választottak új hostot), az nyer, akit a szobában
  // lévők hostnak tartanak (a jelenlétükben küldik). Csatlakozás után pár mp-ig gyűjtünk, aztán döntünk.
  const SETTLE_MS = 4000;
  let settleUntil = 0, leaving = false, hostSince = 0, connects = 0, lostAt = 0, outage = 0, hostInherited = false;
  const settling = () => Date.now() < settleUntil;
  const hostCands = new Map();
  const authWait = { ban: new Map(), cfg: new Map(), q: new Map() };
  let stateWait = null;
  const cameByNav = Date.now() - (+sess.get('tcwt_navat') || 0) < 30000;
  sess.del('tcwt_navat');
  const devPresent = c => c === cid || deviceOnline(c);
  function votes(c) {
    const who = new Set();
    members.forEach(x => { if (x.hc === c) who.add(x.c); });
    return who.size + (c === cid && hostRec && hostRec.c === cid ? 1 : 0);
  }
  function hostTrusted() {
    if (!hostRec || !settling() || hostRec.c === cid) return !!hostRec;
    const voters = new Set();
    members.forEach(x => { if (x.hc) voters.add(x.c); });
    return votes(hostRec.c) * 2 > voters.size;
  }
  // Döntetlennél a régi host maga csak akkor adja át a szerepet, ha tényleg távol volt (megszakadt a kapcsolata,
  // vagy egy korábbi oldalról örökölt hostként nem lapváltással töltődött be) – különben valaki a jelenlétében
  // hirdette ki magát.
  const yieldOk = () => Date.now() - connectedAt < SETTLE_MS + 3000 && (outage >= 8000 || (connects === 1 && !cameByNav && hostInherited));
  // initial: a csatlakozás utáni döntés. Később az eltűnt host helyett a választás (türelmi idővel) dönt, nem ez.
  function beats(a, b, initial) {
    const pa = devPresent(a.c);
    if (!b) return pa;
    if (!devPresent(b.c)) return !!initial && pa;
    if (!pa) return false;
    const va = votes(a.c), vb = votes(b.c);
    if (va !== vb) return va > vb;
    return b.c === cid && a.c !== cid && yieldOk() && a.ts > b.ts;
  }
  function reconsiderHost(force) {
    if (!room || !hostConfirmed || settling() || (!force && Date.now() - hostSince < 6000)) return;
    let best = hostRec;
    hostCands.forEach(r => { if (r.c !== (best && best.c) && beats(r, best, force)) best = r; });
    if (best && best !== hostRec) setHostRec(best, true);
  }
  function settled() {
    reconsiderHost(true);
    applyAuthWait();
  }
  function onHostRec(m, retained) {
    if (!m || typeof m.c !== 'string' || !m.c || !okVer(m.ts)) return;
    const rec = { c: m.c.slice(0, 20), n: cleanName(m.n), tab: typeof m.tab === 'string' ? m.tab.slice(0, 20) : null, ts: m.ts };
    const s = m._s, cur = hostRec;
    if (s === rec.c || (cur && s === cur.c)) {
      const old = hostCands.get(rec.c);
      if (!old || old.ts <= rec.ts) { hostCands.delete(rec.c); hostCands.set(rec.c, rec); if (hostCands.size > 12) hostCands.delete(hostCands.keys().next().value); }
    }
    if (!cur || (rec.ts >= cur.ts && (s === cur.c || (s === rec.c && !settling() && !hostPresent())))) { setHostRec(rec, retained); return; }
    if (rec.c === cur.c) return;
    if (!settling() && Date.now() - hostSince >= 6000 && hostCands.get(rec.c) === rec && beats(rec, cur, false)) { setHostRec(rec, retained); return; }
    // Elutasított bejegyzés: ha mi vagyunk a host, a visszatartott helyre visszaírjuk a sajátunkat.
    if (isHost) reassertRetained();
  }
  function setHostRec(rec, retained) {
    const prev = hostRec;
    const changed = !prev || prev.c !== rec.c;
    if (rec !== prev) hostInherited = false;
    hostRec = { c: rec.c, n: rec.n, tab: rec.tab, ts: rec.ts };
    if (changed) hostSince = Date.now();
    hostConfirmed = true;
    sess.set('tcwt_hrec_' + room, JSON.stringify(hostRec));
    if (hostRec.c !== cid) store.del('tcwt_host_' + room);
    hostGoneSince = 0;
    justMigrated = !retained && hostRec.c === cid && (!prev || prev.c !== cid);
    if (!retained && changed) sysMsg(hostRec.c === cid ? 'Te lettél a host 👑' : hostRec.n + ' lett a host 👑', 'host');
    flushStateWait();
    roleCheck();
    justMigrated = false;
    applyAuthWait();
    if (changed) announce();
    renderMembers();
  }

  let lastMark = 0, lastLeadCheck = 0;
  setInterval(() => {
    if (!room) return;
    if (Date.now() - lastMark > 30000) { lastMark = Date.now(); markActive(); }
    if (client && client.connected && Date.now() - lastAnnounce > 5 * 60000) announce();
    if (!isLead() && Date.now() - lastLeadCheck > 8000) {
      lastLeadCheck = Date.now();
      const code = room;
      leadAlive().then(alive => { if (!alive && room === code && !isLead()) claimLead(false, true); });
    }
    reconsiderHost();
    roleCheck();
    electionCheck();
  }, 5000);

  let refreshTimer = null, lastReassert = 0;
  function refreshNow() {
    if (!isHost || !hostRec || !client || !client.connected) return;
    publish('host', { id: sid, c: hostRec.c, n: hostRec.n, tab: hostRec.tab, ts: hostRec.ts }, true);
    if (bansV) publishBans(false);
    if (lockV) publish('cfg', { id: sid, c: cid, lock: locked, v: lockV }, true);
    if (qV) publish('q', queueMsg(), true);
    sendState();
  }
  // A visszatartott üzeneteket (host, tiltólista, beállítás, állapot) a host újraküldi: új nézőnek, és ha valaki
  // törölte vagy felülírta őket. Legfeljebb ~1 mp-enként, hogy egy elárasztás se pörgesse fel.
  function refreshRetained() {
    if (refreshTimer) return;
    refreshTimer = setTimeout(() => { refreshTimer = null; refreshNow(); }, 1200);
  }
  function reassertRetained() {
    if (!isHost || Date.now() - lastReassert < 1000) return;
    lastReassert = Date.now();
    clearTimeout(refreshTimer); refreshTimer = null;
    refreshNow();
  }

  function afterRoleChange() {
    if (isHost) refreshRetained();
    announce();
    if (isHost && (!justMigrated || !roomV || (VPATH && sameVideo(VPATH, roomV)))) sendState();
    justMigrated = false;
    renderMembers();
  }

  let outChain = Promise.resolve();
  // onWire: az aláírt szöveg (a chatüzenetnél eltesszük, hogy az előzményekkel együtt aláírva adhassuk tovább).
  function publish(sub, obj, retain, onWire) {
    const c = client, key = roomKey;
    if (!c || !key) return outChain;
    const topic = T(sub), body = signedBody(sub, obj);
    outChain = outChain
      .then(async () => {
        const w = await signText(body);
        if (onWire) onWire(w);
        c.publish(topic, await seal(w, sub, key), { retain: !!retain });
      })
      .catch(() => {});
    return outChain;
  }

  function clearRetained(sub) {
    const c = client;
    if (!c || !roomKey) return outChain;
    const topic = T(sub);
    outChain = outChain.then(() => { c.publish(topic, '', { retain: true }); }).catch(() => {});
    return outChain;
  }

  let lastAnnounce = 0;
  const PRESENCE_TTL = 30 * 60000;
  const presenceOf = mv => {
    const u = safePath(location.pathname + location.search);
    return { c: cid, n: shown(), a: acct ? 1 : 0, hc: hostRec ? hostRec.c : undefined, br: client ? client.mask : undefined, v: VPATH, ui: myUi, t: u ? pageLabel() : 'Böngészik', u, j: myJoin(), tb: tabId, mv: mv || undefined, ld: ownLead() || isHost ? 1 : undefined, sv: SCRIPT_VERSION, at: Date.now() };
  };
  function announce(mv) {
    lastAnnounce = Date.now();
    publish('p/' + sid, presenceOf(mv), true);
    if (!mv) prepLeave();
  }
  // Az oldal elhagyásakor küldendő üzenetek előre titkosítva állnak készen (oldalváltásnál „Átvált…”,
  // bezárásnál búcsú), így a lap utolsó pillanatában is azonnal, várakozás nélkül elmennek.
  let moveMsg = '';
  async function prepLeave() {
    const key = roomKey;
    if (!room || !key) return;
    try {
      const b = await seal(await signText(signedBody('m', { id: sid, k: 'bye', c: cid, n: shown(), ts: Date.now(), q: rand(8) })), 'm', key);
      const mvp = await seal(await signText(signedBody('p/' + sid, presenceOf(20000))), 'p/' + sid, key);
      if (key === roomKey) { byeMsg = b; moveMsg = mvp; byeAt = Date.now(); }
    } catch (e) {}
  }
  function movingNow() {
    const c = client;
    if (moveMsg && c && c.connected && Date.now() - byeAt < 8 * 60000) { try { c.publish(T('p/' + sid), moveMsg, { retain: true }); return; } catch (e) {} }
    announce(20000);
  }
  // Lap/böngésző bezárva: a többiek rögtön lássák, hogy kilépett (ne „Átvált…” legyen 20 mp-ig).
  function goneNow() {
    const c = client;
    if (!c || !c.connected) return;
    try {
      if (goneMsg) { c.publish(T('p/' + sid), goneMsg, { retain: false }); c.publish(T('p/' + sid), '', { retain: true }); }
      if (byeMsg && Date.now() - byeAt < 8 * 60000) c.publish(T('m'), byeMsg, { retain: false });
      else publish('m', { id: sid, k: 'bye', c: cid, n: shown(), ts: Date.now(), q: rand(8) });
    } catch (e) {}
  }
  // Oldalváltás vagy bezárás? A Navigation API szól minden linkes, űrlapos, vissza/előre és scriptből indított
  // oldalváltásról (a lap bezárásáról nem). Az újratöltést billentyűről is felismerjük; a böngésző
  // újratöltés-gombja nem ad jelet, arra a fogadó oldal rövid türelmi ideje vigyáz.
  const markNav = () => { navIntent = Date.now(); };
  try {
    const navApi = window.navigation;
    if (navApi && typeof navApi.addEventListener === 'function') {
      navApi.addEventListener('navigate', e => {
        if (e.hashChange || e.downloadRequest != null || (e.destination && e.destination.sameDocument)) return;
        try { if (new URL(e.destination.url).origin === location.origin) markNav(); } catch (err) {}
      });
    } else {
      document.addEventListener('click', e => {
        if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        const a = e.composedPath().find(n => n.tagName === 'A' && n.href);
        if (a && (!a.target || a.target === '_self') && a.origin === location.origin) markNav();
      }, true);
      document.addEventListener('submit', markNav, true);
      addEventListener('mouseup', e => { if (e.button === 3 || e.button === 4) markNav(); }, true);
    }
  } catch (e) {}
  addEventListener('keydown', e => {
    const k = (e.key || '').toLowerCase();
    if (k === 'f5' || ((e.ctrlKey || e.metaKey) && k === 'r') || (e.altKey && (k === 'arrowleft' || k === 'arrowright'))) markNav();
  }, true);

  let leadMovingAt = 0;
  const leadWaiters = new Set();
  const leadKey = () => 'tcwt_lead_' + room;
  const ownLead = () => !!room && store.get(leadKey()) === tabId;
  const isLead = () => !room || ownLead() || (isHost && !store.get(leadKey()));
  if (bc) bc.addEventListener('message', e => {
    const d = e.data || {};
    if (d.t === 'who') { if (d.tab === tabId) bc.postMessage({ t: 'dup', n: d.n }); return; }
    if (!room || d.room !== room) return;
    if (d.t === 'lead?') { if (ownLead() || isHost) bc.postMessage({ t: 'lead!', room }); }
    else if (d.t === 'lead!') leadWaiters.forEach(f => f(true));
    else if (d.t === 'moving') leadMovingAt = Date.now();
    else if (d.t === 'leave') leaveRoom(true);
  });
  function leadAlive() {
    if (!bc) return Promise.resolve(false);
    if (Date.now() - leadMovingAt < 12000) return Promise.resolve(true);
    return new Promise(res => {
      const f = v => { if (!leadWaiters.delete(f)) return; res(v); };
      leadWaiters.add(f);
      bc.postMessage({ t: 'lead?', room });
      setTimeout(() => f(false), 400);
    });
  }
  let adoptHost = false;
  function claimLead(explicit, orphaned) {
    if (!room) return;
    const was = ownLead();
    store.set(leadKey(), tabId);
    if (orphaned) adoptHost = true;
    if ((explicit || orphaned) && hostConfirmed && hostRec && hostRec.c === cid && hostRec.tab && hostRec.tab !== tabId) { adoptHost = false; setHost(cid, shown(), tabId, true); }
    if (!was) { announce(); renderMembers(); }
  }
  async function initLead(code) {
    const cur = store.get('tcwt_lead_' + code);
    if (!cur || cur === tabId) { claimLead(false); return; }
    renderMembers();
    if (await leadAlive() || room !== code) return;
    claimLead(false, true);
    const known = videoPath(sess.get('tcwt_hv'));
    if (roomV && !sameVideo(roomV, VPATH) && !sameVideo(roomV, known)) goTo(roomV);
    else requestSync();
  }
  function leadLost() {
    resetRate();
    clearTimeout(sendTimer); pendingAct = null;
    const v = getVideo();
    if (v && !v.paused && VPATH && roomV && sameVideo(VPATH, roomV)) { expectEv('pause'); v.pause(); }
    announce();
    renderMembers();
  }
  addEventListener('storage', e => {
    if (room && e.key === leadKey() && e.oldValue === tabId && e.newValue !== tabId) leadLost();
  });
  function takeOver(byPlay) {
    precise = true;
    setTimeout(requestSync, 200);
    if (lastState && VPATH && roomV && sameVideo(VPATH, roomV)) {
      const wantPlay = lastState.p || !!(byPlay && !locked);
      apply({ t: expectedPos(), p: wantPlay, r: lastState.r, b: 1, local: 1 }, false);
      claimLead(true);
      if (wantPlay && !lastState.p) { pendingAct = { a: 'play' }; sendState(false); }
    } else {
      claimLead(true);
      requestSync();
    }
  }

  const ghostTimers = new Map();
  function addGhost(c, info, ms) {
    if ([...members.values()].some(x => x.c === c && !x.ghost)) return;
    members.set('g:' + c, Object.assign({}, info, { c, ghost: true, t: 'Átvált…', u: null, v: null, mv: 0 }));
    clearTimeout(ghostTimers.get(c));
    ghostTimers.set(c, setTimeout(() => {
      ghostTimers.delete(c);
      if (!members.delete('g:' + c)) return;
      if (!deviceOnline(c)) sysMsg(info.n + ' kilépett', 'pres:' + c);
      recomputeName();
      renderMembers();
    }, ms));
  }
  function dropGhost(c) {
    clearTimeout(ghostTimers.get(c));
    ghostTimers.delete(c);
    members.delete('g:' + c);
  }
  function saveKnown() {
    if (!room) return;
    const seen = new Map();
    members.forEach(m => { if (!seen.has(m.c)) seen.set(m.c, { c: m.c, n: m.n, ui: m.ui, j: m.j, a: m.a, tb: m.tb }); });
    sess.set('tcwt_known_' + room, JSON.stringify({ ts: Date.now(), list: [...seen.values()].slice(0, MAX_MEMBERS) }));
  }
  function restoreKnown(code) {
    const k = readSessJSON('tcwt_known_' + code);
    sess.del('tcwt_known_' + code);
    if (!k || !Array.isArray(k.list) || !(Date.now() - k.ts < 60000)) return;
    k.list.forEach(x => {
      if (!x || typeof x.c !== 'string' || !x.c || x.c === cid || isBanned(x.c, x.n, !!x.a)) return;
      const c = x.c.slice(0, 20);
      addGhost(c, { n: cleanName(x.n), ui: validUi(x.ui), j: +x.j || 0, a: !!x.a, tb: typeof x.tb === 'string' ? x.tb.slice(0, 20) : null }, 30000);
    });
  }

  function sendState(beat) {
    if (!room || navigating || !client || !client.connected || !isLead()) return;
    if (isHost && !VPATH) return;
    if (pending && !beat) return;
    if (!isHost && locked) return;
    if (!isHost && !(VPATH && sameVideo(VPATH, roomV))) return;
    const v = getVideo();
    const act = pendingAct; pendingAct = null;
    const s = { id: sid, c: cid, n: shown(), ui: myUi, at: Date.now(), v: isHost ? VPATH : roomV, vt: isHost ? (VPATH ? pageLabel() : '') : roomVT };
    if (act && !beat) { s.a = act.a; if (act.a === 'seek' && okTime(act.f)) s.f = act.f; }
    if (v) {
      s.p = !v.paused; s.t = v.currentTime;
      const rate = baseRate;
      if (okRate(rate) && Math.abs(rate - 1) > 0.001) s.r = rate;
      if (isHost && stalled && !v.paused) s.w = 1;
    }
    if (beat) s.b = 1;
    s.q = trackPing();
    if (isHost) { roomV = VPATH; roomVT = s.vt; sess.set('tcwt_hv', VPATH); sess.set('tcwt_hvt', s.vt); noteRoomVideoFrom(s, VPATH); }
    if (v && okTime(s.t)) lastState = { p: s.p && !s.w, t: s.t, rx: Date.now(), lag: 0, r: s.r || 1 };
    publish('state', s, true);
  }

  let inChain = Promise.resolve();
  // Átmenet: ha a szobában valaki még a régi változatot használja, az a régi csatornán van, és nem látjuk egymást.
  // A régi csatorna jelenléteit figyeljük, és egyszer szólunk.
  let oldNoted = false;
  async function onOldPresence(topic, buf, key) {
    if (oldNoted || !buf || !buf.length || buf.length > 16000) return;
    const sub = topic.slice((OLD_PREFIX + roomTopic + '/').length);
    const txt = await unseal(buf.toString(), sub, key);
    let m = null;
    try { m = JSON.parse(txt); } catch (e) { return; }
    if (oldNoted || key !== roomKey || !m || m.gone || typeof m.at !== 'number' || Math.abs(Date.now() - m.at) > PRESENCE_TTL) return;
    oldNoted = true;
    sysMsg(cleanName(m.n) + ' még a Trash2Gether régi változatát használja – amíg nem frissít, nem látjátok egymást.');
  }
  function onMessage(topic, buf, packet) {
    const key = roomKey, base = T('');
    if (key && roomTopic && topic.startsWith(OLD_PREFIX + roomTopic + '/p/')) { onOldPresence(topic, buf, key).catch(() => {}); return; }
    if (!key || !topic.startsWith(base)) return;
    const sub = topic.slice(base.length);
    if (buf && buf.length > (sub === 'h' || sub === 'm' ? 400000 : 16000)) return;
    const raw = buf && buf.length ? buf.toString() : '';
    const retained = !!(packet && packet.retain);
    inChain = inChain.then(async () => {
      if (key !== roomKey) return;
      if (!raw) { onCleared(sub); return; }
      const txt = await unseal(raw, sub, key);
      if (txt == null || key !== roomKey) return;
      const m = await unwire(txt, sub);
      if (!m || key !== roomKey) return;
      handleMessage(sub, m, retained, txt);
    }).catch(() => {});
  }

  // Valaki üresre törölte egy visszatartott üzenetünket: a saját jelenlétünket, hostként a szoba adatait visszaírjuk.
  let lastSelfFix = 0;
  function fixOwnPresence() {
    if (leaving || !client || !client.connected || Date.now() - lastSelfFix < 2000) return;
    lastSelfFix = Date.now();
    announce();
  }
  function onCleared(sub) {
    if (!room || leaving) return;
    if (sub === 'p/' + sid) fixOwnPresence();
    else if (sub === 'host' || sub === 'ban' || sub === 'cfg' || sub === 'q' || sub === 'state') reassertRetained();
  }

  const chatRate = new Map();
  function handleMessage(sub, m, retained, txt) {
    const s = m._s;
    // Csak a saját nevében küldhet bárki (a host-bejegyzésben a „c” az új host, nem a küldő).
    if (sub !== 'host' && 'c' in m && m.c !== s) return;
    if (sub.startsWith('p/')) {
      const fresh = m.gone || Date.now() - m.at <= PRESENCE_TTL;
      if (!m.gone && !okVer(m.at)) return;
      if (fresh || retained) onPresence(sub.slice(2), m.gone || !fresh ? null : m, s, m.gone && Number.isInteger(m.b) ? m.b : null);
      return;
    }
    if (m.id === sid) { if (s === cid && typeof m.q === 'string') gotPing(m.q); return; }
    if (s !== cid && isBanned(s, m.n, false)) return;
    if (sub === 'state') onState(m, retained);
    else if (sub === 'host') onHostRec(m, retained);
    else if (sub === 'cfg') onCfg(m);
    else if (sub === 'q') onQueue(m);
    else if (sub === 'm' && m.k === 'qadd') onSuggest(m, s);
    else if (sub === 'ban') onBans(m, retained);
    else if (sub === 'm' && m.k === 'kick') onKick(m);
    else if (sub === 'm' && m.k === 'chat') {
      if (s === cid && !ownTabs.has(m.id)) return;
      // Fogadó oldali korlát is (a küldőé 5 üzenet / 4 mp): egy módosított kliens se tudja elárasztani a chatet.
      const now = Date.now(), times = (chatRate.get(s) || []).filter(t => now - t < 4000);
      if (times.length >= 8) return;
      times.push(now); chatRate.set(s, times);
      if (chatRate.size > 200) chatRate.clear();
      addChat(m, s === cid, txt);
    }
    else if (sub === 'h') onHistory(m.list).catch(() => {});
    else if (sub === 'm' && m.k === 'bye') onBye(m);
    else if (sub === 'm' && m.k === 'histreq' && typeof m.id === 'string') onHistReq(m.id);
    else if (sub === 'm' && m.k === 'hist') onHist(m);
    else if (sub === 'm' && m.k === 'posreq' && m.to === cid && typeof m.id === 'string') answerPos(m.id);
    else if (sub === 'm' && m.k === 'pos' && m.to === sid && posWait && m.c === posWait.c && Date.now() < posWait.until) { posWait = null; onFollowPos(m); }
    else if (sub === 'm' && m.k === 'syncreq') onSyncReq();
  }

  const BROWSE = /^\/(?:$|(?:videos?|search|user|users|forums?|albums?|photos?|categories|channels?|playlists?|static|notices)(?:[/?]|$))/i;
  const ACTIONS = /logout|kilep|delete|torol|remove|edit|settings|password|email|avatar|messages?|upload|subscribe|follow|favou?rite|like|vote|rate|report|block|ajax|api|admin|confirm|token|action=/i;
  const safePath = u => typeof u === 'string' && u.length <= 300 && /^\/[^\s\\#]*$/.test(u) && !u.startsWith('//') && BROWSE.test(u) && !ACTIONS.test(u) && noDots(u) ? u : null;

  function followMember(m) {
    const u = safePath(m.u);
    if (!u) return;
    if (m.v && !(roomV && sameVideo(m.v, roomV))) sess.set('tcwt_follow', JSON.stringify({ c: m.c, v: m.v, n: m.n, ts: Date.now() }));
    else sess.del('tcwt_follow');
    markNav();
    location.href = location.origin + u;
  }

  let posWait = null;
  function requestFollowPos() {
    let f = null;
    try { f = JSON.parse(sess.get('tcwt_follow') || 'null'); } catch (e) {}
    sess.del('tcwt_follow');
    if (!f || !VPATH || !sameVideo(f.v, VPATH) || Date.now() - f.ts > 60000) return;
    const waitTxt = 'Igazodás hozzá: ' + clean(f.n) + '…';
    setActivity(waitTxt);
    setTimeout(() => { if (activityEl.textContent === waitTxt) setActivity(''); }, 15000);
    posWait = { c: f.c, until: Date.now() + 15000 };
    publish('m', { id: sid, c: cid, k: 'posreq', to: f.c });
  }

  let posAnswered = 0;
  function answerPos(to) {
    const v = getVideo();
    if (!v || !VPATH || Date.now() - posAnswered < 1000) return;
    posAnswered = Date.now();
    publish('m', { id: sid, c: cid, k: 'pos', to, n: shown(), v: VPATH, t: v.currentTime, p: !v.paused, at: Date.now() });
  }

  function onFollowPos(m) {
    if (!VPATH || !sameVideo(videoPath(m.v), VPATH) || !okTime(m.t)) return;
    apply({ t: m.t, p: !!m.p, n: m.n, b: 1 }, false);
    if (activityEl.textContent.startsWith('Igazodás hozzá')) setActivity('');
    showToast([icon('check-lg'), h('span', { text: ' Szinkronban vagy vele: ' + clean(m.n) })], 2600, '');
  }

  const devSeen = new Map();  // eszközönként: mikor láttuk először ebben a szobában
  let joinedAt = 0;
  const presAt = new Map();   // lapnként a legfrissebb látott jelenlét ideje: a régebbiek visszajátszását eldobjuk
  // signer: az aláíró eszköz. Egy lap jelenlétét csak az az eszköz írhatja felül vagy törölheti, amelyiké.
  // goneVia: ha csak egy szerverről esett le a lap (annak a végakarata), és a jelenléte szerint másikon is ott van,
  // akkor nem lépett ki – csak azt a szervert vesszük le róla.
  // Verziók összevetése ("1.10" > "1.9"). Idegen adat: csak számokból és pontokból álló, rövid szöveget fogadunk el.
  const verParts = x => typeof x === 'string' && /^\d{1,4}(\.\d{1,4}){0,3}$/.test(x) ? x.split('.').map(Number) : null;
  const newerVer = (a, b) => { const p = verParts(a), q = verParts(b); if (!p || !q) return false;
    for (let i = 0; i < Math.max(p.length, q.length); i++) { const d = (p[i] || 0) - (q[i] || 0); if (d) return d > 0; } return false; };
  let updateOffered = false;
  function noteVersion(sv) {
    if (updateOffered || !newerVer(sv, SCRIPT_VERSION)) return;
    if (sess.get('tcwt_updoff') === sv) return;   // ebben a böngészőlapban már szóltunk erről a verzióról
    updateOffered = true; sess.set('tcwt_updoff', sv);
    setTimeout(() => showToast([icon('arrow-right-circle'), h('span', { text: ' Új Trash2Gether: ' + sv + ' (neked ' + SCRIPT_VERSION + ' van) – ' }),
      h('a', { href: UPDATE_URL, target: '_blank', rel: 'noopener', text: 'Frissítés', style: 'color:inherit;font-weight:700;text-decoration:underline' })], 9000, 'upd'), 1500);
  }
  function checkUpdate() {
    const known = store.get('tcwt_updnew');
    if (known && newerVer(known, SCRIPT_VERSION)) noteVersion(known);
    const last = +store.get('tcwt_updchk') || 0;
    if (Math.abs(Date.now() - last) < 30 * 60000) return;
    store.set('tcwt_updchk', String(Date.now()));
    fetch(META_URL + '?t=' + Math.floor(Date.now() / 60000), { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' })
      .then(r => (r.ok ? r.text() : ''))
      .then(t => {
        const v = (/^\/\/\s*@version\s+(\S+)/m.exec(t.slice(0, 4000)) || [])[1];
        if (!verParts(v)) return;
        if (newerVer(v, SCRIPT_VERSION)) { store.set('tcwt_updnew', v); noteVersion(v); } else store.del('tcwt_updnew');
      })
      .catch(() => {});
  }
  setTimeout(checkUpdate, 4000);
  // Aki végakarat nélkül tűnt el (összeomlott vagy elaludt a gép, vagy olyan szerveren volt, ami nem küldi el),
  // ne maradjon örökre a listán: minden lap 5 percenként frissíti a jelenlétét, 16 perc csend után kilépettnek
  // vesszük. A saját óránkkal mérünk (a másik gép órája eltérhet).
  const STALE_MS = 16 * 60000;
  let staleTick = Date.now();
  setInterval(() => {
    const now = Date.now(), slept = now - staleTick > 3 * 60000;
    staleTick = now;
    if (!room) return;
    // Ha mi aludtunk (pl. a gép alvó módban volt), nem ők hallgattak: újraindítjuk az órájukat.
    if (slept) { members.forEach(mm => { if (mm.rx) mm.rx = now; }); return; }
    [...members].forEach(([psid, mm]) => { if (mm.rx && now - mm.rx > STALE_MS) onPresence(psid, null, mm.c, null); });
  }, 60000);
  function onPresence(psid, m, signer, goneVia) {
    if (psid === sid) { if (m && signer !== cid) fixOwnPresence(); return; }
    if (!/^[a-z0-9]{1,20}$/.test(psid)) return;
    if (signer === cid) { if (m) ownTabs.add(psid); else ownTabs.delete(psid); return; }
    const old = members.get(psid);
    if (old && old.c !== signer) return;
    if (!m) {
      if (!old) return;
      if (goneVia != null && old.br) {
        old.br &= ~(1 << goneVia);
        // Csak az számít, amelyik szerveren mi is fent vagyunk: ha a lapot csak olyanon látnánk, ami nekünk
        // elérhetetlen (pl. nálunk le van tiltva), akkor nekünk már nincs itt.
        if (old.br & (client ? client.mask : 0)) return;
      }
      presAt.set(psid, (old.at || 0) + 1);   // a lap utolsó jelenlétét se lehessen visszajátszani a kilépése után
    } else {
      if (typeof m.c !== 'string' || !m.c || m.at < (presAt.get(psid) || 0)) return;
      if (presAt.size > 500) presAt.clear();
      presAt.set(psid, m.at);
      if (!old && (members.size >= MAX_MEMBERS || [...members.values()].filter(x => x.c === m.c).length >= 6)) return;
      if (isBanned(m.c, m.n, !!m.a)) { members.delete(psid); if (isHost) refreshRetained(); renderMembers(); return; }
    }
    const c = (m && m.c) || old.c;
    if (m && !devSeen.has(c)) { if (devSeen.size > 500) devSeen.clear(); devSeen.set(c, Date.now()); }
    const was = deviceOnline(c);
    if (m) {
      const mvMs = typeof m.mv === 'number' && isFinite(m.mv) ? Math.min(Math.max(m.mv, 0), 60000) : 0;
      members.set(psid, { c: c.slice(0, 20), n: cleanName(m.n), hc: typeof m.hc === 'string' ? m.hc.slice(0, 20) : null, v: videoPath(m.v), ui: validUi(m.ui), t: clean(m.t || '', TITLE_MAX), u: safePath(m.u), j: +m.j || 0, a: !!m.a, tb: typeof m.tb === 'string' ? m.tb.slice(0, 20) : null, mv: mvMs ? Date.now() + mvMs : 0, ld: !!m.ld, at: m.at, rx: Date.now(), sv: typeof m.sv === 'string' ? m.sv.slice(0, 20) : '', br: Number.isInteger(m.br) ? m.br & ((1 << BROKERS.length) - 1) : 0 });
      dropGhost(c);
      noteVersion(m.sv);
    } else {
      members.delete(psid);
      if (old.mv > Date.now()) addGhost(c, old, old.mv - Date.now());
    }
    const is = deviceOnline(c);
    const quiet = Date.now() - connectedAt < 3000;
    if (!was && is) {
      if (isHost) refreshRetained();
      if (leaveTimers.has(c)) { clearTimeout(leaveTimers.get(c)); leaveTimers.delete(c); }
      else if (!quiet) sysMsg(cleanName(m.n) + ' csatlakozott', 'pres:' + c);
    }
    if (was && !is && !leaveTimers.has(c) && !quiet) {
      const nm = old.n;
      leaveTimers.set(c, setTimeout(() => {
        leaveTimers.delete(c);
        if (!deviceOnline(c)) sysMsg(nm + ' kilépett', 'pres:' + c);
      }, LEAVE_GRACE));
    }
    recomputeName();
    renderMembers();
  }

  let roomName = '';
  const shown = () => roomName || name;
  function recomputeName() {
    if (!room) { roomName = ''; return; }
    let nn = name;
    if (!acct) {
      const myJ = myJoin();
      const taken = new Set();
      // Aki csak utánunk érkezett, az nem veheti el a nevünket (a korábbi belépési időt bárki állíthatja magáról).
      const late = c => (devSeen.get(c) || 0) > joinedAt + SETTLE_MS;
      members.forEach(m => {
        if (m.c === cid || late(m.c)) return;
        if (m.a || !m.j || m.j < myJ || (m.j === myJ && m.c < cid)) taken.add(norm(m.n));
      });
      if (taken.has(norm(nn))) {
        let k = 2;
        while (taken.has(norm(name + ' (' + k + ')'))) k++;
        nn = name + ' (' + k + ')';
      }
    }
    if (nn === shown() && roomName) return;
    const changed = nn !== shown();
    roomName = nn;
    if (changed) {
      if (nn !== name) sysMsg('A neved foglalt, itt „' + nn + '” leszel.');
      announce();
      renderMembers();
    }
  }

  const deviceOnline = c => [...members.values()].some(x => x.c === c);
  const leaveTimers = new Map();
  const LEAVE_GRACE = 20000;
  const MAX_MEMBERS = 60;

  function onBye(m) {
    if (typeof m.c !== 'string' || typeof m.id !== 'string' || m.c === cid || !fresh(m)) return;
    const c = m.c, known = members.get(m.id)?.c === c ? members.get(m.id) : null;
    if (hostRec && hostRec.c === c) { hostByeAt = Date.now(); if (!hostGoneSince) hostGoneSince = Date.now(); }
    const nm = known ? known.n : cleanName(m.n);
    const t = leaveTimers.get(c);
    if (t) { clearTimeout(t); leaveTimers.delete(c); }
    if (known) members.delete(m.id);
    dropGhost(c);
    if (!deviceOnline(c) && Date.now() - (kickedAt.get(c) || 0) >= 15000) {
      // Kilépés gombbal: azonnal. Lap bezárásakor pár mp türelem: ha csak újratöltötte, csendben visszajön.
      if (m.x) sysMsg(nm + ' kilépett', 'pres:' + c);
      else leaveTimers.set(c, setTimeout(() => { leaveTimers.delete(c); if (!deviceOnline(c)) sysMsg(nm + ' kilépett', 'pres:' + c); }, 5000));
    }
    renderMembers();
  }

  // A szoba videójának változását minden lap ugyanúgy észleli (host, nézők, háttérben lévő és mellék lapok is):
  // amikor a szoba videója eltér attól, amit ez a lap utoljára ismert, egyszer kiírja. Belépéskor, újratöltéskor,
  // visszaugráskor nincs váltás, ezért ott nem ír semmit.
  // Csak az adott küldő legfrissebb állapota számít: a host új oldalán a régi oldal visszatartott (retained)
  // állapota később érkezhet meg, mint amit az új oldal már elküldött – az nem videóváltás vissza.
  let roomVidC = '', roomVidAt = 0;
  function noteRoomVideoFrom(m, v) {
    if (m.c === roomVidC && m.at < roomVidAt) return;
    roomVidC = m.c; roomVidAt = m.at;
    noteRoomVideo(v, clean(m.vt || '', TITLE_MAX));
  }
  function noteRoomVideo(v, title) {
    const id = vidId(v);
    if (!room || !id || !videoPath(v)) return;
    const key = 'tcwt_rv_' + room, prev = sess.get(key);
    if (prev === id) return;
    sess.set(key, id);
    if (prev) sysMsg(VIDEO_MSG + (title || 'videó'), 'video', id, v);
  }
  const lastAt = new Map();
  // Amíg nem tudjuk, ki a host (és a lapnak sincs elmentve), az állapotot félretesszük – így egy idegen
  // visszatartott állapota nem viheti el az újonnan belépőt másik videóra.
  function flushStateWait() {
    const w = stateWait;
    stateWait = null;
    if (w) onState(w.m, w.retained);
  }
  function onState(m, retained) {
    if (!okVer(m.at)) return;
    if (!hostRec && !hostConfirmed) { if (!stateWait || m.at >= stateWait.m.at) stateWait = { m, retained }; return; }
    if (typeof m.id === 'string') {
      const k = m._s + '/' + m.id;   // küldőnként: más nem „fagyaszthatja be” a host állapotait egy jövőbeli idővel
      if (m.at <= (lastAt.get(k) || 0)) return;
      if (lastAt.size > 300) lastAt.clear();
      lastAt.set(k, m.at);
    }
    const v = videoPath(m.v);
    const fromHost = !hostRec || m.c === hostRec.c;
    if (!fromHost && roomV && !sameVideo(v, roomV)) return;
    if (!fromHost && locked && !retained) return;
    stateSeen = true;
    noteRoomClock(m, v, retained);
    const lead = isLead();
    if (fromHost) noteRoomVideoFrom(m, v);
    if (isHost && v && (!roomV || (sameVideo(v, roomV) && !roomVT))) { roomV = v; roomVT = clean(m.vt || '', TITLE_MAX); }
    if (!isHost) {
      const known = videoPath(sess.get('tcwt_hv'));
      const prevV = roomV;
      roomV = v;
      roomVT = clean(m.vt || '', TITLE_MAX);
      if (lead) {
        if (v) { sess.set('tcwt_hv', v); sess.set('tcwt_hvt', roomVT); } else sess.del('tcwt_hv');
        if (v && !sameVideo(v, known) && !sameVideo(v, VPATH)) { goTo(v); return; }
      } else if (document.hidden && v && prevV && !sameVideo(v, prevV) && VPATH && sameVideo(VPATH, prevV) && !retained) { goTo(v); return; }
      renderMembers();
    }
    if (VPATH && sameVideo(v, VPATH) && sess.get('tcwt_went') === vidId(VPATH)) sess.del('tcwt_went');
    if (VPATH && sameVideo(v, VPATH) && okTime(m.t)) {
      const run = !!m.p && !m.w;
      lastState = { p: run, t: m.t, rx: Date.now(), r: okRate(m.r) ? m.r : 1,
        lag: retained && run ? Math.min(Math.max((Date.now() - m.at) / 1000, 0), 6 * 3600) * (okRate(m.r) ? m.r : 1) : 0 };
      if (!lead) return;
      m._rx = Date.now();
      apply(m, retained);
      if (retained && !isHost) setTimeout(requestSync, 100);
    }
  }

  let lockAt = 0;
  function setLock(on) {
    if (!isHost || Date.now() - lockAt < 1500) return;
    lockAt = Date.now();
    lockBtn.disabled = true;
    setTimeout(() => { lockBtn.disabled = false; }, 1500);
    locked = !!on;
    lockV = nextVer(lockV);
    sess.set('tcwt_lock_' + room, locked ? '1' : '0');
    sess.set('tcwt_lockv_' + room, String(lockV));
    publish('cfg', { id: sid, c: cid, lock: locked, v: lockV }, true);
    sysMsg(locked ? 'Korlátoztad: csak a host kontrollál 🔒' : 'Mindenki tudja kontrollálni a lejátszást 🔓', 'lock');
    renderMembers();
  }
  function onCfg(m) {
    if (!m || typeof m.lock !== 'boolean' || !okVer(m.v)) return;
    if (!hostRec || m._s !== hostRec.c) { waitAuth('cfg', m); return; }
    if (m.v < lockV) return;
    lockV = m.v;
    sess.set('tcwt_lockv_' + room, String(lockV));
    if (m.lock === locked) return;
    locked = m.lock;
    sess.set('tcwt_lock_' + room, locked ? '1' : '0');
    if (stateSeen) sysMsg(locked ? 'Csak a host kontrollál 🔒' : 'Mindenki tudja kontrollálni a lejátszást 🔓', 'lock');
    renderMembers();
  }
  // ---- Közös videósor ----
  // A sort csak a host írja (aláírt, megtartott üzenet, mint a Korlátozás), így az újonnan belépők is látják, és
  // más nem írhatja át. Javasolni bárki tud: a javaslat a host oldalához megy, az teszi a sor végére. Az automatikus
  // továbblépés a sor elejéről veszi a következőt; amit a host elindít, lekerül a sorról.
  const Q_MAX = 30, QUEUE_SINCE = '1.4';
  let queue = [], qV = 0;
  function qItem(x) {
    if (!x || typeof x !== 'object') return null;
    const id = typeof x.id === 'string' && /^\d{1,10}$/.test(x.id) ? x.id : null;
    if (!id) return null;
    const p = videoPath(x.p);
    return { id, p: p && vidId(p) === id ? p : '/video/' + id, t: clean(x.t || 'Videó', TITLE_MAX), d: okTime(x.d) ? Math.round(x.d) : 0, by: x.by ? cleanName(x.by) : '' };
  }
  const inQueue = id => queue.some(x => x.id === id);
  function saveQueue() { if (room) sess.set('tcwt_q_' + room, JSON.stringify({ v: qV, list: queue })); }
  function loadQueue(code) {
    const o = readSessJSON('tcwt_q_' + code);
    queue = o && Array.isArray(o.list) ? o.list.map(qItem).filter(Boolean).slice(0, Q_MAX) : [];
    qV = o && okVer(o.v) ? o.v : 0;
  }
  const queueMsg = () => ({ id: sid, c: cid, list: queue, v: qV });
  function publishQueue() {
    if (!isHost || !room) return;
    qV = nextVer(qV);
    saveQueue();
    publish('q', queueMsg(), true);
    renderQueue();
  }
  function onQueue(m) {
    if (!m || !Array.isArray(m.list) || m.list.length > Q_MAX || !okVer(m.v)) return;
    if (!hostRec || m._s !== hostRec.c) { waitAuth('q', m); return; }
    if (m.v < qV) return;
    qV = m.v;
    queue = m.list.map(qItem).filter(Boolean);
    saveQueue();
    renderQueue();
  }
  function qAddLocal(it) {
    if (!it || inQueue(it.id) || (roomV && sameVideo('/video/' + it.id, roomV)) || queue.length >= Q_MAX) return false;
    queue.push(it);
    publishQueue();
    return true;
  }
  function qRemove(id) { if (!isHost) return; queue = queue.filter(x => x.id !== id); publishQueue(); }
  function qUp(id) {
    const i = queue.findIndex(x => x.id === id);
    if (!isHost || i < 1) return;
    [queue[i - 1], queue[i]] = [queue[i], queue[i - 1]];
    publishQueue();
  }
  function qPlay(id) {
    const it = queue.find(x => x.id === id);
    if (!isHost || !it) return;
    markNav();
    location.href = location.origin + it.p;
  }
  function suggest(it) {
    if (!room || !it) return false;
    if (isHost) {
      const ok = qAddLocal(Object.assign({}, it, { by: shown() }));
      showToast([icon(ok ? 'check-lg' : 'exclamation-circle'), h('span', { text: ok ? ' Sorba téve' : (queue.length >= Q_MAX ? ' Megtelt a sor' : ' Már a sorban van') })], 1600, '');
      return ok;
    }
    // A videósor az 1.4-es változattól van: régebbi host nem látná a javaslatot.
    const hm = hostRec && [...members.values()].find(x => x.c === hostRec.c && !x.ghost);
    if (hm && newerVer(QUEUE_SINCE, hm.sv || '0')) {
      showToast([icon('exclamation-circle'), h('span', { text: ' A hostnál régebbi Trash2Gether fut, még nem kezeli a sort' })], 3000, '');
      return false;
    }
    publish('m', { id: sid, c: cid, k: 'qadd', n: shown(), ts: Date.now(), q: rand(8), it: { id: it.id, p: it.p, t: it.t, d: it.d } });
    showToast([icon('check-lg'), h('span', { text: ' Javasoltad a hostnak' })], 1600, '');
    return true;
  }
  const sugRate = new Map();
  function onSuggest(m, s) {
    if (!fresh(m)) return;
    const now = Date.now(), times = (sugRate.get(s) || []).filter(t => now - t < 30000);
    if (times.length >= 5) return;
    times.push(now); sugRate.set(s, times);
    if (sugRate.size > 200) sugRate.clear();
    const it = qItem(Object.assign({}, m.it, { by: m.n }));
    if (!it) return;
    if (!inQueue(it.id)) sysMsg('💡 ' + cleanName(m.n) + ' javasolta: ' + it.t);
    if (isHost) qAddLocal(it);
  }
  // A host oldala: ha egy sorban lévő videóra került (bármi módon), az lekerül a sorról.
  setInterval(() => {
    if (!isHost || !room || !VPATH || !queue.length) return;
    const id = vidId(VPATH);
    if (inQueue(id)) { queue = queue.filter(x => x.id !== id); publishQueue(); }
  }, 2000);

  function revertToHost() {
    if (!lastState || !VPATH || !sameVideo(VPATH, roomV)) return;
    apply({ t: expectedPos(), p: lastState.p, r: lastState.r, b: 1, local: 1 }, false);
    lockToast();
  }

  function okTime(t) { return typeof t === 'number' && isFinite(t) && t >= 0 && t < 1e7; }
  let rtt = 0;
  const pingSent = new Map();
  function trackPing() {
    const q = rand(6);
    if (pingSent.size > 30) pingSent.clear();
    pingSent.set(q, performance.now());
    return q;
  }
  function gotPing(q) {
    const t0 = pingSent.get(q);
    if (t0 == null) return;
    pingSent.delete(q);
    const d = Math.min(Math.max(performance.now() - t0, 0), 3000);
    rtt = rtt ? rtt * 0.7 + d * 0.3 : d;
  }
  function sendPing() { if (room && client && client.connected) publish('m', { id: sid, k: 'ping', q: trackPing() }); }
  setInterval(sendPing, 20000);

  let rateTimer = null, nudging = false, baseRate = 1, ownRateAt = 0, ownRate = 0;
  const setRate = (v, x) => {
    ownRateAt = performance.now();
    ownRate = x;
    v.playbackRate = x;
    const sb = !nudging && document.querySelector('.speed-btn');
    const tn = sb && [...sb.childNodes].find(n => n.nodeType === 3 && /\d\s*x/i.test(n.nodeValue));
    if (tn) tn.nodeValue = tn.nodeValue.replace(/[\d.]+\s*x/i, (Math.round(x * 100) / 100) + 'x');
  };
  const okRate = r => typeof r === 'number' && isFinite(r) && r >= 0.25 && r <= 4;
  function resetRate() {
    clearTimeout(rateTimer);
    if (!nudging) return;
    nudging = false;
    const v = getVideo();
    if (v) setRate(v, baseRate);
  }
  function nudge(v, drift, strong) {
    if (!nudging && Math.abs(v.playbackRate - baseRate) > 0.001) return;
    nudging = true;
    const k = strong ? 0.25 : Math.abs(drift) < 0.6 ? 0.07 : 0.12;
    setRate(v, baseRate * (drift > 0 ? 1 + k : 1 - k));
    clearTimeout(rateTimer);
    rateTimer = setTimeout(resetRate, Math.min(Math.abs(drift) / (k * baseRate) * 1000, strong ? 25000 : 10000));
  }
  function aheadOf(v) {
    try { const b = v.buffered, t = v.currentTime; if (!b || typeof b.length !== 'number' || (!b.length && v.readyState >= 3)) return Infinity; for (let i = 0; i < b.length; i++) if (b.start(i) <= t + 0.05 && b.end(i) >= t) return b.end(i) - t; } catch (e) {}
    return 0;
  }
  // Be van-e már töltve a videó a t-től kezdődő rövid szakaszon (oda tekerni azonnali, nem kell újra várni).
  function buffered(v, t, ahead) {
    try {
      const b = v.buffered;
      // ha a böngésző nem ad adatot (lejátszható állapotban üres lista), ne tartsuk vissza a tekerést
      if (!b || typeof b.length !== 'number' || (!b.length && v.readyState >= 3)) return true;
      for (let i = 0; i < b.length; i++) if (b.start(i) <= t + 0.05 && (b.end(i) >= t + ahead || (v.duration && b.end(i) >= v.duration - 0.3))) return true;
    } catch (e) {}
    return false;
  }
  function setBaseRate(v, rate) {
    if (Math.abs(rate - baseRate) < 0.001) return;
    baseRate = rate;
    if (!nudging) setRate(v, rate);
  }
  let seekT0 = 0, seekLat = 0, precise = true;
  // Be nem töltött helyre tekerés: bufLat = a tekeréstől az induló lejátszásig mért idő (ennyivel célzunk előrébb).
  const CATCHUP_MAX = 6;
  let blindT0 = 0, bufLat = 0;
  setTimeout(() => { precise = false; }, 20000);
  function seekTo(v, t) {
    expectEv('seek');
    seekT0 = performance.now();
    v.currentTime = t;
  }
  function expectedPos() {
    const age = Date.now() - lastState.rx;
    if (!lastState.p) return lastState.t;
    return lastState.t + lastState.lag + (age + (lastState.lag ? 0 : Math.min(rtt, 1500))) / 1000 * (lastState.r || 1);
  }

  let stalled = false, stallTimer = null, holdShown = false, lastLocal = 0, progT = -1, progAt = 0;
  function frozenInBackground(v) {
    if (v.currentTime !== progT) { progT = v.currentTime; progAt = Date.now(); return false; }
    return document.hidden && Date.now() - progAt > 1500;
  }
  function localSync() {
    if (isHost || !room || !isLead() || !lastState || !lastState.p || !VPATH || !sameVideo(VPATH, roomV)) return;
    const v = getVideo();
    if (!v || v !== hooked || v.paused || v.seeking || v.readyState < 3 || expect.seek || pending || frozenInBackground(v)) return;
    if (Date.now() - lastLocal < 2500 || Date.now() - lastState.rx > 5 * 60000) return;
    apply({ t: expectedPos(), p: true, r: lastState.r, b: 1, local: 1 }, false);
  }

  function apply(m, retained) {
    if (!okTime(m.t)) return;
    if (m._rx == null) m._rx = Date.now();
    const v = getVideo();
    if (!v) { pending = { m, retained }; return; }
    if (v !== hooked) { pending = { m, retained }; hook(); return; }
    if (v.readyState < 1) {
      pending = { m, retained };
      if (!metaWait) {
        metaWait = true;
        v.addEventListener('loadedmetadata', () => { metaWait = false; const p = pending; pending = null; if (p) apply(p.m, p.retained); }, { once: true });
      }
      return;
    }
    const rate = okRate(m.r) ? m.r : 1;
    setBaseRate(v, rate);
    const run = !!m.p && !m.w;
    if (m.w && !m.local) { setActivity('⏳ ' + clean(m.n) + ' videója tölt, várunk…'); holdShown = true; }
    else if (holdShown && run) { holdShown = false; setActivity(''); }
    let t = m.t;
    if (run && retained && typeof m.at === 'number' && isFinite(m.at)) t += Math.min(Math.max((Date.now() - m.at) / 1000, 0), 6 * 3600) * rate;
    else if (run && !m.local) t += (Math.min(rtt, 1500) + Math.min(Date.now() - m._rx, 60000)) / 1000 * rate;
    if (v.duration && t > v.duration - 0.25) t = Math.max(0, v.duration - 0.25);
    if (!run) {
      resetRate();
      if (!v.paused) { expectEv('pause'); v.pause(); }
      if (Math.abs(t - v.currentTime) > 0.05) seekTo(v, t);
    } else {
      const drift = t - v.currentTime;
      if (!v.paused && !v.seeking && v.readyState < 3) { /* buffering: catch up once it plays again */ }
      // Egy korábbi tekerés még tölt: újabb tekerés újrakezdené a töltést, és lassú netnél a videó sosem indulna el
      // (a host 4 mp-enkénti jelzése mindig újra tekerne). Csak ha nagyon beragadt (20 mp), próbáljuk újra.
      else if (v.seeking && !(seekT0 && performance.now() - seekT0 > 20000)) { /* várunk */ }
      else if (Math.abs(drift) > (precise ? PRECISE_DRIFT : HARD_DRIFT)) {
        // Betöltött helyre azonnal tekerünk. Ha a cél még nincs betöltve, kis eltérést gyorsabb/lassabb
        // lejátszással hozunk be (a videó közben megy tovább); nagyobbnál előre tekerünk, a mért töltési idővel
        // előrébb célozva, hogy mire elindul, ne legyen megint lemaradva.
        const dur = v.duration ? Math.max(0, v.duration - 0.25) : Infinity;
        const target = Math.min(t + (seekLat || 0.3) * rate, dur);
        if (blindT0 && v.seeking) bufLat = Math.max(bufLat, (performance.now() - blindT0) / 1000);
        if (buffered(v, target, 1.5)) { resetRate(); seekTo(v, target); }
        // erős (1,25x) gyorsítás csak elég előretöltött anyaggal, különben ez fogyasztaná el a puffert, és megint akadna
        else if (Math.abs(drift) <= CATCHUP_MAX && !precise) nudge(v, drift, drift < 0 || aheadOf(v) >= 4);
        else {
          resetRate(); blindT0 = performance.now();
          seekTo(v, Math.min(t + ((seekLat || 0.3) + Math.min(Math.max(bufLat, 1), 10)) * rate, dur));
        }
      }
      else if (precise && !retained && !m.local) precise = false;
      else if (!v.paused && Math.abs(drift) > SOFT_DRIFT) { if (isHost) { if (!m.b && Math.abs(drift) > 0.3) seekTo(v, t); } else nudge(v, drift); }
      if (v.paused) playSafe(v);
    }
    if (!retained && !m.b && typeof m.a === 'string') showAction(m);
  }

  // A Trash City némítás gombja a saját „muted” osztályából dolgozik, nem a videó állapotából. Ha a script némít
  // vagy visszahangosít, ezt is átállítjuk, különben az oldal hangszóró gombja az első kattintásra nem csinál semmit.
  function setMuted(v, on) {
    v.muted = on;
    const mb = document.querySelector('.video-container .mute-btn');
    if (!mb) return;
    mb.classList.toggle('muted', on);
    const tip = mb.querySelector('.tooltip');
    if (tip) tip.textContent = on ? 'Némítás feloldása (m)' : 'Némítás (m)';
  }
  let tapMode = 'play';
  function playSafe(v) {
    expectEv('play');
    const p = v.play();
    if (!p || !p.catch) return;
    p.catch(err => {
      expect.play = 0;
      if (!err || err.name !== 'NotAllowedError') return;
      if (!v.muted) {
        setMuted(v, true);
        expectEv('play');
        v.play().then(() => needTap('unmute'), () => { expect.play = 0; needTap('play'); });
      } else needTap('play');
    });
  }
  function requestSync() {
    if (!isHost && room && VPATH && roomV && sameVideo(VPATH, roomV)) publish('m', { id: sid, c: cid, k: 'syncreq' });
  }
  let syncAnswered = 0;
  function onSyncReq() {
    if (!isHost || Date.now() - syncAnswered < 1000) return;
    syncAnswered = Date.now();
    sendState(true);
  }

  let pendingAct = null, lastTime = 0, seekFrom = null, autoTimer = null, scrubPaused = false;
  const PAGE_T0 = Date.now();
  const userClick = () => { const ua = navigator.userActivation; return !ua || typeof ua.isActive !== 'boolean' || ua.isActive; };
  // Egy eszközön csak a vezető lap játszhatja a szoba videóját. A többi (pl. a videóváltáskor a háttérben
  // utánajött régi lap) álljon: az oldal automatikus lejátszása akár a script betöltődése előtt elindíthatja,
  // és akkor szinkron nélkül szólna tovább, a szünetet sem követné.
  function holdFollower() {
    const v = hooked;
    if (!room || !v || v.paused || navigating || isLead()) return;
    if (!(VPATH && roomV && sameVideo(VPATH, roomV))) return;
    expectEv('pause'); v.pause();
  }
  setInterval(holdFollower, 1000);
  function autoEvent() {
    const ua = navigator.userActivation;
    const noClick = ua && typeof ua.isActive === 'boolean' ? !ua.isActive : null;
    if (Date.now() - PAGE_T0 < 15000) return noClick === null ? !stateSeen : noClick;
    return noClick === true && Date.now() - shownAt < 1500;
  }
  const scrubbing = () => { const vc = hooked && hooked.closest('.video-container'); return !!(vc && vc.classList.contains('scrubbing')); };
  let endResumeChecked = false;
  function fixEndResume(v) {
    if (endResumeChecked || URL_T || !(resumeAt > 0)) return;
    const check = () => {
      if (endResumeChecked || !(v.duration >= 240)) return;
      endResumeChecked = true;
      if (resumeAt < v.duration - 2) return;
      try { localStorage.setItem(RESUME_KEY, '0'); } catch (e) {}
      if (v.currentTime < v.duration - 2.5) return;
      const wasEnded = v.ended;
      seekTo(v, 0);
      // Az oldal automatikusan elindította volna, de a vége miatt rögtön megállt: indítsuk az elejéről
      // (szobában a nézőknél a szinkron dönt).
      if (wasEnded && (!room || isHost)) playSafe(v);
    };
    if (v.readyState >= 1) check(); else v.addEventListener('loadedmetadata', () => setTimeout(check, 0), { once: true });
  }
  function hook() {
    const v = getVideo();
    if (!v || v === hooked) return;
    hooked = v;
    setTimeout(holdFollower, 0);
    addMenuItem();
    fixEndResume(v);
    v.addEventListener('timeupdate', () => { if (!v.seeking) lastTime = v.currentTime; });
    // Az oldal a metaadatok betöltésekor magától a mentett helyre teker (hosszú videóknál). Lassú netnél ez jóval
    // az oldal betöltése után történik – ne higgyük kézi tekerésnek, és ne küldjük el a szobának.
    let metaAt = -1e9, siteSeek = false;
    v.addEventListener('loadedmetadata', () => { metaAt = performance.now(); });
    v.addEventListener('seeking', () => {
      if (!expect.seek && performance.now() - metaAt < 500) siteSeek = true;
      if (!expect.seek && seekFrom == null) seekFrom = lastTime;
    });
    ['play', 'pause', 'seeked'].forEach(ev => v.addEventListener(ev, () => {
      if (ev === 'seeked' && consume('seek')) {
        seekFrom = null; lastTime = v.currentTime;
        if (seekT0) { const d = Math.min((performance.now() - seekT0) / 1000, 3); seekLat = seekLat ? seekLat * 0.7 + d * 0.3 : d; seekT0 = 0; }
        return;
      }
      if ((ev === 'play' && consume('play')) || (ev === 'pause' && consume('pause'))) return;
      if (!room) { if (ev === 'seeked') { seekFrom = null; lastTime = v.currentTime; } return; }
      const onRoomVideo = !!(VPATH && roomV && sameVideo(VPATH, roomV));
      // A videó magától ért véget egy nézőnél: ez nem megállítás. Ha elküldené, a pár tizeddel lemaradó
      // hostot a vége előtt megállítaná, így nála sosem érne véget a videó (és az automatikus lejátszás sem indulna).
      if (ev === 'pause' && v.ended && !isHost) { seekFrom = null; lastTime = v.currentTime; return; }
      // Ugyanez az oldal „ismétlés” menüpontjával: ha egy nézőnél a végéről az elejére ugrik a videó, az nem tekerés.
      if (ev === 'seeked' && !isHost && v.loop && seekFrom != null && v.duration && seekFrom > v.duration - 1.5 && v.currentTime < 1) {
        seekFrom = null; lastTime = v.currentTime;
        if (lastState && onRoomVideo && isLead()) apply({ t: expectedPos(), p: lastState.p, r: lastState.r, b: 1, local: 1 }, false);
        return;
      }
      const bySite = ev === 'seeked' && siteSeek;
      if (ev === 'seeked') siteSeek = false;
      if (bySite || autoEvent()) {
        seekFrom = null; lastTime = v.currentTime;
        if (!isLead()) {
          if (ev === 'play' && onRoomVideo) { expectEv('pause'); v.pause(); }
          else if (ev === 'play' && VPATH && hostDevice() && !askDismissed && askEl.hidden) {
            askEl.hidden = false; updateStatus();
            if (!panelOpen) showToast([icon('broadcast'), h('span', { text: ' Megmutathatod a szobának – nyisd meg a panelt' })], 4000, '');
          }
          return;
        }
        clearTimeout(autoTimer);
        autoTimer = setTimeout(() => {
          if (!room || !isLead()) return;
          if (isHost) sendState(true);
          else if (lastState && onRoomVideo) apply({ t: expectedPos(), p: lastState.p, r: lastState.r, b: 1, local: 1 }, false);
        }, 400);
        return;
      }
      lastLocal = Date.now();
      if (!isLead()) {
        seekFrom = null; lastTime = v.currentTime;
        // Csak valódi kattintásra/billentyűre veszi át a nézést; magától induló lejátszás itt nem játszhat.
        if (ev === 'play' && onRoomVideo) { if (userClick()) takeOver(true); else { expectEv('pause'); v.pause(); } }
        else if (ev === 'play' && VPATH && hostDevice() && !askDismissed) { askEl.hidden = false; updateStatus(); togglePanel(true); }
        return;
      }
      if (scrubbing()) { if (ev === 'pause') scrubPaused = true; return; }
      if (!client || !client.connected) { seekFrom = null; lastTime = v.currentTime; pendingAct = null; return; }
      if (locked && !isHost) { seekFrom = null; clearTimeout(sendTimer); sendTimer = setTimeout(revertToHost, 100); return; }
      if (ev === 'seeked') {
        const from = seekFrom; seekFrom = null; lastTime = v.currentTime;
        const start = pendingAct && pendingAct.a === 'seek' ? pendingAct.f : from;
        if (start != null && Math.abs(v.currentTime - start) >= 1) pendingAct = { a: 'seek', f: start };
      } else if (ev === 'play' && scrubPaused) {
        scrubPaused = false;
        clearTimeout(sendTimer);
        sendTimer = setTimeout(() => sendState(false), 160);
        return;
      } else if (!(pendingAct && pendingAct.a === 'seek')) {
        pendingAct = ev === 'pause' && v.ended ? null : { a: ev };
      }
      if (ev === 'seeked') scrubPaused = false;
      clearTimeout(sendTimer);
      sendTimer = setTimeout(() => sendState(false), ev === 'seeked' ? 150 : ev === 'pause' ? 0 : 40);
    }));
    v.addEventListener('waiting', () => {
      if (!room || !isHost) return;
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        if (room && isHost && !v.paused && v.readyState < 3 && !stalled) { stalled = true; sendState(false); }
      }, 700);
    });
    v.addEventListener('playing', () => {
      if (blindT0) { const d = Math.min((performance.now() - blindT0) / 1000, 15); bufLat = bufLat ? bufLat * 0.5 + d * 0.5 : d; blindT0 = 0; }
      clearTimeout(stallTimer);
      if (stalled) { stalled = false; if (isHost && room) sendState(false); }
      else if (!isHost && room) setTimeout(localSync, 300);
    });
    v.addEventListener('pause', () => { clearTimeout(stallTimer); if (stalled) { stalled = false; } });
    // Ha a némítva indult videót az oldal saját hangszóró gombjával hangosítod vissza, a „Hang be” gomb is eltűnik.
    v.addEventListener('volumechange', () => {
      if (!v.muted && tapMode === 'unmute' && tapBtn.style.display !== 'none') { tapBtn.style.display = 'none'; setActivity(''); }
    });
    v.addEventListener('ratechange', () => {
      if ((performance.now() - ownRateAt < 500 && Math.abs(v.playbackRate - ownRate) < 0.0005) || !okRate(v.playbackRate)) return;
      const wasNudging = nudging;
      clearTimeout(rateTimer); nudging = false;
      if (room && !isHost && locked) { if (lastState) setRate(v, baseRate); return; }
      // A Trash City sebességgombja az éppen aktuális sebességhez ad 0,25-öt. Ha közben a script finoman
      // gyorsított/lassított a szinkronhoz (pl. 1,07x), abból 1,32x lenne: ilyenkor a valódi alapból számolunk.
      if (wasNudging) { baseRate = baseRate + 0.25 > 2 ? 0.25 : baseRate + 0.25; setRate(v, baseRate); }
      else baseRate = v.playbackRate;
      if (!room) return;
      clearTimeout(sendTimer);
      sendTimer = setTimeout(() => sendState(false), 120);
    });
    if (pending) { const p = pending; pending = null; apply(p.m, p.retained); }
  }
  setInterval(() => {
    hook();
    if (room && hooked && hooked.preload !== 'auto') { try { hooked.preload = 'auto'; } catch (e) {} }
    localSync();
  }, 1000);
  // A böngésző Vissza/Előre gombjánál a régi oldal a memóriából (bfcache) is visszajöhet, a régi állapotával:
  // közben mások kiléphettek, a chat és a host változhatott, vagy épp egy későbbi oldalon kiléptél / másik
  // szobába mentél. Ezért úgy kezeljük, mint egy friss betöltést: a böngészőlap mostani adataiból indulunk újra.
  addEventListener('pageshow', e => {
    if (!e.persisted) return;
    navigating = false; leaving = false;
    const cur = validCode(sess.get('tcwt_room') || '') ? sess.get('tcwt_room') : '';
    if (cur) { connect(cur); renderMembers(); return; }
    if (room) dropRoomLocal();
  });
  // Csak ennél a lapnál zárja le a szobát, üzenet nélkül (a kilépést egy másik oldal már elküldte).
  function dropRoomLocal() {
    if (client) { const c = client; client = null; try { c.end(true); } catch (e) {} }
    resetRoomState();
    room = ''; roomV = null; roomVT = '';
    chatLog = []; seenIds.clear();
    msgsEl.replaceChildren(emptyEl);
    unread = 0; updateBadge();
    setLive(false);
  }
  setTimeout(() => { if (room) { announce(); renderMembers(); } }, 2500);
  setInterval(() => {
    const v = getVideo();
    if (isHost && room && v && !v.paused) sendState(true);
  }, BEAT_MS);

  // A szoba lejátszási pozíciója akkor is, ha épp másik oldalon vagyunk: ebből lesz a ?t= érték.
  let roomClock = null;
  function noteRoomClock(m, v, retained) {
    if (!v || !okTime(m.t)) return;
    const run = !!m.p && !m.w;
    const age = retained ? Date.now() - m.at : 0;
    if (run && !(age >= 0 && age < 60000)) { roomClock = null; return; }
    roomClock = { v, t: m.t, run, r: okRate(m.r) ? m.r : 1, rx: Date.now() - age };
  }
  function roomTime(v) {
    const c = roomClock;
    if (!c || !sameVideo(c.v, v)) return null;
    if (!c.run) return c.t;
    const age = (Date.now() - c.rx) / 1000;
    return age < 60 ? c.t + (age + 1) * c.r : null; // +1 mp: nagyjából ennyi, mire az új oldalon elindul a videó
  }
  // Minden videóváltás (a host követése is) új bejegyzés az előzményekben, így a böngésző Vissza/Előre
  // gombjával (és az egér oldalgombjaival) lapozni lehet a korábbi videók között.
  function openVideo(p) {
    const t = roomTime(p);
    if (okTime(t)) sess.set('tcwt_tq', vidId(p));
    location.href = location.origin + p + (okTime(t) ? '?t=' + Math.round(t * 10) / 10 : '');
  }
  function goTo(path) {
    const p = videoPath(path);
    if (navigating || !p || sameVideo(p, location.pathname)) return;
    navigating = true;
    setActivity('Váltás a host videójára…');
    announce(45000);
    sess.set('tcwt_went', vidId(p));
    setTimeout(() => openVideo(p), 200);
  }

  function unlock() {
    hook();
    const v = getVideo();
    // Véget ért videón a play() az elejére ugrana (böngészőszabály) – ott kihagyjuk, a kattintás amúgy is
    // engedélyezi a későbbi lejátszást.
    if (!v || !v.paused || v.ended || v !== hooked) return;
    expectEv('play');
    const t0 = performance.now();
    const p = v.play();
    // Lassú netnél a play() csak sokára teljesül – addigra a szoba szerint már mehet a videó, ilyenkor nem állítjuk le.
    if (p?.then) p.then(() => {
      if (performance.now() - t0 > 1500 || (room && lastState && lastState.p) || v.paused) return;
      expectEv('pause'); v.pause();
    }, () => { expect.play = 0; });
  }

  function createRoom() {
    if (!name) { askName(); return; }
    unlock();
    const code = newCode();
    store.set('tcwt_host_' + code, '1');
    connect(code).then(() => { if (room === code && client) setHost(cid, shown(), tabId, true); });
  }
  const CODE_ABC = 'abcdefghjkmnpqrstuvwxyz23456789';
  const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), b => CODE_ABC[b % CODE_ABC.length]).join('');
  const CODE_LEN = 8;
  const codeChars = s => String(s || '').toLowerCase().split('').filter(ch => CODE_ABC.includes(ch)).join('');
  const validCode = c => typeof c === 'string' && c.length === CODE_LEN && codeChars(c) === c;
  // Szoba keresése belépés előtt: létezik-e, és nem vagy-e kitiltva belőle (így nem lépsz be előbb, hogy aztán
  // kidobjon). A szerver a feliratkozás visszaigazolása után rögtön küldi a szoba elmentett adatait; ha addig
  // nem jön semmi, a szoba nem létezik. A várakozást a mért válaszidőhöz igazítjuk (gyors netnél fél mp).
  // Eredmény: true / false (nincs ilyen) / 'banned' / 'old' (csak a régi, aláírás nélküli változat csatornáján
  // létezik – azt a mostani nem látja) / null (nincs kapcsolat). A régi csatornát ugyanazon a kapcsolaton nézzük.
  function roomExists(code) {
    return new Promise(resolve => {
      let done = false, c = null, keys = null, online = false, grace = null, settle = null, found = false, foundOld = false;
      const finish = v => {
        if (done) return;
        done = true; clearTimeout(to); clearTimeout(grace); clearTimeout(settle);
        try { c.end(true); } catch (e) {}
        if (v === false || v === 'old') { store.del('tcwt_k_' + code); keyJobs.delete(code); }
        resolve(v);
      };
      // Kitiltásnak csak akkor hiszünk, ha a lista a szoba hostjától jön, és a jelenlévők nagy része is őt tartja
      // hostnak – egy idegen így nem tarthat távol senkit (pl. fióknév alapján) egy hamis listával.
      let hostC = null, banMsg = null;
      const votesP = new Map();
      const verdict = () => {
        if (!hostC || !banMsg || banMsg._s !== hostC || !Array.isArray(banMsg.list)) return true;
        const all = [...votesP.values()], forHost = all.filter(x => x === hostC).length;
        if (forHost * 2 < all.length) return true;
        return banMsg.list.some(b => b && typeof b.c === 'string' &&
          banHit({ c: b.c.slice(0, 20), acc: typeof b.acc === 'string' ? cleanName(b.acc) : null }, cid, acct ? acct.name : '', !!acct)) ? 'banned' : true;
      };
      const to = setTimeout(() => finish(found ? verdict() : null), 8000);
      const probe = () => {
        if (done || !keys || !online) return;
        const base = PREFIX + keys.topic + '/', oldBase = OLD_PREFIX + keys.topic + '/';
        c.on('message', async (topic, buf) => {
          if (done || !buf || !buf.length || buf.length > 400000) return;
          if (topic.startsWith(oldBase)) { if (await unseal(buf.toString(), topic.slice(oldBase.length), keys.key) != null) foundOld = true; return; }
          if (!topic.startsWith(base)) return;
          const sub = topic.slice(base.length);
          const txt = await unseal(buf.toString(), sub, keys.key);
          if (txt == null || done) return;
          found = true;
          clearTimeout(grace);
          clearTimeout(settle);
          if (sub === 'host' || sub === 'ban' || sub.startsWith('p/')) {
            const m = await unwire(txt, sub, keys.topic);
            if (done) return;
            if (m && sub === 'host' && typeof m.c === 'string') hostC = m.c.slice(0, 20);
            else if (m && sub === 'ban' && okVer(m.v) && (!banMsg || m.v >= banMsg.v)) banMsg = m;
            else if (m && !m.gone && m.c === m._s) votesP.set(m.c, typeof m.hc === 'string' ? m.hc.slice(0, 20) : null);
          }
          clearTimeout(settle);
          settle = setTimeout(() => finish(verdict()), 250);
        });
        const t0 = performance.now();
        c.subscribe(['ban', 'host', 'state', 'cfg', 'h', 'p/+'].map(x => base + x).concat(['host', 'state', 'p/+'].map(x => oldBase + x)), err => {
          if (err) { finish(null); return; }
          if (!found) grace = setTimeout(() => finish(foundOld ? 'old' : false), Math.min(1500, Math.max(450, (performance.now() - t0) * 1.5 + 300)));
        });
      };
      try {
        c = brokerSet(() => ({ clientId: 'tcwt_q' + rand(10), keepalive: 30, connectTimeout: 7000, clean: true }), false);
      } catch (e) { finish(null); return; }
      c.on('connect', () => { online = true; probe(); });
      // Csak akkor hiba, ha egyik szerver sem érhető el (az egyiket tilthatja egy szűrő).
      c.on('close', () => { if (!online && c.failed) finish(null); });
      deriveRoom(code).then(k => { keys = k; probe(); }, () => finish(null));
    });
  }
  let joining = false;
  async function joinRoom(input) {
    const code = codeChars(input);
    if (joining) return;
    if (!validCode(code)) { note.textContent = 'A kód ' + CODE_LEN + ' karakteres.'; codeField.focus(); return; }
    if (!name) { askName(); return; }
    if (typeof mqtt === 'undefined') { note.textContent = 'Betöltési hiba – frissítsd az oldalt.'; return; }
    unlock();
    joining = true;
    note.textContent = 'Szoba keresése…';
    try { await idReady; } catch (e) { joining = false; note.textContent = 'Ez a böngésző nem támogatott.'; return; }
    let ok = null;
    try { ok = await roomExists(code); } finally { joining = false; }
    if (room) return;
    if (ok === null) { note.textContent = 'Nincs kapcsolat – próbáld újra.'; return; }
    if (ok === 'banned') { note.textContent = 'Ki vagy tiltva ebből a szobából.'; return; }
    if (ok === 'old') { note.textContent = 'Ez a szoba a script régebbi változatával készült – mindenki frissítse a Trash2Gethert.'; return; }
    if (!ok) { note.textContent = 'Nincs ilyen szoba.'; return; }
    note.textContent = '';
    connect(code);
  }
  function leaveRoom(fromOtherTab) {
    if (room && !fromOtherTab && bc) bc.postMessage({ t: 'leave', room });
    if (room && ownLead()) store.del(leadKey());
    leaving = true;
    if (client) {
      const next = isHost ? successor(cid) : null;
      const alone = !members.size;
      publish('p/' + sid, { gone: 1, c: cid }, false);
      if (alone) ['host', 'state', 'cfg', 'q', 'ban', 'h'].forEach(t => clearRetained(t));
      clearRetained('p/' + sid);
      publish('m', { id: sid, k: 'bye', x: 1, c: cid, n: shown(), ts: Date.now(), q: rand(8) });
      const last = next ? publish('host', { id: sid, c: next.c, n: next.n, tab: next.tb || null, ts: nextVer(hostRec && hostRec.ts) }, true) : outChain;
      const c = client; client = null;
      last.then(() => { try { c.end(false); } catch (e) {} });
    }
    const act = readJSON('tcwt_active');
    if (act && act.code === room) store.del('tcwt_active');
    store.del('tcwt_chatlast_' + room);
    ['tcwt_room', 'tcwt_hv', 'tcwt_hvt', 'tcwt_went', 'tcwt_follow'].forEach(k => sess.del(k));
    ['chat', 'prevsid', 'hrec', 'lock', 'lockv', 'q', 'bans', 'k', 'known', 'rv'].forEach(k => sess.del('tcwt_' + k + '_' + room));
    ['k', 'j', 'host'].forEach(k => store.del('tcwt_' + k + '_' + room));
    keyJobs.delete(room);
    resetRoomState();
    room = ''; roomV = null; roomVT = ''; navigating = false;
    if (/tcwt=/.test(location.hash)) history.replaceState(history.state, '', location.pathname + location.search);
    chatLog = []; seenIds.clear();
    msgsEl.replaceChildren(emptyEl);
    unread = 0; updateBadge();
    setLive(false);
  }

  let shownAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    shownAt = Date.now();
    if (!room) return;
    renderMembers();
    if (client && !client.connected) { client.reconnect(); return; }
    if (!isHost && isLead()) { precise = true; requestSync(); setTimeout(localSync, 400); }
  });

  // Saját családnév: az oldal YouTube Sans CSS-e mind a 7 vágást 500-as vastagsággal adja meg,
  // így ott a félkövér felirat rossz vágással, műfélkövérként jelenne meg (és 7 fájl töltődne le 1 helyett).
  if (!document.getElementById('tcwt-fonts')) {
    const st = document.createElement('style');
    st.id = 'tcwt-fonts';
    st.textContent = "@font-face{font-family:'tcwt-yt';font-weight:400;font-display:swap;src:url('" + YT_FONT + "Regular.woff') format('woff')}" +
      "@font-face{font-family:'tcwt-yt';font-weight:700;font-display:swap;src:url('" + YT_FONT + "Bold.woff') format('woff')}";
    document.head.appendChild(st);
  }
  if (!document.getElementById('tcwt-font-0') && !document.querySelector('link[href*="family=Noto+Sans"]')) {
    const l = document.createElement('link');
    l.id = 'tcwt-font-0'; l.rel = 'stylesheet'; l.href = FONT_CSS;
    document.head.appendChild(l);
  }

  const CSS = `
:host{all:initial}
*{box-sizing:border-box}
.root{
  --bg:#121212;--s1:#1d1d1d;--s2:#2b2b2b;--field:#1b0038;--fieldbd:#370072;--bd:#333;--tx:#ffffff;--mu:#8a8a8a;
  --nav:#370072;--navtx:#ffffff;--mine:#370072;--hi:#a58bff;--sub:#c6c6d2;--btn:#2c90ff;--btnh:#5d36bc;--btnsoft:rgba(44,144,255,.14);--sb:rgba(255,255,255,.22);--sbh:rgba(255,255,255,.38);
  --ring:rgba(44,144,255,.55);--sys:#1d1d1d;--overlay:rgba(0,0,0,.72);--shadow:0 14px 44px rgba(0,0,0,.65);--r:6px;
  --body:"Noto Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  --head:"tcwt-yt","Noto Sans",system-ui,sans-serif;
  font:15px/1.4 var(--body);color:var(--tx);letter-spacing:normal;word-spacing:normal;text-transform:none;text-shadow:none;
  text-align:start;text-indent:0;white-space:normal;font-feature-settings:normal;font-kerning:auto;visibility:visible;cursor:auto;
  word-break:normal;overflow-wrap:normal;hyphens:manual;-webkit-text-stroke:0;text-rendering:auto;direction:ltr}
.root.light{
  --bg:#ffffff;--s1:#f6f6f6;--s2:#ececec;--field:#ffffff;--fieldbd:#cfcfcf;--bd:#e0e0e0;--tx:#000000;--mu:#777777;
  --hi:#5d36bc;--sub:#444444;--sys:#f1f1f1;--sb:rgba(0,0,0,.22);--sbh:rgba(0,0,0,.4);--overlay:rgba(20,0,40,.45);--shadow:0 14px 44px rgba(0,0,0,.22)}
.root .panel,.root .epanel,.root .box,.root .bubble,.root .field,.root .input,.root .composer,.root .roomcard{
  transition:background-color .3s,color .3s,border-color .3s}
button{font:inherit;color:inherit;cursor:pointer;border:0}
.bi{display:inline-block;width:1em;height:1em;flex:none;fill:currentColor;vertical-align:-.125em;overflow:visible}
.fab{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));width:56px;height:56px;border-radius:50%;
  background:var(--btn);border:0;color:#fff;font-size:26px;display:flex;align-items:center;justify-content:center;
  box-shadow:0 6px 18px rgba(0,0,0,.45);z-index:2147483647;transition:background-color .2s,transform .2s}
.fab:hover{transform:translateY(-1px)}
.fab.live::after{content:"";position:absolute;left:2px;bottom:2px;width:13px;height:13px;border-radius:50%;background:#57a557;border:2px solid var(--bg)}
.badge{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#e34449;
  color:#fff;font-size:12px;font-weight:700;line-height:20px;display:none}
.root.infs .fab{bottom:calc(72px + env(safe-area-inset-bottom))}
@media (min-width:601px){
  .root.infs .dock{bottom:calc(140px + env(safe-area-inset-bottom))}
  .root.infs .panel{max-height:calc(100vh - 166px)}
}
.dock{position:fixed;right:16px;bottom:calc(84px + env(safe-area-inset-bottom));display:flex;align-items:flex-end;gap:8px;z-index:2147483647}
.dock[hidden]{display:none}
.panel{position:relative;width:var(--pw,380px);min-width:var(--pmin,0px);height:var(--ph,620px);max-width:calc(100vw - 32px);max-height:calc(100vh - 110px);
  display:flex;flex-direction:column;background:var(--bg);border:1px solid var(--nav);border-radius:10px;
  box-shadow:var(--shadow);overflow:hidden}
.rz{position:absolute;z-index:5;touch-action:none}
.rz-l{left:0;top:0;bottom:0;width:7px;cursor:ew-resize}
.rz-t{left:0;right:0;top:0;height:7px;cursor:ns-resize}
.rz-tl{left:0;top:0;width:16px;height:16px;cursor:nwse-resize;z-index:6}
.rz:hover{background:var(--btnsoft)}
.code-in{text-transform:uppercase;letter-spacing:2px;font-family:ui-monospace,Consolas,monospace}
.dragging,.dragging *{user-select:none!important}
.panel>header{cursor:grab;touch-action:none}
.panel>header button{cursor:pointer}
.panel.moving,.panel.moving *{cursor:grabbing!important}
header{display:flex;align-items:center;gap:8px;flex-shrink:0;padding:9px 8px 9px 12px;background:var(--nav);color:var(--navtx);box-shadow:inset 0 -1px 0 #300f3c}
.logo{flex:none;--logo-blue:#2c90ff;--logo-pink:#faaafa;--logo-background:#000000}
.conn{display:inline-flex;align-items:center;gap:6px;flex:none;padding:4px 10px;border-radius:14px;
  background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.22);color:#fff;font:600 13px/1.25 var(--body);letter-spacing:.1px;white-space:nowrap}
.conn .ctext{display:grid}
.conn .ctext>span{grid-area:1/1;visibility:hidden}
.conn .ctext>span.on{visibility:visible}
header .x{flex:none;padding:6px 7px}
header .hsp{flex:1 1 0;min-width:0}
.conn .dot{flex:none;width:9px;height:9px}
.conn .dot.ok{box-shadow:0 0 0 2px rgba(87,165,87,.35)}
.conn .dot.warn{box-shadow:0 0 0 2px rgba(251,140,0,.35)}
.logo svg{display:block;height:24px;width:auto}
.x{background:none;font-size:18px;line-height:1;color:var(--btn);padding:6px 8px;border-radius:var(--r)}
header .x:hover,.ehead .x:hover{background:rgba(255,255,255,.12);color:#fff}
header .x.off{opacity:.5}
.floats{position:fixed;top:0;left:0;right:0;bottom:0;width:auto;height:auto;margin:0;padding:0;border:0;background:transparent;
  color:inherit;overflow:hidden;pointer-events:none;z-index:2147483647}
.float{position:absolute;left:0;top:0;opacity:0;will-change:transform,opacity;pointer-events:none;backface-visibility:hidden}
.float img{display:block;width:100%;height:100%;filter:drop-shadow(0 3px 6px rgba(0,0,0,.6))}
.float.css{animation:tcwt-fade 3s ease-out forwards}
@keyframes tcwt-fade{0%{opacity:0;transform:scale(.4)}15%{opacity:1;transform:scale(1.15)}25%{transform:scale(1)}70%{opacity:1}100%{opacity:0;transform:translateY(-60px)}}
.top{padding:12px;display:flex;flex-direction:column;gap:10px;border-bottom:1px solid var(--bd);min-height:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable}
.top:not(.live){flex:1 1 auto}
.top.live{flex:1 1 auto;max-height:none;border-bottom:0;transition:box-shadow .2s}
.top.live.more{box-shadow:inset 0 -14px 12px -12px rgba(0,0,0,.55)}
.top,.msgs,.egrid,.input{scrollbar-width:thin;scrollbar-color:var(--sb) transparent}
.top::-webkit-scrollbar,.msgs::-webkit-scrollbar,.egrid::-webkit-scrollbar,.input::-webkit-scrollbar{width:10px}
.top::-webkit-scrollbar-track,.msgs::-webkit-scrollbar-track,.egrid::-webkit-scrollbar-track,.input::-webkit-scrollbar-track{background:transparent}
.top::-webkit-scrollbar-thumb,.msgs::-webkit-scrollbar-thumb,.egrid::-webkit-scrollbar-thumb,.input::-webkit-scrollbar-thumb{background:var(--sb);border-radius:6px;border:3px solid transparent;background-clip:padding-box}
.top::-webkit-scrollbar-thumb:hover,.msgs::-webkit-scrollbar-thumb:hover,.egrid::-webkit-scrollbar-thumb:hover{background-color:var(--sbh)}
.top>*{flex-shrink:0}
.tabs{display:flex;flex-shrink:0;background:var(--s1);border-bottom:1px solid var(--bd)}
.tab{flex:1 1 0;display:flex;align-items:center;justify-content:center;gap:7px;min-width:0;padding:10px 8px 9px;background:none;
  color:var(--mu);font:700 14px/1.2 var(--head);border-bottom:3px solid transparent;margin-bottom:-1px;transition:color .15s,border-color .15s,background-color .15s}
.tab .bi{font-size:16px}
.tab:hover{color:var(--tx);background:var(--btnsoft)}
.tab.on{color:var(--tx);border-bottom-color:var(--btn)}
.tab:focus-visible{outline:2px solid var(--ring);outline-offset:-2px}
.tab .cnt{min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:#e34449;color:#fff;font:700 12px/20px var(--body);display:none}
.tab .cnt.on{display:inline-block}
.tab .num{font-weight:400;color:var(--mu)}
.status{display:flex;flex-direction:column;gap:8px;padding:10px 12px 0;flex-shrink:0}
.status[hidden]{display:none}
.box.ask[hidden]{display:none}
.asktxt{font-weight:700;margin-bottom:8px}
.sect{display:flex;flex-direction:column}
.sechead{display:flex;align-items:center;gap:8px;width:100%;background:none;padding:4px 2px 6px;color:var(--tx);
  font:700 14px/1.25 var(--body);letter-spacing:.2px;text-align:left;border-bottom:1px solid var(--bd)}
.sechead:hover{color:var(--btn)}
.sechead .bi{font-size:13px;color:var(--btn);transition:transform .2s}
.sect.collapsed .sechead .bi{transform:rotate(-90deg)}
.secbody{display:flex;flex-direction:column;gap:10px;margin-top:8px}
.secbody>*{flex-shrink:0}
.sect.collapsed .secbody{display:none}
.muted{color:var(--mu);font-size:13px}
.note{color:#e34449;font-size:13px}.note:empty{display:none}
.btn{width:100%;min-height:42px;border-radius:var(--r);background:var(--btn);border:1px solid var(--btn);color:#fff;
  display:flex;align-items:center;justify-content:center;gap:8px;font:700 15px/1.2 var(--head);padding:8px 12px;
  transition:background-color .2s,border-color .2s,color .2s}
.btn:hover,.send:hover,.fab:hover{background:var(--btnh);border-color:var(--btnh)}
.btn .bi{font-size:17px}
.btn.sec{background:transparent;border-color:var(--btn);color:var(--btn)}
.btn.sec:hover{background:var(--btnsoft);border-color:var(--btn);color:var(--btn)}
.btn:disabled{opacity:.55;cursor:default}
.row{display:flex;gap:8px}
.row .btn{flex:1}
.field{width:100%;min-height:42px;border-radius:var(--r);border:1px solid var(--fieldbd);background:var(--field);color:var(--tx);padding:8px 12px;font:inherit;font-size:16px}
.field::placeholder{color:#6a6a6a}
.field:focus,.input:focus{outline:2px solid var(--ring);outline-offset:0}
.link{background:none;color:var(--btn);font-size:13px;text-decoration:underline;padding:0;align-self:flex-start}
.link:hover{color:var(--btnh)}
.greet{display:flex;align-items:center;gap:10px;font:700 16px/1.2 var(--head)}
.greet>div{overflow-wrap:anywhere}
.member.ghost{opacity:.6}
.input.slow{animation:tcwt-shake .3s}
@keyframes tcwt-shake{25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
.qsearch{display:flex;gap:6px;margin-bottom:6px}
.qsearch .field{min-height:38px;font-size:14px;padding:6px 10px}
.btn.qbtn{width:auto;min-height:38px;padding:0 12px;flex:none}
.btn.qhere{min-height:36px;font-size:13.5px;margin:0 0 6px}
.qres{max-height:260px;overflow:auto;border:1px solid var(--bd);border-radius:var(--r);margin-bottom:8px;padding:0 8px}
.qnote{padding:8px 0}
.qrow{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--bd)}
.qrow:last-child{border-bottom:0}
.qthumb{width:64px;height:36px;object-fit:cover;border-radius:5px;flex:none;background:var(--s2)}
.qinfo{min-width:0;flex:1;text-decoration:none;color:inherit}
.qinfo:hover .qtitle{text-decoration:underline}
.qtitle{font:600 12.5px/1.3 var(--body);color:var(--tx);overflow:hidden;overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2}
.qmeta{font:500 11.5px/1.3 var(--body);color:var(--mu)}
.mq{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;min-width:0}
.mq .mqi{display:inline-block;white-space:nowrap}
.mq.run{text-overflow:clip;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 6px,#000 calc(100% - 10px),transparent);mask-image:linear-gradient(90deg,transparent 0,#000 6px,#000 calc(100% - 10px),transparent)}
.mq.run .mqi{animation:t2gmq var(--mqt,6s) ease-in-out infinite alternate;will-change:transform}
.mq.run:hover .mqi{animation-play-state:paused}
@keyframes t2gmq{0%,18%{transform:translateX(0)}82%,100%{transform:translateX(var(--mq,0))}}
.qacts{display:flex;gap:2px;flex:none}
.qb{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:transparent;color:var(--tx);border:0;padding:0;cursor:pointer}
.qb:hover{background:var(--s2)}
.qb:disabled{opacity:.45;cursor:default;background:transparent}
.member{display:flex;align-items:center;gap:10px;padding:6px 0;min-height:46px;border-bottom:1px solid var(--bd)}
.member:last-child{border-bottom:0}
.minfo{flex:1;min-width:0}
.mname{font:600 14.5px/1.3 var(--body);color:var(--tx);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mact{display:flex;align-items:center;gap:5px;min-width:0;max-width:100%;margin-top:2px;font:400 13px/1.35 var(--body);color:var(--sub)}
.mact span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.mact .bi{font-size:12px;color:var(--mu)}
.mact.here,.mact.here .bi{color:var(--hi)}
.mact.go{background:none;padding:0;text-align:left;cursor:pointer}
.mact.go .bi{color:var(--btn)}
.mact.go .bi:last-child{font-size:10px;opacity:.75}
.mact.go:hover{color:var(--btn)}
.mact.go:hover span{text-decoration:underline}
.xfer{flex:none;display:flex;align-items:center;gap:5px;background:none;border:1px solid var(--btn);color:var(--btn);border-radius:var(--r);padding:5px 8px;font:700 12px/1 var(--head)}
.xfer .bi{font-size:15px}
.xfer:hover{background:var(--btnsoft)}
.xfer.armed{background:var(--btn);color:#fff}
.mods{display:flex;gap:4px;flex:none}
.xfer.danger{border-color:#e34449;color:#e34449}
.xfer.danger:hover{background:rgba(227,68,73,.12)}
.xfer.danger.armed{background:#e34449;color:#fff}
.roomcard{display:flex;flex-direction:column;gap:8px;background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);padding:10px}
.coderow{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.coderow .code{flex:1;min-width:120px}
.btn.danger{background:transparent;border-color:#e34449;color:#e34449;min-height:38px;font-size:14px}
.btn.danger:hover{background:rgba(227,68,73,.12);border-color:#e34449;color:#e34449}
.btn.danger.armed,.btn.danger.armed:hover{background:#e34449;color:#fff}
.code{font:700 22px/1.2 ui-monospace,"SFMono-Regular",Consolas,monospace;letter-spacing:3px;color:var(--tx);user-select:all}
.code.masked{user-select:none;color:var(--mu)}
.eye{background:none;color:var(--btn);font-size:20px;line-height:1;padding:8px;border-radius:var(--r);flex:none}
.eye:hover{background:var(--btnsoft)}
.dot{width:8px;height:8px;border-radius:50%;background:#888}.dot.ok{background:#57a557}.dot.warn{background:#fb8c00}
.box{background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);padding:10px}
.hbox{display:flex;flex-direction:column;gap:8px}
.hinfo{display:flex;flex-direction:column;gap:4px;font-size:13px}
.hinfo .locknote{margin-top:0}
.vcard{display:flex;align-items:center;gap:10px;padding:6px 8px 6px 6px;border:1px solid var(--bd);border-radius:var(--r);background:var(--bg);cursor:pointer;min-width:0;transition:border-color .15s}
.vcard:hover{border-color:var(--btn)}
.vthumb{flex:none;width:80px;aspect-ratio:16/9;object-fit:cover;border-radius:4px;background:var(--s2)}
.vinfo{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.vcap{font:600 12px/1.2 var(--body);color:var(--mu)}
.vtitle{font:600 13px/1.3 var(--body);color:var(--tx);overflow:hidden;overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2}
.activity{font-size:13px;color:var(--hi);min-height:17px}
.activity:empty{display:none}
.toast{position:fixed;left:50%;top:80px;transform:translate(-50%,-6px);max-width:calc(100vw - 32px);white-space:nowrap;display:flex;align-items:center;gap:4px;
  background:rgba(55,0,114,.88);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);color:#fff;padding:10px 16px;border-radius:20px;font:700 14px/1.2 var(--head);
  box-shadow:0 6px 20px rgba(0,0,0,.45);opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;z-index:2147483647}
.toast.on{opacity:1;transform:translate(-50%,0)}
.toast.upd.on{pointer-events:auto}
.toast.act{gap:7px;padding:7px 14px 7px 7px}
.toast.act b{font-weight:700}
.toast .skthumb{display:block;flex:none;margin-left:6px;border-radius:5px;background-repeat:no-repeat;box-shadow:0 0 0 1px rgba(255,255,255,.25)}
.toast.act .bi{font-size:16px;line-height:1;color:#7fbcff}
.toast.act span{font-weight:400}
.locknote{margin-top:6px;font-size:13px;font-weight:700;color:var(--hi)}
.locknote.open{color:var(--sub);font-weight:400}
.avatar{width:34px;height:34px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:700;
  color:#fff;flex:none;overflow:hidden;position:relative;font-size:14px}
.avatar img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.avatar.xs{width:22px;height:22px;font-size:11px}
.avatar.lg{width:44px;height:44px;font-size:18px}
.msgs{flex:1;min-height:90px;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;padding:12px 12px 14px;display:flex;flex-direction:column;gap:10px}
.msgs>*{flex-shrink:0}
.empty{margin:auto;color:var(--mu);font-size:14px;text-align:center}
.msg{max-width:82%;align-self:flex-start;display:flex;flex-direction:column;align-items:flex-start}
.msg.me{align-self:flex-end;align-items:flex-end}
.who{font:400 12px/1.2 var(--body);color:var(--mu);margin:0 4px 4px;display:flex;align-items:center;gap:6px}
.who b{font:600 12.5px/1.2 var(--body);color:var(--sub);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bubble{padding:8px 12px;border-radius:14px;border-bottom-left-radius:4px;background:var(--s2);color:var(--tx);
  font:400 14.5px/1.45 var(--body);word-break:break-word;white-space:pre-wrap}
.msg.cont{margin-top:-7px}
.msg.cont:not(.me) .bubble{border-top-left-radius:4px}
.msg.me.cont .bubble{border-top-right-radius:4px}
.me .bubble{background:var(--mine);color:#fff;border-bottom-left-radius:12px;border-bottom-right-radius:4px}
.bubble.smiley{background:none;border:0;padding:2px 4px}
.ts{color:var(--btn);font-weight:700;cursor:pointer;text-decoration:none;border-radius:3px}
.ts:hover{text-decoration:underline}
.me .ts{color:#9fd0ff}
.bubble img{width:30px;height:30px;object-fit:contain;vertical-align:middle;margin:-4px 1px}
.sys.upd{animation:tcwt-upd .6s ease-out}
@keyframes tcwt-upd{0%{background:var(--btnsoft)}100%{background:var(--sys)}}
.sys{align-self:center;max-width:92%;font:400 12.5px/1.35 var(--body);color:var(--sub);background:var(--sys);padding:4px 12px;border-radius:12px;text-align:center}
.sys.svid{display:flex;align-items:center;gap:10px;width:min(92%,330px);max-width:none;padding:5px 12px 5px 5px;border-radius:10px;text-align:left}
a.sys.svid{text-decoration:none;color:var(--sub);cursor:pointer;transition:background-color .15s}
a.sys.svid:hover{background:var(--s2)}
a.sys.svid:focus-visible{outline:2px solid var(--ring);outline-offset:1px}
.sthumb{flex:none;width:64px;height:36px;object-fit:cover;border-radius:6px;background:var(--s2)}
.sinfo{min-width:0;display:flex;flex-direction:column;gap:1px}
.scap{font:600 11.5px/1.2 var(--body);color:var(--mu)}
.stitle{font:600 12.5px/1.3 var(--body);color:var(--tx);overflow:hidden;overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2}
.smeta{font:500 11.5px/1.3 var(--body);color:var(--mu);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.scats{font:600 11px/1.3 var(--body);color:var(--mu);opacity:.9}
.mq svg.si{width:1.1em;height:1.1em;vertical-align:-.2em;margin-right:3px;fill:currentColor;flex:none}
.epanel{display:none;flex-direction:column;width:236px;height:min(380px,calc(100vh - 110px));background:var(--bg);
  border:1px solid var(--nav);border-radius:10px;box-shadow:var(--shadow);overflow:hidden}
.dock.emoji-on .epanel{display:flex}
.ehead{display:flex;align-items:center;padding:8px 8px 8px 14px;background:var(--nav);color:var(--navtx);font:700 15px/1.2 var(--head)}
.ehead span{flex:1}
.egrid{flex:1;overflow:auto;padding:6px;display:grid;grid-template-columns:repeat(auto-fill,minmax(40px,1fr));gap:2px;align-content:start}
.emo{height:40px;background:none;border-radius:var(--r);display:flex;align-items:center;justify-content:center}
.emo:hover,.emo:active{background:var(--s2)}
.emo img{width:30px;height:30px;object-fit:contain}
.composer{display:flex;gap:6px;padding:8px;background:var(--s1);border-top:1px solid var(--bd);align-items:center;flex-shrink:0}
.input{flex:1;min-width:0;min-height:42px;max-height:110px;overflow-y:auto;border-radius:var(--r);border:1px solid var(--fieldbd);
  background:var(--field);color:var(--tx);padding:8px 12px;font:inherit;font-size:16px;line-height:24px;
  white-space:pre-wrap;word-break:break-word;cursor:text}
.input:empty::before{content:attr(data-ph);color:#6a6a6a;pointer-events:none}
.input img{width:24px;height:24px;object-fit:contain;vertical-align:middle;margin:0 1px}
.etoggle{width:42px;height:42px;border-radius:var(--r);background:none;display:flex;align-items:center;justify-content:center;flex:none}
.etoggle img{width:26px;height:26px;object-fit:contain}
.etoggle.on,.etoggle:hover{background:var(--s2)}
.send{width:42px;height:42px;border-radius:50%;background:var(--btn);border:0;color:#fff;font-size:18px;flex:none;display:flex;align-items:center;justify-content:center;transition:background-color .2s}
.overlay{position:fixed;inset:0;background:var(--overlay);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);
  display:flex;align-items:center;justify-content:center;padding:16px;z-index:2147483647}
.overlay .box{width:min(100%,360px);display:flex;flex-direction:column;padding:0;gap:0;background:var(--bg);
  border:1px solid var(--nav);border-radius:10px;box-shadow:var(--shadow);overflow:hidden}
.dlg-logo{display:flex;align-items:center;background:var(--nav);padding:12px 18px;box-shadow:inset 0 -1px 0 #300f3c}
.dlg-body{display:flex;flex-direction:column;gap:12px;padding:16px 18px 18px}
.dlg-logo svg{display:block;height:30px;width:auto;max-width:100%}
.dlg-title{font:700 19px/1.2 var(--head);color:var(--tx)}
.overlay .muted{line-height:1.45}
.overlay .row{margin-top:4px}
@media (max-width:600px){
  .dock{left:0;right:0;bottom:0;flex-direction:column-reverse;align-items:stretch;gap:0}
  .panel{width:auto;min-width:0;max-width:none;height:min(85vh,700px);max-height:none;border-radius:10px 10px 0 0;padding-bottom:env(safe-area-inset-bottom)}
  .dock.emoji-on .panel{height:calc(min(85vh,700px) - 200px);border-radius:0}
  @supports (height:100dvh){
    .panel{height:min(85dvh,700px)}
    .dock.emoji-on .panel{height:calc(min(85dvh,700px) - 200px)}
  }
  .top{padding:10px}
  .btn{min-height:44px}
  .xfer{padding:7px 9px}
  .mname{font-size:15px}
  .toast{white-space:normal;text-align:center;justify-content:center;flex-wrap:wrap;max-width:calc(100vw - 24px)}
  .epanel{width:auto;height:200px;border-radius:10px 10px 0 0;border-bottom:0;box-shadow:none}
  .rz{display:none}
  .dock:not([hidden]) ~ .fab{display:none}
}
@media (max-width:400px){
  header{gap:6px;padding:8px 6px 8px 10px}
  .logo svg{height:22px}
  .conn{padding:3px 8px;font-size:12px}
}
@media (max-width:340px){
  .conn .ctext{display:none}
  .conn{padding:6px}
}`;

  function h(tag, props, ...kids) {
    const n = document.createElement(tag);
    for (const k in props || {}) {
      const v = props[k];
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    kids.flat().forEach(c => { if (c != null) n.append(c); });
    return n;
  }

  const colorOf = n => { let x = 0; for (const ch of String(n)) x = (x * 31 + ch.charCodeAt(0)) % 360; return 'hsl(' + x + ',50%,42%)'; };
  function avatarEl(nm, ui, size) {
    const el = h('span', { class: 'avatar' + (size ? ' ' + size : ''), style: 'background:' + colorOf(nm || '?'),
      text: (String(nm || '?')[0] || '?').toUpperCase() });
    const id = validUi(ui);
    if (id) {
      const img = h('img', { alt: '', loading: 'lazy', referrerpolicy: 'same-origin', src: avatarUrl(id) });
      img.addEventListener('error', () => img.remove());
      el.append(img);
    }
    return el;
  }
  function smileyImg(f) {
    return h('img', { src: smileyUrl(f), alt: smileyName(f), title: smileyName(f), referrerpolicy: 'same-origin', draggable: 'false' });
  }

  const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3793 661" role="img" aria-label="Trash2gether">
<title>Trash2gether</title>
<style>
  .logo-background { fill: var(--logo-background, #000000); }
  .logo-blue { fill: var(--logo-blue, #2c90ff); }
  .logo-pink { fill: var(--logo-pink, #faaafa); }
</style>
<path class="logo-background" fill-rule="evenodd" d="M1,116 L1,292 L30,294 L29,449 L34,487 L43,507 L58,524 L81,537 L109,544 L268,547 L310,542 L330,536 L331,545 L685,545 L686,540 L716,545 L981,545 L981,539 L984,538 L1017,545 L1166,547 L1209,542 L1225,537 L1229,538 L1229,545 L1583,545 L1583,536 L1586,535 L1621,543 L1808,547 L1917,537 L1918,659 L2183,659 L2204,656 L2233,645 L2259,620 L2269,595 L2274,539 L2301,545 L2472,546 L2524,535 L2541,526 L2554,514 L2577,532 L2605,542 L2704,547 L2789,546 L2836,536 L2838,545 L3192,545 L3192,541 L3195,540 L3218,545 L3373,547 L3405,544 L3433,537 L3436,538 L3436,545 L3790,545 L3790,362 L3788,327 L3785,320 L3792,268 L3790,195 L3781,141 L3768,121 L3755,110 L3729,98 L3700,93 L3436,93 L3436,101 L3433,102 L3387,92 L3296,91 L3207,95 L3185,101 L3162,114 L3143,102 L3115,94 L3044,91 L3043,1 L2838,1 L2836,116 L2744,116 L2742,93 L2537,93 L2536,108 L2513,98 L2484,93 L2334,91 L2298,95 L2273,102 L2271,93 L2008,93 L1979,98 L1954,109 L1934,127 L1923,144 L1906,124 L1884,108 L1850,94 L1825,89 L1789,88 L1771,98 L1691,115 L1657,129 L1643,139 L1628,157 L1620,180 L1620,199 L1631,235 L1652,238 L1699,235 L1734,224 L1784,203 L1811,197 L1821,198 L1825,202 L1825,215 L1786,264 L1746,302 L1644,375 L1584,412 L1584,181 L1576,144 L1567,128 L1554,114 L1529,100 L1492,92 L1434,90 L1434,1 L1229,1 L1228,100 L1192,93 L1044,91 L989,99 L954,116 L930,101 L902,94 L744,91 L691,98 L676,103 L656,115 L634,101 L599,93 L331,93 L329,116 L237,116 L235,93 L30,93 L28,116Z M1918,277 L1916,422 L1893,421 L1855,428 L1749,429 L1803,392 L1852,353 L1885,320Z M3479,135 L3700,135 L3721,140 L3740,155 L3747,174 L3747,295 L3743,306 L3735,314 L3720,319 L3737,325 L3743,331 L3748,346 L3747,503 L3627,502 L3626,356 L3599,356 L3598,503 L3478,502Z M3599,228 L3599,282 L3626,282 L3627,229Z M3192,146 L3208,138 L3224,135 L3399,135 L3420,140 L3439,155 L3446,173 L3446,365 L3297,366 L3297,410 L3325,410 L3327,387 L3445,387 L3446,466 L3440,482 L3428,494 L3399,503 L3224,503 L3202,498 L3183,483 L3176,461 L3176,178 L3180,161Z M3298,228 L3297,279 L3325,279 L3325,228Z M2580,135 L2699,135 L2700,158 L2848,159 L2847,251 L2700,251 L2700,410 L2728,410 L2729,273 L2848,274 L2848,466 L2842,482 L2830,494 L2801,503 L2626,503 L2605,498 L2587,485 L2579,466 L2579,251 L2550,250 L2550,159 L2579,158Z M2281,143 L2308,135 L2483,135 L2512,144 L2524,156 L2531,182 L2531,364 L2382,366 L2382,410 L2409,410 L2411,387 L2531,389 L2530,468 L2523,484 L2509,496 L2483,503 L2308,503 L2279,494 L2266,481 L2261,467 L2261,172 L2267,156Z M2382,228 L2382,279 L2410,279 L2410,229Z M1986,140 L2007,135 L2230,136 L2230,571 L2224,595 L2206,611 L2182,617 L1960,616 L1961,524 L2109,524 L2109,504 L1997,502 L1973,491 L1961,472 L1960,172 L1969,152Z M2081,228 L2081,411 L2109,411 L2109,229Z M990,143 L1017,135 L1192,135 L1221,144 L1235,159 L1240,178 L1238,251 L1120,251 L1118,228 L1091,228 L1091,273 L1199,274 L1223,283 L1237,301 L1240,315 L1240,461 L1233,483 L1220,495 L1192,503 L1017,503 L988,494 L976,482 L970,466 L971,387 L1089,387 L1091,410 L1119,410 L1118,366 L1010,365 L987,356 L973,339 L970,328 L970,173 L975,158Z M685,146 L698,139 L717,135 L892,135 L913,140 L932,155 L939,173 L938,503 L717,503 L695,498 L676,483 L669,461 L669,315 L675,294 L690,280 L713,273 L818,272 L818,228 L791,228 L789,251 L671,251 L669,178 L673,161Z M791,354 L790,410 L818,410 L818,354Z M374,135 L595,135 L616,140 L635,155 L642,174 L642,295 L639,304 L631,313 L617,319 L631,324 L638,331 L643,346 L642,503 L522,502 L521,356 L494,356 L493,503 L373,502Z M494,228 L494,282 L521,282 L522,229Z M73,135 L192,135 L193,158 L341,159 L340,251 L193,251 L193,410 L221,410 L222,273 L341,274 L341,466 L335,482 L323,494 L294,503 L119,503 L98,498 L80,485 L72,466 L72,251 L43,250 L43,159 L72,158Z M1879,145 L1891,157 L1900,172 L1905,191 L1905,211 L1897,240 L1876,276 L1860,296 L1807,345 L1642,460 L1639,465 L1838,463 L1913,454 L1923,459 L1926,466 L1925,484 L1920,494 L1911,502 L1891,507 L1816,511 L1625,509 L1605,506 L1587,498 L1577,481 L1578,470 L1585,457 L1606,438 L1709,371 L1780,317 L1817,281 L1850,238 L1858,218 L1859,200 L1854,183 L1844,171 L1827,164 L1804,164 L1780,169 L1673,205 L1660,205 L1655,202 L1654,188 L1661,172 L1670,163 L1694,150 L1801,122 L1843,127Z M2881,43 L3000,43 L3001,135 L3109,136 L3131,144 L3145,159 L3150,178 L3149,503 L3029,502 L3028,228 L3001,228 L3001,502 L2880,502Z M1272,43 L1391,43 L1392,135 L1500,136 L1522,144 L1536,159 L1541,178 L1540,503 L1420,502 L1419,228 L1392,228 L1392,502 L1271,502Z"></path>
<path class="logo-blue" fill-rule="evenodd" d="M3479,136 L3479,502 L3598,502 L3599,355 L3626,355 L3628,357 L3628,502 L3747,502 L3747,346 L3745,337 L3737,326 L3719,319 L3735,313 L3742,306 L3746,295 L3746,174 L3743,162 L3734,149 L3721,141 L3700,136Z M3599,227 L3626,227 L3628,229 L3628,281 L3626,283 L3598,282Z M3192,147 L3181,161 L3177,178 L3177,461 L3179,472 L3184,483 L3193,492 L3202,497 L3224,502 L3399,502 L3411,500 L3428,493 L3439,482 L3445,466 L3445,388 L3327,388 L3325,411 L3297,411 L3296,366 L3445,365 L3445,173 L3438,155 L3429,146 L3420,141 L3399,136 L3224,136 L3208,139Z M3298,227 L3326,228 L3325,280 L3296,279 L3296,229Z M2580,136 L2579,159 L2551,159 L2551,250 L2580,251 L2580,466 L2588,485 L2597,493 L2605,497 L2626,502 L2801,502 L2813,500 L2830,493 L2841,482 L2847,466 L2847,274 L2729,274 L2729,410 L2700,411 L2699,251 L2847,250 L2847,159 L2700,159 L2699,136Z M2281,144 L2268,156 L2262,172 L2262,467 L2267,481 L2279,493 L2292,499 L2308,502 L2483,502 L2509,495 L2522,484 L2529,468 L2530,389 L2411,388 L2411,409 L2409,411 L2382,411 L2381,366 L2530,364 L2530,182 L2528,167 L2523,156 L2512,145 L2495,138 L2483,136 L2308,136 L2293,139Z M2382,227 L2409,227 L2411,229 L2410,280 L2381,279Z M1986,141 L1970,152 L1963,164 L1961,172 L1962,472 L1967,483 L1973,490 L1982,496 L1997,501 L2013,503 L2109,503 L2110,524 L1961,525 L1961,616 L2182,616 L2206,610 L2214,605 L2223,595 L2227,586 L2229,571 L2229,136 L2007,136Z M2081,227 L2108,227 L2110,229 L2109,412 L2080,411Z M990,144 L976,158 L971,173 L971,328 L974,339 L978,346 L987,355 L996,360 L1010,364 L1118,365 L1120,367 L1120,410 L1091,411 L1089,388 L971,388 L971,466 L977,482 L988,493 L1005,500 L1017,502 L1192,502 L1208,499 L1220,494 L1232,483 L1237,472 L1239,461 L1239,315 L1236,301 L1232,293 L1223,284 L1214,279 L1199,275 L1091,274 L1090,228 L1118,227 L1120,229 L1120,250 L1238,250 L1239,178 L1234,159 L1221,145 L1208,139 L1192,136 L1017,136 L1002,139Z M685,147 L674,161 L670,178 L671,250 L789,250 L789,229 L791,227 L818,227 L819,272 L713,274 L690,281 L676,294 L672,303 L670,315 L670,461 L672,472 L677,483 L686,492 L695,497 L717,502 L938,502 L938,173 L931,155 L922,146 L913,141 L892,136 L717,136 L698,140Z M791,353 L819,354 L818,411 L789,410 L789,355Z M374,136 L374,502 L493,502 L494,355 L521,355 L523,357 L523,502 L642,502 L642,346 L637,331 L631,325 L616,319 L617,317 L631,312 L638,304 L641,295 L641,174 L638,162 L629,149 L616,141 L595,136Z M494,227 L521,227 L523,229 L523,281 L521,283 L493,282Z M73,136 L72,159 L44,159 L44,250 L73,251 L73,466 L81,485 L90,493 L98,497 L119,502 L294,502 L306,500 L323,493 L334,482 L340,466 L340,274 L222,274 L222,410 L193,411 L192,251 L340,250 L340,159 L193,159 L192,136Z M2881,44 L2881,502 L3000,502 L3001,227 L3028,227 L3030,229 L3030,502 L3149,502 L3149,178 L3144,159 L3131,145 L3109,137 L3001,136 L3000,44Z M1272,44 L1272,502 L1391,502 L1392,227 L1419,227 L1421,229 L1421,502 L1540,502 L1540,178 L1535,159 L1522,145 L1500,137 L1392,136 L1391,44Z"></path>
<path class="logo-pink" fill-rule="evenodd" d="M1879,146 L1869,139 L1843,128 L1801,123 L1694,151 L1679,158 L1662,172 L1655,188 L1656,202 L1660,204 L1673,204 L1708,194 L1780,168 L1804,163 L1827,163 L1844,170 L1855,183 L1860,200 L1859,218 L1851,238 L1818,281 L1780,318 L1709,372 L1640,419 L1606,439 L1586,457 L1580,467 L1578,481 L1587,497 L1605,505 L1625,508 L1816,510 L1891,506 L1911,501 L1919,494 L1924,484 L1925,466 L1923,460 L1913,455 L1902,455 L1860,463 L1638,465 L1642,459 L1807,344 L1831,324 L1869,284 L1885,261 L1896,240 L1904,211 L1904,191 L1899,172 L1890,157Z"></path>
</svg>`;

  // Bootstrap Icons 1.13.2 (MIT) – beépítve, így nem kell külön ikonbetűtípust letölteni.
  const ICONS = {
    // az oldal saját ikonjai (Font Awesome „eye”, Material Icons „thumb_up_alt” / „thumb_down_alt”) – [viewBox, rajz]
    'site-eye': ['0 0 576 512', '<path d="M572.52 241.4C518.29 135.59 410.93 64 288 64S57.68 135.64 3.48 241.41a32.35 32.35 0 0 0 0 29.19C57.71 376.41 165.07 448 288 448s230.32-71.64 284.52-177.41a32.35 32.35 0 0 0 0-29.19zM288 400a144 144 0 1 1 144-144 143.93 143.93 0 0 1-144 144zm0-240a95.31 95.31 0 0 0-25.31 3.79 47.85 47.85 0 0 1-66.9 66.9A95.78 95.78 0 1 0 288 160z"/>'],
    'site-up': ['0 0 24 24', '<path d="M2 20h2c.55 0 1-.45 1-1v-9c0-.55-.45-1-1-1H2v11zm19.83-7.12c.11-.25.17-.52.17-.8V11c0-1.1-.9-2-2-2h-5.5l.92-4.65c.05-.22.02-.46-.08-.66-.23-.45-.52-.86-.88-1.22L14 2 7.59 8.41C7.21 8.79 7 9.3 7 9.83v7.84C7 18.95 8.05 20 9.34 20h8.11c.7 0 1.36-.37 1.72-.97l2.66-6.15z"/>'],
    'site-down': ['0 0 24 24', '<path d="M22 4h-2c-.55 0-1 .45-1 1v9c0 .55.45 1 1 1h2V4zM2.17 11.12c-.11.25-.17.52-.17.8V13c0 1.1.9 2 2 2h5.5l-.92 4.65c-.05.22-.02.46.08.66.23.45.52.86.88 1.22L10 22l6.41-6.41c.38-.38.59-.89.59-1.42V6.34C17 5.05 15.95 4 14.66 4h-8.1c-.71 0-1.36.37-1.72.97l-2.67 6.15z"/>'],
    'broadcast': '<path d="M3.05 3.05a7 7 0 0 0 0 9.9.5.5 0 0 1-.707.707 8 8 0 0 1 0-11.314.5.5 0 0 1 .707.707m2.122 2.122a4 4 0 0 0 0 5.656.5.5 0 1 1-.708.708 5 5 0 0 1 0-7.072.5.5 0 0 1 .708.708m5.656-.708a.5.5 0 0 1 .708 0 5 5 0 0 1 0 7.072.5.5 0 1 1-.708-.708 4 4 0 0 0 0-5.656.5.5 0 0 1 0-.708m2.122-2.12a.5.5 0 0 1 .707 0 8 8 0 0 1 0 11.313.5.5 0 0 1-.707-.707 7 7 0 0 0 0-9.9.5.5 0 0 1 0-.707zM10 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0"/>',
    'play-fill': '<path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/>',
    'plus-lg': '<path fill-rule="evenodd" d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2"/>',
    'box-arrow-in-right': '<path fill-rule="evenodd" d="M6 3.5a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-2a.5.5 0 0 0-1 0v2A1.5 1.5 0 0 0 6.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 14.5 2h-8A1.5 1.5 0 0 0 5 3.5v2a.5.5 0 0 0 1 0z"/><path fill-rule="evenodd" d="M11.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 1 0-.708.708L10.293 7.5H1.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708z"/>',
    'arrow-right-circle': '<path fill-rule="evenodd" d="M1 8a7 7 0 1 0 14 0A7 7 0 0 0 1 8m15 0A8 8 0 1 1 0 8a8 8 0 0 1 16 0M4.5 7.5a.5.5 0 0 0 0 1h5.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3a.5.5 0 0 0 0-.708l-3-3a.5.5 0 1 0-.708.708L10.293 7.5z"/>',
    'lock': '<path fill-rule="evenodd" d="M8 0a4 4 0 0 1 4 4v2.05a2.5 2.5 0 0 1 2 2.45v5a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 2 13.5v-5a2.5 2.5 0 0 1 2-2.45V4a4 4 0 0 1 4-4M4.5 7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7zM8 1a3 3 0 0 0-3 3v2h6V4a3 3 0 0 0-3-3"/>',
    'unlock': '<path fill-rule="evenodd" d="M12 0a4 4 0 0 1 4 4v2.5h-1V4a3 3 0 1 0-6 0v2h.5A2.5 2.5 0 0 1 12 8.5v5A2.5 2.5 0 0 1 9.5 16h-7A2.5 2.5 0 0 1 0 13.5v-5A2.5 2.5 0 0 1 2.5 6H8V4a4 4 0 0 1 4-4M2.5 7A1.5 1.5 0 0 0 1 8.5v5A1.5 1.5 0 0 0 2.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 9.5 7z"/>',
    'eye': '<path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8M1.173 8a13 13 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5s3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8q-.086.13-.195.288c-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5s-3.879-1.168-5.168-2.457A13 13 0 0 1 1.172 8z"/><path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0"/>',
    'eye-slash': '<path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7 7 0 0 0-2.79.588l.77.771A6 6 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8q-.086.13-.195.288c-.335.48-.83 1.12-1.465 1.755q-.247.248-.517.486z"/><path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829"/><path d="M3.35 5.47q-.27.24-.518.487A13 13 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7 7 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12z"/>',
    'clipboard': '<path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0z"/>',
    'check-lg': '<path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425z"/>',
    'box-arrow-right': '<path fill-rule="evenodd" d="M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0z"/><path fill-rule="evenodd" d="M15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708z"/>',
    'exclamation-circle': '<path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/><path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0M7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0z"/>',
    'chevron-down': '<path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708"/>',
    'person': '<path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6m2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0m4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4m-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10s-3.516.68-4.168 1.332c-.678.678-.83 1.418-.832 1.664z"/>',
    'search': '<path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0"/>',
    'arrow-up': '<path fill-rule="evenodd" d="M8 15a.5.5 0 0 0 .5-.5V2.707l3.146 3.147a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 1 0 .708.708L7.5 2.707V14.5a.5.5 0 0 0 .5.5"/>',
    'x-lg': '<path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8z"/>',
    'send-fill': '<path d="M15.964.686a.5.5 0 0 0-.65-.65L.767 5.855H.766l-.452.18a.5.5 0 0 0-.082.887l.41.26.001.002 4.995 3.178 3.178 4.995.002.002.26.41a.5.5 0 0 0 .886-.083zm-1.833 1.89L6.637 10.07l-.215-.338a.5.5 0 0 0-.154-.154l-.338-.215 7.494-7.494 1.178-.471z"/>',
    'emoji-smile': '<path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/><path d="M4.285 9.567a.5.5 0 0 1 .683.183A3.5 3.5 0 0 0 8 11.5a3.5 3.5 0 0 0 3.032-1.75.5.5 0 1 1 .866.5A4.5 4.5 0 0 1 8 12.5a4.5 4.5 0 0 1-3.898-2.25.5.5 0 0 1 .183-.683M7 6.5C7 7.328 6.552 8 6 8s-1-.672-1-1.5S5.448 5 6 5s1 .672 1 1.5m4 0c0 .828-.448 1.5-1 1.5s-1-.672-1-1.5S9.448 5 10 5s1 .672 1 1.5"/>',
    'emoji-expressionless': '<path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/><path d="M4 10.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5m5 0a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5"/>',
    'people-fill': '<path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6m-5.784 6A2.24 2.24 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.3 6.3 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1zM4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5"/>',
    'chat-dots-fill': '<path d="M16 8c0 3.866-3.582 7-8 7a9 9 0 0 1-2.347-.306c-.584.296-1.925.864-4.181 1.234-.2.032-.352-.176-.273-.362.354-.836.674-1.95.77-2.966C.744 11.37 0 9.76 0 8c0-3.866 3.582-7 8-7s8 3.134 8 7M5 8a1 1 0 1 0-2 0 1 1 0 0 0 2 0m4 0a1 1 0 1 0-2 0 1 1 0 0 0 2 0m3 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2"/>',
    'lock-fill': '<path fill-rule="evenodd" d="M8 0a4 4 0 0 1 4 4v2.05a2.5 2.5 0 0 1 2 2.45v5a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 2 13.5v-5a2.5 2.5 0 0 1 2-2.45V4a4 4 0 0 1 4-4m0 1a3 3 0 0 0-3 3v2h6V4a3 3 0 0 0-3-3"/>',
    'pause-fill': '<path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5m5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5"/>',
    'rewind-fill': '<path d="M8.404 7.304a.802.802 0 0 0 0 1.392l6.363 3.692c.52.302 1.233-.043 1.233-.696V4.308c0-.653-.713-.998-1.233-.696z"/><path d="M.404 7.304a.802.802 0 0 0 0 1.392l6.363 3.692c.52.302 1.233-.043 1.233-.696V4.308c0-.653-.713-.998-1.233-.696z"/>',
    'fast-forward-fill': '<path d="M7.596 7.304a.802.802 0 0 1 0 1.392l-6.363 3.692C.713 12.69 0 12.345 0 11.692V4.308c0-.653.713-.998 1.233-.696z"/><path d="M15.596 7.304a.802.802 0 0 1 0 1.392l-6.363 3.692C8.713 12.69 8 12.345 8 11.692V4.308c0-.653.713-.998 1.233-.696z"/>',
    'volume-up-fill': '<path d="M11.536 14.01A8.47 8.47 0 0 0 14.026 8a8.47 8.47 0 0 0-2.49-6.01l-.708.707A7.48 7.48 0 0 1 13.025 8c0 2.071-.84 3.946-2.197 5.303z"/><path d="M10.121 12.596A6.48 6.48 0 0 0 12.025 8a6.48 6.48 0 0 0-1.904-4.596l-.707.707A5.48 5.48 0 0 1 11.025 8a5.48 5.48 0 0 1-1.61 3.89z"/><path d="M8.707 11.182A4.5 4.5 0 0 0 10.025 8a4.5 4.5 0 0 0-1.318-3.182L8 5.525A3.5 3.5 0 0 1 9.025 8 3.5 3.5 0 0 1 8 10.475zM6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06"/>',
    'box-arrow-up-right': '<path fill-rule="evenodd" d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5"/><path fill-rule="evenodd" d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0z"/>',
    'award': '<path d="M9.669.864 8 0 6.331.864l-1.858.282-.842 1.68-1.337 1.32L2.6 6l-.306 1.854 1.337 1.32.842 1.68 1.858.282L8 12l1.669-.864 1.858-.282.842-1.68 1.337-1.32L13.4 6l.306-1.854-1.337-1.32-.842-1.68zm1.196 1.193.684 1.365 1.086 1.072L12.387 6l.248 1.506-1.086 1.072-.684 1.365-1.51.229L8 10.874l-1.355-.702-1.51-.229-.684-1.365-1.086-1.072L3.614 6l-.25-1.506 1.087-1.072.684-1.365 1.51-.229L8 1.126l1.356.702z"/><path d="M4 11.794V16l4-1 4 1v-4.206l-2.018.306L8 13.126 6.018 12.1z"/>',
    'slash-circle': '<path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/><path d="M11.354 4.646a.5.5 0 0 0-.708 0l-6 6a.5.5 0 0 0 .708.708l6-6a.5.5 0 0 0 0-.708"/>',
    'play-circle': '<path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/><path d="M6.271 5.055a.5.5 0 0 1 .52.038l3.5 2.5a.5.5 0 0 1 0 .814l-3.5 2.5A.5.5 0 0 1 6 10.5v-5a.5.5 0 0 1 .271-.445"/>',
    'arrow-repeat': '<path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41m-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9"/><path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5 5 0 0 0 8 3M3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9z"/>',
    'house-fill': '<path d="M8.707 1.5a1 1 0 0 0-1.414 0L.646 8.146a.5.5 0 0 0 .708.708L8 2.207l6.646 6.647a.5.5 0 0 0 .708-.708L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293z"/><path d="m8 3.293 6 6V13.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 13.5V9.293z"/>',
    'file-earmark-text': '<path d="M5.5 7a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1zM5 9.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5m0 2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5"/><path d="M9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.5zm0 1v2A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"/>'
  };
  const iconTpl = new Map();
  function icon(n) {
    let t = iconTpl.get(n);
    if (!t) {
      t = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      t.setAttribute('class', 'bi');
      const d = ICONS[n] || '';
      t.setAttribute('viewBox', Array.isArray(d) ? d[0] : '0 0 16 16');
      t.setAttribute('aria-hidden', 'true');
      t.innerHTML = Array.isArray(d) ? d[1] : d;
      iconTpl.set(n, t);
    }
    return t.cloneNode(true);
  }
  const btn = (cls, ic, label, props) => h('button', { class: cls, ...props }, icon(ic), label ? h('span', { text: label }) : null);

  const host = document.createElement('div');
  host.style.cssText = 'all:initial';
  const shadow = host.attachShadow({ mode: 'open' });

  const greetText = h('div');
  let greetAv = avatarEl('?', null, 'lg');
  const greet = h('div', { class: 'greet' }, greetAv, greetText);
  const acctEl = h('div', { class: 'muted' });
  const renameBtn1 = h('button', { class: 'link', text: 'Átnevezés', onclick: () => askName() });
  const renameBtn2 = h('button', { class: 'link', text: 'Átnevezés', onclick: () => askName() });
  const note = h('div', { class: 'note' });
  const codeField = h('input', { class: 'field code-in', placeholder: 'Szoba kódja', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', maxlength: '8', inputmode: 'text' });
  const tidyCode = () => {
    const v = codeField.value.split('').filter(ch => CODE_ABC.includes(ch.toLowerCase())).join('').slice(0, CODE_LEN);
    if (codeField.value !== v) codeField.value = v;
  };
  codeField.addEventListener('input', e => { if (!e.isComposing) tidyCode(); });
  codeField.addEventListener('compositionend', tidyCode);
  codeField.addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(codeField.value); });
  const inviteBtn = btn('btn', 'play-fill', 'Belépés', { onclick: () => joinRoom(inviteCode) });
  const setupEl = h('div', { class: 'top' },
    greet,
    acctEl,
    renameBtn1,
    note,
    inviteBtn,
    btn('btn', 'plus-lg', 'Új szoba', { onclick: createRoom }),
    h('div', { class: 'row' }, codeField, btn('btn sec', 'box-arrow-in-right', 'Belépés', { style: 'flex:0 0 auto;width:auto', onclick: () => joinRoom(codeField.value) })));

  const dot = h('span', { class: 'dot' });
  const CONN_TXT = { wait: 'Csatlakozás…', ok: 'Csatlakozva', off: 'Nincs net', err: 'Hiba' };
  const connTexts = {};
  for (const k in CONN_TXT) connTexts[k] = h('span', { text: CONN_TXT[k] });
  const connText = h('span', { class: 'ctext' }, ...Object.values(connTexts));
  const activityEl = h('div', { class: 'activity' });
  const tapBtn = btn('btn', 'play-fill', 'Indítás', { style: 'display:none', onclick: () => {
    const v = getVideo();
    tapBtn.style.display = 'none';
    updateStatus();
    if (!v) return;
    if (tapMode === 'unmute') { setMuted(v, false); setActivity(''); return; }
    expectEv('play');
    v.play().then(() => { setActivity(''); requestSync(); }, () => {});
  } });
  // Általános állapot (host vagy, korlátozás) és a szoba videója külön: az utóbbi saját kártyán, bélyegképpel.
  const hostTxt = h('div');
  const thumbEl = h('img', { class: 'vthumb', alt: '', decoding: 'async', referrerpolicy: 'same-origin' });
  let thumbBad = '';
  thumbEl.addEventListener('error', () => { thumbBad = thumbEl.getAttribute('src'); thumbEl.style.display = 'none'; });
  const vcapEl = h('div', { class: 'vcap' }), vtitleEl = h('div', { class: 'vtitle' });
  const vcard = h('div', { class: 'vcard', onclick: () => jumpBtn.click() }, thumbEl, h('div', { class: 'vinfo' }, vcapEl, vtitleEl));
  const jumpBtn = btn('btn', 'arrow-right-circle', 'Visszaugrás', { onclick: () => {
    const p = videoPath(roomV);
    if (!p) return;
    if (VPATH && sameVideo(VPATH, p)) { takeOver(false); return; }
    navigating = true;
    claimLead(true);
    openVideo(p);
  } });
  const lockBtn = btn('btn sec', 'lock', 'Korlátozás', { onclick: () => setLock(!locked) });
  const lockNote = h('div', { class: 'locknote' });
  const hostInfo = h('div', { class: 'hinfo' }, hostTxt, lockNote);
  const showBtn = btn('btn', 'broadcast', 'Ezt nézzük', { title: 'A szoba is ezt a videót nézze', onclick: showToRoom });
  const hostBox = h('div', { class: 'box hbox' }, hostInfo, vcard, jumpBtn, showBtn, lockBtn);
  const countEl = h('span');
  const banTitle = h('div', { class: 'muted' });
  const banList = h('div');
  const banBox = h('div', { class: 'box', style: 'display:none' }, banTitle, banList);
  const membersEl = h('div');
  const codeEl = h('div', { class: 'code' });
  let codePinned = false, codeHover = false;
  const eyeBtn = btn('eye', 'eye', '', { 'aria-label': 'Kód mutatása', title: 'Kód mutatása',
    onclick: () => { codePinned = !codePinned; renderCode(); },
    onmouseenter: () => { codeHover = true; renderCode(); },
    onmouseleave: () => { codeHover = false; renderCode(); } });
  function renderCode() {
    const vis = codePinned || codeHover;
    codeEl.textContent = vis ? room.toUpperCase() : '•'.repeat(room.length || 8);
    codeEl.classList.toggle('masked', !vis);
    eyeBtn.replaceChildren(icon(vis ? 'eye-slash' : 'eye'));
    eyeBtn.setAttribute('aria-pressed', String(codePinned));
  }
  const codeBtn = btn('btn sec', 'clipboard', 'Másolás', { style: 'flex:0 0 auto;width:auto', onclick: copyCode });
  let leaveArmed = null;
  const leaveBtn = btn('btn danger', 'box-arrow-right', 'Kilépés', { onclick: () => {
    if (leaveArmed) { clearTimeout(leaveArmed); leaveArmed = null; resetLeave(); leaveRoom(); return; }
    leaveBtn.classList.add('armed');
    leaveBtn.replaceChildren(icon('exclamation-circle'), h('span', { text: 'Biztos?' }));
    leaveArmed = setTimeout(() => { leaveArmed = null; resetLeave(); }, 3500);
  } });
  function resetLeave() {
    leaveBtn.classList.remove('armed');
    leaveBtn.replaceChildren(icon('box-arrow-right'), h('span', { text: 'Kilépés' }));
  }
  function section(key, title, ...content) {
    const head = h('button', { class: 'sechead', type: 'button' }, icon('chevron-down'), title);
    const sec = h('div', { class: 'sect' }, head, h('div', { class: 'secbody' }, ...content));
    const set = v => {
      sec.classList.toggle('collapsed', v);
      head.setAttribute('aria-expanded', String(!v));
      head.title = v ? 'Kinyitás' : 'Összecsukás';
    };
    set(store.get('tcwt_col_' + key) === '1');
    sec._toggle = v => { set(v); store.set('tcwt_col_' + key, v ? '1' : '0'); nextFrame(updateMore); };
    head.addEventListener('click', () => sec._toggle(!sec.classList.contains('collapsed')));
    return sec;
  }
  let askDismissed = false;
  const hostDevice = () => !!(room && hostConfirmed && hostRec && hostRec.c === cid);
  function showToRoom() {
    askEl.hidden = true; askDismissed = true; updateStatus();
    if (!VPATH || !hostDevice()) return;
    claimLead(true);
    if (!isHost) setHost(cid, shown(), tabId, true);
    else sendState();
  }
  const askEl = h('div', { class: 'box ask', hidden: 'hidden' },
    h('div', { class: 'asktxt', text: 'Ezt a videót mutasd a szobának is?' }),
    h('div', { class: 'row' },
      btn('btn', 'broadcast', 'Igen', { onclick: showToRoom }),
      btn('btn sec', 'person', 'Csak én nézem', { onclick: () => { askEl.hidden = true; askDismissed = true; updateStatus(); } })));
  const statusEl = h('div', { class: 'status', hidden: 'hidden' }, askEl, tapBtn, activityEl);
  // ---- Videósor felülete ----
  const qCount = h('span', { text: 'Videósor' });
  const qSearchIn = h('input', { class: 'field qin', type: 'search', placeholder: 'Videó keresése…', autocomplete: 'off', maxlength: '80', enterkeyhint: 'search', 'aria-label': 'Videó keresése' });
  const qSearchBtn = btn('btn sec qbtn', 'search', '', { type: 'button', 'aria-label': 'Keresés', title: 'Keresés', onclick: () => runSearch() });
  qSearchIn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } });
  const qResults = h('div', { class: 'qres', hidden: 'hidden' });
  const qHereBtn = btn('btn sec qhere', 'plus-lg', 'Ez a videó a sorba', { type: 'button', onclick: () => {
    const id = vidId(VPATH);
    if (id) suggest({ id, p: VPATH, t: pageLabel(), d: Math.round(videoLen()) });
    renderQueue();
  } });
  const qList = h('div', { class: 'qlist' });
  const parseDur = s => { const m = /(?:(\d+):)?(\d{1,2}):(\d{2})/.exec(s || ''); return m ? (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]) : 0; };
  // Az oldal saját keresője (/search/videos/<szöveg>): a találati kártyákból cím, hossz és azonosító.
  function parseSearch(html) {
    const d = new DOMParser().parseFromString(html, 'text/html');
    const out = [], got = new Set();
    for (const box of d.querySelectorAll('.thumb-overlay')) {
      const a = box.closest('a[href]');
      let u; try { u = new URL(a ? a.getAttribute('href') : '', location.origin); } catch (e) { continue; }
      const id = u.origin === location.origin ? vidId(u.pathname) : null;
      if (!id || got.has(id)) continue;
      got.add(id);
      const img = box.querySelector('img'), tm = box.querySelector('.time');
      out.push({ id, p: videoPath(u.pathname) || '/video/' + id, t: clean((img && (img.getAttribute('title') || img.getAttribute('alt'))) || 'Videó', TITLE_MAX), d: parseDur(tm ? tm.textContent : '') });
      if (out.length >= 24) break;
    }
    return out;
  }
  let searchSeq = 0;
  async function runSearch() {
    const q = qSearchIn.value.replace(/\s+/g, ' ').trim().slice(0, 80);
    const my = ++searchSeq;
    if (!q) { qResults.hidden = true; qResults.replaceChildren(); return; }
    qResults.hidden = false;
    qResults.replaceChildren(h('div', { class: 'muted qnote', text: 'Keresés…' }));
    let items = null;
    try {
      const r = await fetch(location.origin + '/search/videos/' + encodeURIComponent(q), { credentials: 'same-origin' });
      if (r.ok) items = parseSearch(await r.text());
    } catch (e) {}
    if (my !== searchSeq) return;
    if (!items) { qResults.replaceChildren(h('div', { class: 'muted qnote', text: 'A keresés nem sikerült.' })); return; }
    qResults.replaceChildren(...(items.length ? items.map(it => qRow(it, 'res')) : [h('div', { class: 'muted qnote', text: 'Nincs találat.' })]));
  }
  function qRow(it, mode, idx) {
    const img = h('img', { class: 'qthumb', alt: '', loading: 'lazy', decoding: 'async', referrerpolicy: 'same-origin', src: location.origin + '/media/videos/tmb/' + it.id + '/default.jpg' });
    img.addEventListener('error', () => { img.style.visibility = 'hidden'; });
    if (mode === 'q' && !(vinfo[it.id] && vinfo[it.id].ok)) wantVideoInfo(it.id, true);
    const vi = vinfo[it.id] || {};
    const d = it.d || vi.d;
    const meta = [d ? fmtTime(d) : '', views(vi), vi.u || '', mode === 'q' && it.by ? 'javasolta: ' + it.by : ''].filter(Boolean);
    const info = h('a', { class: 'qinfo', href: location.origin + it.p, target: '_blank', rel: 'noopener', title: it.t + ' – megnyitás új lapon' },
      h('div', { class: 'qtitle', text: (mode === 'q' ? (idx + 1) + '. ' : '') + it.t }), meta.length ? marq('qmeta', metaLine(meta)) : null);
    const acts = h('div', { class: 'qacts' });
    if (mode === 'res') {
      const done = inQueue(it.id);
      const b = btn('qb', done ? 'check-lg' : 'plus-lg', '', { type: 'button', title: done ? 'Már a sorban van' : isHost ? 'Sorba' : 'Javaslat a hostnak', 'aria-label': isHost ? 'Sorba' : 'Javaslat a hostnak',
        onclick: e => { e.stopPropagation(); if (suggest(it)) { b.replaceChildren(icon('check-lg')); b.disabled = true; } } });
      if (done) b.disabled = true;
      acts.append(b);
    } else if (isHost) {
      acts.append(btn('qb', 'play-fill', '', { type: 'button', title: 'Lejátszás most', 'aria-label': 'Lejátszás most', onclick: () => qPlay(it.id) }));
      if (idx > 0) acts.append(btn('qb', 'arrow-up', '', { type: 'button', title: 'Feljebb', 'aria-label': 'Feljebb', onclick: () => qUp(it.id) }));
      acts.append(btn('qb', 'x-lg', '', { type: 'button', title: 'Törlés a sorból', 'aria-label': 'Törlés a sorból', onclick: () => qRemove(it.id) }));
    }
    return h('div', { class: 'qrow' }, img, info, acts);
  }
  function renderQueue() {
    qCount.textContent = queue.length ? 'Videósor (' + queue.length + ')' : 'Videósor';
    qList.replaceChildren(...(queue.length ? queue.map((it, i) => qRow(it, 'q', i))
      : [h('div', { class: 'muted qnote', text: isHost ? 'A sor üres. Keress videót, vagy tedd be, amit épp nézel.' : 'A sor üres. Keress videót, és javasold a hostnak.' })]));
    const here = vidId(VPATH);
    qHereBtn.style.display = room && here && !(roomV && sameVideo(VPATH, roomV)) && !inQueue(here) ? '' : 'none';
    qHereBtn.querySelector('span').textContent = isHost ? 'Ez a videó a sorba' : 'Ezt a videót javaslom';
  }
  const queueSec = section('queue', qCount, h('div', { class: 'qsearch' }, qSearchIn, qSearchBtn), qResults, qHereBtn, qList);

  const liveEl = h('div', { class: 'top live', role: 'tabpanel' },
    section('room', h('span', { text: 'Vezérlés' }),
      hostBox,
      h('div', { class: 'roomcard' },
        h('div', { class: 'muted', text: 'Szobakód' }),
        h('div', { class: 'coderow' }, codeEl, eyeBtn, codeBtn),
        leaveBtn)),
    queueSec,
    section('members', countEl,
      membersEl,
      banBox,
      renameBtn2));


  const emptyEl = h('div', { class: 'empty', text: 'Még nincs üzenet.' });
  const msgsEl = h('div', { class: 'msgs' }, emptyEl);
  const inputEl = h('div', { class: 'input', contenteditable: 'true', role: 'textbox', 'aria-label': 'Üzenet',
    'data-ph': 'Írj üzenetet…', enterkeyhint: 'send', spellcheck: 'true' });
  inputEl.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); sendChat(); } });
  const epanel = h('div', { class: 'epanel' },
    h('div', { class: 'ehead' }, h('span', { text: 'Smiley-k' }),
      btn('x', 'x-lg', '', { 'aria-label': 'Smiley-k bezárása', onclick: () => toggleEmoji(false) })),
    // loading=lazy: a rejtett választó ne töltse le minden oldalbetöltéskor mind a ~70 képet, csak ha kinyitják.
    h('div', { class: 'egrid' }, SMILEYS.map(f => {
      const img = smileyImg(f); img.loading = 'lazy';
      return h('button', { class: 'emo', title: smileyName(f), 'aria-label': smileyName(f), onmousedown: e => e.preventDefault(), onclick: () => insertSmiley(f) }, img);
    })));
  const etoggle = h('button', { class: 'etoggle', 'aria-label': 'Smiley-k', onclick: () => toggleEmoji() }, smileyImg('kettospont%20).png'));
  const chatEl = h('div', { role: 'tabpanel', style: 'display:flex;flex-direction:column;flex:1 1 0;min-height:0' },
    msgsEl,
    h('div', { class: 'composer' }, etoggle, inputEl, btn('send', 'send-fill', '', { 'aria-label': 'Küldés', onclick: sendChat })));

  const connChip = h('span', { class: 'conn', role: 'status', style: 'display:none' }, dot, connText);
  const logoEl = h('div', { class: 'logo', title: 'Trash2gether – közös nézés' });
  logoEl.innerHTML = LOGO_SVG;

  let floatOn = store.get('tcwt_float') !== '0';
  const floatBtn = btn('x', 'emoji-smile', '', { onclick: () => setFloat(!floatOn) });
  function setFloat(on) {
    floatOn = on;
    store.set('tcwt_float', on ? '1' : '0');
    floatBtn.classList.toggle('off', !on);
    floatBtn.replaceChildren(icon(on ? 'emoji-smile' : 'emoji-expressionless'));
    floatBtn.title = on ? 'Lebegő smiley-k: be' : 'Lebegő smiley-k: ki';
    floatBtn.setAttribute('aria-label', floatBtn.title);
    if (!on) floatLayer.querySelectorAll('.float').forEach(e => e.remove());
  }
  const headEl = h('header', { title: 'Húzd a mozgatáshoz · dupla katt: alaphelyzet' },
    logoEl, connChip, h('div', { class: 'hsp' }), floatBtn, btn('x', 'x-lg', '', { 'aria-label': 'Bezár', onclick: () => togglePanel(false) }));
  const rzL = h('div', { class: 'rz rz-l' }), rzT = h('div', { class: 'rz rz-t' }), rzTL = h('div', { class: 'rz rz-tl' });
  const chatCnt = h('span', { class: 'cnt' }), roomNum = h('span', { class: 'num' });
  const tabRoom = h('button', { class: 'tab', role: 'tab', type: 'button', onclick: () => setView('room') }, icon('people-fill'), h('span', { text: 'Szoba' }), roomNum);
  const tabChat = h('button', { class: 'tab', role: 'tab', type: 'button', onclick: () => setView('chat') }, icon('chat-dots-fill'), h('span', { text: 'Chat' }), chatCnt);
  const tabsEl = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Nézet' }, tabRoom, tabChat);
  tabsEl.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    setView(view === 'chat' ? 'room' : 'chat');
    (view === 'chat' ? tabChat : tabRoom).focus();
  });
  let view = store.get('tcwt_view') === 'room' ? 'room' : 'chat';
  const panel = h('section', { class: 'panel' },
    rzL, rzT, rzTL,
    headEl,
    setupEl, tabsEl, statusEl, liveEl, chatEl);
  const dock = h('div', { class: 'dock', hidden: 'hidden' }, epanel, panel);
  const badge = h('span', { class: 'badge' });
  const fab = h('button', { class: 'fab', 'aria-label': 'Közös nézés', onclick: () => togglePanel(!panelOpen) }, icon('people-fill'), badge);

  const floatLayer = h('div', { class: 'floats' });
  const canTop = typeof HTMLElement === 'function' && 'popover' in HTMLElement.prototype;
  if (canTop) floatLayer.setAttribute('popover', 'manual');
  function floatsOnTop() {
    if (!canTop || !floatLayer.isConnected) return;
    try { if (floatLayer.matches(':popover-open')) floatLayer.hidePopover(); floatLayer.showPopover(); } catch (e) {}
  }
  const rootEl = h('div', { class: 'root' }, dock, fab, floatLayer);
  setFloat(floatOn);

  function siteTheme() {
    let mode = null;
    document.querySelectorAll('link[rel~="stylesheet"]').forEach(l => {
      if (l.disabled) return;
      let on = true;
      try { on = !l.media || matchMedia(l.media).matches; } catch (e) {}
      if (!on) return;
      if (/\/dark\.css(\?|$)/.test(l.href)) mode = 'dark';
      else if (/\/bright\.css(\?|$)/.test(l.href)) mode = 'light';
    });
    if (mode) return mode;
    const m = getComputedStyle(document.body).backgroundColor.match(/\d+/g);
    return m && (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) > 140 ? 'light' : 'dark';
  }
  const toastEl = h('div', { class: 'toast', role: 'status' });
  floatLayer.append(toastEl);
  let toastTimer = null;
  const fmtTime = sec => {
    sec = Math.max(0, Math.floor(sec));
    const hh = Math.floor(sec / 3600), mm = Math.floor(sec % 3600 / 60), ss = String(sec % 60).padStart(2, '0');
    return hh ? hh + ':' + String(mm).padStart(2, '0') + ':' + ss : mm + ':' + ss;
  };
  // Előnézeti kép egy időponthoz az oldal lejátszójának saját képsorából (a tekerősáv fölötti kis kép is ebből
  // jön): 3 másodpercenként egy kocka, a sprite.json mondja meg, hol van a képen. Ha nincs ilyen, nincs kép.
  function seekThumb(t, w) {
    try {
      const md = window.metadata, sp = window.preloadedSprites;
      if (!window.spriteMode || !md || typeof md !== 'object' || !Array.isArray(sp) || !okTime(t)) return null;
      let idx = Math.floor(t / 3) + 1, f = md['o' + idx + '.jpg'];
      while (!f && idx > 1) f = md['o' + (--idx) + '.jpg'];
      const img = f && sp[(f.sprite || 1) - 1];
      if (!img || !img.naturalWidth || !(f.width > 0) || !(f.height > 0) || !/^https:\/\/(www\.)?trashcity\.net\//.test(img.src)) return null;
      const k = w / f.width;
      return h('span', { class: 'skthumb', 'aria-hidden': 'true', style: `width:${w}px;height:${Math.round(f.height * k)}px;` +
        `background-image:url("${img.src}");background-position:-${Math.round(f.x * k)}px -${Math.round(f.y * k)}px;` +
        `background-size:${Math.round(img.naturalWidth * k)}px auto` });
    } catch (e) { return null; }
  }
  function showAction(m) {
    const who = clean(m.n);
    let ic, txt;
    if (m.a === 'play') { ic = 'play-fill'; txt = 'elindította'; }
    else if (m.a === 'pause') { ic = 'pause-fill'; txt = 'megállította'; }
    else if (m.a === 'seek' && okTime(m.t)) {
      const back = okTime(m.f) && m.f > m.t;
      ic = back ? 'rewind-fill' : 'fast-forward-fill';
      txt = (back ? 'visszatekert' : 'előretekert') + (okTime(m.f) ? ': ' + fmtTime(m.f) + ' → ' + fmtTime(m.t) : ' ide: ' + fmtTime(m.t));
    } else return;
    const th = m.a === 'seek' ? seekThumb(m.t, 96) : null;
    showToast([avatarEl(who, m.ui, 'xs'), h('b', { text: who }), icon(ic), h('span', { text: txt }), ...(th ? [th] : [])], th ? 3200 : 2600, 'act');
  }
  function lockToast() {
    showToast([icon('lock-fill'), h('span', { text: ' Csak a host kontrollál' })], 1800, '');
  }
  function showToast(kids, ms, kind) {
    if (canTop && !floatLayer.matches(':popover-open')) floatsOnTop();
    toastEl.className = 'toast' + (kind ? ' ' + kind : '');
    toastEl.replaceChildren(...kids);
    const box = document.querySelector('.video-container') || getVideo();
    const rc = box ? box.getBoundingClientRect() : null;
    if (rc && rc.width && rc.bottom > 0 && rc.top < innerHeight) {
      toastEl.style.left = Math.round(rc.left + rc.width / 2) + 'px';
      toastEl.style.top = Math.round(Math.min(Math.max(rc.top + rc.height * 0.18, 12), innerHeight - 60)) + 'px';
    } else {
      toastEl.style.left = '50%';
      toastEl.style.top = '80px';
    }
    void toastEl.offsetWidth;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('on'), ms);
  }

  const lockActive = () => !!(locked && !isHost && room && isLead() && VPATH && roomV && sameVideo(VPATH, roomV));
  const LOCK_PRESS = '.timeline-container, .play-pause-btn, .ytp-play-button, .speed-btn';
  const LOCK_CLICK = LOCK_PRESS + ', .playfade, .pausefade, video';
  const fromUs = e => typeof e.composedPath === 'function' && e.composedPath().includes(host);
  function blockPointer(e) {
    if (!lockActive() || fromUs(e) || !e.target || !e.target.closest) return;
    const sel = (e.type === 'click' || e.type === 'dblclick') ? LOCK_CLICK : LOCK_PRESS;
    if (!e.target.closest(sel)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.type !== 'dblclick') lockToast();
  }
  ['pointerdown', 'mousedown', 'touchstart', 'click', 'dblclick'].forEach(t => window.addEventListener(t, blockPointer, { capture: true, passive: false }));
  window.addEventListener('keydown', e => {
    if (!lockActive() || fromUs(e)) return;
    const a = document.activeElement;
    const tag = (a?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || a?.isContentEditable) return;
    const k = (e.key || '').toLowerCase();
    if ([' ', 'k', 'j', 'l', 'arrowleft', 'arrowright', 'home', 'end', '.', ',', '<', '>', 'mediaplaypause', 'mediaplay', 'mediapause', 'mediatracknext', 'mediatrackprevious'].includes(k) || /^[0-9]$/.test(k)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      lockToast();
    }
  }, true);
  const pageStyle = document.createElement('style');
  pageStyle.textContent = 'html.tcwt-lock .timeline-container,html.tcwt-lock .play-pause-btn,html.tcwt-lock .ytp-play-button,html.tcwt-lock .speed-btn{cursor:not-allowed!important;opacity:.4}';
  document.head.appendChild(pageStyle);
  function updateLockUi() { document.documentElement.classList.toggle('tcwt-lock', lockActive()); }
  setInterval(updateLockUi, 2000);

  function applyTheme() { rootEl.classList.toggle('light', siteTheme() === 'light'); }
  applyTheme();
  let themeTimer = null;
  new MutationObserver(() => { clearTimeout(themeTimer); themeTimer = setTimeout(applyTheme, 120); }).observe(document.head, { subtree: true, childList: true, attributes: true, attributeFilter: ['media', 'disabled', 'href'] });
  document.addEventListener('change', e => { if (e.target && e.target.id === 'theme-toggle') setTimeout(applyTheme, 0); }, true);
  try { matchMedia('(prefers-color-scheme: light)').addEventListener('change', applyTheme); } catch (e) {}
  shadow.append(h('style', { text: CSS }), rootEl);

  function toggleEmoji(on) {
    on = typeof on === 'boolean' ? on : !dock.classList.contains('emoji-on');
    dock.classList.toggle('emoji-on', on);
    etoggle.classList.toggle('on', on);
    clampSize();
  }

  const isMobile = () => matchMedia('(max-width:600px)').matches;
  let size = null, pos = null;
  try { pos = JSON.parse(store.get('tcwt_pos') || 'null'); if (!pos || !isFinite(pos.r) || !isFinite(pos.b)) pos = null; } catch (e) { pos = null; }
  function clampPos() {
    if (isMobile() || !pos) { dock.style.right = ''; dock.style.bottom = ''; return; }
    dock.style.right = pos.r + 'px'; dock.style.bottom = pos.b + 'px';
    const rc = dock.getBoundingClientRect();
    if (!rc.width) return;
    const r = Math.max(8, Math.min(pos.r, innerWidth - rc.width - 8));
    const b = Math.max(8, Math.min(pos.b, innerHeight - rc.height - 8));
    pos = { r: Math.round(r), b: Math.round(b) };
    dock.style.right = pos.r + 'px'; dock.style.bottom = pos.b + 'px';
  }
  try { size = JSON.parse(store.get('tcwt_size') || 'null'); } catch (e) {}
  // A fejléc (logó, kapcsolat-állapot, gombok) sosem nyomódik össze: a panel legalább ilyen széles marad.
  let chipW = 0, headMin = 0;
  function measureHead() {
    if (isMobile()) { headMin = 0; panel.style.removeProperty('--pmin'); return; }
    if (dock.hidden) return;
    const cs = getComputedStyle(headEl), gap = parseFloat(cs.columnGap) || 0;
    let w = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + 2, n = 0;
    for (const k of headEl.children) {
      if (k.classList.contains('hsp')) continue;
      let kw = k.getBoundingClientRect().width;
      if (k === connChip) kw = connChip.style.display === 'none' ? chipW : (chipW = kw);
      if (kw) { w += kw + gap; n++; }
    }
    if (!n) return;
    headMin = Math.ceil(w);
    panel.style.setProperty('--pmin', headMin + 'px');
  }
  function setSize(w, hgt) {
    const emojiW = dock.classList.contains('emoji-on') ? 244 : 0;
    w = Math.round(Math.max(300, headMin, Math.min(w, innerWidth - 32 - emojiW)));
    hgt = Math.round(Math.max(360, Math.min(hgt, innerHeight - 110)));
    panel.style.setProperty('--pw', w + 'px');
    panel.style.setProperty('--ph', hgt + 'px');
    size = { w, h: hgt };
    clampPos();
  }
  function clampSize() { measureHead(); if (size && !isMobile()) setSize(size.w, size.h); else clampPos(); }
  if (size && isFinite(size.w) && isFinite(size.h)) setSize(+size.w, +size.h); else size = null;
  addEventListener('resize', clampSize);
  try { document.fonts.addEventListener('loadingdone', () => clampSize()); } catch (e) {}

  function startResize(e, horiz, vert) {
    if (isMobile() || e.button > 0) return;
    e.preventDefault();
    const r = panel.getBoundingClientRect(), sx = e.clientX, sy = e.clientY;
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    panel.classList.add('dragging');
    const move = ev => setSize(horiz ? r.width - (ev.clientX - sx) : r.width, vert ? r.height - (ev.clientY - sy) : r.height);
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      panel.classList.remove('dragging');
      if (size) store.set('tcwt_size', JSON.stringify(size));
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  }
  rzL.addEventListener('pointerdown', e => startResize(e, true, false));
  rzT.addEventListener('pointerdown', e => startResize(e, false, true));
  rzTL.addEventListener('pointerdown', e => startResize(e, true, true));
  function updateMore() {
    liveEl.classList.toggle('more', liveEl.scrollHeight - liveEl.scrollTop - liveEl.clientHeight > 4);
  }
  liveEl.addEventListener('scroll', updateMore, { passive: true });
  let stick = true;
  msgsEl.addEventListener('scroll', () => { stick = msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight < 40; }, { passive: true });
  const toBottom = () => { if (stick) msgsEl.scrollTop = msgsEl.scrollHeight; };
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(updateMore).observe(liveEl);
    new ResizeObserver(toBottom).observe(msgsEl);
  } else addEventListener('resize', () => { updateMore(); toBottom(); });

  headEl.addEventListener('pointerdown', e => {
    if (isMobile() || e.button > 0 || e.target.closest('button')) return;
    e.preventDefault();
    const rc = dock.getBoundingClientRect(), sx = e.clientX, sy = e.clientY;
    const r0 = innerWidth - rc.right, b0 = innerHeight - rc.bottom;
    headEl.setPointerCapture(e.pointerId);
    panel.classList.add('dragging', 'moving');
    const move = ev => { pos = { r: r0 - (ev.clientX - sx), b: b0 - (ev.clientY - sy) }; clampPos(); };
    const up = () => {
      headEl.removeEventListener('pointermove', move);
      headEl.removeEventListener('pointerup', up);
      headEl.removeEventListener('pointercancel', up);
      panel.classList.remove('dragging', 'moving');
      if (pos) store.set('tcwt_pos', JSON.stringify(pos));
    };
    headEl.addEventListener('pointermove', move);
    headEl.addEventListener('pointerup', up);
    headEl.addEventListener('pointercancel', up);
  });
  headEl.addEventListener('dblclick', e => {
    if (e.target.closest('button')) return;
    pos = null; store.del('tcwt_pos'); clampPos();
  });

  [rzL, rzT, rzTL].forEach(el => el.addEventListener('dblclick', () => {
    size = null; store.del('tcwt_size');
    panel.style.removeProperty('--pw'); panel.style.removeProperty('--ph');
  }));
  host.setAttribute('data-t2g', '1');
  document.body.appendChild(host);
  floatsOnTop();
  setTimeout(() => {
    const other = [...document.querySelectorAll('body > div')].some(d => d !== host && !d.hasAttribute('data-t2g') && d.shadowRoot && d.shadowRoot.querySelector('.fab'));
    if (!other) return;
    const warn = document.createElement('div');
    warn.textContent = 'Trash2Gether: a régi „Trash City Watch Together” script is fut – kapcsold ki a Tampermonkey-ban! (kattints a bezáráshoz)';
    warn.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#e34449;color:#fff;font:600 14px/1.3 system-ui,sans-serif;padding:10px 14px;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.4);cursor:pointer;max-width:90vw;text-align:center';
    warn.addEventListener('click', () => warn.remove());
    document.body.appendChild(warn);
  }, 4000);

  ['keydown', 'keyup', 'keypress'].forEach(ev => host.addEventListener(ev, e => e.stopPropagation()));
  const onFs = () => {
    const el = document.fullscreenElement || document.webkitFullscreenElement;
    (el && el.tagName !== 'VIDEO' ? el : document.body).appendChild(host);
    rootEl.classList.toggle('infs', !!el);
    setTimeout(clampPos, 0);
    setTimeout(floatsOnTop, 60);
  };
  document.addEventListener('fullscreenchange', onFs);
  document.addEventListener('webkitfullscreenchange', onFs);

  function togglePanel(open) {
    panelOpen = open;
    dock.hidden = !open;
    if (open) { measureHead(); clampPos(); }
    if (open && view === 'chat') { unread = 0; updateBadge(); stick = true; msgsEl.scrollTop = msgsEl.scrollHeight; }
  }
  function updateBadge() {
    const t = unread > 99 ? '99+' : String(unread);
    badge.textContent = t;
    badge.style.display = unread ? 'block' : 'none';
    chatCnt.textContent = t;
    chatCnt.classList.toggle('on', !!unread);
    tabChat.setAttribute('aria-label', unread ? 'Chat, ' + t + ' olvasatlan üzenet' : 'Chat');
  }
  function setView(v) {
    view = v === 'room' ? 'room' : 'chat';
    store.set('tcwt_view', view);
    const live = !!room && setupEl.style.display === 'none';
    tabRoom.classList.toggle('on', view === 'room'); tabRoom.setAttribute('aria-selected', String(view === 'room')); tabRoom.tabIndex = view === 'room' ? 0 : -1;
    tabChat.classList.toggle('on', view === 'chat'); tabChat.setAttribute('aria-selected', String(view === 'chat')); tabChat.tabIndex = view === 'chat' ? 0 : -1;
    liveEl.style.display = live && view === 'room' ? '' : 'none';
    chatEl.style.display = live && view === 'chat' ? 'flex' : 'none';
    if (view === 'room') { toggleEmoji(false); nextFrame(updateMore); }
    else {
      if (panelOpen) { unread = 0; updateBadge(); }
      stick = true;
      nextFrame(() => { msgsEl.scrollTop = msgsEl.scrollHeight; });
    }
  }
  function updateStatus() {
    statusEl.hidden = !(activityEl.textContent || tapBtn.style.display !== 'none' || !askEl.hidden);
  }
  function setLive(on) {
    setupEl.style.display = on ? 'none' : '';
    tabsEl.style.display = on ? '' : 'none';
    connChip.style.display = on ? '' : 'none';
    if (on) measureHead();
    codePinned = false; codeHover = false; renderCode();
    setView(view);
    fab.classList.toggle('live', on);
    inviteBtn.style.display = !on && inviteCode ? '' : 'none';
    if (on) { note.textContent = ''; renderMembers(); }
    else { activityEl.textContent = ''; tapBtn.style.display = 'none'; }
    updateStatus();
  }
  function setConn(key) {
    dot.className = 'dot ' + (key === 'ok' ? 'ok' : 'warn');
    for (const k in connTexts) connTexts[k].classList.toggle('on', k === key);
    const n = key === 'ok' && client ? client.cs.filter(c => c.connected).length : 0;
    connChip.title = (CONN_TXT[key] || '') + (n ? ' (' + n + '/' + BROKERS.length + ' szerver)' : '');
  }
  // Hálózat vissza: nem várjuk ki a következő újrapróbálást.
  addEventListener('offline', () => { if (client && room) setConn('off'); });
  addEventListener('online', () => { if (client && room && !client.connected) { setConn('wait'); try { client.reconnect(); } catch (e) {} } });
  function setActivity(t) { activityEl.textContent = t; updateStatus(); }
  function needTap(mode) {
    tapMode = mode === 'unmute' ? 'unmute' : 'play';
    tapBtn.replaceChildren(icon(tapMode === 'unmute' ? 'volume-up-fill' : 'play-fill'),
      h('span', { text: tapMode === 'unmute' ? 'Hang be' : 'Lejátszás' }));
    tapBtn.style.display = '';
    setActivity(tapMode === 'unmute'
      ? 'Némítva indult – kapcsold be a hangot.'
      : 'A böngésző nem indította el – koppints.');
    togglePanel(true);
  }

  function copyCode() {
    const code = room.toUpperCase();
    const done = () => { codeBtn.replaceChildren(icon('check-lg'), h('span', { text: 'Másolva' }));
      setTimeout(() => codeBtn.replaceChildren(icon('clipboard'), h('span', { text: 'Másolás' })), 2000); };
    if (navigator.clipboard) navigator.clipboard.writeText(code).then(done, () => prompt('A szoba kódja:', code));
    else prompt('A szoba kódja:', code);
  }
  let renderQueued = false;
  function renderMembers() {
    if (renderQueued) return;
    renderQueued = true;
    nextFrame(() => { renderQueued = false; drawMembers(); });
  }
  function drawMembers() {
    if (!room) return;
    renderQueue();
    const byDevice = new Map();
    const isHostEntry = m => !!(hostRec && hostConfirmed && m.c === hostRec.c && (!hostRec.tab || m.tb === hostRec.tab));
    members.forEach(m => { const o = byDevice.get(m.c); if (!o || (!isHostEntry(o) && (isHostEntry(m) || (m.ld && !o.ld)))) byDevice.set(m.c, m); });
    const others = [...byDevice.values()].map(m => Object.assign({}, m, { h: isHostEntry(m) }));
    const list = [{ n: shown(), self: true, h: isHost, ui: myUi, v: VPATH, t: pageLabel() }, ...others];
    setText(countEl, 'Nézők (' + list.length + ')');
    setText(roomNum, String(list.length));
    // Csak akkor rajzoljuk újra a listát, ha tényleg változott benne valami (a 4 mp-es szinkronüzenetek
    // ne cseréljék le folyton a DOM-ot: nem villognak a profilképek, nem vész el az egér alatti gomb).
    const here0 = location.pathname + location.search;
    const sig = JSON.stringify([isHost, roomV, here0, modArmed && [modArmed.c, modArmed.act],
      list.map(m => [m.n, m.self ? 1 : 0, m.h ? 1 : 0, m.ui, m.v, m.t, m.u, m.ghost ? 1 : 0, m.c, m.tb, m.a ? 1 : 0])]);
    if (sig !== membersSig || membersEl.childElementCount !== list.length) {
      membersSig = sig;
      membersEl.replaceChildren(...list.map(m => {
        const ic = m.ghost ? 'arrow-repeat' : m.v ? 'play-fill' : (m.t === 'Kezdőlap' ? 'house-fill' : 'file-earmark-text');
        const here = m.v && roomV && sameVideo(m.v, roomV);
        return h('div', { class: 'member' + (m.ghost ? ' ghost' : '') },
          avatarEl(m.n, m.ui),
          h('div', { class: 'minfo' },
            h('div', { class: 'mname', title: m.n, text: (m.h ? '👑 ' : '') + m.n + (m.self ? ' (te)' : '') }),
            !m.t ? null
              : (!m.self && m.u && m.u !== location.pathname + location.search)
                ? h('button', { class: 'mact go' + (here ? ' here' : ''), title: 'Ugrás ide: ' + m.t, onclick: () => followMember(m) },
                    icon(ic), h('span', { text: m.t }), icon('box-arrow-up-right'))
                : h('div', { class: 'mact' + (here ? ' here' : ''), title: m.t }, icon(ic), h('span', { text: m.t }))),
          isHost && !m.self ? h('div', { class: 'mods' },
            modBtn(m, 'host', 'award', 'Host átadása neki: ' + m.n, m.n + ' lesz a host', ''),
            modBtn(m, 'kick', 'box-arrow-right', 'Kirúgás: ' + m.n, m.n + ' kirúgása', ''),
            modBtn(m, 'ban', 'slash-circle', 'Kitiltás: ' + m.n, m.n + ' kitiltása', 'danger')) : null);
      }));
    }
    drawHost();
    updateMore();
  }
  let membersSig = '', bansSig = '', jumpMode = '', lockShown = null;
  const setText = (el, t) => { if (el.textContent !== t) el.textContent = t; };
  const setShow = (el, on) => { const d = on ? '' : 'none'; if (el.style.display !== d) el.style.display = d; };
  const setTitle = (el, t) => { if (el.title !== t) el.title = t; };
  function modBtn(m, act, ic, title, confirmTitle, extra) {
    const armed = armedFor(m.c, act);
    return armed
      ? btn('xfer armed ' + extra, 'check-lg', 'Biztos?', { title: 'Kattints újra: ' + confirmTitle, onclick: () => hostAction(m, act) })
      : btn('xfer ' + extra, ic, '', { title, 'aria-label': title, onclick: () => hostAction(m, act) });
  }
  function renderBans() {
    const show = isHost && bans.length > 0;
    setShow(banBox, show);
    const sig = show ? JSON.stringify(bans) : '';
    if (sig === bansSig) return;
    bansSig = sig;
    if (!show) { banList.replaceChildren(); return; }
    setText(banTitle, 'Kitiltottak (' + bans.length + ')');
    banList.replaceChildren(...bans.map(b => h('div', { class: 'member' },
      avatarEl(b.n, b.ui),
      h('div', { class: 'minfo' }, h('div', { class: 'mname', title: b.n, text: b.n }),
        h('div', { class: 'mact' }, h('span', { text: b.acc ? 'Fiók + eszköz tiltva' : 'Eszköz tiltva' }))),
      btn('xfer', 'unlock', 'Feloldás', { title: 'Tiltás feloldása: ' + b.n, onclick: () => unbanUser(b.c) }))));
  }
  function drawHost() {
    renderBans();
    let txt = '', cap = '', mode = '';
    if (isHost && roomV && !sameVideo(roomV, VPATH)) { txt = '👑 Te vagy a host.'; cap = 'Szoba videója'; mode = 'go'; }
    else if (isHost) txt = VPATH ? '👑 Te vagy a host.' : '👑 Te vagy a host – nyiss meg egy videót.';
    else if (roomV && !isLead() && sameVideo(roomV, VPATH)) { txt = 'Másik lapon nézed.'; mode = 'here'; }
    else if (roomV && !sameVideo(roomV, VPATH)) { cap = isLead() ? 'A host ezt nézi' : 'Másik lapon nézed'; mode = 'go'; }
    if (mode && mode !== jumpMode) jumpBtn.replaceChildren(icon(mode === 'here' ? 'play-circle' : 'arrow-right-circle'), h('span', { text: mode === 'here' ? 'Nézés itt' : 'Visszaugrás' }));
    if (mode) jumpMode = mode;
    setText(hostTxt, txt);
    setShow(hostTxt, txt);
    setText(vcapEl, cap);
    setText(vtitleEl, roomVT || (isHost ? 'Előző videó' : 'Másik videó'));
    setTitle(vcard, (roomVT || '') + (roomVT ? ' – ' : '') + 'kattints a visszaugráshoz');
    setShow(vcard, mode === 'go');
    const tid = mode === 'go' && vidId(roomV);
    const src = tid ? location.origin + '/media/videos/tmb/' + tid + '/default.jpg' : '';
    if (src && thumbEl.getAttribute('src') !== src) thumbEl.src = src;
    setShow(thumbEl, src && src !== thumbBad);
    const note = locked ? '🔒 Csak a host kontrollál.' : (isHost ? '🔓 Mindenki tudja kontrollálni a lejátszást.' : '');
    setText(lockNote, note);
    if (lockNote.classList.contains('open') === locked) lockNote.classList.toggle('open', !locked);
    setShow(lockNote, note);
    setShow(hostInfo, txt || note);
    updateLockUi();
    setShow(lockBtn, isHost);
    if (lockShown !== locked) {
      lockShown = locked;
      lockBtn.replaceChildren(icon(locked ? 'unlock' : 'lock'), h('span', { text: locked ? 'Feloldás' : 'Korlátozás' }));
      lockBtn.title = locked ? 'Mindenki kontrollálhassa a lejátszást' : 'Csak a host kontrollálhassa a lejátszást';
    }
    setShow(hostBox, txt || cap || locked || isHost);
    setShow(jumpBtn, mode);
    setShow(showBtn, hostDevice() && !isHost && VPATH && !sameVideo(VPATH, roomV));
  }

  function pushNode(node) {
    const near = stick || msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight < 80;
    emptyEl.remove();
    msgsEl.append(node);
    while (msgsEl.childNodes.length > 150) msgsEl.firstChild.remove();
    if (near) {
      stick = true;
      msgsEl.scrollTop = msgsEl.scrollHeight;
      if (node.querySelectorAll) node.querySelectorAll('img').forEach(im => { if (!im.complete) im.addEventListener('load', toBottom, { once: true }); });
    }
  }
  // Időbélyegek a chatben (1:20, 00:28, 1:02:03, 00:00:01 – mint az oldal kommentjeiben). Csak akkor kattintható,
  // ha az üzenet ahhoz a videóhoz íródott, amit épp nézel, és az időpont belefér a videó hosszába.
  const STAMP = /(?:(\d{1,2}):)?(\d{1,2}):(\d{2})/g;
  const videoLen = () => { const v = getVideo(); return v && isFinite(v.duration) && v.duration > 0 ? v.duration : 0; };
  function stampParts(text, vid) {
    const len = vid && VPATH && vid === vidId(VPATH) ? videoLen() : 0;
    if (!len || text.indexOf(':') < 0) return [text];
    const out = []; let last = 0, m;
    STAMP.lastIndex = 0;
    while ((m = STAMP.exec(text))) {
      const before = text[m.index - 1], after = text[m.index + m[0].length];
      if ((before && /[\d:]/.test(before)) || (after && /[\d:]/.test(after))) continue;
      const hh = m[1] == null ? 0 : +m[1], mm = +m[2], ss = +m[3];
      if (ss > 59 || (m[1] != null && mm > 59)) continue;
      const t = hh * 3600 + mm * 60 + ss;
      if (t > len) continue;
      if (m.index > last) out.push(text.slice(last, m.index));
      out.push(h('a', { class: 'ts', role: 'button', tabindex: '0', title: 'Ugrás ide: ' + fmtTime(t),
        text: m[0], onclick: e => { e.preventDefault(); jumpToStamp(t); },
        onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); jumpToStamp(t); } } }));
      last = m.index + m[0].length;
    }
    if (!out.length) return [text];
    if (last < text.length) out.push(text.slice(last));
    return out;
  }
  function jumpToStamp(t) {
    const v = getVideo();
    if (!v || !videoLen()) return;
    if (room && locked && !isHost && VPATH && sameVideo(VPATH, roomV)) { lockToast(); return; }
    v.currentTime = Math.min(t, Math.max(0, v.duration - 0.25));
  }
  function richParts(text, vid) {
    return String(text || '').split(TOKEN)
      .map((p, i) => i % 2 ? (SMILEY_SET.has(p) ? smileyImg(p) : '[s:' + p + ']') : (p === '' ? p : stampParts(p, vid)))
      .flat().filter(p => p !== '');
  }
  // Amikor kiderül a videó hossza (vagy megváltozik), az időbélyegek újraszámolódnak.
  let stampLen = 0;
  setInterval(() => {
    const len = Math.round(videoLen());
    if (len === stampLen) return;
    stampLen = len;
    const myId = vidId(VPATH);
    if (len > 0 && myId && (!vinfo[myId] || vinfo[myId].d !== len)) viSet(myId, { d: len });
    if (room && chatLog.some(x => !x.s && x.v && /\d:\d\d/.test(x.m))) { const keep = stick, top = msgsEl.scrollTop; renderChat(); if (!keep) { stick = false; msgsEl.scrollTop = top; } }
  }, 1000);
  const onlySmileys = text => !!text && String(text).search(TOKEN) >= 0 && !String(text).replace(TOKEN, '').trim() &&
    String(text).match(TOKEN).every(t => SMILEY_SET.has(t.slice(3, -1)));

  const sameSender = (a, b) => a.c && b.c ? a.c === b.c : a.n === b.n;
  const isCont = (prev, r) => !!(prev && !prev.s && !r.s && sameSender(prev, r) && r.ts && prev.ts && r.ts - prev.ts < 120000);
  function chatNode(r, cont) {
    const text = r.e && SMILEY_SET.has(r.e) ? '[s:' + r.e + ']' : r.m;
    const me = r.me || (r.c && r.c === cid);
    const tm = r.ts ? new Date(r.ts).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }) : (r.tm || '');
    return h('div', { class: 'msg' + (me ? ' me' : '') + (cont ? ' cont' : '') },
      cont ? null : h('div', { class: 'who' },
        me ? null : avatarEl(r.n, r.ui, 'xs'),
        me ? null : h('b', { title: clean(r.n), text: clean(r.n) }),
        h('span', { text: tm })),
      h('div', { class: 'bubble' + (onlySmileys(text) ? ' smiley' : ''), title: tm }, richParts(text, r.v)));
  }

  const LOG_MAX = 150, HIST_MAX = 100;
  let chatLog = [];
  const seenIds = new Set();
  // Küldőnként egyedi: egy idegen nem „foglalhatja le” más üzenetének azonosítóját, hogy az ne jelenjen meg.
  const seenKey = r => (r.c || '') + '/' + r.id;

  let saveTimer = null, saveRoom = '';
  function writeLog() {
    clearTimeout(saveTimer); saveTimer = null;
    if (!saveRoom || saveRoom !== room) return;
    const out = JSON.stringify(chatLog);
    sess.set('tcwt_chat_' + room, out);
    store.set('tcwt_chatlast_' + room, out);
  }
  function saveLog() {
    if (chatLog.length > LOG_MAX) chatLog = chatLog.slice(-LOG_MAX);
    saveRoom = room;
    if (!saveTimer) saveTimer = setTimeout(writeLog, 400);
  }
  addEventListener('pagehide', () => {
    if (saveTimer) writeLog();
    saveKnown();
    const pv = getVideo();
    if (RESUME_KEY && pv && pv.duration >= 240 && (pv.ended || pv.duration - pv.currentTime < 2)) { try { localStorage.setItem(RESUME_KEY, '0'); } catch (e) {} }
    const moving = navigating || Date.now() - navIntent < 30000;
    if (moving) sess.set('tcwt_navat', String(Date.now()));
    if (moving && bc && ownLead()) bc.postMessage({ t: 'moving', room });
    if (room && client?.connected) { leaving = true; if (moving) movingNow(); else goneNow(); }
  });
  function renderChat() {
    const from = Math.max(0, chatLog.length - 150);
    const nodes = chatLog.slice(from).map((r, i) => r.s ? sysNode(r) : chatNode(r, isCont(chatLog[from + i - 1], r)));
    msgsEl.replaceChildren(...(nodes.length ? nodes : [emptyEl]));
    stick = true;
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  function restoreChat() {
    let log = [];
    try { log = JSON.parse(sess.get('tcwt_chat_' + room) || store.get('tcwt_chatlast_' + room) || '[]'); } catch (e) {}
    chatLog = Array.isArray(log) ? log : [];
    seenIds.clear();
    chatLog.forEach(r => { if (r.id) seenIds.add(seenKey(r)); });
    saveLog();
    renderChat();
  }
  const VIDEO_MSG = 'Új videó: ';
  // Rendszerüzenet a chatben; a videóváltásnál a videó bélyegképével (csak a videó számából építve).
  // A videókártyák egyforma szélesek (szép lista lesz belőlük), látszik rajtuk az idő, és kattintásra a videó
  // új lapon nyílik meg – a szoba lapja közben marad, ahol volt.
  // Videókártya adatai: a videó oldalából (feltöltő, megtekintések, mikor töltötték fel, címkék) – mindenki maga
  // tölti le az oldalról, így nem kell küldeni, és hamisítani sem lehet. A hosszt az tudja, aki épp azt nézi.
  // A böngészőlapon belül megjegyezzük; oldalanként legfeljebb néhány lekérés (a legutóbbi kártyákhoz).
  function viSet(id, patch) {
    if (!/^\d{1,10}$/.test(id)) return;
    vinfo[id] = Object.assign({}, vinfo[id], patch, { at: Date.now() });
    const ids = Object.keys(vinfo);
    if (ids.length > VI_MAX) ids.sort((a, b) => (vinfo[a].at || 0) - (vinfo[b].at || 0)).slice(0, ids.length - VI_MAX).forEach(k => delete vinfo[k]);
    sess.set(VI_KEY, JSON.stringify(vinfo));
    refreshCards(id);
    if (inQueue(id)) renderQueue();
  }
  // Futószalag: ha egy információs sor nem fér ki, oda-vissza lassan végigfut (rámutatva megáll). Csak akkor
  // indul, ha tényleg kilóg. (A „kevesebb animáció” rendszerbeállításnál is fut: ezt kifejezetten kérték.)
  const mqObs = typeof ResizeObserver === 'function' ? new ResizeObserver(es => es.forEach(e => fitMarq(e.target))) : null;
  function fitMarq(el) {
    if (!el.isConnected) { mqObs.unobserve(el); return; }
    const w = el.clientWidth, inner = el.firstElementChild;
    if (!w || !inner) return;
    const over = Math.ceil(Math.max(inner.scrollWidth, inner.getBoundingClientRect().width) - w);
    if (over > 3) {
      el.style.setProperty('--mq', -over + 'px');
      el.style.setProperty('--mqt', (4 + over / 22).toFixed(1) + 's');
      el.classList.add('run');
    } else el.classList.remove('run');
  }
  function marq(cls, content) {
    const inner = h('span', { class: 'mqi' }, ...(Array.isArray(content) ? content : [content]));
    const el = h('div', { class: cls + ' mq', title: inner.textContent.replace(/\u2002/g, ' ') }, inner);
    if (mqObs) mqObs.observe(el);
    return el;
  }
  // A videó saját adatai a lejátszó alatti .card-sub dobozban vannak (feltöltő, megtekintés, kor); az oldalsáv
  // ajánlott videóinál is van szem-ikon és „… ezelőtt”, ezért csak ebben a dobozban keresünk.
  function parseVideoPage(html) {
    const d = typeof html === 'string' ? new DOMParser().parseFromString(html, 'text/html') : html;
    const tags = [...d.querySelectorAll('meta[property="video:tag"]')].map(m => clean(m.content || '', 30).trim()).filter(Boolean).slice(0, 5);
    const sub = d.querySelector('.content-left .card-sub') || d.querySelector('.card-sub');
    const up = sub && sub.querySelector('a[href^="/user/"] .bold');
    const eye = sub && sub.querySelector('i.fa-eye, i.bi-eye-fill');
    const vm = eye && eye.parentElement ? /(\d[\d\s.]{0,12})/.exec(eye.parentElement.textContent) : null;
    const am = sub ? /(\d{1,4}\s+(?:másodperc|perc|órá|óra|nap|hét|het|hónap|év)\S*\s+ezelőtt)/.exec(sub.textContent) : null;
    const num = sel => { const e = d.querySelector(sel); const n = e ? parseInt(e.textContent.replace(/\D/g, ''), 10) : NaN; return isFinite(n) ? n : null; };
    // Kategória: <b><a href="/videos/…">Név</a>, <a …>…</a></b> – a „Kategória nélkül” nem számít
    const cats = [];
    for (const a of d.querySelectorAll('.content-left a[href^="/videos/"], .card-sub ~ * a[href^="/videos/"]')) {
      const box = a.closest('div');
      if (!box || !/^\s*Kategóri/.test(box.textContent) || /kategoria-nelkul/.test(a.getAttribute('href'))) continue;
      const n = clean(a.textContent.replace(/^[\s.…]+/, '').trim(), 40);
      if (n && !cats.includes(n)) cats.push(n);
      if (cats.length >= 4) break;
    }
    return { ok: 1, tags, cats, u: up ? clean(up.textContent.trim(), 40) : '', views: vm ? +vm[1].replace(/\D/g, '') : null, age: am ? am[1].replace(/\s+/g, ' ') : '',
      lk: num('[id^="likes_video_"]'), dl: num('[id^="dislikes_video_"]') };
  }
  // Lekérési sor: egyszerre legfeljebb kettő, oldalanként legfeljebb 16. A chat kártyái előre kerülnek (a legújabb
  // az első, mert a chat régitől újig rajzolódik), a videósor elemei a végére. Sikertelen lekérést fél perc múlva
  // még egyszer megpróbálunk. Az épp nyitott videó adatait magából az oldalból olvassuk, letöltés nélkül.
  const viFail = new Map();
  function wantVideoInfo(id, low) {
    if (!/^\d{1,10}$/.test(id || '') || (vinfo[id] && vinfo[id].ok) || viPending.has(id)) return;
    if (id === vidId(VPATH) && document.body) {
      let r = null; try { r = parseVideoPage(document); } catch (e) {}
      if (r && (r.u || r.cats.length || r.tags.length || r.views != null)) { viSet(id, r); return; }
    }
    const f = viFail.get(id);
    if (f && (f.n >= 2 || Date.now() - f.at < 30000)) return;
    viPending.add(id);
    if (low) viWait.push(id); else viWait.unshift(id);
    viPump();
  }
  function viPump() {
    while (viActive < 2 && viWait.length && viLeft > 0) {
      const id = viWait.shift();
      viLeft--; viActive++;
      fetch(location.origin + '/video/' + id, { credentials: 'same-origin' })
        .then(r => (r.ok ? r.text() : null))
        .then(html => { if (!html) throw 0; viFail.delete(id); viSet(id, parseVideoPage(html)); })
        .catch(() => { const f = viFail.get(id) || { n: 0 }; viFail.set(id, { n: f.n + 1, at: Date.now() }); })
        .finally(() => { viPending.delete(id); viActive--; viPump(); });
    }
    if (viLeft <= 0) { viWait.forEach(id => viPending.delete(id)); viWait.length = 0; }
  }
  function refreshCards(id) {
    const keep = stick;
    msgsEl.querySelectorAll('.svid[data-vid="' + id + '"]').forEach(n => { const r = cardRec.get(n); if (r) n.replaceWith(sysNode(r)); });
    if (keep) msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  // Információs sor darabjai: szöveg, vagy [ikon, szöveg]; köztük „ · ”.
  function metaLine(parts) {
    const out = [];
    parts.filter(Boolean).forEach((p, i) => {
      if (i) out.push(' · ');
      if (Array.isArray(p)) p.forEach((q, j) => { if (j % 2) out.push(String(q)); else if (q) { if (j) out.push('\u2002'); out.push(siteIcon(q)); } });
      else out.push(p);
    });
    return out;
  }
  const siteIcon = n => { const e = icon(n); e.setAttribute('class', 'bi si'); return e; };
  const views = i => i.views != null && isFinite(i.views) ? ['site-eye', i.views.toLocaleString('hu-HU')] : null;
  function cardMeta(vid) {
    const i = vinfo[vid];
    if (!i) return null;
    const parts = [i.d > 0 ? fmtTime(i.d) : '', views(i), i.u || '', i.age || '',
      i.lk != null || i.dl != null ? ['site-up', i.lk || 0, 'site-down', i.dl || 0] : null].filter(Boolean);
    const kids = [];
    if (parts.length) kids.push(marq('smeta', metaLine(parts)));
    if (Array.isArray(i.cats) && i.cats.length) kids.push(marq('scats', i.cats.join(' · ')));
    return kids;
  }
  function sysNode(r) {
    const vid = typeof r.vid === 'string' && /^\d{1,10}$/.test(r.vid) ? r.vid : '';
    if (!vid || !r.s.startsWith(VIDEO_MSG)) return h('div', { class: 'sys', text: r.s });
    const title = r.s.slice(VIDEO_MSG.length);
    const path = videoPath(r.vp);
    const tm = r.ts ? new Date(r.ts).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }) : '';
    const img = h('img', { class: 'sthumb', alt: '', decoding: 'async', referrerpolicy: 'same-origin', src: location.origin + '/media/videos/tmb/' + vid + '/default.jpg' });
    img.addEventListener('error', () => img.remove());
    if (!(vinfo[vid] && vinfo[vid].ok)) wantVideoInfo(vid);   // a saját videónál azonnal megvan
    const meta = cardMeta(vid);
    const kids = [img, h('div', { class: 'sinfo' }, h('div', { class: 'scap', text: 'Új videó' + (tm ? ' · ' + tm : '') }), h('div', { class: 'stitle', text: title }), meta || [])];
    const node = path
      ? h('a', { class: 'sys svid', 'data-vid': vid, href: location.origin + path, target: '_blank', rel: 'noopener', title: title + ' – megnyitás új lapon' }, ...kids)
      : h('div', { class: 'sys svid', 'data-vid': vid, title }, ...kids);
    cardRec.set(node, r);
    return node;
  }
  // Az azonos fajtájú, gyorsan egymást követő rendszerüzenetek (pl. ki-be lépés) egy sorba olvadnak. A videóváltások
  // viszont mind külön maradnak, így visszanézhető, mi ment le – csak az pár mp alatt továbbléptetett videó cserélődik.
  function sysMsg(text, kind, vid, vp) {
    const last = chatLog[chatLog.length - 1], node = msgsEl.lastElementChild;
    const win = kind === 'video' ? 5000 : 60000;
    if (kind && last && last.s && last.k === kind && Date.now() - last.ts < win && node && node.classList.contains('sys')) {
      last.s = text; last.ts = Date.now();
      if (vid) last.vid = vid; else delete last.vid;
      if (vp) last.vp = vp; else delete last.vp;
      saveLog();
      const n = sysNode(last);
      n.classList.add('upd');
      node.replaceWith(n);
      return;
    }
    const rec = { s: text, ts: Date.now(), k: kind || undefined };
    if (vid) rec.vid = vid;
    if (vp) rec.vp = vp;
    chatLog.push(rec);
    saveLog();
    pushNode(sysNode(rec));
  }

  function chatRec(msg) {
    const m = msg.e && SMILEY_SET.has(msg.e) ? '[s:' + msg.e + ']' : clean(msg.m, MSG_MAX);
    if (!m.trim()) return null;
    return {
      id: typeof msg.mid === 'string' ? msg.mid.slice(0, 40) : 'x' + rand(12),
      ts: typeof msg.ts === 'number' && isFinite(msg.ts) && msg.ts > 0 ? Math.min(msg.ts, Date.now()) : Date.now(),
      c: typeof msg.c === 'string' ? msg.c.slice(0, 20) : null,
      n: cleanName(msg.n), m, ui: validUi(msg.ui),
      v: typeof msg.v === 'string' && /^\d{1,10}$/.test(msg.v) ? msg.v : undefined
    };
  }

  // w: az aláírt eredeti (ezzel együtt adjuk tovább az előzményekben, így ott sem hamisítható).
  function addChat(msg, mine, w) {
    const r = chatRec(msg);
    if (!r) return null;
    if (mine) r.c = cid;
    const k = seenKey(r);
    if (seenIds.has(k)) return null;
    seenIds.add(k);
    if (seenIds.size > 3000) { seenIds.clear(); chatLog.forEach(x => { if (x.id) seenIds.add(seenKey(x)); }); seenIds.add(k); }
    if (w) r.w = w;
    const prev = chatLog[chatLog.length - 1];
    chatLog.push(r);
    saveLog();
    pushNode(chatNode(r, isCont(prev, r)));
    floatReact(r.m, r.c || r.n, r.ts);
    if (mine) msgsEl.scrollTop = msgsEl.scrollHeight;
    else if (!panelOpen || view !== 'chat') { unread++; updateBadge(); }
    return r;
  }

  const FLOAT_MAX = 40, FLOAT_PER_MSG = 8, FLOAT_USER = 16, FLOAT_ALL = 40, FLOAT_WIN = 5000;
  const floatUser = new Map();
  let floatAll = [];
  const floatSpots = [];
  function reactionsOf(text) {
    const out = [];
    String(text || '').replace(TOKEN, (all, f) => { if (out.length < FLOAT_PER_MSG && SMILEY_SET.has(f)) out.push(f); return all; });
    return out;
  }
  function floatReact(text, who, ts) {
    if (!floatOn || !room || document.hidden || (ts && Math.abs(Date.now() - ts) > 10000)) return;
    const items = reactionsOf(text);
    if (!items.length) return;
    const now = Date.now();
    const mine = (floatUser.get(who) || []).filter(t => now - t < FLOAT_WIN);
    floatAll = floatAll.filter(t => now - t < FLOAT_WIN);
    const n = Math.min(items.length, FLOAT_USER - mine.length, FLOAT_ALL - floatAll.length);
    for (let i = 0; i < n; i++) {
      mine.push(now); floatAll.push(now);
      setTimeout(() => spawnFloat(items[i]), i * 150 + Math.random() * 120);
    }
    if (floatUser.size > 200) floatUser.clear();
    floatUser.set(who, mine);
  }
  function floatBox() {
    const v = getVideo();
    const el = (v && (v.closest('.video-js') || v.closest('.video-container'))) || v || document.querySelector('.video-container');
    const rc = el && el.getBoundingClientRect();
    if (rc && rc.width > 160 && rc.height > 100 && rc.bottom > 60 && rc.top < innerHeight - 60) {
      const top = Math.max(rc.top, 0), bottom = Math.min(rc.bottom, innerHeight);
      return { left: rc.left, top, width: rc.width, height: bottom - top };
    }
    const w = Math.min(innerWidth, 900), hh = Math.min(innerHeight, 560);
    return { left: (innerWidth - w) / 2, top: (innerHeight - hh) / 2, width: w, height: hh };
  }
  const reduceMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const smooth = x => x * x * (3 - 2 * x);
  const backOut = x => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);
  function floatSpot(b) {
    const now = performance.now();
    while (floatSpots.length && now - floatSpots[0].t > 2600) floatSpots.shift();
    let best = null, bestD = -1;
    for (let k = 0; k < 10; k++) {
      const x = b.left + b.width * (0.08 + Math.random() * 0.84);
      const y = b.top + b.height * (0.42 + Math.random() * 0.46);
      let d = Infinity;
      floatSpots.forEach(p => { d = Math.min(d, Math.hypot(p.x - x, (p.y - y) * 1.4)); });
      if (d > bestD) { bestD = d; best = { x, y }; }
    }
    floatSpots.push({ x: best.x, y: best.y, t: now });
    return best;
  }
  function floatFrames(b) {
    if (reduceMotion()) return [{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }];
    const rise = b.height * (0.28 + Math.random() * 0.24) + 40;
    const drift = (Math.random() * 2 - 1) * 36;
    const aA = 10 + Math.random() * 20, fA = 0.6 + Math.random() * 0.6, pA = Math.random() * Math.PI * 2;
    const aB = 3 + Math.random() * 6, fB = 1.6 + Math.random() * 1.4, pB = Math.random() * Math.PI * 2;
    const rot = 5 + Math.random() * 7;
    const out = [];
    for (let i = 0, N = 72; i <= N; i++) {
      const t = i / N;
      const up = 0.25 * t + 0.75 * (1 - Math.cos(Math.PI * t)) / 2;
      const x = drift * t + aA * (Math.sin(2 * Math.PI * fA * t + pA) - Math.sin(pA)) + aB * (Math.sin(2 * Math.PI * fB * t + pB) - Math.sin(pB));
      const r = rot * Math.sin(2 * Math.PI * fA * t + pA + 0.8);
      const sc = t < 0.14 ? 0.45 + 0.55 * backOut(t / 0.14) : t > 0.78 ? 1 - 0.18 * smooth((t - 0.78) / 0.22) : 1;
      const op = t < 0.1 ? smooth(t / 0.1) : t > 0.62 ? 1 - smooth((t - 0.62) / 0.38) : 1;
      out.push({ offset: t, opacity: +op.toFixed(3),
        transform: 'translate3d(' + x.toFixed(2) + 'px,' + (-rise * up).toFixed(2) + 'px,0) rotate(' + r.toFixed(2) + 'deg) scale(' + sc.toFixed(3) + ')' });
    }
    return out;
  }
  function spawnFloat(f) {
    const live = floatLayer.querySelectorAll('.float').length;
    if (!floatOn || live >= FLOAT_MAX) return;
    if (canTop && (!live || !floatLayer.matches(':popover-open'))) floatsOnTop();
    const b = floatBox();
    const size = Math.round(44 * Math.min(1.25, Math.max(0.8, b.width / 900)) * (0.9 + Math.random() * 0.2));
    const spot = floatSpot(b);
    const el = h('div', { class: 'float', 'aria-hidden': 'true' }, smileyImg(f));
    el.style.width = el.style.height = size + 'px';
    el.style.left = Math.round(spot.x - size / 2) + 'px';
    el.style.top = Math.round(spot.y - size / 2) + 'px';
    floatLayer.append(el);
    const kill = () => el.remove();
    setTimeout(kill, 8000);
    if (typeof el.animate !== 'function') { el.classList.add('css'); el.addEventListener('animationend', kill, { once: true }); return; }
    const a = el.animate(floatFrames(b), { duration: 4600 + Math.random() * 1800, easing: 'linear', fill: 'forwards' });
    a.onfinish = kill;
  }

  // Az előzmények minden üzenete a saját küldője aláírásával jön: amit más hamisított bele, kimarad.
  async function onHistory(list) {
    if (!Array.isArray(list)) return;
    const key = roomKey;
    let added = false;
    for (const w of list.slice(-HIST_MAX)) {
      if (typeof w !== 'string' || w.length > 8000) continue;
      let pre;
      try { pre = JSON.parse(w.slice(0, w.lastIndexOf('\n'))); } catch (e) { continue; }
      if (!pre || typeof pre.mid !== 'string') continue;
      if (seenIds.has(String(pre.c).slice(0, 20) + '/' + pre.mid.slice(0, 40))) { histOk = true; continue; }
      const m = await unwire(w, 'm');
      if (key !== roomKey) return;
      if (!m || m.k !== 'chat' || m.c !== m._s || isBanned(m._s, m.n, false)) continue;
      const r = chatRec(m);
      if (!r || seenIds.has(seenKey(r))) continue;
      seenIds.add(seenKey(r));
      r.w = w;
      chatLog.push(r);
      added = histOk = true;
    }
    if (!added) return;
    chatLog.sort((a, b) => (a.ts || 0) - (b.ts || 0));
    saveLog();
    renderChat();
  }

  const histList = () => chatLog.filter(r => !r.s && r.w).slice(-HIST_MAX).map(r => r.w);
  function publishHistory() {
    publish('h', { id: sid, list: histList() }, true);
  }

  const histTimers = new Map();
  let histAnswered = 0, histOk = false;
  function onHistReq(from) {
    if (!chatLog.some(r => !r.s && r.w) || histTimers.has(from) || histTimers.size >= 3 || Date.now() - histAnswered < 2000) return;
    histAnswered = Date.now();
    histTimers.set(from, setTimeout(() => {
      histTimers.delete(from);
      publish('m', { id: sid, k: 'hist', to: from, list: histList() });
      publishHistory();
    }, 150 + Math.random() * 1200));
  }
  function onHist(m) {
    const t = histTimers.get(m.to);
    if (t) { clearTimeout(t); histTimers.delete(m.to); }
    if (m.to === sid) onHistory(m.list).catch(() => {});
  }

  function sendChat() {
    const text = codesToSmileys(serialize(inputEl).replace(/\u00a0/g, ' ').trim()).slice(0, MSG_MAX);
    if (!text || !room) return;
    const now = Date.now();
    sendTimes = sendTimes.filter(t => now - t < 4000);
    if (sendTimes.length >= 5) { inputEl.classList.remove('slow'); void inputEl.offsetWidth; inputEl.classList.add('slow'); return; }
    sendTimes.push(now);
    const msg = { id: sid, c: cid, k: 'chat', mid: 'm' + rand(10) + Date.now().toString(36), ts: Date.now(), n: shown(), ui: myUi, m: text, v: vidId(roomV) || undefined };
    const rec = addChat(msg, true);
    publish('m', msg, false, w => { if (rec) { rec.w = w; saveLog(); } });
    clearTimeout(histPubTimer);
    histPubTimer = setTimeout(publishHistory, 2500);
    inputEl.replaceChildren();
    savedRange = null;
  }

  const TEXT_MAX = 300, SMILEY_MAX = 30, MSG_MAX = 1500;
  let sendTimes = [], histPubTimer = null;
  let savedRange = null;
  const getSel = () => (shadow.getSelection ? shadow.getSelection() : document.getSelection());
  function serialize(node) {
    let out = '';
    node.childNodes.forEach(n => {
      if (n.nodeType === 3) out += n.nodeValue;
      else if (n.nodeName === 'IMG') { if (SMILEY_SET.has(n.dataset.s)) out += '[s:' + n.dataset.s + ']'; }
      else if (n.nodeName === 'BR') out += '\n';
      else { if (out && /^(DIV|P)$/.test(n.nodeName)) out += '\n'; out += serialize(n); }
    });
    return out;
  }
  function saveRange() {
    const s = getSel();
    if (s?.rangeCount && inputEl.contains(s.getRangeAt(0).startContainer)) savedRange = s.getRangeAt(0).cloneRange();
  }
  ['keyup', 'mouseup', 'input', 'focus'].forEach(ev => inputEl.addEventListener(ev, saveRange));

  function insertSmiley(f) {
    if (!SMILEY_SET.has(f) || inputEl.querySelectorAll('img').length >= SMILEY_MAX) return;
    const img = smileyImg(f);
    img.dataset.s = f;
    let r = savedRange && inputEl.contains(savedRange.startContainer) ? savedRange : null;
    if (!r) { r = document.createRange(); r.selectNodeContents(inputEl); r.collapse(false); }
    r.deleteContents();
    r.insertNode(img);
    r.setStartAfter(img);
    r.collapse(true);
    if (!isMobile()) inputEl.focus({ preventScroll: true });
    const s = getSel();
    if (s) { s.removeAllRanges(); s.addRange(r); }
    savedRange = r.cloneRange();
    inputEl.scrollTop = inputEl.scrollHeight;
  }

  // Szöveg beszúrása a chat beviteli mezőjébe a kurzorhoz (vagy a végére).
  function insertChatText(text) {
    let r = savedRange && inputEl.contains(savedRange.startContainer) ? savedRange : null;
    if (!r) { r = document.createRange(); r.selectNodeContents(inputEl); r.collapse(false); }
    const tn = document.createTextNode(text);
    r.deleteContents();
    r.insertNode(tn);
    r.setStartAfter(tn);
    r.collapse(true);
    inputEl.focus({ preventScroll: true });
    const s = getSel();
    if (s) { s.removeAllRanges(); s.addRange(r); }
    savedRange = r.cloneRange();
  }
  // Az oldal jobb-kattintós lejátszó-menüjébe (Ismétlés, Link másolása…) egy saját pont: az aktuális időpontot
  // beírja a chatbe, a többieknél ez kattintható időbélyeg lesz. Csak szobában, a szoba videóján látszik.
  const onRoomVideoNow = () => !!(room && VPATH && roomV && sameVideo(VPATH, roomV));
  function stampToChat() {
    const v = getVideo();
    if (!v || !onRoomVideoNow()) return;
    togglePanel(true);
    setView('chat');
    const cur = inputEl.textContent;
    insertChatText((cur && !/\s$/.test(cur) ? ' ' : '') + fmtTime(v.currentTime) + ' ');
  }
  function addMenuItem() {
    const ul = document.querySelector('.custom-menu ul');
    if (!ul || ul.querySelector('.t2g-mi')) return;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('height', '24'); svg.setAttribute('width', '24'); svg.setAttribute('viewBox', '0 -960 960 960');
    const path = document.createElementNS(NS, 'path');
    // Material Symbols „chat” (Apache 2.0)
    path.setAttribute('d', 'M240-400h320v-80H240v80Zm0-120h480v-80H240v80Zm0-120h480v-80H240v80ZM80-80v-720q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H240L80-80Zm126-240h594v-480H160v525l46-45Zm-46 0v-480 480Z');
    path.setAttribute('fill', 'currentColor');
    svg.append(path);
    const li = document.createElement('li');
    li.className = 't2g-mi';
    li.append(svg, document.createTextNode(' Időpont a chatbe'));
    li.style.display = 'none';
    li.addEventListener('click', stampToChat);
    ul.append(li);
    const vc = document.querySelector('.video-container');
    if (vc) vc.addEventListener('contextmenu', () => { li.style.display = onRoomVideoNow() ? '' : 'none'; }, true);
  }

  inputEl.addEventListener('paste', e => {
    e.preventDefault();
    const left = TEXT_MAX - inputEl.textContent.length;
    const t = (e.clipboardData ? e.clipboardData.getData('text/plain') : '').replace(/\s+/g, ' ').slice(0, Math.max(0, left));
    if (!t) return;
    let ok = false;
    try { ok = document.execCommand('insertText', false, t); } catch (err) {}
    if (!ok) {
      const node = document.createTextNode(t);
      const sel = getSel();
      const rg = sel && sel.rangeCount && inputEl.contains(sel.getRangeAt(0).startContainer) ? sel.getRangeAt(0) : null;
      if (rg) { rg.deleteContents(); rg.insertNode(node); rg.setStartAfter(node); rg.collapse(true); sel.removeAllRanges(); sel.addRange(rg); }
      else inputEl.append(node);
      saveRange();
    }
  });
  inputEl.addEventListener('beforeinput', e => {
    if (/^insert(Text|ReplacementText|CompositionText)$/.test(e.inputType) && inputEl.textContent.length >= TEXT_MAX) e.preventDefault();
    if (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') { e.preventDefault(); sendChat(); }
  });
  inputEl.addEventListener('input', () => { if (!inputEl.textContent && !inputEl.querySelector('img')) inputEl.replaceChildren(); });

  function askName() {
    if (acct) return;
    const input = h('input', { class: 'field', placeholder: 'Becenév', autocomplete: 'off', maxlength: '40' });
    input.value = name;
    const tidyName = () => { const v = nameChars(input.value); if (v !== input.value) input.value = v; };
    input.addEventListener('input', e => { if (!e.isComposing) tidyName(); });
    input.addEventListener('compositionend', tidyName);
    const overlay = h('div', { class: 'overlay' });
    const ok = () => {
      const v = nameChars(input.value).replace(/\s+/g, ' ').trim();
      if (!v || v === '?') { input.focus(); return; }
      name = v;
      store.set('tcwt_name', v);
      overlay.remove();
      refreshName();
      if (room) { roomName = ''; recomputeName(); announce(); renderMembers(); }
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
    overlay.append(h('div', { class: 'box' },
      (() => { const l = h('div', { class: 'dlg-logo' }); l.innerHTML = LOGO_SVG; return l; })(),
      h('div', { class: 'dlg-body' },
        h('div', { class: 'dlg-title', text: 'Hogy hívjanak?' }),
        h('div', { class: 'muted', text: 'Ezen a néven látnak. Ha foglalt, kapsz mellé egy számot. Bejelentkezve a fiókneved lesz.' }),
        input,
        h('div', { class: 'row' },
          name ? btn('btn sec', 'x-lg', 'Mégse', { onclick: () => overlay.remove() }) : null,
          btn('btn', 'check-lg', 'Tovább', { onclick: ok })))));
    rootEl.append(overlay);
    setTimeout(() => input.focus(), 50);
  }
  function refreshName() {
    greetText.textContent = 'Szia' + (name ? ', ' + name : '') + '!';
    const av = avatarEl(name || '?', myUi, 'lg');
    greetAv.replaceWith(av);
    greetAv = av;
    renameBtn1.style.display = renameBtn2.style.display = acct ? 'none' : '';
    acctEl.textContent = acct
      ? 'Trash City-s fiók'
      : 'Vendég fiók';
  }

  const inviteCode = (c => validCode(c) ? c : '')((location.hash.match(/tcwt=([a-z0-9]+)/i)?.[1] || '').toLowerCase());

  // ---------- Automatikus lejátszás: következő videó gomb és kapcsoló az oldal lejátszóján (mint a YouTube-on).
  // A következő videó az oldal „kapcsolódó videók” listájának első eleme. Szobában csak a host válthat;
  // a nézőket úgyis a host videója viszi tovább.
  (function autoNextInit() {
    if (!VPATH) return;
    const AP_KEY = 'tcwt_autonext', WAIT_S = 5;
    const isOn = () => store.get(AP_KEY) === '1';
    const canSwitch = () => !room || (isHost && isLead());
    // a közös sorból a hostnál akkor is jön a következő, ha az automatikus lejátszás ki van kapcsolva
    const wantsNext = () => isOn() || !!(room && isHost && queue.some(x => x.id !== vidId(VPATH)));
    // Az ezen a lapon már látott videók (legrégebbi elöl). Enélkül két videó egymást ajánlotta volna első helyen,
    // és az automatikus lejátszás a végtelenségig ezek között ugrált volna.
    const SEEN_KEY = 'tcwt_seen';
    const seenList = () => { try { const a = JSON.parse(sess.get(SEEN_KEY) || '[]'); return Array.isArray(a) ? a.filter(x => typeof x === 'string').slice(-60) : []; } catch (e) { return []; } };
    { const cur = vidId(VPATH), a = seenList().filter(x => x !== cur); a.push(cur); sess.set(SEEN_KEY, JSON.stringify(a.slice(-60))); }
    function nextVideo() {
      const cur = vidId(VPATH), seen = seenList(), got = new Set();
      // szobában a közös sor az első
      const fromQ = room && queue.find(x => x.id !== cur);
      if (fromQ) return { p: fromQ.p, id: fromQ.id, title: fromQ.t, q: true };
      let best = null, bestRank = Infinity;
      for (const a of document.querySelectorAll('.related-video a[href*="/video/"]')) {
        let u; try { u = new URL(a.href, location.href); } catch (e) { continue; }
        const p = u.origin === location.origin ? videoPath(u.pathname) : null;
        const id = p && vidId(p);
        if (!id || id === cur || got.has(id)) continue;
        got.add(id);
        const rank = seen.indexOf(id);               // -1: még nem láttuk; különben minél régebben, annál jobb
        if (rank >= bestRank) continue;
        const box = a.closest('.related-video');
        const t = box && [...box.querySelectorAll('.content-info a')].map(x => x.textContent.replace(/\s+/g, ' ').trim()).find(Boolean);
        best = { p, id, title: cut(t || 'Következő videó', TITLE_MAX) };
        bestRank = rank;
        if (rank < 0) break;
      }
      return best;
    }
    const svg = (vb, d) => {
      const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      s.setAttribute('viewBox', vb); s.setAttribute('aria-hidden', 'true');
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('fill', 'currentColor'); p.setAttribute('d', d);
      s.appendChild(p); return s;
    };
    const PLAY = 'M8 5v14l11-7z', PAUSE = 'M6 5h4v14H6zm8 0h4v14h-4z';
    let nextBtn = null, apBtn = null, apKnob = null, apTip = null, card = null, timer = null, fitted = null;

    // Biztonsági fék: ha háromszor egymás után úgy ugrott tovább, hogy a videóból 2 mp-nél kevesebb ment le ezen
    // az oldalon (vagyis senki nem nézte), nem indul újabb visszaszámlálás – a kártya ott marad, kattintásra megy tovább.
    const FAST_KEY = 'tcwt_apfast';
    const fastHops = () => +(sess.get(FAST_KEY) || 0) || 0;
    let played = 0, lastPT = -1;
    function go(auto) {
      const n = nextVideo();
      if (!n) return;
      if (!canSwitch()) { showToast([icon('lock-fill'), h('span', { text: ' Szobában csak a host válthat videót' })], 2200, ''); return; }
      stop();
      markNav();
      sess.set(FAST_KEY, String(auto && played < 2 ? fastHops() + 1 : 0));
      // Az automatikus váltás is új bejegyzés: a Vissza gombbal az előző videóra lehet lapozni.
      location.href = location.origin + n.p;
    }
    function stop() {
      clearInterval(timer); timer = null;
      if (card) { card.remove(); card = null; }
    }
    function countdown() {
      const vc = document.querySelector('.video-container'), n = nextVideo();
      if (!vc || !n || card || !wantsNext() || !canSwitch()) return;
      const braked = fastHops() >= 3 && played < 2;
      const until = Date.now() + WAIT_S * 1000;
      const capBase = n.q ? 'Következő a sorból' : 'Következő videó';
      const cap = h('div', { class: 't2g-ncap', text: braked ? capBase : capBase + ' ' + WAIT_S + ' mp múlva' });
      const img = h('img', { class: 't2g-nimg', alt: '', src: location.origin + '/media/videos/tmb/' + n.id + '/default.jpg' });
      img.addEventListener('error', () => img.remove());
      card = h('div', { class: 't2g-next' },
        cap, img, h('div', { class: 't2g-ntitle', text: n.title }),
        h('div', { class: 't2g-nrow' },
          h('button', { type: 'button', class: 't2g-nbtn', text: 'Mégse', onclick: e => { e.stopPropagation(); stop(); } }),
          h('button', { type: 'button', class: 't2g-nbtn t2g-ngo', text: 'Lejátszás most', onclick: e => { e.stopPropagation(); go(); } })));
      card.addEventListener('click', e => e.stopPropagation());
      vc.appendChild(card);
      if (braked) return;
      timer = setInterval(() => {
        const v = getVideo();
        if (!wantsNext() || !canSwitch() || !v || !v.ended) { stop(); return; }
        const left = Math.ceil((until - Date.now()) / 1000);
        if (left <= 0) { go(true); return; }
        cap.textContent = capBase + ' ' + left + ' mp múlva';
      }, 1000);
    }
    const refocus = () => { const pb = document.querySelector('.video-container .play-pause-btn'); if (pb) pb.focus({ preventScroll: true }); };
    function paint() {
      if (!apBtn) return;
      const on = isOn();
      apBtn.classList.toggle('on', on);
      apBtn.setAttribute('aria-checked', String(on));
      apKnob.replaceChildren(svg('0 0 24 24', on ? PLAY : PAUSE));
      apTip.textContent = 'Automatikus lejátszás: ' + (on ? 'be' : 'ki');
    }
    function build() {
      const ctr = document.querySelector('.video-container .controls');
      if (!ctr || ctr.querySelector('.t2g-ap')) return !!ctr;
      if (!document.getElementById('t2g-ap-css')) {
        const st = document.createElement('style');
        st.id = 't2g-ap-css';
        st.textContent = `
.video-controls-container .controls button.t2g-ap{position:relative;width:40px;display:flex;align-items:center;justify-content:center;flex:none}
.video-controls-container .controls button.t2g-nx{position:relative;flex:none}
.t2g-nx svg{width:26px;height:26px;display:block;margin:auto}
.t2g-track{position:relative;display:block;width:36px;height:14px;border-radius:7px;background:rgba(255,255,255,.3);transition:background-color .15s}
.t2g-knob{position:absolute;top:-3px;left:0;width:20px;height:20px;border-radius:50%;background:#909090;color:#fff;display:flex;align-items:center;justify-content:center;transition:transform .15s,background-color .15s}
.t2g-knob svg{width:14px;height:14px;display:block}
.t2g-ap.on .t2g-knob{transform:translateX(16px);background:#fff;color:#111}
.t2g-tip{position:absolute;bottom:calc(100% + 14px);left:50%;transform:translateX(-50%);background:#000;color:#fff;padding:2px 7px;font:14px/1.4 sans-serif;border-radius:4px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .2s}
.t2g-ap:hover .t2g-tip,.t2g-nx:hover .t2g-tip,.t2g-ap:focus-visible .t2g-tip{opacity:1}
.t2g-next{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);z-index:5;width:min(300px,80%);padding:12px;border-radius:10px;background:rgba(15,15,15,.92);color:#fff;font:14px/1.35 "Noto Sans",system-ui,sans-serif;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.6);cursor:default}
.t2g-ncap{color:#bbb;font-size:13px;margin-bottom:8px}
.t2g-nimg{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:6px;background:#222}
.t2g-ntitle{font-weight:700;margin:8px 0 10px;overflow:hidden;overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2}
.t2g-nrow{display:flex;gap:8px}
.t2g-nbtn{flex:1;border:0;border-radius:6px;padding:8px 6px;font:700 13px/1.2 inherit;font-family:inherit;color:#fff;background:rgba(255,255,255,.16);cursor:pointer}
.t2g-nbtn:hover{background:rgba(255,255,255,.26)}
.t2g-ngo{background:#2c90ff}.t2g-ngo:hover{background:#4aa0ff}
.video-container.t2g-narrow .t2g-nx{display:none!important}
.video-container.t2g-narrow .video-controls-container .controls{gap:10px}
.video-container.t2g-tiny .video-controls-container .controls{gap:5px}
.video-container.t2g-narrow .video-controls-container .controls button.t2g-ap{width:30px}
.video-container.t2g-narrow .t2g-track{width:28px}
.video-container.t2g-narrow .t2g-knob{width:18px;height:18px;top:-2px}
.video-container.t2g-narrow .t2g-ap.on .t2g-knob{transform:translateX(10px)}
@media (max-height:420px){.t2g-nimg{display:none}}`;
        document.head.appendChild(st);
      }
      nextBtn = h('button', { type: 'button', class: 't2g-nx', 'aria-label': 'Következő videó', onclick: e => { e.stopPropagation(); refocus(); go(); } },
        svg('0 0 24 24', 'M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z'), h('span', { class: 't2g-tip', text: 'Következő videó' }));
      apKnob = h('span', { class: 't2g-knob' });
      apTip = h('span', { class: 't2g-tip' });
      apBtn = h('button', { type: 'button', class: 't2g-ap', role: 'switch', 'aria-label': 'Automatikus lejátszás',
        onclick: e => { e.stopPropagation(); refocus(); store.set(AP_KEY, isOn() ? '0' : '1'); paint(); if (!isOn()) stop(); else { const v = getVideo(); if (v && v.ended) countdown(); } } },
        h('span', { class: 't2g-track' }, apKnob), apTip);
      const play = ctr.querySelector('.play-pause-btn');
      if (play) play.after(nextBtn); else ctr.prepend(nextBtn);
      const right = ctr.querySelector('.captions-btn') || ctr.querySelector('.speed-btn') || ctr.querySelector('.full-screen-btn');
      if (right) right.before(apBtn); else ctr.append(apBtn);
      nextBtn.style.display = nextVideo() ? '' : 'none';
      paint();
      const vc = ctr.closest('.video-container');
      const fit = () => { const w = vc.getBoundingClientRect().width; vc.classList.toggle('t2g-narrow', w < 420); vc.classList.toggle('t2g-tiny', w < 330); };
      fit();
      if (vc !== fitted) {
        fitted = vc;
        if (typeof ResizeObserver === 'function') new ResizeObserver(fit).observe(vc);
        else addEventListener('resize', fit);
      }
      return true;
    }
    let hookedV = null;
    function watch() {
      const v = getVideo();
      if (!v || v === hookedV) return;
      hookedV = v;
      v.addEventListener('ended', () => setTimeout(countdown, 300));
      v.addEventListener('timeupdate', () => {
        const t = v.currentTime;
        if (!v.paused && !v.seeking && lastPT >= 0 && t > lastPT && t - lastPT < 1.5) played += t - lastPT;
        lastPT = t;
      });
      v.addEventListener('seeking', () => { lastPT = -1; });
      ['play', 'seeking'].forEach(ev => v.addEventListener(ev, stop));
    }
    let tries = 0;
    const iv = setInterval(() => { watch(); if ((build() && hookedV) || ++tries > 40) clearInterval(iv); }, 500);
    build(); watch();
    addEventListener('storage', e => { if (e.key === AP_KEY) { paint(); if (!isOn()) stop(); } });
  })();

  (async function init() {
    setLive(false);
    refreshName();
    let saved = sess.get('tcwt_room');
    if (!saved) {
      const act = readJSON('tcwt_active');
      if (act && act.code && Date.now() - act.ts < ACTIVE_MS) saved = act.code;
    }
    if (saved && /^[a-z0-9]{4,12}$/.test(saved)) deriveRoom(saved).catch(() => {});
    acct = await getAccount();
    await tabReady;
    myUi = acct ? acct.ui : null;
    if (acct) name = acct.name;
    refreshName();
    if (saved && (!inviteCode || inviteCode === saved)) { if (name) connect(saved); return; }
    if (inviteCode) togglePanel(true);
    if (!name) askName();
  })();
})();
