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
      /* 教程/复刻文档曾被删（打标记）且当前是全空态 → 提供恢复入口 */
      var removed = false, docRemoved = false;
      try { removed = localStorage.getItem('nf.tut.removed') === '1'; } catch (e) {}
      try { docRemoved = localStorage.getItem('nf.doc.removed') === '1'; } catch (e) {}
      $('btnRestoreTut').hidden = !(removed && !state.keyword);
      var db = $('btnRestoreDoc');
      if (db) db.hidden = !(docRemoved && !state.keyword);
    } else {
      $('btnRestoreTut').hidden = true;
      var db2 = $('btnRestoreDoc');
      if (db2) db2.hidden = true;
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
  /* 删除的是种子便签则打标记，不再自动补种 */
  if (state.current && state.current.title === AIDOGE_TUTORIAL.title) { try { localStorage.setItem('nf.tut.removed', '1'); } catch (e) {} }
  if (state.current && COLOROS_DOC && state.current.title === COLOROS_DOC.title) { try { localStorage.setItem('nf.doc.removed', '1'); } catch (e) {} }
  NDB.Notes.toTrash(state.current.local_id).then(function () { show('list'); });
};
/* 空态「恢复教程」：清掉删除标记并重新种入 */
$('btnRestoreTut').onclick = function () {
  try { localStorage.removeItem('nf.tut.removed'); } catch (e) {}
  NDB.Notes.create({ title: AIDOGE_TUTORIAL.title, raw_text: AIDOGE_TUTORIAL.html, color: 'lemon' })
    .then(function () { show('list'); toast('教程已恢复到首页'); });
};
/* 空态「恢复复刻文档」：清掉删除标记并重新种入（与教程同款便签机制） */
var __bd = $('btnRestoreDoc');
if (__bd) __bd.onclick = function () {
  try { localStorage.removeItem('nf.doc.removed'); } catch (e) {}
  NDB.Notes.create({ title: COLOROS_DOC.title, raw_text: COLOROS_DOC.html, color: 'paper' })
    .then(function () { show('list'); toast('复刻文档已恢复到首页'); });
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
    /* 固定链接区：点「以链接形式分享」后才随密码行一起出现（生成按钮在那） */
    var liveRow = $('shLiveRow');
    if (liveRow) liveRow.hidden = true;
    var cb = $('shLiveChk');
    if (cb) { cb.checked = false; cb.disabled = false; }
    var go = $('shPwGo');
    if (go) go.textContent = '生成';
    var hint = $('shLiveHint');
    if (hint) hint.textContent = r.live_id
      ? '已创建过：' + r.live_id + '（勾选后点「生成」即覆盖更新，链接不变）'
      : '首次创建后，以后改完内容再点一次即可';
  });
}
$('shareBtn').onclick = shareNote;
$('shCancel').onclick = $('shareMask').onclick = function () { $('shareSheet').hidden = true; };

/* ---------- GitHub 短链：分享内容存进自己的仓库，链接只带 11 位短 ID ----------
   存到 wanxian11/note 的 shares/<id>.json；读取走 raw.githubusercontent（CORS 开放），
   jsDelivr 与站点自身目录作为备用源。ID 由内容哈希得出：同内容复用同一链接、旧链接永不失效。 */
var GH_REPO = 'wanxian11/note';
var GH_BRANCH = 'main';

