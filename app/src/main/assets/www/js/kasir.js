/* KasirKu - kasir, keranjang, pembayaran, struk, riwayat */
var Kasir = {
  cart: {},        // menuId -> qty
  cat: 'Semua',
  q: '',
  mode: 'kasir',  // kasir | riwayat | struk
  lastTx: null,
  payMethod: 'Tunai',

  /* ---------- halaman kasir ---------- */
  render: function () {
    var D = KDB.data;
    var cats = ['Semua'].concat(D.cats);
    var h = '<div class="k-seg" style="margin-bottom:10px">' +
      '<button class="' + (this.mode === 'kasir' ? 'k-on' : '') + '" onclick="Kasir.setMode(\'kasir\')">🧾 Kasir</button>' +
      '<button class="' + (this.mode === 'riwayat' ? 'k-on' : '') + '" onclick="Kasir.setMode(\'riwayat\')">🕘 Riwayat</button></div>';
    if (this.mode === 'riwayat') { h += this.riwayatHtml(); return h; }
    h += '<input class="k-search" id="kKasirQ" placeholder="🔍 Cari menu..." value="' + K.esc(this.q) + '" oninput="Kasir.search(this.value)">';
    h += '<div class="k-chips">';
    for (var i = 0; i < cats.length; i++) {
      h += '<button class="k-chip' + (this.cat === cats[i] ? ' k-on' : '') + '" onclick="Kasir.setCat(\'' + K.esc(cats[i]) + '\')">' + K.esc(cats[i]) + '</button>';
    }
    h += '</div><div class="k-grid">';
    var list = this.filteredMenus();
    if (!list.length) {
      h += '</div>' + UI.empty('🍽️', 'Belum ada menu', 'Tambah menu dulu di tab Menu, bro.', '');
      return h;
    }
    for (var j = 0; j < list.length; j++) {
      var m = list[j];
      var out = m.track && m.stock <= 0;
      var low = m.track && !out && m.stock <= m.min;
      var visual = m.photo ? '<img class="k-photo" src="' + m.photo + '">' : '<div class="k-emo">' + K.esc(m.emoji || '🍽️') + '</div>';
      h += '<button class="k-mi' + (out ? ' k-empty' : '') + '" onclick="Kasir.add(\'' + m.id + '\')">' +
        (out ? '<span class="k-badge k-out">HABIS</span>' : (low ? '<span class="k-badge k-low">SISA ' + m.stock + '</span>' : '')) +
        visual +
        '<div class="k-nm">' + K.esc(m.name) + '</div>' +
        '<div class="k-pr">' + K.rp(m.price) + '</div>' +
        (m.track ? '<div class="k-stk">Stok: ' + m.stock + '</div>' : '<div class="k-stk">Tanpa stok</div>') +
        '</button>';
    }
    h += '</div>';
    return h;
  },

  filteredMenus: function () {
    var D = KDB.data, out = [], q = this.q.toLowerCase();
    for (var i = 0; i < D.menus.length; i++) {
      var m = D.menus[i];
      if (!m.active) continue;
      if (this.cat !== 'Semua' && m.cat !== this.cat) continue;
      if (q && m.name.toLowerCase().indexOf(q) < 0) continue;
      out.push(m);
    }
    return out;
  },

  setMode: function (m) { this.mode = m; App.rerender(); },
  setCat: function (c) { this.cat = c; App.rerender(); },
  search: function (v) {
    this.q = v;
    // render ulang grid saja tanpa kehilangan fokus input
    var grid = document.querySelector('#kPage .k-grid');
    var tmp = document.createElement('div');
    tmp.innerHTML = this.render();
    var ng = tmp.querySelector('.k-grid');
    if (grid && ng) grid.outerHTML = ng.outerHTML;
    else App.rerender();
    var inp = document.getElementById('kKasirQ');
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  },

  add: function (id) {
    var m = KDB.menuById(id);
    if (!m || !m.active) return;
    var cur = this.cart[id] || 0;
    if (m.track && cur + 1 > m.stock) { UI.toast('Stok ' + m.name + ' tinggal ' + m.stock); return; }
    this.cart[id] = cur + 1;
    this.renderCartBar();
    UI.toast(m.name + ' ×' + this.cart[id]);
  },

  cartCount: function () {
    var n = 0;
    for (var k in this.cart) n += this.cart[k];
    return n;
  },
  cartTotal: function () {
    var t = 0;
    for (var k in this.cart) { var m = KDB.menuById(k); if (m) t += m.price * this.cart[k]; }
    return t;
  },

  renderCartBar: function () {
    var w = document.getElementById('kCartBar');
    var n = this.cartCount();
    if (!n || App.page !== 'kasir' || this.mode !== 'kasir') { w.innerHTML = ''; return; }
    w.innerHTML = '<button class="k-cartbar" onclick="Kasir.openCartFresh()">' +
      '<span>🛒 ' + n + ' item</span><span>' + K.rp(this.cartTotal()) + ' →</span></button>';
  },

  chQty: function (id, d) {
    var m = KDB.menuById(id);
    var cur = this.cart[id] || 0;
    var nx = cur + d;
    if (nx <= 0) { delete this.cart[id]; }
    else {
      if (m && m.track && nx > m.stock) { UI.toast('Stok ' + m.name + ' tinggal ' + m.stock); return; }
      this.cart[id] = nx;
    }
    this.openCart();
    this.renderCartBar();
  },

  /* ---------- sheet keranjang & bayar ---------- */
  openCart: function () {
    var D = KDB.data;
    var h = '<h3 class="k-sheet-t">🛒 Keranjang</h3>';
    var ids = Object.keys(this.cart);
    if (!ids.length) { UI.closeSheet(); return; }
    for (var i = 0; i < ids.length; i++) {
      var m = KDB.menuById(ids[i]);
      if (!m) continue;
      var q = this.cart[ids[i]];
      var cvis = m.photo ? '<img class="k-thumb" src="' + m.photo + '">' : '<div class="k-emo">' + K.esc(m.emoji || '🍽️') + '</div>';
      h += '<div class="k-li">' + cvis +
        '<div class="k-tx"><div class="k-t1">' + K.esc(m.name) + '</div>' +
        '<div class="k-t2">' + K.rp(m.price) + ' × ' + q + ' = <b>' + K.rp(m.price * q) + '</b></div></div>' +
        '<div class="k-step"><button onclick="Kasir.chQty(\'' + m.id + '\',-1)">−</button>' +
        '<span class="k-q">' + q + '</span>' +
        '<button onclick="Kasir.chQty(\'' + m.id + '\',1)">+</button></div></div>';
    }
    var sub = this.cartTotal();
    h += '<div style="margin-top:10px">';
    h += '<div class="k-fld"><label>Diskon</label><div class="k-frow">' +
      '<input class="k-in" id="kDisc" type="number" inputmode="numeric" placeholder="0" value="0">' +
      '<select class="k-sel" id="kDiscType" style="max-width:110px"><option value="rp">Rp</option><option value="pct">%</option></select></div></div>';
    h += '<div class="k-fld"><label>Meja / Nama pelanggan (opsional)</label>' +
      '<input class="k-in" id="kNote" placeholder="cth: Meja 3"></div>';
    h += '<div class="k-fld"><label>Metode pembayaran</label><div class="k-paygrid">' +
      this.payBtn('Tunai', '💵') + this.payBtn('QRIS', '📱') +
      this.payBtn('Transfer', '🏦') + this.payBtn('E-Wallet', '👛') + '</div></div>';
    h += '<div id="kCashBox" style="display:' + (this.payMethod === 'Tunai' ? 'block' : 'none') + '"><div class="k-fld"><label>Uang diterima</label>' +
      '<input class="k-in" id="kCash" type="number" inputmode="numeric" placeholder="' + sub + '">' +
      '<div class="k-cashgrid">' +
      '<button class="k-cash" onclick="Kasir.setCash(' + sub + ')">Uang pas</button>' +
      '<button class="k-cash" onclick="Kasir.setCash(10000)">10rb</button>' +
      '<button class="k-cash" onclick="Kasir.setCash(20000)">20rb</button>' +
      '<button class="k-cash" onclick="Kasir.setCash(50000)">50rb</button>' +
      '<button class="k-cash" onclick="Kasir.setCash(100000)">100rb</button>' +
      '<button class="k-cash" onclick="Kasir.setCash(150000)">150rb</button></div></div></div>';
    h += '<div class="k-total-row"><span>Subtotal</span><span>' + K.rp(sub) + '</span></div>';
    h += '<div class="k-total-row"><span>Diskon</span><span id="kDiscView">Rp0</span></div>';
    h += '<div class="k-total-row k-grand"><span>Total</span><span class="k-money" id="kGrandView">' + K.rp(sub) + '</span></div>';
    h += '<div class="k-total-row" id="kChangeRow" style="display:none"><span>Kembalian</span><span class="k-money" id="kChangeView" style="color:var(--green)">Rp0</span></div>';
    h += '<div class="k-btn-row"><button class="k-btn k-ghost" onclick="UI.closeSheet()">Tutup</button>' +
      '<button class="k-btn k-pri" onclick="Kasir.pay()">💰 Bayar</button></div></div>';
    UI.openSheet(h);
    var self = this;
    document.getElementById('kDisc').oninput = function () { self.recalc(); };
    document.getElementById('kDiscType').onchange = function () { self.recalc(); };
    document.getElementById('kCash').oninput = function () { self.recalc(); };
  },

  openCartFresh: function () {
    this.payMethod = 'Tunai';
    this.openCart();
  },

  payBtn: function (name, emoji) {
    return '<button class="k-pay' + (this.payMethod === name ? ' k-on' : '') +
      '" onclick="Kasir.setPay(\'' + name + '\')"><span class="k-pe">' + emoji + '</span>' + name + '</button>';
  },
  setPay: function (name) {
    this.payMethod = name;
    var btns = document.querySelectorAll('#kSheet .k-pay');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('k-on');
    // tandai ulang via render ulang grid pay
    this.openCartKeep();
  },
  openCartKeep: function () {
    // buka ulang sheet tapi pertahankan input user
    var disc = document.getElementById('kDisc') ? document.getElementById('kDisc').value : '0';
    var dt = document.getElementById('kDiscType') ? document.getElementById('kDiscType').value : 'rp';
    var cash = document.getElementById('kCash') ? document.getElementById('kCash').value : '';
    var note = document.getElementById('kNote') ? document.getElementById('kNote').value : '';
    this.openCart();
    if (document.getElementById('kDisc')) document.getElementById('kDisc').value = disc;
    if (document.getElementById('kDiscType')) document.getElementById('kDiscType').value = dt;
    if (document.getElementById('kCash')) document.getElementById('kCash').value = cash;
    if (document.getElementById('kNote')) document.getElementById('kNote').value = note;
    this.recalc();
  },
  setCash: function (v) {
    document.getElementById('kCash').value = v;
    this.recalc();
  },

  calc: function () {
    var sub = this.cartTotal();
    var discRaw = K.num(document.getElementById('kDisc') ? document.getElementById('kDisc').value : 0);
    var dt = document.getElementById('kDiscType') ? document.getElementById('kDiscType').value : 'rp';
    var disc = dt === 'pct' ? Math.round(sub * Math.min(discRaw, 100) / 100) : Math.min(discRaw, sub);
    var total = sub - disc;
    var cash = K.num(document.getElementById('kCash') ? document.getElementById('kCash').value : 0);
    return { sub: sub, disc: disc, discRaw: discRaw, discType: dt, total: total, cash: cash, change: cash - total };
  },
  recalc: function () {
    var c = this.calc();
    var dv = document.getElementById('kDiscView');
    if (dv) dv.textContent = K.rp(c.disc);
    var gv = document.getElementById('kGrandView');
    if (gv) gv.textContent = K.rp(c.total);
    var cr = document.getElementById('kChangeRow');
    if (cr) {
      if (this.payMethod === 'Tunai' && c.cash > 0) {
        cr.style.display = 'flex';
        document.getElementById('kChangeView').textContent = K.rp(Math.max(c.change, 0));
      } else cr.style.display = 'none';
    }
  },

  pay: function () {
    var c = this.calc();
    var ids = Object.keys(this.cart);
    if (!ids.length) return;
    // cek stok
    var kurang = [];
    for (var i = 0; i < ids.length; i++) {
      var m = KDB.menuById(ids[i]);
      if (m && m.track && this.cart[ids[i]] > m.stock) kurang.push(m.name + ' (sisa ' + m.stock + ')');
    }
    if (kurang.length) { UI.toast('Stok kurang: ' + kurang.join(', ')); return; }
    if (this.payMethod === 'Tunai' && c.cash < c.total) { UI.toast('Uang kurang ' + K.rp(c.total - c.cash)); return; }
    // susun transaksi
    var items = [];
    for (var j = 0; j < ids.length; j++) {
      var mm = KDB.menuById(ids[j]);
      if (!mm) continue;
      var q = this.cart[ids[j]];
      items.push({ id: mm.id, name: mm.name, price: mm.price, cost: mm.cost || 0, qty: q });
      if (mm.track) {
        mm.stock -= q;
        KDB.addStockLog(mm.id, mm.name, 'out', q, mm.stock, 'Penjualan #' + K.pad(KDB.data.nextNo, 4));
      }
    }
    var D = KDB.data;
    var tx = {
      id: K.uid(), no: D.nextNo, at: Date.now(), items: items,
      sub: c.sub, disc: c.disc, total: c.total,
      pay: this.payMethod, cash: this.payMethod === 'Tunai' ? c.cash : c.total,
      change: this.payMethod === 'Tunai' ? Math.max(c.change, 0) : 0,
      note: document.getElementById('kNote') ? document.getElementById('kNote').value.trim() : '',
      voided: false
    };
    D.nextNo++;
    D.txs.unshift(tx);
    KDB.save();
    this.cart = {};
    this.lastTx = tx;
    this.mode = 'struk';
    UI.closeSheet();
    App.rerender();
  },

  /* ---------- struk ---------- */
  receiptText: function (tx) {
    var s = KDB.data.settings;
    var L = [];
    function mid(t) {
      t = String(t);
      var w = 32, pad = Math.max(0, Math.floor((w - t.length) / 2));
      return new Array(pad + 1).join(' ') + t;
    }
    function row(l, r) {
      l = String(l); r = String(r);
      var sp = 32 - l.length - r.length;
      return l + (sp > 0 ? new Array(sp + 1).join(' ') : ' ') + r;
    }
    L.push(mid(s.shop.toUpperCase()));
    if (s.addr) L.push(mid(s.addr));
    L.push('--------------------------------');
    L.push(row('No: #' + K.pad(tx.no, 4), K.fmtDateTime(tx.at)));
    if (tx.note) L.push(row('Ket:', tx.note));
    L.push('--------------------------------');
    for (var i = 0; i < tx.items.length; i++) {
      var it = tx.items[i];
      L.push(it.qty + 'x ' + it.name);
      L.push(row('   @' + K.rp(it.price), K.rp(it.price * it.qty)));
    }
    L.push('--------------------------------');
    L.push(row('Subtotal', K.rp(tx.sub)));
    if (tx.disc > 0) L.push(row('Diskon', '-' + K.rp(tx.disc)));
    L.push(row('TOTAL', K.rp(tx.total)));
    L.push(row(tx.pay, K.rp(tx.cash)));
    if (tx.pay === 'Tunai') L.push(row('Kembalian', K.rp(tx.change)));
    L.push('--------------------------------');
    if (s.foot) L.push(mid(s.foot));
    return L.join('\n');
  },

  renderStruk: function () {
    var tx = this.lastTx;
    if (!tx) { this.mode = 'kasir'; return this.render(); }
    var s = KDB.data.settings;
    var h = '<div class="k-card"><h3>✅ Pembayaran Berhasil</h3>';
    h += '<div class="k-struk"><div class="k-c k-b">' + K.esc(s.shop.toUpperCase()) + '</div>';
    if (s.addr) h += '<div class="k-c">' + K.esc(s.addr) + '</div>';
    h += '<hr><div class="k-srow"><span>No: #' + K.pad(tx.no, 4) + '</span><span>' + K.fmtDateTime(tx.at) + '</span></div>';
    if (tx.note) h += '<div class="k-srow"><span>Ket:</span><span>' + K.esc(tx.note) + '</span></div>';
    h += '<hr>';
    for (var i = 0; i < tx.items.length; i++) {
      var it = tx.items[i];
      h += '<div>' + it.qty + 'x ' + K.esc(it.name) + '</div>' +
        '<div class="k-srow"><span>&nbsp;&nbsp;@' + K.rp(it.price) + '</span><span>' + K.rp(it.price * it.qty) + '</span></div>';
    }
    h += '<hr><div class="k-srow"><span>Subtotal</span><span>' + K.rp(tx.sub) + '</span></div>';
    if (tx.disc > 0) h += '<div class="k-srow"><span>Diskon</span><span>-' + K.rp(tx.disc) + '</span></div>';
    h += '<div class="k-srow k-b"><span>TOTAL</span><span>' + K.rp(tx.total) + '</span></div>';
    h += '<div class="k-srow"><span>' + K.esc(tx.pay) + '</span><span>' + K.rp(tx.cash) + '</span></div>';
    if (tx.pay === 'Tunai') h += '<div class="k-srow"><span>Kembalian</span><span>' + K.rp(tx.change) + '</span></div>';
    h += '<hr><div class="k-c">' + K.esc(s.foot || 'Terima kasih!') + '</div></div></div>';
    h += '<div class="k-btn-row"><button class="k-btn k-sec" onclick="Kasir.shareStruk()">📤 Bagikan Struk</button>' +
      '<button class="k-btn k-pri" onclick="Kasir.baru()">+ Transaksi Baru</button></div>';
    return h;
  },
  shareStruk: function () {
    if (!this.lastTx) return;
    UI.shareText('Struk #' + K.pad(this.lastTx.no, 4), this.receiptText(this.lastTx));
  },
  baru: function () { this.mode = 'kasir'; this.lastTx = null; App.rerender(); },

  /* ---------- riwayat ---------- */
  riwayatHtml: function () {
    var txs = KDB.data.txs.filter(function (t) { return !t.voided; });
    var h = '';
    if (!txs.length) return UI.empty('🕘', 'Belum ada transaksi', 'Transaksi yang sudah dibayar muncul di sini.', '');
    var lastDay = '';
    for (var i = 0; i < txs.length; i++) {
      var t = txs[i];
      var day = K.fmtDate(t.at);
      if (day !== lastDay) { h += '<div class="k-small k-muted" style="margin:12px 2px 4px;font-weight:700">' + day + '</div>'; lastDay = day; }
      var nItems = 0;
      for (var j = 0; j < t.items.length; j++) nItems += t.items[j].qty;
      h += '<div class="k-card" style="margin-bottom:8px;cursor:pointer" onclick="Kasir.detail(\'' + t.id + '\')">' +
        '<div class="k-row"><div><b>#' + K.pad(t.no, 4) + '</b> <span class="k-tag">' + K.esc(t.pay) + '</span>' +
        (t.note ? ' <span class="k-small k-muted">' + K.esc(t.note) + '</span>' : '') +
        '<div class="k-small k-muted">' + K.fmtTime(t.at) + ' • ' + nItems + ' item' + (t.disc > 0 ? ' • disc ' + K.rp(t.disc) : '') + '</div></div>' +
        '<div class="k-money">' + K.rp(t.total) + '</div></div></div>';
    }
    return h;
  },

  detail: function (id) {
    var txs = KDB.data.txs, tx = null;
    for (var i = 0; i < txs.length; i++) if (txs[i].id === id) tx = txs[i];
    if (!tx) return;
    var h = '<h3 class="k-sheet-t">Transaksi #' + K.pad(tx.no, 4) + '</h3>';
    h += '<div class="k-small k-muted" style="margin-bottom:10px">' + K.fmtDateTime(tx.at) + ' • ' + K.esc(tx.pay) +
      (tx.note ? ' • ' + K.esc(tx.note) : '') + '</div>';
    for (var j = 0; j < tx.items.length; j++) {
      var it = tx.items[j];
      h += '<div class="k-total-row"><span>' + it.qty + 'x ' + K.esc(it.name) + '</span><span>' + K.rp(it.price * it.qty) + '</span></div>';
    }
    h += '<div class="k-total-row"><span>Subtotal</span><span>' + K.rp(tx.sub) + '</span></div>';
    if (tx.disc > 0) h += '<div class="k-total-row"><span>Diskon</span><span>-' + K.rp(tx.disc) + '</span></div>';
    h += '<div class="k-total-row k-grand"><span>Total</span><span class="k-money">' + K.rp(tx.total) + '</span></div>';
    h += '<div class="k-btn-row"><button class="k-btn k-ghost" onclick="UI.closeSheet()">Tutup</button>' +
      '<button class="k-btn k-sec" onclick="Kasir.shareOne(\'' + tx.id + '\')">📤 Struk</button>' +
      '<button class="k-btn k-danger" onclick="Kasir.voidTx(\'' + tx.id + '\')">Batalkan</button></div>';
    UI.openSheet(h);
  },
  shareOne: function (id) {
    var txs = KDB.data.txs;
    for (var i = 0; i < txs.length; i++) if (txs[i].id === id) {
      UI.shareText('Struk #' + K.pad(txs[i].no, 4), this.receiptText(txs[i]));
      return;
    }
  },
  voidTx: function (id) {
    var txs = KDB.data.txs, tx = null;
    for (var i = 0; i < txs.length; i++) if (txs[i].id === id) tx = txs[i];
    if (!tx) return;
    var self = this;
    UI.confirm('Batalkan transaksi #' + K.pad(tx.no, 4) + ' (' + K.rp(tx.total) + ')? Stok akan dikembalikan.', 'Batalkan', function () {
      for (var j = 0; j < tx.items.length; j++) {
        var it = tx.items[j];
        var m = KDB.menuById(it.id);
        if (m && m.track) {
          m.stock += it.qty;
          KDB.addStockLog(m.id, m.name, 'in', it.qty, m.stock, 'Void #' + K.pad(tx.no, 4));
        }
      }
      tx.voided = true;
      KDB.save();
      UI.closeSheet();
      UI.toast('Transaksi dibatalkan, stok dikembalikan');
      App.rerender();
    });
  }
};
