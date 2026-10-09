/* OGKasir - stok opname */
var Stok = {
  render: function () {
    var D = KDB.data;
    var tracked = D.menus.filter(function (m) { return m.track; });
    var low = tracked.filter(function (m) { return m.active && m.stock <= m.min; });
    var h = '';
    if (low.length) {
      h += '<div class="k-alert">⚠️ <b>' + low.length + ' menu stok menipis:</b> ' +
        low.map(function (m) { return K.esc(m.name) + ' (' + m.stock + ')'; }).join(', ') + '</div>';
    }
    h += '<div class="k-card"><h3>📦 Stok Menu</h3>';
    if (!tracked.length) {
      h += UI.empty('📦', 'Belum ada stok dilacak', 'Aktifkan "Lacak stok" saat tambah/ubah menu.', '');
    } else {
      for (var i = 0; i < tracked.length; i++) {
        var m = tracked[i];
        var tag = m.stock <= 0 ? '<span class="k-tag k-red">HABIS</span>'
          : (m.stock <= m.min ? '<span class="k-tag k-red">MENIPIS</span>' : '<span class="k-tag k-grn">AMAN</span>');
        var svis = m.photo ? '<img class="k-thumb" src="' + m.photo + '">' : '<div class="k-emo">' + K.esc(m.emoji || '🍽️') + '</div>';
        h += '<div class="k-li">' + svis +
          '<div class="k-tx"><div class="k-t1">' + K.esc(m.name) + '</div>' +
          '<div class="k-t2">' + tag + ' <span class="k-small k-muted">min ' + m.min + '</span></div></div>' +
          '<div class="k-rt"><div class="k-money" style="font-size:17px">' + m.stock + '</div>' +
          '<button class="k-chip" style="margin-top:4px" onclick="Stok.adj(\'' + m.id + '\')">Ubah</button></div></div>';
      }
    }
    h += '</div>';
    // riwayat stok
    h += '<div class="k-card"><h3>🕘 Riwayat Stok</h3>';
    var log = D.stockLog.slice(0, 30);
    if (!log.length) h += '<div class="k-small k-muted">Belum ada perubahan stok.</div>';
    for (var j = 0; j < log.length; j++) {
      var l = log[j];
      var lbl = l.type === 'in' ? 'Masuk' : (l.type === 'out' ? 'Keluar' : 'Penyesuaian');
      var col = l.type === 'in' ? 'var(--green)' : (l.type === 'out' ? 'var(--red)' : 'var(--amber)');
      var sign = l.type === 'in' ? '+' : (l.type === 'out' ? '−' : '→');
      h += '<div class="k-li"><div class="k-tx"><div class="k-t1" style="font-weight:600">' + K.esc(l.name) + '</div>' +
        '<div class="k-t2">' + lbl + ' • ' + K.fmtDateTime(l.at) + (l.note ? ' • ' + K.esc(l.note) : '') + '</div></div>' +
        '<div class="k-rt"><div class="k-money" style="color:' + col + '">' + sign + Math.abs(l.qty) + '</div>' +
        '<div class="k-small k-muted">sisa ' + l.after + '</div></div></div>';
    }
    h += '</div>';
    return h;
  },

  adj: function (id) {
    var m = KDB.menuById(id);
    if (!m) return;
    var h = '<h3 class="k-sheet-t">📦 ' + K.esc(m.name) + '</h3>' +
      '<div class="k-small k-muted" style="margin-bottom:10px">Stok saat ini: <b>' + m.stock + '</b></div>' +
      '<div class="k-seg" id="kAdjSeg">' +
      '<button class="k-on" data-t="in" onclick="Stok.adjTab(this)">Masuk</button>' +
      '<button data-t="out" onclick="Stok.adjTab(this)">Keluar</button>' +
      '<button data-t="set" onclick="Stok.adjTab(this)">Atur</button></div>' +
      '<div class="k-fld"><label>Jumlah</label><input class="k-in" id="kAdjQty" type="number" inputmode="numeric" placeholder="0"></div>' +
      '<div class="k-fld"><label>Catatan (opsional)</label><input class="k-in" id="kAdjNote" placeholder="cth: belanja pagi"></div>' +
      '<div class="k-btn-row"><button class="k-btn k-ghost" onclick="UI.closeSheet()">Batal</button>' +
      '<button class="k-btn k-pri" onclick="Stok.adjSave(\'' + m.id + '\')">Simpan</button></div>';
    UI.openSheet(h);
  },
  adjTab: function (btn) {
    var bs = document.querySelectorAll('#kAdjSeg button');
    for (var i = 0; i < bs.length; i++) bs[i].classList.remove('k-on');
    btn.classList.add('k-on');
  },
  adjSave: function (id) {
    var m = KDB.menuById(id);
    if (!m) return;
    var on = document.querySelector('#kAdjSeg button.k-on');
    var t = on ? on.getAttribute('data-t') : 'in';
    var q = K.num(document.getElementById('kAdjQty').value);
    if (q < 0) q = 0;
    var note = document.getElementById('kAdjNote').value.trim();
    var after = m.stock, delta = 0;
    if (t === 'in') { delta = q; after = m.stock + q; }
    else if (t === 'out') {
      if (q > m.stock) { UI.toast('Stok cuma ' + m.stock); return; }
      delta = -q; after = m.stock - q;
    } else { delta = q - m.stock; after = q; }
    if (t !== 'set' && q === 0) { UI.toast('Isi jumlah dulu'); return; }
    m.stock = after;
    m.sample = false;
    KDB.addStockLog(m.id, m.name, t === 'set' ? 'adjust' : t, delta, after, note);
    KDB.save();
    UI.closeSheet();
    UI.toast('Stok ' + m.name + ' → ' + after);
    App.rerender();
  }
};