function ghToken() {
  try { return localStorage.getItem('nf.gh.token') || ''; } catch (e) { return ''; }
}
function ghTokenSave(t) {
  try { localStorage.setItem('nf.gh.token', t); } catch (e) {}
}
/* 内容哈希做短 ID：11 位，同内容同链接 */
function shortIdFor(enc) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(enc)).then(function (buf) {
    var hex = '';
    Array.prototype.slice.call(new Uint8Array(buf), 0, 5).forEach(function (b) {
      hex += ('0' + b.toString(16)).slice(-2);
    });
    return 'n' + hex;
  });
}
/* 固定链接 ID：随机而非内容哈希 —— 内容换了 ID 不换，链接才能恒定 */
function liveIdNew() {
  var b = crypto.getRandomValues(new Uint8Array(5)), hex = '';
  b.forEach(function (x) { hex += ('0' + x.toString(16)).slice(-2); });
  return 'n' + hex;
}
function ghPutShare(id, enc, token, sha) {
  var json = JSON.stringify({ e: enc });
  /* GitHub Contents API 要求标准 base64；unescape+encodeURIComponent 处理中文 */
  var b64 = btoa(unescape(encodeURIComponent(json)));
  var body = { message: 'share ' + id, content: b64, branch: GH_BRANCH };
  /* 带 sha = 覆盖更新（固定链接）；不带 = 新建，422 视为内容相同已存在 */
  if (sha) body.sha = sha;
  return fetch('https://api.github.com/repos/' + GH_REPO + '/contents/shares/' + id + '.json', {
    method: 'PUT',
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json' },
    body: JSON.stringify(body)
  }).then(function (r) {
    /* 422 = 文件已存在且未带 sha。
       哈希 ID（sha 参数缺省 undefined）：内容必然相同，视为成功；
       固定链接首次创建（sha 显式传 null）：走到这里 = ID 碰撞（2^-40 量级），报错重试 */
    if (r.status === 422) {
      if (sha === undefined) return id;
      throw new Error('链接冲突，请再点一次');
    }
    if (!r.ok) {
      return r.json()['catch'](function () { return {}; }).then(function (j) {
        var msg = j && j.message ? j.message : 'GitHub ' + r.status;
        if (r.status === 401) msg = '令牌无效或已过期';
        if (r.status === 403 || r.status === 404) msg = '令牌没有这个仓库的写入权限';
        if (r.status === 409) msg = '链接刚被更新，请再点一次';
        throw new Error(msg);
      });
    }
    return id;
  });
}
/* 查已有分享文件的 sha（覆盖写的前置条件）；不存在返回 null */
function ghShareSha(id, token) {
  return fetch('https://api.github.com/repos/' + GH_REPO + '/contents/shares/' + id + '.json?ref=' + GH_BRANCH, {
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json' }
  }).then(function (r) {
    return r.ok ? r.json() : null;
  }).then(function (j) { return j && j.sha ? j.sha : null; });
}
/* 单个源：带超时的 JSON 获取。超时很重要 —— 挂起不通的源不能让调用方无限等。 */
function fetchJsonTimeout(url, ms) {
  return new Promise(function (res, rej) {
    var settled = false;
    var tm = setTimeout(function () { settled = true; rej(new Error('timeout')); }, ms);
    fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      if (settled) return;
      settled = true; clearTimeout(tm); res(j);
    })['catch'](function (e) {
      if (settled) return;
      settled = true; clearTimeout(tm); rej(e);
    });
  });
}

/* 读取分享内容：三源并行，谁先拿到有效内容谁赢。
   串行链会被「挂起不通」的源永久卡死（raw.githubusercontent 在国内常见），
   并行竞速下同域兜底通常 <1s 先到，慢源直接忽略。
   第 3 源是站点自身（与页面同域，国内可达）；页面在 /note/coloros/，
   文件在仓库根 shares/ → 相对路径必须是 ../shares/。 */
