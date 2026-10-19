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
    $('listCount').textContent = list.length + ' 条便签';
    grid.innerHTML = list.map(function (r) {
      var preview = esc(r.text).slice(0, 120).replace(/\n/g, '<br>');
      return '<div class="card" data-id="' + r.local_id + '" data-color="' + esc(r.color || 'paper') + '">'
        + (r.title ? '<div class="card-t">' + esc(r.title) + '</div>' : '')
        + '<div class="card-b">' + (preview || '<span class="muted">（无正文）</span>') + '</div>'
        + '<div class="card-f"><span>' + fmt(r.update_time) + '</span></div>'
        + '</div>';
    }).join('');
    Array.prototype.forEach.call(grid.querySelectorAll('.card'), function (c) {
      c.onclick = function () { openNote(c.dataset.id); };
    });
  });
  renderFolders();
}
function renderFolders() {
  NDB.Folders.all().then(function (fs) {
    var box = $('folders');
    var items = [{ guid: 'all', name: '全部笔记' }].concat(fs).concat([{ guid: 'trash', name: '🗑 回收站' }]);
    box.innerHTML = items.map(function (f) {
      return '<button class="fol' + (state.folder === f.guid ? ' on' : '') + '" data-g="' + f.guid + '">' + esc(f.name) + '</button>';
    }).join('');
    Array.prototype.forEach.call(box.children, function (b) {
      b.onclick = function () {
        state.folder = b.dataset.g;
        state.view = b.dataset.g === 'trash' ? 'trash' : 'list';
        show(state.view === 'trash' ? 'list' : 'list'); /* 回收站仍用列表壳 */
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
  Object.keys(NED.COLORS).forEach(function (k) {
    var b = document.createElement('button');
    b.className = 'sw'; b.style.background = NED.COLORS[k]; b.dataset.c = k;
    b.onclick = function () {
      state.editor.setColor(k);
      Array.prototype.forEach.call(cs.children, function (x) { x.classList.toggle('on', x === b); });
    };
    cs.appendChild(b);
  });
  $('imgFile').onchange = function () {
    if (this.files[0]) state.editor.insertImage(this.files[0]);
    this.value = '';
  };
})();

/* ---------- 启动 ---------- */
state.editor = new NED.Editor($('editor'), function () {
  clearTimeout(state.saveTm);
  state.saveTm = setTimeout(function () { saveCurrent(true); }, 800);
});
NDB.Folders.ensure().then(function () { show('list'); });
})();
