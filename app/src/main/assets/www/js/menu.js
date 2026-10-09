/* OGKasir - kelola menu & kategori */
var Menu = {
  render: function () {
    var D = KDB.data;
    var h = '<div class="k-row" style="margin-bottom:10px"><h3 style="margin:0">🍽️ Daftar Menu</h3>' +
      '<button class="k-chip" onclick="Menu.catMgr()">⚙️ Kategori</button></div>';
    var hasSample = D.menus.some(function (m) { return m.sample; });
    if (hasSample) {
      h += '<div class="k-card" style="border-style:dashed"><div class="k-row"><div class="k-small k-muted">Menu contoh untuk coba-coba. Hapus kalau sudah isi menu sendiri.</div></div>' +
        '<button class="k-btn k-sec" style="margin-top:8px" onclick="Menu.clearSample()">🗑️ Hapus Menu Contoh</button></div>';
    }
    if (!D.menus.length) {
      h += UI.empty('🍽️', 'Belum ada menu', 'Ketuk tombol + untuk tambah menu jualanmu.', '');
    } else {
      var cats = D.cats.slice();
      // kategori yang tak terdaftar ikut ditampilkan
      for (var i = 0; i < D.menus.length; i++) {
        if (cats.indexOf(D.menus[i].cat) < 0) cats.push(D.menus[i].cat);
      }
      for (var c = 0; c < cats.length; c++) {
        var items = D.menus.filter(function (m) { return m.cat === cats[c]; });
        if (!items.length) continue;
        h += '<div class="k-small k-muted" style="margin:12px 2px 6px;font-weight:700">' + K.esc(cats[c]) + ' (' + items.length + ')</div>';
        h += '<div class="k-card" style="padding:6px 14px">';
        for (var j = 0; j < items.length; j++) {
          var m = items[j];
          var stk = m.track
            ? (m.stock <= 0 ? '<span class="k-tag k-red">Habis</span>' : (m.stock <= m.min ? '<span class="k-tag k-red">Sisa ' + m.stock + '</span>' : '<span class="k-small k-muted">Stok ' + m.stock + '</span>'))
            : '<span class="k-small k-muted">Tanpa stok</span>';
          var vis = m.photo ? '<img class="k-thumb" src="' + m.photo + '">' : '<div class="k-emo">' + K.esc(m.emoji || '🍽️') + '</div>';
          h += '<div class="k-li">' + vis +
            '<div class="k-tx"><div class="k-t1">' + K.esc(m.name) + (!m.active ? ' <span class="k-tag">Nonaktif</span>' : '') + '</div>' +
            '<div class="k-t2">' + K.rp(m.price) + ' • ' + stk + '</div></div>' +
            '<button class="k-ico-btn" onclick="Menu.form(\'' + m.id + '\')">✏️</button></div>';
        }
        h += '</div>';
      }
    }
    h += '<button class="k-fab" onclick="Menu.form()">+</button>';
    return h;
  },

  _photo: '',

  form: function (id) {
    var D = KDB.data;
    var m = id ? KDB.menuById(id) : { id: K.uid(), name: '', cat: D.cats[0] || '', price: 0, cost: 0, stock: 0, min: 5, track: true, active: true, emoji: '🍽️', photo: '', sample: false };
    this._photo = m.photo || '';
    var h = '<h3 class="k-sheet-t">' + (id ? '✏️ Ubah Menu' : '＋ Tambah Menu') + '</h3>';
    h += '<div class="k-fld"><label>Foto menu (opsional)</label>' +
      '<div class="k-photopick" id="mPhotoPrev">' + (this._photo ? '<img src="' + this._photo + '">' : '📷 Belum ada foto') + '</div>' +
      '<div class="k-btn-row" style="margin-top:8px"><button class="k-btn k-sec" onclick="Menu.pickPhoto()">📷 Pilih Foto</button>' +
      '<button class="k-btn k-ghost" onclick="Menu.clearPhoto()">Hapus Foto</button></div>' +
      '<input type="file" id="mPhotoPick" accept="image/*" class="k-hidden" onchange="Menu.onPhoto(this)"></div>';
    h += '<div class="k-fld"><label>Nama menu</label><input class="k-in" id="mName" value="' + K.esc(m.name) + '" placeholder="cth: Es Kopi Susu"></div>';
    h += '<div class="k-frow"><div class="k-fld"><label>Emoji</label><input class="k-in" id="mEmoji" value="' + K.esc(m.emoji || '') + '" placeholder="🍽️" maxlength="4"></div>' +
      '<div class="k-fld"><label>Kategori</label><select class="k-sel" id="mCat">';
    for (var i = 0; i < D.cats.length; i++) {
      h += '<option value="' + K.esc(D.cats[i]) + '"' + (D.cats[i] === m.cat ? ' selected' : '') + '>' + K.esc(D.cats[i]) + '</option>';
    }
    if (D.cats.indexOf(m.cat) < 0 && m.cat) h += '<option selected>' + K.esc(m.cat) + '</option>';
    h += '</select></div></div>';
    h += '<div class="k-frow"><div class="k-fld"><label>Harga jual (Rp)</label><input class="k-in" id="mPrice" type="number" inputmode="numeric" value="' + m.price + '"></div>' +
      '<div class="k-fld"><label>Modal / HPP (Rp)</label><input class="k-in" id="mCost" type="number" inputmode="numeric" value="' + (m.cost || 0) + '"></div></div>';
    h += '<div class="k-check"><input type="checkbox" id="mTrack"' + (m.track ? ' checked' : '') + ' onchange="document.getElementById(\'mStockBox\').style.display=this.checked?\'block\':\'none\'"><label for="mTrack">Lacak stok menu ini</label></div>';
    h += '<div id="mStockBox" style="display:' + (m.track ? 'block' : 'none') + '"><div class="k-frow">' +
      '<div class="k-fld"><label>Stok saat ini</label><input class="k-in" id="mStock" type="number" inputmode="numeric" value="' + m.stock + '"></div>' +
      '<div class="k-fld"><label>Batas minimum</label><input class="k-in" id="mMin" type="number" inputmode="numeric" value="' + (m.min || 0) + '"></div></div></div>';
    h += '<div class="k-check"><input type="checkbox" id="mActive"' + (m.active ? ' checked' : '') + '><label for="mActive">Tampilkan di kasir</label></div>';
    h += '<div class="k-btn-row"><button class="k-btn k-ghost" onclick="UI.closeSheet()">Batal</button>' +
      (id ? '<button class="k-btn k-danger" onclick="Menu.del(\'' + m.id + '\')">Hapus</button>' : '') +
      '<button class="k-btn k-pri" onclick="Menu.save(\'' + m.id + '\',' + (id ? '1' : '0') + ')">Simpan</button></div>';
    UI.openSheet(h);
  },

  pickPhoto: function () {
    var p = document.getElementById('mPhotoPick');
    if (p) p.click();
  },
  clearPhoto: function () {
    this._photo = '';
    var pv = document.getElementById('mPhotoPrev');
    if (pv) pv.innerHTML = '📷 Belum ada foto';
  },
  onPhoto: function (input) {
    var f = input.files && input.files[0];
    if (!f) return;
    var self = this;
    var rd = new FileReader();
    rd.onload = function () {
      var img = new Image();
      img.onload = function () {
        try {
          var max = 480, w = img.width, h = img.height;
          if (w > max || h > max) {
            var r = Math.min(max / w, max / h);
            w = Math.round(w * r); h = Math.round(h * r);
          }
          var cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          cv.getContext('2d').drawImage(img, 0, 0, w, h);
          self._photo = cv.toDataURL('image/jpeg', 0.72);
          var pv = document.getElementById('mPhotoPrev');
          if (pv) pv.innerHTML = '<img src="' + self._photo + '">';
          UI.toast('Foto ditambahkan ✓');
        } catch (e) { UI.toast('Gagal memproses foto'); }
      };
      img.onerror = function () { UI.toast('File bukan gambar'); };
      img.src = rd.result;
    };
    rd.readAsDataURL(f);
    input.value = '';
  },

  save: function (id, isEdit) {
    var name = document.getElementById('mName').value.trim();
    if (!name) { UI.toast('Nama menu wajib diisi'); return; }
    var price = K.num(document.getElementById('mPrice').value);
    var D = KDB.data;
    if (isEdit) {
      var m = KDB.menuById(id);
      if (!m) return;
      var oldStock = m.stock, oldTrack = m.track;
      m.name = name;
      m.photo = this._photo || '';
      m.emoji = document.getElementById('mEmoji').value.trim() || '🍽️';
      m.cat = document.getElementById('mCat').value;
      m.price = price;
      m.cost = K.num(document.getElementById('mCost').value);
      m.track = document.getElementById('mTrack').checked;
      if (m.track) {
        m.stock = K.num(document.getElementById('mStock').value);
        m.min = K.num(document.getElementById('mMin').value);
        if (!oldTrack || m.stock !== oldStock) {
          KDB.addStockLog(m.id, m.name, 'adjust', m.stock - (oldTrack ? oldStock : 0), m.stock, 'Ubah manual');
        }
      }
      m.active = document.getElementById('mActive').checked;
      m.sample = false;
    } else {
      var nm = {
        id: id, name: name,
        photo: this._photo || '',
        emoji: document.getElementById('mEmoji').value.trim() || '🍽️',
        cat: document.getElementById('mCat').value,
        price: price, cost: K.num(document.getElementById('mCost').value),
        track: document.getElementById('mTrack').checked,
        stock: 0, min: 5, active: document.getElementById('mActive').checked, sample: false
      };
      if (nm.track) {
        nm.stock = K.num(document.getElementById('mStock').value);
        nm.min = K.num(document.getElementById('mMin').value);
        KDB.addStockLog(nm.id, nm.name, 'adjust', nm.stock, nm.stock, 'Stok awal');
      }
      D.menus.push(nm);
    }
    KDB.save();
    UI.closeSheet();
    UI.toast('Menu tersimpan');
    App.rerender();
  },

  del: function (id) {
    var m = KDB.menuById(id);
    if (!m) return;
    UI.confirm('Hapus menu "' + m.name + '"? Riwayat transaksi tetap tersimpan.', 'Hapus', function () {
      KDB.data.menus = KDB.data.menus.filter(function (x) { return x.id !== id; });
      KDB.save();
      UI.closeSheet();
      UI.toast('Menu dihapus');
      App.rerender();
    });
  },

  clearSample: function () {
    UI.confirm('Hapus semua menu contoh?', 'Hapus', function () {
      KDB.removeSamples();
      UI.toast('Menu contoh dihapus');
      App.rerender();
    });
  },

  /* ---------- kelola kategori ---------- */
  catMgr: function () {
    var D = KDB.data;
    var h = '<h3 class="k-sheet-t">⚙️ Kelola Kategori</h3>';
    for (var i = 0; i < D.cats.length; i++) {
      var c = D.cats[i];
      var n = D.menus.filter(function (m) { return m.cat === c; }).length;
      h += '<div class="k-li"><div class="k-tx"><div class="k-t1">' + K.esc(c) + '</div>' +
        '<div class="k-t2">' + n + ' menu</div></div>' +
        '<button class="k-ico-btn" onclick="Menu.catRename(\'' + K.esc(c) + '\')">✏️</button> ' +
        '<button class="k-ico-btn" onclick="Menu.catDel(\'' + K.esc(c) + '\')">🗑️</button></div>';
    }
    h += '<div class="k-fld" style="margin-top:12px"><label>Kategori baru</label>' +
      '<div class="k-frow"><input class="k-in" id="kNewCat" placeholder="cth: Dessert">' +
      '<button class="k-btn k-pri" style="width:auto;flex:0 0 auto" onclick="Menu.catAdd()">＋</button></div></div>';
    h += '<div class="k-btn-row"><button class="k-btn k-ghost" onclick="UI.closeSheet()">Tutup</button></div>';
    UI.openSheet(h);
  },
  catAdd: function () {
    var v = document.getElementById('kNewCat').value.trim();
    if (!v) return;
    if (KDB.data.cats.indexOf(v) >= 0) { UI.toast('Kategori sudah ada'); return; }
    KDB.data.cats.push(v);
    KDB.save();
    this.catMgr();
    App.rerender();
  },
  catRename: function (old) {
    var self = this;
    UI.openModal('<h3 class="k-sheet-t">Ubah Kategori</h3>' +
      '<div class="k-fld"><input class="k-in" id="kCatNew" value="' + K.esc(old) + '"></div>' +
      '<div class="k-btn-row"><button class="k-btn k-ghost" onclick="UI.closeModal()">Batal</button>' +
      '<button class="k-btn k-pri" id="kCatSave">Simpan</button></div>');
    document.getElementById('kCatSave').onclick = function () {
      var v = document.getElementById('kCatNew').value.trim();
      if (!v) return;
      var D = KDB.data;
      var ix = D.cats.indexOf(old);
      if (ix >= 0) D.cats[ix] = v;
      for (var i = 0; i < D.menus.length; i++) if (D.menus[i].cat === old) D.menus[i].cat = v;
      KDB.save();
      UI.closeModal();
      self.catMgr();
      App.rerender();
    };
  },
  catDel: function (c) {
    var n = KDB.data.menus.filter(function (m) { return m.cat === c; }).length;
    if (n > 0) { UI.toast('Kategori dipakai ' + n + ' menu — pindahkan dulu'); return; }
    var self = this;
    UI.confirm('Hapus kategori "' + c + '"?', 'Hapus', function () {
      KDB.data.cats = KDB.data.cats.filter(function (x) { return x !== c; });
      KDB.save();
      self.catMgr();
      App.rerender();
    });
  }
};
