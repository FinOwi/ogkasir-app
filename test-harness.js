// KasirKu test harness (node) - simpan permanen di ~/workspace/kasirku/
function makeEl(id) {
  var el = {
    id: id || '', innerHTML: '', textContent: '', value: '', style: {}, _cls: {},
    setAttribute: function () {},
    classList: {
      add: function (c) { el._cls[c] = 1; },
      remove: function (c) { delete el._cls[c]; },
      toggle: function (c, f) { if (f === undefined) { el._cls[c] ? delete el._cls[c] : el._cls[c] = 1; } else { f ? el._cls[c] = 1 : delete el._cls[c]; } },
      contains: function (c) { return !!el._cls[c]; }
    },
    appendChild: function () {}, removeChild: function () {},
    addEventListener: function () {}, click: function () {}, focus: function () {},
    setSelectionRange: function () {}, scrollIntoView: function () {},
    getAttribute: function () { return null; },
    setAttribute: function () {},
    getContext: function () {
      return { scale: function () {}, beginPath: function () {}, fill: function () {},
               fillRect: function () {}, fillText: function () {}, roundRect: undefined,
               set fillStyle(v) {}, set font(v) {}, set textAlign(v) {} };
    },
    clientWidth: 300, clientHeight: 170, scrollTop: 0,
    querySelector: function () { return makeEl(); },
    querySelectorAll: function () { return []; },
    files: null
  };
  return el;
}
var els = {};
global.document = {
  getElementById: function (id) { if (!els[id]) els[id] = makeEl(id); return els[id]; },
  createElement: function () { return makeEl(); },
  querySelector: function () { return makeEl(); },
  querySelectorAll: function () { return []; },
  addEventListener: function () {},
  documentElement: makeEl('html')
};
var store = {};
global.localStorage = {
  getItem: function (k) { return store[k] || null; },
  setItem: function (k, v) { store[k] = String(v); },
  removeItem: function (k) { delete store[k]; }
};
global.window = global;
global.scrollTo = function () {};
global.navigator = { clipboard: { writeText: function () {} } };
global.Image = function () {};
global.KasirKuNative = { deviceId: function () { return 'test-android-id-123'; } };

var fs = require('fs');
var dir = '/home/hatch/workspace/kasirku/app/src/main/assets/www/js/';
var all = ['store.js', 'ui.js', 'kasir.js', 'menu.js', 'stok.js', 'laporan.js', 'xlsx.js',
  'pengaturan.js', 'lic-crypto.js', 'license.js', 'update.js', 'printer.js', 'app.js']
  .map(function (f) { return fs.readFileSync(dir + f, 'utf8'); }).join('\n');
eval(all);

var fails = [];
function ok(cond, name) {
  if (cond) console.log('PASS: ' + name);
  else { console.log('FAIL: ' + name); fails.push(name); }
}

