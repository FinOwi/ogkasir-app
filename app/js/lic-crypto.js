/* OGKasir - kripto lisensi (dipakai aplikasi & generator; offline)
   SKEMA v2 — ROTASI K1 OPSI B (audit putaran 2, 7 Nov 2026):
   kode aktivasi memakai tanda tangan asimetris Ed25519.
   Modul client ini HANYA memuat PUBLIC key + verifikasi — private key
   TIDAK PERNAH ada di client; ia hanya hidup di generator lokal pemilik
   (license-gen.html, berkas 600 ter-gitignore) dan di tempat server pada
   berkas SQL admin (fix-audit2-2026-11-07.sql, tabel license_v2_keys
   tanpa grant untuk role API mana pun). "Verify-only" di client kini
   nyata secara arsitektur, bukan kosmetik.
   v1 DIMATIKAN TOTAL (keputusan zgg 7 Nov 2026, menanggapi audit
   eksternal; OGKasir belum memiliki pelanggan sehingga tidak ada
   aktivasi berbayar pihak ketiga yang perlu dilindungi): masa transisi
   s.d. 2027-05-06 DIBATALKAN. verifyCode menolak semua kode non-v2
   tanpa syarat (reason 'v1_disabled'), dan secret HMAC + seluruh jalur
   HMAC v1 DICABUT dari berkas ini — tidak ada lagi bahan pembuat/
   pemeriksa kode v1 di client. Lisensi yang berjalan = lisensi AKUN
   (server); kode perangkat v2 yang sudah teraktivasi tetap diverifikasi
   ulang saat boot seperti biasa. */
