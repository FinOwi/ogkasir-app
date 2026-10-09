/* OGKasir - pengaturan: profil toko, backup, PIN, tema */
var Set = {
  render: function () {
    var s = KDB.data.settings;
    var h = Lic.licCard();
    h += Upd.card();
    h += '<div class="k-card"><h3>🏪 Profil Toko</h3>' +
      '<div class="k-fld"><label>Nama toko</label><input class="k-in" id="sShop" value="' + K.esc(s.shop) + '"></div>' +
      '<div class="k-fld"><label>Alamat (muncul di struk)</label><input class="k-in" id="sAddr" value="' + K.esc(s.addr) + '" placeholder="cth: Jl. Merdeka No. 10"></div>' +
      '<div class="k-fld"><label>Catatan kaki struk</label><input class="k-in" id="sFoot" value="' + K.esc(s.foot) + '"></div>' +
      '<button class="k-btn k-pri" onclick="Set.saveProfile()">Simpan Profil</button></div>';

    h += '<div class="k-card"><h3>💾 Data & Backup</h3>' +
      '<div class="k-small k-muted" style="margin-bottom:10px">' + KDB.data.menus.length + ' menu • ' +
      KDB.data.txs.filter(function (t) { return !t.voided; }).length + ' transaksi</div>' +
      '<div class="k-btn-row" style="margin-top:0"><button class="k-btn k-sec" onclick="Set.backup()">⬆️ Backup</button>' +
      '<button class="k-btn k-sec" onclick="Set.restore()">⬇️ Restore</button></div>' +
      '<button class="k-btn k-sec" style="margin-top:10px" onclick="UI.openLastExport()">📂 Buka Export Terakhir</button>' +
      '<button class="k-btn k-danger" style="margin-top:10px" onclick="Set.wipe()">🗑️ Hapus Semua Data</button></div>';

    h += '<div class="k-card"><h3>🔒 Keamanan</h3>' +
      '<div class="k-row"><div><b>PIN Aplikasi</b><div class="k-small k-muted">' + (s.pin ? 'Aktif — diminta saat buka aplikasi' : 'Nonaktif') + '</div></div>' +
      '<button class="k-chip" onclick="Set.pinForm()">' + (s.pin ? 'Ubah' : 'Aktifkan') + '</button></div>' +
      (s.pin ? '<button class="k-btn k-ghost" style="margin-top:8px" onclick="Set.pinOff()">Matikan PIN</button>' : '') + '</div>';

    h += '<div class="k-card"><h3>🎨 Tampilan</h3><div class="k-seg">' +
      '<button class="' + (s.theme === 'light' ? 'k-on' : '') + '" onclick="Set.theme(\'light\')">☀️ Terang</button>' +
      '<button class="' + (s.theme === 'dark' ? 'k-on' : '') + '" onclick="Set.theme(\'dark\')">🌙 Gelap</button></div></div>';

    var ver = '?';
    try { if (window.KasirKuNative && KasirKuNative.appVersion) ver = KasirKuNative.appVersion(); } catch (e) {}
    h += '<div class="k-card"><h3>ℹ️ Tentang</h3>' +
      '<div class="k-row"><div><b>OGKasir</b><div class="k-small k-muted">Aplikasi kasir warkop & F&B • v' + K.esc(ver) + '</div></div>' +
      '<div style="font-size:34px">☕</div></div>' +
      '<div class="k-row" style="margin-top:10px"><div><b>📸 Instagram</b><div class="k-small k-muted">@ogkasir</div></div>' +
      '<button class="k-chip" onclick="UI.openLink(\'https://www.instagram.com/ogkasir\')">Buka</button></div>' +
      '<div class="k-row" style="margin-top:8px"><div><b>💬 WhatsApp</b><div class="k-small k-muted">+62 882-7940-6268</div></div>' +
      '<button class="k-chip" onclick="UI.openLink(\'https://wa.me/6288279406268\')">Chat</button></div>' +
      '<div class="k-small k-muted" style="margin-top:8px">Data tersimpan aman di HP ini (offline).</div></div>';
    return h;
  },

  saveProfile: function () {
    var s = KDB.data.settings;
    s.shop = document.getElementById('sShop').value.trim() || 'Warkop Saya';
    s.addr = document.getElementById('sAddr').value.trim();
    s.foot = document.getElementById('sFoot').value.trim();
    KDB.save();
    UI.toast('Profil toko tersimpan');
    App.renderHeader();
  },

  backup: function () {
    var json = JSON.stringify(KDB.data);
    var d = new Date();
    function p2(x) { return (x < 10 ? '0' : '') + x; }
    UI.saveFile('ogkasir-backup-' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '.json', json, 'application/json');
  },
  restore: function () {
    document.getElementById('kFilePick').click();
  },
  doRestore: function (text) {
    try {
      var d = JSON.parse(text);
      if (!d.menus || !d.settings) throw new Error('format salah');
      var self = this;
      UI.confirm('Restore akan MENGGANTI semua data saat ini dengan file backup. Lanjut?', 'Restore', function () {
        KDB.data = d;
        Lic.init(); // verifikasi ulang lisensi untuk device ini
        KDB.save();
        App.applyTheme();
        App.renderHeader();
        UI.toast('Restore berhasil');
        App.rerender();
      });
    } catch (e) { UI.toast('File backup tidak valid'); }
  },

  wipe: function () {
    UI.confirm('Hapus SEMUA data (menu, transaksi, stok)? Tindakan ini tidak bisa dibatalkan.', 'Hapus Semua', function () {
      KDB.wipe();
      Kasir.cart = {};
      UI.toast('Semua data dihapus');
      App.applyTheme();
      App.renderHeader();
      App.rerender();
    });
  },

  pinForm: function () {
    var has = !!KDB.data.settings.pin;
    UI.openModal('<h3 class="k-sheet-t">🔒 ' + (has ? 'Ubah' : 'Aktifkan') + ' PIN</h3>' +
      '<div class="k-fld"><label>PIN 6 digit</label><input class="k-in" id="kPin1" type="password" inputmode="numeric" maxlength="6" placeholder="••••••"></div>' +
      '<div class="k-fld"><label>Ulangi PIN</label><input class="k-in" id="kPin2" type="password" inputmode="numeric" maxlength="6" placeholder="••••••"></div>' +
      '<div class="k-btn-row"><button class="k-btn k-ghost" onclick="UI.closeModal()">Batal</button>' +
      '<button class="k-btn k-pri" onclick="Set.pinSave()">Simpan</button></div>');
  },
  pinSave: function () {
    var a = document.getElementById('kPin1').value, b = document.getElementById('kPin2').value;
    if (!/^[0-9]{6}$/.test(a)) { UI.toast('PIN harus 6 digit angka'); return; }
    if (a !== b) { UI.toast('PIN tidak sama'); return; }
    KDB.data.settings.pin = a;
    KDB.save();
    UI.closeModal();
    UI.toast('PIN aktif');
    App.rerender();
  },
  pinOff: function () {
    UI.confirm('Matikan PIN aplikasi?', 'Matikan', function () {
      KDB.data.settings.pin = '';
      KDB.save();
      UI.toast('PIN dimatikan');
      App.rerender();
    });
  },

  theme: function (t) {
    KDB.data.settings.theme = t;
    KDB.save();
    App.applyTheme();
    App.rerender();
  }
};
