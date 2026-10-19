/* editor.js — 富文本编辑内核（对应便签 raw_text 的 HTML 生产端）
   证据：ColorOS 便签正文即 HTML（Note.java: "raw_text — the app's own rich text, already HTML"），
   长图由"便签自己的编辑器 WebView"渲染 → 官方编辑器就是 WebView 富文本，此处用 contenteditable 复刻。 */
(function (global) {
  'use strict';

  var COLORS = {
    paper: '#fffdf6', mist: '#eef3f7', lemon: '#faf6e3',
    peach: '#fdf0ea', violet: '#f3eefa', mint: '#ebf5ee', dark: '#232323'
  };

  function Editor(root, onChange) {
    var self = this;
    this.root = root;
    this.onChange = onChange || function () {};
    this._color = 'paper';

    document.execCommand('defaultParagraphSeparator', false, 'p');

    root.addEventListener('input', function () { self.onChange(self.getHTML(), self.getText()); });
    root.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); self.save(); }
    });
    /* 复选框点击切换（复刻便签 checklist：li class=checked/unchecked，证据见 oppo-notes-exporter parser.mjs） */
    root.addEventListener('click', function (e) {
      var li = e.target.closest && e.target.closest('li[data-check]');
      if (li) {
        var on = li.getAttribute('data-check') === '1';
        li.setAttribute('data-check', on ? '0' : '1');
        li.classList.toggle('checked', !on);
        li.classList.toggle('unchecked', on);
        self.onChange(self.getHTML(), self.getText());
      }
    });
  }

  Editor.prototype.load = function (html) {
    this.root.innerHTML = html || '<p><br></p>';
  };
  Editor.prototype.getHTML = function () {
    /* 序列化前清掉运行时产物 */
    var clone = this.root.cloneNode(true);
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

  /* 图片：压缩后以 data URL 内联进 raw_text（原 App 附件在 files/<local_id>/，
     Web 复刻无进程私有目录，用内联等价替代；附件目录语义由导出功能体现） */
  Editor.prototype.insertImage = function (file, cb) {
    var url = URL.createObjectURL(file), img = new Image();
    var self = this;
    img.onload = function () {
      var MAX = 1280, sc = Math.min(1, MAX / Math.max(img.width, img.height));
      var cv = document.createElement('canvas');
      cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      self.root.focus();
      document.execCommand('insertHTML', false, '<img src="' + cv.toDataURL('image/jpeg', 0.72) + '">');
      self.onChange(self.getHTML(), self.getText());
      if (cb) cb();
    };
    img.onerror = function () { URL.revokeObjectURL(url); if (cb) cb(new Error('img')); };
    img.src = url;
  };

  global.NED = { Editor: Editor, COLORS: COLORS };
})(typeof window !== 'undefined' ? window : globalThis);