var LicCrypto = (function () {
  var DEV_ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // tanpa I,L,O,0,1

  /* --- v2 (Ed25519): PUBLIC key saja. Aman publik secara desain. --- */
  var ED_PUB_HEX = 'fa7c33f3994261d9ce250dec723a50e4d82afa8b2f429b8945087573bc6db5d7';
  var B32_ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford, tanpa I,L,O,U

  /* SHA-256 (ASCII/Latin-1) — BUKAN untuk lisensi v1 lagi; tetap dipakai
     deviceCode (Kode Device), hash PIN (store.js), deviceHash akun, dan
     sidik jari dokumen sync. */
  function sha256(ascii) {
    function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
    var maxWord = Math.pow(2, 32), result = '';
    var words = [], asciiBitLength = ascii.length * 8;
    var hash = sha256.h = sha256.h || [], k = sha256.k = sha256.k || [];
    var primeCounter = k.length, isComposite = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (var i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (Math.pow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (Math.pow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    ascii += '\x80';
    while (ascii.length % 64 - 56) ascii += '\x00';
    var i, j;
    for (i = 0; i < ascii.length; i++) {
      j = ascii.charCodeAt(i);
      if (j >> 8) return '';
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words.length] = (asciiBitLength / maxWord) | 0;
    words[words.length] = asciiBitLength;
    for (j = 0; j < words.length;) {
      var w = words.slice(j, j += 16), oldHash = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4];
        var temp1 = hash[7]
          + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25))
          + ((e & hash[5]) ^ ((~e) & hash[6]))
          + k[i]
          + (w[i] = (i < 16) ? w[i] : (w[i - 16]
            + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3))
            + w[i - 7]
            + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
        var temp2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22))
          + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (i = 0; i < 8; i++) {
      for (j = 3; j + 1; j--) {
        var b = (hash[i] >> (j * 8)) & 255;
        result += ((b < 16) ? '0' : '') + b.toString(16);
      }
    }
    return result;
  }

  function hexToBytes(h) {
    var b = [];
    for (var i = 0; i < h.length; i += 2) b.push(parseInt(h.substr(i, 2), 16));
    return b;
  }

  /* Kode device 8 char dari ID mentah */
  function deviceCode(rawId) {
    var h = sha256('OGK|' + rawId), out = '';
    for (var i = 0; i < 8; i++) out += DEV_ALPHA[parseInt(h.substr(i * 2, 2), 16) % DEV_ALPHA.length];
    return out;
  }
  function fmtDevice(d) { return d.substr(0, 4) + '-' + d.substr(4, 4); }

  /* ================= SHA-512 (BigInt) — untuk Ed25519 ================= */
  var MASK64 = (1n << 64n) - 1n;
  var S512K = [
    0x428a2f98d728ae22n, 0x7137449123ef65cdn, 0xb5c0fbcfec4d3b2fn, 0xe9b5dba58189dbbcn, 0x3956c25bf348b538n, 0x59f111f1b605d019n, 0x923f82a4af194f9bn, 0xab1c5ed5da6d8118n,
    0xd807aa98a3030242n, 0x12835b0145706fben, 0x243185be4ee4b28cn, 0x550c7dc3d5ffb4e2n, 0x72be5d74f27b896fn, 0x80deb1fe3b1696b1n, 0x9bdc06a725c71235n, 0xc19bf174cf692694n,
    0xe49b69c19ef14ad2n, 0xefbe4786384f25e3n, 0x0fc19dc68b8cd5b5n, 0x240ca1cc77ac9c65n, 0x2de92c6f592b0275n, 0x4a7484aa6ea6e483n, 0x5cb0a9dcbd41fbd4n, 0x76f988da831153b5n,
    0x983e5152ee66dfabn, 0xa831c66d2db43210n, 0xb00327c898fb213fn, 0xbf597fc7beef0ee4n, 0xc6e00bf33da88fc2n, 0xd5a79147930aa725n, 0x06ca6351e003826fn, 0x142929670a0e6e70n,
    0x27b70a8546d22ffcn, 0x2e1b21385c26c926n, 0x4d2c6dfc5ac42aedn, 0x53380d139d95b3dfn, 0x650a73548baf63den, 0x766a0abb3c77b2a8n, 0x81c2c92e47edaee6n, 0x92722c851482353bn,
    0xa2bfe8a14cf10364n, 0xa81a664bbc423001n, 0xc24b8b70d0f89791n, 0xc76c51a30654be30n, 0xd192e819d6ef5218n, 0xd69906245565a910n, 0xf40e35855771202an, 0x106aa07032bbd1b8n,
    0x19a4c116b8d2d0c8n, 0x1e376c085141ab53n, 0x2748774cdf8eeb99n, 0x34b0bcb5e19b48a8n, 0x391c0cb3c5c95a63n, 0x4ed8aa4ae3418acbn, 0x5b9cca4f7763e373n, 0x682e6ff3d6b2b8a3n,
    0x748f82ee5defb2fcn, 0x78a5636f43172f60n, 0x84c87814a1f0ab72n, 0x8cc702081a6439ecn, 0x90befffa23631e28n, 0xa4506cebde82bde9n, 0xbef9a3f7b2c67915n, 0xc67178f2e372532bn,
    0xca273eceea26619cn, 0xd186b8c721c0c207n, 0xeada7dd6cde0eb1en, 0xf57d4f7fee6ed178n, 0x06f067aa72176fban, 0x0a637dc5a2c898a6n, 0x113f9804bef90daen, 0x1b710b35131c471bn,
    0x28db77f523047d84n, 0x32caab7b40c72493n, 0x3c9ebe0a15c9bebcn, 0x431d67c49c100d4cn, 0x4cc5d4becb3e42b6n, 0x597f299cfc657e2an, 0x5fcb6fab3ad6faecn, 0x6c44198c4a475817n];
  function rotr64(x, n) { return ((x >> BigInt(n)) | (x << BigInt(64 - n))) & MASK64; }
  function sha512bytes(msg) {
    var H = [0x6a09e667f3bcc908n, 0xbb67ae8584caa73bn, 0x3c6ef372fe94f82bn, 0xa54ff53a5f1d36f1n, 0x510e527fade682d1n, 0x9b05688c2b3e6c1fn, 0x1f83d9abfb41bd6bn, 0x5be0cd19137e2179n];
    var ml = msg.length, bitlen = BigInt(ml) * 8n;
    var padLen = ((112 - (ml + 1) % 128) + 128) % 128;
    var total = ml + 1 + padLen + 16;
    var buf = new Uint8Array(total); buf.set(msg); buf[ml] = 0x80;
    for (var i = 0; i < 8; i++) buf[total - 1 - i] = Number((bitlen >> BigInt(8 * i)) & 0xffn);
    var w = new Array(80), t;
    for (var off = 0; off < total; off += 128) {
      for (t = 0; t < 16; t++) { var v = 0n; for (i = 0; i < 8; i++) v = (v << 8n) | BigInt(buf[off + t * 8 + i]); w[t] = v; }
      for (t = 16; t < 80; t++) {
        var s0 = rotr64(w[t - 15], 1) ^ rotr64(w[t - 15], 8) ^ (w[t - 15] >> 7n);
        var s1 = rotr64(w[t - 2], 19) ^ rotr64(w[t - 2], 61) ^ (w[t - 2] >> 6n);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) & MASK64;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (t = 0; t < 80; t++) {
        var S1 = rotr64(e, 14) ^ rotr64(e, 18) ^ rotr64(e, 41);
        var ch = (e & f) ^ ((~e & MASK64) & g);
        var t1 = (h + S1 + ch + S512K[t] + w[t]) & MASK64;
        var S0 = rotr64(a, 28) ^ rotr64(a, 34) ^ rotr64(a, 39);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) & MASK64;
        h = g; g = f; f = e; e = (d + t1) & MASK64; d = c; c = b; b = a; a = (t1 + t2) & MASK64;
      }
      H = [(H[0] + a) & MASK64, (H[1] + b) & MASK64, (H[2] + c) & MASK64, (H[3] + d) & MASK64, (H[4] + e) & MASK64, (H[5] + f) & MASK64, (H[6] + g) & MASK64, (H[7] + h) & MASK64];
    }
    var out = new Uint8Array(64);
    for (i = 0; i < 8; i++) for (var j = 0; j < 8; j++) out[i * 8 + j] = Number((H[i] >> BigInt(56 - 8 * j)) & 0xffn);
    return out;
  }

  /* ================= Ed25519 verify (BigInt, koordinat extended) ================= */
  var EDP = (1n << 255n) - 19n;
  var EDL = (1n << 252n) + 27742317777372353535851937790883648493n;
  function edMod(a) { a %= EDP; return a < 0n ? a + EDP : a; }
  function edPow(a, e) { var r = 1n; a = edMod(a); while (e > 0n) { if (e & 1n) r = edMod(r * a); a = edMod(a * a); e >>= 1n; } return r; }
  function edInv(a) { return edPow(a, EDP - 2n); }
  var EDD = edMod(-121665n * edInv(121666n));
  var EDI = edPow(2n, (EDP - 1n) / 4n);
  function edXRecover(y) {
    var xx = edMod((y * y - 1n) * edInv(edMod(EDD * y * y + 1n)));
    var x = edPow(xx, (EDP + 3n) / 8n);
    if (edMod(x * x - xx) !== 0n) x = edMod(x * EDI);
    if (x & 1n) x = EDP - x;
    return x;
  }
  function edPt(x, y) { return [edMod(x), edMod(y), edMod(x * y), 1n]; }
  var EDB = edPt(edXRecover(edMod(4n * edInv(5n))), edMod(4n * edInv(5n)));
  function edAdd(Pt, Qt) {
    var A = edMod((Pt[1] - Pt[0]) * (Qt[1] - Qt[0]));
    var B = edMod((Pt[1] + Pt[0]) * (Qt[1] + Qt[0]));
    var C = edMod(2n * EDD * Pt[2] * Qt[2]);
    var D = edMod(2n * Pt[3] * Qt[3]);
    var E = edMod(B - A), F = edMod(D - C), G = edMod(D + C), H = edMod(B + A);
    return [edMod(E * F), edMod(G * H), edMod(E * H), edMod(F * G)];
  }
  function edDouble(Pt) {
    var A = edMod(Pt[0] * Pt[0]), B = edMod(Pt[1] * Pt[1]), C = edMod(2n * Pt[3] * Pt[3]);
    var D = edMod(-A), E = edMod(edMod((Pt[0] + Pt[1]) * (Pt[0] + Pt[1])) - A - B);
    var G = edMod(D + B), F = edMod(G - C), H = edMod(D - B);
    return [edMod(E * F), edMod(G * H), edMod(E * H), edMod(F * G)];
  }
  function edScalar(Pt, e) {
    var Q = [0n, 1n, 0n, 1n];
    while (e > 0n) { if (e & 1n) Q = edAdd(Q, Pt); Pt = edDouble(Pt); e >>= 1n; }
    return Q;
  }
  function edLeInt(b) { var v = 0n; for (var i = b.length - 1; i >= 0; i--) v = (v << 8n) | BigInt(b[i]); return v; }
  function edDecode(s) {
    if (!s || s.length !== 32) return null;
    var sign = (s[31] >> 7) & 1;
    var yb = Uint8Array.from(s); yb[31] &= 0x7f;
    var y = edLeInt(yb);
    if (y >= EDP) return null;
    var xx = edMod((y * y - 1n) * edInv(edMod(EDD * y * y + 1n)));
    var x = edXRecover(y);
    if (edMod(x * x) !== xx) return null;
    if (Number(x & 1n) !== sign) x = EDP - x;
    if (x === 0n && sign === 1) return null;
    return edPt(x, y);
  }
  function edConcat(a, b, c) {
    var o = new Uint8Array(a.length + b.length + c.length);
    o.set(a, 0); o.set(b, a.length); o.set(c, a.length + b.length);
    return o;
  }
  function strBytes(s) { var o = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) o[i] = s.charCodeAt(i) & 0xFF; return o; }
  /* Verifikasi tanda tangan Ed25519 murni. sig: 64 byte, msg: string ASCII,
     pubHex: opsional (bawaan: public key tertanam). Return boolean. */
  function edVerify(sig, msg, pubHex) {
    try {
      if (!sig || sig.length !== 64) return false;
      var pub = hexToBytes(pubHex || ED_PUB_HEX);
      if (pub.length !== 32) return false;
      var sigB = (sig instanceof Uint8Array) ? sig : Uint8Array.from(sig);
      var pubB = Uint8Array.from(pub);
      var S = edLeInt(sigB.slice(32));
      if (S >= EDL) return false;
      var A = edDecode(pubB), R = edDecode(sigB.slice(0, 32));
      if (!A || !R) return false;
      var k = edLeInt(sha512bytes(edConcat(sigB.slice(0, 32), pubB, strBytes(msg)))) % EDL;
      var left = edScalar(EDB, S);
      var right = edAdd(R, edScalar(A, k));
      return edMod(left[0] * right[3]) === edMod(right[0] * left[3])
        && edMod(left[1] * right[3]) === edMod(right[1] * left[3]);
    } catch (e) { return false; }
  }

  /* ================= Base32 Crockford (untuk sig v2) ================= */
  function b32decode(s) {
    var bits = 0, nbits = 0, out = [];
    for (var i = 0; i < s.length; i++) {
      var v = B32_ALPHA.indexOf(s.charAt(i));
      if (v < 0) return null;
      bits = (bits << 5) | v; nbits += 5;
      if (nbits >= 8) { nbits -= 8; out.push((bits >> nbits) & 0xFF); bits &= (1 << nbits) - 1; }
    }
    return out;
  }
  function b32encode(bytes) {
    var bits = 0, nbits = 0, out = '';
    for (var i = 0; i < bytes.length; i++) {
      bits = (bits << 8) | (bytes[i] & 0xFF); nbits += 8;
      while (nbits >= 5) { nbits -= 5; out += B32_ALPHA.charAt((bits >> nbits) & 31); }
      bits &= (1 << nbits) - 1;
    }
    if (nbits > 0) out += B32_ALPHA.charAt((bits << (5 - nbits)) & 31);
    return out;
  }

  /* ================= Verifikasi kode: HANYA v2 (Ed25519) =================
     Format v2 (dibersihkan dari strip): 'V2' + dev8 + expBase36(4) + sigBase32(103)
     = 117 char, ditampilkan berkelompok 4.
     Pesan yang ditandatangani: 'OGK2|' + dev8 + '|' + expDays (desimal).
     Semua bentuk lain — termasuk kode v1 (24 char, HMAC) — ditolak tanpa
     syarat dengan reason 'v1_disabled' (v1 dimatikan total 7 Nov 2026). */
  function verifyCode(code, dev8, todayDays) {
    var nowDays = (typeof todayDays === 'number' && !isNaN(todayDays))
      ? todayDays : Math.floor(Date.now() / 864e5);
    var c = String(code || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (c.substr(0, 2) === 'V2') {
      if (c.length !== 117) return { ok: false, reason: 'format' };
      var d2 = c.substr(2, 8), e2 = c.substr(10, 4), s2 = c.substr(14);
      if (d2 !== dev8) return { ok: false, reason: 'device' };
      var exp2 = parseInt(e2, 36);
      if (isNaN(exp2)) return { ok: false, reason: 'format' };
      var sig = b32decode(s2);
      if (!sig || sig.length !== 64) return { ok: false, reason: 'format' };
      if (!edVerify(sig, 'OGK2|' + d2 + '|' + exp2)) return { ok: false, reason: 'sig' };
      if (exp2 < nowDays) return { ok: false, reason: 'expired' };
      return { ok: true, expDays: exp2, version: 2 };
    }
    /* ---- v1 & semua bentuk non-v2: DITOLAK TANPA SYARAT ----
       Jalur simetris v1 sudah dicabut total dari berkas ini — penolakan
       ini bukan pemeriksaan tanggal, melainkan ketiadaan jalur
       verifikasinya sama sekali. */
    return { ok: false, reason: 'v1_disabled' };
  }

  return {
    sha256: sha256,
    deviceCode: deviceCode,
    fmtDevice: fmtDevice,
    verifyCode: verifyCode,
    /* v2 — diekspor untuk generator & harness uji (verify saja, tanpa kunci privat) */
    ed25519Verify: edVerify,
    b32encode: b32encode,
    b32decode: b32decode,
    ED25519_PUB_HEX: ED_PUB_HEX
  };
})();
