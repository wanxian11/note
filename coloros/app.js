/* app.js — 页面编排：列表（卡片流）/ 编辑 / 回收站 / 分类 / 搜索 */
(function () {
'use strict';
var $ = function (id) { return document.getElementById(id); };
var state = { view: 'list', folder: 'all', filter: 'active', keyword: '', current: null, editor: null, saveTm: null };

function esc(s) { return (s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function fmt(ts) {
  if (!ts) return '';
  var d = new Date(ts), n = new Date();
  var hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  if (d.toDateString() === n.toDateString()) return hm;
  return (d.getMonth() + 1) + '月' + d.getDate() + '日';
}
function toast(m) {
  var t = $('toast'); t.textContent = m; t.hidden = false;
  clearTimeout(t._tm); t._tm = setTimeout(function () { t.hidden = true; }, 1800);
}

/* ---------- 列表 ---------- */
function renderList() {
  var grid = $('grid');
  NDB.Notes.all(state.view === 'trash' ? 'trash' : 'active').then(function (rows) {
    var kw = state.keyword.toLowerCase();
    var fs = state.folder;
    var list = rows.filter(function (r) {
      if (fs !== 'all' && fs !== 'trash' && fs !== r.folder_id) return false;
      if (!kw) return true;
      return (r.title + ' ' + r.text).toLowerCase().indexOf(kw) >= 0;
    });
    $('empty').hidden = list.length > 0;
    $('listCount').textContent = list.length ? list.length + ' 条便签' : '';
    /* 空态文案跟随语境：搜索无结果 ≠ 一条便签都没有 */
    if (!list.length) {
      var ep = $('empty').querySelector('p');
      ep.textContent = state.keyword ? '没有匹配「' + state.keyword + '」的便签' : '还没有便签';
    }
    grid.innerHTML = list.map(function (r) {
      var preview = esc(r.text).slice(0, 140).replace(/\n+/g, ' ');
      return '<article class="card" data-id="' + r.local_id + '" data-color="' + esc(r.color || 'paper') + '" tabindex="0" role="button">'
        + (r.title ? '<h2 class="card-t">' + esc(r.title) + '</h2>' : '')
        + '<p class="card-b">' + (preview || '<span class="muted">无正文</span>') + '</p>'
        + '<div class="card-f">' + fmt(r.update_time) + '</div>'
        + '</article>';
    }).join('');
    Array.prototype.forEach.call(grid.querySelectorAll('.card'), function (c) {
      c.onclick = function () { openNote(c.dataset.id); };
      c.onkeydown = function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openNote(c.dataset.id); }
      };
    });
  });
  renderFolders();
}
function renderFolders() {
  NDB.Folders.all().then(function (fs) {
    var box = $('folders');
    /* 'all' 是虚拟汇总项，不来自 folders 表。
       过滤掉库里的 default 系统分类（名为「所有笔记」），否则会出现两个语义相同的胶囊。 */
    var real = fs.filter(function (f) {
      return f.guid !== 'default' && f.name !== '所有笔记';
    });
    var items = [{ guid: 'all', name: '全部笔记' }].concat(real).concat([{ guid: 'trash', name: '回收站' }]);
    box.innerHTML = items.map(function (f) {
      return '<button class="fol' + (state.folder === f.guid ? ' on' : '') + '" data-g="' + f.guid + '">' + esc(f.name) + '</button>';
    }).join('');
    Array.prototype.forEach.call(box.children, function (b) {
      b.onclick = function () {
        state.folder = b.dataset.g;
        state.view = b.dataset.g === 'trash' ? 'trash' : 'list';
        show('list');
        renderList();
      };
    });
  });
}

/* ---------- 视图切换 ---------- */
function show(v) {
  state.view = v;
  $('listView').hidden = v !== 'list';
  $('editView').hidden = v !== 'edit';
  $('fab').hidden = v !== 'list';
  if (v === 'list') { renderList(); }
}

/* ---------- 编辑 ---------- */
function openNote(id) {
  NDB.Notes.get(id).then(function (r) {
    if (!r) return;
    state.current = r;
    show('edit');
    $('titleInput').value = r.title || '';
    state.editor.load(r.raw_text);
    state.editor.setColor(r.color || 'paper');
    $('editMeta').textContent = '更新于 ' + fmt(r.update_time);
    $('trashBtn').hidden = state.view === 'trash' && r.recycle_time > 0 ? false : false;
    $('restoreBtn').hidden = !(r.recycle_time > 0);
    $('delBtn').hidden = r.recycle_time > 0;
  });
}
function newNote() {
  NDB.Notes.create({ raw_text: '', title: '' }).then(function (r) {
    state.current = r;
    show('edit');
    $('titleInput').value = '';
    state.editor.load('');
    state.editor.setColor('paper');
    $('editMeta').textContent = '新建';
    $('restoreBtn').hidden = true; $('delBtn').hidden = false;
    state.editor.focus();
  });
}
function saveCurrent(silent) {
  var r = state.current; if (!r) return;
  r.title = $('titleInput').value.trim();
  r.raw_text = state.editor.getHTML();
  r.color = state.editor.getColor();
  NDB.Notes.update(r).then(function () {
    if (!silent) { toast('已保存'); }
    $('editMeta').textContent = '更新于 ' + fmt(r.update_time);
  });
}

/* ---------- 顶栏按钮 ---------- */
$('backBtn').onclick = function () {
  if (state.view === 'edit' && state.current) {
    var r = state.current;
    var empty = !r.title && !state.editor.getText() && !state.editor.root.querySelector('img');
    if (empty && r.recycle_time === 0) { NDB.Notes.purge(r.local_id); }
    else saveCurrent(true);
  }
  show('list');
};
$('searchBtn').onclick = function () { $('searchWrap').hidden = false; $('searchInput').focus(); };
$('searchClose').onclick = function () { $('searchWrap').hidden = true; state.keyword = ''; $('searchInput').value = ''; renderList(); };
$('searchInput').oninput = function () { state.keyword = this.value.trim(); renderList(); };
$('fab').onclick = newNote;

$('titleInput').oninput = function () {
  clearTimeout(state.saveTm);
  state.saveTm = setTimeout(function () { saveCurrent(true); }, 600);
};

$('trashBtn').onclick = function () {
  var r = state.current; if (!r) return;
  if (r.recycle_time > 0) {
    NDB.Notes.purge(r.local_id); toast('已彻底删除');
  } else {
    NDB.Notes.toTrash(r.local_id); toast('已移入回收站');
  }
  show('list');
};
$('restoreBtn').onclick = function () {
  NDB.Notes.restore(state.current.local_id).then(function () { toast('已恢复'); state.folder = 'all'; show('list'); });
};
$('delBtn').onclick = function () {
  if (!confirm('删除这条便签？（进回收站）')) return;
  /* 删除的是教程种子则打标记，不再自动补种 */
  if (state.current && state.current.title === AIDOGE_TUTORIAL.title) { try { localStorage.setItem('nf.tut.removed', '1'); } catch (e) {} }
  NDB.Notes.toTrash(state.current.local_id).then(function () { show('list'); });
};
$('emptyTrash').onclick = function () {
  if (!confirm('清空回收站？此操作不可恢复')) return;
  NDB.Notes.emptyTrash().then(function () { toast('回收站已清空'); renderList(); });
};

/* ---------- 工具栏绑定 ---------- */
var TOOLBAR = [
  ['bold', function () { state.editor.cmd('bold'); }],
  ['italic', function () { state.editor.cmd('italic'); }],
  ['underline', function () { state.editor.cmd('underline'); }],
  ['strike', function () { state.editor.cmd('strikeThrough'); }],
  ['h2', function () { state.editor.heading('H2'); }],
  ['quote', function () { state.editor.cmd('formatBlock', 'BLOCKQUOTE'); }],
  ['ul', function () { state.editor.cmd('insertUnorderedList'); }],
  ['ol', function () { state.editor.cmd('insertOrderedList'); }],
  ['todo', function () { state.editor.checklist(); }],
  ['hr', function () { state.editor.root.focus(); document.execCommand('insertHTML', false, '<hr>'); }],
  ['img', function () { $('imgFile').click(); }],
  ['center', function () { state.editor.align('center'); }],
  ['undo', function () { state.editor.cmd('undo'); }],
  ['redo', function () { state.editor.cmd('redo'); }]
];
(function bindToolbar() {
  var bar = $('toolbar');
  TOOLBAR.forEach(function (t) {
    var b = bar.querySelector('[data-t="' + t[0] + '"]');
    if (b) b.onclick = t[1];
  });
  var cs = $('colorRow');
  var NAMES = { paper: '白', mist: '雾', lemon: '米', peach: '桃', violet: '紫', mint: '青', dark: '夜' };
  Object.keys(NED.COLORS).forEach(function (k) {
    var b = document.createElement('button');
    b.className = 'sw';
    b.dataset.c = k;
    b.type = 'button';
    b.title = NAMES[k] || k;
    b.setAttribute('aria-label', '便签纸颜色：' + (NAMES[k] || k));
    b.onclick = function () {
      state.editor.setColor(k);
      Array.prototype.forEach.call(cs.children, function (x) {
        var on = x === b;
        x.classList.toggle('on', on);
        x.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    };
    cs.appendChild(b);
  });
  $('imgFile').onchange = function () {
    if (this.files[0]) state.editor.insertImage(this.files[0]);
    this.value = '';
  };
})();

/* ---------- 分享（仿 ColorOS 分享面板：链接 / 文字 / 图片） ---------- */
function shareNote() {
  /* 先把未落盘的编辑写回去 */
  var r = state.current; if (!r) return;
  r.title = $('titleInput').value.trim();
  r.raw_text = state.editor.getHTML();
  r.color = state.editor.getColor();
  r.text = NDB.toText(r.raw_text);
  NDB.Notes.update(r).then(function () {
    $('shareSheet').hidden = false;
    $('shLinkBox').hidden = true; $('shPwRow').hidden = true; $('shPwInput').value = '';
  });
}
$('shareBtn').onclick = shareNote;
$('shCancel').onclick = $('shareMask').onclick = function () { $('shareSheet').hidden = true; };

function shareLink(pw) {
  var r = state.current;
  var payload = { v: 1, title: r.title || '', html: r.raw_text || ('<p>' + esc(r.text) + '</p>'), ts: r.update_time };
  var base = location.href.split('#')[0];
  var p = pw ? NF.encodeEncrypted(payload, pw) : NF.encode(payload);
  p.then(function (enc) {
    var link = base + '#' + enc;
    var box = $('shLinkBox');
    box.hidden = false;
    box.textContent = link;
    copyText(link);
    var kb = (link.length / 1024).toFixed(1);
    /* 回环地址提示：本地开发时生成的链接别人打不开。
       这是必须被读到的状态警示，不走 1.8s 自动消失的普通 toast，改用常驻警示条。 */
    if (/^https?:\/\/(127\.0\.0\.1|localhost)/.test(link)) {
      var warn = document.getElementById('loopWarn');
      if (!warn) {
        warn = document.createElement('div');
        warn.id = 'loopWarn';
        warn.style.cssText = 'margin:8px 0 0;padding:10px 12px;border-radius:8px;background:#FBF1EF;border:1px solid #E8C7C2;color:#8C3B32;font-size:12.5px;line-height:1.6';
        $('shLinkBox').parentNode.insertBefore(warn, $('shLinkBox').nextSibling);
      }
      warn.innerHTML = '⚠️ 这是<b>本机地址</b>，只有你自己打得开。部署到线上后生成的链接才会带正确域名。';
    } else {
      var w2 = document.getElementById('loopWarn');
      if (w2) w2.remove();
      toast('链接已复制（' + kb + ' KB）' + (pw ? ' · 需密码查看' : ''));
    }
    if (link.length > 60000) toast('链接超 60KB，微信可能截断');
  })['catch'](function (e) { toast('生成失败：' + e.message); });
}
$('shLink').onclick = function () { $('shPwRow').hidden = false; $('shPwInput').focus(); };
$('shPwGo').onclick = function () {
  var pw = $('shPwInput').value.trim();
  if (pw.length > 0 && pw.length < 4) { toast('密码至少 4 位'); return; }
  shareLink(pw || null);
};
$('shText').onclick = function () {
  var r = state.current;
  copyText((r.title ? r.title + '\n\n' : '') + (r.text || ''));
  $('shareSheet').hidden = true;
};
/* 链接框点击即复制整条链接，不用手动选中折行文本 */
$('shLinkBox').onclick = function () {
  var t = this.textContent;
  if (t) copyText(t);
};

/* 以图片形式分享：Canvas 绘制便签卡片（纸色底 + 标题 + 正文折行），下载 PNG */
$('shPic').onclick = function () {
  var r = state.current;
  var W = 1080, PAD = 72, lh = 56;
  var bg = NED.COLORS[r.color] || NED.COLORS.paper;
  var dark = r.color === 'dark';
  var body = r.text || '';
  var cv = document.createElement('canvas');
  var ctx = cv.getContext('2d');
  var font = '34px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
  var tfont = 'bold 52px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
  function wrap(text, maxW, f) {
    ctx.font = f;
    var lines = [];
    text.split('\n').forEach(function (para) {
      var cur = '';
      for (var i = 0; i < para.length; i++) {
        var t = cur + para[i];
        if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = para[i]; }
        else cur = t;
      }
      lines.push(cur);
    });
    return lines;
  }
  var titleLines = r.title ? wrap(r.title, W - PAD * 2, tfont) : [];
  var bodyLines = wrap(body, W - PAD * 2, font);
  var H = PAD + titleLines.length * 68 + (titleLines.length ? 28 : 0) + bodyLines.length * lh + PAD + 40;
  cv.width = W; cv.height = Math.max(H, 400);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, cv.height);
  ctx.fillStyle = dark ? '#e6e2da' : '#242220';
  var y = PAD;
  ctx.font = tfont;
  titleLines.forEach(function (l) { ctx.fillText(l, PAD, y); y += 68; });
  if (titleLines.length) y += 28;
  ctx.font = font;
  bodyLines.forEach(function (l) { ctx.fillText(l, PAD, y); y += lh; });
  ctx.fillStyle = dark ? '#8a8781' : '#98938a';
  ctx.font = '26px sans-serif';
  ctx.fillText(fmt(r.update_time) + ' · 便签', PAD, cv.height - PAD + 18);
  var a = document.createElement('a');
  a.href = cv.toDataURL('image/png');
  a.download = (r.title || '便签').slice(0, 20) + '.png';
  a.click();
  $('shareSheet').hidden = true;
  toast('图片已保存');
};

function copyText(t) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).then(function () { toast('已复制，去粘贴吧'); }, function () { fallbackCopy(t); });
  } else fallbackCopy(t);
}
function fallbackCopy(t) {
  var ta = document.createElement('textarea'); ta.value = t;
  ta.style.cssText = 'position:fixed;left:-9999px';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); toast('已复制'); } catch (e) { toast('请长按文字手动复制'); }
  document.body.removeChild(ta);
}

