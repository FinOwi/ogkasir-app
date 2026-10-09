/* KasirKu - data layer (localStorage) */
var KDB = {
  key: 'kasirku_db_v1',
  data: null,

  load: function () {
    try {
      var raw = localStorage.getItem(this.key);
      this.data = raw ? JSON.parse(raw) : null;
    } catch (e) { this.data = null; }
    if (!this.data || !this.data.menus) {
      this.data = this.seed();
      this.save();
    }
    // migrasi ringan: pastikan field baru ada
    var s = this.data.settings;
    if (!s) { this.data.settings = this.seed().settings; }
    var dflt = this.seed().settings;
    for (var k in dflt) { if (typeof this.data.settings[k] === 'undefined') this.data.settings[k] = dflt[k]; }
    if (!this.data.stockLog) this.data.stockLog = [];
    if (!this.data.nextNo) this.data.nextNo = 1;
    return this.data;
  },

  save: function () {
    try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) {}
  },

  wipe: function () {
    try { localStorage.removeItem(this.key); } catch (e) {}
    this.data = this.seed();
    this.save();
  },

  seed: function () {
    var cats = ['Kopi', 'Minuman', 'Makanan', 'Snack'];
    var M = [
      ['Kopi Tubruk', 'Kopi', 8000, 3000, 50, '☕'],
      ['Kopi Hitam', 'Kopi', 10000, 3500, 50, '☕'],
      ['Es Kopi Susu', 'Kopi', 15000, 6000, 40, '🧋'],
      ['Kopi Susu Panas', 'Kopi', 13000, 5500, 40, '☕'],
      ['Teh Manis Panas', 'Minuman', 5000, 1500, 60, '🍵'],
      ['Es Teh Manis', 'Minuman', 6000, 1800, 60, '🧊'],
      ['Es Jeruk', 'Minuman', 8000, 2500, 40, '🍊'],
      ['Air Mineral', 'Minuman', 4000, 2000, 100, '💧'],
      ['Indomie Goreng', 'Makanan', 12000, 5000, 30, '🍜'],
      ['Indomie Rebus', 'Makanan', 12000, 5000, 30, '🍜'],
      ['Nasi Goreng', 'Makanan', 15000, 7000, 20, '🍛'],
      ['Mie Goreng Jawa', 'Makanan', 14000, 6500, 20, '🍝'],
      ['Pisang Goreng', 'Snack', 10000, 4000, 25, '🍌'],
      ['Roti Bakar', 'Snack', 12000, 5000, 25, '🍞'],
      ['Tahu Crispy', 'Snack', 8000, 3500, 25, '🧆'],
      ['Kentang Goreng', 'Snack', 12000, 5000, 20, '🍟']
    ];
    var menus = M.map(function (m, i) {
      return { id: 'm' + (i + 1), name: m[0], cat: m[1], price: m[2], cost: m[3],
               stock: m[4], min: 5, track: true, active: true, emoji: m[5], sample: true };
    });
    return {
      menus: menus,
      cats: cats,
      txs: [],
      stockLog: [],
      nextNo: 1,
      settings: {
        shop: 'Warkop Saya', addr: '', foot: 'Terima kasih sudah mampir!',
        pin: '', theme: 'light'
      }
    };
  },

  menuById: function (id) {
    var ms = this.data.menus;
    for (var i = 0; i < ms.length; i++) if (ms[i].id === id) return ms[i];
    return null;
  },

  addStockLog: function (menuId, name, type, qty, after, note) {
    this.data.stockLog.unshift({ id: K.uid(), at: Date.now(), menuId: menuId,
      name: name, type: type, qty: qty, after: after, note: note || '' });
    if (this.data.stockLog.length > 500) this.data.stockLog.length = 500;
  },

  removeSamples: function () {
    this.data.menus = this.data.menus.filter(function (m) { return !m.sample; });
    this.save();
  }
};

/* ---------- helpers ---------- */
var K = {
  uid: function () {
    return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },
  rp: function (n) {
    n = Math.round(Number(n) || 0);
    var neg = n < 0;
    var s = String(Math.abs(n)), out = '';
    while (s.length > 3) { out = '.' + s.slice(-3) + out; s = s.slice(0, -3); }
    return (neg ? '-Rp' : 'Rp') + s + out;
  },
  num: function (v) {
    var n = parseInt(String(v).replace(/[^0-9-]/g, ''), 10);
    return isNaN(n) ? 0 : n;
  },
  dayStart: function (ts) {
    var d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime();
  },
  fmtDate: function (ts) {
    var d = new Date(ts);
    var mo = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    return d.getDate() + ' ' + mo[d.getMonth()] + ' ' + d.getFullYear();
  },
  fmtDateTime: function (ts) {
    var d = new Date(ts);
    function p(x){ return (x < 10 ? '0' : '') + x; }
    return K.fmtDate(ts) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  },
  fmtTime: function (ts) {
    var d = new Date(ts);
    function p(x){ return (x < 10 ? '0' : '') + x; }
    return p(d.getHours()) + ':' + p(d.getMinutes());
  },
  pad: function (n, l) {
    n = String(n);
    while (n.length < (l || 4)) n = '0' + n;
    return n;
  },
  esc: function (s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
};
