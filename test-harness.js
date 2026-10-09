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
  'pengaturan.js', 'lic-crypto.js', 'license.js', 'update.js', 'app.js']
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

  console.log(fails.length ? '\n' + fails.length + ' GAGAL' : '\nSEMUA LOLOS ✓');
  process.exit(fails.length ? 1 : 0);
} catch (e) {
  console.log('EXCEPTION: ' + (e && e.stack || e));
  process.exit(2);
}
