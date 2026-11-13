((window.__akiniLastTs = window.__akiniLastTs || 0),
  (window.__akiniNextTs = function () {
    var t = Date.now();
    return (t <= window.__akiniLastTs && (t = window.__akiniLastTs + 1), (window.__akiniLastTs = t), t);
  }),
  (function () {
    var t = 0,
      e = 0;
    (document.addEventListener(
      "touchstart",
      function (n) {
        var i = n.touches && n.touches[0];
        i && ((t = i.clientX), (e = i.clientY));
      },
      {
        passive: !0,
      },
    ),
      document.addEventListener(
        "touchend",
        function (n) {
          var i = n.changedTouches && n.changedTouches[0];
          i && (Math.abs(i.clientX - t) > 12 || Math.abs(i.clientY - e) > 12) && (window.__akiniSwiped = Date.now());
        },
        {
          passive: !0,
        },
      ));
  })(),
  (window.__akiniImgCache = window.__akiniImgCache || {}),
  (window.__akiniImgKeys = window.__akiniImgKeys || {}),
  (function () {
    var t = {
        aki_day_bg: 1,
        akini_anniv_bg: 1,
        akini_bg_img: 1,
        akini_call_bg: 1,
        akini_call_mini_bg: 1,
        akini_callmini_bg: 1,
        akini_chat_bg: 1,
        akini_cover_bg: 1,
        akini_day_bg: 1,
        akini_friends_bg: 1,
        akini_home_bg: 1,
        akini_icity_my_bg: 1,
        akini_icity_ta_bg: 1,
        akini_music_bg: 1,
        akini_icity_diaries: 1,
        akini_icity_diaries_backup: 1,
        akini_mail_received: 1,
        akini_mail_sent: 1,
        akini_mail_sent_backup: 1,
        akini_music_playlists_v2: 1,
        akini_wordbank: 1,
        akini_chat_sessions: 1,
        akini_chat_pins: 1,
        akini_chat_pins_backup: 1,
        akini_chat_history_backup: 1,
      },
      e = [
        "akini_chat_bg_",
        "akini_icity_my_bg_",
        "akini_icity_ta_bg_",
        "akini_chat_history_",
        "akini_full_backup_",
        "akini_backup_",
        "akini_contacts_backup",
      ];
    var _imgCacheBytes = 0,
      _imgCacheQ = [],
      _imgCacheQueued = {};
    ((window.__akiniIsImgKey = function (n) {
      if (!n) return !1;
      if (t[n]) return !0;
      for (var i = 0; i < e.length; i++) if (0 === n.indexOf(e[i])) return !0;
      return !1;
    }),
      /* essential 只后淘汰；邮件、聊天和备份文本绝不进入首屏图片白名单。 */
      (window.__akiniIsEssentialImg = function (n) {
        if (!n) return !1;
        var exact = {
          akini_home_bg: 1,
          akini_s1_cover: 1,
          akini_s1_photo: 1,
          akini_cover_bg: 1,
          akini_cover_img: 1,
          akini_bg_img: 1,
          akini_day_bg: 1,
          akini_avatar_left: 1,
          akini_avatar_right: 1,
          akini_my_avatar: 1,
          akini_ta_avatar: 1,
          akini_s1_avatar: 1,
        };
        if (exact[n]) return !0;
        return 0 === n.indexOf("akini_contact_avatar_") || 0 === n.indexOf("akini_avatar_");
      }),
      (window.__akiniImgCacheRemove = function (k) {
        if (!window.__akiniImgCache || !Object.prototype.hasOwnProperty.call(window.__akiniImgCache, k)) return;
        var old = window.__akiniImgCache[k];
        if ("string" == typeof old) _imgCacheBytes = Math.max(0, _imgCacheBytes - old.length);
        delete window.__akiniImgCache[k];
        var at = _imgCacheQ.indexOf(k);
        if (at >= 0) _imgCacheQ.splice(at, 1);
        delete _imgCacheQueued[k];
      }),
      (window.__akiniImgCacheClear = function () {
        Object.keys(window.__akiniImgCache || {}).forEach(function (k) {
          delete window.__akiniImgCache[k];
        });
        _imgCacheBytes = 0;
        _imgCacheQ = [];
        _imgCacheQueued = {};
      }),
      (window.__akiniImgCachePut = function (k, v) {
        window.__akiniImgCacheRemove(k);
        if (
          "string" != typeof v ||
          !v ||
          v.length > 8388608 ||
          (0 !== v.indexOf("data:") && v.length > 4096)
        )
          return !1;
        window.__akiniImgCache[k] = v;
        _imgCacheBytes += v.length;
        _imgCacheQ.push(k);
        _imgCacheQueued[k] = 1;
        while (_imgCacheBytes > 8388608 && _imgCacheQ.length) {
          var at = 0;
          while (at < _imgCacheQ.length && window.__akiniIsEssentialImg(_imgCacheQ[at])) at++;
          if (at >= _imgCacheQ.length) at = 0;
          var victim = _imgCacheQ[at];
          window.__akiniImgCacheRemove(victim);
        }
        return Object.prototype.hasOwnProperty.call(window.__akiniImgCache, k);
      }),
      (window.__akiniImgSet = function (t, e) {
        window.__akiniImgCachePut(t, e);
        function lsFb() {
          try {
            localStorage.setItem(t, e);
          } catch (_x) {}
        }
        var lf = window.localforage;
        if (!lf) {
          lsFb();
          return;
        }
        try {
          var pr = lf.setItem(t, e);
          if (pr && pr.catch)
            pr.catch(function () {
              lsFb();
            });
        } catch (_y) {
          lsFb();
        }
      }),
      (window.__akiniImgGetLS = function (t) {
        try {
          return localStorage.getItem(t) || "";
        } catch (t) {
          return "";
        }
      }),
      (window.__akiniImgMigrateLS = function (t) {
        var e = window.__akiniImgGetLS(t);
        if (e) {
          window.__akiniImgCachePut(t, e);
          /* 只需迁移一次；之后每次启动重复写 IDB 纯属浪费 I/O */
          try {
            if (localStorage.getItem("akini_img_migrated_v1")) return;
          } catch (_m) {}
          try {
            window.localforage && localforage.setItem(t, e).catch(function () {});
          } catch (t) {}
        }
      }),
      (window.__akiniImgStoreInit = function () {
        try {
          if (!window.localforage) return;
          for (var e in t) window.__akiniImgMigrateLS(e);
          try {
            var n =
              window.akiniContacts && window.akiniContacts.getActiveChatId
                ? window.akiniContacts.getActiveChatId()
                : "";
            n && window.__akiniImgMigrateLS("akini_chat_bg_" + n);
            try {
              localStorage.setItem("akini_img_migrated_v1", "1");
            } catch (_m2) {}
          } catch (t) {}
        } catch (t) {}
      }),
      (window.__akiniImgReady = !1));
    !(function () {
      try {
        window.__akiniImgStoreInit();
      } catch (t) {}
      try {
        window.localforage && localforage.keys
          ? localforage
              .keys()
              .then(function (keys) {
                /* 只预取图片类键；聊天历史/日记等大文本不进图片缓存，
                   否则启动时把所有历史读进内存，越用越卡。 */
                var _b = 0,
                  _L = 6291456,
                  list = keys.filter(function (k) {
                    return (
                      window.__akiniIsImgKey(k) &&
                      k.indexOf("akini_chat_history_") < 0 &&
                      k.indexOf("akini_chat_sessions") < 0 &&
                      k.indexOf("akini_chat_pins") < 0 &&
                      k.indexOf("akini_mail_") < 0 &&
                      k.indexOf("akini_icity_diaries") < 0
                    );
                  }),
                  i = 0;
                function next() {
                  if (i >= list.length || _b >= _L) return Promise.resolve();
                  var k = list[i++];
                  return localforage
                    .getItem(k)
                    .then(function (v) {
                      if ("string" == typeof v && v.length <= 1572864 && _b + v.length <= _L) {
                        window.__akiniImgCachePut(k, v);
                        _b += v.length;
                      }
                      return next();
                    })
                    .catch(function () {
                      return next();
                    });
                }
                return next();
              })
              .then(function () {
                window.__akiniImgReady = !0;
                try {
                  window.dispatchEvent(new Event("akini-img-ready"));
                } catch (t) {}
                try {
                  "function" == typeof applyBg && applyBg();
                } catch (t) {}
                try {
                  window.__akiniRenderUserText && __akiniRenderUserText();
                } catch (t) {}
                setTimeout(function () {
                  try {
                    "function" == typeof applyBg && applyBg();
                  } catch (t) {}
                }, 1200);
              })
              .catch(function () {
                window.__akiniImgReady = !0;
              })
          : (window.__akiniImgReady = !0);
      } catch (t) {
        window.__akiniImgReady = !0;
      }
    })();
  })(),
  (function () {
    window.__akiniBackupJanitor = function () {
      try {
        for (var t = 0, e = localStorage.length - 1; e >= 0; e--) {
          var n = localStorage.key(e);
          if (n && /_backup(?:_backup)+$/.test(n))
            try {
              (localStorage.removeItem(n), t++);
            } catch (t) {}
        }
        t && console.warn("[] 已清理深层备份垃圾键 " + t + " 个（备份雪崩止血）");
      } catch (t) {}
    };
    try {
      window.__akiniBackupJanitor();
    } catch (t) {}
    (window.__akiniOnVisible(function () { setTimeout(window.__akiniBackupJanitor, 2e3) }),
      (function () {
        var t = [],
          e = !1;
        function n() {
          for (e = !1; t.length;) {
            var n = t.shift();
            try {
              n && n();
            } catch (t) {}
          }
        }
        window.__akiniOnVisible(function () { e || ((e = !0), setTimeout(n, 500)) });
      })());
  })(),
  (window.__akiniLifeLog = function (t) {
    try {
      var e = [];
      try {
        e = JSON.parse(localStorage.getItem("akini_lifelog") || "[]");
      } catch (t) {
        e = [];
      }
      (Array.isArray(e) || (e = []),
        e.push({
          t: Date.now(),
          ev: String(t).slice(0, 40),
        }),
        e.length > 60 && (e = e.slice(-60)),
        localStorage.setItem("akini_lifelog", JSON.stringify(e)));
    } catch (t) {}
  }),
  (function () {
    try {
      (window.__akiniLifeLog("boot"),
        window.__akiniOnVisible(function () {
          window.__akiniLifeLog("visible");
        }),
        window.__akiniOnHidden(function () {
          window.__akiniLifeLog("hidden");
        }),
        window.addEventListener("pagehide", function () {
          try {
            window.__akiniLifeLog("pagehide");
          } catch (t) {}
        }),
        window.addEventListener("pageshow", function (t) {
          try {
            window.__akiniLifeLog("pageshow" + (t.persisted ? "(bfcache)" : ""));
          } catch (t) {}
        }),
        window.addEventListener("load", function () {
          try {
            window.__akiniLifeLog("load");
          } catch (t) {}
        }));
    } catch (t) {}
  })(),
  (window.__akiniConfirmDialog = function (t) {
    try {
      var e = document.getElementById("akiniDeleteModalOverlay");
      e && e.parentNode && e.parentNode.removeChild(e);
      var n = document.createElement("div");
      ((n.id = "akiniDeleteModalOverlay"),
        (n.style.cssText =
          "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:8900;display:flex;align-items:center;justify-content:center;pointer-events:auto;"));
      var i = document.createElement("div");
      i.style.cssText =
        "background:#ffffff;border-radius:16px;padding:32px 24px;max-width:280px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.2);text-align:center;box-sizing:border-box;";
      var a = document.createElement("div");
      ((a.style.cssText = "font-size:16px;font-weight:600;color:#000000;margin-bottom:24px;line-height:1.5;"),
        (a.textContent = "确认删除这条朋友圈吗？"));
      var o = document.createElement("div");
      o.style.cssText = "display:flex;gap:12px;";
      var r = document.createElement("button");
      ((r.style.cssText =
        "flex:1;padding:12px 20px;border:1px solid #e0e0e0;border-radius:10px;background:#ffffff;color:#000000;font-size:15px;font-weight:500;cursor:pointer;outline:none;-webkit-tap-highlight-color:transparent;"),
        (r.textContent = "取消"));
      var c = document.createElement("button");
      ((c.style.cssText =
        "flex:1;padding:12px 20px;border:1px solid #000000;border-radius:10px;background:#000000;color:#ffffff;font-size:15px;font-weight:500;cursor:pointer;outline:none;-webkit-tap-highlight-color:transparent;"),
        (c.textContent = "确定"),
        o.appendChild(r),
        o.appendChild(c),
        i.appendChild(a),
        i.appendChild(o),
        n.appendChild(i));
      var s = document.getElementById("app-friends") || document.body;
      (s && "none" !== s.style.display ? s.appendChild(n) : document.body.appendChild(n),
        (r.onclick = function () {
          n.parentNode && n.parentNode.removeChild(n);
        }),
        (c.onclick = function () {
          n.parentNode && n.parentNode.removeChild(n);
          try {
            "function" == typeof t && t();
          } catch (t) {
            console.warn("[Akini] 删除失败", t);
          }
        }),
        (n.onclick = function (t) {
          t.target === n && n.parentNode && n.parentNode.removeChild(n);
        }));
    } catch (t) {
      console.error("[Akini] 弹窗展示异常", t);
    }
  }),
  "function" != typeof window.esc &&
    (window.esc = function (t) {
      return String(null == t ? "" : t)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }),
  "function" != typeof window.rt && (window.rt = window.esc),
  (window.__akiniMedia = (function () {
    var t = {},
      e = [],
      n = 0;
    return {
      PLACEHOLDER: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      flushHalf: function () {
        try {
          for (var i = Math.floor(e.length / 2), a = 0; a < i; a++) {
            var o = e.shift();
            o && t[o] && ((n -= t[o].length), delete t[o]);
          }
          return i;
        } catch (t) {
          return 0;
        }
      },
      put: function (i) {
        if (!i || 0 !== i.indexOf("data:")) return null;
        var a = (function (t) {
          for (var e = 5381, n = 0; n < t.length; n += 7) e = ((e << 5) + e + t.charCodeAt(n)) | 0;
          return "m" + (e >>> 0).toString(36) + "_" + t.length;
        })(i);
        if (!t[a]) {
          ((t[a] = i),
            e.push(a),
            (n += i.length),
            (function () {
              for (; n > 8388608 && e.length > 0;) {
                var i = e.shift();
                i && t[i] && ((n -= t[i].length), delete t[i]);
              }
            })());
          try {
            window._idbStore && window._idbStore.set("akini_media_" + a, i);
          } catch (t) {}
          try {
            window.akiniStore && window.akiniStore.set && window.akiniStore.set("akini_media_" + a, i);
          } catch (t) {}
          try {
            window.akiniStore && window.akiniStore.flushIdb && window.akiniStore.flushIdb();
          } catch (t) {}
          /* 不再经 rawLSSet 同步落 localStorage：存储层规定图片唯一权威副本是内存+IDB，
             每发一张图就多一次同步 MB 级 LS 写，是聊天发图卡顿的来源。
             读取侧仍保留 LS 兜底（旧版本遗留键启动时会被迁移进 IDB），兼容性不变。 */
        }
        return a;
      },
      get: function (i, a) {
        if (t[i]) return a(t[i]);
        var o = !1,
          r = function (r) {
            o ||
              ((o = !0),
              r &&
                ((t[i] = r),
                e.push(i),
                (n += r.length),
                /* get 路径同样要受 8MB 预算约束：以前只有 put 会淘汰，
                   连续翻看聊天图片时缓存只增不减，用久了就把内存吃光闪退。 */
                (function () {
                  for (; n > 8388608 && e.length > 0; ) {
                    var x = e.shift();
                    x && t[x] && ((n -= t[x].length), delete t[x]);
                  }
                })()),
              a(r || null));
          };
        try {
          window._idbStore.get("akini_media_" + i, function (t) {
            if (t) return r(t);
            try {
              var e =
                window.akiniStore && window.akiniStore.getSync ? window.akiniStore.getSync("akini_media_" + i) : null;
              if (e && e.length > 10) {
                try {
                  window._idbStore.set("akini_media_" + i, e);
                } catch (t) {}
                return r(e);
              }
              window.akiniStore && window.akiniStore.get
                ? window.akiniStore.get("akini_media_" + i, function (t) {
                    if (t && t.length > 10)
                      try {
                        window._idbStore.set("akini_media_" + i, t);
                      } catch (t) {}
                    if (t && t.length > 10) return r(t);
                    try {
                      var e = "";
                      try {
                        e = localStorage.getItem("akini_media_" + i) || "";
                      } catch (t) {}
                      if (e && 0 === e.indexOf("data:image")) {
                        try {
                          window._idbStore.set("akini_media_" + i, e);
                        } catch (t) {}
                        return r(e);
                      }
                    } catch (t) {}
                    r(t || null);
                  })
                : r(null);
            } catch (t) {
              r(null);
            }
          });
        } catch (t) {
          try {
            var c =
              window.akiniStore && window.akiniStore.getSync ? window.akiniStore.getSync("akini_media_" + i) : null;
            if (c && c.length > 10) return r(c);
            var s = "";
            try {
              s = localStorage.getItem("akini_media_" + i) || "";
            } catch (t) {}
            r(s && 0 === s.indexOf("data:image") ? s : null);
          } catch (t) {
            a(null);
          }
        }
      },
      getSync: function (e) {
        if (t[e]) return t[e];
        try {
          var n = "";
          try {
            n = localStorage.getItem("akini_media_" + e) || "";
          } catch (t) {}
          if (n && 0 === n.indexOf("data:image") && n.length > 10) return ((t[e] = n), n);
        } catch (t) {}
        return null;
      },
      resolve: function (t) {
        if (t && t.querySelectorAll)
          for (var e = this, n = t.querySelectorAll("img[data-mh]"), i = 0; i < n.length; i++)
            (function (t) {
              var n = t.getAttribute("data-mh");
              if (!n || t.__mhDone || (t.classList && t.classList.contains("akini-media-missing"))) return;
              /* 不再维护独立的 resolveSrcCache：它会把最多 200 张图片的 data URL
                 再各存一份（可达几十 MB，且与 __akiniMedia 自带的 8MB 缓存重复）。
                 命中缓存由 __akiniMedia.get 内部的 8MB 缓存负责，未命中才读 IDB。 */
              var i = [1e3, 4e3, 12e3],
                a = function (o) {
                  e.get(n, function (e) {
                    if (e) {
                      __akiniGuardSrc(t, e);
                      t.__mhDone = !0;
                      return;
                    }
                    if (o < i.length) {
                      var f = function () {
                        a(o + 1);
                      };
                      window.requestIdleCallback
                        ? requestIdleCallback(f, {
                            timeout: i[o],
                          })
                        : setTimeout(f, i[o]);
                    } else {
                      (t.classList.add("akini-media-missing"), (t.alt = "图片丢失"));
                    }
                  });
                };
              a(0);
            })(n[i]);
      },
    };
  })()));

