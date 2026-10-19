/* ===== 拾光笔记 app ===== */
(function () {
'use strict';
var $ = function (id) { return document.getElementById(id); };
var editor = $('editor'), titleInput = $('titleInput'), paper = $('paper');
var isRead = !!location.hash && location.hash.length > 6 && !/^#edit/.test(location.hash);

/* ---------- 工具 ---------- */
function toast(msg) {
  var t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(t._tm); t._tm = setTimeout(function () { t.hidden = true; }, 2200);
}
function esc(s) { return (s || '').replace(/[&<>"]/g, function (c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }
function fmtDate(ts) {
  var d = ts ? new Date(ts) : new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0') + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}
function storeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function storeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

/* ---------- 主题 ---------- */
var THEMES = [['xuan','宣纸'],['mist','晨雾'],['dark','夜墨'],['green','山青']];
function applyTheme(t) {
  document.body.dataset.theme = t;
  $('miThemeName').textContent = (THEMES.filter(function(x){return x[0]===t;})[0]||['','宣纸'])[1];
  storeSet('nf.theme', t);
}
applyTheme(storeGet('nf.theme') || 'xuan');
$('miTheme').onclick = function () {
  var cur = document.body.dataset.theme, i = 0;
  THEMES.forEach(function (x, n) { if (x[0] === cur) i = n; });
  applyTheme(THEMES[(i + 1) % THEMES.length][0]);
};

/* ---------- 正文样式（颜色/字体/字号） ---------- */
var COLORS = [['#2b2926','墨黑'],['#8a6d3b','棕褐'],['#3b6e8a','湖蓝'],['#5d7a4f','松绿'],['#a04b4b','朱砂'],['#6b4f8a','紫棠'],['#c07a2a','暮橙'],['#555a63','石墨']];
var FONTS = [['default','默认','-apple-system,"PingFang SC","HarmonyOS Sans SC","Microsoft YaHei",sans-serif'],
             ['song','宋体','"Songti SC","SimSun",serif'],
             ['kai','楷体','"Kaiti SC","KaiTi",serif'],
             ['hei','黑体','"PingFang SC","Microsoft YaHei",sans-serif'],
             ['mono','等宽','ui-monospace,Consolas,monospace']];
var SIZES = [['s','紧凑','15px'],['m','标准','17px'],['l','舒朗','19px'],['xl','大字','22px']];
var styleState = JSON.parse(storeGet('nf.style') || '{}');
function applyStyle() {
  var f = FONTS.filter(function(x){return x[0]===styleState.font;})[0];
  var s = SIZES.filter(function(x){return x[0]===styleState.size;})[0];
  editor.style.fontFamily = f ? f[2] : '';
  editor.style.fontSize = s ? s[2] : '';
  $('chipFontName').textContent = f ? f[1] : '默认';
  $('chipSizeName').textContent = s ? s[1] : '标准';
  var c = styleState.color || COLORS[0][0];
  $('chipColorDot').style.background = c;
  var cn = COLORS.filter(function(x){return x[0]===c;})[0];
  $('chipColorName').textContent = cn ? cn[1] : '自定义';
  storeSet('nf.style', JSON.stringify(styleState));
}
applyStyle();

/* ---------- 弹出面板 ---------- */
var pop = $('pop');
function openPop(anchor, html, bind) {
  pop.innerHTML = html; pop.hidden = false;
  var r = anchor.getBoundingClientRect();
  var pw = pop.offsetWidth, ph = pop.offsetHeight;
  var left = Math.min(Math.max(8, r.left + r.width / 2 - pw / 2), innerWidth - pw - 8);
  var top = r.top - ph - 8; if (top < 66) top = r.bottom + 8;
  pop.style.left = left + 'px'; pop.style.top = top + 'px';
  bind(pop);
}
function closePop() { pop.hidden = true; }
document.addEventListener('pointerdown', function (e) {
  if (!pop.hidden && !pop.contains(e.target) && !e.target.closest('[data-pop],.chip')) closePop();
}, true);

function popColors() {
  var html = '<div class="pop-grid">' + COLORS.map(function (c) {
    return '<button class="sw' + (styleState.color === c[0] ? ' on' : '') + '" data-c="' + c[0] + '" style="background:' + c[0] + '" title="' + c[1] + '"></button>';
  }).join('') + '</div>';
  openPop($('chipColor'), html, function (p) {
    p.querySelectorAll('.sw').forEach(function (b) {
      b.onclick = function () {
        styleState.color = b.dataset.c; applyStyle(); closePop();
        if (!isRead) { document.execCommand('styleWithCSS', false, true); document.execCommand('foreColor', false, b.dataset.c); focusEditor(); }
      };
    });
  });
}
function popFonts() {
  var html = FONTS.map(function (f) {
    return '<button class="pop-item' + (styleState.font === f[0] ? ' on' : '') + '" data-f="' + f[0] + '" style="font-family:' + f[2] + '">' + f[1] + '<span style="margin-left:auto;color:var(--muted);font-size:12px">Aa</span></button>';
  }).join('');
  openPop($('chipFont'), html, function (p) {
    p.querySelectorAll('.pop-item').forEach(function (b) { b.onclick = function () { styleState.font = b.dataset.f; applyStyle(); closePop(); focusEditor(); }; });
  });
}
function popSizes() {
  var html = SIZES.map(function (s) {
    return '<button class="pop-item' + (styleState.size === s[0] ? ' on' : '') + '" data-s="' + s[0] + '" style="font-size:' + s[2] + '">' + s[1] + '</button>';
  }).join('');
  openPop($('chipSize'), html, function (p) {
    p.querySelectorAll('.pop-item').forEach(function (b) { b.onclick = function () { styleState.size = b.dataset.s; applyStyle(); closePop(); focusEditor(); }; });
  });
}
$('chipColor').onclick = popColors;
$('chipFont').onclick = popFonts;
$('chipSize').onclick = popSizes;

function popBlocks(anchor) {
  var html = ['H1|标题一','H2|标题二','H3|标题三','P|正文'].map(function (x) {
    var kv = x.split('|'); return '<button class="pop-item" data-b="' + kv[0] + '"><b style="width:26px;display:inline-block">' + kv[0] + '</b>' + kv[1] + '</button>';
  }).join('');
  openPop(anchor, html, function (p) {
    p.querySelectorAll('.pop-item').forEach(function (b) { b.onclick = function () { exec('formatBlock', b.dataset.b); closePop(); }; });
  });
}
function popList(anchor) {
  var html = '<button class="pop-item" data-l="insertUnorderedList">• 无序列表</button><button class="pop-item" data-l="insertOrderedList">1. 有序列表</button>';
  openPop(anchor, html, function (p) {
    p.querySelectorAll('.pop-item').forEach(function (b) { b.onclick = function () { exec(b.dataset.l); closePop(); }; });
  });
}
function popQuote(anchor) {
  var html = '<button class="pop-item" data-q="quote">❝ 引用块</button><button class="pop-item" data-q="hl">🖍 高亮选字</button>';
  openPop(anchor, html, function (p) {
    p.querySelectorAll('.pop-item').forEach(function (b) {
      b.onclick = function () {
        if (b.dataset.q === 'quote') exec('formatBlock', 'BLOCKQUOTE');
        else {
          var sel = document.getSelection();
          if (!sel.rangeCount || sel.isCollapsed) { toast('先选中要高亮的文字'); }
          else {
            var span = document.createElement('span'); span.className = 'hl';
            try { sel.getRangeAt(0).surroundContents(span); } catch (e) { toast('跨段落选择，请缩小范围'); }
          }
        }
        closePop(); focusEditor();
      };
    });
  });
}

/* ---------- 编辑命令 ---------- */
function focusEditor() { editor.focus(); }
function exec(cmd, val) {
  focusEditor();
  try { document.execCommand(cmd, false, val || null); } catch (e) {}
  onInput();
  document.querySelectorAll('.toolbar [data-cmd]').forEach(function (b) {
    try { b.classList.toggle('on', document.queryCommandState(b.dataset.cmd)); } catch (e) {}
  });
}
document.querySelectorAll('.toolbar [data-cmd]').forEach(function (b) {
  b.addEventListener('mousedown', function (e) { e.preventDefault(); });
  b.onclick = function () {
    var c = b.dataset.cmd;
    if (c === 'insertHorizontalRule') { focusEditor(); document.execCommand('insertHTML', false, '<hr><p><br></p>'); onInput(); }
    else exec(c);
  };
});
document.querySelectorAll('.toolbar [data-pop]').forEach(function (b) {
  b.addEventListener('mousedown', function (e) { e.preventDefault(); });
  b.onclick = function () {
    var fn = { blocks: popBlocks, list: popList, quote: popQuote }[b.dataset.pop];
    if (!pop.hidden && pop._owner === b.dataset.pop) { closePop(); return; }
    pop._owner = b.dataset.pop; fn(b);
  };
});

/* ---------- 图片 ---------- */
$('btnImg').onclick = function () { $('imgFile').click(); };
$('imgFile').onchange = function () {
  var f = $('imgFile').files[0]; if (!f) return;
  compressImage(f, function (dataUrl) {
    focusEditor();
    document.execCommand('insertHTML', false, '<img src="' + dataUrl + '"><p><br></p>');
    onInput();
  });
  $('imgFile').value = '';
};
function compressImage(file, cb) {
  var url = URL.createObjectURL(file);
  var img = new Image();
  img.onload = function () {
    var MAX = 1080, w = img.width, h = img.height;
    var sc = Math.min(1, MAX / Math.max(w, h));
    w = Math.round(w * sc); h = Math.round(h * sc);
    var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(img, 0, 0, w, h);
    var out = cv.toDataURL('image/jpeg', 0.7);
    if (out.length > 900 * 1024) out = cv.toDataURL('image/jpeg', 0.5);
    URL.revokeObjectURL(url);
    if (out.length > 1.6e6) { toast('图片太大，压缩后仍超 1.5MB，建议换一张'); return; }
    cb(out);
    if (out.length > 300 * 1024) toast('图片较大，分享链接会比较长');
  };
  img.onerror = function () { URL.revokeObjectURL(url); toast('图片读取失败'); };
  img.src = url;
}
/* 粘贴图片 */
editor.addEventListener('paste', function (e) {
  var items = (e.clipboardData || {}).items || [];
  for (var i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') === 0) {
      e.preventDefault();
      var f = items[i].getAsFile();
      compressImage(f, function (d) { document.execCommand('insertHTML', false, '<img src="' + d + '">'); onInput(); });
      return;
    }
  }
});
/* 拖拽图片 */
editor.addEventListener('drop', function (e) {
  var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (f && f.type.indexOf('image') === 0) {
    e.preventDefault();
    compressImage(f, function (d) { document.execCommand('insertHTML', false, '<img src="' + d + '">'); onInput(); });
  }
});

/* ---------- 自动保存 ---------- */
var saveTm;
function onInput() {
  clearTimeout(saveTm);
  saveTm = setTimeout(function () {
    storeSet('nf.doc', JSON.stringify({ title: titleInput.value, html: editor.innerHTML, ts: Date.now() }));
    var dot = $('saveDot'); dot.classList.add('on'); setTimeout(function () { dot.classList.remove('on'); }, 900);
    updateCount();
  }, 500);
  updateCount();
}
function updateCount() {
  var n = (editor.innerText || '').replace(/\s/g, '').length;
  $('wordCount').textContent = n + ' 字';
}
editor.addEventListener('input', onInput);
titleInput.addEventListener('input', onInput);

/* ---------- 分享 ---------- */
var currentShare = '';
function collectNote() {
  return { v: 2, a: authorId(), title: titleInput.value || '', html: NF.sanitize(editor.innerHTML), ts: Date.now(), st: styleState };
}
async function buildShare(pw) {
  var note = collectNote();
  var enc = pw ? await NF.encodeEncrypted(note, pw) : await NF.encode(note);
  var base = location.href.split('#')[0];
  currentShare = base + '#' + enc;
  var kb = (currentShare.length / 1024).toFixed(1);
  $('linkSize').textContent = (pw ? '🔒 密码链接 · ' : '链接长度 ') + (pw ? kb + ' KB · 需输入密码查看' : kb + ' KB · 任何人打开即读');
  $('linkBox').textContent = currentShare;
  if (currentShare.length > 60000) toast('链接超过 60KB，微信可能截断，建议删减图片或文字');
}
$('btnShare').onclick = async function () {
  if (!editor.innerText.trim() && !editor.querySelector('img')) { toast('先写点内容再分享'); return; }
  $('pwRow').hidden = true; $('pwInput').value = '';
  $('shareSheet').hidden = false;
  $('linkSize').textContent = '链接生成中…'; $('linkBox').textContent = '…';
  try { await buildShare(''); } catch (e) { toast('生成失败：' + e.message); }
};
$('btnPw').onclick = function () { $('pwRow').hidden = !$('pwRow').hidden; if (!$('pwRow').hidden) $('pwInput').focus(); };
$('btnPwGo').onclick = async function () {
  var pw = $('pwInput').value;
  if (pw.length < 4) { toast('密码至少 4 位'); return; }
  try { await buildShare(pw); toast('加密链接已生成'); } catch (e) { toast('加密失败：' + e.message); }
};
$('btnCopyLink').onclick = function () { copyText(currentShare); };
function copyText(t) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).then(function () { toast('已复制，去粘贴给好友或发朋友圈'); }, function () { fallbackCopy(t); });
  } else fallbackCopy(t);
}
function fallbackCopy(t) {
  var ta = document.createElement('textarea'); ta.value = t;
  ta.style.cssText = 'position:fixed;left:-9999px';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); toast('已复制'); } catch (e) { toast('请长按链接手动复制'); }
  document.body.removeChild(ta);
}

