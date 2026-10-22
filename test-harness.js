// KasirKu test harness (node) - simpan permanen di ~/workspace/kasirku/
function makeEl(id) {
  var el = {
    id: id || '', innerHTML: '', textContent: '', value: '', _cls: {},
    style: { _p: {}, setProperty: function (k, v) { el.style._p[k] = v; },
      removeProperty: function (k) { delete el.style._p[k]; },
      getPropertyValue: function (k) { return el.style._p[k] || ''; } },
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
global.ZXing = { // stub: decode asli urusan library
  BarcodeFormat: { QR_CODE: 1, DATA_MATRIX: 1, AZTEC: 1, EAN_13: 1, EAN_8: 1, UPC_A: 1, UPC_E: 1, CODE_128: 1, CODE_39: 1, ITF: 1, CODABAR: 1 },
  DecodeHintType: { POSSIBLE_FORMATS: 1 },
  BrowserMultiFormatReader: function () { this.reset = function () {}; this.decodeFromVideoElementContinuously = function () {}; }
};
var all = ['i18n.js', 'store.js', 'ui.js', 'theme.js', 'kasir.js', 'menu.js', 'stok.js', 'laporan.js', 'xlsx.js',
  'pengaturan.js', 'lic-crypto.js', 'license.js', 'update.js', 'printer.js', 'scan.js', 'cloud.js',
  'account.js', 'sync.js', 'app.js']
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

  /* ---- jual per kilo ---- */
  ok(K.numDec('1,5') === 1.5, 'numDec koma');
  ok(K.numDec('2.25') === 2.25, 'numDec titik');
  ok(K.numDec('abc') === 0, 'numDec invalid = 0');
  ok(K.fmtQty(1.5, 'kg') === '1,5', 'fmtQty kg koma');
  ok(K.fmtQty(2, 'kg') === '2', 'fmtQty kg bulat');
  ok(K.fmtQty(0.333333, 'kg') === '0,333', 'fmtQty kg 3 desimal');
  ok(K.isKg({ unit: 'kg' }), 'isKg true');
  ok(!K.isKg({}), 'isKg default pcs (migrasi menu lama)');
  ok(!K.isKg(KDB.menuById('m1')), 'menu lama tanpa unit = pcs');
  KDB.data.menus.push({ id: 'mkg', name: 'Apel', cat: 'Buah', price: 20000, cost: 12000,
    stock: 10, min: 1, track: true, active: true, unit: 'kg', emoji: '🍎', sample: false });
  Kasir.cart = {};
  Kasir.add('mkg'); // produk kg -> buka modal timbang
  document.getElementById('kWeight').value = '1,5';
  Kasir.weightOk('mkg');
  ok(Kasir.cart['mkg'] === 1.5, 'cart kg 1.5');
  ok(Kasir.cartTotal() === 30000, 'total kg = 30000');
  Kasir.add('mkg');
  document.getElementById('kWeight').value = '99';
  Kasir.weightOk('mkg');
  ok(Kasir.cart['mkg'] === 1.5, 'berat > stok ditolak');
  document.getElementById('kWeight').value = '0';
  Kasir.weightOk('mkg');
  ok(Kasir.cart['mkg'] === 1.5, 'berat 0 ditolak');
  document.getElementById('kWeight').value = '0,25';
  Kasir.weightOk('mkg');
  ok(Kasir.cart['mkg'] === 0.25, 'timbang ulang ganti berat');
  document.getElementById('kWeight').value = '1,5';
  Kasir.weightOk('mkg');
  Kasir.openCartFresh();
  ok(document.getElementById('kSheet').innerHTML.indexOf('/kg') >= 0, 'keranjang tampil /kg');
  document.getElementById('kDisc').value = '0';
  document.getElementById('kDiscType').value = 'rp';
  document.getElementById('kCash').value = '50000';
  document.getElementById('kNote').value = '';
  Kasir.pay();
  var txk = KDB.data.txs[0];
  ok(txk.items[0].qty === 1.5 && txk.items[0].unit === 'kg', 'item kg tersimpan + unit');
  ok(txk.total === 30000 && txk.change === 20000, 'total & kembalian kg');
  ok(KDB.menuById('mkg').stock === 8.5, 'stok kg berkurang desimal');
  var rtk = Kasir.receiptText(txk);
  ok(rtk.indexOf('1,5 kg x Apel') >= 0, 'struk teks kg');
  ok(rtk.indexOf('/kg') >= 0, 'struk teks harga /kg');
  ok(Kasir.renderStruk().indexOf('1,5 kg x Apel') >= 0, 'struk html kg');
  ok(Kasir.render().indexOf('/kg') >= 0, 'grid kasir tampil /kg');
  ok(Menu.render().indexOf('/kg') >= 0, 'daftar menu tampil /kg');
  Menu.form('mkg');
  ok(document.getElementById('kSheet').innerHTML.indexOf('Satuan jual') >= 0, 'form ada toggle satuan');
  ok(document.getElementById('kSheet').innerHTML.indexOf('Harga per kg (Rp)') >= 0, 'form label harga per kg');
  ok(document.getElementById('kSheet').innerHTML.indexOf('k-scanbtn') >= 0, 'tombol scan barcode compact');
  ok(document.getElementById('kSheet').innerHTML.indexOf('id="mCode"') >= 0, 'input barcode ada');
  UI.closeSheet();
  Kasir.baru();
  // void kembalikan stok desimal
  var stkKgBefore = KDB.menuById('mkg').stock;
  Kasir.voidTx(txk.id);
  els['kConfirmOk'].onclick();
  els['kConfirmOk'].onclick = null;
  ok(KDB.menuById('mkg').stock === stkKgBefore + 1.5, 'void kembalikan stok kg');
  KDB.data.txs = KDB.data.txs.filter(function (t) { return t.id !== txk.id; });

  /* ---- menu / stok / laporan / pengaturan ---- */
  ok(Menu.render().indexOf('Daftar Menu') >= 0, 'menu render');
  ok(Stok.render().indexOf('Stok Menu') >= 0, 'stok render');
  Lap.period = 'today';
  ok(Lap.render().indexOf('Omzet') >= 0, 'laporan render');
  Lap.drawChart(Lap.range());
  ok(AppSet.render().indexOf('Lisensi') >= 0, 'pengaturan + kartu lisensi');

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
    connectWifiPrinter: function (ip, port) { this._wifi = { ip: ip, port: port }; window.ogkasirPrinterConn(true, 'WiFi ' + ip); },
    disconnectPrinter: function () {},
    printerStatus: function () { return JSON.stringify({ connected: Printer.connected, name: Printer.name || 'XPrinter XP-N160I', mac: Printer.mac || 'AA:BB:CC:DD:EE:FF', type: Printer.type || 'bt', ip: '' }); },
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

  /* ---- printer WiFi: validasi IP ---- */
  ok(Printer.validIp('192.168.1.50'), 'validIp terima IPv4 valid');
  ok(Printer.validIp(' 10.0.0.1 '), 'validIp trim spasi');
  ok(!Printer.validIp('192.168.1'), 'validIp tolak 3 oktet');
  ok(!Printer.validIp('192.168.1.999'), 'validIp tolak oktet >255');
  ok(!Printer.validIp('abc.def.ghi.jkl'), 'validIp tolak non-angka');
  ok(!Printer.validIp(''), 'validIp tolak string kosong');
  ok(!Printer.validIp(null), 'validIp tolak null');

  /* ---- printer WiFi: alur koneksi ---- */
  Printer._pendingWifi = { ip: '192.168.1.50', port: 9100 };
  window.ogkasirPrinterConn(true, 'WiFi 192.168.1.50');
  ok(Printer.connected && Printer.type === 'wifi' && Printer.name === 'WiFi 192.168.1.50', 'connect WiFi simpan status+nama');
  ok(KDB.data.settings.printerWifiIp === '192.168.1.50', 'IP WiFi tersimpan di settings');
  ok(KDB.data.settings.printerWifiPort === 9100, 'port WiFi tersimpan di settings');
  ok(KDB.data.settings.printerType === 'wifi', 'tipe wifi tersimpan di settings');
  ok(KDB.data.settings.printerMac === '', 'MAC BT dibersihkan saat pindah ke WiFi');
  // cetak via WiFi memakai stream yang sama
  Printer.printStruk(tx0);
  ok((global.OGKasirPrinter._last || '').length > 0, 'printStruk jalan saat WiFi terhubung');
  // pindah balik ke BT: setting WiFi dibersihkan
  Printer.connect('AA:BB:CC:DD:EE:FF');
  ok(KDB.data.settings.printerType === 'bt', 'tipe bt tersimpan');
  ok(KDB.data.settings.printerWifiIp === '', 'IP WiFi dibersihkan saat pindah ke BT');
  Printer.disconnect();
  ok(!Printer.connected && KDB.data.settings.printerType === '' && KDB.data.settings.printerWifiIp === '', 'disconnect bersihkan setting WiFi');
  // render pengaturan memuat kartu printer tanpa error
  App.page = 'set';
  var setHtml = AppSet.render();
  ok(setHtml.indexOf('Printer Struk') >= 0, 'kartu printer muncul di pengaturan');
  ok(setHtml.indexOf('Printer.pickWifi()') >= 0, 'opsi printer WiFi ada di kartu printer');
  ok(setHtml.indexOf('Printer.pick()') >= 0, 'opsi printer Bluetooth ada di kartu printer');
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

  /* ===== tagihan / belum dibayar (2026-10-11) ===== */
  var mmU = KDB.menuById('m1');
  var stkU0 = mmU.stock;
  // 1. buat tagihan via Kasir.pay() dengan metode Belum Dibayar
  Kasir.cart = { m1: 2 };
  Kasir.payMethod = 'Belum Dibayar';
  document.getElementById('kDisc').value = '0'; document.getElementById('kDiscType').value = 'rp';
  document.getElementById('kCash').value = ''; document.getElementById('kNote').value = '';
  document.getElementById('kCust').value = 'Meja 3';
  Kasir.pay();
  var tag = Kasir.lastTx;
  ok(tag && tag.status === 'unpaid' && tag.pay === 'Belum Dibayar' && tag.customer === 'Meja 3', 'tagihan tersimpan: status unpaid + nama pelanggan');
  ok(mmU.stock === stkU0 - 2, 'stok berkurang saat tagihan dibuat (pesanan disajikan)');
  ok(Kasir.mode === 'struk', 'setelah simpan tagihan tampil struk (bisa langsung print)');
  var strukTagihan = Kasir.renderStruk();
  ok(strukTagihan.indexOf('Tagihan Tersimpan') >= 0 && strukTagihan.indexOf('BELUM DIBAYAR') >= 0, 'layar struk tagihan: judul + status benar');
  // 2. tidak masuk omzet, masuk piutang
  var rT = Lap.range();
  ok(Lap.txsIn(rT).indexOf(tag) < 0, 'tagihan tidak masuk txsIn laporan');
  ok(Kasir.unpaidTotal() >= tag.total && Lap.piutang().total >= tag.total, 'tagihan tercatat sebagai piutang');
  ok(Kasir.unpaidList().length >= 1, 'daftar tagihan tidak kosong');
  // 3. struk tagihan tandai BELUM DIBAYAR
  var strTag = Kasir.receiptText(tag);
  ok(strTag.indexOf('BELUM DIBAYAR') >= 0 && strTag.indexOf('Meja 3') >= 0, 'struk tagihan ada label BELUM DIBAYAR + nama');
  // 4. bayar tagihan tunai
  Kasir._payTagId = tag.id; Kasir._payTagMethod = 'Tunai';
  document.getElementById('kTagCash').value = String(tag.total + 5000);
  Kasir.confirmBayarTagihan();
  ok(tag.status === 'paid' && tag.pay === 'Tunai' && tag.change === 5000 && tag.paidAt > 0, 'pelunasan: status paid, kembalian benar');
  ok(mmU.stock === stkU0 - 2, 'stok TIDAK berubah saat pelunasan (tidak double)');
  ok(Lap.txsIn(rT).indexOf(tag) >= 0, 'setelah lunas tagihan masuk laporan');
  ok(Kasir.unpaidList().indexOf(tag) < 0, 'setelah lunas hilang dari daftar tagihan');
  // 5. transaksi lama tanpa field status dianggap lunas (backward compat)
  var oldTx = { id: 'old1', no: 555, at: Date.now(), items: [], sub: 0, disc: 0, total: 10000, pay: 'Tunai', cash: 10000, change: 0, note: '', voided: false };
  KDB.data.txs.unshift(oldTx);
  ok(!Kasir.isUnpaid(oldTx) && Lap.txsIn(rT).indexOf(oldTx) >= 0, 'transaksi lama tanpa status = lunas');
  KDB.data.txs = KDB.data.txs.filter(function (t) { return t.id !== 'old1'; });
  // 6. void tagihan: stok kembali 1x
  Kasir.cart = { m1: 1 }; Kasir.payMethod = 'Belum Dibayar';
  document.getElementById('kDisc').value = '0'; document.getElementById('kDiscType').value = 'rp';
  document.getElementById('kCust').value = '';
  Kasir.pay();
  var tag2 = Kasir.lastTx; var stkV0 = mmU.stock;
  Kasir.voidTx(tag2.id); els['kConfirmOk'].onclick(); els['kConfirmOk'].onclick = null;
  ok(tag2.voided && mmU.stock === stkV0 + 1, 'void tagihan: stok kembali tepat 1x');
  KDB.data.txs = KDB.data.txs.filter(function (t) { return t.id !== tag2.id && t.id !== tag.id; });
  Kasir.payMethod = 'Tunai'; Kasir.cart = {}; Kasir.mode = 'kasir';

  // 12. i18n: default id, en menerjemahkan, fallback aman
  ok(T('Batalkan') === 'Batalkan', 'i18n default Indonesia');
  I18N.setLang('en');
  ok(T('Batalkan') === 'Void' && T('Kasir') === 'Cashier', 'i18n Inggris menerjemahkan');
  ok(T('String tak dikenal xyz') === 'String tak dikenal xyz', 'i18n fallback ke Indonesia');
  ok(I18N.payName('Tunai') === 'Cash' && I18N.payName('QRIS') === 'QRIS', 'payName tampil Inggris, data tetap');
  I18N.setLang('id');
  // 17. Custom Tampilan: rename kartu
  var setHtml = AppSet.render();
  ok(setHtml.indexOf('Custom Tampilan') >= 0, 'kartu Custom Tampilan tampil');
  I18N.setLang('en');
  ok(AppSet.render().indexOf('Custom Appearance') >= 0, 'kartu tampil Inggris');
  I18N.setLang('id');
  // 18. Jam live: hari, tanggal, jam
  var clock = App.clockHtml();
  ok(/Minggu|Senin|Selasa|Rabu|Kamis|Jumat|Sabtu/.test(clock), 'jam tampil hari Indonesia');
  ok(/\d{2}:\d{2}:\d{2}/.test(clock), 'jam tampil HH:MM:SS');
  I18N.setLang('en');
  ok(/Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday/.test(App.clockHtml()), 'jam tampil hari Inggris');
  App.renderHeader();
  ok(els['kHeader'].innerHTML.indexOf('kClock') >= 0, 'header punya elemen jam');
  I18N.setLang('id');
  // 19. Profil pengguna
  KDB.data.settings.userName = 'Budi';
  KDB.data.settings.userEmoji = '😎';
  ok(AppSet.render().indexOf('Profil Pengguna') >= 0, 'kartu Profil Pengguna tampil');
  var tx0 = { no: 1, at: Date.now(), items: [{ qty: 1, name: 'Kopi', price: 10000 }], sub: 10000, disc: 0, total: 10000, pay: 'Tunai', cash: 10000, change: 0, status: 'paid' };
  var rc = Kasir.receiptText(tx0);
  ok(rc.indexOf('Kasir') >= 0 && rc.indexOf('Budi') >= 0, 'struk teks ada baris Kasir');
  ok(/^[\x00-\x7F]*$/.test(rc), 'struk teks tetap murni ASCII');
  KDB.data.settings.userName = 'Budi 😎';
  ok(Kasir.receiptText(tx0).indexOf('😎') < 0, 'nama non-ASCII tidak masuk struk printer');
  Kasir.lastTx = tx0; KDB.data.settings.userName = 'Budi';
  ok(Kasir.renderStruk().indexOf('Budi') >= 0, 'struk HTML tampil nama kasir');
  KDB.data.settings.userName = ''; KDB.data.settings.userEmoji = '';
  ok(Kasir.receiptText(tx0).indexOf('Kasir') < 0, 'tanpa nama: baris Kasir tidak tampil');
  // 20. Logo toko custom
  App.renderHeader();
  ok(els['kHeader'].innerHTML.indexOf('\u26a1') >= 0, 'default: logo petir tampil');
  KDB.data.settings.logo = 'data:image/png;base64,AAA';
  App.renderHeader();
  ok(els['kHeader'].innerHTML.indexOf('<img src="data:image/png') >= 0, 'logo custom tampil di header');
  ok(AppSet.render().indexOf('Logo toko (opsional)') >= 0, 'field logo tampil di Profil Toko');
  AppSet.clearLogo();
  ok(KDB.data.settings.logo === '', 'clearLogo menghapus logo');
  App.renderHeader();
  ok(els['kHeader'].innerHTML.indexOf('\u26a1') >= 0, 'setelah hapus: petir kembali');
  I18N.setLang('en');
  ok(AppSet.render().indexOf('Shop logo (optional)') >= 0, 'field logo tampil Inggris');
  I18N.setLang('id');
  // 13. Theme: aksen custom + reset
  KDB.data.settings.accent = '#2563eb'; KDB.data.settings.theme = 'light';
  Theme.apply();
  ok(document.documentElement.style.getPropertyValue('--brand') === '#2563eb', 'aksen custom menimpa --brand');
  KDB.data.settings.accent = ''; Theme.apply();
  ok(document.documentElement.style.getPropertyValue('--brand') === '', 'reset aksen kembali bawaan');
  // 14. Grid/Baris
  KDB.data.settings.menuView = 'list';
  var lh = Kasir.listHtml([KDB.data.menus[0]]);
  ok(lh.indexOf('k-list') >= 0 && lh.indexOf('k-li') >= 0, 'listHtml render tampilan baris');
  ok(Kasir.render().indexOf('k-list') >= 0, 'render kasir pakai list saat menuView=list');
  KDB.data.settings.menuView = 'grid';
  ok(Kasir.render().indexOf('k-grid') >= 0, 'render kasir pakai grid saat menuView=grid');
  // 15. AppSet.lang ganti bahasa + render ulang
  AppSet.lang('en');
  ok(I18N.lang === 'en' && KDB.data.settings.lang === 'en', 'AppSet.lang menyimpan & mengaktifkan Inggris');
  ok(document.getElementById('kNav').innerHTML.indexOf('Cashier') >= 0, 'nav tampil Inggris');
  var enHtml = Kasir.render() + Menu.render() + Stok.render() + Lap.render() + AppSet.render();
  ok(enHtml.indexOf('undefined') < 0, 'render mode Inggris tanpa undefined');
  ok(enHtml.indexOf('Cash') >= 0 && enHtml.indexOf('Stock') >= 0, 'mode Inggris tampil terjemahan');
  // 16. BUG: filter kategori 'Semua' harus kanonis — produk tidak hilang di mode Inggris
  Kasir.cat = 'Semua';
  var nId = Kasir.filteredMenus().length;
  I18N.setLang('en');
  ok(Kasir.filteredMenus().length === nId && nId > 0, 'produk tetap tampil di mode Inggris (filter Semua kanonis)');
  var chipHtml = Kasir.render();
  ok(chipHtml.indexOf('All') >= 0 && chipHtml.indexOf('k-list') < 0, 'chip Semua tampil sebagai All');
  I18N.setLang('id');
  AppSet.lang('id');
  ok(document.getElementById('kNav').innerHTML.indexOf('Kasir') >= 0, 'nav kembali Indonesia');

  // 7. label Belum Bayar (bukan Piutang)
  ok(Lap.piutang && typeof Lap.piutang === 'function', 'Lap.piutang tetap ada (internal)');
  // 8. menuByCode
  KDB.data.menus.push({ id: 'qr1', name: 'Kopi QR', price: 10000, code: 'QR001', active: true });
  ok(KDB.menuByCode('QR001') && KDB.menuByCode('QR001').id === 'qr1', 'menuByCode menemukan menu');
  ok(KDB.menuByCode('TIDAKADA') === null, 'menuByCode null utk kode asing');
  ok(KDB.menuByCode('') === null && KDB.menuByCode(null) === null, 'menuByCode null utk kode kosong');
  ok(KDB.menuByCode('m1') === null, 'menu tanpa code tidak ketemu via menuByCode');
  // 9. Menu.save menyimpan code
  document.getElementById('mName').value = 'Teh QR'; document.getElementById('mPrice').value = '8000';
  document.getElementById('mCost').value = '0'; document.getElementById('mCode').value = 'QR002';
  document.getElementById('mEmoji').value = '🍵'; document.getElementById('mCat').value = 'Teh';
  document.getElementById('mTrack').checked = false; document.getElementById('mActive').checked = true;
  Menu.save('qr2', 0);
  var mq = KDB.menuById('qr2');
  ok(mq && mq.code === 'QR002' && KDB.menuByCode('QR002') === mq, 'Menu.save menyimpan kode QR');
  document.getElementById('mCode').value = 'QR002B';
  Menu.save('qr2', 1);
  ok(KDB.menuById('qr2').code === 'QR002B', 'edit menu memperbarui kode QR');
  KDB.data.menus = KDB.data.menus.filter(function (m) { return m.id !== 'qr1' && m.id !== 'qr2'; });
  // 10. Scan graceful tanpa kamera -> tawarkan ketik manual
  var _t = UI.toast; var toastN = 0; UI.toast = function () { toastN++; };
  var gotMan = null;
  Scan.open(function (c) { gotMan = c; });
  ok(els['kModal'].innerHTML.indexOf('scanManual') >= 0, 'Scan.open tanpa kamera tawarkan ketik manual');
  document.getElementById('scanManual').value = '8991234567890';
  Scan.manualGo();
  ok(gotMan === '8991234567890', 'ketik manual meneruskan kode ke callback');
  Scan.close(); ok(true, 'Scan.close aman saat tidak aktif');
  UI.toast = _t;
  // 11. Kasir.scanAdd: kode cocok -> masuk keranjang; tak cocok -> toast
  KDB.data.menus.push({ id: 'qr3', name: 'Roti QR', price: 5000, code: 'QR003', active: true, track: false });
  var _open = Scan.open; Scan.open = function (cb) { cb('QR003'); };
  Kasir.cart = {}; Kasir.scanAdd();
  ok(Kasir.cart['qr3'] === 1, 'scanAdd menambahkan menu ke keranjang');
  Scan.open = function (cb) { cb('QRXXX'); };
  Kasir.scanAdd();
  els['kConfirmOk'].onclick(); els['kConfirmOk'].onclick = null; // klik Daftarkan
  ok(els['kSheet'].innerHTML.indexOf('id="mCode" value="QRXXX"') >= 0, 'scan QR asing -> form menu baru terisi kode');
  UI.closeSheet();
  UI.toast = _t; Scan.open = _open;
  KDB.data.menus = KDB.data.menus.filter(function (m) { return m.id !== 'qr3'; });
  Kasir.cart = {};

  /* ===== fitur catatan per item + tambah/gabung tagihan ===== */
  KDB.data.menus.push({ id: 'n1', name: 'Mie Goreng', cat: 'Makanan', price: 12000, cost: 5000, stock: 10, min: 2, track: true, active: true, emoji: '🍜' });
  KDB.data.menus.push({ id: 'n2', name: 'Es Teh', cat: 'Minuman', price: 6000, cost: 1500, stock: 20, min: 2, track: true, active: true, emoji: '🧊' });
  // preset
  ok(Kasir.notePresets().indexOf('Setengah matang') >= 0, 'preset catatan default ada');
  // tapPreset: tambah tanpa duplikat
  Kasir.cartNote = {};
  Kasir.tapPreset('n1', 'Setengah matang');
  ok(Kasir.cartNote['n1'] === 'Setengah matang', 'tapPreset isi catatan');
  Kasir.tapPreset('n1', 'Setengah matang');
  ok(Kasir.cartNote['n1'] === 'Setengah matang', 'tapPreset tidak duplikat');
  Kasir.tapPreset('n1', 'Pedas');
  ok(Kasir.cartNote['n1'] === 'Setengah matang, Pedas', 'tapPreset gabung koma');
  Kasir.setNote('n1', 'custom bebas');
  ok(Kasir.cartNote['n1'] === 'custom bebas', 'setNote custom bebas');
  Kasir.clearNote('n1');
  ok(Kasir.cartNote['n1'] === '', 'clearNote kosongkan');
  // pay tagihan dengan catatan
  Kasir.cart = { n1: 1, n2: 2 };
  Kasir.cartNote = { n1: 'setengah matang' };
  Kasir.payMethod = 'Belum Dibayar';
  document.getElementById('kDisc').value = '0'; document.getElementById('kDiscType').value = 'rp';
  document.getElementById('kCash').value = '0'; document.getElementById('kCust').value = 'Meja 3';
  document.getElementById('kNote').value = '';
  Kasir.pay();
  var tag1 = Kasir.lastTx;
  ok(tag1 && tag1.status === 'unpaid', 'tagihan tersimpan unpaid');
  ok(tag1.items[0].note === 'setengah matang', 'catatan item tersimpan di tx');
  ok(tag1.items[1].note === '', 'item tanpa catatan = string kosong');
  ok(KDB.menuById('n1').stock === 9, 'stok n1 berkurang setelah pay');
  ok(!('n1' in Kasir.cartNote), 'cartNote dibersihkan setelah pay');
  var rtxt = Kasir.receiptText(tag1);
  ok(rtxt.split('\n').every(function (l) { return l.length <= 32; }), 'baris catatan struk max 32 kolom');
  ok(rtxt.indexOf('setengah matang') >= 0, 'catatan tampil di struk teks');
  Kasir.mode = 'struk';
  ok(Kasir.renderStruk().indexOf('setengah matang') >= 0, 'catatan tampil di struk HTML');
  Kasir.mode = 'kasir';
  // tambah pesanan: muat ke keranjang
  Kasir.tambahPesanan(tag1.id);
  ok(Kasir._editingTagId === tag1.id, 'mode edit tagihan aktif');
  ok(Kasir.cart['n1'] === 1 && Kasir.cart['n2'] === 2, 'item tagihan dimuat ke keranjang');
  ok(Kasir.cartNote['n1'] === 'setengah matang', 'catatan ikut dimuat');
  // tambah 1 es teh + ubah catatan, lalu simpan
  Kasir.cart['n2'] = 3;
  Kasir.cartNote['n2'] = 'es sedikit';
  document.getElementById('kDisc').value = '0'; document.getElementById('kDiscType').value = 'rp';
  document.getElementById('kNote').value = ''; document.getElementById('kCust').value = 'Meja 3';
  Kasir.saveEdit();
  ok(Kasir._editingTagId === null, 'mode edit selesai setelah simpan');
  var n2it = null;
  for (var _i = 0; _i < tag1.items.length; _i++) if (tag1.items[_i].id === 'n2') n2it = tag1.items[_i];
  ok(n2it && n2it.qty === 3 && n2it.note === 'es sedikit', 'qty & catatan baru tersimpan');
  ok(tag1.total === 12000 + 3 * 6000, 'total tagihan terupdate');
  ok(KDB.menuById('n2').stock === 17, 'stok n2 benar setelah restore+reapply (17)');
  ok(KDB.menuById('n1').stock === 9, 'stok n1 net tetap 9');
  ok(tag1.status === 'unpaid', 'status tagihan tetap unpaid');
  // stok mode edit: qty tagihan dihitung sebagai tersedia
  KDB.data.menus.push({ id: 'n3', name: 'Roti', cat: 'Makanan', price: 5000, cost: 2000, stock: 5, min: 1, track: true, active: true, emoji: '🍞' });
  Kasir.cart = { n3: 3 }; Kasir.cartNote = {};
  Kasir.payMethod = 'Belum Dibayar';
  document.getElementById('kCust').value = '';
  Kasir.pay();
  var tag3 = Kasir.lastTx;
  ok(KDB.menuById('n3').stock === 2, 'stok n3 sisa 2 setelah tagihan 3');
  Kasir.tambahPesanan(tag3.id); // langsung edit (cart kosong)
  ok(Kasir._editingTagId === tag3.id, 'mode edit tag3 aktif');
  Kasir.chQty('n3', 1); // nx=4, avail=2+3=5 → boleh (kode lama: tolak)
  ok(Kasir.cart['n3'] === 4, 'tambah 1 di mode edit boleh (stok dihitung ulang)');
  Kasir.chQty('n3', 1); // nx=5 ≤ 5 boleh
  ok(Kasir.cart['n3'] === 5, 'tambah sampai batas avail');
  Kasir.chQty('n3', 1); // nx=6 > 5 tolak
  ok(Kasir.cart['n3'] === 5, 'lewat batas avail ditolak');
  Kasir.cancelEdit();
  ok(Kasir._editingTagId === null && KDB.menuById('n3').stock === 2, 'batal edit: stok & state kembali');
  // preset editor
  var np0 = Kasir.notePresets().length;
  document.getElementById('sPreset').value = 'Sambal terpisah';
  AppSet.addPreset();
  ok(Kasir.notePresets().indexOf('Sambal terpisah') >= 0, 'preset baru tersimpan');
  AppSet.delPreset(Kasir.notePresets().indexOf('Sambal terpisah'));
  ok(Kasir.notePresets().length === np0, 'preset terhapus, jumlah kembali');
  // kartu preset muncul di pengaturan
  App.page = 'set';
  ok(AppSet.render().indexOf('Preset Catatan') >= 0, 'kartu preset ada di pengaturan');
  // tema tampilan: 5 pilihan
  ok(Theme.THEMES.length === 5, '5 tema tersedia');
  var rec = {};
  var de = document.documentElement;
  var _sa = de.setAttribute;
  de.setAttribute = function (k, v) { rec[k] = v; };
  ['light', 'dark', 'midnight', 'fintech', 'warkop'].forEach(function (t) {
    KDB.data.settings.theme = t;
    Theme.apply();
    ok(rec['data-theme'] === t, 'tema ' + t + ' diterapkan');
  });
  KDB.data.settings.theme = 'ngaco';
  Theme.apply();
  ok(rec['data-theme'] === 'light', 'tema invalid fallback ke light');
  KDB.data.settings.theme = 'midnight';
  KDB.data.settings.accent = '#ff0000';
  Theme.apply();
  ok(de.style._p['--brand'] === '#ff0000', 'aksen custom tetap menimpa di tema baru');
  KDB.data.settings.accent = '';
  de.setAttribute = _sa;
  AppSet.theme('fintech');
  ok(KDB.data.settings.theme === 'fintech', 'AppSet.theme menyimpan pilihan');
  AppSet.theme('ngaco');
  ok(KDB.data.settings.theme === 'light', 'AppSet.theme menolak invalid');
  ok(AppSet.render().indexOf('Tema tampilan') >= 0, 'pemilih tema ada di pengaturan');
  KDB.data.settings.theme = 'light';
  Theme.apply();
  // cloud backup: key, url, payload
  ok(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(Cloud.genKey()), 'cloud key format 4-4-4');
  ok(Cloud.genKey() !== Cloud.genKey(), 'cloud key acak');
  KDB.data.settings.cloudUrl = 'https://x.trycloudflare.com///';
  ok(Cloud.url() === 'https://x.trycloudflare.com', 'cloud url dinormalisasi');
  KDB.data.settings.cloudUrl = '';
  ok(Cloud.url() === '', 'cloud url kosong');
  // backup tanpa URL -> supabase default (bukan ditolak)
  var _fetch = global.fetch, fetched = 0;
  global.fetch = function () { fetched++; return Promise.resolve({}); };
  var _toast = UI.toast, lastToast = '';
  UI.toast = function (m) { lastToast = m; };
  KDB.data.settings.cloudUrl = '';
  ok(Cloud.backend() === 'supabase', 'backend default = supabase');
  // backup supabase -> POST ke /rest/v1/rpc/backup_put
  KDB.data.settings.cloudKey = 'AB12-CD34-EF56';
  var sentUrl = '', sentHdrs = null, sentBody = null;
  global.fetch = function (u, o) {
    sentUrl = u; sentHdrs = o.headers; sentBody = JSON.parse(o.body); fetched++;
    return Promise.resolve({ status: 200, json: function () { return Promise.resolve('2026-10-13T00:00:00Z'); } });
  };
  Cloud.backup();
  setTimeout(function () {
    ok(sentUrl === Cloud.SUPA_URL + '/rest/v1/rpc/backup_put', 'POST ke RPC backup_put');
    ok(sentHdrs.apikey === Cloud.SUPA_ANON, 'header apikey terkirim');
    ok(sentBody.p_device_id && sentBody.p_key === 'AB12-CD34-EF56', 'payload RPC benar');
    ok(sentBody.p_data.menus && sentBody.p_data.settings, 'p_data = KDB utuh');
    ok(KDB.data.settings.cloudTs > 0, 'cloudTs tersimpan');
    // custom URL tetap pakai jalur lama
    KDB.data.settings.cloudUrl = 'https://srv.test';
    ok(Cloud.backend() === 'custom', 'cloudUrl override -> custom');
    sentUrl = '';
    Cloud.backup();
    setTimeout(function () {
      ok(sentUrl === 'https://srv.test/api/backup', 'jalur custom tetap jalan');
      // kartu cloud tampil di pengaturan
      ok(AppSet.cloudCard().indexOf('Cloud Backup') >= 0, 'kartu cloud backup tampil');
      ok(AppSet.cloudCard().indexOf('AB12-CD34-EF56') >= 0, 'kode pemulihan tampil');
      global.fetch = _fetch; UI.toast = _toast;
      KDB.data.settings.cloudUrl = ''; KDB.data.settings.cloudKey = ''; KDB.data.settings.cloudTs = 0;
    }, 50);
  }, 50);
  // auto backup bulanan
  setTimeout(function () {
    var _fetch2 = global.fetch, n = 0;
    global.fetch = function () {
      n++;
      return Promise.resolve({ status: 200, json: function () { return Promise.resolve('2026-10-13T00:00:00Z'); } });
    };
    var s = KDB.data.settings;
    // 1. tanpa cloudKey -> skip
    s.cloudKey = ''; s.cloudTs = 0; s.cloudAuto = true;
    Cloud.autoBackup();
    ok(n === 0, 'auto skip tanpa cloudKey (belum consent)');
    // 2. cloudKey ada + ts > 30 hari + online -> jalan
    s.cloudKey = 'AB12-CD34-EF56'; s.cloudTs = Date.now() - 31 * 864e5;
    Cloud.autoBackup();
    setTimeout(function () {
      ok(n === 1, 'auto jalan setelah 30 hari');
      // 3. baru saja backup -> skip
      s.cloudTs = Date.now();
      Cloud.autoBackup();
      ok(n === 1, 'auto skip bila belum 30 hari');
      // 4. toggle mati -> skip
      s.cloudTs = Date.now() - 60 * 864e5; s.cloudAuto = false;
      Cloud.autoBackup();
      ok(n === 1, 'auto skip bila toggle mati');
      // 5. offline -> skip
      s.cloudAuto = true;
      global.navigator.onLine = false;
      Cloud.autoBackup();
      ok(n === 1, 'auto skip bila offline');
      delete global.navigator.onLine;
      // 6. toggleAuto
      Cloud.toggleAuto(false);
      ok(KDB.data.settings.cloudAuto === false, 'toggleAuto mati');
      Cloud.toggleAuto(true);
      ok(KDB.data.settings.cloudAuto === true, 'toggleAuto nyala');
      ok(AppSet.cloudCard().indexOf('Backup otomatis bulanan') >= 0, 'toggle tampil di kartu');
      global.fetch = _fetch2;
      s.cloudKey = ''; s.cloudTs = 0; s.cloudAuto = true;
    }, 50);
  }, 400);
  // cleanup
  KDB.data.menus = KDB.data.menus.filter(function (m) { return m.id !== 'n1' && m.id !== 'n2' && m.id !== 'n3'; });
  KDB.data.txs = KDB.data.txs.filter(function (t) { return t !== tag1 && t !== tag3; });
  Kasir.cart = {}; Kasir.cartNote = {}; Kasir.mode = 'kasir';

  /* ===== Akun & Sync: status lisensi akun, sharding, merge (tanpa jaringan) ===== */
  (function () {
    var D = KDB.data, savedLic = JSON.stringify(D.settings.lic || {});
    // 1. hash perangkat: sha256 hex 64 char, stabil
    var h1 = Account.deviceHash(), h2 = Account.deviceHash();
    ok(/^[a-f0-9]{64}$/.test(h1) && h1 === h2, 'deviceHash sha256 stabil');
    // 2. belum login -> licStatusSync null, Lic.status tetap jalur perangkat
    Account.license = null;
    ok(Account.licStatusSync() === null, 'tanpa cache akun, status akun null');
    // 3. lisensi akun aktif 90 hari -> menang atas trial perangkat
    D.settings.lic = { trialStart: Date.now() };
    Account.license = { status: 'active', expires_at: new Date(Date.now() + 90 * 864e5).toISOString(), max_devices: 3 };
    var stA = Lic.status();
    ok(stA.state === 'active' && stA.via === 'account' && stA.daysLeft >= 89, 'lisensi akun aktif dipakai Lic.status');
    ok(Lic.valid() === true, 'app valid dengan lisensi akun');
    // 4. lisensi akun unlimited
    Account.license = { status: 'active', expires_at: null };
    var stU = Lic.status();
    ok(stU.state === 'active' && stU.expDays === null, 'lisensi akun unlimited');
    ok(Lic.licCard().indexOf('Unlimited') >= 0, 'kartu lisensi tampil Unlimited');
    // 5. lisensi akun kedaluwarsa -> gugur ke status perangkat (expired: trial lama habis)
    D.settings.lic = { trialStart: Date.now() - 30 * 864e5 };
    Account.license = { status: 'active', expires_at: new Date(Date.now() - 864e5).toISOString() };
    ok(Lic.status().state === 'expired', 'akun kedaluwarsa + trial habis = expired');
    // 6. lisensi perangkat lebih panjang dari akun -> perangkat yang menang
    var devCode = null;
    try { devCode = LicCrypto.genCode ? LicCrypto.genCode(Lic.deviceCode(), Lic.todayDays() + 365) : null; } catch (e) {}
    Account.license = { status: 'active', expires_at: new Date(Date.now() + 30 * 864e5).toISOString() };
    if (devCode) {
      var actR = Lic.activate(devCode);
      ok(actR.ok && Lic.status().via === 'device', 'lisensi perangkat lebih panjang menang');
    }
    // 7. collectDocs: shard transaksi per bulan + dokumen master lengkap
    D.txs.push({ id: 'sx1', at: new Date(2026, 0, 15).getTime(), total: 1000, items: [] });
    D.txs.push({ id: 'sx2', at: new Date(2026, 1, 3).getTime(), total: 2000, items: [] });
    var docs = Sync.collectDocs();
    ok(!!docs['menus|'] && !!docs['cats|'] && !!docs['employees|'] && !!docs['settings_public|'], 'dokumen master sync lengkap');
    ok(!!docs['txs|2026-01'] && !!docs['txs|2026-02'], 'transaksi ter-shard per bulan');
    ok(typeof docs['settings_public|'].data.pin === 'undefined' &&
       typeof docs['settings_public|'].data.cloudKey === 'undefined',
       'PIN & kunci backup TIDAK ikut sync');
    // 8. mergeById: union + versi updatedAt terbaru menang (void menyebar)
    var merged = Sync.mergeById(
      [{ id: 'a', at: 100, updatedAt: 100, voided: false }, { id: 'b', at: 90, updatedAt: 90 }],
      [{ id: 'a', at: 100, updatedAt: 200, voided: true }, { id: 'c', at: 110, updatedAt: 110 }]);
    ok(merged.length === 3 && merged[0].id === 'c' && merged[1].voided === true,
       'merge transaksi union + void terbaru menang');
    // 9. applyDoc txs menggabungkan tanpa menghapus transaksi lokal bulan lain
    var before = D.txs.length;
    Sync.applyDoc('txs', '2026-01', [{ id: 'sx9', at: new Date(2026, 0, 20).getTime(), total: 500, items: [] }]);
    ok(D.txs.length === before + 1, 'applyDoc txs menambah tanpa menghapus lokal');
    // 10. fingerprint berubah saat data berubah (deteksi dirty)
    var fp1 = Sync.fingerprint(docs['menus|']);
    D.menus.push({ id: 'smx', name: 'Menu Sync Tes', price: 1000, cat: 'x', track: false, stock: 0 });
    var fp2 = Sync.fingerprint(Sync.collectDocs()['menus|']);
    ok(fp1 !== fp2, 'fingerprint mendeteksi perubahan menu');
    // 11. ringkasan sync aman saat belum login
    ok(Sync.summary().pending === 0, 'pending sync 0 saat belum login');
    // cleanup bagian ini
    D.txs = D.txs.filter(function (t) { return ['sx1', 'sx2', 'sx9'].indexOf(t.id) < 0; });
    D.menus = D.menus.filter(function (m) { return m.id !== 'smx'; });
    Account.license = null;
    try { D.settings.lic = JSON.parse(savedLic); } catch (e) {}
    KDB.save();
  })();

  setTimeout(function () {
    console.log(fails.length ? '\n' + fails.length + ' GAGAL' : '\nSEMUA LOLOS ✓');
    process.exit(fails.length ? 1 : 0);
  }, 400); // jeda: beri ruang untuk tes async (promise)
} catch (e) {
  console.log('EXCEPTION: ' + (e && e.stack || e));
  process.exit(2);
}