/* ---------- 链接阅读模式：打开带 # 的分享链接时只读展示 ---------- */
state.editor = new NED.Editor($('editor'), function () {
  clearTimeout(state.saveTm);
  state.saveTm = setTimeout(function () { saveCurrent(true); }, 800);
});
var readBuf = null;
async function openShared(html, title, ts, pw) {
  $('listView').hidden = true; $('editView').hidden = true; $('fab').hidden = true;
  $('readView').hidden = false;
  $('readTitle').textContent = title || '';
  $('readMeta').textContent = (ts ? fmt(ts) + ' · 来自分享' : '来自分享');
  $('readPaper').innerHTML = NF.sanitize(html || '');
  document.title = (title || '便签') + ' · 来自分享';
  if (pw) { $('readPwBtn').hidden = false; }
}
$('readPwBtn').onclick = function () {
  var pw = prompt('输入这篇便签的查看密码');
  if (!pw) return;
  NF.decodeEncrypted(readBuf, pw).then(function (n) { openShared(n.html, n.title, n.ts); })
    .catch(function (e) { alert(e.message || '密码错误'); });
};
$('readCopyBtn').onclick = function () { copyText(location.href); };

(async function boot() {
  var h = decodeURIComponent(location.hash.slice(1));
  if (h.length > 6) {
    try {
      var data = await NF.decode(h);
      if (data && data.__enc) {
        readBuf = data.__enc;
        $('listView').hidden = true; $('editView').hidden = true; $('fab').hidden = true;
        $('readView').hidden = false;
        $('readTitle').textContent = '🔒 这篇便签已加密';
        $('readMeta').textContent = '需要作者提供的查看密码';
        $('readPaper').innerHTML = '<p style="opacity:.6">点击下方按钮输入密码解锁</p>';
        $('readPwBtn').hidden = false;
        return;
      }
      await openShared(data.html, data.title, data.ts, h.indexOf('2.') === 0);
    } catch (e) { alert('打开失败：' + e.message); }
    return;
  }
  /* 首屏种子：AIDoge 教程（仅在库中还没有时种一次，用户删掉后不再自动补） */
  NDB.Folders.ensure().then(function () {
    return NDB.Notes.all().then(function (all) {
      var hasTut = all.some(function (r) {
        return r.title === AIDOGE_TUTORIAL.title || (r.raw_text || '').indexOf('AIDoge 是什么') >= 0;
      });
      if (!hasTut) {
        /* 用户删除过教程则不再自动补种 */
        var removed = false;
        try { removed = localStorage.getItem('nf.tut.removed') === '1'; } catch (e) {}
        if (removed) return null;
        return NDB.Notes.create({ title: AIDOGE_TUTORIAL.title, raw_text: AIDOGE_TUTORIAL.html, color: 'lemon' });
      }
      return null;
    });
  }).then(function () { show('list'); });
})();
/* 同页粘贴新分享链接时只触发 hashchange 不重载 → 手动刷新进阅读态 */
window.addEventListener('hashchange', function () { location.reload(); });
})();