/* ---------- 更多菜单 / 导出 / 清空 ---------- */
$('btnMore').onclick = function () { $('moreSheet').hidden = false; };
document.querySelectorAll('[data-close]').forEach(function (b) {
  b.onclick = function () { b.closest('.sheet').hidden = true; };
});
$('miCopy').onclick = function () {
  var txt = (titleInput.value ? titleInput.value + '\n\n' : '') + editor.innerText;
  copyText(txt); $('moreSheet').hidden = true;
};
$('miExport').onclick = function () {
  var note = collectNote();
  var html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(note.title || '拾光笔记') + '</title><style>body{background:#f2efe8;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#2b2926;display:flex;justify-content:center;padding:24px 10px}main{background:#fffdf7;max-width:700px;width:100%;border-radius:18px;padding:30px;border:1px solid #e6e0d2}h1{font-size:26px;margin:0 0 6px}.d{color:#9a927f;font-size:12px;border-bottom:1px dashed #e6e0d2;padding-bottom:12px;margin-bottom:14px}img{max-width:100%;border-radius:12px}blockquote{border-left:3px solid #b98a2f;background:#f3e7cd;padding:8px 14px;border-radius:0 10px 10px 0}hr{border:none;border-top:1px dashed #e6e0d2;margin:1.2em 0}.hl{background:#ffe97d;border-radius:3px}</style></head><body><main><h1>' + esc(note.title || '拾光笔记') + '</h1><div class="d">' + fmtDate(note.ts) + ' · 拾光笔记</div><div style="line-height:1.9;font-size:17px">' + note.html + '</div></main></body></html>';
  var blob = new Blob([html], { type: 'text/html' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (note.title || '拾光笔记').slice(0, 30) + '.html';
  a.click();
  $('moreSheet').hidden = true; toast('已导出 HTML');
};
$('miClear').onclick = function () {
  if (!confirm('确定清空当前笔记？（本机草稿会被清掉，已分享的链接不受影响）')) return;
  titleInput.value = ''; editor.innerHTML = '<p><br></p>'; onInput();
  $('moreSheet').hidden = true; toast('已清空');
};

/* ---------- 返回 ---------- */
$('btnBack').onclick = function () {
  if (history.length > 1) history.back(); else location.href = location.href.split('#')[0];
};

/* ================= 阅读模式 ================= */
var encBuf = null;
var readNote = null;   /* 当前阅读的笔记 */
var isAuthor = false;  /* 这条分享是不是我自己发的 */

/* 作者识别：分享时把随机 id 写进链接，存在本机 localStorage 里。
   别人打开没有这个 id → 只读；你自己打开 → 可编辑。 */
function authorId() {
  var id = storeGet('nf.author');
  if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); storeSet('nf.author', id); }
  return id;
}
function isMine(a) { return !!(a && a === storeGet('nf.author')); }

