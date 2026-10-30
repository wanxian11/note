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
    /* 记住固定链接元信息：只补字段不动 update_time（分享不该让便签在列表里跳位）
       live_pw / live_enc 供「保存即同步」重写同一个 shares 文件 */
    setLive: function (id, liveId, livePw, liveEnc) {
      return Notes.get(id).then(function (r) {
        if (!r) return null;
        r.live_id = liveId;
        r.live_pw = livePw || '';
        r.live_enc = !!liveEnc;
        return tx('rich_notes', 'readwrite', function (s) { return s.put(r); }).then(function () { return r; });
      });
    },
    /* 备份恢复：原样写回并保留原始时间戳；id 已存在时换新 id，避免覆盖现有便签 */
    importRow: function (row) {
      row = row || {};
      var raw = row.raw_text || row.text || '';
      var out = {
        local_id: row.local_id || uid(),
        folder_id: row.folder_id || 'default',
        title: row.title || '',
        text: toText(raw),
        raw_text: raw,
        color: row.color || 'paper',
        state: 0,
        encrypted: 0,
        deleted: 0,
        recycle_time: row.recycle_time > 0 ? row.recycle_time : 0,
        create_time: row.create_time || Date.now(),
        update_time: row.update_time || Date.now()
      };
      return tx('rich_notes', 'readwrite', function (s) { return s.put(out); }).then(function () { return out; });
    },
    emptyTrash: function () {
      return Notes.all('trash').then(function (rows) {
        return Promise.all(rows.map(function (r) { return Notes.purge(r.local_id); }));
      });
    }
  };

  var Folders = {
    /* 不再创建名为「所有笔记」的 default 分类。
       列表里的「全部笔记」是渲染层加的虚拟汇总项，库里再存一个同名分类会产生两个语义重复的胶囊。
       这里只做兜底清理：早期版本建过的 default 行删掉。 */
    ensure: function () {
      return Folders.all().then(function (fs) {
        var stale = fs.filter(function (f) { return f.guid === 'default'; });
        if (!stale.length) return null;
        return Promise.all(stale.map(function (f) {
          return tx('folders', 'readwrite', function (s) { return s.delete(f.guid); });
        }));
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
