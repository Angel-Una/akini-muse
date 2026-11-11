(function () {
  function killActiveMsg() {
    try {
      if (window.__activeMsgTimer) {
        clearTimeout(window.__activeMsgTimer);
        window.__activeMsgTimer = null;
      }
    } catch (e) {}
    try {
      if (window.__akiniActiveMsgTimer) {
        clearTimeout(window.__akiniActiveMsgTimer);
        window.__akiniActiveMsgTimer = null;
      }
    } catch (e) {}
    
window._akiniActiveMsgAction = null;

  }
  window.__akiniKillActiveMsg = killActiveMsg;
  killActiveMsg();
  // 存储恢复完成后，按用户真实的开关值重排定时器（用户开着就让它跑）
  var waited = 0;
  var iv = setInterval(function () {
    waited += 200;
    if (window.__akiniStorageRestored || window.__akiniRestoreSettled || waited > 10000) {
      clearInterval(iv);
      try {
        window._akiniRescheduleActiveMsg(true);
      } catch (e) {}
    }
  }, 200);
})();
/* ===== 冷启动时聊天页先于数据恢复打开 → 页面空白（名字为空、消息为空）的兜底 =====
   主屏幕 PWA 冷启动较慢，用户可能在 IDB 对账完成前就进入了聊天页，此时联系人/历史都还没
   回填，openChat 渲染出来就是全空；恢复完成后没有任何地方重绘，页面就一直空着。
   这里在恢复完成后检查：聊天页可见 + 没有消息 + 连名字都为空时，重开当前聊天。 ===== */
