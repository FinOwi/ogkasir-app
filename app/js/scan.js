/* OGKasir - Scan kode produk via kamera (live viewfinder).
   PUTARAN 2 — 6 Nov 2026 (perombakan mesin, bukan tambal validasi):
   Fix v1.60 (ZXing-JS + validasi digit cek + baca-stabil 3x) TERBUKTI GAGAL
   di tablet nyata zgg: phantom DETERMINISTIK "8199168211242" (beda 2 digit
   dari asli 8999168211248, tapi lolos digit cek) tembus syarat 3x sama, dan
   bacaan yang berganti-ganti membuat penghitung macet di 1/3 ("ga responsif").
   Benchmark offline (38 fixture foto/render + 41 fixture transformasi +
   36 frame rolling-shutter + 24 fixture silau/glare): pada set glare —
   model kegagalan kemasan mengilap — ZXing-JS mengeluarkan kode SALAH utuh
   (7993145001014 utk 8993199001014), sedangkan ZXing C++ (zxing-wasm 3.1.6)
   mengeluarkan 0 kode salah di SELURUH 139 fixture dan membaca lebih banyak
   fixture perangkat asli (ensemble 9/11 vs 4/11).
   ARSITEKTUR BARU:
   (1) Mesin utama = ZXing C++ via WASM (js/zxingwasm.js + wasm tertanam
       base64 di js/zxing_reader_b64.js — TANPA fetch, supaya andal di
       WebView file://). Per siklus baca, strategi bergilir — sejak putaran 3
       crop tengah didahulukan (lihat STRATS & catatan putaran 3 di bawah).
   (2) Mesin lama (@zxing/library) tetap ada sebagai FALLBACK bila WASM
       gagal disiapkan (timeout 5 dtk / error berulang).
   (3) Penerimaan (kalibrasi dari benchmark): hasil kamera wajib lolos
       validasi digit cek EAN/UPC DAN sama dari >=2 pembacaan — dalam rentang
       >=300ms, atau tanpa menunggu rentang bila dua bacaan itu datang dari
       strategi berbeda (putaran 3). Mesin baru terbukti tidak mengemisikan
       kode salah, jadi syarat lebih ringan dari 3x/900ms dan scan terasa
       responsif.
   (4) UX anti-macet: bila >=4 detik ada kandidat valid terus-menerus tapi
       tak kunjung stabil, kandidat TERSERING ditawarkan ke kolom ketik
       manual + petunjuk cek angka tercetak di kemasan lalu tap OK — kasir
       yang memutuskan. Bacaan tak-stabil TIDAK PERNAH diterima otomatis.
   Pakai layer MODAL supaya bisa dibuka dari atas sheet form tanpa menutupnya.
   Di APK: izin CAMERA ditangani native (MainActivity.onPermissionRequest).

   PUTARAN 3 — tuning responsivitas (vonis perangkat atas putaran 2: akurasi
   diterima, tapi scan barcode KECIL di samping bungkus rokok terasa kurang
   responsif). Benchmark fixture barcode kecil (frame 640/720/1080p, barcode
   15–30% lebar frame) membuktikan: decode WASM hanya 1–26 ms — yang membuat
   lambat adalah CADENCE putaran 2 (interval 240 ms + strategi frame-penuh
   duluan + syarat rentang 300 ms), dan pada stream resolusi rendah barcode
   1,1 px/modul HANYA terbaca lewat crop tengah yang di-upscale 2x. Maka:
   (1) stream kamera diminta 1920x1080 ideal (lebih banyak piksel per batang);
   (2) urutan strategi dibalik — crop tengah 2x duluan, frame penuh terakhir —
       dan interval siklus 240 -> 120 ms (guard _busy tetap: maksimal satu
       decode berjalan, jadi siklus berbasis anggaran waktu, bukan antrean);
   (3) penerimaan lintas strategi: 2 bacaan sama dari strategi BERBEDA
       (crop/binarizer berbeda = bukti independen) diterima tanpa menunggu
       rentang 300 ms; strategi sama tetap aturan lama. Digit cek tetap wajib.
       Pagar tambahan dari sapuan yang sama: bacaan yang hanya datang dari
       input upscale-2x tidak diterima otomatis (satu fixture rotasi terbukti
       bisa mengemisikan phantom lewat jalur upscale BILINEAR) — wajib
       korroborasi dari input skala asli, atau jadi saran manual.
   Opsi downscale internal zxing-cpp diuji (default / off / faktor 2):
   TIDAK berpengaruh di semua fixture — tidak diubah. */
