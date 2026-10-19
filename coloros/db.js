/* db.js — 复刻 ColorOS 便签数据层
   镜像证据：nearme_note.db / rich_notes / folders
   （源：qkqwork/lsposed-coloros-note-export NoteStore.java 16.x 真机验证）
   列语义完全照搬：local_id 主键、raw_text 存 HTML、text 存纯文本、
   recycle_time>0 = 回收站、deleted=1 = 已删、encrypted 预留。 */
(function (global) {
  'use strict';

  var DB_NAME = 'nearme_note_replica';
  var DB_VER = 1;

  function open() {
    return new Promise(function (res, rej) {
      var rq = indexedDB.open(DB_NAME, DB_VER);
      rq.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('rich_notes')) {
          var s = db.createObjectStore('rich_notes', { keyPath: 'local_id' });
          s.createIndex('folder_id', 'folder_id', { unique: false });
          s.createIndex('update_time', 'update_time', { unique: false });
          s.createIndex('recycle_time', 'recycle_time', { unique: false });
        }
        if (!db.objectStoreNames.contains('folders')) {
          db.createObjectStore('folders', { keyPath: 'guid' });
        }
      };
      rq.onsuccess = function () { res(rq.result); };
      rq.onerror = function () { rej(rq.error); };
    });
  }

  function tx(store, mode, fn) {
    return open().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(store, mode);
        var s = t.objectStore(store);
        var out = fn(s);
        t.oncomplete = function () { res(out && out.result !== undefined ? out.result : out); };
        t.onerror = function () { rej(t.error); };
        t.onabort = function () { rej(t.error); };
      });
    });
  }

  function uid() {
    return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function guid() {
    return 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* HTML -> 纯文本（对应 rich_notes.text 的派生方式） */
  function toText(html) {
    var d = new DOMParser().parseFromString('<body>' + (html || '') + '</body>', 'text/html');
    return (d.body.textContent || '').replace(/\u00a0/g, ' ').trim();
  }

  var Notes = {
    /* 新建：两列冗余 text+raw_text，照抄原库设计 */
    create: function (opt) {
      var now = Date.now();
      var row = {
        local_id: uid(),
        folder_id: (opt && opt.folder_id) || 'default',
        title: (opt && opt.title) || '',
        text: toText(opt && opt.raw_text),
        raw_text: (opt && opt.raw_text) || '',
        color: (opt && opt.color) || 'paper',
        state: 0,
        encrypted: 0,
        deleted: 0,
        recycle_time: 0,
        create_time: now,
        update_time: now
      };
      return tx('rich_notes', 'readwrite', function (s) { return s.put(row); }).then(function () { return row; });
    },
    update: function (row) {
      row.update_time = Date.now();
      row.text = toText(row.raw_text);
      return tx('rich_notes', 'readwrite', function (s) { return s.put(row); }).then(function () { return row; });
    },
    get: function (id) {
      return tx('rich_notes', 'readonly', function (s) { return s.get(id); });
    },
    /* 排序语义照抄 queryNotes(): ORDER BY update_time DESC */
    all: function (filter) {
      return tx('rich_notes', 'readonly', function (s) { return s.getAll(); }).then(function (rows) {
        rows.sort(function (a, b) { return b.update_time - a.update_time; });
        if (filter === 'trash') return rows.filter(function (r) { return r.recycle_time > 0 && !r.deleted; });
        if (filter === 'active') return rows.filter(function (r) { return r.recycle_time === 0 && !r.deleted && !r.encrypted; });
        return rows;
      });
    },
    /* 进回收站：只置 recycle_time（证据：state=2 在 16.x 不可靠，以 recycle_time 为准） */
    toTrash: function (id) {
      return Notes.get(id).then(function (r) {
        if (!r) return null;
        r.recycle_time = Date.now();
        return Notes.update(r);
      });
    },
    restore: function (id) {
      return Notes.get(id).then(function (r) {
        if (!r) return null;
        r.recycle_time = 0;
        return Notes.update(r);
      });
    },
    /* 彻底删除：物理删行 */
    purge: function (id) {
      return tx('rich_notes', 'readwrite', function (s) { return s.delete(id); });
    },
    emptyTrash: function () {
      return Notes.all('trash').then(function (rows) {
        return Promise.all(rows.map(function (r) { return Notes.purge(r.local_id); }));
      });
    }
  };

  var Folders = {
    ensure: function () {
      return Folders.all().then(function (fs) {
        if (!fs.some(function (f) { return f.guid === 'default'; })) {
          return tx('folders', 'readwrite', function (s) {
            return s.put({ guid: 'default', name: '所有笔记', system: 1 });
          });
        }
      });
    },
    all: function () {
      return tx('folders', 'readonly', function (s) { return s.getAll(); });
    },
    create: function (name) {
      var f = { guid: guid(), name: name, system: 0, create_time: Date.now() };
      return tx('folders', 'readwrite', function (s) { return s.put(f); }).then(function () { return f; });
    },
    remove: function (g) {
      return tx('folders', 'readwrite', function (s) { return s.delete(g); });
    }
  };

  global.NDB = { Notes: Notes, Folders: Folders, toText: toText, DB_NAME: DB_NAME };
})(typeof window !== 'undefined' ? window : globalThis);
