/* OGKasir - printer thermal Bluetooth (ESC/POS, 58mm) */
var Printer = {
  connected: false, name: '', mac: '',
  _pendingMac: '', _permCb: null, _silent: false,

  hasBridge: function () { return !!(window.OGKasirPrinter); },

  init: function () {
    // auto-connect diam-diam ke printer yang tersimpan (tanpa toast bila gagal)
    try {
      var s = KDB.data.settings;
      if (s && s.printerMac && this.hasBridge() && OGKasirPrinter.hasPermission()) {
        this._pendingMac = s.printerMac;
        this._silent = true;
        OGKasirPrinter.connectPrinter(s.printerMac);
      }
    } catch (e) {}
  },

  statusLine: function () {
    try {
      if (this.hasBridge()) {
        var st = JSON.parse(OGKasirPrinter.printerStatus() || '{}');
        this.connected = !!st.connected;
        if (this.connected) {
          this.name = st.name || '';
          this.mac = st.mac || '';
        }
      }
    } catch (e) {}
    if (!this.hasBridge()) return '<span class="k-muted">Tidak tersedia di perangkat ini</span>';
    if (this.connected && this.name)
      return '🟢 Terhubung: <b>' + K.esc(this.name) + '</b>';
    return '⚪ Belum terhubung';
  },

  ensurePerm: function (cb) {
    try {
      if (!this.hasBridge()) { cb(false); return; }
      if (OGKasirPrinter.hasPermission()) { cb(true); return; }
      this._permCb = cb;
      OGKasirPrinter.requestPermission();
    } catch (e) { cb(false); }
  },

  pick: function () {
    var self = this;
    if (!this.hasBridge()) { UI.toast('Printer tidak didukung di perangkat ini'); return; }
    try {
      if (!OGKasirPrinter.btAvailable()) { UI.toast('HP ini tidak punya Bluetooth'); return; }
      if (!OGKasirPrinter.btEnabled()) {
        UI.confirm('Bluetooth HP sedang mati. Nyalakan dulu?', 'Buka Pengaturan',
          function () { try { OGKasirPrinter.openBtSettings(); } catch (e) {} });
        return;
      }
    } catch (e) { UI.toast('Bluetooth tidak tersedia'); return; }
    this.ensurePerm(function (ok) {
      if (!ok) { UI.toast('Izin Bluetooth ditolak'); return; }
      self.showPicker();
    });
  },

  showPicker: function () {
    var list = [];
    try { list = JSON.parse(OGKasirPrinter.listPrinters() || '[]'); } catch (e) {}
    var h = '<h3 class="k-sheet-t">🖨️ Pilih Printer</h3>';
    if (!list.length) {
      h += '<p class="k-muted" style="font-size:14px;line-height:1.7">Belum ada perangkat ter-pairing.<br>' +
        'Pairing dulu printer thermal-mu di <b>Pengaturan Bluetooth HP</b>, lalu buka lagi menu ini.</p>' +
        '<div class="k-btn-row"><button class="k-btn k-sec" onclick="try{OGKasirPrinter.openBtSettings()}catch(e){}">⚙️ Buka Bluetooth HP</button></div>';
    } else {
      for (var i = 0; i < list.length; i++) {
        h += '<button class="k-btn k-sec" style="margin-bottom:8px;text-align:left" onclick="Printer.connect(\'' +
          K.esc(list[i].mac) + '\')">🖨️ <b>' + K.esc(list[i].name) + '</b>' +
          '<br><span class="k-small k-muted">' + K.esc(list[i].mac) + '</span></button>';
      }
    }
    h += '<div class="k-btn-row"><button class="k-btn k-ghost" onclick="UI.closeSheet()">Tutup</button></div>';
    UI.openSheet(h);
  },

  connect: function (mac) {
    this._pendingMac = mac;
    this._silent = false;
    UI.toast('Menghubungkan printer...');
    try { OGKasirPrinter.connectPrinter(mac); }
    catch (e) { this.onConn(false, ''); }
  },

  /* dipanggil native via window.ogkasirPrinterConn(ok, name) */
  onConn: function (ok, name) {
    this.connected = !!ok;
    if (ok) {
      this.name = name || '';
      this.mac = this._pendingMac || '';
      try {
        KDB.data.settings.printerMac = this.mac;
        KDB.data.settings.printerName = this.name;
        KDB.save();
      } catch (e) {}
      if (!this._silent) {
        UI.toast('✅ Terhubung: ' + this.name);
        UI.closeSheet();
      }
    } else {
      this.name = '';
      this.mac = '';
      if (!this._silent) UI.toast('❌ Gagal terhubung ke printer');
    }
    this._silent = false;
    this._pendingMac = '';
    try { if (App.page === 'set') App.rerender(); } catch (e) {}
  },

  disconnect: function () {
    try { OGKasirPrinter.disconnectPrinter(); } catch (e) {}
    this.connected = false;
    this.name = '';
    this.mac = '';
    try {
      KDB.data.settings.printerMac = '';
      KDB.data.settings.printerName = '';
      KDB.save();
    } catch (e) {}
    UI.toast('Printer diputus');
    try { App.rerender(); } catch (e) {}
  },

  printStruk: function (tx) {
    if (!tx) return;
    if (!this.hasBridge()) { UI.toast('Printer tidak didukung di perangkat ini'); return; }
    if (!this.connected) { UI.toast('Hubungkan printer dulu di Pengaturan → Printer 🖨️'); return; }
    try {
      var ok = OGKasirPrinter.printText(Kasir.receiptText(tx));
      if (ok) UI.toast('🖨️ Struk dikirim ke printer');
      else {
        this.connected = false;
        UI.toast('❌ Gagal mencetak — cek printer lalu hubungkan ulang');
        try { if (App.page === 'set') App.rerender(); } catch (e) {}
      }
    } catch (e) { UI.toast('❌ Gagal mencetak'); }
  },

  testPrint: function () {
    if (!this.hasBridge()) { UI.toast('Printer tidak didukung di perangkat ini'); return; }
    if (!this.connected) { UI.toast('Hubungkan printer dulu, bro 🖨️'); return; }
    try {
      var ok = OGKasirPrinter.printTest();
      UI.toast(ok ? '🖨️ Test print dikirim' : '❌ Gagal — cek printer');
      if (!ok) this.connected = false;
    } catch (e) { UI.toast('❌ Gagal test print'); }
  },

  /* pratinjau teks persis seperti yang dikirim ke printer — tanpa butuh printer fisik */
  preview: function () {
    var tx = null;
    try { tx = (typeof Kasir !== 'undefined' && Kasir.lastTx) || KDB.data.txs[0] || null; } catch (e) {}
    var txt = tx ? Kasir.receiptText(tx)
      : '      CONTOH STRUK\n------------------------------\nBelum ada transaksi.\nBuat transaksi dulu ya bro.\n------------------------------';
    UI.openModal(
      '<h3 class="k-sheet-t">👁️ Pratinjau Struk Printer</h3>' +
      '<pre style="background:#141414;color:#f5f5f5;padding:12px;border-radius:10px;font-size:12px;line-height:1.5;white-space:pre-wrap;font-family:monospace">' +
      K.esc(txt) + '</pre>' +
      '<p class="k-small k-muted">Teks 32 kolom — persis seperti yang dikirim ke printer thermal 58mm.</p>' +
      '<div class="k-btn-row"><button class="k-btn k-pri" onclick="UI.closeModal()">Tutup</button></div>'
    );
  }
};

/* callback dari native (jangan dipanggil manual) */
window.ogkasirPrinterConn = function (ok, name) { Printer.onConn(ok, name); };
window.ogkasirBtPerm = function (ok) {
  if (Printer._permCb) { var cb = Printer._permCb; Printer._permCb = null; cb(!!ok); }
};