function ghGetShare(id) {
  /* 固定链接会覆盖同名文件，而 CDN 按 URL 缓存 —— 必须加 cache-bust 参数，
     否则「更新」后读到的是 CDN 旧副本 */
  var bust = Date.now();
  var urls = [
    'https://raw.githubusercontent.com/' + GH_REPO + '/' + GH_BRANCH + '/shares/' + id + '.json?_=' + bust,
    'https://cdn.jsdelivr.net/gh/' + GH_REPO + '@' + GH_BRANCH + '/shares/' + id + '.json?_=' + bust,
    '../shares/' + id + '.json?_=' + bust
  ];
  return new Promise(function (res, rej) {
    var pending = urls.length, firstErr = null;
    urls.forEach(function (u) {
      fetchJsonTimeout(u, 8000).then(function (j) {
        if (j && j.e) { res(j.e); return; }
        firstErr = firstErr || new Error('分享内容损坏');
        if (--pending === 0) rej(firstErr);
      })['catch'](function (e) {
        firstErr = firstErr || e;
        if (--pending === 0) rej(firstErr);
      });
    });
  });
}
function ghVerify(token) {
  return fetch('https://api.github.com/user', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(function (r) {
      if (r.status === 401) throw new Error('令牌无效，请重新复制');
      if (!r.ok) throw new Error('GitHub ' + r.status);
      return r.json();
    });
}

function shareLink(pw, live) {
  var r = state.current;
  var payload = { v: 1, title: r.title || '', html: r.raw_text || ('<p>' + esc(r.text) + '</p>'), ts: Date.now() };
  var base = location.href.split('#')[0];
  var p = pw ? NF.encodeEncrypted(payload, pw) : NF.encode(payload);
  state.lastSharePw = pw || null;
  state.lastShareLive = !!live;
  p.then(function (enc) {
    var long = base + '#' + enc;
    var token = ghToken();
    var isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)/.test(long);
    if (!token || isLocal) { showShareLink(long, pw, false); return; }
    /* 有令牌 → 一律走短链（不论内容长短，每个文档都短） */
    var box = $('shLinkBox');
    box.hidden = false;
    box.textContent = live ? '正在发布固定链接…' : '正在生成短链接…';
    /* 固定链接：复用本条便签已记住的 id（没有就新建一个随机 id），
       覆盖写同一个 shares/<id>.json → 链接恒定，内容随每次分享更新 */
    var idP = live
      ? Promise.resolve(r.live_id || liveIdNew())
      : shortIdFor(enc);
    idP.then(function (id) {
      /* sha 三态：undefined=哈希短链（422 视为内容相同）；null=固定链接首次创建；字符串=覆盖更新 */
      var shaP = live
        ? (r.live_id ? ghShareSha(id, token) : Promise.resolve(null))
        : Promise.resolve(undefined);
      return shaP.then(function (sha) {
        return ghPutShare(id, enc, token, sha).then(function () {
          if (live && r.live_id !== id) return NDB.Notes.setLive(r.local_id, id).then(function () { return id; });
          return id;
        });
      });
    }).then(function (id) {
      var short = base.replace(/index\.html$/, '') + '#s=' + id;
      showShareLink(short, pw, true, live);
    })['catch'](function (e) {
      showShareLink(long, pw, false);
      toast((live ? '固定链接发布失败（' : '短链失败（') + String(e.message || e).slice(0, 30) + '），已复制完整链接');
    });
  })['catch'](function (e) { toast('生成失败：' + e.message); });
}

function showShareLink(link, pw, isShort, live) {
  var box = $('shLinkBox');
  var loopback = /^https?:\/\/(127\.0\.0\.1|localhost)/.test(link);
  box.hidden = false;
  box.textContent = link;
  copyText(link);
  var w2 = document.getElementById('loopWarn');
  if (w2) w2.remove();
  /* 没有令牌时引导设置（短链需要一次性授权） */
  $('shGhRow').hidden = !!ghToken();
  if (loopback) {
    var warn = document.createElement('div');
    warn.id = 'loopWarn';
    warn.style.cssText = 'margin:8px 0 0;padding:10px 12px;border-radius:8px;background:#FBF1EF;border:1px solid #E8C7C2;color:#8C3B32;font-size:12.5px;line-height:1.6';
    warn.innerHTML = '⚠️ 这是<b>本机地址</b>，只有你自己打得开。部署到线上后生成的链接才会带正确域名。';
    $('shLinkBox').parentNode.insertBefore(warn, $('shLinkBox').nextSibling);
  } else if (live) {
    toast('固定链接已复制 ✓ 以后改完内容再点一次「更新」，这条链接就一直有效');
  } else if (isShort) {
    toast('短链接已复制（' + link.length + ' 字符），直接发就行 ✓');
  } else {
    var kb = (link.length / 1024).toFixed(1);
    toast('链接已复制（' + kb + ' KB）' + (pw ? ' · 需密码查看' : ''));
  }
}

