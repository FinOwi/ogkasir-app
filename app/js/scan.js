/* OGKasir - Scan kode produk via kamera (live viewfinder).
   Mesin: @zxing/library (BrowserMultiFormatReader) — format dibatasi ke
   keluarga ritel: EAN-13/8, UPC-A/E, Code-128/39, QR.
   PERBAIKAN 6 Nov 2026 (bug salah baca barcode ESSE 8999168211248 terbaca
   jadi kode sampah): reader EAN/UPC bisa mengeluarkan kode SALAH yang lolos
   digit cek bila batang terdistorsi (miring/blur di feed video), dan dulu
   hasil frame pertama langsung diterima. Sekarang hasil scan kamera wajib:
   (1) lolos validasi digit cek untuk EAN-13/EAN-8/UPC-A/UPC-E, dan
   (2) sama persis dari >=3 pembacaan berurutan dalam rentang >=900ms
   sebelum diteruskan ke pemanggil. Ketik manual tetap bebas seperti dulu.
   Pakai layer MODAL supaya bisa dibuka dari atas sheet form tanpa menutupnya.
   Di APK: izin CAMERA ditangani native (MainActivity.onPermissionRequest). */
var Scan = {
  _stream: null, _reader: null, _cb: null, _done: false,
  _pendCode: null, _pendCount: 0, _pendSince: 0,
  NEED_READS: 3, MIN_SPAN_MS: 900,

  FORMATS: function () {
    var BF = ZXing.BarcodeFormat;
    return [BF.QR_CODE,
      BF.EAN_13, BF.EAN_8, BF.UPC_A, BF.UPC_E,
      BF.CODE_128, BF.CODE_39];
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
    var BF = ZXing.BarcodeFormat;
    if (!text) return false;
    if (format === BF.EAN_13) {
      if (!/^\d{13}$/.test(text)) return false;
      return this._mod10(text, [1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3]);
    }
    if (format === BF.UPC_A) {
      if (!/^\d{12}$/.test(text)) return false;
      return this._mod10(text, [3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3]);
    }
    if (format === BF.EAN_8) {
      if (!/^\d{8}$/.test(text)) return false;
      return this._mod10(text, [3, 1, 3, 1, 3, 1, 3]);
    }
    if (format === BF.UPC_E) {
      if (!/^\d{8}$/.test(text)) return false;
      return this._mod10(this._upceToUpca(text), [3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3]);
    }
    // QR / Code-128 / Code-39: checksum internal library + syarat baca-stabil di _feed
    return true;
  },

  /* Beri satu hasil decode kamera; true bila SUDAH boleh diterima (stabil+valid). */
  _feed: function (text, format) {
    if (!this.validCode(text, format)) return false;
    var now = (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0;
    if (text === this._pendCode) { this._pendCount++; }
    else { this._pendCode = text; this._pendCount = 1; this._pendSince = now; }
    this._status();
    return this._pendCount >= this.NEED_READS && (now - this._pendSince) >= this.MIN_SPAN_MS;
  },
  _resetPend: function () { this._pendCode = null; this._pendCount = 0; this._pendSince = 0; },
  _status: function () {
    var el = (typeof document !== 'undefined') ? document.getElementById('scanStatus') : null;
    if (el && this._pendCode) {
      el.textContent = T('Terbaca: ') + this._pendCode + T(' — tahan posisi sebentar (memastikan ') + Math.min(this._pendCount, this.NEED_READS) + '/' + this.NEED_READS + ')';
    }
  },

  open: function (cb) {
    if (!window.ZXing || !ZXing.BrowserMultiFormatReader) { UI.toast(T('Pustaka scan belum termuat')); return; }
    this._cb = cb; this._done = false; this._resetPend();
    var cam = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    var hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, this.FORMATS());
    try { this._reader = new ZXing.BrowserMultiFormatReader(hints, 250); }
    catch (e) { UI.toast(T('Scan tidak bisa dimulai')); return; }
    UI.openModal(
      T('<h3 class="k-sheet-t">📷 Scan Kode Produk</h3>') +
      T('<p class="k-muted" style="font-size:13px;margin:0 0 10px">Arahkan kamera ke QR / barcode produk') +
      (cam ? '' : T(' (kamera tidak tersedia di perangkat ini)')) + '</p>' +
      (cam ? '<video id="scanVideo" playsinline muted style="width:100%;border-radius:12px;background:#000;min-height:220px"></video><div id="scanStatus" style="min-height:18px;font-size:13px;font-weight:700;color:var(--brand);margin-top:8px"></div>' : '') +
      '<div style="display:flex;align-items:center;gap:10px;margin:16px 0 12px">' +
      '<div style="flex:1;height:1px;background:var(--line)"></div>' +
      '<span style="font-size:13px;font-weight:700;color:var(--muted);white-space:nowrap">' + T('Atau ketik manual') + '</span>' +
      '<div style="flex:1;height:1px;background:var(--line)"></div></div>' +
      '<div style="display:flex;gap:8px;align-items:stretch">' +
      '<input class="k-in" id="scanManual" placeholder="' + T('cth: 8991234567890') + '" style="flex:1 1 auto;width:1px;min-width:0" autocomplete="off">' +
      '<button class="k-btn k-pri" onclick="Scan.manualGo()" style="flex:0 0 auto;width:auto;padding:12px 20px;box-shadow:0 2px 8px rgba(0,0,0,.18)">OK</button></div>' +
      T('<div class="k-btn-row" style="margin-top:12px"><button class="k-btn k-ghost" onclick="Scan.close()">Batal</button></div>')
    );
    if (!cam) return;
    var self = this;
    try {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        .then(function (s) { self._start(s); }, function (e) { self._fail(e); });
    } catch (e) { this._fail(e); }
  },

  _start: function (stream) {
    var v = document.getElementById('scanVideo');
    if (!v) { this._stop(); return; }
    this._stream = stream;
    v.srcObject = stream;
    var self = this;
    v.onloadedmetadata = function () {
      try { v.play(); } catch (e) {}
      try {
        self._reader.decodeFromVideoElementContinuously(v, function (result, err) {
          if (self._done) return;
          if (result) {
            var code = String(result.getText()).trim();
            // Tolak diam-diam hasil yang gagal digit cek / belum stabil —
            // scanner terus memindai, JANGAN teruskan ke pemanggil dulu.
            if (!code || !self._feed(code, result.getBarcodeFormat())) return;
            self._done = true;
            try { if (navigator.vibrate) navigator.vibrate(80); } catch (e) {}
            var cb = self._cb;
            self.close();
            if (cb) cb(code);
          }
          // err (NotFoundException tiap frame) diabaikan
        });
      } catch (e) { self._fail(e); }
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
    this._resetPend();
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
