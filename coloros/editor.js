/* editor.js — 富文本编辑内核（对应便签 raw_text 的 HTML 生产端）
   证据：ColorOS 便签正文即 HTML（Note.java: "raw_text — the app's own rich text, already HTML"），
   长图由"便签自己的编辑器 WebView"渲染 → 官方编辑器就是 WebView 富文本，此处用 contenteditable 复刻。
   2026-10-21 增补：图片可点选 · 就地换图 · 删除 · 缩放 · 粘贴图片 · 拖入图片。 */
(function (global) {
  'use strict';

  var COLORS = {
    paper: '#fffdf6', mist: '#eef3f7', lemon: '#faf6e3',
    peach: '#fdf0ea', violet: '#f3eefa', mint: '#ebf5ee', dark: '#232323'
  };

  /* 从 DataTransfer / 剪贴板里挑第一张图片（files 优先，其次 items） */
  function pickImageFile(dt) {
    if (!dt) return null;
    var files = dt.files, i;
    if (files && files.length) {
      for (i = 0; i < files.length; i++) if (/^image\//.test(files[i].type)) return files[i];
    }
    var items = dt.items;
    if (items && items.length) {
      for (i = 0; i < items.length; i++) {
        if (items[i].kind === 'file' && /^image\//.test(items[i].type)) {
          var f = items[i].getAsFile();
          if (f) return f;
        }
      }
    }
    return null;
  }

  function Editor(root, onChange) {
    var self = this;
    this.root = root;
    this.onChange = onChange || function () {};
    this._color = 'paper';
    this._lastRange = null;   /* 最后一次落在正文里的选区（按钮/文件框会让选区丢失） */
    this._selImg = null;      /* 当前点选的图片 */
    this._pendingSwap = null; /* 正在等待替换的目标图片 */
    this._bar = null;

    document.execCommand('defaultParagraphSeparator', false, 'p');

    root.addEventListener('input', function () { self.onChange(self.getHTML(), self.getText()); });
    root.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); self.save(); }
      if (e.key === 'Escape' && (self._selImg || self._bar)) { self.clearImage(); }
    });

    /* 记住选区：点工具栏按钮会夺走焦点，插图片又是异步的，不存就插错位置 */
    document.addEventListener('selectionchange', function () {
      var sel = document.getSelection();
      if (!sel || !sel.rangeCount) return;
      var r = sel.getRangeAt(0);
      if (root.contains(r.commonAncestorContainer)) self._lastRange = r.cloneRange();
    });

    root.addEventListener('click', function (e) {
      /* 点图片 = 选中它（原版这里什么都不做，所以图换不了） */
      var img = e.target.closest && e.target.closest('img');
      if (img && root.contains(img)) { e.preventDefault(); self.selectImage(img); return; }
      if (self._selImg) self.clearImage();

      /* 复选框点击切换（复刻便签 checklist：li class=checked/unchecked，证据见 oppo-notes-exporter parser.mjs） */
      var li = e.target.closest && e.target.closest('li[data-check]');
      if (li) {
        var on = li.getAttribute('data-check') === '1';
        li.setAttribute('data-check', on ? '0' : '1');
        li.classList.toggle('checked', !on);
        li.classList.toggle('unchecked', on);
        self.onChange(self.getHTML(), self.getText());
        return;
      }
      /* 链接：contenteditable 里浏览器默认不跳转（点击只放光标），手动开新标签。
         与 ColorOS 便签 App 行为一致：点链接 = 打开；要改文字用键盘选中即可。 */
      var a = e.target.closest && e.target.closest('a[href]');
      if (a) {
        e.preventDefault();
        e.stopPropagation();
        var href = a.getAttribute('href') || '';
        if (/^(https?:|mailto:)/i.test(href)) window.open(href, '_blank', 'noopener');
      }
    });

    /* 粘贴图片：直接内联进正文（原版粘截图没有任何反应） */
    root.addEventListener('paste', function (e) {
      var f = pickImageFile(e.clipboardData);
      if (!f) return;
      e.preventDefault();
      self.insertImage(f);
    });

    /* 拖入图片：插到落点 */
    root.addEventListener('dragover', function (e) {
      if (!e.dataTransfer) return;
      var types = e.dataTransfer.types || [];
      for (var i = 0; i < types.length; i++) {
        if (types[i] === 'Files') { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; return; }
      }
    });
    root.addEventListener('drop', function (e) {
      var f = pickImageFile(e.dataTransfer);
      if (!f) return;
      e.preventDefault();
      var r = null;
      if (document.caretRangeFromPoint) r = document.caretRangeFromPoint(e.clientX, e.clientY);
      else if (document.caretPositionFromPoint) {
        var p = document.caretPositionFromPoint(e.clientX, e.clientY);
        if (p) { r = document.createRange(); r.setStart(p.offsetNode, p.offset); }
      }
      if (r && root.contains(r.startContainer)) {
        self._lastRange = r.cloneRange();
        var sel = document.getSelection();
        sel.removeAllRanges(); sel.addRange(r);
      }
      self.insertImage(f);
    });

    /* 选中条跟随滚动/缩放 */
    var follow = function () { self.positionImageBar(); };
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', follow);
  }

  Editor.prototype.load = function (html) {
    this.clearImage();
    this.root.innerHTML = html || '<p><br></p>';
  };
  Editor.prototype.getHTML = function () {
    /* 序列化前清掉运行时产物（选中描边等），别把 UI 状态存进便签 */
    var clone = this.root.cloneNode(true);
    var marked = clone.querySelectorAll('img.img-sel');
    for (var i = 0; i < marked.length; i++) marked[i].classList.remove('img-sel');
    return clone.innerHTML.trim();
  };
  Editor.prototype.getText = function () { return this.root.innerText.trim(); };
  Editor.prototype.focus = function () { this.root.focus(); };

  Editor.prototype.cmd = function (name, val) {
    this.root.focus();
    document.execCommand(name, false, val || null);
    this.onChange(this.getHTML(), this.getText());
  };
  Editor.prototype.heading = function (tag) { this.cmd('formatBlock', tag); };
  Editor.prototype.align = function (a) { this.cmd('justify' + a[0].toUpperCase() + a.slice(1)); };

  /* 待办列表：生成带 data-check 的 li，与导出器 parser 的 checked/unchecked 约定一致 */
  Editor.prototype.checklist = function () {
    var sel = document.getSelection();
    var txt = sel && !sel.isCollapsed ? sel.toString() : '待办事项';
    var html = '<ul class="todo"><li data-check="0" class="unchecked">' +
      txt.replace(/</g, '&lt;') + '</li></ul>';
    this.root.focus();
    document.execCommand('insertHTML', false, html);
    this.onChange(this.getHTML(), this.getText());
  };

  Editor.prototype.setColor = function (c) {
    this._color = c;
    this.root.parentElement.dataset.noteColor = c;
    this.onChange(this.getHTML(), this.getText());
  };
  Editor.prototype.getColor = function () { return this._color; };

  /* ---------------- 图片：选中 / 换图 / 删除 / 缩放 ---------------- */

  Editor.prototype.selectImage = function (img) {
    if (this._selImg && this._selImg !== img) this._selImg.classList.remove('img-sel');
    this._selImg = img;
    img.classList.add('img-sel');
    this.showImageBar();
  };

  Editor.prototype.clearImage = function () {
    if (this._selImg) this._selImg.classList.remove('img-sel');
    this._selImg = null;
    if (this._bar) { this._bar.parentNode && this._bar.parentNode.removeChild(this._bar); this._bar = null; }
  };

  /* 工具栏「插入图片」按下时调用：确保走"新增"而不是"替换" */
  Editor.prototype.clearSwap = function () { this._pendingSwap = null; };

  Editor.prototype.showImageBar = function () {
    var self = this;
    if (!this._bar) {
      var bar = document.createElement('div');
      bar.className = 'img-bar';
      bar.setAttribute('role', 'toolbar');
      bar.setAttribute('aria-label', '图片操作');
      bar.innerHTML =
        '<button type="button" data-a="swap" title="换一张">换图</button>' +
        '<button type="button" data-a="size" title="宽度 100% → 75% → 50% → 25%">大小</button>' +
        '<button type="button" data-a="del" title="删除这张图片">删除</button>';
      /* 按下就 preventDefault，别把正文选区/焦点抢走 */
      bar.addEventListener('mousedown', function (e) { e.preventDefault(); });
      bar.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('button[data-a]');
        if (!b) return;
        e.preventDefault();
        var a = b.getAttribute('data-a');
        if (a === 'swap') self.swapImage();
        else if (a === 'del') self.removeImage();
        else if (a === 'size') self.cycleSize();
      });
      document.body.appendChild(bar);
      this._bar = bar;
    }
    this._bar.hidden = false;
    this.positionImageBar();
  };

  Editor.prototype.positionImageBar = function () {
    var img = this._selImg, bar = this._bar;
    if (!img || !bar || !img.parentNode) return;
    var r = img.getBoundingClientRect();
    var bw = bar.offsetWidth || 190;
    var bh = bar.offsetHeight || 34;
    var left = Math.min(Math.max(8, r.left + r.width / 2 - bw / 2), Math.max(8, window.innerWidth - bw - 8));
    var top = r.top - bh - 10;
    if (top < 8) top = Math.min(r.bottom + 10, window.innerHeight - bh - 8);
    bar.style.left = left + 'px';
    bar.style.top = top + 'px';
  };

  Editor.prototype.swapImage = function () {
    if (!this._selImg) return;
    this._pendingSwap = this._selImg;
    var inp = document.getElementById('imgFile');
    if (!inp) return;
    inp.value = '';
    inp.click();
  };

  Editor.prototype.removeImage = function () {
    var img = this._selImg;
    if (!img) return;
    this.clearImage();
    if (img.parentNode) img.parentNode.removeChild(img);
    this._lastRange = null;
    this.onChange(this.getHTML(), this.getText());
  };

  Editor.prototype.cycleSize = function () {
    var img = this._selImg;
    if (!img) return;
    var seq = ['', '75%', '50%', '25%'];
    var cur = img.style.width || '';
    var i = seq.indexOf(cur);
    var next = seq[(i + 1) % seq.length];
    if (next) img.style.width = next; else img.style.removeProperty('width');
    this.positionImageBar();
    this.onChange(this.getHTML(), this.getText());
  };

  /* 把光标放回最后一次记录的选区；返回是否成功 */
  Editor.prototype._restoreCaret = function () {
    this.root.focus();
    var r = this._lastRange;
    if (!r) return false;
    var c = r.commonAncestorContainer;
    if (!c || !this.root.contains(c)) return false;
    var sel = document.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    return true;
  };

  /* 图片：压缩后以 data URL 内联进 raw_text（原 App 附件在 files/<local_id>/，
     Web 复刻无进程私有目录，用内联等价替代；附件目录语义由导出功能体现）。
     若当前处于「换图」状态，则原地替换目标图片，不改动其余正文。 */
  Editor.prototype.insertImage = function (file, cb) {
    var self = this;
    if (!file) { if (cb) cb(new Error('img')); return; }
    var url = URL.createObjectURL(file), probe = new Image();
    probe.onload = function () {
      var MAX = 1280, sc = Math.min(1, MAX / Math.max(probe.width, probe.height));
      var cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(probe.width * sc));
      cv.height = Math.max(1, Math.round(probe.height * sc));
      cv.getContext('2d').drawImage(probe, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      var dataUrl = cv.toDataURL('image/jpeg', 0.72);

      var target = self._pendingSwap;
      self._pendingSwap = null;

      if (target && target.parentNode) {
        /* 就地换图：同一个 <img> 节点、同样的位置与宽度 */
        target.src = dataUrl;
        self.onChange(self.getHTML(), self.getText());
        self.selectImage(target);
        if (cb) cb();
        return;
      }

      var before = self.root.querySelectorAll('img').length;
      self._restoreCaret();
      document.execCommand('insertHTML', false, '<img src="' + dataUrl + '">');
      if (self.root.querySelectorAll('img').length === before) {
        /* 没有可用选区时兜底追加到末尾，保证"选了图就一定插进去" */
        var img = document.createElement('img');
        img.src = dataUrl;
        self.root.appendChild(img);
      }
      self._lastRange = null;
      self.onChange(self.getHTML(), self.getText());
      if (cb) cb();
    };
    probe.onerror = function () { URL.revokeObjectURL(url); if (cb) cb(new Error('img')); };
    probe.src = url;
  };

  global.NED = { Editor: Editor, COLORS: COLORS };
})(typeof window !== 'undefined' ? window : globalThis);