(function () {
  /* 聊天/陪伴气泡里的图最大只显示 160px，但浏览器默认按原图像素解码：
     一张 2000x1500 的照片解码后约 12MB，聊天里放十几张就是 200MB+。
     给气泡图补上按显示上限缩放的 width/height 属性，浏览器就会按小尺寸解码
     （Chrome 的行为），原图字节与画质完全不变，只是不再把整张原图解码进内存。 */
  var DECODE_CAP = 480; /* 160 CSS px × 3 倍屏 */
  var BUBBLE_IMG =
    "#chatBody .bubble img, #companionMsgs .msg-row img, #watchChatBody .msg-row img";
  function capDecode(img) {
    try {
      if (img.__akCap || !img.matches || !img.matches(BUBBLE_IMG)) return;
      var nw = img.naturalWidth,
        nh = img.naturalHeight;
      if (!nw || !nh) return;
      img.__akCap = 1;
      var m = Math.max(nw, nh);
      if (m <= DECODE_CAP) return;
      var r = DECODE_CAP / m;
      img.setAttribute("width", String(Math.round(nw * r)));
      img.setAttribute("height", String(Math.round(nh * r)));
    } catch (e) {}
  }
  function hook(img) {
    if (!img || img.tagName !== "IMG" || img.__akCapHook) return;
    img.__akCapHook = 1;
    if (img.complete) capDecode(img);
    else img.addEventListener("load", function () { capDecode(img); }, { once: true });
  }
  function mark(root) {
    try {
      var imgs = root && root.querySelectorAll ? root.querySelectorAll("img") : [];
      for (var i = 0; i < imgs.length; i++) {
        if (!imgs[i].getAttribute("loading")) {
          imgs[i].loading = "lazy";
          imgs[i].decoding = "async";
        }
        hook(imgs[i]);
      }
    } catch (e) {}
  }
  var pend = null;
  function schedule() {
    if (pend) return;
    pend = setTimeout(function () {
      pend = null;
      mark(document);
    }, 300);
  }
  try {
    new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var added = list[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (!n || n.nodeType !== 1) continue;
          if (n.tagName === "IMG") {
            n.loading = "lazy";
            n.decoding = "async";
            hook(n);
          } else if (n.querySelector && n.querySelector("img")) {
            schedule();
          }
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      mark(document);
    });
  } else {
    mark(document);
  }
})();