/* 保存 GitHub 令牌 → 校验 → 立刻把当前这条重新生成成短链 */
$('ghSave').onclick = function () {
  var t = $('ghToken').value.trim();
  var err = $('ghErr');
  if (!t) { err.hidden = false; err.textContent = '先粘贴令牌'; return; }
  err.hidden = true;
  $('ghSave').textContent = '验证中…';
  ghVerify(t).then(function () {
    ghTokenSave(t);
    $('ghSave').textContent = '保存';
    $('ghToken').value = '';
    $('shGhRow').hidden = true;
    toast('已保存，正在生成短链接');
    shareLink(state.lastSharePw, state.lastShareLive);
  })['catch'](function (e) {
    $('ghSave').textContent = '保存';
    err.hidden = false;
    err.textContent = e.message;
  });
};
$('shLink').onclick = function () {
  $('shPwRow').hidden = false;
  /* 固定链接要往仓库写内容，未授权时不可勾选 */
  $('shLiveRow').hidden = !ghToken();
  $('shPwInput').focus();
};
/* 勾选固定链接 → 按钮文案变「更新」，动作含义即时可见 */
$('shLiveChk').onchange = function () {
  $('shPwGo').textContent = this.checked ? '更新' : '生成';
};
$('shPwGo').onclick = function () {
  var pw = $('shPwInput').value.trim();
  if (pw.length > 0 && pw.length < 4) { toast('密码至少 4 位'); return; }
  var cb = $('shLiveChk');
  var live = !!(cb && cb.checked);
  if (live && cb.disabled) { toast('请先取消勾选固定链接'); return; }
  shareLink(pw || null, live);
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
  /* 短路由：#aidoge-tutorial 直接打开内置教程的阅读态，无需长链接 */
  if (h === 'aidoge-tutorial') {
    await openShared(AIDOGE_TUTORIAL.html, AIDOGE_TUTORIAL.title, Date.now(), false);
    return;
  }
  /* GitHub 短链：#s=<id> —— 内容在仓库里，按需拉取 */
  if (h.indexOf('s=') === 0) {
    var sid = h.slice(2);
    $('listView').hidden = true; $('editView').hidden = true; $('fab').hidden = true;
    $('readView').hidden = false;
    $('readTitle').textContent = '加载中…';
    $('readMeta').textContent = '来自分享';
    $('readPaper').innerHTML = '';
    try {
      var enc = await ghGetShare(sid);
      var d = await NF.decode(enc);
      if (d && d.__enc) {
        readBuf = d.__enc;
        $('readTitle').textContent = '🔒 这篇便签已加密';
        $('readMeta').textContent = '需要作者提供的查看密码';
        $('readPaper').innerHTML = '<p style="opacity:.6">点击下方按钮输入密码解锁</p>';
        $('readPwBtn').hidden = false;
        return;
      }
      await openShared(d.html, d.title, d.ts, false);
    } catch (e) {
      $('readTitle').textContent = '打不开这条分享';
      $('readMeta').textContent = '';
      $('readPaper').innerHTML = '<p style="opacity:.65">内容不存在或网络不通。<br>可以请分享者重新生成一条链接。</p>';
    }
    return;
  }
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
  /* 首屏种子：AIDoge 教程 + 复刻文档（仅在库中还没有时各种一次，用户删掉后不再自动补） */
  NDB.Folders.ensure().then(function () {
    return NDB.Notes.all().then(function (all) {
      var jobs = [];
      var hasTut = all.some(function (r) {
        return r.title === AIDOGE_TUTORIAL.title || (r.raw_text || '').indexOf('AIDoge 是什么') >= 0;
      });
      if (!hasTut) {
        /* 用户删除过教程则不再自动补种 */
        var removed = false;
        try { removed = localStorage.getItem('nf.tut.removed') === '1'; } catch (e) {}
        if (!removed) jobs.push(NDB.Notes.create({ title: AIDOGE_TUTORIAL.title, raw_text: AIDOGE_TUTORIAL.html, color: 'lemon' }));
      }
      var hasDoc = all.some(function (r) {
        return r.title === COLOROS_DOC.title || (r.raw_text || '').indexOf('高佣联盟新增玩法') >= 0;
      });
      if (!hasDoc) {
        var docRemoved = false;
        try { docRemoved = localStorage.getItem('nf.doc.removed') === '1'; } catch (e) {}
        if (!docRemoved) jobs.push(NDB.Notes.create({ title: COLOROS_DOC.title, raw_text: COLOROS_DOC.html, color: 'paper' }));
      }
      return Promise.all(jobs);
    });
  }).then(function () { show('list'); });
})();
/* 同页粘贴新分享链接时只触发 hashchange 不重载 → 手动刷新进阅读态 */
window.addEventListener('hashchange', function () { location.reload(); });
})();
