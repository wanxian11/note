/* NoteForge codec — 内容全部编码进 URL #片段（浏览器不会把 # 后面的内容发给服务器/爬虫）
   格式:  1.d.<base64url(deflate-raw(json))>   明文压缩
          1.r.<base64url(utf8(json))>          明文(无 CompressionStream 时回退)
          2.<base64url(salt16|iv12|AES-GCM密文)> 密码模式
*/
(function (global) {
  'use strict';
  var te = new TextEncoder(), td = new TextDecoder();

  function b64u(bytes) {
    var s = '', CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    }
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unb64u(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    var bin = atob(str), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function hasCS() { return typeof global.CompressionStream !== 'undefined' && typeof global.Response !== 'undefined'; }

  async function deflate(bytes) {
    if (!hasCS()) return null;
    var cs = new CompressionStream('deflate-raw');
    var w = cs.writable.getWriter(); w.write(bytes); w.close();
    var ab = await new Response(cs.readable).arrayBuffer();
    return new Uint8Array(ab);
  }
  async function inflate(bytes) {
    if (!hasCS()) return null;
    var ds = new DecompressionStream('deflate-raw');
    var w = ds.writable.getWriter(); w.write(bytes); w.close();
    var ab = await new Response(ds.readable).arrayBuffer();
    return new Uint8Array(ab);
  }

  async function encode(obj) {
    var bytes = te.encode(JSON.stringify(obj));
    var d = await deflate(bytes);
    if (d && d.length < bytes.length) return '1.d.' + b64u(d);
    return '1.r.' + b64u(bytes);
  }

  /* 返回: 明文 -> note 对象; 加密 -> {__enc:Uint8Array} */
  async function decode(str) {
    if (str.indexOf('1.') === 0) {
      var kind = str.charAt(2), bytes = unb64u(str.slice(4));
      if (kind === 'd') {
        var raw = await inflate(bytes);
        if (!raw) throw new Error('本浏览器不支持解压，请用 Chrome/Edge 打开');
        return JSON.parse(td.decode(raw));
      }
      return JSON.parse(td.decode(bytes));
    }
    if (str.indexOf('2.') === 0) return { __enc: unb64u(str.slice(2)) };
    throw new Error('链接格式不正确');
  }

  async function deriveKey(pw, salt) {
    var km = await crypto.subtle.importKey('raw', te.encode(pw), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: salt, iterations: 150000, hash: 'SHA-256' },
      km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function encodeEncrypted(obj, pw) {
    var salt = crypto.getRandomValues(new Uint8Array(16));
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var key = await deriveKey(pw, salt);
    var pt = te.encode(JSON.stringify(obj));
    var pt2;
    if (hasCS()) { var d = await deflate(pt); pt2 = (d && d.length < pt.length) ? d : pt; }
    else pt2 = pt;
    var ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, pt2));
    var all = new Uint8Array(16 + 12 + ct.length);
    all.set(salt, 0); all.set(iv, 16); all.set(ct, 28);
    return '2.' + b64u(all);
  }
  async function decodeEncrypted(buf, pw) {
    if (buf.length < 28) throw new Error('链接不完整');
    var salt = buf.subarray(0, 16), iv = buf.subarray(16, 28), ct = buf.subarray(28);
    var key = await deriveKey(pw, salt);
    var pt;
    try { pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ct)); }
    catch (e) { throw new Error('密码错误'); }
    if (pt.length && pt[0] !== 0x7b) { // JSON 必以 { 开头，否则是压缩字节
      var infl = await inflate(pt);
      if (infl) pt = infl;
    }
    return JSON.parse(td.decode(pt));
  }

  /* HTML 净化：白名单标签 + 受限 style，防分享页被注入 */
  var OK_TAGS = { P:1, DIV:1, BR:1, B:1, STRONG:1, I:1, EM:1, U:1, S:1, STRIKE:1, H1:1, H2:1, H3:1, H4:1, UL:1, OL:1, LI:1, BLOCKQUOTE:1, PRE:1, CODE:1, IMG:1, SPAN:1, A:1, FONT:1 };
  function safeStyle(v) {
    var keep = [];
    (v || '').split(';').forEach(function (d) {
      var kv = d.split(':'); if (kv.length < 2) return;
      var k = kv[0].trim().toLowerCase(), val = kv.slice(1).join(':').trim();
      if (!/^(color|background-color|text-align|font-weight|font-style|text-decoration)$/.test(k)) return;
      if (!/^([a-z]+|#[0-9a-f]{3,8}|rgba?\([\d.,\s%]+\))$/i.test(val)) return;
      keep.push(k + ':' + val);
    });
    return keep.join(';');
  }
  function safeSrc(src) {
    if (!src) return '';
    if (/^(data:image\/(png|jpe?g|webp|gif)[,;])/i.test(src)) return src;
    if (/^https?:\/\//i.test(src)) return src;
    return '';
  }
  function sanitize(html) {
    var doc = new DOMParser().parseFromString('<body><div id="r">' + html + '</div></body>', 'text/html');
    var root = doc.getElementById('r');
    (function walk(node) {
      var kids = Array.prototype.slice.call(node.children);
      kids.forEach(function (el) {
        walk(el);
        var tag = el.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'IFRAME' || tag === 'OBJECT' || tag === 'EMBED') { el.remove(); return; }
        if (!OK_TAGS[tag]) { // 未知标签：保留文字，剥掉壳
          while (el.firstChild) node.insertBefore(el.firstChild, el);
          el.remove(); return;
        }
        Array.prototype.slice.call(el.attributes).forEach(function (at) {
          var n = at.name.toLowerCase();
          if (tag === 'IMG' && n === 'src') { var s = safeSrc(at.value); if (!s) el.remove(); else el.setAttribute('src', s); return; }
          if (tag === 'IMG' && (n === 'alt')) return;
          if (tag === 'A' && n === 'href') { if (!/^(https?:|mailto:)/i.test(at.value)) el.removeAttribute('href'); else { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer'); } return; }
          if (n === 'style') { var st = safeStyle(at.value); if (st) el.setAttribute('style', st); else el.removeAttribute('style'); return; }
          if (tag === 'FONT' && n === 'color') return;
          el.removeAttribute(at.name);
        });
        if (tag === 'A' && !el.getAttribute('href')) { while (el.firstChild) node.insertBefore(el.firstChild, el); el.remove(); }
      });
    })(root);
    return root.innerHTML;
  }

  global.NF = {
    encode: encode, decode: decode, encodeEncrypted: encodeEncrypted, decodeEncrypted: decodeEncrypted,
    b64u: b64u, unb64u: unb64u, sanitize: sanitize, safeSrc: safeSrc
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