var Scan = {
  _stream: null, _reader: null, _cb: null, _done: false,
  _pendCode: null, _pendCount: 0, _pendSince: 0, _pendStrats: null, _pendNative: false,
  NEED_READS: 2, MIN_SPAN_MS: 300,
  /* kandidat utk saran konfirmasi manual (butir 4) */
  _cand: null, _candOrder: null, _candFirstAt: 0, _candAt: null,
  _suggested: null, _userTyped: false, SUGGEST_AFTER_MS: 4000,
  /* mesin wasm */
  _engine: null, _wasmState: 'idle', _wasmBytes: null, _wasmOverrides: null,
  _loopTimer: null, _busy: false, _busyAt: 0, _stratIdx: 0, _errCount: 0, _canvas: null,

  FORMATS: function () {
    var BF = ZXing.BarcodeFormat;
    return [BF.QR_CODE,
      BF.EAN_13, BF.EAN_8, BF.UPC_A, BF.UPC_E,
      BF.CODE_128, BF.CODE_39];
  },
  WASM_FORMATS: ['EAN13', 'EAN8', 'UPCA', 'UPCE', 'Code128', 'Code39', 'QRCode'],
  /* strategi siklus baca wasm: [crop, binarizer] bergilir tiap tick.
     PUTARAN 3: wilayah tengah (tempat barcode diarahkan) diproses DULU —
     crop 2x, crop 1x, baru frame penuh sebagai cadangan. */
  STRATS: [['center2', 'LocalAverage'], ['center2', 'FixedThreshold'], ['center', 'LocalAverage'], ['center', 'FixedThreshold'], [null, 'LocalAverage'], [null, 'FixedThreshold']],

  /* --- normalisasi format: enum ZXing-JS ATAU nama zxing-cpp -> kunci --- */
  _fmtKey: function (format) {
    if (typeof format === 'string') {
      var s = format.replace(/[-\s]/g, '').toUpperCase();
      var map = { EAN13: 'EAN_13', EAN8: 'EAN_8', UPCA: 'UPC_A', UPCE: 'UPC_E', CODE128: 'CODE_128', CODE39: 'CODE_39', QRCODE: 'QR_CODE' };
      return map[s] || s;
    }
    if (typeof ZXing !== 'undefined' && ZXing.BarcodeFormat) {
      var BF = ZXing.BarcodeFormat;
      for (var k in BF) if (BF[k] === format) return k;
    }
    return '';
  },

  /* --- validasi digit cek (mod-10) untuk keluarga EAN/UPC --- */
  _mod10: function (digits, weights) {
    var sum = 0;
    for (var i = 0; i < weights.length; i++) sum += (digits.charCodeAt(i) - 48) * weights[i];
    return (10 - (sum % 10)) % 10 === (digits.charCodeAt(digits.length - 1) - 48);
  },
  _upceToUpca: function (code) {
    // code: 8 digit UPC-E (sistem angka + 6 digit + cek) -> UPC-A 12 digit
    var ns = code.charAt(0), d = code.substr(1, 6), c = code.charAt(7), mid;
    var last = d.charAt(5);
    if (last === '0' || last === '1' || last === '2') mid = d.substr(0, 2) + last + '0000' + d.substr(2, 3);
    else if (last === '3') mid = d.substr(0, 3) + '00000' + d.substr(3, 2);
    else if (last === '4') mid = d.substr(0, 4) + '00000' + d.charAt(4);
    else mid = d.substr(0, 5) + '0000' + last;
    return ns + mid + c;
  },
  validCode: function (text, format) {
    var key = this._fmtKey(format);
    if (!text) return false;
    if (key === 'EAN_13') {
      if (!/^\d{13}$/.test(text)) return false;
      return this._mod10(text, [1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3]);
    }
    if (key === 'UPC_A') {
      if (!/^\d{12}$/.test(text)) return false;
      return this._mod10(text, [3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3]);
    }
    if (key === 'EAN_8') {
      if (!/^\d{8}$/.test(text)) return false;
      return this._mod10(text, [3, 1, 3, 1, 3, 1, 3]);
    }
    if (key === 'UPC_E') {
      if (!/^\d{8}$/.test(text)) return false;
      return this._mod10(this._upceToUpca(text), [3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3]);
    }
    // QR / Code-128 / Code-39: checksum internal mesin + syarat baca-stabil di _feed
    return true;
  },

  /* Beri satu hasil decode kamera; true bila SUDAH boleh diterima (stabil+valid).
     strat = kunci strategi asal bacaan (crop|binarizer). PUTARAN 3: dua bacaan
     sama dari strategi BERBEDA diterima tanpa menunggu rentang — dua jalur
     binarisasi/crop yang independen menghasilkan kode yang sama adalah bukti
     lebih kuat daripada dua bacaan strategi yang sama. Panggilan tanpa strat
     (mesin JS fallback / uji lama) diperlakukan satu strategi tetap, sehingga
     aturannya persis perilaku putaran 2. */
  _feed: function (text, format, strat) {
    if (!this.validCode(text, format)) return false;
    var now = (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0;
    var skey = strat || 'legacy';
    /* statistik kandidat utk saran manual (butir 4) */
    if (!this._cand) { this._cand = {}; this._candOrder = []; this._candAt = {}; }
    if (!this._cand[text]) {
      this._cand[text] = 0; this._candOrder.push(text);
      /* R-09 (audit putaran 2): catat waktu pertama PER KANDIDAT —
         jam saran 4 dtk berjalan per kandidat, bukan per sesi, jadi
         satu bacaan nyasar di awal sesi tidak membuat saran untuk
         produk berikutnya muncul terlalu dini. */
      if (this._candAt) this._candAt[text] = now;
    }
    this._cand[text]++;
    if (!this._candFirstAt) this._candFirstAt = now;
    /* stabilitas + pagar korroborasi skala (putaran 3): sapuan benchmark
       menemukan input upscale-2x (interpolasi BILINEAR) bisa mengemisikan
       phantom perangkat lama 8199168211242 pada SATU fixture rotasi —
       emisi itu hilang total dengan interpolasi LANCZOS/NEAREST, tapi
       interpolasi canvas peramban tidak bisa kami kendalikan. Maka bacaan
       yang HANYA datang dari input upscale tidak pernah diterima otomatis:
       ia wajib dikorroborasi bacaan dari input skala asli (center/full),
       atau jatuh ke jalur saran manual (kasir mencocokkan angka tercetak).
       Bacaan tanpa strat (mesin JS fallback) dihitung skala asli. */
    var nativeRead = skey.indexOf('center2|') !== 0;
    if (text === this._pendCode) {
      this._pendCount++;
      if (this._pendStrats) this._pendStrats[skey] = 1;
      if (nativeRead) this._pendNative = true;
    } else {
      this._pendCode = text; this._pendCount = 1; this._pendSince = now;
      this._pendStrats = {}; this._pendStrats[skey] = 1;
      this._pendNative = nativeRead;
    }
    this._status();
    var distinct = 0, k;
    if (this._pendStrats) for (k in this._pendStrats) distinct++;
    var accepted = this._pendNative && this._pendCount >= this.NEED_READS &&
      ((now - this._pendSince) >= this.MIN_SPAN_MS || distinct >= 2);
    if (!accepted) this._maybeSuggest();
    return accepted;
  },
  _resetPend: function () { this._pendCode = null; this._pendCount = 0; this._pendSince = 0; this._pendStrats = null; this._pendNative = false; },
  _resetCand: function () {
    this._cand = null; this._candOrder = null; this._candFirstAt = 0; this._candAt = null;
    this._suggested = null; this._userTyped = false;
  },
  _status: function () {
    var el = (typeof document !== 'undefined') ? document.getElementById('scanStatus') : null;
    if (el && this._pendCode) {
      el.textContent = T('Terbaca: ') + this._pendCode + T(' — tahan posisi sebentar (memastikan ') + Math.min(this._pendCount, this.NEED_READS) + '/' + this.NEED_READS + ')';
    }
  },

  /* Butir 4: tawarkan kandidat tersering ke kolom manual setelah 4 dtk tak stabil.
     Tidak pernah menimpa ketikan pengguna; tidak pernah menerima otomatis. */
  _maybeSuggest: function () {
    if (this._done || !this._cand || !this._candFirstAt) return;
    var now = (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0;
    var best = null, bestN = 0, i;
    for (i = 0; i < this._candOrder.length; i++) {
      var c = this._candOrder[i];
      if (this._cand[c] > bestN) { best = c; bestN = this._cand[c]; }
    }
    if (!best || bestN < 2 || best === this._suggested) return;
    /* R-09: ambang 4 dtk dihitung dari kemunculan pertama KANDIDAT
       TERPILIH ini, bukan kandidat pertama sesi. */
    var firstAt = (this._candAt && this._candAt[best]) || this._candFirstAt;
    if (now - firstAt < this.SUGGEST_AFTER_MS) return;
    var el = (typeof document !== 'undefined') ? document.getElementById('scanManual') : null;
    if (!el) return;
    if (el.value && el.value !== this._suggested) { this._userTyped = true; return; }
    if (this._userTyped) return;
    el.value = best;
    this._suggested = best;
    var hint = document.getElementById('scanHint');
    if (hint) {
      hint.textContent = T('Belum stabil terbaca. Kandidat: ') + best + T(' — cek angka tercetak di kemasan; kalau sama persis, tap OK. Kalau beda, perbaiki angkanya dulu.');
      hint.style.display = 'block';
    }
    this._status();
  },

  /* ================= mesin WASM (utama) ================= */
  _initWasm: function () {
    if (this._wasmState === 'ready' || this._wasmState === 'failed' || this._wasmState === 'loading') return;
    if (typeof ZXingWASM === 'undefined' || !ZXingWASM.readBarcodes ||
        typeof ZXING_READER_WASM_B64 === 'undefined') { this._wasmState = 'failed'; return; }
    this._wasmState = 'loading';
    var self = this;
    try {
      if (!this._wasmBytes) {
        var bin = atob(ZXING_READER_WASM_B64);
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        this._wasmBytes = bytes;
      }
      /* A2-05 (audit putaran 2): locateFile DITIMPA agar tidak pernah
         menunjuk CDN — bawaan pustaka menunjuk jsDelivr; jalur aplikasi
         memakai wasmBinary lokal, dan bila suatu saat locateFile tetap
         dipanggil, ia GAGAL TEGAS (lempar) bukan diam-diam fetch CDN.
         Janji offline tidak bergantung pada urutan muat skrip saja. */
      this._wasmOverrides = {
        wasmBinary: this._wasmBytes,
        locateFile: function () { throw new Error('locateFile ZXing dinonaktifkan — WASM hanya dari biner lokal (offline)'); }
      };
      ZXingWASM.setZXingModuleOverrides(this._wasmOverrides);
      ZXingWASM.prepareZXingModule({ fireImmediately: true }).then(function () {
        self._wasmState = 'ready';
      }, function () { self._wasmState = 'failed'; });
    } catch (e) { this._wasmState = 'failed'; }
  },
  _wasmOpts: function (bin) {
    return { formats: this.WASM_FORMATS, tryHarder: true, tryRotate: true, maxNumberOfSymbols: 1, binarizer: bin };
  },
  _capture: function (video, crop) {
    var vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return null;
    var sx = 0, sy = 0, sw = vw, sh = vh;
    if (crop === 'center' || crop === 'center2') { sx = vw * 0.12; sy = vh * 0.22; sw = vw * 0.76; sh = vh * 0.56; }
    var scale;
    if (crop === 'center2') {
      /* upscale 2x wilayah tengah: modul batang tipis (barcode kecil di
         samping bungkus) jadi terbaca; hasil dibatasi maks 1600px agar
         biaya decode tetap ringan. */
      scale = Math.min(2, 1600 / Math.max(sw, sh));
    } else {
      scale = Math.min(1, 1280 / Math.max(sw, sh));
    }
    var tw = Math.max(2, Math.round(sw * scale)), th = Math.max(2, Math.round(sh * scale));
    if (!this._canvas) this._canvas = document.createElement('canvas');
    this._canvas.width = tw; this._canvas.height = th;
    var ctx = this._canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, tw, th);
    return ctx.getImageData(0, 0, tw, th);
  },
  /* R-07 (audit putaran 2): satu-satunya jalur pencatat error decode
     WASM — dipakai rejection handler, lemparan sinkron, dan watchdog.
     3x beruntun -> jatuhkan ke mesin JS untuk sesi ini. */
  _noteWasmError: function () {
    if (this._done) return;
    if (++this._errCount >= 3 && this._engine === 'wasm') {
      this._engine = 'js';
      if (this._loopTimer) { clearInterval(this._loopTimer); this._loopTimer = null; }
      this._startJsEngine();
    }
  },
  _loopTick: function () {
    if (this._done) return;
    if (this._busy) {
      /* R-07 watchdog: decode yang tidak pernah settle (> ±2 dtk)
         dianggap error — _busy dilepas & penghitung fallback berjalan,
         scanner tidak membeku permanen dalam satu sesi. */
      if (this._busyAt && Date.now() - this._busyAt > 2000) {
        this._busy = false; this._busyAt = 0;
        this._noteWasmError();
        return; // frame berikutnya memulai decode segar
      } else return;
    }
    this._maybeSuggest();
    var v = document.getElementById('scanVideo');
    if (!v || !v.videoWidth) return;
    var strat = this.STRATS[this._stratIdx++ % this.STRATS.length];
    var img;
    try { img = this._capture(v, strat[0]); } catch (e) { img = null; }
    if (!img) return;
    this._busy = true;
    this._busyAt = Date.now();
    var self = this;
    var promise;
    try {
      promise = ZXingWASM.readBarcodes(img, this._wasmOpts(strat[1]));
    } catch (e) {
      /* R-07: lemparan SINKRON tidak boleh meninggalkan _busy terkunci */
      this._busy = false; this._busyAt = 0;
      this._noteWasmError();
      return;
    }
    promise.then(function (res) {
      self._busy = false; self._busyAt = 0;
      if (self._done) return;
      self._errCount = 0;
      if (res && res.length) {
        var code = String(res[0].text || '').trim();
        if (code && self._feed(code, res[0].format, (strat[0] || 'full') + '|' + strat[1])) self._accept(code);
      }
    }, function () {
      self._busy = false; self._busyAt = 0;
      self._noteWasmError();
    });
  },

  /* ================= mesin JS (fallback) ================= */
  _startJsEngine: function () {
    if (this._done) return;
    if (typeof ZXing === 'undefined' || !ZXing.BrowserMultiFormatReader) return;
    var hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, this.FORMATS());
    try { this._reader = new ZXing.BrowserMultiFormatReader(hints, 250); }
    catch (e) { return; }
    var v = document.getElementById('scanVideo');
    if (!v) return;
    var self = this;
    try {
      this._reader.decodeFromVideoElementContinuously(v, function (result, err) {
        if (self._done) return;
        if (result) {
          var code = String(result.getText()).trim();
          if (code && self._feed(code, result.getBarcodeFormat())) self._accept(code);
        }
      });
    } catch (e) {}
  },

  _accept: function (code) {
    this._done = true;
    try { if (navigator.vibrate) navigator.vibrate(80); } catch (e) {}
    var cb = this._cb;
    this.close();
    if (cb) cb(code);
  },

  open: function (cb) {
    if ((typeof ZXingWASM === 'undefined' || !ZXingWASM.readBarcodes) &&
        (typeof ZXing === 'undefined' || !ZXing.BrowserMultiFormatReader)) { UI.toast(T('Pustaka scan belum termuat')); return; }
    this._cb = cb; this._done = false; this._resetPend(); this._resetCand();
    this._engine = null; this._stratIdx = 0; this._errCount = 0; this._busy = false; this._busyAt = 0;
    this._initWasm();
    var cam = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    UI.openModal(
      T('<h3 class="k-sheet-t">📷 Scan Kode Produk</h3>') +
      T('<p class="k-muted" style="font-size:13px;margin:0 0 10px">Arahkan kamera ke QR / barcode produk') +
      (cam ? '' : T(' (kamera tidak tersedia di perangkat ini)')) + '</p>' +
      (cam ? '<video id="scanVideo" playsinline muted style="width:100%;border-radius:12px;background:#000;min-height:220px"></video><div id="scanStatus" style="min-height:18px;font-size:13px;font-weight:700;color:var(--brand);margin-top:8px"></div><div id="scanHint" style="display:none;font-size:13px;line-height:1.45;background:#FFF7E0;border:1px solid #E8C86A;color:#6B5310;border-radius:10px;padding:8px 10px;margin-top:8px"></div>' : '') +
      '<div style="display:flex;align-items:center;gap:10px;margin:16px 0 12px">' +
      '<div style="flex:1;height:1px;background:var(--line)"></div>' +
      '<span style="font-size:13px;font-weight:700;color:var(--muted);white-space:nowrap">' + T('Atau ketik manual') + '</span>' +
      '<div style="flex:1;height:1px;background:var(--line)"></div></div>' +
      '<div style="display:flex;gap:8px;align-items:stretch">' +
      '<input class="k-in" id="scanManual" placeholder="' + T('cth: 8991234567890') + '" style="flex:1 1 auto;width:1px;min-width:0" autocomplete="off">' +
      '<button class="k-btn k-pri" onclick="Scan.manualGo()" style="flex:0 0 auto;width:auto;padding:12px 20px;box-shadow:0 2px 8px rgba(0,0,0,.18)">OK</button></div>' +
      T('<div class="k-btn-row" style="margin-top:12px"><button class="k-btn k-ghost" onclick="Scan.close()">Batal</button></div>')
    );
    var mi = document.getElementById('scanManual');
    if (mi && mi.addEventListener) {
      var self0 = this;
      mi.addEventListener('input', function () {
        if (mi.value !== self0._suggested) self0._userTyped = true;
      });
    }
    if (!cam) return;
    var self = this;
    try {
      /* ideal (bukan exact): perangkat yang tak sanggup 1080p tetap memberi
         resolusi terbaiknya tanpa OverconstrainedError. */
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
        .then(function (s) { self._start(s); }, function (e) { self._fail(e); });
    } catch (e) { this._fail(e); }
  },

  _start: function (stream) {
    /* D-04 (audit putaran 2): simpan stream DULU sebelum cek elemen /
       _done — sheet bisa sudah ditutup selagi getUserMedia pending;
       tanpa ini stream yang baru diberikan tidak pernah dihentikan
       (kamera menyala tanpa UI sampai halaman dimuat ulang). _stop()
       di cabang bawah kini benar-benar melepas track stream ini. */
    this._stream = stream;
    var v = document.getElementById('scanVideo');
    if (!v || this._done) { this._stop(); return; }
    v.srcObject = stream;
    var self = this;
    v.onloadedmetadata = function () {
      try { v.play(); } catch (e) {}
      /* Pilih mesin: WASM bila siap <=5 dtk, selain itu JS. Polling ringan
         hanya selama modal terbuka. */
      var waited = 0;
      var pick = setInterval(function () {
        if (self._done) { clearInterval(pick); return; }
        waited += 200;
        if (self._wasmState === 'ready') {
          clearInterval(pick);
          self._engine = 'wasm';
          /* 120 ms (putaran 3): guard _busy di _loopTick memastikan maksimal
             satu decode berjalan — siklus efektif = maks(120ms, lama decode),
             jadi frame yang sudah memberi hasil tidak menunggu antrean. */
          self._loopTimer = setInterval(function () { self._loopTick(); }, 120);
        } else if (self._wasmState === 'failed' || waited >= 5000) {
          clearInterval(pick);
          self._engine = 'js';
          self._startJsEngine();
        }
      }, 200);
    };
  },

  manualGo: function () {
    var el = document.getElementById('scanManual');
    var code = el ? String(el.value).trim() : '';
    if (!code) { UI.toast(T('Ketik dulu kodenya, bro')); return; }
    this._done = true;
    var cb = this._cb;
    this.close();
    if (cb) cb(code);
  },

  _fail: function (e) {
    this._stop();
    var n = (e && e.name) || '';
    if (n === 'NotAllowedError' || n === 'SecurityError') {
      UI.toast(T('Izin kamera ditolak — izinkan di Pengaturan HP, atau ketik manual'));
    } else if (n === 'NotFoundError' || n === 'OverconstrainedError') {
      UI.toast(T('Kamera tidak ditemukan — silakan ketik manual'));
    } else {
      UI.toast(T('Kamera tidak bisa dibuka — silakan ketik manual'));
    }
  },

  _stop: function () {
    this._done = true;
    this._resetPend(); this._resetCand();
    if (this._loopTimer) { clearInterval(this._loopTimer); this._loopTimer = null; }
    if (this._reader) {
      try { this._reader.reset(); } catch (e) {}
      this._reader = null;
    }
    if (this._stream) {
      try { this._stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      this._stream = null;
    }
  },

  close: function () {
    this._stop();
    this._cb = null;
    UI.closeModal();
  }
};