(function () {
  function fixBlankChat() {
    try {
      var chat = document.getElementById("app-chat");
      if (!chat) return;
      var visible = chat.classList.contains("show") || (chat.style.display && chat.style.display !== "none");
      if (!visible) return;
      var body = document.getElementById("chatBody");
      if (body && body.querySelector(".msg-row")) return;
      var nameEl = document.getElementById("chatTaName");
      if (nameEl && String(nameEl.textContent || "").trim()) return;
      var aid =
        window.akiniContacts && window.akiniContacts.getActiveChatId ? window.akiniContacts.getActiveChatId() : null;
      if (!aid || typeof window.openChat !== "function") return;
      window.openChat(aid, true);
    } catch (e) {}
  }
  window.addEventListener("akini-storage-restored", function () {
    setTimeout(fixBlankChat, 250);
  });
  if (window.__akiniStorageRestored) setTimeout(fixBlankChat, 250);
})();
(function () {
  function bind() {
    if (window.__akiniCtxMenuFallback) return;
    window.__akiniCtxMenuFallback = true;
    document.addEventListener(
      "click",
      function (e) {
        try {
          if (document.body.classList.contains("akini-fav-selecting")) return;
          if (e.target.closest && e.target.closest("#msgContextMenu")) return;
          var b = e.target.closest ? e.target.closest(".bubble") : null;
          if (!b) return;
          /* 自带点击逻辑的卡片放行：一起听总结/邀请、商店代付赠送、问卷答题。
           这些卡片的中断会让自身 onclick / 问卷委托失效，只剩消息右键菜单。 */
          if (
            b.classList.contains("music-end-bubble") ||
            b.classList.contains("music-invite-bubble") ||
            b.classList.contains("shop-card-bubble") ||
            b.classList.contains("survey-bubble") ||
            b.classList.contains("transfer-bubble") ||
            b.classList.contains("sticker-bubble") ||
            b.classList.contains("redpacket-bubble")
          )
            return;
          var chatBody = document.getElementById("chatBody");
          if (!chatBody || !chatBody.contains(b)) return;
          var row = b.closest(".msg-row");
          if (!row || row.classList.contains("system")) return;
          var menu = document.getElementById("msgContextMenu");
          if (menu && menu.style.display === "block") return;
          e.stopImmediatePropagation();
          /* 派发 contextmenu 让 core 设置内部 n 状态并弹出菜单，按钮由 core 原生处理 */
          try {
            var ev;
            if (window.MouseEvent) {
              ev = new MouseEvent("contextmenu", {
                bubbles: true,
                cancelable: true,
                clientX: e.clientX,
                clientY: e.clientY,
              });
            } else {
              ev = document.createEvent("MouseEvents");
              ev.initMouseEvent(
                "contextmenu",
                true,
                true,
                window,
                1,
                e.screenX || 0,
                e.screenY || 0,
                e.clientX || 0,
                e.clientY || 0,
                false,
                false,
                false,
                false,
                0,
                null,
              );
            }
            b.dispatchEvent(ev);
          } catch (err) {}
        } catch (_) {}
      },
      true,
    );
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
(!(function () {
  function t() {
    var t = document.getElementById("testPushBtn");
    t &&
      !t._akiniBound &&
      ((t._akiniBound = 1),
      t.addEventListener("click", function () {
        if ("Notification" in window) {
          var t = function () {
            var t = {
              body: "这是一条测试通知，推送功能正常",
              icon: "./favicon.png",
              tag: "akini_test_" + Date.now(),
              renotify: !0,
            };
            if (window.__akiniSystemNotify) window.__akiniSystemNotify("Akini · 测试推送", t);
            else
              try {
                new Notification("Akini · 测试推送", t);
              } catch (t) {
                alert("通知发送失败：" + t.message);
              }
            /* iOS 在应用处于前台时会把系统通知横幅延迟投递（系统行为，无法绕过），
               用户点了没反应会以为坏了，所以给个即时反馈说明。 */
            try {
              var _ios = /iP(hone|ad|od)/.test(navigator.userAgent || "");
              if (_ios && !document.hidden) {
                var _msg = "测试通知已发送。\niOS 会在应用打开时延迟显示系统通知横幅——按 Home 键退回主屏幕（或锁屏），通知会立刻弹出。";
                if (window.__akiniCenterModal) window.__akiniCenterModal("测试推送", _msg);
                else if (window.__akiniToast) window.__akiniToast("已发送，退回主屏幕可见横幅");
              }
            } catch (_) {}
          };
          if ("granted" !== Notification.permission)
            if ("denied" !== Notification.permission) {
              var e = !1,
                n = function (n) {
                  if (!e)
                    if (((e = !0), "granted" === n)) t();
                    else {
                      var i = /iP(hone|ad|od)/.test(navigator.userAgent || "");
                      alert(
                        i
                          ? "未获得通知权限。如果没有弹出系统授权框：请确认 iOS ≥ 16.4，并且是从主屏幕图标（不是浏览器标签页）打开的 Akini；已拒绝过的话请到「设置 → 通知 → Akini」里手动开启"
                          : "请先允许通知权限后再测试",
                      );
                    }
                };
              try {
                var i = Notification.requestPermission(function (t) {
                  n(t);
                });
                i &&
                  i.then &&
                  i.then(n).catch(function () {
                    n(Notification.permission);
                  });
              } catch (t) {
                n(Notification.permission);
              }
              setTimeout(function () {
                e || n(Notification.permission);
              }, 6e3);
            } else {
              var a = /iP(hone|ad|od)/.test(navigator.userAgent || "");
              alert(
                a
                  ? "通知权限之前被拒绝了。请打开 iPhone「设置 → 通知」，找到 Akini（主屏幕图标那个），打开「允许通知」，再回来测试"
                  : "通知权限已被拒绝，请在浏览器地址栏左侧的锁形图标 → 网站设置 → 通知中改为「允许」后再测试",
              );
            }
          else t();
        } else alert("当前浏览器不支持系统通知");
      }));
  }
  function e() {
    var t = document.getElementById("openAndroidKeepAliveModalBtn"),
      e = document.getElementById("androidKeepAliveModal"),
      n = document.getElementById("androidKeepAliveModalClose"),
      i = document.getElementById("androidTutorialGotItBtn"),
      a = document.getElementById("androidTutorialTestPushBtn");
    function r(t) {
      e.style.display = "none";
    }
    e &&
      (t &&
        !t._akiniBound &&
        ((t._akiniBound = !0),
        t.addEventListener("click", function (t) {
          e.style.display = "flex";
        })),
      n && !n._akiniBound && ((n._akiniBound = !0), n.addEventListener("click", r)),
      i && !i._akiniBound && ((i._akiniBound = !0), i.addEventListener("click", r)),
      e.addEventListener("click", function (t) {
        t.target === e && r(t);
      }),
      a &&
        !a._akiniBound &&
        ((a._akiniBound = !0),
        a.addEventListener("click", function (t) {
          var e = document.getElementById("testPushBtn");
          e && e.click();
        })));
  }
  function n() {
    var t = document.getElementById("openIOSKeepAliveModalBtn"),
      e = document.getElementById("iosKeepAliveModal"),
      n = document.getElementById("iosKeepAliveModalClose"),
      i = document.getElementById("iosTutorialGotItBtn"),
      a = document.getElementById("iosTutorialTestPushBtn");
    function r(t) {
      e.style.display = "none";
    }
    e &&
      (t &&
        !t._akiniBound &&
        ((t._akiniBound = !0),
        t.addEventListener("click", function (t) {
          e.style.display = "flex";
        })),
      n && !n._akiniBound && ((n._akiniBound = !0), n.addEventListener("click", r)),
      i && !i._akiniBound && ((i._akiniBound = !0), i.addEventListener("click", r)),
      e.addEventListener("click", function (t) {
        t.target === e && r(t);
      }),
      a &&
        !a._akiniBound &&
        ((a._akiniBound = !0),
        a.addEventListener("click", function (t) {
          var e = document.getElementById("testPushBtn");
          e && e.click();
        })));
  }
  ("loading" === document.readyState ? document.addEventListener("DOMContentLoaded", t) : t(),
    "loading" === document.readyState ? document.addEventListener("DOMContentLoaded", e) : e(),
    "loading" === document.readyState ? document.addEventListener("DOMContentLoaded", n) : n(),
    (document.getElementById("app-music") || document).addEventListener(
      "touchmove",
      function (t) {
        try {
          var e = document.getElementById("app-music");
          if (!e || "none" === e.style.display || !e.classList.contains("show")) return;
          var n = t.target;
          if (!n || !e.contains(n)) return;
          if (
            n.closest &&
            n.closest(
              "#musicPlaylistContainer,#musicContactList,#musicMenuPanel,#musicChatModal,.music-scrollable,input,textarea,button",
            )
          )
            return;
          t.preventDefault();
        } catch (t) {}
      },
      { passive: !1 },
    ));
})(),
  (function () {
    var t = !1,
      e = [],
      n = null,
      i = null,
      a = "akini_watch_session";
    function _saveSession(v) {
      try {
        localStorage.setItem(a, v);
      } catch (t) {}
      try {
        window.akiniStore && window.akiniStore.memorySet && window.akiniStore.memorySet(a, String(v));
      } catch (t) {}
    }
    function r() {
      try {
        if (!e.length) return void _saveSession('{"cleared":true}');
        var t = h("watchVideo"),
          n = h("watchFrame"),
          i = null;
        n && "none" !== n.style.display && n.src && 0 !== n.src.indexOf("about:blank")
          ? (i = { kind: "iframe", src: n.src })
          : t && "none" !== t.style.display && t.src && !/^blob:/.test(t.src) && (i = { kind: "video", src: t.src });
        var _sms = !1;
        try {
          _sms = !!JSON.parse(localStorage.getItem(a) || "{}").sysMsgShown;
        } catch (t) {}
        _saveSession(JSON.stringify({ partners: e, video: i, ts: Date.now(), sysMsgShown: _sms }));
      } catch (t) {}
    }
    function o() {
      w() && I();
      var t = h("watchVideo"),
        i = h("watchFrame");
      try {
        if (t) {
          if ((t.pause(), t.__hls)) {
            try {
              t.__hls.destroy();
            } catch (t) {}
            t.__hls = null;
          }
          (t.removeAttribute("src"), t.load && t.load(), (t.style.display = "none"));
        }
      } catch (t) {}
      try {
        i && ((i.src = "about:blank"), (i.style.display = "none"));
      } catch (t) {}
      var r = h("watchEmpty");
      r && (r.style.display = "flex");
      var o = h("watchControls");
      o && (o.style.display = "none");
      var c = h("watchDanmakuLayer");
      (c && (c.innerHTML = ""), n && (clearTimeout(n), (n = null)), l());
      var s = h("watchChatBody");
      (s && (s.innerHTML = ""), (e = []), _saveSession('{"cleared":true}'));
      var d = h("watchArea");
      d && (d.style.display = "none");
    }
    function c(t) {
      var e = t && String(t).trim();
      return e && /^(https?:|data:|blob:)/.test(e)
        ? '<img src="' + e + '" alt="" style="width:100%;height:100%;object-fit:cover"/>'
        : !e || (window.__akiniIsDefaultAvatarToken && window.__akiniIsDefaultAvatarToken(e))
          ? window.__akiniLineAvatarImg
            ? window.__akiniLineAvatarImg()
            : ""
          : m(e);
    }
    function s(t, e, n) {
      var i = h("watchChatBody");
      if (i) {
        var a = document.createElement("div");
        ((a.className = "msg-row other"), a.setAttribute("data-ts", String(__akiniNextTs())));
        var r = n
          ? '<div class="bubble sticker-bubble" style="background:transparent;padding:0;box-shadow:none;border:none;"><img src="' +
            n +
            '" style="max-width:120px;max-height:120px;border-radius:8px;display:block;" alt=""/ data-preserve-inline="1"></div>'
          : '<div class="bubble">' + m(e) + "</div>";
        ((a.innerHTML =
          '<div class="msg-content-line"><div class="msg-avatar" data-sender-name="' +
          m((t && t.name) || "") +
          '">' +
          c(t.avatar) +
          "</div>" +
          r +
          "</div>"),
          i.appendChild(a));
        try {
          window.__akiniProcessMsgMeta(a);
        } catch (t) {}
        ((i.scrollTop = i.scrollHeight), w() && !n && S((t.name ? t.name + "：" : "") + e));
        try {
          var o = h("watchArea");
          {
            /* 观影里的每条互动消息都要通知，不再因为「正在看观影页」就静默 */
            if (o && "none" === o.style.display) {
              try {
                window.__akiniIncrFeatureUnread && window.__akiniIncrFeatureUnread("watch");
              } catch (t) {}
            }
            window.showInAppNotif({
              app: "观影",
              appIcon: "🎬",
              avatar: (t && t.avatar) || "",
              name: (t && t.name) || "观影伙伴",
              fullContent: !0,
              msg: n ? "[表情包]" : e,
              onTap: function () {
                try {
                  window.__akiniOpenWatch && window.__akiniOpenWatch();
                } catch (t) {}
              },
            });
          }
        } catch (t) {}
      }
    }
    function l() {
      var t = h("watchTypingFloat");
      t && t.remove();
      var e = h("watchTypingRow");
      e && e.remove();
    }
    function d() {
      if (e.length && !n) {
        var t = parseFloat(localStorage.getItem("akini_num_replyDelayMin") || "3"),
          i = parseFloat(localStorage.getItem("akini_num_replyDelayMax") || "7");
        (t >= 0 || (t = 3), i >= t || (i = Math.max(t, 7)));
        var a = 1e3 * (t + Math.random() * (i - t));
        (!(function () {
          var t = h("watchInputBar");
          if (t && !h("watchTypingFloat")) {
            var e = document.createElement("div");
            ((e.id = "watchTypingFloat"),
              (e.className = "akini-typing-float"),
              (e.style.cssText =
                "position:absolute;left:14px;bottom:calc(100% + 8px);z-index:20;pointer-events:none;transition:opacity 0.2s ease;"),
              (e.innerHTML =
                '<div class="akcp-typing"><span class="wt-dot"></span><span class="wt-dot"></span><span class="wt-dot"></span></div>'),
              (t.style.position = "relative"),
              t.appendChild(e));
          }
        })(),
          (n = setTimeout(function () {
            ((n = null), l());
            h("watchArea");
            var t = Math.random(),
              i = t < 0.75 ? 1 : t < 0.95 ? 2 : 3,
              a = e[Math.floor(Math.random() * e.length)];
            if (a && Math.random() < 0.2) {
              var r = (function (t) {
                var e = [];
                try {
                  if ("function" == typeof window.__akiniStickerSrcs) e = window.__akiniStickerSrcs(t);
                  else {
                    var n = window.getContactStickersSync(t);
                    (Array.isArray(n) ? n : []).forEach(function (t) {
                      var n = "";
                      ("string" == typeof t
                        ? (n = t)
                        : t && "string" == typeof t.s
                          ? (n = t.s)
                          : t && (t.url || t.src || t.data) && (n = String(t.url || t.src || t.data)),
                        (!t || "object" != typeof t || (1 !== t.b && !0 !== t.b && "1" !== t.b)) &&
                          /^data:image\//.test(n) &&
                          e.push(n));
                    });
                  }
                } catch (t) {}
                return e;
              })(a.id);
              r.length && (s(a, "", r[Math.floor(Math.random() * r.length)]), (i = Math.max(0, i - 1)));
            }
            var o = function (t) {
              if (!(t <= 0)) {
                var n = e[Math.floor(Math.random() * e.length)],
                  i = (function (t) {
                    try {
                      var e = (
                        (window.__wbRead
                          ? window.__wbRead("akini_wordbank", [])
                          : JSON.parse(localStorage.getItem("akini_wordbank") || "[]")) || []
                      ).filter(function (t) {
                        return !t.tab || "main" === t.tab;
                      });
                      window.__wbFilter && (e = window.__wbFilter(e, t) || []);
                      var n = [];
                      return (
                        e.forEach(function (t) {
                          var e = String((t && (t.text || t.content)) || "").trim();
                          e && e.length <= 60 && n.push(e);
                        }),
                        n.length ? n[Math.floor(Math.random() * n.length)] : ""
                      );
                    } catch (t) {
                      return "";
                    }
                  })(n && n.id);
                (i && s(n, i),
                  t > 1 &&
                    setTimeout(
                      function () {
                        o(t - 1);
                      },
                      900 + 900 * Math.random(),
                    ));
              }
            };
            o(i);
          }, a)));
      }
    }
    function u(t) {
      var e = h("watchChatBody");
      if (e) {
        var n = document.createElement("div");
        ((n.className = "msg-row system"),
          (n.style.cssText = "text-align:center;margin:8px 0"),
          (n.innerHTML =
            '<span style="display:inline-block;font-size:12px;color:#999;background:rgba(0,0,0,.05);border-radius:10px;padding:3px 10px">' +
            m(t) +
            "</span>"),
          e.appendChild(n),
          (e.scrollTop = e.scrollHeight));
      }
    }
    function f() {
      var t = h("watchPickerList");
      if (t) {
        var n = [];
        try {
          n = (
            (window.akiniContacts && window.akiniContacts.getContacts ? window.akiniContacts.getContacts() : []) || []
          ).filter(function (t) {
            return t && t.id && "group" !== t.type;
          });
        } catch (t) {}
        ((t.innerHTML = ""),
          n.length ||
            (t.innerHTML =
              '<div style="text-align:center;color:#bbb;padding:60px 0;font-size:14px">还没有联系人，先去微信里添加吧</div>'),
          n.forEach(function (n) {
            var i = e.some(function (t) {
                return t.id === n.id;
              }),
              a = document.createElement("div");
            ((a.style.cssText =
              "display:flex;align-items:center;gap:12px;padding:11px 4px;border-bottom:1px solid #f5f5f5;cursor:pointer;-webkit-tap-highlight-color:transparent"),
              (a.innerHTML =
                '<div style="width:22px;height:22px;border-radius:50%;border:2px solid ' +
                (i ? "#1a1a1a" : "#ddd") +
                ";background:" +
                (i ? "#1a1a1a" : "#fff") +
                ';color:#fff;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
                (i ? "✓" : "") +
                '</div><div style="width:42px;height:42px;border-radius:50%;overflow:hidden;background:#e8e8e8;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">' +
                c(n.avatar) +
                '</div><div style="flex:1;min-width:0;font-size:16px;color:#1a1a1a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
                m(n.name || "联系人") +
                "</div>"),
              a.addEventListener("click", function () {
                var t = -1;
                (e.forEach(function (e, i) {
                  e.id === n.id && (t = i);
                }),
                  t >= 0 ? e.splice(t, 1) : e.push({ id: n.id, name: n.name, avatar: n.avatar }),
                  f());
              }),
              t.appendChild(a));
          }));
        var i = h("watchPickerConfirm");
        i && (i.textContent = e.length ? "开始观影（" + e.length + "）" : "开始观影");
      }
    }
    function y() {
      f();
      var d = window.__akiniDefaultContact && window.__akiniDefaultContact();
      if (d) {
        e = [{ id: d.id, name: d.name, avatar: d.avatar }];
        try {
          r();
        } catch (x) {}
        var wa = h("watchArea");
        if (wa) wa.style.display = "flex";
        try {
          u((d.name || "联系人") + " 加入了一起观影");
          try {
            var _sy = JSON.parse(localStorage.getItem(a) || "{}");
            _sy.sysMsgShown = true;
            _saveSession(JSON.stringify(_sy));
          } catch (t) {}
        } catch (x) {}
        return;
      }
      var t = h("watchContactPicker");
      if (t) t.style.display = "flex";
      else {
        var wa2 = h("watchArea");
        wa2 && (wa2.style.display = "flex");
      }
    }
    function h(t) {
      return document.getElementById(t);
    }
    function m(t) {
      return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    var v = !1;
    function w() {
      return v || !(!document.fullscreenElement && !document.webkitFullscreenElement);
    }
    function g(t) {
      var e = h("watchVideo"),
        n = h("watchFrame"),
        i = h("watchEmpty"),
        a = h("watchControls");
      (i && (i.style.display = "none"),
        e && (e.style.display = "video" === t ? "block" : "none"),
        n && (n.style.display = "iframe" === t ? "block" : "none"),
        a && (a.style.display = "video" === t ? "flex" : "none"));
    }
    function k(t) {
      return ((t = Math.max(0, Math.floor(t || 0))), Math.floor(t / 60) + ":" + ("0" + (t % 60)).slice(-2));
    }
    function _() {
      var t = h("watchVideo"),
        e = t && !t.paused && !t.ended,
        n = h("watchPlayIcon"),
        i = h("watchPauseIcon");
      (n && (n.style.display = e ? "none" : "block"), i && (i.style.display = e ? "block" : "none"));
    }
    function b() {
      window.__akiniPromptModal(
        "粘贴视频链接",
        "粘贴含 BV 号的链接或视频直链",
        function (t) {
          if (null != t && (t = String(t).trim())) {
            var e = t.match(/https?:\/\/[^\s"'<>]+/);
            if (e) {
              var n = e[0].replace(/[，。；、]+$/, ""),
                i = h("watchVideo"),
                a = h("watchFrame");
              try {
                i && (i.pause(), i.removeAttribute("src"), i.load && i.load());
              } catch (t) {}
              a && (a.src = "about:blank");
              var o = n.match(/BV[0-9A-Za-z]{10}/);
              if (o) {
                g("iframe");
                try {
                  a.setAttribute("referrerpolicy", "no-referrer");
                } catch (t) {}
                var _bv = o[0],
                  _bili =
                    "https://player.bilibili.com/player.html?isOutside=true&bvid=" +
                    _bv +
                    "&p=1&autoplay=1&high_quality=1&danmaku=1";
                a.__akiniSeq = (a.__akiniSeq || 0) + 1;
                var _seq = a.__akiniSeq,
                  _ok = !1;
                a.onload = function () {
                  a.__akiniSeq === _seq && (_ok = !0);
                };
                a.src = _bili;
                r();
                setTimeout(function () {
                  if (_ok || a.__akiniSeq !== _seq) return;
                  try {
                    u("B站播放器没能加载出来：这条视频可能限制了站外播放或地区，点「确定」用浏览器打开原视频");
                    var _go = confirm(
                      "B站播放器在这个浏览器里打不开（视频可能限制了站外播放/地区，或浏览器拦截了第三方内嵌）。\n\n要改用浏览器或哔哩哔哩App打开这条视频吗？",
                    );
                    _go && window.open(_bili.replace("&autoplay=1", ""), "_blank");
                  } catch (t) {}
                }, 8000);
                return;
              }
              if (/b23\.tv\//.test(n)) alert("哔哩哔哩短链无法直接解析，请打开视频页复制含 BV 号的完整链接");
              else if (/douyin\.com\//.test(n)) alert("抖音链接暂不支持导入");
              else if (/\.(mp4|webm|ogg|mov|m3u8)(\?|$)/i.test(n) || /^https?:\/\//.test(n)) {
                if ((g("video"), /\.m3u8(\?|$)/i.test(n) && window.Hls && window.Hls.isSupported()))
                  try {
                    i.__hls && i.__hls.destroy();
                    var c = new window.Hls();
                    ((i.__hls = c), c.loadSource(n), c.attachMedia(i));
                  } catch (t) {
                    i.src = n;
                  }
                else i.src = n;
                return (i.play && i.play().catch(function () {}), void r());
              }
            } else alert("没有识别到链接，请检查粘贴内容");
          }
        },
        {
          desc: "· 哔哩哔哩：含 BV 号的视频页链接（站内直接播放）\n· mp4/m3u8 视频直链（站内直接播放）\n\n链接仅本次有效，不会保存",
        },
      );
    }
    function x(t, e, q) {
      var n = h("watchChatBody");
      if (n) {
        var i = "";
        try {
          i = (window.getMyAvatar()) || "";
        } catch (t) {}
        var a = document.createElement("div");
        ((a.className = "msg-row me"), a.setAttribute("data-ts", String(__akiniNextTs())));
        var r = e
          ? '<div class="bubble sticker-bubble" style="background:transparent;padding:0;box-shadow:none;border:none;"><img src="' +
            e +
            '" style="max-width:120px;max-height:120px;border-radius:8px;display:block;" alt=""/ data-preserve-inline="1"></div>'
          : '<div class="bubble">' + m(t) + "</div>";
        /* 引用：与主聊天一致，气泡下方整宽引用卡（右对齐，留出头像位 46px） */
        var qh = "";
        if (q && window.__akiniQuoteCardHtml)
          qh =
            '<div style="flex-basis:100%;width:100%;box-sizing:border-box;margin-top:2px;padding-right:46px;text-align:right;">' +
            window.__akiniQuoteCardHtml(q.n, q.t, q.s, q.mh) +
            "</div>";
        ((a.innerHTML = '<div class="msg-content-line">' + r + '<div class="msg-avatar">' + i + "</div></div>" + qh),
          n.appendChild(a));
        try {
          window.__akiniProcessMsgMeta(a);
        } catch (t) {}
        n.scrollTop = n.scrollHeight;
      }
    }
    function S(t) {
      var e = h("watchDanmakuLayer");
      if (e) {
        var n = document.createElement("div");
        n.textContent = t;
        var i = 8 + 62 * Math.random();
        ((n.style.cssText =
          "position:absolute;left:100%;top:" +
          i +
          "%;white-space:nowrap;font-size:16px;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.6);pointer-events:none;will-change:transform;transition:transform 7s linear"),
          e.appendChild(n),
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              var t = e.clientWidth + n.offsetWidth + 40;
              n.style.transform = "translateX(-" + t + "px)";
            });
          }),
          setTimeout(function () {
            n.remove();
          }, 7300));
      }
    }
    function E(t) {
      var e = h(t ? "watchMsgInputFs" : "watchMsgInput");
      if (e) {
        var n = e.value.trim(),
          i = window.__watchPendingSticker || null;
        if (n || i) {
          /* 引用：读取输入框上的 data-quote（长按消息"引用"写入） */
          var q = null;
          if (!i && e.getAttribute && e.getAttribute("data-quote")) {
            var qs = e.getAttribute("data-quote") || "";
            var qn = qs.replace(/[：:].*/, "").trim() || qs;
            var qt = qs.length > qn.length ? qs.slice(qn.length).replace(/^[：:]/, "").trim() : "";
            q = {
              n: qn,
              t: qt,
              s: e.getAttribute("data-quote-sticker") || "",
              mh: e.getAttribute("data-quote-sticker-mh") || "",
            };
          }
          ((window.__watchPendingSticker = null),
            (e.value = ""),
            e.__stickerHint &&
              ((e.placeholder = e.__origPh || ("msgInput" === e.id ? "iMessage信息" : "发送消息…")),
              (e.__stickerHint = !1)),
            x(n, i, q),
            n && w() && S(n),
            d());
          if (q) {
            (e.removeAttribute("data-quote"),
              e.removeAttribute("data-quote-sticker"),
              e.removeAttribute("data-quote-sticker-mh"),
              (e.placeholder = e.__origPh || "发弹幕…"));
            var qb = h("watchQuoteBar");
            qb && qb.classList.remove("show");
          }
          try {
            if (window.__akiniToggleOn && window.__akiniToggleOn("readReceiptToggle")) {
              var a = 1500 + 2500 * Math.random();
              setTimeout(function () {
                try {
                  var t = h("watchChatBody");
                  if (!t) return;
                  t.querySelectorAll(".msg-row.me").forEach(function (t) {
                    if ("1" !== t.getAttribute("data-had-read-receipt")) {
                      (t.setAttribute("data-had-read-receipt", "1"), t.removeAttribute("data-read-pending"));
                      var e = t.querySelector(":scope .msg-rr");
                      if (!e) {
                        (((e = document.createElement("span")).className = "msg-rr"), (e.textContent = "已读"));
                        var n = t.querySelector(":scope > .msg-content-line"),
                          i = n && n.querySelector(":scope > .bubble-wrap");
                        i ? i.appendChild(e) : (n || t).appendChild(e);
                      }
                      e.style.visibility = "visible";
                    }
                  });
                } catch (t) {}
              }, a);
            }
          } catch (t) {}
        }
      }
    }
    function B() {
      var t = w(),
        e = h("watchDanmakuLayer"),
        n = h("watchFloatInputBar"),
        i = h("watchVideo"),
        a = h("watchFrame"),
        r = h("watchEmpty");
      (e && (e.style.display = t ? "block" : "none"), n && (n.style.display = t ? "flex" : "none"));
      var o = h("watchControls");
      (o && (o.style.bottom = t ? "52px" : "0"),
        [i, a, r].forEach(function (e) {
          e &&
            (t
              ? ((e.style.aspectRatio = "auto"), (e.style.height = "100%"), (e.style.width = "100%"))
              : ((e.style.height = ""), (e.style.aspectRatio = "16/9")));
        }));
    }
    function I() {
      var t = h("watchVideoBox");
      if (t) {
        if (v) return ((v = !1), t.classList.remove("watch-pseudo-fs"), (document.body.style.overflow = ""), void B());
        if (w()) {
          (document.exitFullscreen || document.webkitExitFullscreen).call(document);
          try {
            screen.orientation && screen.orientation.unlock && screen.orientation.unlock();
          } catch (t) {}
        } else {
          var e = t.requestFullscreen || t.webkitRequestFullscreen;
          if (!((!document.fullscreenEnabled && !document.webkitFullscreenEnabled) || !e)) {
            try {
              var n = e.call(t);
              n && n.catch && n.catch(function () {});
            } catch (t) {}
            try {
              screen.orientation &&
                screen.orientation.lock &&
                screen.orientation.lock("landscape").catch(function () {});
            } catch (t) {}
          } else ((v = !0), t.classList.add("watch-pseudo-fs"), (document.body.style.overflow = "hidden"), B());
        }
      }
    }
    function M() {
      if (!t) {
        t = !0;
        var a = h("watchVideo");
        (h("watchPlayPause").addEventListener("click", function () {
          a && (a.paused || a.ended ? a.play && a.play().catch(function () {}) : a.pause());
        }),
          h("watchBack10").addEventListener("click", function () {
            a && isFinite(a.duration) && (a.currentTime = Math.max(0, a.currentTime - 10));
          }),
          h("watchFwd10").addEventListener("click", function () {
            a && isFinite(a.duration) && (a.currentTime = Math.min(a.duration, a.currentTime + 10));
          }));
        var c = h("watchSeek"),
          s = !1;
        (c.addEventListener("input", function () {
          ((s = !0),
            a && isFinite(a.duration) && a.duration > 0 && (a.currentTime = (parseFloat(c.value) / 1e3) * a.duration));
        }),
          c.addEventListener("change", function () {
            s = !1;
          }),
          a.addEventListener("timeupdate", function () {
            !s &&
              isFinite(a.duration) &&
              a.duration > 0 &&
              (c.value = String(Math.round((a.currentTime / a.duration) * 1e3)));
            var t = h("watchCurTime");
            t && (t.textContent = k(a.currentTime));
          }),
          a.addEventListener("loadedmetadata", function () {
            var t = h("watchDurTime");
            t && (t.textContent = k(a.duration));
          }),
          a.addEventListener("play", _),
          a.addEventListener("pause", _),
          a.addEventListener("ended", _),
          a.addEventListener("click", function () {
            a.paused || a.ended ? a.play && a.play().catch(function () {}) : a.pause();
          }),
          h("watchBackBtn").addEventListener("click", function () {
            w() && I();
            var t = h("watchVideo");
            try {
              t && t.pause();
            } catch (t) {}
            var e = h("watchDanmakuLayer");
            /* 退出观影页时不要取消「对方正在回消息」的定时器：
               像微信一样，回复在后台继续送达，回到页面即可看到完整对话 */
            (e && (e.innerHTML = ""), r(), (h("watchArea").style.display = "none"));
          }),
          h("watchImportBtn").addEventListener("click", b),
          h("watchSendBtn").addEventListener("click", function () {
            E(!1);
          }),
          h("watchSendBtnFs").addEventListener("click", function () {
            E(!0);
          }),
          h("watchMsgInput").addEventListener("keydown", function (t) {
            "Enter" === t.key && E(!1);
          }),
          h("watchMsgInputFs").addEventListener("keydown", function (t) {
            "Enter" === t.key && E(!0);
          }),
          document.addEventListener("fullscreenchange", B),
          document.addEventListener("webkitfullscreenchange", B));
        var d = h("watchMenuOverlay"),
          f = h("watchMenuBtn");
        (f &&
          f.addEventListener("click", function (t) {
            d && (d.style.display = "flex");
          }),
          d &&
            d.addEventListener("click", function (t) {
              t.target === d && P();
            }));
        var y = h("watchMenuCancel");
        y && y.addEventListener("click", P);
        var m = h("watchMenuLocal");
        m &&
          m.addEventListener("click", function () {
            P();
            var t = h("watchLocalFileInput");
            t && t.click();
          });
        var v = h("watchLocalFileInput");
        v &&
          v.addEventListener("change", function () {
            var t = this.files && this.files[0];
            (t &&
              (function (t) {
                if (t) {
                  var e = h("watchVideo"),
                    n = h("watchFrame");
                  try {
                    i && (URL.revokeObjectURL(i), (i = null));
                  } catch (t) {}
                  try {
                    e && (e.pause(), e.removeAttribute("src"), e.load && e.load());
                  } catch (t) {}
                  (n && (n.src = "about:blank"),
                    (i = URL.createObjectURL(t)),
                    g("video"),
                    e && ((e.src = i), e.play && e.play().catch(function () {})),
                    u("已导入本地视频：" + (t.name || "视频")),
                    r());
                }
              })(t),
              (this.value = ""));
          });
        var L = h("watchMenuExit");
        L &&
          L.addEventListener("click", function () {
            (P(), o());
          });
        var C = h("watchPickerBackBtn");
        C &&
          C.addEventListener("click", function () {
            var t = h("watchContactPicker");
            t && (t.style.display = "none");
          });
        var T = h("watchPickerConfirm");
        T &&
          T.addEventListener("click", function () {
            if (e.length) {
              var t = h("watchContactPicker");
              t && (t.style.display = "none");
              var n = h("watchArea");
              (n && (n.style.display = "flex"), p());
              try {
                window.__akiniRefreshChatMeta();
              } catch (t) {}
              u(
                e
                  .map(function (t) {
                    return t.name || "联系人";
                  })
                  .join("、") + " 加入了一起观影",
              );
              try {
                var _ss = JSON.parse(localStorage.getItem(a) || "{}");
                _ss.sysMsgShown = true;
                _saveSession(JSON.stringify(_ss));
              } catch (t) {}
              r();
            } else window.__akiniCenterModal("提示", "先选择至少 1 位想一起看的人");
          });
      }
      function P() {
        d && (d.style.display = "none");
      }
    }
    ((window.__watchSendStickerDirect = function (t) {
      (x("", t), d());
    }),
      (window.__akiniOpenWatch = function () {
        try {
          try {
            window.__akiniClearFeatureUnread && window.__akiniClearFeatureUnread("watch");
          } catch (t) {}
          M();
          try {
            window.applyBubbleCss(localStorage.getItem("akini_bubble_css") || "");
          } catch (t) {}
          var t = (function () {
            try {
              var t = JSON.parse(localStorage.getItem(a) || "null");
              return t && t.partners && t.partners.length ? t : null;
            } catch (t) {
              return null;
            }
          })();
          if (t) {
            e = t.partners.filter(function (t) {
              return t && t.id;
            });
            var n = h("watchArea");
            (n && (n.style.display = "flex"), p());
            if (!t.sysMsgShown) {
              try {
                u(
                  e
                    .map(function (t) {
                      return t.name || "联系人";
                    })
                    .join("、") + " 加入了一起观影",
                );
              } catch (t) {}
              try {
                var _sess = JSON.parse(localStorage.getItem(a) || "{}");
                _sess.sysMsgShown = true;
                _saveSession(JSON.stringify(_sess));
              } catch (t) {}
            }
            try {
              var i = h("watchVideo"),
                r = h("watchFrame");
              !(
                (r && "none" !== r.style.display && r.src && 0 !== r.src.indexOf("about:blank")) ||
                (i && "none" !== i.style.display && !!i.src)
              ) &&
                t.video &&
                t.video.src &&
                ("iframe" === t.video.kind
                  ? (g("iframe"), (r.src = t.video.src))
                  : (g("video"), (i.src = t.video.src), i.play && i.play().catch(function () {})));
            } catch (t) {}
            try {
              window.__akiniRefreshChatMeta();
            } catch (t) {}
            return;
          }
          y();
        } catch (t) {
          var o = h("watchArea");
          o && (o.style.display = "flex");
        }
      }));
  })(),
  (function () {
    "use strict";
    function t(t) {
      return "icity" === t ? "akini_icity_notifications" : "akini_friends_notifications";
    }
    function e(e) {
      try {
        var n = localStorage.getItem(t(e));
        return (null == n && (n = localStorage.getItem(t(e) + "_backup")), JSON.parse(n || "[]"));
      } catch (t) {
        return [];
      }
    }
    function n(e, n) {
      try {
        var i = JSON.stringify(n);
        localStorage.setItem(t(e), i);
        try {
          localStorage.setItem(t(e) + "_backup", i);
        } catch (t) {}
      } catch (t) {}
    }
    function i(t, e) {
      var n = (function (t) {
        var e = document.getElementById(t);
        if (!e) return null;
        var n = e.querySelector(".icon-wrap") || e;
        ((n.style.position = "relative"), (n.style.overflow = "visible"));
        var i = n.querySelector(".home-badge");
        return (
          i ||
            (((i = document.createElement("span")).className = "home-badge"),
            i.setAttribute("data-count", "0"),
            (i.textContent = ""),
            n.appendChild(i)),
          i
        );
      })(t);
      n &&
        (e > 0
          ? ((n.textContent = e > 99 ? "99+" : String(e)),
            n.setAttribute("data-count", String(e)),
            n.style.setProperty("display", "inline-flex", "important"),
            n.style.setProperty("visibility", "visible", "important"),
            n.style.setProperty("opacity", "1", "important"),
            (n.style.alignItems = "center"),
            (n.style.justifyContent = "center"))
          : ((n.textContent = ""),
            n.setAttribute("data-count", "0"),
            n.style.setProperty("display", "none", "important"),
            n.style.setProperty("visibility", "hidden", "important"),
            n.style.setProperty("opacity", "0", "important")));
    }
    function a(t) {
      try {
        return Math.max(0, parseInt(localStorage.getItem("akini_" + t + "_unread") || "0", 10) || 0);
      } catch (t) {
        return 0;
      }
    }
    function r(t) {
      var n = document.getElementById("icity" === t ? "icityNotifBadge" : "friendsNotifBadge");
      if (n) {
        var i = e(t).filter(function (t) {
          return !t.read;
        }).length;
        i > 0
          ? ((n.textContent = i > 99 ? "99+" : String(i)),
            n.setAttribute("data-count", String(i)),
            n.style.setProperty("display", "inline-flex", "important"),
            n.style.setProperty("visibility", "visible", "important"),
            n.style.setProperty("opacity", "1", "important"),
            (n.style.alignItems = "center"),
            (n.style.justifyContent = "center"),
            (n.style.background = "#ffffff"),
            (n.style.color = "#1a1a1a"),
            (n.style.border = "1px solid rgba(0,0,0,.1)"),
            (n.style.boxShadow = "0 1px 4px rgba(0,0,0,.18)"),
            (n.style.fontWeight = "600"))
          : ((n.textContent = ""),
            n.setAttribute("data-count", "0"),
            n.style.setProperty("display", "none", "important"),
            n.style.setProperty("visibility", "hidden", "important"),
            n.style.setProperty("opacity", "0", "important"));
      }
    }
    function o() {}
    function c(t) {
      var i = document.getElementById("icity" === t ? "icityNotifList" : "friendsNotifList");
      if (i) {
        var a = e(t).slice().reverse();
        if (((i.innerHTML = ""), a.length)) {
          a.forEach(function (e) {
            var n = document.createElement("div");
            n.style.cssText =
              "background:#fff;padding:12px 14px;display:flex;gap:12px;align-items:flex-start;cursor:pointer;-webkit-tap-highlight-color:transparent;border-bottom:1px solid #f0f0f0;";
            var a = (function (t, e) {
                try {
                  if ("icity" === t) {
                    for (
                      var n = localStorage.getItem("akini_icity_diaries"), i = n ? JSON.parse(n) : [], a = 0;
                      a < i.length;
                      a++
                    )
                      if (String(i[a] && i[a].id) === String(e)) {
                        var r = i[a];
                        return { img: (r.images && r.images[0]) || "", text: (r.text || "").trim() };
                      }
                  } else
                    for (var o = window.__akiniGetPosts ? window.__akiniGetPosts() : [], c = 0; c < o.length; c++)
                      if (String(o[c] && o[c].id) === String(e)) {
                        var s = o[c];
                        return {
                          img: s.img || (s.images && s.images[0]) || "",
                          text: (s.text || s.content || "").trim(),
                        };
                      }
                } catch (t) {}
                return { img: "", text: "" };
              })(t, e.momentId),
              r =
                "like" === e.type
                  ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#666" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;min-width:18px;min-height:18px;flex-shrink:0;display:inline-block;vertical-align:middle;"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>'
                  : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#666" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;min-width:18px;min-height:18px;flex-shrink:0;display:inline-block;vertical-align:middle;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
              o = "";
            o =
              "reply" === e.type
                ? '<span style="font-size:12px;color:#888;flex-shrink:0;">回复了' +
                  String(e.replyTo || "").replace(/</g, "&lt;") +
                  "：</span>" +
                  (e.sticker
                    ? '<img src="' +
                      e.sticker +
                      '" style="width:26px;height:26px;object-fit:contain;border-radius:4px;flex-shrink:0;" alt=""/>'
                    : '<span style="font-size:12px;color:#888;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;">' +
                      String(e.text || "").replace(/</g, "&lt;") +
                      "</span>")
                : e.sticker
                  ? '<img src="' +
                    e.sticker +
                    '" style="width:28px;height:28px;object-fit:contain;border-radius:4px;flex-shrink:0;" alt=""/>'
                  : e.text
                    ? '<span style="font-size:12px;color:#888;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;">' +
                      String(e.text).replace(/</g, "&lt;") +
                      "</span>"
                    : "";
            var c,
              s,
              l = a.img
                ? '<div style="width:56px;height:56px;border-radius:6px;overflow:hidden;flex-shrink:0;background:#eee;"><img src="' +
                  a.img +
                  '" style="width:100%;height:100%;object-fit:cover;" alt=""/></div>'
                : '<div style="width:72px;flex-shrink:0;font-size:12px;color:#666;line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;word-break:break-all;">' +
                  (a.text || "").replace(/</g, "&lt;") +
                  "</div>";
            ((n.innerHTML =
              '<div style="width:40px;height:40px;border-radius:50%;background:#eee;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;">' +
              ((c = "string" == typeof e.avatar ? e.avatar : ""),
              (s = 40),
              (c && 0 === c.indexOf("data:")
                ? '<img src="' + c + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt=""/>'
                : window.__akiniLineAvatarImg
                  ? window.__akiniLineAvatarImg()
                  : "") +
                '</div><div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:600;color:#222;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">') +
              (e.name || "对方") +
              '</div><div style="display:flex;align-items:center;gap:6px;margin-top:5px;min-width:0;width:100%;overflow:hidden;">' +
              r +
              o +
              '</div><div style="font-size:11px;color:#bbb;margin-top:5px;">' +
              (function (t) {
                if (window.__akiniNaturalTime) return window.__akiniNaturalTime(t);
                try {
                  var e = new Date(t),
                    n = Date.now() - t;
                  return n < 6e4
                    ? "刚刚"
                    : n < 36e5
                      ? Math.floor(n / 6e4) + "分钟前"
                      : n < 864e5
                        ? Math.floor(n / 36e5) + "小时前"
                        : e.getMonth() + 1 + "月" + e.getDate() + "日";
                } catch (t) {
                  return "";
                }
              })(e.ts) +
              "</div></div>" +
              l),
              n.addEventListener("click", function () {
                !(function (t, e) {
                  var n = document.getElementById("icity" === t ? "icityNotifModal" : "friendsNotifModal");
                  if ((n && (n.style.display = "none"), "icity" === t)) {
                    try {
                      window.navTo && window.navTo("icity");
                    } catch (t) {}
                    setTimeout(function () {
                      try {
                        window.akiniGoIcityTab && window.akiniGoIcityTab("1");
                      } catch (t) {}
                      setTimeout(function () {
                        var t = document.querySelector('[data-diary-id="' + e + '"]');
                        t &&
                          (t.scrollIntoView({ behavior: "smooth", block: "center" }),
                          (t.style.transition = "box-shadow .3s"),
                          (t.style.boxShadow = "0 0 0 2px #4a90e2"),
                          setTimeout(function () {
                            t.style.boxShadow = "";
                          }, 1600));
                      }, 320);
                    }, 80);
                  } else {
                    try {
                      window.navTo && window.navTo("friends");
                    } catch (t) {}
                    setTimeout(function () {
                      try {
                        for (
                          var t = (window.__akiniGetPosts ? window.__akiniGetPosts() : [])
                              .filter(function (t) {
                                return "icity" !== t.source;
                              })
                              .sort(function (t, e) {
                                return (e.ts || 0) - (t.ts || 0);
                              }),
                            n = -1,
                            i = 0;
                          i < t.length;
                          i++
                        )
                          if (String(t[i].id) === String(e) || String(t[i].ts) === String(e)) {
                            n = i;
                            break;
                          }
                        if (n >= 0) {
                          var a = document.querySelector('.post-item[data-idx="' + n + '"]');
                          if (a) {
                            a.scrollIntoView({ behavior: "smooth", block: "center" });
                            var r = document.createElement("div");
                            ((r.className = "jump-highlight-layer"),
                              (r.style.cssText =
                                "position:absolute;inset:0;border:2px solid #1a1a1a;border-radius:10px;background:rgba(0,0,0,0.04);pointer-events:none;z-index:10;box-sizing:border-box;"));
                            var o = a.style.position;
                            ("static" === getComputedStyle(a).position && (a.style.position = "relative"),
                              a.appendChild(r),
                              setTimeout(function () {
                                try {
                                  r.remove();
                                } catch (t) {}
                                a.style.position = o || "";
                              }, 2e3));
                          }
                        }
                      } catch (t) {}
                    }, 320);
                  }
                })(t, e.momentId);
              }),
              i.appendChild(n));
          });
          var r = e(t),
            o = !1;
          (r.forEach(function (t) {
            t.read || ((t.read = !0), (o = !0));
          }),
            o && n(t, r),
            window.__updateHomeBadges());
        } else
          i.innerHTML =
            '<div style="color:#999;text-align:center;padding:60px 20px;font-size:14px;">还没有新消息</div>';
      }
    }
    function s(t) {
      var e = document.getElementById("icity" === t ? "icityNotifModal" : "friendsNotifModal");
      if (e) {
        try {
          e.style.setProperty("z-index", "2147483640", "important");
        } catch (t) {
          e.style.zIndex = "9600";
        }
        try {
          e.classList.add("open");
        } catch (t) {}
        (c(t), (e.style.display = "flex"));
      }
    }
    function l() {
      var t = document.getElementById("friendsNotifBtn");
      t &&
        !t.__bound &&
        ((t.__bound = 1),
        t.addEventListener("click", function (t) {
          (t.preventDefault(), s("friends"));
        }));
      var e = document.getElementById("icityNotifBtn");
      e &&
        !e.__bound &&
        ((e.__bound = 1),
        e.addEventListener("click", function (t) {
          (t.preventDefault(), s("icity"));
        }));
      var n = document.getElementById("friendsNotifBack");
      n &&
        !n.__bound &&
        ((n.__bound = 1),
        n.addEventListener("click", function () {
          var t = document.getElementById("friendsNotifModal");
          if (t) {
            try {
              t.classList.remove("open");
            } catch (t) {}
            t.style.display = "none";
          }
        }));
      var i = document.getElementById("icityNotifBack");
      i &&
        !i.__bound &&
        ((i.__bound = 1),
        i.addEventListener("click", function () {
          var t = document.getElementById("icityNotifModal");
          if (t) {
            try {
              t.classList.remove("open");
            } catch (t) {}
            t.style.display = "none";
          }
        }));
    }
    ((window.__akiniPushNotif = function (t, i, a, r, o, c, s) {
      try {
        if ("friends" !== t && "icity" !== t) return;
        var l = e(t),
          d = {
            id: "n_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
            type: i,
            name: a || "对方",
            avatar: r || "",
            text: String(o || "").slice(0, 60),
            momentId: String(c || ""),
            ts: Date.now(),
            read: !1,
          };
        (s && s.sticker && (d.sticker = s.sticker),
          s && s.replyTo && (d.replyTo = s.replyTo),
          l.push(d),
          l.length > 100 && (l = l.slice(-100)),
          n(t, l),
          window.__updateHomeBadges && window.__updateHomeBadges());
      } catch (t) {}
    }),
      (window.__akiniIncrFeatureUnread = function (t, e) {
        try {
          var n = "akini_" + t + "_unread",
            i = Math.max(0, parseInt(localStorage.getItem(n) || "0", 10) || 0) + (e || 1);
          (localStorage.setItem(n, String(i)), window.__updateHomeBadges && window.__updateHomeBadges());
        } catch (t) {}
      }),
      (window.__akiniClearFeatureUnread = function (t) {
        try {
          (localStorage.setItem("akini_" + t + "_unread", "0"),
            window.__updateHomeBadges && window.__updateHomeBadges());
        } catch (t) {}
      }),
      (window.__updateHomeBadges = function () {
        var t = {};
        try {
          window.akiniContacts && window.akiniContacts.getSessions && (t = window.akiniContacts.getSessions() || {});
        } catch (t) {}
        try {
          var n = 0;
          (Object.keys(t).forEach(function (e) {
            n += Number(t[e].unread || 0);
          }),
            i("appBtnChat", n));
        } catch (t) {}
        try {
          var o = [];
          try {
            o = JSON.parse(localStorage.getItem("akini_mail_received") || "[]");
          } catch (t) {}
          var c = o.filter(function (t) {
            return !(t && (t.read || t.isRead));
          }).length;
          i("appBtnMail", Math.max(0, c));
        } catch (t) {}
        try {
          var s =
            e("friends").filter(function (t) {
              return !t.read;
            }).length + a("friends");
          i("appBtnFriends", Math.max(0, s));
        } catch (t) {}
        try {
          var l =
            e("icity").filter(function (t) {
              return !t.read;
            }).length + a("icity");
          i("appBtnIcity", Math.max(0, l));
        } catch (t) {}
        try {
          i("appBtnWatch", a("watch"));
        } catch (t) {}
        try {
          i("appBtnCompanion", a("companion"));
        } catch (t) {}
        try {
          r("friends");
        } catch (t) {}
        try {
          r("icity");
        } catch (t) {}
        try {
          var _homeList = document.getElementById("app-chat-list");
          var y = _homeList ? _homeList.querySelectorAll(".chat-list-item") : [];
          y &&
            y.length &&
            y.forEach(function (e) {
              var n = e.getAttribute("data-id") || e.getAttribute("data-chat-id");
              if (n) {
                var i = t[n] || {},
                  a = Number(i.unread || 0),
                  r = e.querySelector(".cli-unread-badge");
                if (a > 0) {
                  if (!r) {
                    var o = e.querySelector(".cli-avatar-wrap") || e.querySelector(".cli-avatar");
                    (o && ((o.style.position = "relative"), (o.style.overflow = "visible")),
                      o && (((r = document.createElement("span")).className = "cli-unread-badge"), o.appendChild(r)));
                  }
                  r &&
                    ((r.textContent = a > 99 ? "99+" : String(a)),
                    r.setAttribute("data-count", String(a)),
                    r.style.setProperty("display", "inline-flex", "important"),
                    r.style.setProperty("visibility", "visible", "important"),
                    r.style.setProperty("opacity", "1", "important"));
                } else
                  r &&
                    ((r.textContent = ""),
                    r.setAttribute("data-count", "0"),
                    r.style.setProperty("display", "none", "important"),
                    r.style.setProperty("visibility", "hidden", "important"),
                    r.style.setProperty("opacity", "0", "important"));
              }
            });
        } catch (t) {}
      }),
      "loading" === document.readyState ? document.addEventListener("DOMContentLoaded", l) : l());
    setInterval(function () {
      document.hidden || (o(), window.__updateHomeBadges && window.__updateHomeBadges());
    }, 3e4);
    (window.__akiniOnVisible(function () { (o(), window.__updateHomeBadges()) }),
      setTimeout(window.__updateHomeBadges, 1200));
  })());
/* 补发内容时间戳回写——离线期间应发的内容，时间用计划时间而非上线时间 */
window.__akiniBackdateTs = 0;
