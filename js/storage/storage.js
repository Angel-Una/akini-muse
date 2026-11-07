/*
 * 持久化存储：localStorage 同步读写 + IndexedDB 镜像 + 启动对账恢复
 */
(function () {
  "use strict";
  if (window.__akiniStorageSafeReady) return;
  window.__akiniStorageSafeReady = true;

  // 启动时把大媒体迁移到 IndexedDB，释放 localStorage 空间
  function migrateLsBigMediaToIdb() {
    var _MIG_FLAG = "akini_media_migrated_v3";
    if (rawLS && rawLS.getItem(_MIG_FLAG) === "1") return;
    try {
      if (!rawLS) return;
      var totalKeys = rawLS.length || 0;
      var migrated = 0;
      var freedBytes = 0;
      var keysToCheck = [];
      var totalBytes = 0;
      for (var idx = 0; idx < totalKeys; idx++) {
        try {
          var k = origKey ? origKey.call(rawLS, idx) : rawLS.key(idx);
          /* 只收键名：旧代码在这里把每个键的值都同步读一遍（最多 5MB 字符串），
             启动时白读一次纯属浪费主线程 —— 需要值的地方下面按需读。 */
          if (k && String(k).indexOf("akini_") === 0) keysToCheck.push(k);
        } catch (eK) {}
      }
      keysToCheck.forEach(function (k) {
        try {
          /* 原生 模型：启动瘦身只处理图片残留。
             文本类键写入时（akiniSet）已经镜像到 IDB，这里再 memSet + queueIdbWrite
             等于每启动一次就把几十 MB 文本重复写库一遍（旧代码还连跑 4 次），
             低端机重进时直接卡死/闪退 —— 已删除。
             图片键先按名字判断，未命中的键连字符串都不读。 */
          /* 朋友圈 / iCity：旧版本把图片内联在整段 JSON 里，这里迁到 IDB 的「引用版」并清空 LS */
          if (_MEDIA_KEYS[k]) {
            var _mv = origGet ? origGet.call(rawLS, k) : rawLS.getItem(k);
            if (_mv && _mv.length > 40 * 1024) {
              queueIdbWrite(k, _mv); // 入队时即转成引用版
              try {
                var _IDBp = getIDB();
                if (_IDBp && _IDBp.set) _IDBp.set(k, _externalizeForPersist(k, _mv));
              } catch (eMp) {}
              if (origRemove) origRemove.call(rawLS, k);
              else rawLS.removeItem(k);
              migrated++;
              freedBytes += _mv.length;
            }
            return;
          }
          if (!isImgKey(k)) return;
          var v = origGet ? origGet.call(rawLS, k) : rawLS.getItem(k);
          if (!v) return;
          var len = v.length || 0;
          memSet(k, v); // 内存镜像，前端同步读写无感命中
          queueIdbWrite(k, v); // IndexedDB 大容量主存储
          _stampImgKey(k);
          try {
            var _IDBm = getIDB();
            if (_IDBm && _IDBm.set) _IDBm.set(k, v);
          } catch (eM0) {}
          if (origRemove) origRemove.call(rawLS, k);
          else rawLS.removeItem(k);
          migrated++;
          freedBytes += len;
        } catch (eMig) {}
      });
      try {
        var _imgList = [];
        var _imgTotal = 0;
        keysToCheck.forEach(function (k) {
          try {
            if (!isImgKey(k)) return;
            var iv = origGet ? origGet.call(rawLS, k) : rawLS.getItem(k);
            if (iv && typeof iv === "string" && iv.length > 10) {
              _imgList.push({ k: k, len: iv.length });
              _imgTotal += iv.length;
            }
          } catch (eI) {}
        });
        if (_imgTotal > 1400 * 1024) {
          _imgList.sort(function (a, b) {
            return b.len - a.len;
          });
          for (var ii = 0; ii < _imgList.length && _imgTotal > 1400 * 1024; ii++) {
            var itk = _imgList[ii].k;
            if (_isEssentialImgKey(itk)) continue; // 关键图片不参与驱逐，保证首屏同步可读
            try {
              var iv2 = origGet ? origGet.call(rawLS, itk) : rawLS.getItem(itk);
              if (!iv2) continue;
              memSet(itk, iv2);
              queueIdbWrite(itk, iv2);
              _stampImgKey(itk);
              if (origRemove) origRemove.call(rawLS, itk);
              else rawLS.removeItem(itk);
              _imgTotal -= _imgList[ii].len;
              freedBytes += _imgList[ii].len;
            } catch (eR) {}
          }
        }
      } catch (eCap) {}
      if (migrated > 0 || freedBytes > 0) {
        console.log(
          "[存储架构升级] 成功将 " +
            migrated +
            " 个大媒体迁移至 IndexedDB，释放 LS 配额: " +
            Math.round(freedBytes / 1024) +
            " KB",
        );
      }
      try {
        rawLS.setItem(_MIG_FLAG, "1");
      } catch (e) {}
      _lsImgUsed = -1;
    } catch (e) {}
  }

  // wipe 保险丝：上一轮清除若在刷新前来不及清完 IDB，本轮启动第一时间清空（cookie 不受 localStorage.clear 影响）
  try {
    if (/(?:^|;\s*)akini_wipe_pending=1/.test(document.cookie || "")) {
      try {
        document.cookie = "akini_wipe_pending=;path=/;max-age=0";
      } catch (e) {}
      // 清除数据后的启动：10 秒后摘掉的 ?reset= 参数，避免用户收藏带参链接导致云恢复永久失效
      try {
        if (/[?&]reset=/.test(location.search || "") && window.history && history.replaceState) {
          setTimeout(function () {
            try {
              history.replaceState(null, "", location.pathname);
            } catch (e) {}
          }, 10000);
        }
      } catch (e) {}
      try {
        localStorage.clear();
      } catch (e) {}
      try {
        sessionStorage.clear();
      } catch (e) {}
      try {
        if (typeof localforage !== "undefined") {
          var _wlf = localforage.createInstance({ name: "AkiniApp", storeName: "akini_data" });
          _wlf.clear().catch(function () {});
        }
      } catch (e) {}
      try {
        indexedDB.deleteDatabase("akini_img_db");
      } catch (e) {}
    }
  } catch (e) {}

  var HIGH_FREQ_RE = /^akini_(next_|last_)/; // 高频调度键不镜像，避免事务堆积

  // 首页/头像/背景等关键图片必须保留在 localStorage，否则首屏会出现先空白/旧图再闪成新图
  var _ESSENTIAL_IMG_KEYS = {
    akini_home_bg: 1,
    akini_s1_cover: 1,
    akini_s1_photo: 1,
    akini_cover_bg: 1,
    akini_avatar_left: 1,
    akini_avatar_right: 1,
    akini_my_avatar: 1,
    akini_ta_avatar: 1,
    akini_icity_my_avatar: 1,
    akini_icity_ta_avatar: 1,
    akini_s1_avatar: 1,
    akini_music_bg: 1,
    akini_chat_bg: 1,
    akini_day_bg: 1,
    akini_cover_img: 1,
    akini_bg_img: 1,
    akini_music_player_bg: 1,
    akini_s2_cover: 1,
    akini_s2_day_bg: 1,
    akini_friends_bg: 1,
    akini_call_bg: 1,
    akini_callmini_bg: 1,
    akini_anniv_bg: 1,
  };
  // 带后缀的聊天背景/对方背景等：每个会话可独立设置聊天背景（akini_chat_bg_<chatId>）
  var _ESSENTIAL_IMG_PREFIXES = [
    "akini_chat_bg_",
    "akini_icity_ta_bg_",
    "akini_icity_my_bg_",
    "akini_contact_avatar_",
    "akini_music_custom_bg_",
    "akini_s1_",
    "akini_s2_",
    "akini_cover_",
    "akini_app_icon_",
    "akini_stickers_",
    "akini_media_",
    "akini_favs_",
  ];
  /* 轻量模式（主屏幕 PWA / 连续闪退）下不必在冷启动就把这些「进页面才用得到」的图片
     全部读进内存：聊天背景/ iCity 背景/ 表情包/ 聊天媒体/ 收藏/ 自定义音乐底图
     在各自页面都有异步回填（loadBgFromStorage / ct / __akiniMedia.get / _stkRead）。
     头像、首页背景等首屏必需的图不在此列，仍随文本批次同步恢复。 */
  var _LITE_DEFER_IMG_PREFIXES = [
    "akini_chat_bg_",
    "akini_icity_ta_bg_",
    "akini_icity_my_bg_",
    "akini_stickers_",
    "akini_media_",
    "akini_favs_",
    "akini_music_custom_bg_",
  ];
  function _deferImgInLite(k) {
    if (!k) return false;
    var ks = String(k);
    for (var _li = 0; _li < _LITE_DEFER_IMG_PREFIXES.length; _li++) {
      if (ks.indexOf(_LITE_DEFER_IMG_PREFIXES[_li]) === 0) return true;
    }
    return false;
  }
  function _isEssentialImgKey(k) {
    if (!k) return false;
    if (_ESSENTIAL_IMG_KEYS[k]) return true;
    var ks = String(k);
    for (var i = 0; i < _ESSENTIAL_IMG_PREFIXES.length; i++) {
      if (ks.indexOf(_ESSENTIAL_IMG_PREFIXES[i]) === 0) return true;
    }
    return false;
  }
  // 关键文本数据键：>40KB 时也必须保留在 localStorage，保证刷新后同步读取立即可用
  var _ESSENTIAL_TEXT_KEYS = {
    akini_wordbank: 1,
    akini_wb_groups: 1,
    akini_contacts: 1,
    akini_mail_sent: 1,
    akini_mail_received: 1,
    akini_posts: 1,
    akini_icity_diaries: 1,
    akini_shop_orders: 1,
    akini_shop_products: 1,
    akini_surveys: 1,
    akini_wb_blocked: 1,
    akini_chat_sessions: 1,
    akini_chat_pins: 1,
    akini_home_avatars: 1,
    akini_music_playlists_v2: 1,
  };
  var _ESSENTIAL_TEXT_PREFIXES = [
    "akini_surveys_",
    "akini_survey_groups_",
    "akini_stk_groups_",
    "akini_wb_groups_",
    "akini_chat_history_",
  ];
  function _isEssentialTextKey(k) {
    if (!k) return false;
    if (_ESSENTIAL_TEXT_KEYS[k]) return true;
    var ks = String(k);
    for (var i = 0; i < _ESSENTIAL_TEXT_PREFIXES.length; i++) {
      if (ks.indexOf(_ESSENTIAL_TEXT_PREFIXES[i]) === 0) return true;
    }
    return false;
  }
  /* 「进页面才用得到」的数据：邮箱 / 商城 / 问卷 / 分组。
     启动时不把内容再复制一份进内存，只在 localStorage 保留同步副本；
     打开对应页面时由读取拦截按需从 IndexedDB 水合。
     前提是 LS 里已有可直接同步读取的真实值 —— 否则照旧全量恢复，
     保证任何同步读取都立刻拿得到内容，面板不会先空一帧。 */
  var _DEFER_TEXT_KEYS = {
    akini_mail_sent: 1,
    akini_mail_received: 1,
    akini_shop_orders: 1,
    akini_shop_products: 1,
    akini_surveys: 1,
  };
  var _DEFER_TEXT_PREFIXES = ["akini_surveys_", "akini_survey_groups_", "akini_stk_groups_"];
  function _isDeferTextKey(k) {
    if (!k) return false;
    if (_DEFER_TEXT_KEYS[k]) return true;
    var ks = String(k);
    for (var i = 0; i < _DEFER_TEXT_PREFIXES.length; i++) {
      if (ks.indexOf(_DEFER_TEXT_PREFIXES[i]) === 0) return true;
    }
    return false;
  }
  /* LS 里这份值能否直接满足同步读取：真实、非空壳，且没被标记为「写失败/可能陈旧」 */
  function _lsCanServe(k) {
    try {
      if (_lsDirty[k]) return false;
      var v = lsGet(k);
      if (!_isRealVal(v) || v === "[]" || v === "{}" || v === "null") return false;
      return !_isShellValStorage(k, v);
    } catch (e) {
      return false;
    }
  }
  /* 用户配置类键：一旦从 LS 清掉，同步读取会拿到空值并渲染成默认样式，
     表现为"名字/聊天背景/主页设置被重置"，因此任何清理路径都必须跳过。
     联系人键尤其重要：启动时若读不到 akini_contacts，会补建一个默认联系人"对方"，
     再恢复真实数据就变成两个联系人。 */
  var _KEEP_IN_LS_PREFIXES = [
    "akini_contacts",
    "akini_settings_",
    "akini_icity_",
    "akini_chat_bg_",
    "akini_home_bg",
    "akini_bg",
    "akini_day_bg",
    "akini_s1_",
    "akini_cover_",
    "akini_s2_",
    "akini_friends_bg",
    "akini_call_bg",
    "akini_callmini_bg",
    "akini_anniv_bg",
    "akini_app_icon_",
    "akini_stickers_",
    "akini_media_",
    "akini_avatar_",
    "akini_my_avatar",
    "akini_ta_avatar",
    "akini_contact_avatar_",
    "akini_music_bg",
    "akini_music_player_bg",
    "akini_toggle_",
    "akini_num_",
    "akini_music_history",
    "akini_call_state",
    "akini_call_mini_pos",
    "akini_chat_sessions",
    "akini_chat_pins",
    "akini_home_avatars",
    "akini_music_playlists_v2",
  ];
  function _keepInLs(k) {
    if (!k) return false;
    var ks = String(k);
    for (var i = 0; i < _KEEP_IN_LS_PREFIXES.length; i++) {
      if (ks.indexOf(_KEEP_IN_LS_PREFIXES[i]) === 0) return true;
    }
    return false;
  }

  function isCriticalKey(k) {
    if (!k) return false;
    var ks = String(k);
    if (HIGH_FREQ_RE.test(ks)) return false;
    return ks.indexOf("akini_") === 0; // 全量保护：所有 akini_ 数据都镜像
  }

  function safeParse(s, fb) {
    if (s == null) return fb;
    try {
      return JSON.parse(s);
    } catch (e) {
      return fb;
    }
  }
  function safeStringify(v) {
    try {
      return JSON.stringify(v);
    } catch (e) {
      return null;
    }
  }

  // ---- localStorage 原始引用（在拦截前取到，供内部直读直写）----
  var rawLS = null;
  try {
    rawLS = window.localStorage;
  } catch (e) {}
  var origSet = null,
    origGet = null,
    origRemove = null,
    origKey = null;
  try {
    var proto = rawLS ? Object.getPrototypeOf(rawLS) : null;
    if (proto) {
      origSet = proto.setItem;
      origGet = proto.getItem;
      origRemove = proto.removeItem;
      origKey = proto.key;
    }
  } catch (e) {}
  /* 迁移调用点必须在 memoryCache/_restored/_preRestorePending 等状态变量初始化之后：
     在文件顶部调用时这些 var 还是 undefined，memSet 直接抛异常被 catch 吞掉，
     表现为"迁移从未执行"，LS 被图片塞满后文字/设置全部写不进去。见下方 IIFE 末尾的调用。 */

  function lsGet(k) {
    try {
      return origGet ? origGet.call(rawLS, k) : rawLS.getItem(k);
    } catch (e) {
      return null;
    }
  }
  // 图片/壁纸类大键：配额紧张时优先清理它们，为关键数据腾出空间
  var BIG_IMG_RE = /^akini_(chat_history_|home_bg|bubble_css|icity_|my_avatar|ta_avatar|contact_avatar_)/;
  /* 图像键写入时间戳：LS 侧车键 akini_wts_<key>。
     恢复路径回填前对比时间，本地记录更新则拒绝旧值覆盖。 */
  var IMG_EXACT = {
    akini_my_avatar: 1,
    akini_ta_avatar: 1,
    akini_icity_my_avatar: 1,
    akini_icity_ta_avatar: 1,
    akini_home_bg: 1,
    akini_bg_img: 1,
    akini_cover_img: 1,
    akini_friends_bg: 1,
    akini_call_bg: 1,
    akini_callmini_bg: 1,
    akini_chat_bg: 1,
    akini_icity_my_bg: 1,
    akini_icity_ta_bg: 1,
    akini_music_bg: 1,
    akini_s1_cover: 1,
    akini_s1_photo: 1,
    akini_s2_cover: 1,
    akini_s2_day_bg: 1,
    akini_music_player_bg: 1,
    akini_polaroid_photo: 1,
  };
  var IMG_PREFIXES = [
    "akini_contact_avatar_",
    "akini_chat_bg_",
    "akini_icity_ta_bg_",
    "akini_icity_my_bg_",
    "akini_media_",
    "akini_stickers_",
    "akini_net_",
    "akini_music_custom_bg_",
  ];
  function isImgKey(k) {
    if (!k) return false;
    var ks = String(k);
    if (ks.indexOf("akini_wts_") === 0) return false;
    if (IMG_EXACT[ks]) return true;
    for (var _ip = 0; _ip < IMG_PREFIXES.length; _ip++) {
      if (ks.indexOf(IMG_PREFIXES[_ip]) === 0) return true;
    }
    return false;
  }
  function _stampImgKey(k, ts) {
    try {
      var t = ts || Date.now();
      var wk = "akini_wts_" + k;
      // LS 侧车小键（几十字节；随 collectAll 进入云端）
      if (origSet) origSet.call(rawLS, wk, String(t));
      else rawLS.setItem(wk, String(t));
      // IDB 镜像（与主键同批落盘）
      if (_restored) queueIdbWrite(wk, String(t));
      else _preRestorePending[wk] = String(t);
    } catch (e) {}
  }
  function _localImgWts(k) {
    try {
      var l = lsGet("akini_wts_" + k);
      if (l) return +l || 0;
    } catch (e) {}
    return 0;
  }
  /* 通用键写入时间戳（文字/收藏/字卡/聊天等非图片键）。
     与图片键共用 akini_wts_<k> 侧车约定，供云恢复 _wtsOk 仲裁新旧：
     本地刚删过（lw 更新）→ 拒绝用云端旧备份回填，避免「删了重进又出现」。
     只写 LS + IDB（不写 cookie，避免高频文字键撑爆 cookie 4KB 上限）。 */
  function _stampKey(k, ts) {
    if (!k || k.indexOf("akini_wts_") === 0) return;
    try {
      var t = ts || Date.now();
      var wk = "akini_wts_" + k;
      if (origSet) origSet.call(rawLS, wk, String(t));
      else if (rawLS) rawLS.setItem(wk, String(t));
      if (_restored) queueIdbWrite(wk, String(t));
      else _preRestorePending[wk] = String(t);
    } catch (e) {}
  }
  var _lastEvictAt = 0;
  function _evictBigKeys(allowEssentialImg) {
    var removed = 0;
    /* 配额写满时每次写入失败都会触发一次「遍历全部 LS 键并逐个读值」的扫描，
       连续写入（聊天/自动回复）时会反复 O(n) 读 5MB 字符串，是卡顿尖峰的主要来源。
       1.5s 冷却期内直接跳过扫描，写失败改走 IDB 镜像，不丢数据。 */
    var _nowEv = Date.now();
    if (_nowEv - _lastEvictAt < 1500) return 0;
    _lastEvictAt = _nowEv;
    try {
      var keys = lsKeys();
      // 优先清理最大的非关键大键，保留联系人/设置等小键
      var bigs = [];
      /* 关键图片是第二优先级：配额真的写满时仍然要把它们赶出 LS（内存+IDB 都有副本，
         本次会话渲染不受影响，下次启动由 IDB 对账回填）。否则图片占满配额后，
         文字/名字/设置永远写不进去，刷新就表现为"全都消失了"。 */
      var essImgs = [];
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (!k || String(k).indexOf("akini_") !== 0) continue;
        /* 聊天记录/媒体/表情/收藏键不驱逐 */
        var _ks = String(k);
        if (
          _ks.indexOf("akini_chat_history_") === 0 ||
          _ks.indexOf("akini_media_") === 0 ||
          _ks.indexOf("akini_stickers_") === 0 ||
          _ks.indexOf("akini_favs_") === 0
        )
          continue;
        var v = lsGet(k);
        if (!v || typeof v !== "string" || v.length <= 60000) continue;
        if (_isEssentialImgKey(k)) {
          essImgs.push({ k: k, len: v.length });
          continue;
        }
        /* 关键文本（字卡库/联系人/各 tab 分组等）不驱逐：同步读依赖 LS */
        if (_isEssentialTextKey(k)) continue;
        /* 用户设置/个人主页/聊天背景等配置键：驱逐后同步读为空，会显示成默认 */
        if (_keepInLs(k)) continue;
        bigs.push({ k: k, len: v.length });
      }
      bigs.sort(function (a, b) {
        return b.len - a.len;
      });
      essImgs.sort(function (a, b) {
        return b.len - a.len;
      });
      var list = bigs.slice(0, 8);
      if (!list.length && allowEssentialImg) list = essImgs.slice(0, 3);
      for (var j = 0; j < list.length; j++) {
        try {
          /* 驱逐前先镜像到 IndexedDB */
          var _ev = lsGet(list[j].k);
          var _IDB = getIDB();
          if (_ev && _IDB && _IDB.set) {
            try {
              _IDB.set(list[j].k, _ev);
            } catch (eM) {}
          }
          if (_ev) memSet(list[j].k, _ev);
          lsRemoveRaw(list[j].k);
          removed++;
        } catch (e) {}
      }
    } catch (e) {}
    return removed;
  }
  function lsSet(k, v) {
    try {
      if (origSet) origSet.call(rawLS, k, v);
      else rawLS.setItem(k, v);
      if (isImgKey(k)) _lsImgUsed = -1;
      return true;
    } catch (e) {
      // 配额满（QuotaExceededError）：清理大体积图片键后重试，避免关键数据静默丢失
      try {
        /* 先清非关键大键；仍然腾不出空间就再把关键图片移到 IDB（内存里仍可渲染），
           保证文字/名字/设置永远写得进去 */
        var evicted = _evictBigKeys(false);
        if (!evicted) evicted = _evictBigKeys(true);
        if (evicted > 0) {
          if (origSet) origSet.call(rawLS, k, v);
          else rawLS.setItem(k, v);
          console.warn("[存储] 配额紧张，已清理" + evicted + "个大键后重试写入", k);
          return true;
        }
      } catch (e2) {}
      return false;
    }
  }
  /* 启动瘦身：清理 _backup 冗余副本与超 300KB 的残留大值，仅在接近配额上限时触发 */
  function startupSlim() {
    try {
      var keys = lsKeys();
      if (!keys || !keys.length) return 0;
      var total = 0,
        backupCount = 0;
      for (var i = 0; i < keys.length; i++) {
        try {
          var v = lsGet(keys[i]);
          if (v && typeof v === "string") {
            total += v.length;
            if (String(keys[i]).indexOf("akini_media_") === 0 && String(keys[i]).indexOf("_backup") > 0) backupCount++;
          }
        } catch (e) {}
      }
      // 不紧张（<3.8MB 且无冗余备份）则跳过，避免无谓清理
      if (total < 3840 * 1024 && backupCount === 0) return 0;
      var removed = 0;
      for (var j = 0; j < keys.length; j++) {
        var k = keys[j];
        if (!k) continue;
        var ks = String(k);
        // 清除媒体冗余备份键（主键由 IDB/rawLS 镜像兜底，删冗余副本不影响读取）
        if (ks.indexOf("akini_media_") === 0 && ks.indexOf("_backup") > 0) {
          lsRemoveRaw(k);
          removed++;
          continue;
        }
        // 清除超大残留图片值（>300KB），但首页/头像/设置等关键数据保留在 LS
        var bigV = lsGet(k);
        if (
          bigV &&
          typeof bigV === "string" &&
          bigV.length > 300 * 1024 &&
          ks.indexOf("akini_") === 0 &&
          !_isEssentialImgKey(k) &&
          !_isEssentialTextKey(k) &&
          !_keepInLs(k)
        ) {
          // 先确保有 IDB 镜像再删 LS 残留，避免丢图
          try {
            var IDB = getIDB();
            if (IDB && IDB.set) IDB.set(k, bigV);
          } catch (eM) {}
          lsRemoveRaw(k);
          removed++;
        }
      }
      if (removed > 0)
        console.warn(
          "[存储] 启动瘦身：清理了 " + removed + " 个冗余/超大键（总占用约 " + Math.round(total / 1024) + "KB）",
        );
      return removed;
    } catch (e) {
      return 0;
    }
  }
  function lsRemoveRaw(k) {
    if (isImgKey(k)) _lsImgUsed = -1;
    try {
      if (origRemove) origRemove.call(rawLS, k);
      else rawLS.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }
  function lsKeys() {
    var out = [];
    try {
      for (var i = 0; i < rawLS.length; i++) {
        var k = origKey ? origKey.call(rawLS, i) : rawLS.key(i);
        if (k) out.push(k);
      }
    } catch (e) {}
    return out;
  }
  /* LS 里图片键当前占用的字符数。-1 表示未知（写入/删除图片后置为 -1 下次重算）。
     恢复回填时用它保证 LS 图片总量不超过 1.4MB，剩余配额留给文字/名字/设置，
     否则图片一多就把配额占满，所有文字类写入失败 → 刷新后"文字、昵称、设置全消失"。 */
  var _lsImgUsed = -1;
  /* LS 总字节数：旧代码对「每个需要回填的键」都全量遍历 localStorage 并逐个读值求和，
     N 个键 × 整个 LS = 启动期 O(N²) 同步读盘，安卓切后台重进时直接把主线程卡死。
     这里进程内只算一次。 */
  var _lsTotCache = -1;
  function _lsTotalLen() {
    if (_lsTotCache >= 0) return _lsTotCache;
    var tot = 0;
    try {
      for (var i = 0; i < rawLS.length; i++) {
        var k = origKey ? origKey.call(rawLS, i) : rawLS.key(i);
        var v = origGet ? origGet.call(rawLS, k) : rawLS.getItem(k);
        if (v && typeof v === "string") tot += v.length;
      }
    } catch (e) {}
    _lsTotCache = tot;
    return tot;
  }
  // ---- 内存缓存：同步读取的权威层，IDB 恢复后也会回填到这里 ----
  var memoryCache = {};
  function memGet(k) {
    return memoryCache.hasOwnProperty(k) ? memoryCache[k] : null;
  }
  function memSet(k, v) {
    /* 大 base64（图片/音频/视频）不驻留内存：JS 堆里同时压着几十上百 MB 的
       base64 字符串，移动端会持续 GC，表现就是「不管点什么都卡」。
       这类大值已有 IndexedDB 持久化 + store.js 的 objectURL 缓存兜底。 */
    if (typeof v === "string" && v.length > 400 * 1024 && v.indexOf("data:") === 0) return;
    memoryCache[k] = v;
  }
  function memRemove(k) {
    delete memoryCache[k];
  }

  // 大键（图片/壁纸 dataURL）不进 localStorage，只进内存缓存与 IndexedDB
  var LS_BIG_LIMIT = 40 * 1024;
  function isBigVal(v) {
    return typeof v === "string" && v.length > LS_BIG_LIMIT;
  }

  // ---- standard 一致②：LS 写失败脏键集合——对账时这些键信 IDB，不信 LS 残留旧值 ----
  var _lsDirty = {};
  try {
    var _d = JSON.parse(sessionStorage.getItem("akini_ls_dirty") || "[]");
    if (Array.isArray(_d))
      _d.forEach(function (k) {
        if (k) _lsDirty[k] = 1;
      });
  } catch (e) {}
  function lsDirtySave() {
    try {
      sessionStorage.setItem("akini_ls_dirty", JSON.stringify(Object.keys(_lsDirty)));
    } catch (e) {}
  }
  function markDirty(k) {
    if (!_lsDirty[k]) {
      _lsDirty[k] = 1;
      lsDirtySave();
    }
  }
  function clearDirty(k) {
    if (_lsDirty[k]) {
      delete _lsDirty[k];
      lsDirtySave();
    }
  }

  function getIDB() {
    var IDB = window._idbStore;
    /* 核心模块（akini-core）会绕过本层直接 _idbStore.set('akini_posts', 全量JSON)：
       在这里给底层实例一次性套上「媒体外置」，保证任何写入路径落库的都是引用版 */
    try {
      if (IDB && IDB.set && !IDB.__akiniMediaPatched) {
        IDB.__akiniMediaPatched = 1;
        var _origIdbSet = IDB.set;
        IDB.set = function (k, v) {
          try {
            if (v != null) v = _externalizeForPersist(k, v);
          } catch (eP) {}
          return _origIdbSet.apply(IDB, [k, v]);
        };
      }
    } catch (ePatch) {}
    return IDB;
  }
  function idbGet(k, cb) {
    var IDB = getIDB();
    if (!IDB || !IDB.get) {
      if (cb) cb(null);
      return;
    }
    try {
      IDB.get(k, function (v) {
        if (v == null) {
          if (cb) cb(null);
          return;
        }
        /* 媒体外置键：读出来先把 akini-ref 展开回 dataURL，调用方拿到的永远是完整数据 */
        _expandMedia(k, String(v), function (v2) {
          if (cb) cb(v2);
        });
      });
    } catch (e) {
      if (cb) cb(null);
    }
  }

  /* ============ 媒体外置（对齐 原生：媒体存独立 IDB 键，业务 JSON 只存引用） ============
     朋友圈 / iCity 的动态图片是 base64 内联在整段 JSON 里的：几十条动态就是十几 MB。
     后果：① 每次点赞/评论都要把整段 JSON 重新序列化写盘（卡顿）；
           ② 启动要把十几 MB 整段解析进内存（低端机闪退）；
           ③ 一超 4MB 就被内存预算判为「大键」不驻留，界面读到空 → 看起来"帖子没了"。
     现在统一在持久化一侧把大 dataURL 换成 akini-ref:<id> 引用，媒体本体写进 IDB；
     内存里始终是完整 dataURL（渲染、导出、备份代码完全不用改），启动恢复时批量展开。 */
  var MEDIA_REF_PRE = "akini-ref:";
  var MEDIA_KEY_PRE = "akini_mref_";
  var MEDIA_MIN_LEN = 24 * 1024;
  var _mediaMem = {};
  var _mediaMemQ = [];
  var _mediaMemBytes = 0;
  var _mediaRev = {};
  var _mediaSeq = 0;
  var _MEDIA_KEYS = { akini_posts: 1, akini_posts_backup: 1, akini_icity_diaries: 1, akini_icity_diaries_backup: 1 };
  var _DATAURL_RE = /^data:(?:image|video)\//;
  function _mediaRemember(id, d) {
    if (_mediaMem[id]) return;
    _mediaMem[id] = d;
    _mediaMemQ.push(id);
    _mediaMemBytes += d.length;
    /* 会话缓存上限 16MB：启动展开时只留最近用到的，避免和展开后的 JSON 一起把内存翻倍 */
    while (_mediaMemBytes > 16 * 1024 * 1024 && _mediaMemQ.length) {
      var old = _mediaMemQ.shift();
      if (_mediaMem[old]) {
        _mediaMemBytes -= _mediaMem[old].length;
        delete _mediaMem[old];
      }
    }
  }
  function _mediaFp(d) {
    return d.length + "|" + d.slice(0, 64) + "|" + d.slice(-32);
  }
  function _mediaPut(d) {
    var fp = _mediaFp(d);
    if (_mediaRev[fp]) return _mediaRev[fp];
    var id = Date.now().toString(36) + "-" + _mediaSeq++;
    _mediaRev[fp] = id;
    _mediaRemember(id, d);
    try {
      var IDBm = getIDB();
      if (IDBm && IDBm.set) IDBm.set(MEDIA_KEY_PRE + id, d);
    } catch (eM) {}
    return id;
  }
  function _mediaWalk(v) {
    if (typeof v === "string") {
      return v.length >= MEDIA_MIN_LEN && _DATAURL_RE.test(v) ? MEDIA_REF_PRE + _mediaPut(v) : v;
    }
    if (Array.isArray(v)) {
      for (var i = 0; i < v.length; i++) v[i] = _mediaWalk(v[i]);
      return v;
    }
    if (v && typeof v === "object") {
      for (var kk in v) if (Object.prototype.hasOwnProperty.call(v, kk)) v[kk] = _mediaWalk(v[kk]);
      return v;
    }
    return v;
  }
  /* 持久化形态：引用的 id 由内容指纹去重，同一张图不会存两份 */
  var _mediaMemo = {}; // k -> { expanded, persisted }：内容没变时直接复用，省掉一次几 MB 的 parse+stringify
  function _externalizeForPersist(k, v) {
    if (!_MEDIA_KEYS[k] || typeof v !== "string" || v.length < 200 * 1024 || v.indexOf("data:") < 0) return v;
    var memo = _mediaMemo[k];
    if (memo && memo.expanded === v && memo.persisted) return memo.persisted;
    try {
      var out = JSON.stringify(_mediaWalk(JSON.parse(v)));
      _mediaMemo[k] = { expanded: v, persisted: out };
      return out;
    } catch (e) {
      return v;
    }
  }
  /* 恢复形态：把引用换回 dataURL；缺失的引用置空（不渲染破图，也不误判为删除） */
  function _expandMedia(k, v, cb) {
    if (!_MEDIA_KEYS[k] || typeof v !== "string" || v.indexOf(MEDIA_REF_PRE) < 0) {
      cb(v);
      return;
    }
    var ids = [];
    try {
      v.replace(/akini-ref:([0-9a-z-]+)/g, function (m, id) {
        ids.push(id);
        return m;
      });
    } catch (e) {}
    if (!ids.length) {
      cb(v);
      return;
    }
    var map = {},
      missing = 0;
    ids.forEach(function (id) {
      if (_mediaMem[id]) map[id] = _mediaMem[id];
    });
    var q = [],
      seen = {};
    ids.forEach(function (id) {
      if (!seen[id] && !map[id]) {
        seen[id] = 1;
        q.push(id);
      }
    });
    var running = 0,
      settled = 0,
      total = q.length;
    function finish() {
      if (missing) console.warn("[媒体] " + missing + " 张引用图在 IndexedDB 中缺失，已跳过");
      var out = v;
      try {
        out = v.replace(/akini-ref:([0-9a-z-]+)/g, function (m, id) {
          return map[id] || "";
        });
      } catch (e) {}
      try {
        if (v !== out) _mediaMemo[k] = { expanded: out, persisted: v };
      } catch (eM2) {}
      cb(out);
    }
    if (!total) {
      finish();
      return;
    }
    /* 并发上限 4：几百张图一次性并发读会把内存顶起来（低端机闪退） */
    function pump() {
      while (running < 4 && q.length) {
        var id = q.shift();
        running++;
        (function (id2) {
          idbGet(MEDIA_KEY_PRE + id2, function (d) {
            if (d && d.length > 10) {
              _mediaRemember(id2, d);
              /* 记住指纹→id：本次会话再落盘时复用同一个 id，不会生成重复媒体键 */
              try {
                _mediaRev[_mediaFp(d)] = id2;
              } catch (eF) {}
              map[id2] = d;
            } else {
              missing++;
            }
            running--;
            settled++;
            if (settled === total) finish();
            else pump();
          });
        })(id);
      }
    }
    pump();
  }
  // ---- IDB 防抖批量镜像（500ms），页面隐藏/关闭立即落盘 ----
  var _idbQueue = {};
  // 启动恢复完成前的程序性写入暂存：此期间的写入不立即镜像到 IndexedDB，
  // 待恢复对账后仅补写 IndexedDB 中没有真实数据的键——防止启动默认值覆盖 IndexedDB 中的真实数据
  var _preRestorePending = {};
  var _reconciledKeys = {};
  var _idbFlushTimer = null;
  function flushIdbQueue(cb) {
    _idbFlushTimer = null;
    var _fin = function () {
      if (typeof cb === "function") {
        var f = cb;
        cb = null;
        try {
          f();
        } catch (e) {}
      }
    };
    if (window.__akiniWiping) {
      _idbQueue = {};
      _fin();
      return;
    }
    var keys = Object.keys(_idbQueue);
    if (!keys.length) {
      _fin();
      return;
    }
    var IDB = getIDB();
    if (!IDB || !IDB.set) {
      if (typeof cb === "function") {
        _fin();
        return;
      }
      _idbFlushTimer = setTimeout(flushIdbQueue, 500);
      return;
    }
    var batch = _idbQueue;
    _idbQueue = {};
    var _pending = keys.length;
    var _one = function () {
      if (--_pending <= 0) _fin();
    };
    keys.forEach(function (k) {
      /* 只保留主键：旧版每个键还会再写一份 k+'_backup'，等于所有数据双份落库，
         既占空间又让「已用空间」翻倍。主键本身就是权威副本。 */
      if (batch[k] == null) {
        try {
          IDB.remove(k, _one);
        } catch (e) {
          _one();
        }
      } else {
        try {
          /* 传回调：只有事务真正提交完才算完成（导入后等它落盘再刷新） */
          IDB.set(k, batch[k], _one);
        } catch (e) {
          _one();
        }
      }
    });
  }
  function scheduleIdbFlush() {
    if (!_idbFlushTimer) _idbFlushTimer = setTimeout(flushIdbQueue, 500);
  }
  function queueIdbWrite(k, v) {
    if (window.__akiniWiping) return; // 清除数据期间禁止入队
    /* 落到 IDB 的一律是「引用版」：媒体本体单独成键，业务 JSON 保持小体积 */
    if (v != null) v = _externalizeForPersist(k, v);
    _idbQueue[k] = v == null ? null : String(v);
    scheduleIdbFlush();
  }
  try {
    window.__akiniOnHidden(function () { flushIdbQueue(); });
    window.addEventListener("pagehide", flushIdbQueue);
    window.addEventListener("beforeunload", flushIdbQueue);
  } catch (e) {}

  // ---- 对外读写接口 ----
  function akiniGet(k, cb) {
    if (!isCriticalKey(k)) {
      if (cb) cb(lsGet(k));
      return;
    }
    idbGet(k, function (v) {
      if (v != null && v !== "") {
        if (cb) cb(v);
        return;
      }
      if (_isChatKeyName(k)) {
        idbGet(MSGS_PRE + String(k).slice(CHAT_PRE.length), function (raw) {
          var _h = _chatJoin(safeParse(raw, null));
          if (_h && _h.indexOf("msg-row") >= 0) {
            if (cb) cb(_h);
            return;
          }
          if (cb) cb(lsGet(k));
        });
        return;
      }
      if (cb) cb(lsGet(k));
    });
  }
  function akiniGetSync(k) {
    var m = memGet(k);
    if (m !== null) return m;
    return lsGet(k);
  }
  /* ===== 聊天记录：一个会话一个键、一份完整 HTML（对齐 milk/zy） ===== */
  var CHAT_PRE = "akini_chat_history_",
    MSGS_PRE = "akini_chat_msgs_";
  /* 旧版把聊天拆成 MSGS_PRE 数组；仅保留 _chatJoin 供读取旧数据，不再新写数组副本 */
  function _chatJoin(arr) {
    if (!arr || !arr.length) return "";
    var out = "";
    for (var i = 0; i < arr.length; i++) out += (arr[i] && arr[i].h) || "";
    return out;
  }
  function _isChatKeyName(k) {
    return typeof k === "string" && k.indexOf(CHAT_PRE) === 0;
  }
  /* 聊天记录的行数：新模型是 JSON 数组（每项一条消息），旧数据是 HTML 字符串。
     比较“变短”必须按消息条数，不能按字符长度，否则图片外置后会被误判。 */
  function _chatRowsCount(v) {
    if (!v || typeof v !== "string") return 0;
    if (v.charAt(0) === "[") {
      try {
        var a = JSON.parse(v);
        if (Array.isArray(a)) return a.length;
      } catch (e) {}
    }
    return (v.match(/<div[^>]*class="msg-row/g) || []).length;
  }

  function akiniSet(k, v, cb, opts) {
    if (typeof v !== "string") v = String(v);
    /* null/undefined 字面拒写（空串合法，由调用方负责） */
    if (v === "null" || v === "undefined") {
      if (cb) cb(true);
      return;
    }
    /* 聊天记录防「变短覆盖」守卫已移除：所有聊天写入统一走 chat-log 的
       persist（带 opts.authoritative:true），不再有非权威短历史覆盖的可能。
       历史数据的新旧仲裁由恢复对账路径用 _chatRowsCount 负责。 */
    // 图像键写入即盖章（记录修改时间，供恢复路径仲裁新旧）
    if (isImgKey(k) && v && v.length > 10 && v !== "null" && v !== "undefined") {
      try {
        _stampImgKey(k);
      } catch (e0) {}
    }
    /* 非图片用户数据键同样盖章：字卡/收藏/聊天记录等被用户删除后，
       云恢复 _wtsOk 会用本地写入时间戳 lw 与云端 cw 仲裁——lw 更新则拒绝旧值回填。
       跳过高频调度键与 akini_wts_ 自身，避免递归与无谓写入。 */
    if (!isImgKey(k) && k.indexOf("akini_wts_") !== 0 && k.indexOf("akini_") === 0 && !HIGH_FREQ_RE.test(k)) {
      try {
        _stampKey(k);
      } catch (eS1) {}
    }
    /* 删除墓碑：数据被清空时记录本地时刻，供云恢复判断是否拒绝旧值回填。
       仅在启动恢复完成后盖，避免启动默认空值误标为删除。 */
    if (_restored && (v === "[]" || v === "{}" || v === "")) {
      try {
        var _dk = "akini_del_at_" + k;
        if (origSet) origSet.call(rawLS, _dk, String(Date.now()));
        else if (rawLS) rawLS.setItem(_dk, String(Date.now()));
      } catch (eDel) {}
    }
    /* 聊天媒体（akini_media_*）不进内存镜像：媒体模块已有 8MB 缓存，
       这里再存一份等于把每个发过的图片/表情都永久驻留内存（越用越大的根因）。
       读取统一走 __akiniMedia.get（先命中 8MB 缓存，未命中再读 IDB）。 */
    if (k.indexOf("akini_media_") !== 0) memSet(k, v);
    if (k.indexOf("akini_chat_history") === 0 || _MEDIA_KEYS[k]) {
      markDirty(k);
      lsRemoveRaw(k);
      if (k.indexOf("akini_chat_history") === 0) {
        /* 单通道：一个会话 = 一个键 = 一份完整记录（对齐 milk/zy）。
           不再额外拆成 MSGS_PRE 数组副本，避免同一段聊天落两份、写两次。 */
        if (isCriticalKey(k)) {
          if (!_restored) _preRestorePending[k] = v;
          else {
            /* 只入队，交给 500ms 批量落盘（对齐 milk/zy 的去抖保存）。
               以前这里见大值就立即 flush，等于每条消息都同步写一次整段历史，
               聊天越长越卡。 */
            queueIdbWrite(k, v);
          }
        }
        if (cb) cb(true);
        return;
      }
      if (isCriticalKey(k)) {
        if (!_restored) _preRestorePending[k] = v;
        else {
          queueIdbWrite(k, v);
          flushIdbQueue();
        }
      }
      if (cb) cb(true);
      return;
    }
    var lsOk = true;
    if (isBigVal(v)) {
      if (isImgKey(k)) {
        /* 图片全量迁移：不写 localStorage，只进内存镜像 + IndexedDB。
           小图/大图一视同仁，LS 配额全部留给文字/名字/设置。 */
        lsRemoveRaw(k);
      } else if (_isEssentialTextKey(k)) {
        var _txtLsOk = false;
        if (v.length <= 900 * 1024) {
          try {
            _txtLsOk = lsSet(k, v);
          } catch (eT) {}
        }
        if (_txtLsOk) {
          clearDirty(k);
        } else {
          markDirty(k);
          /* 写入失败时保留 LS 里的旧值作为兜底；只有"体积超限没尝试写"才清掉旧值防陈旧覆盖 */
          if (v.length > 900 * 1024) lsRemoveRaw(k);
        }
      } else {
        markDirty(k);
        lsRemoveRaw(k);
      }
    } else {
      /* 小图同样不写 localStorage：图片的唯一权威副本是内存 + IndexedDB */
      if (isImgKey(k)) {
        lsRemoveRaw(k);
        lsOk = true;
      } else {
        lsOk = lsSet(k, v);
      }
      if (lsOk) clearDirty(k);
      else markDirty(k);
    }
    if (isCriticalKey(k)) {
      if (!_restored) {
        _preRestorePending[k] = v;
      } else {
        queueIdbWrite(k, v);
        /* 大体积关键文本（含图动态/日记/邮件）立即落 IDB，不等 500ms 防抖，防止退出丢数据 */
        if (isImgKey(k) || v.length > 200 * 1024) flushIdbQueue();
      }
    }
    // localStorage 写失败（配额满等）时立即落盘 IDB，不等 500ms 防抖，防退出丢数据
    if (!lsOk && _restored) flushIdbQueue();
    if (
      k === "akini_my_avatar" ||
      k === "akini_ta_avatar" ||
      k === "akini_icity_my_avatar" ||
      k === "akini_icity_ta_avatar" ||
      k === "akini_avatar_left" ||
      k === "akini_avatar_right" ||
      k === "akini_s1_avatar" ||
      (typeof k === "string" && k.indexOf("akini_contact_avatar_") === 0)
    ) {
      try {
        window.dispatchEvent(new Event("akini-avatar-changed"));
      } catch (eAv) {}
    }
    if (cb) cb(true || lsOk);
  }
  function akiniRemove(k, cb) {
    memRemove(k);
    if (_isChatKeyName(k)) {
      var _msk = MSGS_PRE + String(k).slice(CHAT_PRE.length);
      try {
        queueIdbWrite(_msk, null);
        var _IDBr = getIDB();
        if (_IDBr && _IDBr.remove) _IDBr.remove(_msk);
      } catch (eRm) {}
    }
    lsRemoveRaw(k);
    lsRemoveRaw(k + "_backup");
    if (isCriticalKey(k)) {
      if (!_restored) {
        _preRestorePending[k] = null;
      } else queueIdbWrite(k, null);
    }
    var IDB = getIDB();
    if (IDB && IDB.remove) {
      try {
        IDB.remove(k);
        IDB.remove(k + "_backup");
      } catch (e) {}
    }
    if (cb) cb(true);
  }
  function akiniGetJson(k, cb, fb) {
    akiniGet(k, function (v) {
      var r = safeParse(v, fb);
      if (typeof cb === "function") cb(r);
    });
  }
  function akiniSetJson(k, v, cb) {
    var s = safeStringify(v);
    if (s == null) {
      if (cb) cb(false);
      return;
    }
    akiniSet(k, s, cb);
  }

  // ---- 启动全量对账恢复（standard 一致 OOM 防线）：分批流式 + 大键驻留预算 ----
  // 背景：几十 MB 的图片/字卡键一次性全量读入内存会把 JS 堆推到渲染进程上限直接崩溃
  //（Chrome "喔唷崩溃啦"），低端安卓机尤其明显。防两条：
  //  ② 大键驻留预算：>200KB 的键驻留总量 ≤4GB 设备 12MB / 其他 24MB，超预算的键
  //     不驻留内存（记入 __akiniDeferredKeys），读取时按需从 IDB 异步水合。
  var _restored = false;
  var _restoring = false;
  /* 仅低内存设备（deviceMemory<=1）收紧预算 */
  var _bootTight = false;
  try {
    if (window.__akiniLowMem) _bootTight = true;
  } catch (eC3) {}
  /* 连续闪退触发的轻量模式：进一步压低图片驻留预算，把内存让给首屏 */
  var _safeBoot = false;
  try {
    _safeBoot =
      !!window.__AKINI_SAFE_MODE ||
      !!window.__AKINI_STANDALONE ||
      (document.documentElement && document.documentElement.classList.contains("akini-safe-mode"));
  } catch (eSB) {}
  var BIG_MEM_BUDGET = _safeBoot
    ? 4 * 1024 * 1024
    : _bootTight
      ? 8 * 1024 * 1024
      : ((typeof navigator !== "undefined" && navigator.deviceMemory) || 4) <= 4
        ? 12 * 1024 * 1024
        : 24 * 1024 * 1024;
  /* 启动对账批大小与间隔 */
  var _BOOT_BATCH = 24;
  var _BOOT_BATCH_DELAY = 10;
  var _bigMemUsed = 0;
  if (!window.__akiniDeferredKeys) window.__akiniDeferredKeys = {};
  /* 恢复完成后的轻量对账：仅回填"内存为空且 IDB 非空"的键 */
  function _reconcileAfterRestored() {
    try {
      var IDB = getIDB();
      if (!IDB || !IDB.keys) return;
      IDB.keys(function (keys) {
        if (!Array.isArray(keys)) return;
        var targets = keys.filter(function (k) {
          var ks = String(k || "");
          return k && ks.indexOf("akini_") === 0 && ks.indexOf("_backup") < 0 && !HIGH_FREQ_RE.test(ks);
        });
        targets.forEach(function (k) {
          /* 按条数组副本只用于重建聊天 HTML，不单独占内存 */
          if (String(k).indexOf(MSGS_PRE) === 0) return;
          var cur = memGet(k);
          if (cur == null || cur === "") {
            /* 页面级数据且 LS 有可直读的真实值：不占内存，按需水合 */
            if (_isDeferTextKey(k) && _lsCanServe(k)) {
              window.__akiniDeferredKeys[k] = 1;
              return;
            }
            idbGet(k, function (v) {
              if (v != null && v !== "" && v !== "[]" && v !== "{}" && v !== "null") {
                /* 大图片不驻留内存（读取时按需从 IDB 水合），避免回前台时几百张图一次性灌进堆里造成卡顿/闪退；
                   文本类数据必须驻留 —— 否则朋友圈/日记/邮件的首帧会是空的，看着就像“数据丢了”。 */
                if (isImgKey(k) && typeof v === "string" && v.length > 1024 * 1024) {
                  window.__akiniDeferredKeys[k] = 1;
                  return;
                }
                if (isImgKey(k) && typeof v === "string") {
                  if (_bigMemUsed + v.length > BIG_MEM_BUDGET) {
                    window.__akiniDeferredKeys[k] = 1;
                    return;
                  }
                  _bigMemUsed += v.length;
                }
                memSet(k, v);
              }
            });
          }
        });
      });
    } catch (e) {}
  }
  /* 启动默认值/空壳判定：LS 里只剩默认数据、而 IDB 里有真实数据时，必须信 IDB。
     否则全量对账会把 IDB 的真实联系人/名字用启动默认值覆盖（就是“数据消失”）。 */
  var _BOOT_DEFAULT_VALS = {
    akini_my_name: ["我", ""],
    akini_ta_name: ["梦角", "对方", "TA", ""],
    akini_my_status: ["在线", ""],
    akini_ta_status: ["在线", ""],
    akini_signature: [""],
    akini_friends_signature: [""],
  };
  function _isShellValStorage(k, v) {
    if (!_isRealVal(v)) return true;
    var s = String(v);
    if (s === "[]" || s === "{}") return true;
    if (_BOOT_DEFAULT_VALS[k] && _BOOT_DEFAULT_VALS[k].indexOf(s) >= 0) return true;
    try {
      if (k === "akini_contacts") {
        var a = JSON.parse(s);
        if (!Array.isArray(a) || !a.length) return true;
        var real = a.filter(function (c) {
          return c && c.id !== "ta_default" && String(c.name || "") !== "对方";
        });
        return !real.length;
      }
      if (
        k === "akini_groups" ||
        k === "akini_sessions" ||
        k === "akini_chat_sessions" ||
        k === "akini_chat_pins" ||
        k === "akini_home_avatars"
      ) {
        var o = JSON.parse(s);
        if (Array.isArray(o)) return !o.length;
        return !o || !Object.keys(o).length;
      }
    } catch (e) {}
    return false;
  }
  function restoreAll() {
    /* 已恢复过则只做轻量对账；首次执行全量对账 */
    if (_restored) {
      _reconcileAfterRestored();
      return;
    }
    if (_restoring) return; // 防止 setTimeout 与轮询同时触发两次全量对账
    _restoring = true;
    var IDB = getIDB();
    if (!IDB || !IDB.keys) {
      _restoring = false;
      return;
    }
    try {
      IDB.keys(function (keys) {
        if (!Array.isArray(keys)) {
          _restoring = false;
          return;
        }
        var targets = keys.filter(function (k) {
          var ks = String(k || "");
          return k && ks.indexOf("akini_") === 0 && ks.indexOf("_backup") < 0 && !HIGH_FREQ_RE.test(ks);
        });
        var i = 0;
        var _chatArrIds = {};
        targets.forEach(function (k) {
          var _ksc = String(k);
          if (_ksc.indexOf(MSGS_PRE) === 0) _chatArrIds[_ksc.slice(MSGS_PRE.length)] = 1;
        });
        /* 文本/设置/聊天先恢复，图片（几十 MB dataURL）延后到空闲时段水合。
           旧代码把图片和文本混在同一批里恢复：首屏渲染被几十 MB 图片的反序列化
           抢占主线程，安卓切后台被系统重载后重进就是几秒白屏甚至直接卡崩。 */
        var textTargets = [],
          imgTargets = [];
        /* 关键图片（头像/壁纸/聊天背景等）提前到文本批次一起恢复：
           图片全量迁出 LS 后，启动同步读只能命中内存。若关键图仍延后 1.2s 水合，
           首屏头像/背景会先空白再闪回。把它们放进 textTargets，保证 __akiniStorageRestored
           触发（App 启动门闩）前关键图已在内存，首屏即正确渲染。
           非关键图（表情包/媒体/收藏等）仍延后空闲水合，避免抢占首屏主线程。 */
        targets.forEach(function (k) {
          var _ksf = String(k);
          if (_ksf.indexOf(MSGS_PRE) === 0) {
            textTargets.push(k);
            return;
          }
          if (isImgKey(k) && (!_isEssentialImgKey(k) || (_safeBoot && _deferImgInLite(k)))) imgTargets.push(k);
          else textTargets.push(k);
        });
        var _imgRestoreStarted = false;
        /* 图片空闲水合：只进内存（受预算）+ 清 LS 残留，不参与对账仲裁 */
        function restoreImagesIdle() {
          var j = 0;
          (function step() {
            if (j >= imgTargets.length) return;
            var ibatch = imgTargets.slice(j, j + 2);
            j += 2;
            ibatch.forEach(function (k) {
              idbGet(k, function (v) {
                try {
                  if (v == null || v === "" || v === "null") return;
                  _reconciledKeys[k] = 1;
                  var cur = memGet(k);
                  if (typeof cur === "string" && typeof v === "string" && cur.length > v.length) return;
                  if (typeof v === "string" && _bigMemUsed + v.length <= BIG_MEM_BUDGET) {
                    memSet(k, v);
                    _bigMemUsed += v.length;
                  } else window.__akiniDeferredKeys[k] = 1;
                  lsRemoveRaw(k);
                } catch (eI) {}
              });
            });
            setTimeout(step, 200);
          })();
        }
        (function nextBatch() {
          if (i >= textTargets.length) {
            _restoring = false;
            if (!_restored) {
              _restored = true;
              // 对外暴露"启动对账已完成"门闩——云备份等恢复层据此判断大键是否真的缺失
              
window.__akiniStorageRestored = true;

              
window.__akiniRestoreSettled = true;
 // 启动对账完成，放行 __akiniBootApp（防默认值抢跑挡住真实数据恢复）
              // 通知恢复层：IDB → LS 回填已完成，可以重新把图片/文字上屏了
              try {
                window.dispatchEvent(new Event("akini-storage-restored"));
              } catch (eEv) {}
              // 启动期暂缓的写入落盘：强制写回 IndexedDB，确保用户数据落盘
              // 启动默认空值写回 IDB 覆盖真实数据（数据丢失双保险之二）
              try {
                Object.keys(_preRestorePending).forEach(function (k) {
                  var pv = _preRestorePending[k];
                  /* 空值不落盘：防止启动默认空值覆盖 IDB 真实数据 */
                  if (pv != null && pv !== "" && pv !== "[]" && pv !== "{}" && pv !== "null") {
                    /* 聊天记录特判：启动早期用户先发了消息时，W/内存还是空的，
                       pending 里只有「新消息」这一小段；此时对账已经从 IDB 取回了全量历史，
                       若把这段短值写回 IDB，整段聊天记录就被覆盖没了（表现就是"有时候消失"）。
                       内存里已有更完整的历史时，直接丢弃这条过短的 pending。 */
                    if (String(k).indexOf("akini_chat_history_") === 0) {
                      var _cm = memGet(k);
                      if (typeof _cm === "string" && _chatRowsCount(_cm) > _chatRowsCount(pv)) return;
                    }
                    queueIdbWrite(k, pv);
                  }
                });
              } catch (e) {}
              _preRestorePending = {};
              try {
                window.__akiniOnCriticalRestored();
              } catch (e) {}
              try {
                window.loadS1SavedData();
              } catch (eLS) {}
              console.log(
                "[存储] 启动恢复完成，共同步",
                textTargets.length,
                "个键，大键驻留",
                Math.round(_bigMemUsed / 1024),
                "KB",
              );
              /* 图片放到首屏渲染之后慢慢来，不阻塞任何门闩 */
              if (!_imgRestoreStarted && imgTargets.length) {
                _imgRestoreStarted = true;
                if (_safeBoot) {
                  /* 轻量模式：非关键图片一律不预载入内存，等真正用到时再从 IDB 按需水合，
                     避免几十 MB dataURL 在冷启动阶段把 iOS WebContent 进程撑爆 */
                  imgTargets.forEach(function (k) {
                    window.__akiniDeferredKeys[k] = 1;
                  });
                } else {
                  setTimeout(function () {
                    try {
                      restoreImagesIdle();
                    } catch (eImg) {}
                  }, 1200);
                }
              }
            }
            return;
          }
          var batch = textTargets.slice(i, i + _BOOT_BATCH);
          i += _BOOT_BATCH;
          var pending = batch.length;
          batch.forEach(function (k) {
            if (_isDeferTextKey(k) && _lsCanServe(k)) {
              _reconciledKeys[k] = 1;
              window.__akiniDeferredKeys[k] = 1;
              if (--pending <= 0) setTimeout(nextBatch, _BOOT_BATCH_DELAY);
              return;
            }
            idbGet(k, function (v) {
              try {
                var _ks0 = String(k);
                if (_ks0.indexOf(MSGS_PRE) === 0) {
                  var _html0 = _chatJoin(safeParse(v, null));
                  if (_html0 && _html0.indexOf("msg-row") >= 0) {
                    var _ck0 = CHAT_PRE + _ks0.slice(MSGS_PRE.length);
                    _reconciledKeys[_ck0] = 1;
                    memSet(_ck0, _html0);
                  }
                  if (--pending <= 0) setTimeout(nextBatch, _BOOT_BATCH_DELAY);
                  return;
                }
                // 真实持久化数据优先，启动期程序性默认值不覆盖
                // 聊天记录例外：启动期用户刚发的消息也要保留，留给上面的合并步骤处理
                try {
                  if (
                    _preRestorePending &&
                    Object.prototype.hasOwnProperty.call(_preRestorePending, k) &&
                    String(k).indexOf("akini_chat_history_") !== 0
                  )
                    delete _preRestorePending[k];
                } catch (e2) {}
                if (v == null || v === "") {
                  // 无真实数据：跳过，不回填任何值（必须先递减批次计数，否则恢复流程永久卡住）
                  if (--pending <= 0) setTimeout(nextBatch, _BOOT_BATCH_DELAY);
                  return;
                }
                _reconciledKeys[k] = 1;
                var _idbEmpty = v === "[]" || v === "{}" || v === "null";
                var ls = lsGet(k);
                /* LS 写入失败过的键（配额满等）以 IDB 为准：LS 里可能只是残留旧值，
                   否则会用旧值覆盖 IDB 里更新的真实数据。
                   另外 LS 只剩启动默认值（默认联系人/默认名字/空分组）而 IDB 有真实数据时，
                   同样以 IDB 为准，否则真实数据会被默认值覆盖掉。 */
                var _lsRealVal = _isRealVal(ls);
                var _lsShell = _lsRealVal && _isShellValStorage(k, ls) && _isRealVal(v) && !_isShellValStorage(k, v);
                var _lsDirtyHit = !!_lsDirty[k] || _lsShell;
                var _lsReal = !_lsDirtyHit && _lsRealVal && ls !== "[]" && ls !== "{}" && ls !== "null";
                // 【安卓/鸿蒙/iOS加固】空语义 IDB 值视为陈旧，若 LS 存有数据（哪怕只是默认值）则信 LS
                if (_idbEmpty && _lsRealVal) {
                  memSet(k, ls);
                  queueIdbWrite(k, ls);
                  if (--pending === 0) setTimeout(nextBatch, _BOOT_BATCH_DELAY);
                  return;
                }
                var big = isBigVal(v);
                // 真实有效数据的取舍：LS 有非空真实值 → 信 LS（最高权威）；否则信 IDB
                var _ks2 = String(k);
                var _isCritKey =
                  _ks2.indexOf("akini_chat_history_") === 0 ||
                  /* 字卡库/分组/问卷等关键文本必须常驻内存：一旦被「大键预算」判为可延迟，
                     同步读（__wbRead → memoryGet → localStorage）两层都拿不到值，
                     字卡库就会随机显示为空，看起来就是"内容莫名其妙消失"。 */
                  _isEssentialTextKey(_ks2) ||
                  /* 朋友圈/iCity 是用户的核心内容：绝不能被内存预算判为「大键」而跳过驻留，
                     否则界面同步读到空 → 看起来"帖子凭空消失"（媒体已经外置，体积可控） */
                  _ks2.indexOf("akini_posts") === 0 ||
                  _ks2.indexOf("akini_icity_diaries") === 0 ||
                  _ks2.indexOf("akini_my_avatar") === 0 ||
                  _ks2.indexOf("akini_ta_avatar") === 0 ||
                  _ks2.indexOf("akini_icity_my_avatar") === 0 ||
                  _ks2.indexOf("akini_icity_ta_avatar") === 0 ||
                  _ks2.indexOf("akini_s1_avatar") === 0 ||
                  _ks2.indexOf("akini_home_bg") === 0 ||
                  _ks2.indexOf("akini_bg") === 0 ||
                  _ks2.indexOf("akini_cover_img") === 0 ||
                  _ks2.indexOf("akini_cover_bg") === 0 ||
                  _ks2.indexOf("akini_s1_photo") === 0 ||
                  _ks2.indexOf("akini_s1_cover") === 0 ||
                  _ks2.indexOf("akini_music_bg") === 0 ||
                  _ks2.indexOf("akini_friends_bg") === 0;
                var _isChatKey = _ks2.indexOf("akini_chat_history_") === 0;
                var _ref = _lsReal ? ls : v;
                if (_isChatKey && typeof v === "string" && (!_lsReal || _chatRowsCount(v) > _chatRowsCount(ls))) _ref = v;
                /* 内存里可能已有「启动快照」回填的更完整聊天记录：优先保留，并写回 IDB */
                var _memChatWins = false;
                if (_isChatKey) {
                  var _mc = memGet(k);
                  if (typeof _mc === "string" && _chatRowsCount(_mc) > _chatRowsCount(_ref)) {
                    _ref = _mc;
                    _memChatWins = true;
                  }
                }
                var _refLen = _ref.length;
                /* 聊天媒体只在打开对应页面/聊天时按需从 IDB 水合，
                   不在冷启动时把整份媒体库塞进内存镜像（与 __akiniMedia 缓存重复）。 */
                var _isMediaKey = _ks2.indexOf("akini_media_") === 0;
                if (_isMediaKey || (!_isCritKey && big && (_refLen > 4194304 || _bigMemUsed + _refLen > BIG_MEM_BUDGET))) {
                  window.__akiniDeferredKeys[k] = 1; // 超预算：不驻留，按需水合
                } else {
                  memSet(k, _ref);
                  if (big && !_isCritKey) _bigMemUsed += _refLen;
                }
                if (_memChatWins) {
                  queueIdbWrite(k, _ref); // 更完整的聊天记录写回 IDB
                } else if (_lsReal) {
                  if (isImgKey(k)) {
                    /* 原生 模型：图片只在 IndexedDB，LS 里的残留副本一律清掉；
                       IDB 有真实值时以 IDB 为准，绝不拿 LS 残值覆盖 */
                    lsRemoveRaw(k);
                    if (_idbEmpty) queueIdbWrite(k, ls);
                  } else if (_isChatKey || _MEDIA_KEYS[_ks2]) {
                    if (_isChatKey ? _chatRowsCount(ls) > _chatRowsCount(v) : ls.length > v.length) {
                      queueIdbWrite(k, ls);
                    } else lsRemoveRaw(k);
                  } else if (ls !== v) {
                    queueIdbWrite(k, ls);
                  }
                } else if (big) {
                  /* 关键配置/图片在 LS 里为空时写回：否则下次启动的同步读取会拿到空值，
                     首页背景/聊天背景/联系人等被渲染成默认，看起来就是"被重置" */
                  if (_isChatKey || _MEDIA_KEYS[_ks2]) {
                    queueIdbWrite(k, v);
                    clearDirty(k);
                  } else if (_isEssentialImgKey(k) || _isEssentialTextKey(k) || _keepInLs(k)) {
                    var _lsFull = _lsTotalLen() > 3600 * 1024;
                    /* 原生 模型对齐：图片一律不回填 localStorage（只进内存 + IndexedDB），
                       LS 配额全部留给文字/名字/设置/聊天记录。 */
                    var _imgBudgetFull = false;
                    if (isImgKey(k)) {
                      _imgBudgetFull = true;
                    }
                    if (_imgBudgetFull) {
                      queueIdbWrite(k, v);
                      clearDirty(k);
                    } else if (!lsSet(k, v)) markDirty(k);
                    else clearDirty(k);
                  } else {
                    lsRemoveRaw(k);
                    clearDirty(k);
                  }
                } else if (isImgKey(k)) {
                  /* 小图同样不写 LS：图片的唯一副本就是内存 + IndexedDB */
                  queueIdbWrite(k, v);
                  clearDirty(k);
                } else {
                  if (lsSet(k, v)) clearDirty(k);
                  else markDirty(k);
                }
              } catch (e) {}
              if (--pending <= 0) setTimeout(nextBatch, _BOOT_BATCH_DELAY);
            });
          });
        })();
      });
    } catch (e) {
      _restoring = false;
    }
  }
  function restoreCriticalFromIdb() {
    restoreAll();
  }
  function restoreChatHistoryFromIdb() {
    restoreAll();
  }

  window.akiniStore = {
    _queueIdbWrite: queueIdbWrite,
    flushIdb: flushIdbQueue,
    get: akiniGet,
    getSync: akiniGetSync,
    set: akiniSet,
    remove: akiniRemove,
    getJson: akiniGetJson,
    setJson: akiniSetJson,
    isCritical: isCriticalKey,
    restoreCriticalFromIdb: restoreCriticalFromIdb,
    restoreChatHistoryFromIdb: restoreChatHistoryFromIdb,
    memoryGet: memGet,
    memorySet: memSet,
    memoryRemove: memRemove,
    memoryKeys: function () {
      return Object.keys(memoryCache);
    },
    // 直写通道：绕过拦截层的原始 LS 写（配额满返回 false），供聊天记录切后台热备使用
    rawLSSet: function (k, v) {
      try {
        if (origSet) origSet.call(rawLS, k, v);
        else rawLS.setItem(k, v);
        return true;
      } catch (e) {
        return false;
      }
    },
    /* 原始 LS 读（绕过内存镜像），供邮箱等需要权威读的模块使用 */
    rawLSGet: function (k) {
      try {
        return origGet ? origGet.call(rawLS, k) : rawLS.getItem(k);
      } catch (e) {
        return null;
      }
    },
    // 清除数据专用：清空内存镜像 + IDB 待写队列 + 启动前暂存 + 脏键集合，
    // 防止清除后内存/队列里的旧数据在刷新前的间隙被重新落盘
    wipeMemory: function () {
      
memoryCache = {};

      
_idbQueue = {};

      
_preRestorePending = {};

      
_reconciledKeys = {};

      try {
        _lsDirty = {};
        lsDirtySave();
      } catch (e) {}
      try {
        if (_idbFlushTimer) {
          clearTimeout(_idbFlushTimer);
          _idbFlushTimer = null;
        }
      } catch (e) {}
    },
  };
  // 图像键时间戳仲裁接口（供云备份/保险箱/IDB 兜底等恢复路径使用）
  window.__akiniImgWts = { isImg: isImgKey, local: _localImgWts, stamp: _stampImgKey };

  // ---- 拦截 localStorage 写入：先原始写入（绝不被中断），再镜像内存+IDB ----
  // 注意：origSet 为空说明 localStorage 是内存 shim（隐私模式/被禁用），其原型是 Object.prototype，
  // 绝不能往 Object.prototype 上挂 setItem/getItem/removeItem，否则污染所有对象——此时走 shim 包装分支
  try {
    var lsProto = Object.getPrototypeOf(rawLS);
    if (lsProto && rawLS && typeof origSet === "function") {
      var self = {
        memGet: memGet,
        memSet: memSet,
        memRemove: memRemove,
        queueIdbWrite: queueIdbWrite,
        isCritical: isCriticalKey,
        origSet: origSet,
        origGet: origGet,
        origRemove: origRemove,
        isBigVal: isBigVal,
        markDirty: markDirty,
        clearDirty: clearDirty,
      };
      // standard 一致③：读取拦截——内存缓存优先（大键只存在内存/IDB，直接读 LS 会拿到空）
      lsProto.getItem = function (k) {
        try {
          if (self.isCritical(k)) {
            var m = self.memGet(k);
            if (m !== null && m !== "") return m;
            // 超预算大键未驻留内存：触发异步水合，本次先返回 LS 值，水合完成后下次读取即得
            if (window.__akiniDeferredKeys && window.__akiniDeferredKeys[k]) {
              delete window.__akiniDeferredKeys[k];
              idbGet(k, function (v) {
                if (v != null && v !== "") memSet(k, v);
              });
            }
            var raw = self.origGet ? self.origGet.call(this, k) : null;
            if (raw != null && raw !== "") return raw;
            // 内存和 LS 都空：触发异步 IDB 水合（Safari 后台 GC 清 LS 后唯一救回机会）
            // 最多每个键 30s 水合一次，避免高频读取打爆 IDB
            try {
              var _nowHyd = Date.now();
              if (!window.__akiniIdbHydrateGaps) window.__akiniIdbHydrateGaps = {};
              if (!window.__akiniIdbHydrateGaps[k] || _nowHyd - window.__akiniIdbHydrateGaps[k] > 30000) {
                window.__akiniIdbHydrateGaps[k] = _nowHyd;
                idbGet(k, function (_v) {
                  if (_v != null && _v !== "" && _v !== "[]" && _v !== "{}" && _v !== "null") {
                    memSet(k, _v);
                    // 同步回 LS，让后续同步读取也能拿到（配额满会被拦截，已由 setItem 守卫处理）
                    try {
                      self.origSet && self.origSet.call(rawLS, k, _v);
                    } catch (eHyd) {}
                  }
                });
              }
            } catch (eHyd2) {}
            return null;
          }
          return self.origGet ? self.origGet.call(this, k) : null;
        } catch (e) {
          return null;
        }
      };
      lsProto.setItem = function (k, v) {
        // 清除数据期间：akini_ 键一律拒写（含原始 LS 层），杜绝清完复活
        if (window.__akiniWiping && k && String(k).indexOf("akini_") === 0) return;
        var sv = String(v);
        /* null/undefined 与字面 "null"/"undefined" 一律拒写（空串合法） */
        if (
          k &&
          String(k).indexOf("akini_") === 0 &&
          (v === null || v === undefined || sv === "null" || sv === "undefined")
        )
          return;
        if (k && (String(k).indexOf("akini_chat_history") === 0 || _MEDIA_KEYS[k])) {
          memSet(k, sv);
          markDirty(k);
          try {
            origRemove.call(rawLS, k);
          } catch (eC0) {}
          if (_restored) {
            queueIdbWrite(k, sv);
            if (sv.length > 200 * 1024) flushIdbQueue();
          } else {
            _preRestorePending[k] = sv;
          }
          return;
        }
        var big = self.isCritical(k) && self.isBigVal(sv);
        var ok = true;
        if (isImgKey(k)) {
          try {
            self.origRemove.call(this, k);
          } catch (e) {}
        } else if (_isEssentialTextKey(k) || _keepInLs(k)) {
          /* 关键配置必须留在 LS：只在内存/IDB 的话，下次启动同步读拿到空值，
             联系人名会渲染成默认，联系人键还会触发启动补建默认联系人。 */
          try {
            self.origSet.call(this, k, v);
          } catch (e) {
            try {
              var _evK = _evictBigKeys(false);
              if (!_evK) _evK = _evictBigKeys(true);
              if (_evK > 0) {
                self.origSet.call(this, k, v);
                ok = true;
              } else {
                ok = false;
              }
            } catch (e3) {
              ok = false;
            }
          }
        } else if (big) {
          /* 超大媒体键只进内存缓存与 IndexedDB，不写入 localStorage */
          try {
            self.origRemove.call(this, k);
          } catch (e) {}
        } else {
          try {
            self.origSet.call(this, k, v);
          } catch (e) {
            // 配额满：清理大体积图片键后重试，避免关键数据静默丢失
            try {
              var _ev2 = _evictBigKeys(false);
              if (!_ev2) _ev2 = _evictBigKeys(true);
              if (_ev2 > 0) {
                self.origSet.call(this, k, v);
                ok = true;
              } else {
                ok = false;
              }
            } catch (e2) {
              ok = false;
            }
          }
        }
        if (isImgKey(k)) _lsImgUsed = -1;
        // 2) 镜像层失败无所谓，绝不影响数据本体
        try {
          if (self.isCritical(k)) {
            self.memSet(k, sv);
            // 图像键写入即盖章（拦截层覆盖所有 localStorage.setItem 调用路径）
            if (isImgKey(k) && sv && sv.length > 10 && sv !== "null" && sv !== "undefined") {
              try {
                _stampImgKey(k);
              } catch (e9) {}
            }
            if (!_restored) {
              _preRestorePending[k] = sv;
            } else {
              self.queueIdbWrite(k, sv);
              if (big && isImgKey(k)) flushIdbQueue();
            }
            if (ok || big) {
              self.clearDirty(k);
            } else {
              self.markDirty(k);
              if (_restored) flushIdbQueue();
            }
          }
        } catch (e) {}
      };
      if (typeof lsProto.clear === "function") {
        var _origClear = lsProto.clear;
        lsProto.clear = function () {
          // 显式清除（_akiniAllowRemove 或 __akiniWiping）：真正清空，不保留回写
          if (window._akiniAllowRemove || window.__akiniWiping) {
            try {
              _origClear.call(this);
            } catch (e) {}
            try {
              if (window.akiniStore && window.akiniStore.wipeMemory) window.akiniStore.wipeMemory();
            } catch (e) {}
            return;
          }
          // 非显式清除：备份关键键，清空后回写，防止误清导致数据丢失
          var backup = {};
          try {
            for (var ci = 0; ci < localStorage.length; ci++) {
              var ck = localStorage.key(ci);
              if (ck && self.isCritical(ck)) backup[ck] = localStorage.getItem(ck);
            }
          } catch (e) {}
          try {
            _origClear.call(this);
          } catch (e) {}
          var saved = 0;
          for (var bk in backup) {
            if (!Object.prototype.hasOwnProperty.call(backup, bk)) continue;
            try {
              localStorage.setItem(bk, backup[bk]);
              saved++;
            } catch (e) {}
          }
          console.log("[AkiniPersist] 拦截 localStorage.clear，已保留", saved, "条关键数据");
        };
      }
      lsProto.removeItem = function (k) {
        // 关键数据删除拦截：非显式清除操作下不允许删除 akini_ 关键键
        if (self.isCritical(k) && !window._akiniAllowRemove && !window.__akiniWiping) {
          console.warn("[AkiniPersist] 拦截删除关键数据", k);
          return;
        }
        try {
          self.origRemove.call(this, k);
        } catch (e) {}
        try {
          if (self.isCritical(k)) {
            self.memRemove(k);
            if (!_restored) {
              _preRestorePending[k] = null;
            } else {
              self.queueIdbWrite(k, null);
            }
          }
        } catch (e) {}
      };
    }
  } catch (e) {
    console.warn("[存储] localStorage 拦截安装失败（不影响读写）", e);
  }

  try {
    if (rawLS && typeof rawLS.removeItem === "function") {
      var _instOrigRm = rawLS.removeItem;
      rawLS.removeItem = function (k) {
        if (k && String(k).indexOf("akini_") === 0 && !window._akiniAllowRemove && !window.__akiniWiping) {
          return;
        }
        try {
          _instOrigRm.call(this, k);
        } catch (e) {}
      };
    }
  } catch (e) {}

  // ---- localStorage 被禁用（隐私模式/部分内置浏览器）时的兜底 ----
  // shim 是带自有方法的普通对象，原型拦截装不上；直接包装其自有方法，
  // 让关键写入仍镜像到 内存缓存 + IndexedDB，重开后可从 IndexedDB 完整恢复
  try {
    if (
      window.__akiniLocalStorageBlocked &&
      rawLS &&
      typeof rawLS.setItem === "function" &&
      typeof origSet !== "function"
    ) {
      var _shimSet = rawLS.setItem,
        _shimGet = rawLS.getItem,
        _shimRemove = rawLS.removeItem;
      rawLS.setItem = function (k, v) {
        var sv = String(v);
        /* null 值/字面 "null"/"undefined" 脏值对 akini_ 键一律拒写（同主拦截层） */
        if (
          k &&
          String(k).indexOf("akini_") === 0 &&
          (v === null || v === undefined || sv === "null" || sv === "undefined")
        )
          return;
        try {
          _shimSet.call(rawLS, k, sv);
        } catch (e) {}
        try {
          if (isCriticalKey(k)) {
            memSet(k, sv);
            // 图像键写入即盖章（shim 分支同主拦截层）
            if (isImgKey(k) && sv && sv.length > 10 && sv !== "null" && sv !== "undefined") {
              try {
                _stampImgKey(k);
              } catch (e8) {}
            }
            if (!_restored) {
              _preRestorePending[k] = sv;
            } else queueIdbWrite(k, sv);
          }
        } catch (e) {}
      };
      rawLS.getItem = function (k) {
        try {
          if (isCriticalKey(k)) {
            var m = memGet(k);
            if (m !== null && m !== "") return m;
            if (window.__akiniDeferredKeys && window.__akiniDeferredKeys[k]) {
              delete window.__akiniDeferredKeys[k];
              idbGet(k, function (v) {
                if (v != null && v !== "") memSet(k, v);
              });
            }
            var raw = _shimGet.call(rawLS, k);
            if (raw != null && raw !== "") return raw;
            return null;
          }
        } catch (e) {}
        try {
          return _shimGet.call(rawLS, k);
        } catch (e) {
          return null;
        }
      };
      rawLS.removeItem = function (k) {
        if (isCriticalKey(k) && !window._akiniAllowRemove && !window.__akiniWiping) {
          console.warn("[AkiniPersist] 拦截删除关键数据", k);
          return;
        }
        try {
          _shimRemove.call(rawLS, k);
        } catch (e) {}
        try {
          if (isCriticalKey(k)) {
            memRemove(k);
            if (!_restored) {
              _preRestorePending[k] = null;
            } else queueIdbWrite(k, null);
          }
        } catch (e) {}
      };
      console.log("[存储] localStorage 被禁用，已包装内存 shim（数据经 IndexedDB 持久化）");
    }
  } catch (e) {}

  // ---- 申请持久化存储，彻底消除系统静默清理（启动立即申请 + 首次交互手势加权申请）----
  function requestPersistentStorage() {
    try {
      if (navigator.storage && navigator.storage.persist) {
        var _p = navigator.storage.persist();
        if (_p && typeof _p.then === "function") {
          _p.then(function (granted) {
            console.log("[存储] 持久化存储授权:", granted ? "已获准(免清空)" : "未获准(使用多层镜像兜底)");
          }).catch(function () {});
        }
      }
    } catch (e) {}
  }
  requestPersistentStorage();
  // 现代移动端(Safari/Chrome)手势授权：首次点击/触摸时再次调用以极大提高获准率
  var _persistGestureHandler = function () {
    requestPersistentStorage();
    document.removeEventListener("click", _persistGestureHandler, true);
    document.removeEventListener("touchend", _persistGestureHandler, true);
  };
  document.addEventListener("click", _persistGestureHandler, true);
  document.addEventListener("touchend", _persistGestureHandler, true);

  // ---- 启动恢复：等 _idbStore 就绪后全量对账 ----
  /* 启动第一时间把大图迁到内存+IDB 并把 LS 图片总量压到 1.4MB（此时所有状态变量已就绪） */
  try {
    migrateLsBigMediaToIdb();
  } catch (eMigInit) {}
  /* 启动期有其它模块（core 的图片写入/背景应用）会把图重新写回 LS 把配额占满，
     启动后补做一次同样的瘦身即可。旧代码在 2s/6s/15s 各跑一遍全量扫描，
     等于启动阶段反复做三次全量 IO —— 是"切后台重进就卡崩"的直接原因，已改为单次。 */
  setTimeout(function () {
    try {
      migrateLsBigMediaToIdb();
    } catch (eRe) {}
  }, 2000);
  /* 启动第一时间瘦身 localStorage（清冗余媒体备份 + 超大残留），缓解配额爆满导致的写入失败与闪退 */
  try {
    startupSlim();
  } catch (eS) {}
  // 无 IDB 或 IDB 不支持 keys 时立即标记恢复完成，避免写入一直暂存 _preRestorePending
  function _markRestoredNoIdb() {
    if (_restored) return;
    _restored = true;
    
window.__akiniStorageRestored = true;

    
window.__akiniRestoreSettled = true;

    try {
      window.__akiniOnCriticalRestored();
    } catch (e) {}
  }
  var _restoreTimer = null;
  function tryRestore() {
    if (getIDB() && getIDB().keys) {
      restoreAll();
      return true;
    }
    return false;
  }
  if (!tryRestore()) {
    _restoreTimer = setInterval(function () {
      if (tryRestore()) {
        clearInterval(_restoreTimer);
        _restoreTimer = null;
      }
    }, 50);
    setTimeout(function () {
      if (_restoreTimer) {
        clearInterval(_restoreTimer);
        _restoreTimer = null;
      }
      if (!getIDB() || !getIDB().keys) _markRestoredNoIdb();
    }, 5000);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(restoreAll, 300);
    });
  } else {
    setTimeout(restoreAll, 300);
  }

  // ---- 生命周期守护：后台挂起切回立即落盘，切离也立即落盘 ----
  // 重复对账反而会在 IDB 镜像滞后的情况下用旧值覆盖 LS 真实数据（导致设置/纪念日被重置）。
  // 仅做落盘（把内存里的最新值写回 IDB），保证数据不丢。
  window.__akiniOnHidden(function () { 
      flushIdbQueue();
      try {
        if (window.__akiniVaultSave) window.__akiniVaultSave();
      } catch (e) {}
     }), window.__akiniOnVisible(function () { 
      flushIdbQueue();
     });
  window.addEventListener("pagehide", function () {
    flushIdbQueue();
    try {
      if (window.__akiniVaultSave) window.__akiniVaultSave();
    } catch (e) {}
  });
  window.addEventListener("pageshow", function (evt) {
    // 从 bfcache(往返缓存)恢复时，仅落盘，不重新对账
    if (evt && evt.persisted) {
      flushIdbQueue();
    }
  });

  // 只在切后台时落一次，减少常驻定时器的后台唤醒。
  window.__akiniOnHidden(function () { flushIdbQueue(); });

  // ---- 去重清理：同一份数据只保留主键，删除旧版本留下的多层重复副本 ----
  function _isDerivedDupKey(k) {
    if (!k) return false;
    var ks = String(k);
    return false;
  }
  function _primaryOfBackup(k) {
    var ks = String(k);
    /* 快照类键即使以 _backup 结尾也不能当成可删副本 */
    if (ks.indexOf("snapshot") >= 0 || ks.indexOf("snap_") === 0 || ks.indexOf("snap2_") === 0) return null;
    /* 聊天记录的备份键一律保留不删：备份往往比主键更完整，删掉就永久没有第二份了 */
    if (ks.indexOf("akini_chat_history_backup_") === 0) return null;
    // 只处理 xxx_backup -> xxx；范围控制在 akini_ 前缀，避免误删外部键
    if (ks.indexOf("akini_") === 0 && /_backup$/.test(ks) && ks.length > 14) return ks.slice(0, -7);
    return null;
  }
  function _isRealVal(v) {
    return !(v == null || v === "" || v === "[]" || v === "{}" || v === "null" || v === "undefined");
  }
  window.__akiniDedupeStorage = function (cb) {
    var removed = 0,
      freed = 0;
    var done = function () {
      if (typeof cb === "function") cb({ removed: removed, freed: freed });
    };

    // 1) localStorage 层
    try {
      var lsk = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k) lsk.push(k);
      }
      lsk.forEach(function (key) {
        var drop = false;
        if (_isDerivedDupKey(key)) {
          drop = true;
        } else {
          var pk = _primaryOfBackup(key);
          if (pk) {
            var pv = null;
            try {
              pv = memGet(pk);
            } catch (e) {}
            if (!_isRealVal(pv)) {
              try {
                pv = localStorage.getItem(pk);
              } catch (e) {}
            }
            drop = _isRealVal(pv);
          }
        }
        if (!drop) return;
        try {
          var v = localStorage.getItem(key) || "";
          window._akiniAllowRemove = true;
          localStorage.removeItem(key);
          window._akiniAllowRemove = false;
          removed++;
          freed += (key.length + v.length) * 2;
        } catch (e) {
          window._akiniAllowRemove = false;
        }
      });
    } catch (e) {}

    // 2) IndexedDB 层（_idbStore）
    var finish = function () {
      try {
        if (window.localforage) indexedDB.deleteDatabase("akini_img_db");
      } catch (e) {}
      done();
    };
    var IDB = getIDB();
    if (!IDB || !IDB.keys || !IDB.remove) {
      finish();
      return;
    }
    try {
      IDB.keys(function (keys) {
        var list = (keys || []).filter(function (key) {
          return _isDerivedDupKey(key) || !!_primaryOfBackup(key);
        });
        if (!list.length) {
          finish();
          return;
        }
        var idx = 0;
        var step = function () {
          if (idx >= list.length) {
            finish();
            return;
          }
          var key = list[idx++];
          var pk = _primaryOfBackup(key);
          var rm = function () {
            IDB.remove(key, function () {
              removed++;
              step();
            });
          };
          if (!pk) {
            rm();
            return;
          }
          IDB.get(pk, function (pv) {
            _isRealVal(pv) ? rm() : step();
          });
        };
        step();
      });
    } catch (e) {
      finish();
    }
  };

  // 启动时自动清理一次（版本标记，避免每次启动都跑）
  try {
    if (localStorage.getItem("akini_dedupe_v") !== "3") {
      setTimeout(function () {
        try {
          window.__akiniDedupeStorage(function () {
            try {
              localStorage.setItem("akini_dedupe_v", "3");
            } catch (e) {}
          });
        } catch (e) {}
      }, 4000);
    }
  } catch (e) {}

  // ---- 安全删除工具：放行关键键删除拦截，供清除数据/图标重置等显式操作使用 ----
  window._akiniSafeRemove = function (key, cb) {
    window._akiniAllowRemove = true;
    try {
      localStorage.removeItem(key);
    } catch (e) {}
    window._akiniAllowRemove = false;
    if (cb) cb();
  };

  // 彻底清除某个应用图标在本地的所有痕迹，避免恢复默认后又被快照/IDB 恢复
  window._akiniPurgeIcon = function (id, cb) {
    var key = "akini_app_icon_" + id;
    window._akiniSafeRemove(key, function () {
      var s = getIDB();
      if (s && typeof s.remove === "function") {
        try {
          s.remove(key);
        } catch (e) {}
        try {
          s.remove("snap_" + key);
        } catch (e) {}
        try {
          s.remove("snap2_" + key);
        } catch (e) {}
      }
      if (cb) cb();
    });
  };

  // ---- 包装 _idbStore.set：只拦截 null/undefined 字面写入 ----
  // core.js 有 75+ 处直接 _idbStore.set 调用，这里统一过滤 null/undefined 脏值。
  // 空串/空数组/空对象一律放行（调用方负责），对齐 原生 不做空值防御。
  function _wrapIdbSet() {
    var store = window._idbStore;
    if (!store || typeof store.set !== "function") return false;
    if (store.__akiniSetWrapped) return true;
    store.__akiniSetWrapped = true;
    var _origSet = store.set.bind(store);
    store.set = function (k, v, cb) {
      // null/undefined 字面 → 对 akini_ 键拒写（防止把字符串 "null" 存进 IDB）
      if (
        k &&
        String(k).indexOf("akini_") === 0 &&
        (v === null || v === undefined || v === "null" || v === "undefined")
      ) {
        if (typeof cb === "function") cb(null);
        return;
      }
      return _origSet(k, v, cb);
    };
    return true;
  }
  // core.js 约 31KB 处创建 _idbStore，storage.js 先加载 → 等它就绪后包装
  (function _waitIdbWrap() {
    if (_wrapIdbSet()) return;
    var tries = 0;
    var t = setInterval(function () {
      if (_wrapIdbSet()) {
        clearInterval(t);
        return;
      }
      if (++tries > 100) clearInterval(t); // 最多 5s
    }, 50);
  })();

  console.log("[akini-storage] 可靠存储层已加载");
})();