/* 评论输入框：随内容自动长高（上限 30vh，CSS 已卡），回车发送、Shift+回车换行 */
(function () {
  document.addEventListener(
    "input",
    function (e) {
      var t = e.target;
      if (!t || t.id !== "friendsCommentInput") return;
      try {
        t.style.height = "auto";
        t.style.height = Math.min(t.scrollHeight, Math.round(window.innerHeight * 0.3)) + "px";
      } catch (err) {}
    },
    true,
  );
  document.addEventListener(
    "keydown",
    function (e) {
      var t = e.target;
      if (!t || t.id !== "friendsCommentInput") return;
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        var b = document.getElementById("friendsCommentSubmit");
        if (b) b.click();
      }
    },
    true,
  );
})();

(function () {
  function healChatBg() {
    try {
      var cb = document.getElementById("chatBody");
      if (!cb) return;
      var v = cb.getAttribute("data-current-bg");
      if (!v) return;
      var want = 'url("' + v + '")';
      [cb, document.getElementById("app-chat")].forEach(function (el) {
        if (!el || !el.style) return;
        el.style.removeProperty("background-image");
        void el.offsetHeight; /* 强制 reflow，让重设生效 */
        el.style.setProperty("background-image", want, "important");
        el.style.setProperty("background-size", "cover", "important");
        el.style.setProperty("background-position", "center", "important");
        el.style.setProperty("background-repeat", "no-repeat", "important");
      });
    } catch (e) {}
  }
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) healChatBg();
  });
  window.addEventListener("pageshow", function (e) {
    if (e && e.persisted) healChatBg();
  });
})();
