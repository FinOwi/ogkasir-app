/* OGKasir - laporan penjualan */
var Lap = {
  period: 'today', // today | yesterday | 7d | 30d | month

  range: function () {
    var now = new Date();
    var start, end, label;
    function sod(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); }
    if (this.period === 'today') {
      start = sod(now); end = start + 864e5; label = 'Hari ini';
    } else if (this.period === 'yesterday') {
      start = sod(now) - 864e5; end = start + 864e5; label = 'Kemarin';
    } else if (this.period === '7d') {
      start = sod(now) - 6 * 864e5; end = sod(now) + 864e5; label = '7 hari terakhir';
    } else if (this.period === '30d') {
      start = sod(now) - 29 * 864e5; end = sod(now) + 864e5; label = '30 hari terakhir';
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime(); label = 'Bulan ini';
    }
    return { start: start, end: end, label: label };
  },

  txsIn: function (r) {
    return KDB.data.txs.filter(function (t) { return !t.voided && t.at >= r.start && t.at < r.end; });
  },

  render: function () {
    var r = this.range();
    var txs = this.txsIn(r);
    var omzet = 0, laba = 0;
    for (var i = 0; i < txs.length; i++) {
      omzet += txs[i].total;
      for (var j = 0; j < txs[i].items.length; j++) {
        var it = txs[i].items[j];
        laba += (it.price - (it.cost || 0)) * it.qty;
      }
    }
    var h = '<div class="k-chips" style="margin-bottom:12px">' + this.chip('today', 'Hari ini') +
      this.chip('yesterday', 'Kemarin') + this.chip('7d', '7 Hari') +
      this.chip('30d', '30 Hari') + this.chip('month', 'Bulan ini') + '</div>';
    h += '<div class="k-stats">' +
      '<div class="k-stat k-hi"><div class="k-l">💰 Omzet (' + r.label + ')</div><div class="k-v">' + K.rp(omzet) + '</div></div>' +
      '<div class="k-stat k-grn"><div class="k-l">📈 Laba kotor</div><div class="k-v">' + K.rp(laba) + '</div></div>' +
      '<div class="k-stat"><div class="k-l">🧾 Transaksi</div><div class="k-v">' + txs.length + '</div></div>' +
      '<div class="k-stat"><div class="k-l">🧮 Rata-rata / trx</div><div class="k-v">' + K.rp(txs.length ? Math.round(omzet / txs.length) : 0) + '</div></div></div>';
    h += '<div class="k-card"><h3>' + ((this.period === 'today' || this.period === 'yesterday') ? '📊 Omzet Per Jam' : '📊 Omzet Harian') + '</h3><canvas class="k-chart" id="kChart"></canvas></div>';
    var agg = {};
    for (var a = 0; a < txs.length; a++) {
      for (var b = 0; b < txs[a].items.length; b++) {
        var it2 = txs[a].items[b];
        if (!agg[it2.id]) agg[it2.id] = { name: it2.name, qty: 0, omzet: 0 };
        agg[it2.id].qty += it2.qty;
        agg[it2.id].omzet += it2.price * it2.qty;
      }
    }
    var arr = [];
    for (var k in agg) arr.push(agg[k]);
    arr.sort(function (x, y) { return y.qty - x.qty; });
    h += '<div class="k-card"><h3>🏆 Menu Terlaris</h3>';
    if (!arr.length) h += '<div class="k-small k-muted">Belum ada penjualan di periode ini.</div>';
    for (var tI = 0; tI < Math.min(arr.length, 5); tI++) {
      var medal = ['🥇', '🥈', '🥉', '4.', '5.'][tI];
      h += '<div class="k-li"><div class="k-tx"><div class="k-t1" style="font-weight:600">' + medal + ' ' + K.esc(arr[tI].name) + '</div>' +
        '<div class="k-t2">' + arr[tI].qty + ' terjual</div></div>' +
        '<div class="k-rt k-money">' + K.rp(arr[tI].omzet) + '</div></div>';
    }
    h += '</div>';
    var pays = {};
    for (var p = 0; p < txs.length; p++) {
      pays[txs[p].pay] = (pays[txs[p].pay] || 0) + txs[p].total;
    }
    h += '<div class="k-card"><h3>💳 Metode Pembayaran</h3>';
    var pk = Object.keys(pays);
    if (!pk.length) h += '<div class="k-small k-muted">Belum ada data.</div>';
    for (var q = 0; q < pk.length; q++) {
      h += '<div class="k-total-row"><span>' + K.esc(pk[q]) + '</span><span class="k-money">' + K.rp(pays[pk[q]]) + '</span></div>';
    }
    h += '</div>';
    h += '<div class="k-btn-row" style="margin-top:0"><button class="k-btn k-sec" onclick="Lap.exportCsv()">⬇️ CSV Mentah</button>' +
      '<button class="k-btn k-pri" onclick="kasirkuExportExcel()">📊 Excel Rapi</button></div>' +
      '<div class="k-small k-muted" style="margin-top:8px"><b>Excel Rapi</b>: berwarna & berformat — kop laporan, ringkasan, header coklat, angka Rp, baris TOTAL (' + r.label + ').<br><b>CSV Mentah</b>: data polos tanpa format.</div>';
    var self = this;
    setTimeout(function () { self.drawChart(r); }, 30);
    return h;
  },

  chip: function (id, label) {
    return '<button class="k-chip' + (this.period === id ? ' k-on' : '') + '" onclick="Lap.setP(\'' + id + '\')">' + label + '</button>';
  },
  setP: function (id) { this.period = id; App.rerender(); },

  drawChart: function (r) {
    var cv = document.getElementById('kChart');
    if (!cv) return;
    var dpr = window.devicePixelRatio || 1;
    var W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    var c = cv.getContext('2d');
    c.scale(dpr, dpr);
    var days = Math.max(1, Math.round((r.end - r.start) / 864e5));
    if (days > 31) days = 31;
    var hourly = (days === 1); // 1 hari -> pecah per jam (24 batang), bukan 1 batang raksasa
    var n = hourly ? 24 : days;
    var vals = [], labels = [];
    for (var i = 0; i < n; i++) {
      var ds, de, lab;
      if (hourly) {
        ds = r.start + i * 36e5; de = ds + 36e5; lab = i + '';
      } else {
        ds = r.start + i * 864e5; de = ds + 864e5;
        var d = new Date(ds);
        lab = d.getDate() + '/' + (d.getMonth() + 1);
      }
      var sum = 0;
      var txs = KDB.data.txs;
      for (var j = 0; j < txs.length; j++) {
        if (!txs[j].voided && txs[j].at >= ds && txs[j].at < de) sum += txs[j].total;
      }
      vals.push(sum);
      labels.push(lab);
    }
    var max = 0;
    for (var k = 0; k < vals.length; k++) if (vals[k] > max) max = vals[k];
    if (max === 0) max = 1;
    var padL = 8, padB = 20, padT = 10;
    var cw = (W - padL * 2) / vals.length;
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var barC = dark ? '#d99a4e' : '#b06a2c';
    c.fillStyle = dark ? '#b39d86' : '#97816d';
    c.font = '9px sans-serif';
    c.textAlign = 'center';
    for (var b = 0; b < vals.length; b++) {
      var bh = (H - padB - padT) * vals[b] / max;
      var x = padL + b * cw + cw * 0.18;
      var w = cw * 0.64;
      c.fillStyle = barC;
      var y = H - padB - bh;
      if (c.roundRect) { c.beginPath(); c.roundRect(x, y, w, Math.max(bh, 2), 3); c.fill(); }
      else c.fillRect(x, y, w, Math.max(bh, 2));
      if (vals.length <= 14 || b % Math.ceil(vals.length / 10) === 0) {
        c.fillStyle = dark ? '#b39d86' : '#97816d';
        c.fillText(labels[b], padL + b * cw + cw / 2, H - 6);
      }
    }
  },

  exportCsv: function () {
    var r = this.range();
    var txs = this.txsIn(r);
    var rows = [['No', 'Tanggal', 'Jam', 'Menu', 'Qty', 'Harga', 'Subtotal', 'Diskon', 'Total', 'Bayar', 'Kembalian']];
    function q(s) { return '"' + String(s).replace(/"/g, '""') + '"'; }
    for (var i = 0; i < txs.length; i++) {
      var t = txs[i];
      for (var j = 0; j < t.items.length; j++) {
        var it = t.items[j];
        rows.push(['#' + K.pad(t.no, 4), K.fmtDate(t.at), K.fmtTime(t.at), q(it.name), it.qty,
          it.price, it.price * it.qty, j === 0 ? t.disc : 0, j === 0 ? t.total : '',
          j === 0 ? q(t.pay) : '', j === 0 ? t.change : '']);
      }
    }
    var csv = '\ufeff' + rows.map(function (x) { return x.join(';'); }).join('\n');
    var d = new Date(r.start);
    function p2(x) { return (x < 10 ? '0' : '') + x; }
    var fname = 'kasirku-laporan-' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '.csv';
    UI.saveFile(fname, csv, 'text/csv');
  }
};