(function () {
  "use strict";
  if (window.__akiniPersistReady) return;
  window.__akiniPersistReady = true;

  var LS_KEY = "__akini_critical_snapshot_ls";
  var LS_MAX = 400 * 1024; // localStorage 小快照上限（原生 的 critical 也只放核心数据；写 LS 是同步的，越大越卡）
  var IMG_LS_MAX = 400 * 1024; // 大于该体积的图片不进 LS 小快照（大图本身由 IndexedDB 原键承载）

  var SKIP_RE = /^(akini_next_|akini_last_)/;
  /* 大体积动态数据：只走 IDB 原键 + 内存，不重复进周期快照 */
  var HOT_SKIP_RE = /^(akini_posts|akini_icity_diaries|akini_mail_sent|akini_mail_received)$/;
  var SKIP_EXACT = {
    akini_ls_dirty: 1,
    akini_localstorage_snapshot: 1,
    akini_localstorage_snapshot_backup: 1,
    akini_idb_full_snapshot: 1,
    akini_dedupe_v: 1,
  };
  // 视觉关键图片：优先进入 LS 小快照（但受 IMG_LS_MAX 限制）
  var PRIORITY_IMG_RE =
    /^(akini_(home_bg|bg_img|cover_img|s1_cover|s1_photo|s2_cover|s2_day_bg|day_bg|my_avatar|ta_avatar|icity_my_avatar|icity_ta_avatar|chat_bg|music_bg|music_player_bg|polaroid_photo|friends_bg|call_bg|callmini_bg))|(akini_contact_avatar_)|(akini_chat_bg_)/;

  function store() {
    return window.akiniStore || null;
  }
  function memGet(k) {
    try {
      var s = store();
      return s && s.memoryGet ? s.memoryGet(k) : null;
    } catch (e) {
      return null;
    }
  }
  function memSet(k, v) {
    try {
      var s = store();
      if (s && s.memorySet) s.memorySet(k, v);
    } catch (e) {}
  }
  function rawGet(k) {
    // LS 写满/被禁用时的内存副本优先（它才是用户刚写进去的最新值）
    try {
      var f = window.__akiniLsFallback;
      if (f && Object.prototype.hasOwnProperty.call(f, k)) return f[k];
    } catch (e0) {}
    try {
      var s = store();
      if (s && s.rawLSGet) return s.rawLSGet(k);
    } catch (e) {}
    // 存储层尚未就绪（或初始化失败）时兜底直读，避免整层快照因 akiniStore 缺失而失效
    try {
      return localStorage.getItem(k);
    } catch (e2) {
      return null;
    }
  }
  function queueIdb(k, v) {
    try {
      var s = store();
      if (s && s._queueIdbWrite) s._queueIdbWrite(k, v);
    } catch (e) {}
  }
  function isImg(k) {
    try {
      return !!(window.__akiniImgWts && window.__akiniImgWts.isImg && window.__akiniImgWts.isImg(k));
    } catch (e) {
      return false;
    }
  }
  function isReal(v) {
    return !(v == null || v === "" || v === "[]" || v === "{}" || v === "null" || v === "undefined");
  }

  function isCritical(k) {
    if (!k || typeof k !== "string") return false;
    if (k.indexOf("akini_") !== 0) return false;
    if (SKIP_RE.test(k) || SKIP_EXACT[k]) return false;
    if (k.indexOf("_backup") >= 0) return false; // 冗余副本不重复快照
    return true;
  }

  function collectKeys() {
    var out = {},
      s = store();
    try {
      if (s && s.memoryKeys)
        s.memoryKeys().forEach(function (k) {
          if (k) out[k] = 1;
        });
    } catch (e) {}
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k) out[k] = 1;
      }
    } catch (e2) {}
    return Object.keys(out).filter(isCritical);
  }

  // ---- 构造快照 ----
  var _cur = null; // 当前已知的最近快照（LS 启动快照 + 运行期更新）
  var _lastSig = "";
  function buildSnap(prev, now, recordDel) {
    var keys = collectKeys();
    var deferred = window.__akiniDeferredKeys || {};
    var d = {},
      t = {};
    var del = prev && prev.del ? prev.del : {};
    var total = 0;
    keys.sort(function (a, b) {
      return priOf(a) - priOf(b);
    }); // 文本核心优先
    keys.forEach(function (k) {
      /* 原生 对齐：聊天记录只有一份权威副本 —— IndexedDB 里的全量。
         快照里放聊天只能放被截断的尾巴（体积预算），而启动时回填尾巴会把
         IDB 的全量覆盖成「只剩最后几百条」—— 这就是「聊天记录凭空消失」的主因。 */
      if (k.indexOf("akini_chat_history") === 0) return;
      var v = memGet(k);
      if (typeof v !== "string" || v === "") v = rawGet(k);
      if (typeof v !== "string" || !isReal(v)) {
        // 超预算未驻留的大键：保留上一次快照值，绝不误判为删除
        if (deferred[k] && prev && prev.d && isReal(prev.d[k])) {
          d[k] = prev.d[k];
          t[k] = (prev.t && prev.t[k]) || now;
          return;
        }
        if (recordDel && prev && prev.d && isReal(prev.d[k])) del[k] = now; // 仅显式删除时记墓碑，避免误判阻断云恢复
        return;
      }
      var sv = v;
      /* 原生 对齐：critical 快照只存核心文字数据，图片一律不进快照。
         图片的权威副本本来就在 IndexedDB 原键里，再复制一份进快照，
         会让每次签名变化都重新 stringify 十几 MB 并同步写 LS —— 切后台重进必卡。 */
      if (isImg(k)) return;
      /* 带图朋友圈/iCity/邮件这类大文本，原始副本已经在 IndexedDB 里，
         再复制一份进 20s 周期快照只会让每次 stringify 多背几 MB（低端机卡顿/闪退主因）。
         超过 900KB 的直接不参与快照，交付权威副本仍由 IDB 原键承担。 */
      if (HOT_SKIP_RE.test(k) && sv.length > 900 * 1024) return;
      if (!sv || sv.length > 512 * 1024) return;
      /* 总量预算：对齐 原生 的 critical 小快照，避免多会话超大聊天记录把
         JSON.stringify 撑爆低端机内存。快照只是启动快恢复 + 墓碑仲裁的兜底，
         全量数据已由 akiniSet 逐键落 IndexedDB，这里不需要几 MB 的大快照。 */
      if (total + sv.length > 1024 * 1024) return;
      total += sv.length;
      d[k] = sv;
      t[k] = prev && prev.d && prev.d[k] === sv && prev.t && prev.t[k] ? prev.t[k] : now;
    });
    Object.keys(del).forEach(function (k) {
      if (d[k] && isReal(d[k])) delete del[k];
    });
    return { v: 1, ts: now, d: d, t: t, del: del };
  }

  function priOf(k) {
    if (PRIORITY_IMG_RE.test(k)) return 2;
    if (k.indexOf("akini_") === 0) return 0;
    return 4;
  }
  // localStorage 小快照优先级：文字核心 → 头像/背景
  function shrinkSnap(snap) {
    var d = {},
      t = (snap && snap.t) || {},
      del = (snap && snap.del) || {};
    var entries = Object.keys((snap && snap.d) || {}).map(function (k) {
      return { k: k, v: snap.d[k] };
    });
    entries.sort(function (a, b) {
      return priOf(a.k) - priOf(b.k) || a.v.length - b.v.length;
    });
    var total = 0;
    entries.forEach(function (e) {
      var v = e.v;
      if (!isReal(v)) return;
      if (priOf(e.k) === 2 && v.length > IMG_LS_MAX) return;
      if (total + v.length > LS_MAX) return;
      d[e.k] = v;
      total += v.length;
    });
    return { v: 1, ts: (snap && snap.ts) || Date.now(), d: d, t: t, del: del };
  }

  function persistSnap(snap) {
    var body = JSON.stringify(snap);
    var small = snap,
      sBody = body;
    if (sBody.length > LS_MAX) {
      small = shrinkSnap(snap);
      sBody = JSON.stringify(small);
    }
    try {
      localStorage.setItem(LS_KEY, sBody);
    } catch (e1) {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(shrinkSnap(small)));
      } catch (e2) {}
    }
  }

  function sigOf() {
    var keys = collectKeys();
    var total = 0,
      sig = keys.length + ":";
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var v = memGet(k);
      if (typeof v !== "string" || v === "") v = rawGet(k);
      total += typeof v === "string" ? v.length : 0;
      sig += k.length + ",";
    }
    return sig + "#" + total;
  }

  function takeSnapshot(force, sig) {
    if (!store()) return;
    if (window.__akiniWiping) return;
    if (!force && !window.__akiniRestoreSettled) return; // 启动对账完成前不写快照，防止用默认值覆盖
    try {
      var now = Date.now();
      var snap = buildSnap(_cur, now, !!force);
      _cur = snap;
      persistSnap(snap);
      _lastSig = typeof sig === "string" ? sig : sigOf();
      

    } catch (e) {}
  }

  // ---- 回填：只补“缺失/空壳”的键，绝不覆盖用户已有真实数据 ----
  var DEFAULT_VALS = {
    akini_my_name: ["我", ""],
    akini_ta_name: ["梦角", "对方", "TA", ""],
    akini_my_status: ["在线", ""],
    akini_ta_status: ["在线", ""],
    akini_signature: [""],
    akini_friends_signature: [""],
  };
  /* 启动默认值/空壳：只有默认联系人、空数组、默认名字等 —— 都应被快照里的真实数据替换 */
  function isShellVal(k, v) {
    if (!isReal(v)) return true;
    var s = String(v);
    if (s === "[]" || s === "{}") return true;
    if (DEFAULT_VALS[k] && DEFAULT_VALS[k].indexOf(s) >= 0) return true;
    try {
      if (k === "akini_contacts") {
        var a = JSON.parse(s);
        if (!Array.isArray(a) || !a.length) return true;
        var real = a.filter(function (c) {
          return c && c.id !== "ta_default" && String(c.name || "") !== "对方";
        });
        return !real.length;
      }
      if (
        k === "akini_groups" ||
        k === "akini_sessions" ||
        k === "akini_chat_sessions" ||
        k === "akini_chat_pins" ||
        k === "akini_home_avatars"
      ) {
        var o = JSON.parse(s);
        if (Array.isArray(o)) return !o.length;
        return !o || !Object.keys(o).length;
      }
    } catch (e) {}
    return false;
  }

  function fill(k, v) {
    memSet(k, v);
    if (k.indexOf("akini_chat_history") !== 0 && !isImg(k) && v.length <= 900 * 1024) {
      try {
        localStorage.setItem(k, v);
      } catch (e) {}
    }
    queueIdb(k, v);
  }

  function applySnap(snap, why) {
    if (!snap || !snap.d) return 0;
    var filled = 0;
    Object.keys(snap.d).forEach(function (k) {
      /* 原生 对齐：聊天记录的权威副本只有 IndexedDB 一份，快照永不参与回填/写回。
         旧版本残留的快照里可能还有截断的聊天尾巴，这里必须忽略，绝不能再写进 IDB。 */
      if (k.indexOf("akini_chat_history") === 0) return;
      var sv = snap.d[k];
      if (k.indexOf("akini_") !== 0 || !isReal(sv)) return;
      var cur = memGet(k);
      if (typeof cur !== "string" || cur === "") cur = rawGet(k);
      var need = false;
      if (!isReal(cur)) {
        need = true;
      } else if (isImg(k)) {
        need = false; // 图片已有值就尊重本地（时间戳仲裁由云恢复负责）
      } else {
        // 本地只是启动默认值/空壳 → 用快照里的真实数据替换；真实数据则尊重本地
        need = isShellVal(k, cur);
      }
      if (!need) return;
      try {
        var _delAt = parseFloat(rawGet("akini_del_at_" + k) || "0") || 0;
        var _snapTs = (snap.t && snap.t[k]) || snap.ts || 0;
        if (_delAt && _snapTs && _delAt > _snapTs) return;
      } catch (eDA2) {}
      try {
        fill(k, sv);
        filled++;
      } catch (e3) {}
    });
    if (filled) console.warn("[快照] 已回填 " + filled + " 项关键数据（" + why + "）");
    return filled;
  }

  function loadLsSnap() {
    var raw = null;
    try {
      raw = localStorage.getItem(LS_KEY);
    } catch (e) {}
    if (!raw) return null;
    try {
      var o = JSON.parse(raw);
      return o && o.d ? o : null;
    } catch (e) {
      return null;
    }
  }

  // ---- 启动第一步：同步读 LS 小快照并立即回填（先于后续所有脚本渲染）----
  try {
    _cur = loadLsSnap();
    if (_cur) applySnap(_cur, "启动快照");
  } catch (eBoot) {}

  // ---- 启动对账完成后再落一次快照 ----
  function afterSettle(fn) {
    if (window.__akiniRestoreSettled) {
      fn();
      return;
    }
    var tries = 0;
    var timer = setInterval(function () {
      if (window.__akiniRestoreSettled || ++tries > 120) {
        clearInterval(timer);
        fn();
      }
    }, 250);
  }
  afterSettle(function () {
    setTimeout(function () {
      takeSnapshot(false);
    }, 1200);
  });

  // ---- 钩住“启动对账完成”回调：真实数据回填后立即再校一次快照 ----
  try {
    var _prevHook = window.__akiniOnCriticalRestored;
    window.__akiniOnCriticalRestored = function () {
      try {
        if (_cur) applySnap(_cur, "启动对账后");
      } catch (e1) {}
      if (typeof _prevHook === "function") {
        try {
          _prevHook();
        } catch (e2) {}
      }
    };
  } catch (eHook) {}

  // ---- 运行期快照：对齐 原生，取消前台周期性全量快照 ----
  function flushStore() {
    try {
      var s = store();
      if (!s) return;
      if (typeof s.flushIdb === "function") s.flushIdb();
      else if (typeof s.flushIdbQueue === "function") s.flushIdbQueue();
    } catch (e) {}
  }
  try {
    window.__akiniOnHidden(function () { 
        flushStore();
        try {
          takeSnapshot(false);
        } catch (e) {}
       });
    window.addEventListener("pagehide", function () {
      flushStore();
      try {
        takeSnapshot(false);
      } catch (e) {} // 关闭/被回收前同步落一份关键快照（对齐 原生 的 pagehide 备份）
    });
  } catch (eT2) {}

  // ---- 对外接口 ----
  window._snapshotCritical = function (force) {
    try {
      takeSnapshot(!!force);
    } catch (e) {}
  };
  window.__akiniSnap = {
    snapshot: window._snapshotCritical,
    restore: function () {
      if (_cur) applySnap(_cur, "手动恢复");
    },
    keyTs: function (k) {
      return +((_cur && _cur.t && _cur.t[k]) || 0);
    },
    isDeleted: function (k) {
      return +((_cur && _cur.del && _cur.del[k]) || 0);
    },
    loadedKeys: function () {
      return _cur && _cur.d ? Object.keys(_cur.d).length : 0;
    },
  };

  console.log(
    "[akini-persist] 关键数据快照层已加载" + (_cur ? "（启动快照 " + Object.keys(_cur.d || {}).length + " 项）" : ""),
  );
})();
