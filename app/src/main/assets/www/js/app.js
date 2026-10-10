/* OGKasir - init & router */
var App = {
  page: 'kasir',
  unlocked: false,
  pinBuf: '',

  init: function () {
    KDB.load();
    this.applyTheme();
    this.renderHeader();
    var fp = document.getElementById('kFilePick');
    fp.addEventListener('change', function () {
      if (!fp.files || !fp.files[0]) return;
      var rd = new FileReader();
      rd.onload = function () { Set.doRestore(rd.result); fp.value = ''; };
      rd.readAsText(fp.files[0]);
    });
    Lic.init();
    if (!Lic.valid()) { Lic.showLock(); return; }
    Printer.init();
    this.boot();
  },

  boot: function () {
    this.unlocked = false;
    this.renderNav();
    document.getElementById('kNav').style.display = 'flex';
    var st = Lic.status();
    if (st.state === 'trial') {
      UI.toast('Masa trial: ' + st.daysLeft + ' hari lagi');
    } else if (st.state === 'active' && st.daysLeft <= 3) {
      UI.toast('Lisensi habis dalam ' + st.daysLeft + ' hari — perpanjang yuk');
    }
    var pin = KDB.data.settings.pin;
    if (pin) this.pinGate();
    else { this.unlocked = true; this.rerender(); }
    this._booted = true;
  },

  applyTheme: function () {
    document.documentElement.setAttribute('data-theme', KDB.data.settings.theme || 'light');
  },

  renderHeader: function () {
    var s = KDB.data.settings;
    document.getElementById('kHeader').innerHTML =
      '<div class="k-head-row"><div class="k-shop">☕ ' + K.esc(s.shop) +
      '<small>Aplikasi Kasir Warkop & F&B</small></div>' +
      '<div class="k-date">' + K.fmtDate(Date.now()) + '</div></div>';
  },

  renderNav: function () {
    var items = [
      ['kasir', '🧾', 'Kasir'],
      ['menu', '🍽️', 'Menu'],
      ['stok', '📦', 'Stok'],
      ['laporan', '📊', 'Laporan'],
      ['set', '⚙️', 'Lainnya']
    ];
    var h = '';
    for (var i = 0; i < items.length; i++) {
      h += '<button class="k-nav-it' + (this.page === items[i][0] ? ' k-on' : '') +
        '" onclick="App.go(\'' + items[i][0] + '\')"><span class="k-ni">' + items[i][1] + '</span>' + items[i][2] + '</button>';
    }
    document.getElementById('kNav').innerHTML = h;
  },

  go: function (p) {
    this.page = p;
    UI.closeSheet();
    this.renderNav();
    this.rerender();
    window.scrollTo(0, 0);
  },

  rerender: function () {
    if (!this.unlocked) return;
    var el = document.getElementById('kPage');
    try {
      var html = '';
      if (this.page === 'kasir') {
        html = Kasir.mode === 'struk' ? Kasir.renderStruk() : Kasir.render();
      }
      else if (this.page === 'menu') html = Menu.render();
      else if (this.page === 'stok') html = Stok.render();
      else if (this.page === 'laporan') html = Lap.render();
      else if (this.page === 'set') html = Set.render();
      el.innerHTML = html;
    } catch (e) {
      el.innerHTML = '<div class="k-card"><h3>⚠️ Ups, ada galat</h3>' +
        '<p class="k-small k-muted">' + K.esc(e.message) + '</p>' +
        '<button class="k-btn k-sec" onclick="App.rerender()">Coba lagi</button></div>';
    }
    Kasir.renderCartBar();
  },

  /* ---------- PIN gate ---------- */
  pinGate: function () {
    this.pinBuf = '';
    var self = this;
    document.getElementById('kPage').innerHTML =
      '<div class="k-pinwrap"><div style="font-size:52px">☕</div>' +
      '<h3 style="margin:10px 0 0">OGKasir Terkunci</h3>' +
      '<div class="k-small k-muted">Masukkan PIN 6 digit</div>' +
      '<div class="k-pin-dots" id="kPinDots"><span></span><span></span><span></span><span></span><span></span><span></span></div>' +
      '<div class="k-pinpad">' +
      '<button onclick="App.pinKey(\'1\')">1</button><button onclick="App.pinKey(\'2\')">2</button><button onclick="App.pinKey(\'3\')">3</button>' +
      '<button onclick="App.pinKey(\'4\')">4</button><button onclick="App.pinKey(\'5\')">5</button><button onclick="App.pinKey(\'6\')">6</button>' +
      '<button onclick="App.pinKey(\'7\')">7</button><button onclick="App.pinKey(\'8\')">8</button><button onclick="App.pinKey(\'9\')">9</button>' +
      '<button onclick="App.pinKey(\'C\')">⌫</button><button onclick="App.pinKey(\'0\')">0</button><button onclick="App.pinKey(\'X\')">✕</button>' +
      '</div></div>';
    document.getElementById('kNav').style.display = 'none';
  },
  pinKey: function (k) {
    if (k === 'C') this.pinBuf = this.pinBuf.slice(0, -1);
    else if (k === 'X') this.pinBuf = '';
    else if (this.pinBuf.length < 6) this.pinBuf += k;
    var dots = document.querySelectorAll('#kPinDots span');
    for (var i = 0; i < dots.length; i++) dots[i].classList.toggle('k-f', i < this.pinBuf.length);
    if (this.pinBuf.length === 6) {
      var self = this;
      setTimeout(function () {
        if (self.pinBuf === KDB.data.settings.pin) {
          self.unlocked = true;
          document.getElementById('kNav').style.display = 'flex';
          self.rerender();
        } else {
          self.pinBuf = '';
          for (var j = 0; j < dots.length; j++) dots[j].classList.remove('k-f');
          UI.toast('PIN salah');
        }
      }, 150);
    }
  }
};

window.onerror = function (msg) {
  try { UI.toast('Galat: ' + String(msg).slice(0, 80)); } catch (e) {}
};

document.addEventListener('DOMContentLoaded', function () { App.init(); });