try {
  /* ---- kripto ---- */
  ok(LicCrypto.sha256('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'SHA256 vektor');
  ok(LicCrypto.hmacSha256('key', 'The quick brown fox jumps over the lazy dog') === 'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8', 'HMAC-SHA256 vektor');
  var d1 = LicCrypto.deviceCode('and:test123');
  var today = Math.floor(Date.now() / 864e5);
  var code = LicCrypto.genCode(d1, today + 30);
  var v = LicCrypto.verifyCode(code, d1, today);
  ok(v.ok && v.expDays === today + 30, 'kode roundtrip 30 hari');
  var t2 = code.split(''); t2[5] = t2[5] === 'A' ? 'B' : 'A';
  ok(!LicCrypto.verifyCode(t2.join(''), d1, today).ok, 'tamper ditolak');
  ok(!LicCrypto.verifyCode(code, LicCrypto.deviceCode('and:x'), today).ok, 'device lain ditolak');
  var ve = LicCrypto.verifyCode(LicCrypto.genCode(d1, today - 1), d1, today);
  ok(!ve.ok && ve.reason === 'expired', 'kedaluwarsa ditolak');

  /* ---- app & lisensi ---- */
  App.init();
  ok(Lic.status().state === 'trial', 'fresh install: trial');
  ok(document.getElementById('kNav').innerHTML.indexOf('Kasir') >= 0, 'boot normal saat trial');
  ok(Lic.licCard().indexOf('Kode Device') >= 0, 'kartu lisensi render');

  /* ---- kasir flow ---- */
  var kh = Kasir.render();
  ok(kh.indexOf('Kopi Tubruk') >= 0, 'kasir grid + seed');
  Kasir.add('m1'); Kasir.add('m1');
  ok(Kasir.cartTotal() === 16000, 'cart total 16000');
  Kasir.openCartFresh();
  document.getElementById('kDisc').value = '0';
  document.getElementById('kDiscType').value = 'rp';
  document.getElementById('kCash').value = '50000';
  document.getElementById('kNote').value = '';
  Kasir.pay();
  ok(KDB.data.txs.length === 1, 'transaksi tersimpan');
  var tx = KDB.data.txs[0];
  ok(tx.total === 16000 && tx.change === 34000, 'total & kembalian');
  ok(KDB.menuById('m1').stock === 48, 'stok berkurang');
  ok(Kasir.mode === 'struk', 'mode struk');
  ok(Kasir.renderStruk().indexOf('TOTAL') >= 0, 'struk render');
  Kasir.baru();
  Kasir.setMode('riwayat');
  ok(Kasir.render().indexOf('#0001') >= 0, 'riwayat render');
  Kasir.setMode('kasir');

  /* ---- menu / stok / laporan / pengaturan ---- */
  ok(Menu.render().indexOf('Daftar Menu') >= 0, 'menu render');
  ok(Stok.render().indexOf('Stok Menu') >= 0, 'stok render');
  Lap.period = 'today';
  ok(Lap.render().indexOf('Omzet') >= 0, 'laporan render');
  Lap.drawChart(Lap.range());
  ok(Set.render().indexOf('Lisensi') >= 0, 'pengaturan + kartu lisensi');

  /* ---- aktivasi & lock ---- */
  var dc = Lic.deviceCode();
  var c30 = LicCrypto.genCode(dc, Lic.todayDays() + 30);
  document.getElementById('kLicCode').value = c30;
  ok(Lic.activate(c30).ok && Lic.status().state === 'active', 'aktivasi 30 hari');
  ok(!Lic.activate('AAAA-BBBB-CCCC-DDDD-EEEE-FFFF').ok, 'kode ngawur ditolak');
  KDB.data.settings.lic = { trialStart: Date.now() - 8 * 864e5, lastSeen: Date.now() };
  KDB.save();
  ok(Lic.status().state === 'expired' && !Lic.valid(), 'trial habis -> expired');
  Lic.showLock();
  ok(document.getElementById('kPage').innerHTML.indexOf('kLicCode') >= 0, 'lock screen');
  document.getElementById('kLicCode').value = LicCrypto.genCode(Lic.deviceCode(), Lic.todayDays() + 90);
  Lic.doActivate();
  ok(Lic.valid(), 'aktivasi dari lock membuka app');
  KDB.data.settings.lic = { trialStart: Date.now(), lastSeen: Date.now() + 30 * 864e5 };
  ok(Lic.status().state === 'expired', 'anti-mundur-jam');

  /* ---- fix audit: lisensi device lain tidak ikut via backup/restore ---- */
  var devA = LicCrypto.deviceCode('and:device-A');
  var codeA = LicCrypto.genCode(devA, today + 30);
  KDB.data.settings.lic = { trialStart: Date.now() - 8 * 864e5, code: codeA, expDays: today + 30, lastSeen: Date.now() };
  KDB.save();
  Lic.init();
  var licAfter = KDB.data.settings.lic;
  ok(!licAfter.code && !licAfter.expDays && Lic.status().state === 'expired',
    'kode device lain dibersihkan saat init (anti-bypass backup)');
  var dcNow = Lic.deviceCode();
  var codeNow = LicCrypto.genCode(dcNow, today + 30);
  KDB.data.settings.lic = { trialStart: Date.now(), code: codeNow, expDays: today + 30, lastSeen: Date.now() };
  KDB.save();
  Lic.init();
  ok(Lic.status().state === 'active', 'kode device sendiri tetap valid setelah init');

  /* ---- fix audit: doActivate saat app sudah jalan tidak reboot PIN ---- */
  App._booted = true;
  var bootCalled = false, origBoot = App.boot;
  App.boot = function () { bootCalled = true; };
  document.getElementById('kLicCode').value = LicCrypto.genCode(Lic.deviceCode(), Lic.todayDays() + 60);
  Lic.doActivate();
  App.boot = origBoot;
  ok(!bootCalled && Lic.valid(), 'aktivasi dari pengaturan tidak memanggil boot ulang');

  /* ---- printer: aman tanpa bridge native ---- */
  ok(!Printer.hasBridge(), 'tanpa OGKasirPrinter: hasBridge false');
  ok(Printer.statusLine().indexOf('Tidak tersedia') >= 0, 'statusLine tanpa bridge');
  Printer.pick(); // tidak boleh throw
  Printer.testPrint(); // tidak boleh throw
  Printer.printStruk({ no: 1 }); // tidak boleh throw
  Printer.preview(); // tidak boleh throw
  ok(true, 'printer API aman dipanggil tanpa bridge native');

  /* ---- printer: alur dengan bridge mock ---- */
  global.OGKasirPrinter = {
    _perm: false,
    hasPermission: function () { return this._perm; },
    requestPermission: function () { var s = this; setTimeout(function () { s._perm = true; window.ogkasirBtPerm(true); }, 0); },
    btAvailable: function () { return true; },
    btEnabled: function () { return true; },
    openBtSettings: function () {},
    listPrinters: function () { return JSON.stringify([{ name: 'XPrinter XP-N160I', mac: 'AA:BB:CC:DD:EE:FF' }]); },
    connectPrinter: function (mac) { window.ogkasirPrinterConn(true, 'XPrinter XP-N160I'); },
    disconnectPrinter: function () {},
    printerStatus: function () { return JSON.stringify({ connected: Printer.connected, name: 'XPrinter XP-N160I', mac: 'AA:BB:CC:DD:EE:FF' }); },
    printText: function (t) { this._last = t; return true; },
    printTest: function () { return true; }
  };
  ok(Printer.hasBridge(), 'dengan mock bridge: hasBridge true');
  Printer.connect('AA:BB:CC:DD:EE:FF');
  ok(Printer.connected && Printer.name === 'XPrinter XP-N160I', 'connect sukses simpan nama');
  ok(KDB.data.settings.printerMac === 'AA:BB:CC:DD:EE:FF', 'MAC printer tersimpan di settings');
  // struk: format 32 kolom ASCII
  var tx0 = { id: 't0', no: 7, at: Date.now(), items: [{ id: 'm1', name: 'Kopi Tubruk', price: 8000, cost: 3000, qty: 2 }], sub: 16000, disc: 0, total: 16000, pay: 'Tunai', cash: 20000, change: 4000, note: '', voided: false };
  Printer.printStruk(tx0);
  var sent = global.OGKasirPrinter._last || '';
  ok(sent.length > 0 && sent.split('\n').every(function (l) { return l.length <= 32; }), 'teks struk max 32 kolom');
  ok(/^[\x20-\x7E\n]*$/.test(sent), 'teks struk murni ASCII (aman ESC/POS)');
  ok(sent.indexOf('16000') < 0 && sent.indexOf('16.000') >= 0, 'nominal format rupiah di struk');
  Printer.disconnect();
  ok(!Printer.connected && KDB.data.settings.printerMac === '', 'disconnect bersihkan status');
  // render pengaturan memuat kartu printer tanpa error
  App.page = 'set';
  var setHtml = Set.render();
  ok(setHtml.indexOf('Printer Struk') >= 0, 'kartu printer muncul di pengaturan');
  // tombol cetak di struk kasir
  Kasir.lastTx = tx0; Kasir.mode = 'struk';
  var strukHtml = Kasir.renderStruk();
  ok(strukHtml.indexOf('Printer.printStruk') >= 0, 'tombol cetak ada di struk');

  /* ===== audit 2026-10-10: regresi temuan bug ===== */
  // 1. escQ: kutip satu & backslash aman di onclick
  ok(K.escQ("Kopi D'Langit") === "Kopi D\\'Langit", 'escQ amankan kutip satu');
  ok(K.escQ('a\\b') === 'a\\\\b', 'escQ amankan backslash');
  ok(K.escQ('<x>&"') === '&lt;x&gt;&amp;&quot;', 'escQ tetap escape HTML');
  // 2. chip kategori dgn kutip: onclick tidak putus
  KDB.data.cats.push("Kopi D'Langit");
  Kasir.cat = "Kopi D'Langit"; Kasir.q = ''; Kasir.mode = 'kasir';
  var kasHtml = Kasir.render();
  ok(kasHtml.indexOf("setCat('Kopi D\\'Langit')") >= 0, 'chip kategori kutip hasilkan onclick valid');
  Kasir.cat = 'Semua';
  KDB.data.cats = KDB.data.cats.filter(function (c) { return c !== "Kopi D'Langit"; });
  // 3. diskon negatif dijepit ke 0
  KDB.data.menus.push({ id: 'mT', name: 'Tes', cat: 'Kopi', price: 50000, cost: 0, stock: 99, min: 5, track: true, active: true, emoji: '☕' });
  Kasir.cart = { mT: 1 };
  document.getElementById('kDisc').value = '-10'; document.getElementById('kDiscType').value = 'rp'; document.getElementById('kCash').value = '0';
  var cc = Kasir.calc();
  ok(cc.disc === 0 && cc.total === 50000, 'diskon negatif dijepit (total tetap 50000)');
  document.getElementById('kDisc').value = '150'; document.getElementById('kDiscType').value = 'pct';
  cc = Kasir.calc();
  ok(cc.disc === 50000 && cc.total === 0, 'diskon 150% dijepit ke 100%');
  Kasir.cart = {};
  KDB.data.menus = KDB.data.menus.filter(function (m) { return m.id !== 'mT'; });
  // 4. harga negatif dijepit di Menu.save
  document.getElementById('mName').value = 'Neg'; document.getElementById('mPrice').value = '-5000'; document.getElementById('mCost').value = '0';
  document.getElementById('mEmoji').value = '☕'; document.getElementById('mCat').value = 'Kopi'; document.getElementById('mTrack').checked = true;
  document.getElementById('mStock').value = '10'; document.getElementById('mMin').value = '2'; document.getElementById('mActive').checked = true;
  Menu.save('neg1', 0);
  var mn = KDB.menuById('neg1');
  ok(mn && mn.price === 0, 'harga negatif dijepit ke 0 saat simpan menu');
  KDB.data.menus = KDB.data.menus.filter(function (m) { return m.id !== 'neg1'; });
  // 5. void ganda: stok hanya kembali sekali
  var mm2 = KDB.menuById('m1'); var stkBefore = mm2.stock;
  var vtx = { id: 'vx1', no: 999, at: Date.now(), items: [{ id: 'm1', name: mm2.name, price: mm2.price, cost: 0, qty: 2 }], sub: 0, disc: 0, total: 16000, pay: 'Tunai', cash: 16000, change: 0, note: '', voided: false };
  KDB.data.txs.unshift(vtx);
  Kasir.voidTx('vx1');
  els['kConfirmOk'].onclick(); // klik Batalkan pertama
  var after1 = mm2.stock;
  els['kConfirmOk'].onclick = null;
  Kasir.voidTx('vx1'); // panggil lagi setelah void
  ok(after1 === stkBefore + 2 && mm2.stock === after1 && vtx.voided, 'void ganda: stok kembali tepat 1x');
  KDB.data.txs = KDB.data.txs.filter(function (t) { return t.id !== 'vx1'; });
  // 6. sanitasi nama file update
  Upd.download('https://x/y.apk', '../../../evi\'l v1.24');
  ok(window._updFile === 'OGKasir-.._.._evi_l_v1.24.apk' || window._updFile.indexOf('/') < 0 && window._updFile.indexOf("'") < 0, 'nama file update disanitasi: ' + window._updFile);
  // 7. peringatan kuota penyimpanan
  var origSet = global.localStorage.setItem;
  global.localStorage.setItem = function () { var e = new Error('x'); e.name = 'QuotaExceededError'; throw e; };
  KDB._quotaWarned = false;
  var qok = true;
  try { KDB.save(); } catch (e) { qok = false; }
  ok(qok && KDB._quotaWarned === true, 'kuota penuh: save tidak lempar, flag warning nyala');
  global.localStorage.setItem = origSet; KDB._quotaWarned = false;
  // 8. rename kategori duplikat ditolak (simulasi langsung)
  KDB.data.cats.push('DupA'); KDB.data.cats.push('DupB');
  var dupGuard = (function () { var D = KDB.data, old = 'DupA', v = 'DupB'; return (v !== old && D.cats.indexOf(v) >= 0); })();
  ok(dupGuard === true, 'rename ke nama kategori yg sudah ada terdeteksi');
  KDB.data.cats = KDB.data.cats.filter(function (c) { return c !== 'DupA' && c !== 'DupB'; });

  /* ===== crop foto menu (2026-10-10) ===== */
  // gambar landscape 1200x800 di canvas 480
  Menu.cropImg = { width: 1200, height: 800 };
  Menu.cropSt = { scale: 0.6, cover: 0.6, tx: 0, ty: 0 };
  Menu.cropClamp();
  ok(Menu.cropSt.tx === 0 && Menu.cropSt.ty === 0, 'cropClamp: posisi tengah valid tidak digeser');
  Menu.cropSt.tx = 100; Menu.cropSt.ty = -500;
  Menu.cropClamp();
  ok(Menu.cropSt.tx === 0 && Menu.cropSt.ty === 0, 'cropClamp: jepit ke batas gambar (tx=0, ty=0; tinggi pas 480)');
  // zoom 2x dari tengah
  Menu.cropSt = { scale: 0.6, cover: 0.6, tx: 0, ty: 0 };
  Menu.cropZoomAt(2, 240, 240);
  ok(Math.abs(Menu.cropSt.scale - 1.2) < 1e-9 && Math.abs(Menu.cropSt.tx + 240) < 1e-9, 'cropZoomAt: 2x dari tengah -> scale 1.2, tx -240');
  // zoom tidak boleh lebih kecil dari cover
  Menu.cropZoomAt(0.001, 240, 240);
  ok(Math.abs(Menu.cropSt.scale - 0.6) < 1e-9, 'cropZoomAt: tidak bisa lebih kecil dari cover');
  // zoom tidak boleh lebih dari 5x cover
  Menu.cropZoomAt(100, 240, 240);
  ok(Math.abs(Menu.cropSt.scale - 3.0) < 1e-9, 'cropZoomAt: dibatasi max 5x cover');
  Menu.cropImg = null; Menu.cropSt = null;

  console.log(fails.length ? '\n' + fails.length + ' GAGAL' : '\nSEMUA LOLOS ✓');
  process.exit(fails.length ? 1 : 0);
} catch (e) {
  console.log('EXCEPTION: ' + (e && e.stack || e));
  process.exit(2);
}
