(function () {
  "use strict";
  if (window.__akiniMomentsEngineReady) return;
  window.__akiniMomentsEngineReady = true;

  // ========== 工具函数 ==========

  function getContacts() {
    return window.akiniContacts && window.akiniContacts.getContacts ? window.akiniContacts.getContacts() : [];
  }

  function getContactById(id) {
    if (!id) return null;
    var contacts = getContacts();
    for (var i = 0; i < contacts.length; i++) {
      if (contacts[i].id === id || String(contacts[i].id) === String(id)) return contacts[i];
    }
    return null;
  }

  // 朋友圈用微信设置的昵称头像；icity 用 icity 里设置的资料，两者不互通
  function getContactName(contact, app) {
    if (!contact) return "对方";
    if (app === "icity" && window.getIcityContactProfile) {
      var p = window.getIcityContactProfile(contact.id);
      if (p && p.name) return p.name;
    }
    return contact.name || "对方";
  }

  function getContactAvatar(contact, app) {
    if (!contact) return "";
    if (app === "icity" && window.getIcityContactProfile) {
      var p = window.getIcityContactProfile(contact.id);
      if (p && p.avatar) return p.avatar;
    }
    return contact.avatar || "";
  }

  function getContactStickers(contactId) {
    if (!contactId) return [];
    try {
      {
        var srcs = window.__akiniStickerSrcs(contactId);
        if (Array.isArray(srcs) && srcs.length) return srcs;
      }
      {
        var syncs = window.getContactStickersSync(contactId);
        if (Array.isArray(syncs) && syncs.length) {
          return syncs
            .map(function (it) {
              if (typeof it === "string") return it;
              return (it && (it.s || it.url || it.src)) || "";
            })
            .filter(Boolean);
        }
      }
      var raw = localStorage.getItem("akini_stickers_" + contactId);
      if (raw) {
        var arr = JSON.parse(raw);
        if (Array.isArray(arr))
          return arr
            .map(function (it) {
              if (typeof it === "string") return it;
              return (it && (it.s || it.url || it.src)) || "";
            })
            .filter(Boolean);
      }
    } catch (e) {}
    return [];
  }

  // 从字卡库取可用文字（排除拍一拍 pat）
  function getWordbankTexts() {
    var out = [];
    var seen = {};
    function addFromRaw(raw) {
      if (!raw) return;
      try {
        var arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return;
        arr.forEach(function (item) {
          var t = typeof item === "string" ? item : item && item.text;
          if (!t || !String(t).trim()) return;
          var tab = ((item && item.tab) || "").toLowerCase();
          var type = ((item && item.type) || "").toLowerCase();
          if (tab === "pat" || type === "pat") return;
          var key = String(t).trim();
          if (!seen[key]) {
            seen[key] = true;
            out.push(key);
          }
        });
      } catch (e) {}
    }
    try {
      // 优先从内存缓存读取（与 akiniStore 同步），避免 localStorage 配额空时无法取到字卡
      if (window.akiniStore && window.akiniStore.memoryGet) {
        addFromRaw(window.akiniStore.memoryGet("akini_wordbank"));
      }
      // 兜底 localStorage
      var keys = Object.keys(localStorage);
      keys.forEach(function (k) {
        if (k.indexOf("akini_wordbank") === 0) {
          addFromRaw(localStorage.getItem(k));
        }
      });
    } catch (e) {}
    return out;
  }

  function pickRandom(arr) {
    if (!arr || !arr.length) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // 使用与聊天回复相同的消息回复延迟
  function getMessageReplyDelay() {
    var min = parseFloat(localStorage.getItem("akini_num_replyDelayMin") || "2");
    var max = parseFloat(localStorage.getItem("akini_num_replyDelayMax") || "5");
    if (isNaN(min) || min < 0) min = 2;
    if (isNaN(max) || max < min) max = min;
    return Math.floor(1000 * (min + Math.random() * Math.max(0, max - min)));
  }

  // ========== 数据读写 ==========

  function getData(app) {
    if (app === "icity") {
      return window.__akiniGetIcity ? window.__akiniGetIcity() : [];
    }
    return window.__akiniGetPosts ? window.__akiniGetPosts() : [];
  }

  function saveData(app, data) {
    try {
      if (app === "icity") {
        if (window.__akiniSaveIcity) window.__akiniSaveIcity(data);
      } else {
        if (window.__akiniSavePosts) window.__akiniSavePosts(data);
      }
    } catch (e) {}
  }

  function render(app) {
    try {
      if (app === "icity") {
        if (window._renderIcity) window._renderIcity();
        if (window.renderIcityProfileDiaries) {
          window.renderIcityProfileDiaries("icityMyProfileDiaries", "me");
          window.renderIcityProfileDiaries("icityTaProfileDiaries", "ta");
        }
      } else {
        if (window._renderPosts) window._renderPosts();
      }
    } catch (e) {}
  }

  function findMoment(data, momentId) {
    if (!data || !data.length) return null;
    for (var i = 0; i < data.length; i++) {
      if (String(data[i].id) === String(momentId)) return data[i];
    }
    return null;
  }

  function notify(app, name, avatar, msg) {
    try {
      if (window.showInAppNotif) {
        window.showInAppNotif({
          app: app === "icity" ? "icity" : "朋友圈",
          avatar: avatar,
          name: name,
          fullContent: true,
          msg: msg,
          onTap: function () {},
        });
      }
    } catch (e) {}
  }

  // ========== 点赞/评论核心 ==========

  // ========== 互动通知记录（消息中心数据源） ==========

  function pushNotif(app, type, name, avatar, text, momentId, extra) {
    try {
      var key = app === "icity" ? "akini_icity_notifications" : "akini_friends_notifications";
      var list = [];
      try {
        list = JSON.parse(localStorage.getItem(key) || "[]");
      } catch (e) {
        list = [];
      }
      var item = {
        id: "n_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        type: type,
        name: name,
        avatar: avatar,
        text: text,
        momentId: String(momentId),
        ts: Date.now(),
        read: false,
      };
      if (extra && extra.sticker) item.sticker = extra.sticker;
      if (extra && extra.replyTo) item.replyTo = extra.replyTo;
      list.push(item);
      if (list.length > 100) list = list.slice(-100);
      localStorage.setItem(key, JSON.stringify(list));
      if (window.__updateHomeBadges) window.__updateHomeBadges();
    } catch (e) {}
  }

  function likeMoment(moment, contact, app) {
    var name = getContactName(contact, app);
    var liked = false;
    if (app === "icity") {
      moment.likers = moment.likers || [];
      if (moment.likers.indexOf(name) < 0) {
        moment.likers.push(name);
        moment.likes = (moment.likes || 0) + 1;
        liked = true;
      }
    } else {
      moment.likes = moment.likes || [];
      if (moment.likes.indexOf(name) < 0) {
        moment.likes.push(name);
        liked = true;
      }
    }
    if (liked) {
      var preview = (moment.content || moment.text || "").replace(/\n/g, " ").slice(0, 30);
      pushNotif(app, "like", name, getContactAvatar(contact, app), preview, moment.id);
    }
  }

  function commentMoment(moment, contact, replyTo, app) {
    var name = getContactName(contact, app);
    var avatar = getContactAvatar(contact, app);

    // 20% 概率附带该联系人专属表情包
    var stickers = getContactStickers(contact.id);
    if (stickers.length && Math.random() < 0.2) {
      var st = pickRandom(stickers);
      var scomment = {
        id: "c_" + Math.random().toString(36).slice(2) + "_" + Date.now(),
        author: name,
        authorId: contact.id,
        text: "",
        sticker: st,
        ts: Date.now(),
      };
      if (replyTo) scomment.replyTo = replyTo;
      if (app === "icity") scomment.avatar = avatar;
      moment.comments = moment.comments || [];
      moment.comments.push(scomment);
      pushNotif(app, replyTo ? "reply" : "comment", name, avatar, "[表情包]", moment.id, {
        sticker: st,
        replyTo: replyTo,
      });
      return true;
    }

    var texts = getWordbankTexts();
    if (!texts.length) return false;
    var text = pickRandom(texts);
    if (!text) return false;

    var comment = {
      id: "c_" + Math.random().toString(36).slice(2) + "_" + Date.now(),
      author: name,
      authorId: contact.id,
      text: text,
      ts: Date.now(),
    };
    if (replyTo) comment.replyTo = replyTo;
    if (app === "icity") comment.avatar = avatar;

    moment.comments = moment.comments || [];
    moment.comments.push(comment);
    pushNotif(app, replyTo ? "reply" : "comment", name, avatar, text, moment.id, { replyTo: replyTo });
    return true;
  }

  // ========== 初始点赞/评论 ==========

  function doInitialReply(momentId, app) {
    var data = getData(app);
    var moment = findMoment(data, momentId);
    if (!moment) return;

    var contacts = getContacts();
    if (!contacts.length) return;

    var didAnything = false;

    contacts.forEach(function (contact) {
      likeMoment(moment, contact, app);
      didAnything = true;
    });

    // compat 评论数量逻辑：总数按设置（空=随机1~3），打乱联系人、60% 概率参与且至少 1 人，逐人分 1~2 条
    var totalComments = getCommentCount();
    var shuffled = contacts.slice().sort(function () {
      return Math.random() - 0.5;
    });
    var repliers = [];
    for (var ri = 0; ri < shuffled.length; ri++) {
      if (Math.random() < 0.6) repliers.push(shuffled[ri]);
    }
    if (!repliers.length) repliers.push(shuffled[0]);
    var remaining = totalComments;
    var plan = [];
    for (var pi = 0; pi < repliers.length && remaining > 0; pi++) {
      var pc = pi === repliers.length - 1 ? remaining : Math.random() < 0.5 ? 1 : Math.min(2, remaining);
      plan.push({ contact: repliers[pi], count: pc });
      remaining -= pc;
    }
    plan.forEach(function (p) {
      for (var ci = 0; ci < p.count; ci++) {
        if (commentMoment(moment, p.contact, null, app)) {
          didAnything = true;
          var _lc = moment.comments[moment.comments.length - 1];
          notify(
            app,
            getContactName(p.contact, app),
            getContactAvatar(p.contact, app),
            "评论了你的动态：" + (_lc.sticker ? "[表情包]" : String(_lc.text || "").slice(0, 20)),
          );
        }
      }
    });

    if (didAnything) {
      saveData(app, data);
      render(app);
    }
  }

  // ========== 用户回复后再回复 ==========

  function doReplyToUser(momentId, contactId, replyToName, app) {
    var data = getData(app);
    var moment = findMoment(data, momentId);
    if (!moment) return;

    var contact = getContactById(contactId);
    if (!contact) return;

    if (commentMoment(moment, contact, replyToName, app)) {
      saveData(app, data);
      render(app);
      var _lc2 = moment.comments[moment.comments.length - 1];
      var _txt = _lc2.sticker ? "[表情包]" : String(_lc2.text || "");
      notify(app, getContactName(contact, app), getContactAvatar(contact, app), "回复了你的评论：" + _txt.slice(0, 20));
    }
  }

  // compat 评论数量：min/max 都留空 = 随机（70% 1条 / 20% 2条 / 10% 3条）；有值则区间随机（0~20）
  function getCommentCount() {
    var minS = localStorage.getItem("akini_num_commentCountMin");
    var maxS = localStorage.getItem("akini_num_commentCountMax");
    if (!minS && !maxS) {
      return Math.random() < 0.7 ? 1 : Math.random() < 0.9 ? 2 : 3;
    }
    var min = minS ? Math.max(0, parseInt(minS, 10) || 0) : 0;
    var max = maxS ? Math.min(20, parseInt(maxS, 10) || 20) : 20;
    if (min > max) {
      var tmp = min;
      min = max;
      max = tmp;
    }
    if (min === max) return min;
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  // ========== 暴露接口 ==========

  window.akiniTriggerMomentAutoReply = function (momentId, app) {
    var delay = getMessageReplyDelay();
    setTimeout(function () {
      doInitialReply(momentId, app);
    }, delay);
  };

  // 用户评论/回复了朋友圈/iCity 后调用
  // momentId: 动态 id
  // contactIdOrName: 被回复的联系人 id 或名字；若是动态作者则表示这是一条新评论
  // app: 'friends' | 'icity'
  window.akiniOnMomentUserReply = function (momentId, contactIdOrName, app) {
    if (!momentId) return;
    var targetName = contactIdOrName || "";
    var contacts = getContacts();
    if (!contacts.length) return;

    var data = getData(app);
    var moment = findMoment(data, momentId);
    var authorName = moment ? moment.author || "" : "";
    var myName =
      app === "icity"
        ? localStorage.getItem("akini_icity_my_nick") || localStorage.getItem("akini_my_name") || "我"
        : localStorage.getItem("akini_my_name") || "我";

    // 判断是否是“单独回复某条联系人评论”：targetName 不是动态作者，视为单独回复
    var isTopLevelComment = !targetName || (authorName && targetName === authorName);

    if (isTopLevelComment) {
      // 新评论动态：所有联系人（排除“我”）都回复用户，按消息回复延迟设置（不要秒回）
      contacts.forEach(function (contact, idx) {
        if (!contact || contact.id === "me" || contact.id === "my") return;
        var delay = getMessageReplyDelay();
        setTimeout(
          function () {
            doReplyToUser(momentId, contact.id, myName, app);
          },
          delay + idx * 600 + Math.floor(Math.random() * 300),
        );
      });
      return;
    }

    // 单独回复某联系人评论：只有被回复的联系人回复
    var contact = getContactById(targetName);
    if (!contact) {
      for (var i = 0; i < contacts.length; i++) {
        if (getContactName(contacts[i], app) === targetName || (contacts[i] && contacts[i].name === targetName)) {
          contact = contacts[i];
          break;
        }
      }
    }
    if (!contact) return;

    var delay = getMessageReplyDelay();
    setTimeout(function () {
      doReplyToUser(momentId, contact.id, myName, app);
    }, delay);
  };


  console.log(
    "[akini-moments-engine] 朋友圈/iCity 点赞/评论引擎已加载（评论数量可调，20% 表情包评论，延迟=消息回复延迟）",
  );
})();