async function enterRead(note) {
  readNote = note;
  document.body.classList.add('read');
  document.title = (note.title || '拾光笔记') + ' · 来自分享';
  titleInput.value = note.title || '';
  titleInput.readOnly = true;
  /* 关键：真正关掉编辑能力，而不是只靠 CSS 挡点击 */
  editor.setAttribute('contenteditable', 'false');
  editor.innerHTML = NF.sanitize(note.html || '');
  if (note.st) { styleState = note.st; applyStyle(); }
  $('metaDate').textContent = fmtDate(note.ts);
  $('docTitleLabel').textContent = note.title || '一篇分享笔记';
  $('rbTitle').textContent = note.title || '来自分享的笔记';
  $('rbDate').textContent = fmtDate(note.ts) + ' · 拾光笔记';
  updateCount();
  $('readBar').hidden = false;
  $('btnShare').style.display = 'none';
  $('btnMore').style.display = 'none';
  $('btnBack').style.display = 'none';

  /* 作者本人才能看到「继续编辑」；访客只看到复制链接和另存 */
  var mine = isMine(note.a);
  $('rbEdit').hidden = !mine;
  $('rbSave').hidden = mine;
  if (mine) toast('这是你自己的分享，可继续编辑');
}
/* 访客版「另存」：把别人的笔记存成自己的草稿，在副本上改，不动原文 */
$('rbSave').onclick = function () {
  if (!readNote) return;
  storeSet('nf.doc', JSON.stringify({
    title: (readNote.title || '') + '（副本）',
    html: NF.sanitize(readNote.html || ''), ts: Date.now()
  }));
  toast('已存为我的笔记副本，可修改后重新分享');
  location.href = location.href.split('#')[0];
};
$('rbCopy').onclick = function () { copyText(location.href); };
$('rbEdit').onclick = function () {
  if (!isMine(readNote && readNote.a)) { toast('这条分享不是你发的，只能另存为副本'); return; }
  /* 把分享内容载入编辑器，去掉 hash 回到编辑态 */
  storeSet('nf.doc', JSON.stringify({ title: titleInput.value, html: editor.innerHTML, ts: Date.now() }));
  history.replaceState(null, '', location.pathname + location.search);
  document.body.classList.remove('read');
  editor.setAttribute('contenteditable', 'true');
  titleInput.readOnly = false;
  $('readBar').hidden = true;
  $('btnShare').style.display = ''; $('btnMore').style.display = ''; $('btnBack').style.display = '';
  toast('已载入编辑器，可继续修改后重新分享');
  window.scrollTo(0, 0);
};
/* 硬防线：阅读态下任何输入企图都截断 */
editor.addEventListener('beforeinput', function (e) { if (document.body.classList.contains('read')) e.preventDefault(); });
editor.addEventListener('keydown', function (e) {
  if (document.body.classList.contains('read') && !e.metaKey && !e.ctrlKey) e.preventDefault();
});

