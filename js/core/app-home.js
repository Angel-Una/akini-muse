(!(function () {
  "use strict";
  function t() {
    document.querySelectorAll('input[type="file"]').forEach(function (t) {
      t.classList.contains("akini-file-offscreen") ||
        "none" !== window.getComputedStyle(t).display ||
        (t.classList.add("akini-file-offscreen"), (t.style.display = ""));
    });
  }
  ("loading" === document.readyState ? document.addEventListener("DOMContentLoaded", t) : t(), setTimeout(t, 2e3));
})(),
  (window.__akiniNotifyUnreadChanged = function () {
    try {
      window.__updateHomeBadges();
    } catch (t) {}
    try {
      window.__akiniUpdateChatBackBadge();
    } catch (t) {}
    try {
      window.__akiniRefreshChatListBadges();
    } catch (t) {}
    try {
      var t = (window.akiniContacts && window.akiniContacts.getSessions && window.akiniContacts.getSessions()) || {},
        e = document.querySelectorAll(".chat-list-item");
      e &&
        e.length &&
        e.forEach(function (e) {
          var n = e.getAttribute("data-id") || e.getAttribute("data-chat-id");
          if (n) {
            var a = t[n] || {},
              i = Number(a.unread || 0),
              o = e.querySelector(".cli-unread-badge");
            if (i > 0) {
              if (!o) {
                var r = e.querySelector(".cli-avatar-wrap") || e.querySelector(".cli-avatar");
                r &&
                  ((r.style.position = "relative"),
                  (r.style.overflow = "visible"),
                  ((o = document.createElement("span")).className = "cli-unread-badge"),
                  r.appendChild(o));
              }
              o &&
                ((o.textContent = i > 99 ? "99+" : String(i)),
                o.setAttribute("data-count", String(i)),
                o.style.setProperty("display", "inline-flex", "important"),
                o.style.setProperty("visibility", "visible", "important"),
                o.style.setProperty("opacity", "1", "important"));
            } else
              o &&
                ((o.textContent = ""),
                o.setAttribute("data-count", "0"),
                o.style.setProperty("display", "none", "important"),
                o.style.setProperty("visibility", "hidden", "important"),
                o.style.setProperty("opacity", "0", "important"));
          }
        });
    } catch (t) {}
  }),
  window.__akiniUnreadTickerStarted || (window.__akiniUnreadTickerStarted = !0),
  (function () {
    "use strict";
    function t(t) {
      return String(null == t ? "" : t).replace(/[&<>"']/g, function (t) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[t];
      });
    }
    function e(t) {
      return (t < 10 ? "0" : "") + t;
    }
    function n() {
      try {
        return (localStorage.getItem("akini_my_name") || "我").trim() || "我";
      } catch (t) {
        return "我";
      }
    }
    function a() {
      try {
        return (localStorage.getItem("akini_ta_name") || "对方").trim() || "对方";
      } catch (t) {
        return "对方";
      }
    }
    function i() {
      return window.akiniContacts && window.akiniContacts.getActiveChatId
        ? window.akiniContacts.getActiveChatId()
        : null;
    }
    var _recCache = { key: "", data: null };
    function o() {
      var t = i(),
        e = [];
      if (!t || !(window.akiniContacts && window.akiniContacts.getSession))
        return { chatId: t, rows: e };
      var a = "";
      try {
        a = window.__akiniChatLog
          ? window.__akiniChatLog.html(t)
          : (window.akiniContacts.getSession(t) || {}).messagesHTML || "";
      } catch (_re) {}
      /* 聊天记录面板的搜索是逐字触发的：同一份历史只解析一次，
         否则每敲一个字都要 join/parse 几 MB HTML，安卓上直接卡死。 */
      var _key = t + "|" + a.length;
      try {
        if (window.__akiniChatLog) _key += "|" + window.__akiniChatLog.count(t);
      } catch (_ce) {}
      if (_recCache.key === _key) return _recCache.data;
      if (a) {
        var o = document.createElement("div");
        ((o.innerHTML = a),
          (e = Array.prototype.slice
            .call(o.querySelectorAll(".msg-row"))
            .filter(function (t) {
              return !t.classList.contains("system");
            })
            /* 只缓存轻量文本字段，不长期持有几千个临时 DOM 节点 */
            .map(function (t) {
              return r(t);
            })));
      }
      var _res = { chatId: t, rows: e };
      _recCache = { key: _key, data: _res };
      return _res;
    }
    function r(t) {
      var e = t.classList.contains("me"),
        i = t.querySelector(".msg-avatar"),
        o = i ? i.innerHTML : "",
        r = "",
        c = t.querySelector(".msg-sender-name");
      if (c) r = (c.textContent || "").trim();
      else {
        var l = t.querySelector(".msg-avatar[data-sender-name]");
        l && (r = l.getAttribute("data-sender-name") || "");
      }
      var s = e ? n() : r || a(),
        d = t.querySelector(".bubble"),
        g = "";
      if (d)
        if (d.classList.contains("transfer-bubble")) g = "【转账】";
        else if (d.classList.contains("survey-bubble")) g = "【问卷】";
        else if (d.classList.contains("shop-card-bubble")) {
          var u =
            (d.querySelector(".shop-card-bubble-title")
              ? d.querySelector(".shop-card-bubble-title").textContent
              : "") ||
            d.textContent ||
            "";
          g =
            -1 !== u.indexOf("帮付") || -1 !== u.indexOf("代付")
              ? "【物品代付】"
              : -1 !== u.indexOf("赠送")
                ? "【物品赠送】"
                : "【卡片】";
        } else if (d.querySelector("img:not(.quote-sticker-thumb)")) g = "【表情包】";
        else {
          var m = d.querySelector(".quote-bubble"),
            f = (d.innerText || "").trim();
          (m && (f = f.replace((m.innerText || "").trim(), "").trim()), (g = f));
        }
      return {
        isMe: e,
        name: s,
        avatarHtml: o,
        text: g,
        ts: parseInt(t.getAttribute("data-ts"), 10) || 0,
        bubbleEl: d,
      };
    }
    function c(t, e, n, a) {
      n = n || 38;
      var i = "";
      if (t)
        try {
          ("function" == typeof window.getMyAvatar && (i = window.getMyAvatar()),
            i || (i = localStorage.getItem("akini_my_avatar") || ""),
            !i && window.__akiniAvatarCache && (i = window.__akiniAvatarCache.my || ""));
        } catch (t) {}
      else {
        var _e = String(null == e ? "" : e).trim();
        try {
          if (window.akiniContacts && window.akiniContacts.getContacts) {
            var o = null;
            if (_e) {
              o = (window.akiniContacts.getContacts() || []).find(function (t) {
                return t && (t.name === _e || t.remark === _e);
              });
            } else {
              o = (window.akiniContacts.getContacts() || []).find(function (t) {
                return t;
              });
            }
            o && o.avatar && (i = o.avatar);
          }
        } catch (t) {}
        if (!i && _e) {
          if (a && "string" == typeof a && a.indexOf("<img") >= 0)
            return (
              '<div style="width:' +
              n +
              "px;height:" +
              n +
              'px;border-radius:50%;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;">' +
              a +
              "</div>"
            );
          var _c = _e.slice(0, 1).toUpperCase();
          return (
            '<div style="width:' +
            n +
            "px;height:" +
            n +
            "px;border-radius:50%;background:#e5e5ea;color:#666;font-size:" +
            Math.round(0.45 * n) +
            'px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
            _c +
            "</div>"
          );
        }
        if (!i)
          try {
            ("function" == typeof window.getTaAvatar && (i = window.getTaAvatar()),
              i || (i = localStorage.getItem("akini_ta_avatar") || ""),
              !i && window.__akiniAvatarCache && (i = window.__akiniAvatarCache.ta || ""));
          } catch (t) {}
      }
      if (i && "string" == typeof i && i.trim()) {
        var r = i.trim();
        return 0 === r.indexOf("<img")
          ? '<div style="width:' +
              n +
              "px;height:" +
              n +
              'px;border-radius:50%;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;">' +
              r +
              "</div>"
          : '<div style="width:' +
              n +
              "px;height:" +
              n +
              'px;border-radius:50%;overflow:hidden;flex-shrink:0;background:#f0f0f2;"><img src="' +
              r +
              '" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.onerror=null;this.parentElement.style.background=\'#d1d1d6\';"/></div>';
      }
      if (a && "string" == typeof a && a.indexOf("<img") >= 0)
        return (
          '<div style="width:' +
          n +
          "px;height:" +
          n +
          'px;border-radius:50%;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;">' +
          a +
          "</div>"
        );
      var c = (e || (t ? "我" : "Ta")).slice(0, 1).toUpperCase();
      return (
        '<div style="width:' +
        n +
        "px;height:" +
        n +
        "px;border-radius:50%;background:#e5e5ea;color:#666;font-size:" +
        Math.round(0.45 * n) +
        'px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
        c +
        "</div>"
      );
    }
    window.__akiniQuoteCardHtml = function (e, n, a, i) {
      var o = String(null == e ? "" : e).trim() || "我",
        r = String(null == n ? "" : n).trim(),
        c = String(null == a ? "" : a),
        l = String(null == i ? "" : i);
      r.length > 15 && (r = r.slice(0, 15) + "…");
      var s =
          '<span style="font-weight:600;white-space:nowrap;color:#333;flex-shrink:0;">' +
          (window.rt ? rt(o) : t(o)) +
          "</span>",
        d = r
          ? '<span style="white-space:nowrap;color:#333;overflow:hidden;text-overflow:ellipsis;flex:0 1 auto;max-width:220px;">：' +
            (window.rt ? rt(r) : t(r)) +
            "</span>"
          : "",
        g = "";
      if (c || l) {
        var u = c;
        if (!u && l && window.__akiniMedia && window.__akiniMedia.getSync)
          try {
            u = window.__akiniMedia.getSync(l) || "";
          } catch (t) {
            u = "";
          }
        u &&
          ((g =
            '<span style="color:#333;flex-shrink:0;">：</span><img class="quote-sticker-thumb" src="' +
            u +
            '" data-mh="' +
            (window.rt ? rt(l) : t(l)) +
            '" style="width:20px;height:20px;border-radius:4px;object-fit:cover;flex-shrink:0;margin-left:1px;margin-right:2px;" alt="表情包"/>'),
          (d = ""));
      }
      return (
        '<div class="quote-bubble" style="background:#fff!important;color:#333!important;border:none!important;border-radius:10px!important;padding:3px 8px!important;font-size:11px!important;line-height:1.3!important;box-shadow:0 1px 3px rgba(0,0,0,.1)!important;margin-top:2px!important;display:inline-flex!important;align-items:center!important;max-width:280px!important;overflow:hidden!important;white-space:nowrap!important;text-overflow:ellipsis!important;box-sizing:border-box!important;">' +
        s +
        g +
        d +
        "</div>"
      );
    };
    var l = null;
    function s(t) {
      var e = document.getElementById("akiniRecordToast");
      (e ||
        (((e = document.createElement("div")).id = "akiniRecordToast"),
        (e.style.cssText =
          "position:fixed;left:50%;bottom:120px;transform:translateX(-50%);background:rgba(0,0,0,.78);color:#fff;font-size:13px;padding:8px 16px;border-radius:20px;z-index:7250;pointer-events:none;transition:opacity .25s;max-width:80vw;"),
        document.body.appendChild(e)),
        (e.textContent = t),
        (e.style.opacity = "1"),
        l && clearTimeout(l),
        (l = setTimeout(function () {
          e.style.opacity = "0";
        }, 1800)));
    }
    function d(t) {
      return "akini_favs_" + t;
    }
    function g(t) {
      try {
        return JSON.parse(localStorage.getItem(d(t)) || "[]") || [];
      } catch (t) {
        return [];
      }
    }
    function u(t, e) {
      try {
        return (localStorage.setItem(d(t), JSON.stringify(e)), !0);
      } catch (t) {
        return (s("存储空间不足，收藏失败"), !1);
      }
    }
    var m = null,
      f = "search";
    function p() {
      m && (m.remove(), (m = null));
    }
    function y(t) {
      return (
        '<div style="text-align:center;color:#999;font-size:13px;padding:40px 16px;line-height:1.8;">' + t + "</div>"
      );
    }
    function v() {
      if (m) {
        var e = m.querySelectorAll(".cr-tab");
        Array.prototype.forEach.call(e, function (t) {
          var e = t.getAttribute("data-tab") === f;
          (t.classList.toggle("is-active", e),
            (t.style.borderBottomColor = e ? "#0c0c0c" : "transparent"),
            (t.style.fontWeight = e ? "800" : "400"),
            (t.style.color = e ? "#0c0c0c" : "#8a8a8a"));
        });
        var c = m.querySelector("#crSearchBox");
        if ("search" === f) {
          ((c.style.display = "block"),
            (c.innerHTML =
              '<input id="crSearchInput" placeholder="输入关键词搜索消息" style="width:100%;box-sizing:border-box;border:none;outline:0;background:#f2f2f2;border-radius:8px;padding:10px 12px;font-size:14px;color:#1a1a1a;" type="text" />'));
          var l = c.querySelector("#crSearchInput");
          ((l.oninput = function () {
            x(l.value);
          }),
            setTimeout(function () {
              try {
                l.focus();
              } catch (t) {}
            }, 60),
            x(""));
        } else
          ((c.style.display = "none"),
            "stats" === f
              ? (function () {
                  var e = m ? m.querySelector("#crContent") : null;
                  if (!e) return;
                  var c = o();
                  if (!c.rows.length) return void (e.innerHTML = y("当前聊天还没有消息"));
                  var l = i(),
                    s = l && window.akiniContacts ? window.akiniContacts.getChatTarget(l) : null,
                    d = s && "group" === s.type,
                    g = 0,
                    u = {};
                  function f(t) {
                    return Object.keys(t)
                      .map(function (e) {
                        return { t: e, c: t[e] };
                      })
                      .sort(function (t, e) {
                        return e.c - t.c;
                      })
                      .slice(0, 5);
                  }
                  c.rows.forEach(function (t) {
                    var e = t,
                      i = (e.text || "").trim();
                    if (
                      i &&
                      "【转账】" !== i &&
                      "【表情包】" !== i &&
                      "【卡片】" !== i &&
                      "【图片】" !== i &&
                      "【语音】" !== i &&
                      "【红包】" !== i &&
                      0 !== i.indexOf("【")
                    ) {
                      g++;
                      var o = e.isMe ? n() : (d && e.name) || a();
                      (u[o] || (u[o] = { count: 0, words: {} }),
                        u[o].count++,
                        e.text && (u[o].words[e.text] = (u[o].words[e.text] || 0) + 1));
                    } else 0;
                  });
                  var p = Object.keys(u)
                      .map(function (e) {
                        return t(e) + " 发送 " + u[e].count + " 条";
                      })
                      .join(" · "),
                    v =
                      '<div style="background:#fff;border-radius:14px;padding:16px 14px;margin-bottom:12px;"><div style="font-size:15px;color:#1a1a1a;line-height:1.6;">' +
                      (d ? "本群全员" : "我们互相") +
                      '一共发了 <span style="font-weight:700;color:#1a1a1a;font-size:20px;">' +
                      g +
                      '</span> 条消息</div><div style="font-size:12px;color:#999;margin-top:6px;line-height:1.4;">' +
                      p +
                      "</div></div>";
                  function x(e, n, a) {
                    var i = "";
                    return (
                      a.length
                        ? a.forEach(function (e, n) {
                            i +=
                              '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:7px 0;border-bottom:1px solid #f5f5f5;"><div style="flex:1;min-width:0;font-size:14px;color:#333;line-height:1.5;word-break:break-word;"><span style="color:#bbb;font-size:12px;margin-right:6px;">' +
                              (n + 1) +
                              ".</span>" +
                              t(e.t) +
                              '</div><div style="font-size:12px;color:#1a1a1a;flex-shrink:0;font-weight:600;">×' +
                              e.c +
                              "</div></div>";
                          })
                        : (i = '<div style="font-size:13px;color:#bbb;padding:10px 0 2px;">暂无内容统计</div>'),
                      '<div style="background:#fff;border-radius:14px;padding:14px;margin-bottom:12px;"><div style="font-size:14px;font-weight:600;color:#1a1a1a;">' +
                        e +
                        '</div><div style="font-size:11px;color:#bbb;margin-top:3px;">' +
                        n +
                        '</div><div style="margin-top:8px;">' +
                        i +
                        "</div></div>"
                    );
                  }
                  (Object.keys(u).forEach(function (e) {
                    var n = f(u[e].words);
                    v += x(t(e) + " 发送最多的内容 TOP5", "按发送次数从高到低", n);
                  }),
                    (e.innerHTML = v));
                })()
              : w());
      }
    }
    function x(n) {
      var a = m ? m.querySelector("#crContent") : null;
      if (a)
        if ((n = (n || "").trim())) {
          var l = o(),
            d = [];
          if (
            (l.rows.forEach(function (t, e) {
              var a = t;
              ((a.idx = e), a.text && a.text.indexOf(n) > -1 && d.push(a));
            }),
            d.length)
          ) {
            d.reverse();
            var g = '<div style="font-size:12px;color:#999;padding:2px 4px 10px;">共 ' + d.length + " 条结果</div>";
            (d.forEach(function (a) {
              var i, o;
              g +=
                '<div class="cr-search-row" style="display:flex;gap:10px;padding:10px;background:#fff;border-radius:12px;margin-bottom:8px;align-items:flex-start;">' +
                c(a.isMe, a.name, 38, a.avatarHtml) +
                '<div style="flex:1;min-width:0;"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;"><div style="font-size:13px;font-weight:600;color:#1a1a1a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
                t(a.name) +
                '</div><div style="font-size:11px;color:#bbb;flex-shrink:0;">' +
                ((i = a.ts),
                (o = new Date(Number(i) || Date.now())).getMonth() +
                  1 +
                  "月" +
                  o.getDate() +
                  "日 " +
                  e(o.getHours()) +
                  ":" +
                  e(o.getMinutes()) +
                  '</div></div><div style="font-size:14px;color:#333;line-height:1.5;margin-top:3px;word-break:break-word;">') +
                (function (e, n) {
                  var a = t(e);
                  if (!n) return a;
                  var i = t(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                  try {
                    return a.replace(new RegExp(i, "g"), '<span style="color:#f08a00;font-weight:600;">$&</span>');
                  } catch (t) {
                    return a;
                  }
                })(a.text, n) +
                "</div></div></div>";
            }),
              (a.innerHTML = g));
          } else a.innerHTML = y("没有找到包含「" + t(n) + "」的消息");
        } else a.innerHTML = y("输入关键词，查找聊天里的消息");
    }
    function h(e) {
      return (
        '<div class="fav-bubble-inner" style="max-width:75%;padding:10px 14px;border-radius:18px;font-size:14px;line-height:1.5;word-break:break-word;word-wrap:break-word;white-space:pre-wrap;box-sizing:border-box;background:#1a1a1a !important;color:#fff!important;display:inline-block;">' +
        (function (e, n) {
          var a = e && e.length <= 12e3 ? e : t(n || "【表情包】");
          try {
            var i = document.createElement("div");
            return (
              (i.innerHTML = a),
              i.querySelectorAll("*").forEach(function (t) {
                t.style && (t.style.maxWidth = "100%");
              }),
              i.innerHTML
            );
          } catch (t) {
            return a;
          }
        })(e.html, e.text) +
        "</div>"
      );
    }
    function b(n) {
      var a,
        i,
        o = n.items || [],
        r = "",
        l = 1 === o.length;
      return (
        o.forEach(function (e) {
          r += (function (e, n) {
            n = n || {};
            var a = c(e.isMe, e.name, 32, e.avatarHtml),
              i =
                '<div style="font-size:10px;color:#999;margin-bottom:3px;text-align:center;width:32px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
                t(e.name) +
                "</div>",
              o = h(e),
              r =
                '<div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;width:32px;">' +
                i +
                a +
                "</div>",
              l = ' style="';
            return !n.single && e.isMe
              ? "<div" +
                  l +
                  'display:flex;flex-direction:column;align-items:flex-end;margin-bottom:12px;width:100%;box-sizing:border-box;"><div style="display:flex;gap:8px;align-items:flex-end;justify-content:flex-end;width:100%;">' +
                  o +
                  r +
                  "</div></div>"
              : "<div" +
                  l +
                  'display:flex;flex-direction:column;align-items:flex-start;margin-bottom:12px;width:100%;box-sizing:border-box;"><div style="display:flex;gap:8px;align-items:flex-end;width:100%;">' +
                  r +
                  o +
                  "</div></div>";
          })(e, { single: l });
        }),
        '<div style="background:#fff;border-radius:14px;padding:12px;margin-bottom:12px;">' +
          r +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;border-top:1px solid #f5f5f5;padding-top:8px;"><div style="font-size:11px;color:#bbb;">' +
          ((a = n.ts),
          (i = new Date(Number(a) || Date.now())).getFullYear() +
            "年" +
            (i.getMonth() + 1) +
            "月" +
            i.getDate() +
            "日 " +
            e(i.getHours()) +
            ":" +
            e(i.getMinutes()) +
            '</div><button class="cr-fav-del" data-id="') +
          t(n.id) +
          '" style="background:none;border:none;font-size:11px;color:#bbb;cursor:pointer;padding:2px 6px;">删除</button></div></div>'
      );
    }
    function w() {
      var t = m ? m.querySelector("#crContent") : null;
      if (t) {
        var e = g(i());
        if (e.length) {
          var n = "";
          (e.forEach(function (t) {
            n += b(t);
          }),
            (t.innerHTML = n));
          var a = t.querySelectorAll(".cr-fav-del");
          Array.prototype.forEach.call(a, function (t) {
            t.onclick = function () {
              var e = t.getAttribute("data-id"),
                n = i();
              u(
                n,
                g(n).filter(function (t) {
                  return t.id !== e;
                }),
              ) && (s("已删除该收藏"), w());
            };
          });
        } else t.innerHTML = y("还没有收藏的消息<br>长按任意消息 → 收藏，把喜欢的瞬间存进来");
      }
    }
    window.__akiniOpenRecordPanel = function (t) {
      if (i()) {
        (p(),
          (f = t || "search"),
          ((m = document.createElement("div")).id = "chatRecordOverlay"),
          (m.style.cssText =
            "position:fixed;inset:0;z-index:7000;background:#f5f5f6;display:flex;flex-direction:column;"),
          (m.innerHTML =
            '<div style="display:flex;align-items:center;gap:6px;padding:12px 12px 10px;background:#fff;border-bottom:1px solid #eee;flex-shrink:0;"><button id="crBackBtn" aria-label="返回" style="background:none;border:none;font-size:26px;color:#1a1a1a;line-height:1;padding:2px 10px;cursor:pointer;"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M15 18l-6-6 6-6"/></svg></button><div style="font-size:17px;font-weight:600;color:#1a1a1a;">聊天记录</div></div><div style="display:flex;background:#fff;border-bottom:1px solid #eee;flex-shrink:0;"><div class="cr-tab" data-tab="search" style="flex:1;text-align:center;padding:11px 0;font-size:13px;color:#1a1a1a;cursor:pointer;border-bottom:2px solid transparent;">搜索聊天记录</div><div class="cr-tab" data-tab="stats" style="flex:1;text-align:center;padding:11px 0;font-size:13px;color:#1a1a1a;cursor:pointer;border-bottom:2px solid transparent;">聊天记录总结</div><div class="cr-tab" data-tab="fav" style="flex:1;text-align:center;padding:11px 0;font-size:13px;color:#1a1a1a;cursor:pointer;border-bottom:2px solid transparent;">收藏消息内容</div></div><div id="crSearchBox" style="padding:10px 12px;background:#fff;flex-shrink:0;"></div><div id="crContent" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px 12px 30px;min-height:0;"></div>'),
          document.body.appendChild(m),
          (m.querySelector("#crBackBtn").onclick = p));
        var e = m.querySelectorAll(".cr-tab");
        (Array.prototype.forEach.call(e, function (t) {
          t.onclick = function () {
            ((f = t.getAttribute("data-tab") || "search"), v());
          };
        }),
          v());
      } else s("请先进入一个聊天");
    };
    var k = !1;
    function _(t) {
      if (k) {
        var e = t.target && t.target.closest ? t.target.closest(".msg-row") : null;
        if (e && !e.classList.contains("system")) {
          (t.preventDefault(), e.classList.toggle("fav-selected"));
          try {
            var n = document.getElementById("akiniFavTopBar"),
              a = document.querySelectorAll(".msg-row.fav-selected").length;
            n && (n.innerHTML = "<span>已选择 " + a + " 条消息</span>");
          } catch (t) {}
        }
      }
    }
    function S() {
      ((k = !1), document.body.classList.remove("akini-fav-selecting"));
      var t = document.getElementById("akiniFavTopBar");
      t && t.remove();
      var e = document.getElementById("chatBody");
      e && e.removeEventListener("click", _, !0);
      var n = document.getElementById("akiniFavBar");
      n && n.remove();
      var a = document.querySelectorAll(".fav-circle");
      Array.prototype.forEach.call(a, function (t) {
        t.remove();
      });
      var i = document.querySelectorAll(".msg-row.fav-selected");
      Array.prototype.forEach.call(i, function (t) {
        t.classList.remove("fav-selected");
      });
    }
    function I() {
      var e = document.getElementById("chatBody");
      if (e) {
        var n = e.querySelectorAll(".msg-row.fav-selected");
        if (n.length) {
          var a = i();
          if (a) {
            var o = [];
            (Array.prototype.forEach.call(n, function (e) {
              var n = r(e),
                a = n.bubbleEl ? n.bubbleEl.innerHTML : "";
              a.length > 12e3 && (a = t(n.text || "【表情包】"));
              var i = n.avatarHtml;
              (i.length > 6e3 && 0 !== i.indexOf("<img") && (i = ""),
                o.push({ isMe: !!n.isMe, name: n.name, avatarHtml: i, html: a, ts: n.ts, text: n.text || "" }));
            }),
              o.sort(function (t, e) {
                return (t.ts || 0) - (e.ts || 0);
              }));
            var c = o.map(function (t) {
              return new Promise(function (e) {
                var n = t.avatarHtml || "";
                if (0 === n.indexOf("<img")) {
                  var a,
                    i = (a = String(n || "").match(/src="([^"]*)"/)) ? a[1] : "";
                  !i || i.length <= 6e3
                    ? e()
                    : (function (t, e) {
                        var n = !1;
                        function a(a) {
                          n || ((n = !0), e(a || t));
                        }
                        try {
                          if (!t || t.length <= 6e3 || !/^(data:|blob:)/i.test(t)) return void a(t);
                          var i = new Image();
                          ((i.onload = function () {
                            try {
                              var e = 96,
                                n = document.createElement("canvas");
                              ((n.width = e), (n.height = e));
                              var o = n.getContext("2d");
                              ((o.fillStyle = "#ececec"), o.fillRect(0, 0, e, e));
                              var r = i.width || e,
                                c = i.height || e,
                                l = Math.min(r, c);
                              o.drawImage(i, (r - l) / 2, (c - l) / 2, l, l, 0, 0, e, e);
                              var s = n.toDataURL("image/jpeg", 0.85);
                              a(s && s.length > 100 && s.length < t.length ? s : t);
                            } catch (e) {
                              a(t);
                            }
                          }),
                            (i.onerror = function () {
                              a(t);
                            }),
                            (i.src = t),
                            setTimeout(function () {
                              a(t);
                            }, 2500));
                        } catch (e) {
                          a(t);
                        }
                      })(i, function (n) {
                        (n &&
                          n !== i &&
                          (t.avatarHtml = (function (t) {
                            return (
                              '<img src="' +
                              String(t).replace(/"/g, "&quot;") +
                              '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">'
                            );
                          })(n)),
                          e());
                      });
                } else e();
              });
            });
            Promise.all(c).then(function () {
              var t = g(a);
              (t.unshift({
                id: "fav_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
                ts: Date.now(),
                items: o,
              }),
                u(a, t) && (S(), s("已收藏 " + o.length + " 条消息")));
            });
          } else s("请先进入一个聊天");
        } else s("还没有选择消息");
      }
    }
    window.__akiniEnterFavSelectMode = function () {
      if (!k)
        if (i()) {
          var t = document.getElementById("chatBody");
          if (t) {
            ((k = !0),
              (function () {
                if (!document.getElementById("akiniFavSelectStyle")) {
                  var t = document.createElement("style");
                  ((t.id = "akiniFavSelectStyle"),
                    (t.textContent =
                      "body.akini-fav-selecting .chat-body{padding-left:36px!important;padding-right:36px!important;transition:padding .2s ease;}body.akini-fav-selecting .fav-circle{width:16px;height:16px;border-radius:50%;border:1.8px solid #000;background:#fff;flex:0 0 auto;box-sizing:border-box;cursor:pointer;position:absolute;top:19px;transform:translateY(-50%);z-index:7250;box-shadow:0 1px 3px rgba(0,0,0,.15);}body.akini-fav-selecting .msg-row{position:relative;cursor:pointer;}body.akini-fav-selecting .msg-row.me .fav-circle{right:-26px;}body.akini-fav-selecting .msg-row.other .fav-circle{left:-26px;}body.akini-fav-selecting .msg-row.fav-selected .fav-circle{background:#000!important;border-color:#000!important;}body.akini-fav-selecting .chat-top-bar{display:none!important;}#akiniFavTopBar{position:sticky;top:0;left:0;right:0;z-index:7200;display:flex;align-items:center;justify-content:center;gap:8px;padding:11px 12px;background:#fff;box-shadow:0 1px 8px rgba(0,0,0,.08);font-size:15px;color:#1a1a1a;font-weight:600;}body.dark-mode #akiniFavTopBar{background:#232326;color:#f2f2f2;box-shadow:0 1px 8px rgba(0,0,0,.4);}"),
                    document.head.appendChild(t));
                }
              })(),
              document.body.classList.add("akini-fav-selecting"));
            var e = t.querySelectorAll(".msg-row"),
              n = 0;
            if (
              (Array.prototype.forEach.call(e, function (t) {
                if (!t.classList.contains("system") && !t.querySelector(".fav-circle")) {
                  var e = document.createElement("div");
                  ((e.className = "fav-circle"), t.appendChild(e), n++);
                }
              }),
              !n)
            )
              return (S(), void s("当前聊天没有可收藏的消息"));
            var a = document.createElement("div");
            ((a.id = "akiniFavBar"),
              (a.style.cssText =
                "position:fixed;left:0;right:0;bottom:0;z-index:7150;display:flex;gap:12px;padding:10px 16px calc(12px + env(safe-area-inset-bottom,0px));background:#fff;box-shadow:0 -3px 14px rgba(0,0,0,.1);"),
              (a.innerHTML =
                '<button id="akiniFavCancel" style="flex:1;padding:12px 0;border:none;border-radius:10px;background:#f2f2f2;color:#333;font-size:15px;cursor:pointer;">取消</button><button id="akiniFavOk" style="flex:1;padding:12px 0;border:none;border-radius:10px;background:#000;color:#fff;font-size:15px;font-weight:600;cursor:pointer;">收藏</button>'),
              document.body.appendChild(a));
            var o = document.querySelector(".chat-wrapper") || t.parentElement;
            if (o) {
              var r = document.createElement("div");
              ((r.id = "akiniFavTopBar"), (r.innerHTML = "<span>已选择 0 条消息</span>"));
              var c = o.querySelector(".chat-body") || o.firstElementChild;
              c && c.parentElement === o ? o.insertBefore(r, c) : o.appendChild(r);
            }
            ((a.querySelector("#akiniFavCancel").onclick = function () {
              S();
            }),
              (a.querySelector("#akiniFavOk").onclick = I),
              t.addEventListener("click", _, !0),
              window.__akiniFavTipShown || ((window.__akiniFavTipShown = !0), s("点击消息进行选择")));
          } else s("请先进入一个聊天");
        } else s("请先进入一个聊天");
    };
  })());
let currentScreen = 0,
  touchStartX = 0,
  touchEndX = 0;
function switchHomeScreen(t) {
  const e = document.querySelectorAll(".home-screen"),
    n = document.querySelectorAll(".home-indicator .dot");
  t < 0 ||
    t >= e.length ||
    (e.forEach((e, n) => {
      n === t
        ? (e.classList.add("active"), e.classList.remove("exit-left"))
        : n < t
          ? (e.classList.remove("active"), e.classList.add("exit-left"))
          : (e.classList.remove("active"), e.classList.remove("exit-left"));
    }),
    n.forEach((e, n) => {
      n === t ? e.classList.add("active") : e.classList.remove("active");
    }),
    (currentScreen = t));
}
function syncDualScreensData() {
  if (!document.hidden) {
    try {
      const t = document.getElementById("s1AvatarCircle"),
        e = localStorage.getItem("akini_s1_avatar");
      t &&
        e &&
        t.__akiniLastCustom !== e &&
        ((t.__akiniLastCustom = e),
        (t.innerHTML = `<img src="${e}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`));
    } catch (t) {}
    try {
      (document.getElementById("previewBubbleLeft"),
        document.getElementById("previewBubbleRight"),
        localStorage.getItem("akini_last_chat"));
    } catch (t) {}
  }
}
((window.switchHomeScreen = switchHomeScreen),
  document.addEventListener("DOMContentLoaded", function () {
    const t = document.getElementById("homeSlider");
    t &&
      (t.addEventListener(
        "touchstart",
        function (t) {
          touchStartX = t.changedTouches[0].screenX;
        },
        { passive: !0 },
      ),
      t.addEventListener(
        "touchend",
        function (t) {
          ((touchEndX = t.changedTouches[0].screenX),
            (function () {
              const t = touchStartX - touchEndX,
                e = 50;
              if (Math.abs(t) < e) return;
              t > 0 && 0 === currentScreen ? switchHomeScreen(1) : t < 0 && 1 === currentScreen && switchHomeScreen(0);
            })());
        },
        { passive: !0 },
      ));
  }),
  document.addEventListener("DOMContentLoaded", function () {
    try {
      const t = JSON.parse(localStorage.getItem("akini_s1_texts") || "{}");
      for (let e = 1; e <= 3; e++) {
        let n = null;
        try {
          n = localStorage.getItem("akini_s1_custom_text_" + e);
        } catch (t) {}
        const a = null != n && "" !== n ? n : t["line" + e];
        if (a) {
          const t = document.getElementById("s1Text" + e);
          t && (t.textContent = a);
        }
      }
    } catch (t) {}
    try {
      const t = localStorage.getItem("akini_s1_photo");
      if (!t && window.akiniStore && window.akiniStore.get)
        try {
          window.akiniStore.get("akini_s1_photo", function (t) {
            if (t) {
              var e = document.getElementById("s1PolaroidImg");
              e && (e.style.backgroundImage = 'url("' + t + '")');
              try {
                localStorage.setItem("akini_s1_photo", t);
              } catch (t) {}
            }
          });
        } catch (t) {}
      if (t) {
        const e = document.getElementById("s1PolaroidImg");
        e &&
          ((e.style.backgroundImage = `url(${t})`),
          (e.style.backgroundSize = "cover"),
          (e.style.backgroundPosition = "center"));
      }
    } catch (t) {}
    !(function () {
      if (document.hidden) return;
      const t = document.getElementById("s1AvatarCircle"),
        e = document.querySelector(".my-avatar") || document.getElementById("myAvatar");
      if (t && e) {
        var n = e.innerHTML,
          a = n.length + ":" + (n.length > 64 ? n.slice(-64) : n);
        if (t.__akiniSyncFp === a) return;
        ((t.__akiniSyncFp = a), (t.innerHTML = n));
      }
    })();
  }),
  document.addEventListener("DOMContentLoaded", function () {
    syncDualScreensData();
  }),
  document.addEventListener("DOMContentLoaded", function () {
    try {
      const t = localStorage.getItem("akini_s1_cover");
      if (t) {
        const e = document.getElementById("s1CoverBg");
        e && (e.style.backgroundImage = `url(${t})`);
      }
      const e = localStorage.getItem("akini_s1_avatar");
      if (e) {
        const t = document.getElementById("s1AvatarCircle");
        t && (t.innerHTML = `<img src="${e}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`);
      }
    } catch (t) {}
  }),
  document.addEventListener("DOMContentLoaded", function () {
    [
      { rowId: "changeCallBgBtnBeautify", inputId: "fileInputCallBgBeautify" },
      { rowId: "changeCallMiniBgBtnBeautify", inputId: "fileInputCallMiniBgBeautify" },
    ].forEach(function (t) {
      const e = document.getElementById(t.rowId),
        n = document.getElementById(t.inputId);
      e &&
        n &&
        (e.onclick = function (t) {
          t.target !== n && n.click();
        });
    });
    try {
      const t = "";
      if (localStorage.getItem("akini_app_version") !== t) {
        let e = 0;
        for (let t = 0; t < localStorage.length; t++) {
          const n = localStorage.key(t);
          if (["akini_localstorage_snapshot", "akini_localstorage_snapshot_backup", "akini_idb_full_snapshot"].includes(n)) continue;
          const a = localStorage.getItem(n);
          a && (e += a.length);
        }
        if (e > 35e5) {
          const t = ["akini_user_id", "akini_chat_history", "akini_s1_texts", "akini_s1_cover", "akini_s1_photo"];
          for (let e = localStorage.length - 1; e >= 0; e--) {
            const n = localStorage.key(e);
            -1 === t.indexOf(n) && -1 !== n.indexOf("temp") && localStorage.removeItem(n);
          }
        }
        localStorage.setItem("akini_app_version", t);
      }
    } catch (t) {
      console.warn("Storage check safely handled:", t);
    }
  }),
  document.addEventListener("DOMContentLoaded", function () {
    try {
      const t = localStorage.getItem("akini_bg_img"),
        e = document.getElementById("bgArea");
      t &&
        e &&
        ((e.style.backgroundImage = `url(${t})`),
        (e.style.backgroundSize = "cover"),
        (e.style.backgroundPosition = "center"));
    } catch (t) {}
  }),
  (window.editS1CustomText = function (t) {
    let e = "akini_s1_custom_text_" + t,
      n = "",
      a = "请输入文字内容：";
    var i = document.getElementById("s1Text1"),
      o = document.getElementById("s1Text2"),
      r = document.getElementById("s1Text3"),
      c = document.getElementById("s1TextLoc");
    function l(n) {
      if (null !== n) {
        n = String(n).trim() || "xxx";
        if (1 === t) {
          var el = document.getElementById("s1Text1");
          el && (el.textContent = n);
        } else if (2 === t) {
          var el = document.getElementById("s1Text2");
          el && (el.textContent = n);
        } else if (3 === t) {
          var el = document.getElementById("s1Text3");
          el && (el.textContent = n);
        } else if (5 === t) {
          var el = document.getElementById("s1TextLoc");
          el && (el.textContent = n);
        }
        setTimeout(function () {
          try {
            localStorage.setItem(e, n);
          } catch (t) {}
          try {
            var a = {};
            try {
              a = JSON.parse(localStorage.getItem("akini_s1_texts") || "{}");
            } catch (t) {}
            ((a["line" + t] = n), localStorage.setItem("akini_s1_texts", JSON.stringify(a)));
          } catch (t) {}
        }, 0);
      }
    }
    if (
      (1 === t
        ? ((n = i && i.textContent ? i.textContent : "xxx"), (a = "请输入第一行昵称/文字："))
        : 2 === t
          ? ((n = o && o.textContent ? o.textContent : "xxx"), (a = "请输入第二行文字："))
          : 3 === t
            ? ((n = r && r.textContent ? r.textContent : "xxx"), (a = "请输入第三行文字："))
            : 5 === t && ((n = c && c.textContent ? c.textContent : "xxx"), (a = "请输入定位文字：")),
      "function" != typeof window.__akiniPromptModal)
    )
      try {
        l(prompt(a, "xxx" === n ? "" : n));
      } catch (t) {}
    else
      window.__akiniPromptModal(a.replace("：", ""), "请输入自定义文字", l, {
        value: "xxx" === n ? "" : n,
        maxLength: 50,
      });
  }),
  (window.editS1PolaroidNote = function () {
    var t = document.getElementById("s1PolaroidNote");
    let e = t && t.textContent ? t.textContent : "xxx";
    function n(t) {
      if (null !== t) {
        t = String(t).trim() || "xxx";
        var _el = document.getElementById("s1PolaroidNote");
        _el && (_el.textContent = t);
        setTimeout(function () {
          try {
            localStorage.setItem("akini_s1_polaroid_note", t);
          } catch (t) {}
          try {
            var e = {};
            try {
              e = JSON.parse(localStorage.getItem("akini_s1_texts") || "{}");
            } catch (t) {}
            ((e.note = t), localStorage.setItem("akini_s1_texts", JSON.stringify(e)));
          } catch (t) {}
        }, 0);
      }
    }
    if ("function" != typeof window.__akiniPromptModal)
      try {
        n(prompt("请输入小卡片左下角自定义文字：", "xxx" === e ? "" : e));
      } catch (t) {}
    else
      window.__akiniPromptModal("小卡片自定义文字", "请输入小卡片左下角文字", n, {
        value: "xxx" === e ? "" : e,
        maxLength: 30,
      });
  }),
  (window.loadS1SavedTexts = function () {
    try {
      try {
        if ("1" !== localStorage.getItem("akini_s1_migrated_")) {
          localStorage.setItem("akini_s1_migrated_", "1");
          var t = localStorage.getItem("akini_s1_custom_text_3"),
            e = localStorage.getItem("akini_s1_custom_text_4");
          if (
            (null === t ||
              "" === t ||
              localStorage.getItem("akini_s1_custom_text_2") ||
              localStorage.setItem("akini_s1_custom_text_2", t),
            null !== e && "" !== e)
          ) {
            var n = localStorage.getItem("akini_s1_custom_text_3");
            (null !== n && "" !== n && n !== t) || localStorage.setItem("akini_s1_custom_text_3", e);
          }
          var a = {};
          try {
            a = JSON.parse(localStorage.getItem("akini_s1_texts") || "{}");
          } catch (t) {}
          (!a.line2 && a.line3 && (a.line2 = a.line3),
            !a.line4 || (a.line3 && a.line3 !== a.line2) || (a.line3 = a.line4));
          try {
            localStorage.setItem("akini_s1_texts", JSON.stringify(a));
          } catch (t) {}
        }
      } catch (t) {}
      const r = localStorage.getItem("akini_s1_custom_text_1"),
        c = localStorage.getItem("akini_s1_custom_text_2"),
        l = localStorage.getItem("akini_s1_custom_text_3"),
        s = localStorage.getItem("akini_s1_custom_text_5"),
        d = localStorage.getItem("akini_s1_polaroid_note"),
        g = localStorage.getItem("akini_s1_photo");
      var i = {};
      try {
        i = JSON.parse(localStorage.getItem("akini_s1_texts") || "{}");
      } catch (t) {}
      var o = function (t, e) {
        return null != t && "" !== t ? t : e || null;
      };
      const u = o(r, i.line1),
        m = o(c, i.line2),
        f = o(l, i.line3),
        p = o(s, i.line5),
        y = o(d, i.note);
      (u && document.getElementById("s1Text1") && (document.getElementById("s1Text1").textContent = u),
        m && document.getElementById("s1Text2") && (document.getElementById("s1Text2").textContent = m),
        f && document.getElementById("s1Text3") && (document.getElementById("s1Text3").textContent = f),
        p && document.getElementById("s1TextLoc") && (document.getElementById("s1TextLoc").textContent = p),
        y && document.getElementById("s1PolaroidNote") && (document.getElementById("s1PolaroidNote").textContent = y),
        g &&
          document.getElementById("s1PolaroidImg") &&
          (document.getElementById("s1PolaroidImg").style.backgroundImage = `url("${g}")`));
    } catch (t) {}
  }),
  "loading" === document.readyState
    ? document.addEventListener("DOMContentLoaded", window.loadS1SavedTexts)
    : window.loadS1SavedTexts());
(!(function () {
  if (window.visualViewport) {
    var e = window.visualViewport,
      t = 0,
      _vvt = null;
    (e.addEventListener("resize", function () {
      (_vvt && cancelAnimationFrame(_vvt), (_vvt = requestAnimationFrame(i)));
    }),
      e.addEventListener("scroll", function () {
        (_vvt && cancelAnimationFrame(_vvt), (_vvt = requestAnimationFrame(i)));
      }),
      window.__akiniOnVisible(function () { setTimeout(i, 120) }));
  }
  function i() {
    try {
      var i = document.getElementById("app-chat");
      if (!i) return;
      if (!("none" !== i.style.display && (null !== i.offsetParent || i.getClientRects().length > 0)))
        return void (0 !== t && ((i.style.transform = ""), (i.style.paddingBottom = ""), (t = 0)));
      var n = i.querySelector(".chat-input-bar-area") || i.querySelector(".chat-input-bar");
      if (!n) return;
      var a = n.getBoundingClientRect().bottom + t - (e.height + e.offsetTop),
        o = a > 2 ? Math.min(a + 8, 420) : 0;
      if (o !== t && ((i.style.transform = ""), (i.style.paddingBottom = o > 0 ? o + "px" : ""), (t = o), o > 0))
        try {
          var r = document.getElementById("chatBody");
          r && (r.scrollTop = r.scrollHeight);
        } catch (e) {}
    } catch (e) {}
  }
})(),
  (window.__akiniFilterDelPosts = function (e) {
    try {
      if (!Array.isArray(e) || !e.length) return e;
      var t = [];
      try {
        t = JSON.parse(localStorage.getItem("akini_deleted_posts") || "[]");
      } catch (e) {}
      if (!Array.isArray(t) || !t.length) return e;
      var i = {};
      return (
        t.forEach(function (e) {
          i[String(e)] = 1;
        }),
        e.filter(function (e) {
          return !(e && e.id && i[String(e.id)]);
        })
      );
    } catch (t) {
      return e;
    }
  }),
  (window.__akiniFilterDelIcity = function (e) {
    try {
      if (!Array.isArray(e) || !e.length) return e;
      var t = [];
      try {
        t = JSON.parse(localStorage.getItem("akini_deleted_icity") || "[]");
      } catch (e) {}
      if (!Array.isArray(t) || !t.length) return e;
      var i = {};
      return (
        t.forEach(function (e) {
          i[String(e)] = 1;
        }),
        e.filter(function (e) {
          return !(e && e.id && i[String(e.id)]);
        })
      );
    } catch (t) {
      return e;
    }
  }),
  function () {
    function i() {
      try {
        var e =
            window.akiniContacts && window.akiniContacts.getActiveChatId ? window.akiniContacts.getActiveChatId() : "",
          t = document.getElementById("chatBody");
        if (e && t) {
          /* 回前台只补"空的聊天区"：以前这里发现内存历史比 DOM 长就整段 innerHTML，
             一万条消息会在每次切回页面时重新解析几 MB HTML，是闪退的主要来源之一。 */
          if (t.querySelectorAll(".msg-row").length) return;
          var i = "";
          try {
            i = window.__akiniChatLog
              ? window.__akiniChatLog.tail(e, 30)
              : (window.akiniContacts.getSession(e) || {}).messagesHTML || "";
          } catch (_te) {}
          i &&
            ((t.innerHTML = i),
            window.__akiniMedia && window.__akiniMedia.resolve && window.__akiniMedia.resolve(t),
            (t.scrollTop = t.scrollHeight));
        }
      } catch (e) {}
    }
    window.addEventListener("pageshow", function () {
      try {
        i();
      } catch (e) {}
      try {
        window.__akiniRenderUserText && window.__akiniRenderUserText();
      } catch (e) {}
      try {
        window.__akiniApplyAvatarSwap && window.__akiniApplyAvatarSwap();
      } catch (e) {}
    });
    var btn = document.getElementById("musicMenuBtn");
    btn &&
      !btn._neBound &&
      ((btn._neBound = 1),
      btn.addEventListener("click", function () {
        setTimeout(function () {
          try {
            window._renderPlaylist && window._renderPlaylist();
          } catch (e) {}
        }, 250);
      }));
  },
  document.addEventListener("DOMContentLoaded", function () {
    var e = document.getElementById("musicChatInput");
    (document.getElementById("musicChatModal"),
      e &&
        (e.addEventListener("click", function (t) {
          t.stopPropagation();
          try {
            e.focus();
          } catch (e) {}
        }),
        e.addEventListener("touchend", function (t) {
          t.stopPropagation();
          try {
            e.focus();
          } catch (e) {}
        })));
  }),
  (function () {
    function e() {
      !(function () {
        try {
          var e = document.getElementById("musicPlaylistOverlay");
          if (!e) return;
          if ("none" === e.style.display) return;
          window._renderPlaylist();
        } catch (e) {}
      })();
    }
    (setTimeout(e, 2e3),
      setTimeout(e, 5e3),
      setTimeout(e, 1e4),
      window.addEventListener("pageshow", function () {
        (setTimeout(e, 300), setTimeout(e, 1500));
      }),
      window.__akiniOnHidden(function () { setTimeout(function () {
              try {
                document.hidden && window.__akiniMedia && window.__akiniMedia.flushHalf();
              } catch (e) {}
            }, 6e4) }));
    try {
      ["musicMenuOverlay", "musicPlaylistOverlay"].forEach(function (t) {
        var i = document.getElementById(t);
        i &&
          window.MutationObserver &&
          new MutationObserver(function () {
            setTimeout(e, 80);
          }).observe(i, { attributes: !0, attributeFilter: ["style", "class"] });
      });
    } catch (e) {}
  })());
