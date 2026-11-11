/**
 * TA的手机 - Akini 版
 * - 小手机样式的居中弹窗
 * - 打开后首先显示「所有创建过的联系人」网格：头像在上，名字在下
 * - 点击联系人后进入该联系人的桌面，显示三个应用：聊天 / 朋友圈 / iCity
 * - 点击应用后查看 TA 自动收藏的该联系人的对应数据
 * - 收藏逻辑参考 compat ta-phone.js：系统按概率自动收藏用户发过的聊天消息与朋友圈/iCity
 * - 数据按联系人维度存储：akini_ta_phone_<contactId> = { chat:[], moments:[], icity:[] }
 */
(function () {
  "use strict";

  var CHAT_CHANCE = 0.02; // 聊天实时收藏概率 2%
  var MOMENTS_CHANCE = 0.1; // 朋友圈实时收藏概率 10%
  var ICITY_CHANCE = 0.1; // iCity 实时收藏概率 10%
  var MUSIC_CHANCE = 0.1; // 网易云收藏概率 10%
  var MAIL_CHANCE = 0.1; // 信件收藏概率 10%（与朋友圈一致）
  var CHAT_HISTORY_CHANCE = 0.02; // 历史聊天收藏概率（跟随自定义概率）
  var MOMENTS_HISTORY_CHANCE = 0.1; // 历史朋友圈收藏概率（跟随自定义概率）
  var ICITY_HISTORY_CHANCE = 0.1; // 历史 iCity 收藏概率（跟随自定义概率）
  var MUSIC_HISTORY_CHANCE = 0.1; // 历史网易云收藏概率（跟随自定义概率）

  /* 自定义概率：设置页 akini_prob_taPhone<Key>（0-100），实时与历史扫描共用 */
  function taProb(key, def) {
    try {
      var raw = localStorage.getItem("akini_prob_taPhone" + key),
        v = parseFloat(raw);
      if (isFinite(v)) return Math.max(0, Math.min(100, v)) / 100;
    } catch (e) {}
    return def;
  }

  // 当前查看的联系人 id
  var currentContactId = null;
  // 当前 tab：'chat' | 'moments' | 'icity'
  var currentTab = "chat";

  /* ============ 工具 ============ */
  function escapeHtml(text) {
    var div = document.createElement("div");
    div.textContent = text == null ? "" : String(text);
    return div.innerHTML;
  }

  function formatTime(ts) {
    var d = new Date(ts || Date.now());
    function p(n) {
      return n < 10 ? "0" + n : "" + n;
    }
    return (
      d.getFullYear() +
      "-" +
      p(d.getMonth() + 1) +
      "-" +
      p(d.getDate()) +
      " " +
      p(d.getHours()) +
      ":" +
      p(d.getMinutes())
    );
  }

  function getContacts() {
    try {
      if (window.akiniContacts && typeof window.akiniContacts.getContacts === "function") {
        return window.akiniContacts.getContacts() || [];
      }
    } catch (e) {}
    return [];
  }

  function getContactById(id) {
    var list = getContacts();
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === id) return list[i];
    }
    return null;
  }

  // 随机选择一个“创建的联系人”（排除系统 me/my），用于收藏归属

  function avatarHtml(c, size) {
    size = size || 48;
    return (
      '<div style="width:' +
      size +
      "px;height:" +
      size +
      'px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#f0f0f0;flex-shrink:0;">' +
      (window.renderAvatarHtml ? window.renderAvatarHtml((c && c.avatar) || "", size) : "") +
      "</div>"
    );
  }

  /* ============ 收藏存储（按联系人维度） ============ */
  function storageKey(contactId) {
    return "akini_ta_phone_" + contactId;
  }

  /* 卡片不是正文，收藏夹只收文字/音乐：带【标签】的条目在收藏逻辑里直接拒绝 */
  var _CARD_FAV_RE = /^【(问卷|一起听邀请|一起听总结|转账|红包|物品赠送|物品代付|表情包|图片)】$/;
  function isCardFavContent(c) {
    return _CARD_FAV_RE.test(String(c == null ? "" : c).trim());
  }

  var _colCache = {};
  function loadCollections(contactId) {
    if (_colCache[contactId]) return _colCache[contactId];
    try {
      // 统一走 akiniStore（内存缓存+IDB+localStorage），与朋友圈数据持久化逻辑一致
      var saved =
        window.akiniStore && window.akiniStore.getSync
          ? window.akiniStore.getSync(storageKey(contactId), null)
          : localStorage.getItem(storageKey(contactId));
      if (saved && typeof saved === "string") {
        var parsed = JSON.parse(saved);
        _colCache[contactId] = {
          chat: Array.isArray(parsed.chat) ? parsed.chat.filter(_keepFav) : [],
          moments: Array.isArray(parsed.moments) ? parsed.moments.filter(_keepFav) : [],
          icity: Array.isArray(parsed.icity) ? parsed.icity.filter(_keepFav) : [],
          music: Array.isArray(parsed.music) ? parsed.music : [],
          calls: Array.isArray(parsed.calls) ? parsed.calls : [],
          /* 旧版本把"TA 的回信"也收进了 TA 的手机：读入时清掉 */
          mail: Array.isArray(parsed.mail)
            ? parsed.mail.filter(function (m) {
                return !m || m.direction !== "received";
              })
            : [],
        };
        return _colCache[contactId];
      }
    } catch (e) {}
    _colCache[contactId] =
      _colCache[contactId] || { chat: [], moments: [], icity: [], music: [], calls: [], mail: [] };
    return _colCache[contactId];
  }
  /* 旧数据里残留的卡片收藏：读取时静默过滤，不提示、不回写 */
  function _keepFav(it) {
    return !(it && isCardFavContent(it.content));
  }

  function saveCollections(contactId, data) {
    var n = JSON.stringify(data);
    try {
      localStorage.setItem(storageKey(contactId), n);
    } catch (e) {}
    /* 收藏的新增/删除是用户的明确操作：记下本地写入时刻，防止云端旧备份把删除拉回来 */
    try {
      localStorage.setItem("akini_ta_fav_at_" + contactId, String(Date.now()));
    } catch (e) {}
  }

  /* 从字卡库随机抽一张字卡作为收藏备注 */
  function pickWordcardRemark() {
    try {
      var raw = localStorage.getItem("akini_wordbank");
      var wb = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(wb)) return "";
      wb = wb.filter(function (t) {
        return t && (!t.tab || t.tab === "main") && String(t.text || t.content || "").trim();
      });
      if (!wb.length) return "";
      var c = wb[Math.floor(Math.random() * wb.length)];
      return String(c.text || c.content || "").trim();
    } catch (e) {
      return "";
    }
  }

  

  var _callCache = {};

  function _callKey(contactId) {
    return "akini_ta_calls_" + contactId;
  }

  function _parseCallList(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") {
      try {
        var p = JSON.parse(raw);
        return Array.isArray(p) ? p : [];
      } catch (e) {}
    }
    return [];
  }

  function loadCallRecords(contactId) {
    if (_callCache[contactId]) return _callCache[contactId];
    // 缓存未命中：异步从 localforage 拉取，回写缓存后重渲染
    if (window.localforage) {
      localforage.getItem(_callKey(contactId)).then(function (raw) {
        _callCache[contactId] = _parseCallList(raw);
        if (currentContactId === contactId && currentTab === "calls") renderList();
      }).catch(function () { _callCache[contactId] = []; });
    }
    return [];
  }

  function saveCallRecords(contactId, list) {
    list = Array.isArray(list) ? list : [];
    _callCache[contactId] = list;
    if (window.localforage) {
      localforage.setItem(_callKey(contactId), JSON.stringify(list)).catch(function () {});
    }
  }

  function addCallRecord(contactId, record) {
    if (!contactId || !record) return false;
    try {
      var sec = Number(record.durationSec);
      if (!isFinite(sec) || sec > 86400) {
        sec = _callAnswerAt ? Math.max(0, Math.round((Date.now() - _callAnswerAt) / 1000)) : 0;
        if (sec > 86400) sec = 0;
        record.duration =
          (sec >= 60 ? String(Math.floor(sec / 60)).padStart(2, "0") + ":" : "00:") + String(sec % 60).padStart(2, "0");
        record.durationSec = sec;
      }
      _callAnswerAt = 0;
      var item = {
        id: Date.now() + Math.random(),
        duration: record.duration || "00:00",
        durationSec: record.durationSec || 0,
        avatar: record.avatar || "",
        name: record.name || "TA",
        endTime: record.endTime || Date.now(),
      };
      var write = function (list) {
        list = Array.isArray(list) ? list : [];
        list.unshift(item);
        saveCallRecords(contactId, list);
        if (currentContactId === contactId && currentTab === "calls") renderList();
      };
      // 缓存已有直接加；否则先从 localforage 拉最新列表再追加，避免覆盖旧记录
      if (_callCache[contactId]) {
        write(_callCache[contactId].slice());
      } else if (window.localforage) {
        localforage.getItem(_callKey(contactId)).then(function (raw) {
          write(_parseCallList(raw));
        }).catch(function () { write([]); });
      } else {
        write([]);
      }
      return true;
    } catch (e) {
      console.warn("[TA手机] 添加通话记录失败", e);
      return false;
    }
  }

  /* 卡片类消息没有可读的正文：按气泡类型归一成【标签】。
     否则 textContent 会把整张卡片（题目/选项/时长/按钮文案）拼成一大块垃圾文本。 */
  function collectionCardLabel(bubble) {
    if (!bubble || !bubble.classList) return "";
    var c = bubble.classList;
    if (c.contains("survey-bubble")) return "【问卷】";
    if (c.contains("music-invite-bubble")) return "【一起听邀请】";
    if (c.contains("music-end-bubble")) return "【一起听总结】";
    if (c.contains("transfer-bubble")) return "【转账】";
    if (c.contains("redpacket-bubble")) return "【红包】";
    if (c.contains("shop-card-bubble")) {
      var t = (bubble.textContent || "").trim();
      return t.indexOf("代付") >= 0 ? "【物品代付】" : "【物品赠送】";
    }
    if (c.contains("sticker-bubble")) return "【表情包】";
    if (bubble.querySelector("img") && !(bubble.textContent || "").trim()) return "【图片】";
    return "";
  }

  function addCollection(contactId, type, content, originalTime, images) {
    if (!content || !content.trim()) return false;
    /* 卡片类（【问卷】/【转账】…）一律不收藏 */
    if (isCardFavContent(content)) return false;
    /* 严格归属到传入的联系人：微信消息只收藏对应窗口的，朋友圈/iCity/网易云各自独立收藏 */
    var targetId = contactId;
    if (!targetId) return false;
    var data = loadCollections(targetId);
    var dup = false;
    for (var i = 0; i < data[type].length; i++) {
      if (data[type][i].content === content.trim() && data[type][i].originalTime === originalTime) {
        dup = true;
        break;
      }
    }
    if (dup) return false;
    var item = {
      id: Date.now() + Math.random(),
      content: content.trim(),
      remark: pickWordcardRemark(),
      originalTime: originalTime || Date.now(),
      collectedTime: Date.now(),
    };
    if (images && images.length) item.images = images.slice(0, 9);
    data[type].unshift(item);
    saveCollections(targetId, data);
    return true;
  }

  /* 联系人收藏「我写给 TA 的信 / 我回复 TA 的回信」：概率与朋友圈一致，可在设置里自定义。
     TA 手机的信箱只放"我"寄出的内容，联系人回给我的信属于我自己的信箱，不在这里。
     信件对象形如 { from, fromId, content, date, ts, subtype, ... } */
  function addMailCollection(contactId, mail, scope) {
    if (!contactId || !mail) return false;
    /* 收到的回信不收进 TA 的手机 */
    if (scope === "received") return false;
    var body = String(mail.content || mail.body || "").trim();
    if (!body || isCardFavContent(body)) return false;
    var data = loadCollections(contactId);
    var orig = Number(mail.ts) || Number(mail.time) || Date.now();
    for (var i = 0; i < data.mail.length; i++) {
      var it = data.mail[i];
      if (it && it.content === body && it.originalTime === orig) return false;
    }
    var subtype = mail.subtype === "reply" ? "reply" : "";
    data.mail.unshift({
      id: Date.now() + Math.random(),
      content: body,
      title: String(mail.title || mail.subject || "").trim(),
      direction: "sent",
      subtype: subtype,
      fromName: String(mail.from || "").trim(),
      originalTime: orig,
      collectedTime: Date.now(),
      letter: {
        content: body,
        title: String(mail.title || mail.subject || "").trim(),
        from: String(mail.from || "").trim(),
        date: String(mail.date || ""),
        ts: orig,
        direction: "sent",
        subtype: subtype,
      },
    });
    saveCollections(contactId, data);
    return true;
  }

  window.akiniTaPhoneCollectMail = function (contactId, mail, scope) {
    if (!contactId || !mail) return false;
    if (Math.random() >= taProb("Mail", MAIL_CHANCE)) return false;
    return addMailCollection(contactId, mail, scope);
  };

  /* 统一按 DOM 行收藏：仅收藏我发的【纯文字】消息。
     转账、红包、问卷、一起听、物品、表情包、图片等卡片/富媒体一律不收。
     在 core.js 的 tt() 追加 .msg-row.me 后调用。 */
  window.__akiniTaPhoneCollectRows = function (contactId, container) {
    if (!contactId || !container || !container.querySelectorAll) return;
    var rows = container.querySelectorAll(".msg-row.me");
    if (!rows || !rows.length) return;
    for (var ri = 0; ri < rows.length; ri++) {
      var row = rows[ri];
      var bubble = row.querySelector(".bubble");
      if (!bubble) continue;
      // 卡片类消息（问卷/一起听/转账/红包/物品/表情包）一律跳过
      if (collectionCardLabel(bubble)) continue;
      // 含图片的消息（图片消息、图文消息）一律跳过
      var imgs = bubble.querySelectorAll("img");
      if (imgs && imgs.length) continue;
      var text = (bubble.textContent || "").trim();
      if (!text) continue;
      var ts = Date.now();
      try {
        var tAttr = row.getAttribute("data-ts") || bubble.getAttribute("data-ts");
        if (tAttr) {
          var p = parseInt(tAttr, 10);
          if (p && !isNaN(p)) ts = p;
        }
      } catch (e) {}
      if (Math.random() < taProb("Chat", CHAT_CHANCE)) {
        addCollection(contactId, "chat", text, ts);
      }
    }
  };

  window.akiniTaPhoneCollectMoment = function (contactId, text, timestamp, images) {
    if (!contactId || !text || !String(text).trim()) return;
    if (Math.random() < taProb("Moments", MOMENTS_CHANCE))
      addCollection(contactId, "moments", String(text).trim(), timestamp || Date.now(), images);
  };

  window.akiniTaPhoneCollectIcity = function (contactId, text, timestamp, images) {
    if (!contactId || !text || !String(text).trim()) return;
    if (Math.random() < taProb("Icity", ICITY_CHANCE))
      addCollection(contactId, "icity", String(text).trim(), timestamp || Date.now(), images);
  };

  // 联系人收藏用户添加的歌曲：track = {title, artist, cover, ...}
  function addMusicCollection(contactId, track, originalTime) {
    if (!track || !(track.title || track.name)) return false;
    var targetId = contactId;
    if (!targetId) return false;
    var data = loadCollections(targetId);
    var title = String(track.title || track.name || "").trim();
    var artist = String(track.artist || track.singer || "").trim();
    var cover = track.cover || track.pic || "";
    for (var i = 0; i < data.music.length; i++) {
      var it = data.music[i];
      if (it && it.track && it.track.title === title && it.track.artist === artist) return false;
    }
    data.music.unshift({
      id: Date.now() + Math.random(),
      track: { title: title, artist: artist, cover: cover },
      remark: pickWordcardRemark(),
      originalTime: originalTime || Date.now(),
      collectedTime: Date.now(),
    });
    saveCollections(targetId, data);
    return true;
  }

  window.akiniTaPhoneCollectMusic = function (track, timestamp) {
    if (!track) return;
    /* 每个联系人独立判定是否收藏（各自 10% 概率），收藏到各自的手机 */
    var all = getContacts();
    for (var i = 0; i < all.length; i++) {
      if (all[i] && all[i].id && Math.random() < taProb("Music", MUSIC_CHANCE))
        addMusicCollection(all[i].id, track, timestamp || Date.now());
    }
  };

  var _lastScanAt = 0;
  function scanHistory() {
    /* 节流：30 分钟内最多全量扫描一次，避免频繁打开 TA 手机时反复解析全部聊天 DOM 导致卡顿 */
    var now = Date.now();
    if (now - _lastScanAt < 30 * 60 * 1000) return;
    _lastScanAt = now;
    try {
      var contacts = getContacts();
      if (window.akiniContacts && typeof window.akiniContacts.getChatTarget === "function") {
        contacts.forEach(function (c) {
          if (!c || !c.id) return;
          var target = window.akiniContacts.getChatTarget(c.id);
          if (!target || target.type !== "contact") return;
          var session = window.akiniContacts.getSession(c.id);
          /* 只取最近 120 行：真正要收藏的是最近消息，没必要为一万条历史 join 整段 HTML */
          var html = "";
          try {
            html = window.__akiniChatLog
              ? window.__akiniChatLog.tail(c.id, 120)
              : session && session.messagesHTML
                ? session.messagesHTML
                : "";
          } catch (eTail) {}
          if (!html) return;
          var tmp = document.createElement("div");
          tmp.innerHTML = html;
          var meRows = tmp.querySelectorAll(".msg-row.me");
          /* 只收藏该联系人自己窗口的消息；每次扫描每人最多 1 条（从最新往旧，命中即停） */
          for (var ri = meRows.length - 1; ri >= 0; ri--) {
            var bubble = meRows[ri].querySelector(".bubble");
            if (!bubble) continue;
            /* 卡片消息不收藏，只收纯文本正文 */
            if (collectionCardLabel(bubble)) continue;
            var text = (bubble.textContent || "").trim();
            if (!text) continue;
            if (Math.random() < taProb("Chat", CHAT_HISTORY_CHANCE)) {
              addCollection(c.id, "chat", text, Date.now());
              break;
            }
          }
        });
      }
      var posts = window.__akiniGetPosts();
      var myPosts = [],
        myDiaries = [];
      if (Array.isArray(posts)) {
        var myName = localStorage.getItem("akini_my_name") || "我";
        posts.forEach(function (post) {
          if (!post || !post.text || !post.text.trim()) return;
          if (post.author && post.author !== myName) return;
          if (post.source === "icity") myDiaries.push(post);
          else myPosts.push(post);
        });
      }
      var plist = [];
      try {
        var plistRaw =
          window.akiniStore && window.akiniStore.getSync
            ? window.akiniStore.getSync("akini_music_playlist", null)
            : localStorage.getItem("akini_music_playlist");
        plist = plistRaw ? JSON.parse(plistRaw) : [];
      } catch (e) {}
      if (!Array.isArray(plist)) plist = [];
      /* 读历史信件：只有我寄出/我回复的信会进 TA 手机的信箱 */
      var mailSent = [];
      try {
        var _msRaw =
          window.akiniStore && window.akiniStore.getSync
            ? window.akiniStore.getSync("akini_mail_sent", null)
            : localStorage.getItem("akini_mail_sent");
        mailSent = _msRaw ? (typeof _msRaw === "string" ? JSON.parse(_msRaw) : _msRaw) : [];
      } catch (eMailScan) {}
      Array.isArray(mailSent) || (mailSent = []);
      /* 朋友圈/iCity/网易云/信箱：每个联系人独立判定、各自收藏到自己的手机；
         每类每次扫描最多 1 条（从最新往旧扫，命中即停），不会一口气收藏一堆 */
      contacts.forEach(function (c) {
        if (!c || !c.id) return;
        for (var mi = myPosts.length - 1; mi >= 0; mi--) {
          if (Math.random() < taProb("Moments", MOMENTS_HISTORY_CHANCE)) {
            addCollection(c.id, "moments", myPosts[mi].text, myPosts[mi].ts || Date.now());
            break;
          }
        }
        for (var di = myDiaries.length - 1; di >= 0; di--) {
          if (Math.random() < taProb("Icity", ICITY_HISTORY_CHANCE)) {
            addCollection(c.id, "icity", myDiaries[di].text, myDiaries[di].ts || Date.now());
            break;
          }
        }
        for (var si = plist.length - 1; si >= 0; si--) {
          var t = plist[si];
          if (!t || !(t.title || t.name)) continue;
          if (Math.random() < taProb("Music", MUSIC_HISTORY_CHANCE)) {
            addMusicCollection(c.id, t, Date.now());
            break;
          }
        }
        /* 信箱：只收我写给 TA 的信 / 我回复 TA 的回信（同一份 mailSent 里） */
        for (var li = mailSent.length - 1; li >= 0; li--) {
          var lm = mailSent[li];
          if (!lm || !lm.content) continue;
          if (!(lm.toId === c.id || lm.to === c.name)) continue;
          if (Math.random() < taProb("Mail", MAIL_CHANCE)) {
            addMailCollection(c.id, lm, "sent");
            break;
          }
        }
      });
    } catch (e) {}
  }

  /* ============ 渲染 ============ */
  function getEl(id) {
    return document.getElementById(id);
  }

  var _statusBarTimer = null;
  var _batteryInstance = null;

  function applyDeviceBattery(level) {
    try {
      var levelEl = getEl("akiniTaPhoneBatLevel");
      if (!levelEl) return;
      var num = typeof level === "number" && !isNaN(level) ? level : 0.9;
      var pct = Math.max(8, Math.min(100, Math.round(num * 100)));
      levelEl.style.width = pct + "%";
    } catch (e) {}
  }

  function syncBatteryOnce() {
    try {
      if (typeof navigator !== "undefined" && navigator.getBattery) {
        navigator
          .getBattery()
          .then(function (b) {
            _batteryInstance = b;
            applyDeviceBattery(b.level);
            b.onlevelchange = function () {
              applyDeviceBattery(b.level);
            };
          })
          .catch(function () {
            applyDeviceBattery(0.9);
          });
      } else {
        applyDeviceBattery(0.9);
      }
    } catch (e) {
      applyDeviceBattery(0.9);
    }
  }

  function updateStatusBar() {
    try {
      var timeEl = getEl("akiniTaPhoneTime");
      if (timeEl) {
        var d = new Date();
        var hh = String(d.getHours()).padStart(2, "0");
        var mm = String(d.getMinutes()).padStart(2, "0");
        timeEl.textContent = hh + ":" + mm;
      }
      if (_batteryInstance && typeof _batteryInstance.level === "number") {
        applyDeviceBattery(_batteryInstance.level);
      } else {
        syncBatteryOnce();
      }
    } catch (e) {}
  }

  function showContainer() {
    var c = getEl("akini-ta-phone-container");
    if (!c) {
      try {
        init();
      } catch (e) {
        console.error("[TA手机] init失败", e);
      }
      c = getEl("akini-ta-phone-container");
    }
    if (!c) {
      console.warn("[TA手机] 容器注入失败");
      return;
    }
    if (c.parentElement !== document.body) document.body.appendChild(c);
    c.style.display = "flex";
    var _dc = window.__akiniDefaultContact && window.__akiniDefaultContact();
    if (_dc && _dc.id) {
      openContact(_dc.id);
    }
    updateStatusBar();
    if (_statusBarTimer) clearTimeout(_statusBarTimer);
    /* 状态栏只显示分钟级时间，按"下一分钟边界"自续期 setTimeout：
       每分钟只醒一次，远比 5s 轮询省电；后台（document.hidden）自动暂停。 */
    _statusBarTimer = null;
    function _tickStatusBar() {
      _statusBarTimer = null;
      try {
        if (!document.hidden) updateStatusBar();
      } catch (e) {}
      var now = new Date();
      var delay = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
      if (delay < 1000) delay += 60000;
      _statusBarTimer = setTimeout(_tickStatusBar, delay);
    }
    _tickStatusBar();
  }

  function hideContainer() {
    var c = getEl("akini-ta-phone-container");
    if (c) c.style.display = "none";
    if (_statusBarTimer) {
      clearTimeout(_statusBarTimer);
      _statusBarTimer = null;
    }
  }

  function hideAllViews() {
    var grid = getEl("akini-ta-phone-contact-grid");
    var desktop = getEl("akini-ta-phone-desktop");
    var listView = getEl("akini-ta-phone-list-view");
    if (grid) grid.style.display = "none";
    if (desktop) desktop.style.display = "none";
    if (listView) listView.style.display = "none";
  }

  function openContact(contactId) {
    currentContactId = contactId;
    hideAllViews();
    var desktop = getEl("akini-ta-phone-desktop");
    if (desktop) desktop.style.display = "flex";
    var c = getContactById(contactId);
    updateTitle(c && c.name && !/^(null|undefined|nan)$/i.test(String(c.name).trim()) ? c.name : "TA的手机");
  }

  function showApp(tab) {
    if (!currentContactId) return;
    currentTab = tab;
    hideAllViews();
    var listView = getEl("akini-ta-phone-list-view");
    if (listView) listView.style.display = "flex";
    var c = getContactById(currentContactId);
    var _cname = c && c.name && !/^(null|undefined|nan)$/i.test(String(c.name).trim()) ? c.name + " · " : "";
    var tabTitle = "收藏";
    if (tab === "chat") tabTitle = "聊天";
    else if (tab === "moments") tabTitle = "朋友圈";
    else if (tab === "music") tabTitle = "网易云";
    else if (tab === "icity") tabTitle = "iCity";
    else if (tab === "calls") tabTitle = "通话记录";
    else if (tab === "mail") tabTitle = "信箱";
    else if (tab === "mailDetail") tabTitle = "信件详情";
    updateTitle(_cname + tabTitle);
    renderList();
  }

  function goBack() {
    var listView = getEl("akini-ta-phone-list-view");
    var desktop = getEl("akini-ta-phone-desktop");
    /* 信件详情 → 返回该联系人的信箱列表 */
    if (listView && listView.style.display !== "none" && currentTab === "mailDetail") {
      showApp("mail");
      return;
    }
    if (listView && listView.style.display !== "none") {
      hideAllViews();
      if (desktop) desktop.style.display = "flex";
      var c = getContactById(currentContactId);
      updateTitle(c && c.name && !/^(null|undefined|nan)$/i.test(String(c.name).trim()) ? c.name : "TA的手机");
    } else if (desktop && desktop.style.display !== "none") {
      hideContainer();
      currentContactId = null;
    } else {
      hideContainer();
      currentContactId = null;
    }
  }

  function updateTitle(text) {
    var el = getEl("akini-ta-phone-title");
    if (el) el.textContent = text;
  }

  function renderList() {
    var el = getEl("akini-ta-phone-list");
    if (!el || !currentContactId) return;
    var data = loadCollections(currentContactId);
    /* 通话记录走独立键（全量），其余 tab 仍读收藏数据 */
    var items = currentTab === "calls" ? loadCallRecords(currentContactId) : data[currentTab] || [];
    var sortBar = getEl("akini-ta-phone-sort-bar");
    if (sortBar) sortBar.style.display = currentTab === "chat" ? "flex" : "none";
    if (!items.length && currentTab !== "mailDetail") {
      // loadCallRecords 缓存未命中时会自行从 localforage 异步拉取并触发重渲染
      el.innerHTML =
        '<div class="akini-ta-phone-empty">' +
        (currentTab === "calls" ? "暂无通话记录..." : "TA 还没有收藏任何内容...") +
        "</div>";
      return;
    }
    /* 无备注的旧条目现场从字卡库补一张并持久化 */
    var needSave = false;
    items.forEach(function (it) {
      if (it && !it.remark) {
        var r = pickWordcardRemark();
        if (r) {
          it.remark = r;
          needSave = true;
        }
      }
    });
    if (needSave) saveCollections(currentContactId, data);
    var sorted = items.slice();
    // 所有数据统一按收藏时间倒序排列
    sorted.sort(function (a, b) {
      return (b.collectedTime || 0) - (a.collectedTime || 0);
    });
    if (currentTab === "calls") {
      if (!items.length) {
        el.innerHTML = '<div class="akini-ta-phone-empty">暂无通话记录...</div>';
        return;
      }
      var sortedCalls = items.slice();
      sortedCalls.sort(function (a, b) {
        return (b.endTime || 0) - (a.endTime || 0);
      });
      /* 汇总：通话次数 + 通话累计时长（样板字段） */
      var _callCount = sortedCalls.length;
      var _totalSec = 0;
      sortedCalls.forEach(function (it) {
        var ds = Number(it && it.durationSec);
        if (!isFinite(ds) || ds < 0) {
          var parts = String((it && it.duration) || "00:00").split(":");
          if (parts.length === 2) ds = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
          else if (parts.length === 3)
            ds = parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
          else ds = 0;
        }
        if (isFinite(ds) && ds > 0) _totalSec += Math.min(ds, 86400);
      });
      var _th = Math.floor(_totalSec / 3600);
      var _tm = Math.floor((_totalSec % 3600) / 60);
      var _ts = _totalSec % 60;
      var _totalDur =
        (_th > 0 ? String(_th).padStart(2, "0") + ":" : "") +
        String(_tm).padStart(2, "0") +
        ":" +
        String(_ts).padStart(2, "0");
      var defAvatarHtml =
        window.__akiniLineAvatarImg && typeof window.__akiniLineAvatarImg === "function"
          ? window.__akiniLineAvatarImg()
          : '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#bbb" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
      var _curContact = currentContactId ? getContactById(currentContactId) : null;
      var _curAvatar = _curContact && _curContact.avatar ? String(_curContact.avatar).trim() : "";
      el.innerHTML =
        '<div class="akini-ta-phone-call-summary" style="display:flex;gap:12px;margin-bottom:12px;">' +
        '<div style="flex:1;background:#f5f5f5;border:1px solid #e5e5e5;border-radius:12px;padding:12px 14px;text-align:center;">' +
        '<div style="font-size:11px;color:#888;margin-bottom:4px;">通话次数</div>' +
        '<div style="font-size:20px;font-weight:700;color:#111;">' +
        _callCount +
        " 次</div>" +
        "</div>" +
        '<div style="flex:1;background:#f5f5f5;border:1px solid #e5e5e5;border-radius:12px;padding:12px 14px;text-align:center;">' +
        '<div style="font-size:11px;color:#888;margin-bottom:4px;">通话累计时长</div>' +
        '<div style="font-size:20px;font-weight:700;color:#111;">' +
        _totalDur +
        "</div>" +
        "</div>" +
        "</div>" +
        sortedCalls
          .map(function (item) {
            var _av = item && item.avatar ? String(item.avatar).trim() : "";
            if (!_av || /^(null|undefined|nan)$/i.test(_av)) _av = _curAvatar;
            var avBox;
            if (!_av || /^(null|undefined|nan)$/i.test(String(_av).trim())) {
              avBox = defAvatarHtml;
            } else {
              avBox =
                "<img src=" +
                "'" +
                escapeHtml(_av) +
                "'" +
                " style=" +
                "'" +
                "width:100%;height:100%;object-fit:cover;display:block;" +
                "'" +
                " onerror=" +
                "'" +
                "this.remove();" +
                "'" +
                "/>";
            }
            return (
              '<div class="akini-ta-phone-item akini-ta-phone-call-item" style="display:flex;align-items:center;gap:14px;padding:14px 16px;background:#f9f9f9;border-radius:14px;margin-bottom:10px;">' +
              '<div style="width:48px;height:48px;border-radius:50%;overflow:hidden;flex-shrink:0;background:#f0f0f0;display:flex;align-items:center;justify-content:center;">' +
              avBox +
              "</div>" +
              '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;">' +
              '<div style="font-size:15px;font-weight:600;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
              escapeHtml(item.name || "TA") +
              "</div>" +
              '<div style="font-size:13px;color:#111;display:flex;align-items:center;gap:5px;">' +
              '<svg fill="none" height="15" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="15" style="color:#111;flex-shrink:0;"><path d="m22 8-6 4 6 4V8Z"/><rect height="12" rx="2" width="14" x="2" y="6"/></svg>' +
              '<span style="color:#111;">通话时长 ' +
              escapeHtml(item.duration || "00:00") +
              "</span>" +
              "</div>" +
              '<div style="font-size:11px;color:#999;margin-top:2px;">' +
              formatTime(item.endTime) +
              "</div>" +
              "</div>" +
              "</div>"
            );
          })
          .join("");
      return;
    }
    if (currentTab === "mailDetail") {
      var _letter = window.__akiniTaMailOpening || null;
      if (!_letter) {
        el.innerHTML = '<div class="akini-ta-phone-empty">信件已不存在...</div>';
        return;
      }
      var _isReply =
        _letter.subtype === "reply" ||
        (_letter.letter && _letter.letter.subtype === "reply");
      var _dir = _isReply ? "我写给 TA 的回信" : "我写给 TA 的信";
      var _title =
        String(_letter.title || "").trim() ||
        (_isReply ? "写给 TA 的回信" : "写给 TA 的信");
      var _body = String(_letter.content || "").trim();
      el.innerHTML =
        '<div class="akini-ta-mail-detail">' +
        '<div class="akini-ta-mail-detail-paper">' +
        '<div class="akini-ta-mail-detail-head">' +
        '<div class="akini-ta-mail-detail-title">' +
        escapeHtml(_title) +
        "</div>" +
        '<div class="akini-ta-mail-detail-meta">' +
        '<span class="akini-ta-mail-detail-tag">' +
        _dir +
        "</span>" +
        '<span class="akini-ta-mail-detail-date">' +
        escapeHtml(formatTime(_letter.originalTime)) +
        "</span>" +
        "</div>" +
        "</div>" +
        '<div class="akini-ta-mail-detail-body">' +
        escapeHtml(_body) +
        "</div>" +
        /* 落款「见字如面 · XXX」：谁寄的显示谁的名字——
           我寄的(direction=sent)显示我的名字，对方寄的显示联系人名 */
        (function () {
          var _signName = "";
          try {
            if (_letter.direction === "sent") {
              _signName = localStorage.getItem("akini_my_name") || "我";
            } else {
              var _c =
                window.akiniContacts && window.akiniContacts.getContactById
                  ? window.akiniContacts.getContactById(currentContactId)
                  : null;
              _signName =
                (_c && _c.name) ||
                _letter.from ||
                localStorage.getItem("akini_ta_name") ||
                "对方";
            }
          } catch (e) {
            _signName = "对方";
          }
          return (
            '<div class="akini-ta-mail-detail-sign">见字如面 · ' +
            escapeHtml(_signName) +
            "</div>"
          );
        })() +
        "</div>" +
        '<button type="button" class="akini-ta-mail-detail-del" onclick="window.AkiniTaPhone.deleteCollection(\'' +
        currentContactId +
        "','mail'," +
        _letter.id +
        ')">删除这封信</button>' +
        "</div>";
      return;
    }
    if (currentTab === "mail") {
      if (!sorted.length) {
        el.innerHTML = '<div class="akini-ta-phone-empty">TA 的信箱里还没有信件...</div>';
        return;
      }
      el.innerHTML = sorted
        .map(function (item) {
          var isSent = item.direction === "sent";
          var isReply =
            item.subtype === "reply" ||
            (item.letter && item.letter.subtype === "reply");
          var body = String(item.content || "").trim().replace(/\s+/g, " ");
          if (body.length > 76) body = body.slice(0, 76) + "…";
          return (
            '<div class="akini-ta-mail-item" onclick="window.AkiniTaPhone.openMailDetail(' +
            JSON.stringify(item.id) +
            ')">' +
            '<button class="akini-ta-phone-item-delete" onclick="event.stopPropagation();window.AkiniTaPhone.deleteCollection(\'' +
            currentContactId +
            "','mail'," +
            JSON.stringify(item.id) +
            ')" title="删除">×</button>' +
            '<div class="akini-ta-mail-item-top">' +
            '<span class="akini-ta-mail-item-dir ' +
            (isSent ? "is-sent" : "is-received") +
            '">' +
            (isReply ? "我的回信" : "我写的信") +
            "</span>" +
            '<span class="akini-ta-mail-item-time">' +
            escapeHtml(formatTime(item.originalTime)) +
            "</span>" +
            "</div>" +
            '<div class="akini-ta-mail-item-title">' +
            escapeHtml(
              String(item.title || "").trim() ||
                (isReply ? "写给 TA 的回信" : "写给 TA 的信"),
            ) +
            "</div>" +
            '<div class="akini-ta-mail-item-body">' +
            escapeHtml(body) +
            "</div>" +
            '<div class="akini-ta-mail-item-foot">点击查看信件详情</div>' +
            "</div>"
          );
        })
        .join("");
      return;
    }
    if (currentTab === "music") {
      el.innerHTML = sorted
        .map(function (item) {
          var t = item.track || {};
          var cover = t.cover
            ? '<img src="' +
              t.cover +
              '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="封面"/>'
            : '<span style="font-size:20px;line-height:1;">🎵</span>';
          return (
            '<div class="akini-ta-phone-item akini-ta-phone-music-item">' +
            '<button class="akini-ta-phone-item-delete" onclick="window.AkiniTaPhone.deleteCollection(\'' +
            currentContactId +
            "','music'," +
            item.id +
            ')" title="删除">×</button>' +
            '<div class="akini-ta-phone-music-row">' +
            '<div class="akini-ta-phone-music-disc">' +
            cover +
            "</div>" +
            '<div class="akini-ta-phone-music-meta">' +
            '<div class="akini-ta-phone-music-title">' +
            escapeHtml(t.title || "未知歌曲") +
            "</div>" +
            '<div class="akini-ta-phone-music-artist">' +
            escapeHtml(t.artist || "未知歌手") +
            "</div>" +
            "</div>" +
            "</div>" +
            (item.remark ? '<div class="akini-ta-phone-item-remark">备注：' + escapeHtml(item.remark) + "</div>" : "") +
            '<div class="akini-ta-phone-item-meta">收藏于: ' +
            formatTime(item.collectedTime) +
            "</div>" +
            "</div>"
          );
        })
        .join("");
      return;
    }
    el.innerHTML = sorted
      .map(function (item) {
        var _content = String(item.content || "").trim();
        var _isCard = /^【[^】]{1,8}】$/.test(_content);
        return (
          '<div class="akini-ta-phone-item">' +
          '<button class="akini-ta-phone-item-delete" onclick="window.AkiniTaPhone.deleteCollection(\'' +
          currentContactId +
          "','" +
          currentTab +
          "'," +
          item.id +
          ')" title="删除">×</button>' +
          '<div class="akini-ta-phone-item-time">' +
          formatTime(item.originalTime) +
          "</div>" +
          (_isCard
            ? '<div class="akini-ta-phone-item-cardtag">' + escapeHtml(_content) + "</div>"
            : '<div class="akini-ta-phone-item-text">' + escapeHtml(item.content) + "</div>") +
          (item.images && item.images.length
            ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">' +
              item.images
                .map(function (im) {
                  return (
                    '<img src="' +
                    String(im).replace(/"/g, "&quot;") +
                    '" style="width:72px;height:72px;object-fit:cover;border-radius:8px;background:#eee" alt=""/>'
                  );
                })
                .join("") +
              "</div>"
            : "") +
          (item.remark ? '<div class="akini-ta-phone-item-remark">备注：' + escapeHtml(item.remark) + "</div>" : "") +
          "</div>"
        );
      })
      .join("");
  }

  /* 打开某封信的详情（联系人手机 → 信箱 → 信件详情） */
  function openMailDetail(id) {
    if (!currentContactId) return;
    var data = loadCollections(currentContactId);
    var list = data.mail || [];
    var hit = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && String(list[i].id) === String(id)) {
        hit = list[i];
        break;
      }
    }
    if (!hit) return;
    window.__akiniTaMailOpening = hit;
    showApp("mailDetail");
  }

  function deleteCollection(contactId, type, id) {
    window.__akiniCenterModal("是否要偷偷取消 TA 的收藏？", "", {
      confirm: true,
      okText: "好",
      cancelText: "取消",
      onClose: function (ok) {
        if (!ok) return;
        /* 收藏删除是用户显式操作：放行核心键空值写入，避免被保护逻辑拦掉导致重进又出现 */
        
window._akiniAllowRemove = true;

        try {
          var data = loadCollections(contactId);
          data[type] = data[type].filter(function (item) {
            return String(item.id) !== String(id);
          });
          saveCollections(contactId, data);
          /* 在信件详情里删除：删完退回该联系人的信箱列表 */
          if (currentTab === "mailDetail" && type === "mail") {
            window.__akiniTaMailOpening = null;
            showApp("mail");
          } else renderList();
        } finally {
          
window._akiniAllowRemove = false;

        }
      },
    });
  }

  /* ============ 样式注入 ============ */
  function injectStyles() {
    if (getEl("akini-ta-phone-styles")) return;
    var style = document.createElement("style");
    style.id = "akini-ta-phone-styles";
    style.textContent = [
      // 遮罩：浅灰色
      ".akini-ta-phone-container{position:fixed!important;inset:0!important;z-index:5500!important;display:flex;align-items:center;justify-content:center;background:rgba(245,245,245,0.92)!important;}",
      // 竖屏小手机外观
      ".akini-ta-phone-modal{width:min(76vw,340px);height:min(78vh,680px);max-height:680px;background:#fff;border-radius:44px;overflow:hidden;box-shadow:0 25px 70px rgba(0,0,0,0.22);display:flex;flex-direction:column;border:10px solid #111;}",
      // 灵动岛
      // 拟真状态栏与灵动岛
      ".akini-ta-phone-statusbar{display:flex;align-items:center;justify-content:space-between;padding:10px 18px 4px;width:100%;box-sizing:border-box;flex-shrink:0;user-select:none;}",
      ".akini-ta-phone-sb-left{flex:1;display:flex;align-items:center;justify-content:flex-start;min-width:0;}",
      ".akini-ta-phone-time{font-size:14.5px;font-weight:700;color:#000;letter-spacing:-0.3px;font-variant-numeric:tabular-nums;line-height:1;}",
      ".akini-ta-phone-notch{width:78px;height:23px;background:#000;border-radius:12px;flex-shrink:0;margin:0 4px;}",
      ".akini-ta-phone-sb-right{flex:1;display:flex;align-items:center;justify-content:flex-end;gap:7px;min-width:0;}",
      ".akini-ta-phone-signal{display:flex;align-items:flex-end;gap:2px;height:12px;padding-bottom:1px;}",
      ".akini-ta-phone-signal .bar{width:3px;background:#000;border-radius:0.8px;}",
      ".akini-ta-phone-signal .bar-1{height:3.5px;}",
      ".akini-ta-phone-signal .bar-2{height:6.2px;}",
      ".akini-ta-phone-signal .bar-3{height:9px;}",
      ".akini-ta-phone-signal .bar-4{height:12px;}",
      ".akini-ta-phone-battery-wrap{display:flex;align-items:center;}",
      ".akini-ta-phone-battery{width:22px;height:11.5px;border:1.6px solid #000;border-radius:3.8px;padding:1.2px;position:relative;display:flex;align-items:center;box-sizing:border-box;}",
      ".akini-ta-phone-battery::after{content:'';position:absolute;right:-2.8px;top:2.2px;width:1.6px;height:4.2px;background:#000;border-radius:0 1.2px 1.2px 0;}",
      ".akini-ta-phone-battery-level{height:100%;background:#000;border-radius:1.8px;transition:width 0.3s;}",
      ".akini-ta-phone-header{background:transparent;display:flex;align-items:center;justify-content:space-between;padding:8px 14px 10px;flex-shrink:0;}",
      ".akini-ta-phone-back{background:none;border:none;color:#999;font-size:24px;cursor:pointer;font-weight:400;line-height:1;padding:0 4px;}",
      ".akini-ta-phone-back:active{opacity:0.6;}",
      ".akini-ta-phone-title{font-size:15px;font-weight:600;color:#111;flex:1;text-align:center;}",
      // 联系人网格（首页图标风格）
      ".akini-ta-phone-contact-grid{display:none;flex:1;overflow-y:auto;padding:24px 16px 16px;gap:22px 16px;flex-wrap:wrap;align-content:flex-start;justify-content:center;background:#fff;}",
      ".akini-ta-phone-grid-item{display:flex;flex-direction:column;align-items:center;gap:7px;width:64px;cursor:pointer;}",
      ".akini-ta-phone-grid-item:active{opacity:0.7;}",
      ".akini-ta-phone-grid-name{font-size:12px;color:#666;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;}",
      // 联系人桌面（三个应用图标）
      ".akini-ta-phone-desktop{display:none;justify-content:flex-start;align-items:flex-start;flex-wrap:wrap;gap:26px 6%;padding:40px 24px;flex:1;background:#fff;align-content:flex-start;}",
      ".akini-ta-phone-app{display:flex;flex-direction:column;align-items:center;gap:7px;cursor:pointer;width:27%;flex-shrink:0;}",
      ".akini-ta-phone-app:active{opacity:0.7;}",
      ".akini-ta-phone-app-icon{width:56px;height:56px;display:flex;align-items:center;justify-content:center;color:#666;}",
      ".akini-ta-phone-app-icon svg{width:100%;height:100%;}",
      ".akini-ta-phone-app-name{font-size:12px;color:#666;}",
      // 列表视图
      ".akini-ta-phone-list-view{display:none;flex-direction:column;flex:1;min-height:0;overflow:hidden;background:#fff;}",
      ".akini-ta-phone-list{flex:1;overflow-y:auto;padding:12px 12px 16px;}",
      ".akini-ta-phone-list .akini-ta-phone-empty{padding-top:60px;}",
      ".akini-ta-phone-item{background:#f7f7f7;border-radius:12px;padding:12px;margin-bottom:8px;position:relative;}",
      ".akini-ta-phone-item-time{font-size:12px;color:#999;margin-bottom:4px;}",
      ".akini-ta-phone-item-text{font-size:14px;color:#111;line-height:1.5;word-break:break-all;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;}",
      ".akini-ta-phone-item-cardtag{display:inline-block;font-size:12px;color:#333;background:#ededed;border-radius:6px;padding:3px 8px;line-height:1.4;}",
      ".akini-ta-phone-item-meta{font-size:11px;color:#bbb;margin-top:4px;}",
      ".akini-ta-phone-item-remark{font-size:12px;color:#999;margin-top:6px;line-height:1.5;word-break:break-word;}",
      ".akini-ta-phone-item-delete{position:absolute;top:8px;right:8px;background:none;border:none;color:#ccc;font-size:18px;cursor:pointer;line-height:1;}",
      ".akini-ta-phone-item-delete:hover{color:#ef4444;}",
      ".akini-ta-phone-empty{text-align:center;padding:40px 20px;color:#bbb;font-size:14px;}",
      ".akini-ta-phone-music-row{display:flex;align-items:center;gap:10px;padding-right:18px;}",
      ".akini-ta-phone-music-disc{width:44px;height:44px;flex-shrink:0;border-radius:50%;background:repeating-radial-gradient(#111 0,#111 3px,#222 4px,#222 5px);box-shadow:inset 0 0 0 4px #1a1a1a;display:flex;align-items:center;justify-content:center;overflow:hidden;}",
      ".akini-ta-phone-music-meta{min-width:0;flex:1;}",
      ".akini-ta-phone-music-title{font-size:14px;font-weight:600;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      ".akini-ta-phone-music-artist{font-size:12px;color:#888;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      /* 信箱：信件卡片 + 详情（黑白纸笺风格） */
      ".akini-ta-mail-item{position:relative;background:#fff;border:1px solid #e6e6e2;border-radius:14px;padding:14px 14px 12px;margin-bottom:10px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.04);transition:transform .16s ease,box-shadow .16s ease;}",
      ".akini-ta-mail-item:active{transform:scale(.985);box-shadow:0 1px 4px rgba(0,0,0,.05);}",
      ".akini-ta-mail-item-top{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-right:22px;}",
      ".akini-ta-mail-item-dir{font-size:10px;letter-spacing:.12em;padding:3px 8px;border-radius:999px;border:1px solid #d8d8d2;color:#666;background:#fafaf7;}",
      ".akini-ta-mail-item-dir.is-sent{color:#111;border-color:#111;background:#fff;}",
      ".akini-ta-mail-item-time{font-size:11px;color:#b0b0aa;}",
      ".akini-ta-mail-item-title{font-size:15px;font-weight:700;color:#111;margin:9px 0 5px;font-family:'Songti SC','Noto Serif SC',Georgia,serif;letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      ".akini-ta-mail-item-body{font-size:13px;line-height:1.72;color:#555;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word;}",
      ".akini-ta-mail-item-foot{font-size:10px;color:#b7b7b2;letter-spacing:.16em;margin-top:9px;text-align:right;}",
      ".akini-ta-mail-detail{display:flex;flex-direction:column;gap:14px;padding:2px 2px 10px;}",
      ".akini-ta-mail-detail-paper{background:#fff;border:1px solid #e2e2dc;border-radius:18px;padding:18px 18px 0;box-shadow:0 12px 30px rgba(0,0,0,.07);position:relative;}",
      ".akini-ta-mail-detail-head{border-bottom:1px dashed #dedeD8;padding-bottom:12px;}",
      ".akini-ta-mail-detail-title{font-size:18px;font-weight:700;color:#111;font-family:'Songti SC','Noto Serif SC',Georgia,serif;letter-spacing:.06em;line-height:1.5;}",
      ".akini-ta-mail-detail-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;}",
      ".akini-ta-mail-detail-tag{font-size:10px;letter-spacing:.12em;padding:3px 9px;border-radius:999px;border:1px solid #d8d8d2;color:#555;background:#fafaf7;}",
      ".akini-ta-mail-detail-date{font-size:11px;color:#a5a59f;}",
      ".akini-ta-mail-detail-body{padding:18px 2px 22px;font-size:15px;line-height:2;color:#1a1a1a;font-family:'Songti SC','Noto Serif SC',Georgia,serif;white-space:pre-wrap;word-break:break-word;background-image:repeating-linear-gradient(to bottom,transparent 0,transparent 29px,#f0f0ec 29px,#f0f0ec 30px);background-size:100% 30px;min-height:120px;}",
      ".akini-ta-mail-detail-sign{text-align:right;font-size:10px;letter-spacing:.26em;color:#b0b0aa;pointer-events:none;padding:0 2px 14px;font-family:Georgia,serif;}",
      ".akini-ta-mail-detail-del{align-self:center;height:40px;padding:0 26px;border-radius:999px;border:1px solid #111;background:#fff;color:#111;font-size:12px;letter-spacing:.14em;font-weight:600;font-family:inherit;cursor:pointer;}",
      ".akini-ta-mail-detail-del:active{opacity:.6;}",
      "",
    ].join("");
    document.head.appendChild(style);
  }

  /* ============ DOM 注入 ============ */
  function injectDOM() {
    if (getEl("akini-ta-phone-container")) return;
    var container = document.createElement("div");
    container.id = "akini-ta-phone-container";
    container.className = "akini-ta-phone-container";
    container.style.display = "none";
    container.onclick = function (e) {
      if (e.target === container) {
        hideContainer();
      }
    };
    container.innerHTML =
      '<div class="akini-ta-phone-modal">' +
      '<div class="akini-ta-phone-statusbar">' +
      '<div class="akini-ta-phone-sb-left">' +
      '<span class="akini-ta-phone-time" id="akiniTaPhoneTime">14:52</span>' +
      "</div>" +
      '<div class="akini-ta-phone-notch"></div>' +
      '<div class="akini-ta-phone-sb-right">' +
      '<div class="akini-ta-phone-signal" title="蜂窝信号">' +
      '<span class="bar bar-1"></span>' +
      '<span class="bar bar-2"></span>' +
      '<span class="bar bar-3"></span>' +
      '<span class="bar bar-4"></span>' +
      "</div>" +
      '<div class="akini-ta-phone-battery-wrap">' +
      '<div class="akini-ta-phone-battery" title="设备电量">' +
      '<div class="akini-ta-phone-battery-level" id="akiniTaPhoneBatLevel" style="width:90%"></div>' +
      "</div>" +
      "</div>" +
      "</div>" +
      "</div>" +
      '<div class="akini-ta-phone-header">' +
      '<button class="akini-ta-phone-back" onclick="window.AkiniTaPhone.goBack()"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M15 18l-6-6 6-6"/></svg></button>' +
      '<span class="akini-ta-phone-title" id="akini-ta-phone-title">TA的手机</span>' +
      '<span style="width:32px;"></span>' +
      "</div>" +
      // 联系人网格
      '<div class="akini-ta-phone-contact-grid" id="akini-ta-phone-contact-grid"></div>' +
      // 联系人桌面（三个应用）
      '<div class="akini-ta-phone-desktop" id="akini-ta-phone-desktop">' +
      '<div class="akini-ta-phone-app" onclick="window.AkiniTaPhone.showApp(\'chat\')">' +
      '<div class="akini-ta-phone-app-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>' +
      '<span class="akini-ta-phone-app-name">聊天</span>' +
      "</div>" +
      '<div class="akini-ta-phone-app" onclick="window.AkiniTaPhone.showApp(\'moments\')">' +
      '<div class="akini-ta-phone-app-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>' +
      '<span class="akini-ta-phone-app-name">朋友圈</span>' +
      "</div>" +
      '<div class="akini-ta-phone-app" onclick="window.AkiniTaPhone.showApp(\'icity\')">' +
      '<div class="akini-ta-phone-app-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></div>' +
      '<span class="akini-ta-phone-app-name">iCity</span>' +
      "</div>" +
      '<div class="akini-ta-phone-app" onclick="window.AkiniTaPhone.showApp(\'music\')">' +
      '<div class="akini-ta-phone-app-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>' +
      '<span class="akini-ta-phone-app-name">网易云</span>' +
      "</div>" +
      '<div class="akini-ta-phone-app" onclick="window.AkiniTaPhone.showApp(\'calls\')">' +
      '<div class="akini-ta-phone-app-icon"><svg fill="none" height="42" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" viewBox="0 0 24 24" width="42"><path d="m22 8-6 4 6 4V8Z"/><rect height="12" rx="2" width="14" x="2" y="6"/></svg></div>' +
      '<span class="akini-ta-phone-app-name">通话记录</span>' +
      "</div>" +
      '<div class="akini-ta-phone-app" onclick="window.AkiniTaPhone.showApp(\'mail\')">' +
      '<div class="akini-ta-phone-app-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="m22 6-10 7L2 6"/></svg></div>' +
      '<span class="akini-ta-phone-app-name">信箱</span>' +
      "</div>" +
      "</div>" +
      // 收藏列表
      '<div class="akini-ta-phone-list-view" id="akini-ta-phone-list-view">' +
      '<div class="akini-ta-phone-list" id="akini-ta-phone-list"></div>' +
      "</div>" +
      "</div>";
    document.body.appendChild(container);
  }

  var _scanned = false;
  function init() {
    injectStyles();
    injectDOM();
    if (!_scanned) {
      _scanned = true;
      setTimeout(scanHistory, 2500);
    }
  }

  /* 通话计时兜底：接听按钮有一条处理只把状态置为已接听、没记录开始时间，
     表现为时长停在 00:00、挂断时写成"通话时长 29879345:39"。
     接听后复核计时是否真的在走，没走就补点 core 另一条接听链路（它会补记开始时间）。
     复核必须等真实计时跑满 2 秒：正常计时首秒也显示 00:00，过早补点会把开始时间重置。 */
  var _callAnswerAt = 0;
  var _callFixTries = 0;
  var _callFixTimer = null;

  function _callTimeText() {
    var el = document.getElementById("callTimeDisplay");
    var txt = el ? String(el.innerText || "").replace(/\s/g, "") : "";
    return /^\d+:\d+$/.test(txt) ? txt : "";
  }

  function ensureCallTicker() {
    _callFixTimer = null;
    var st = window._callState;
    if (!st || !st.active || !st.answered) {
      _callFixTries = 0;
      _callAnswerAt = 0;
      return;
    }
    if (_callTimeText() !== "00:00") return; // 已在正常计时
    if (_callFixTries >= 2) return;
    _callFixTries++;
    var mini = document.getElementById("callAnswerBtn");
    if (mini) mini.click();
    _callFixTimer = setTimeout(ensureCallTicker, 2500);
  }

  document.addEventListener(
    "click",
    function (e) {
      var t = e.target;
      var hit = t && t.closest ? t.closest("#callAnswerBtnFull,#callAnswerBtn") : null;
      if (!hit) return;
      _callAnswerAt = Date.now();
      _callFixTries = 0;
      if (_callFixTimer) clearTimeout(_callFixTimer);
      _callFixTimer = setTimeout(ensureCallTicker, 2500);
    },
    true,
  );

  window.AkiniTaPhone = {
    showTaPhone: showContainer,
    hideTaPhone: hideContainer,
    goBack: goBack,
    openContact: openContact,
    showApp: showApp,
    deleteCollection: deleteCollection,
    addCallRecord: addCallRecord,
    openMailDetail: openMailDetail,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  setTimeout(init, 1500);
})();