async function unlockTry() {
  var pw = $('unlockPw').value;
  if (!pw) return;
  $('unlockErr').textContent = '';
  try {
    var note = await NF.decodeEncrypted(encBuf, pw);
    $('unlock').hidden = true;
    enterRead(note);
  } catch (e) { $('unlockErr').textContent = e.message || '密码错误'; }
}
$('btnUnlock').onclick = unlockTry;
$('unlockPw').addEventListener('keydown', function (e) { if (e.key === 'Enter') unlockTry(); });

/* ================= 启动 ================= */
(async function boot() {
  if (isRead) {
    try {
      var data = await NF.decode(decodeURIComponent(location.hash.slice(1)));
      if (data && data.__enc) {
        encBuf = data.__enc;
        document.body.classList.add('read');
        $('readBar').hidden = true;
        $('unlock').hidden = false;
        setTimeout(function () { $('unlockPw').focus(); }, 100);
        return;
      }
      await enterRead(data);
    } catch (e) {
      document.body.classList.remove('read');
      toast('打开失败：' + e.message);
      loadDraft();
    }
    return;
  }
  loadDraft();
})();

function loadDraft() {
  editor.setAttribute('contenteditable', 'true');
  titleInput.readOnly = false;
  try {
    var d = JSON.parse(storeGet('nf.doc') || 'null');
    if (d && (d.html || d.title)) {
      titleInput.value = d.title || '';
      editor.innerHTML = NF.sanitize(d.html || '');
      $('metaDate').textContent = '草稿 ' + fmtDate(d.ts);
      $('docTitleLabel').textContent = '拾光笔记';
    }
  } catch (e) {}
  updateCount();
}

/* hash 变化（在已打开页面粘贴新链接） */
window.addEventListener('hashchange', function () { location.reload(); });
})();
