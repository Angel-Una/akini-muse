window.__akiniDefer2 = function (fn) {
  if ("requestIdleCallback" in window) {
    requestIdleCallback(fn, { timeout: 5000 });
  } else {
    setTimeout(fn, 200);
  }
};
window.__akiniDefer2(function () {
  /* ===== Akini 问卷与商店卡片互动增强引擎 ===== */
  (function () {

    /* ---------- 1. 问卷双 Tab 已由 survey.js 统一实现（含 surveyAddFab 显隐），此处不再重复定义 ---------- */

    /* ---------- 2. 直接展示回答结果，从上到下从新到旧排序 ---------- */
    function _buildSurveyDirectResultHtml(s, isTaTab, realIdx, contactName) {
      try {
        var title = (s.title || "").trim() || "问卷";
        // 提取最新作答记录
        var replyToShow = null;
        if (s.replies && s.replies.length > 0) {
          replyToShow = s.replies[s.replies.length - 1];
        }
        var hasReply = !!(s.replied || (replyToShow && replyToShow.answers && replyToShow.answers.length > 0));

        // 时间：作答完成时间
        var bestTs = (replyToShow && replyToShow.ts) || s.createdAt || 0;
        var timeStr = bestTs
          ? new Date(bestTs).toLocaleString("zh-CN", {
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";

        // 状态：严格只展示已作答完成的标记（绝非答题入口）
        var statusBadge = isTaTab
          ? '<span style="font-size:12px;padding:3px 8px;border-radius:6px;background:#1a1a1a;color:#fff;font-weight:500;">✓ 我已回答</span>'
          : '<span style="font-size:12px;padding:3px 8px;border-radius:6px;background:#1a1a1a;color:#fff;font-weight:500;">✓ ' +
            (typeof escapeHtml === "function" ? escapeHtml(contactName || "TA") : contactName || "TA") +
            "已回答</span>";
        var subInfo = isTaTab
          ? "来自 " + (contactName || s.senderName || "联系人") + " &middot; " + timeStr
          : (contactName || "联系人") + " &middot; " + timeStr;

        var card =
          '<div class="survey-direct-card" style="background:#fff;border-radius:14px;padding:16px;margin-bottom:14px;box-shadow:0 1px 4px rgba(0,0,0,.04);border:1px solid #ebebeb;">';
        // 卡片顶部
        card +=
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #f2f2f2;">';
        card += '  <div style="flex:1;min-width:0;">';
        card +=
          '    <div style="font-size:16px;font-weight:600;color:#111;margin-bottom:3px;word-break:break-word;">' +
          (typeof escapeHtml === "function" ? escapeHtml(title) : title) +
          "</div>";
        card += '    <div style="font-size:12px;color:#888;">' + subInfo + "</div>";
        card += "  </div>";
        card += '  <div style="flex-shrink:0;">' + statusBadge + "</div>";
        card += "</div>";

        var qList = s.questions || [];
        if (qList.length === 0) {
          card += '<div style="font-size:13px;color:#999;padding:8px 0;">该问卷暂无问题</div>';
        } else {
          card += '<div style="display:flex;flex-direction:column;gap:10px;">';
          qList.forEach(function (q, qIdx) {
            var qText = q && q.text ? String(q.text).trim() : "问题 " + (qIdx + 1);
            var curType = (q && q.type) || s.qType || "single";
            var opts = (q && q.options ? q.options : []).filter(function (o) {
              return (o || "").trim();
            });
            if (curType === "yesno") opts = ["是", "否"];

            var ans = replyToShow && replyToShow.answers ? replyToShow.answers[qIdx] : undefined;
            var isMulti = curType === "multi" || Array.isArray(ans);

            var singlePickedIndex = -1;
            if (!isMulti && ans !== undefined && ans !== null && ans !== "") {
              if (typeof ans === "number" && ans >= 0 && ans < opts.length) {
                singlePickedIndex = ans;
              } else if (/^\d+$/.test(String(ans)) && parseInt(ans, 10) >= 0 && parseInt(ans, 10) < opts.length) {
                singlePickedIndex = parseInt(ans, 10);
              } else {
                var cCode = String(ans).trim().toUpperCase().charCodeAt(0) - 65;
                if (cCode >= 0 && cCode < opts.length && String(ans).trim().length === 1) {
                  singlePickedIndex = cCode;
                } else {
                  for (var _si = 0; _si < opts.length; _si++) {
                    if (String(opts[_si]).trim() === String(ans).trim()) {
                      singlePickedIndex = _si;
                      break;
                    }
                  }
                }
              }
            }

            card += '<div style="background:#fafafa;border-radius:10px;padding:12px;border:1px solid #f0f0f0;">';
            card +=
              '  <div style="font-size:14px;font-weight:600;color:#222;margin-bottom:8px;">' +
              (qIdx + 1) +
              ". " +
              (typeof escapeHtml === "function" ? escapeHtml(qText) : qText) +
              "</div>";

            if (opts.length >= 2) {
              card += '  <div style="display:flex;flex-direction:column;gap:6px;">';
              opts.forEach(function (opt, oIdx) {
                var label = String.fromCharCode(65 + oIdx);
                var isPicked = false;
                if (hasReply) {
                  if (isMulti) {
                    isPicked =
                      Array.isArray(ans) &&
                      (ans.indexOf(opt) >= 0 || ans.indexOf(oIdx) >= 0 || ans.indexOf(String(oIdx)) >= 0);
                  } else {
                    isPicked = oIdx === singlePickedIndex;
                  }
                }
                var dotStyle = isPicked
                  ? "width:14px;height:14px;border-radius:50%;background:#1a1a1a;border:none;flex-shrink:0;"
                  : "width:14px;height:14px;border-radius:50%;border:1.5px solid #bbb;background:#fff;box-sizing:border-box;flex-shrink:0;";
                var textStyle = isPicked
                  ? "font-size:13px;color:#111;font-weight:600;"
                  : "font-size:13px;color:#777;font-weight:400;";
                card += '    <div style="display:flex;align-items:center;gap:8px;min-height:28px;">';
                card += '      <div style="' + dotStyle + '"></div>';
                card +=
                  '      <span style="' +
                  textStyle +
                  '"><b style="margin-right:4px;">' +
                  label +
                  ".</b>" +
                  (typeof escapeHtml === "function" ? escapeHtml(opt) : opt) +
                  "</span>";
                if (isPicked) {
                  card +=
                    '      <span style="font-size:11px;color:#1a1a1a;background:#eee;padding:1px 6px;border-radius:4px;margin-left:auto;">' +
                    (isTaTab ? "我的回答" : "TA的选择") +
                    "</span>";
                }
                card += "    </div>";
              });
              card += "  </div>";
            } else {
              // 问答题或无选项展示
              var ansDisplay = ans !== undefined && ans !== null && ans !== "" ? String(ans) : "未作答";
              var textStyle = hasReply ? "color:#111;font-weight:500;" : "color:#999;font-style:italic;";
              card +=
                '  <div style="font-size:13px;padding:8px;background:#fff;border-radius:6px;border:1px solid #e8e8e8;' +
                textStyle +
                '">回答：' +
                (typeof escapeHtml === "function" ? escapeHtml(ansDisplay) : ansDisplay) +
                "</div>";
            }
            card += "</div>";
          });
          card += "</div>";
        }

        // 备注显示
        if (replyToShow && replyToShow.note) {
          card +=
            '<div style="margin-top:10px;padding:9px 12px;background:#f5f5f5;border-radius:8px;font-size:13px;color:#333;line-height:1.5;">';
          card +=
            '  <b style="color:#666;">备注：</b>' +
            (typeof escapeHtml === "function" ? escapeHtml(replyToShow.note) : replyToShow.note);
          card += "</div>";
        }

        // 仅作为已作答记录详情展示，严禁出现任何“去回答”或答题操作按钮
        card += "</div>";
        return card;
      } catch (err) {
        console.error("[_buildSurveyDirectResultHtml] error:", err);
        return "";
      }
    }

    window.renderSurveyList = function () {
      try {
        var container = document.getElementById("surveyListContainer");
        if (!container) return;
        var chatId =
          window.akiniContacts && window.akiniContacts.getActiveChatId ? window.akiniContacts.getActiveChatId() : "";
        if (!chatId) {
          container.innerHTML =
            '<div style="text-align:center;color:#999;padding:60px 20px;font-size:14px">请进入聊天后查看问卷</div>';
          return;
        }
        window.loadSurveys(chatId);
        var list = (window.surveys || []).slice().filter(function (s) {
          return s && !s.deleted;
        });

        var currentTab = window.__surveyChatTab || "mine";
        var isTaTab = currentTab === "ta";

        // 严格铁律——这两个模块只显示回答后的问卷详情和列表，绝对不是回答问卷的地方！
        function _isAnsweredSurvey(s) {
          if (!s) return false;
          if (s.replied === true) return true;
          if (Array.isArray(s.replies) && s.replies.length > 0) {
            for (var i = 0; i < s.replies.length; i++) {
              var r = s.replies[i];
              if (r && Array.isArray(r.answers) && r.answers.length > 0) return true;
            }
          }
          return false;
        }

        // 严格过滤：必须已作答，且按 Tab 归属分类；未回答的问卷绝不在此显示！
        var filtered = list.filter(function (s) {
          if (!_isAnsweredSurvey(s)) return false;
          if (isTaTab) return s.direction === "receive";
          return s.direction !== "receive";
        });

        // 从上到下按最新作答时间降序排序
        filtered.sort(function (a, b) {
          var tsA = a.createdAt || 0;
          if (a.replies && a.replies.length > 0) {
            a.replies.forEach(function (r) {
              if (r && r.ts && r.ts > tsA) tsA = r.ts;
            });
          }
          var tsB = b.createdAt || 0;
          if (b.replies && b.replies.length > 0) {
            b.replies.forEach(function (r) {
              if (r && r.ts && r.ts > tsB) tsB = r.ts;
            });
          }
          return tsB - tsA;
        });

        var fab = document.getElementById("surveyAddFab");
        if (fab) fab.style.display = isTaTab ? "none" : "flex";

        var targetContact =
          window.akiniContacts && window.akiniContacts.getChatTarget
            ? window.akiniContacts.getChatTarget(chatId)
            : null;
        var contactName = targetContact ? targetContact.name : "联系人";

        if (filtered.length === 0) {
          var tip = isTaTab
            ? "暂无我回答 " + contactName + " 的问卷记录<br>你在聊天中完成作答后将在此展示详情"
            : "暂无 " + contactName + " 回答我的问卷记录<br>对方在聊天中完成作答后将在此展示详情";
          container.innerHTML =
            '<div style="text-align:center;color:#999;padding:60px 20px;font-size:14px;line-height:1.7;">' +
            tip +
            "</div>";
          return;
        }

        var html = "";
        filtered.forEach(function (s) {
          var realIdx = (window.surveys || []).indexOf(s);
          html += _buildSurveyDirectResultHtml(s, isTaTab, realIdx, contactName);
        });
        container.innerHTML = html;
        // 彻底移除任何答题事件绑定
      } catch (e) {
        console.error("[renderSurveyList] error:", e);
      }
    };

    /* ---------- 3. 字卡库「问卷」Tab：表情包一致逻辑——仅联系人横条（无"我"），每个联系人独立问卷库 ---------- */
    window.__wbSurveyContactId = "";
    window.__renderWbSurveyTab = function () {
      {
        window.renderSurveyWbTab();
      }
    };

    /* ---------- 4. iOS 三通道事件委托：升级支持编辑与删除 ---------- */
    (function () {
      if (window.__wbSurveyTapDelegated) return;
      window.__wbSurveyTapDelegated = true;
      function _handleEditOrDel(ev) {
        if (window.__wbTab !== "survey") return;
        var t = ev.target && ev.target.closest ? ev.target : null;
        if (!t || !t.closest || !t.closest("#wbContent")) return;
        var editBtn = t.closest(".wb-survey-edit-btn");
        if (editBtn) {
          ev.preventDefault();
          var sid = editBtn.getAttribute("data-sid");
          var cid = window.__wbSurveyContactId || window.__currentWbSurveyCid || "";
          var list = [];
          try {
            var raw = localStorage.getItem("akini_surveys_" + cid);
            if (raw) list = JSON.parse(raw) || [];
          } catch (e) {}
          var sIdx = list.findIndex(function (it) {
            return String(it.id) === String(sid);
          });
          if (sIdx >= 0 && typeof window.openSurveyEdit === "function") {
            window.__surveyForContactConfig = cid;
            window.openSurveyEdit(sIdx);
          }
          return;
        }
        var delBtn = t.closest(".wb-survey-del-btn");
        if (delBtn) {
          ev.preventDefault();
          var sid = delBtn.getAttribute("data-sid");
          if (!confirm("确定删除该问卷吗？")) return;
          var cid = window.__wbSurveyContactId || window.__currentWbSurveyCid || "";
          var list = [];
          try {
            var raw = localStorage.getItem("akini_surveys_" + cid);
            if (raw) list = JSON.parse(raw) || [];
          } catch (e) {}
          var idx = list.findIndex(function (it) {
            return String(it.id) === String(sid);
          });
          if (idx >= 0) {
            list[idx].deleted = true;
            try {
              localStorage.setItem("akini_surveys_" + cid, JSON.stringify(list));
            } catch (e) {}
            window.renderSurveyWbTab();
          }
          return;
        }
      }
      window.addEventListener("click", _handleEditOrDel, false);
    })();

    function _scheduleSurveyRender() {
      setTimeout(function () {
        try {
          window.__renderWbSurveyTab();
        } catch (e) {}
      }, 60);
      setTimeout(function () {
        try {
          window.__renderWbSurveyTab();
        } catch (e) {}
      }, 190);
    }
    function _openCreateForContact() {
      var cid = window.__wbSurveyContactId || window.__currentWbSurveyCid || "";
      if (!cid) {
        // 自动从联系人列表或 localStorage 取第一个有效联系人
        try {
          if (window.akiniContacts && window.akiniContacts.getContacts) {
            var cs = window.akiniContacts.getContacts().filter(function (c) {
              return c && c.id !== "me" && c.id !== "my";
            });
            if (cs.length > 0) cid = cs[0].id;
          }
        } catch (e) {}
      }
      if (!cid) {
        try {
          cid = localStorage.getItem("akini_active_chat_id") || "";
        } catch (e) {}
      }
      if (!cid) {
        try {
          var rawC = localStorage.getItem("akini_contacts");
          if (rawC) {
            var clist = JSON.parse(rawC) || [];
            clist = clist.filter(function (c) {
              return c && c.id !== "me" && c.id !== "my";
            });
            if (clist.length > 0) cid = clist[0].id;
          }
        } catch (e) {}
      }
      if (!cid) {
        alert("请先在通讯录创建联系人");
        return;
      }
      window.__wbSurveyContactId = cid;
      window.__currentWbSurveyCid = cid;
      try {
        if (window.akiniContacts && window.akiniContacts.setActiveChatId) window.akiniContacts.setActiveChatId(cid);
      } catch (e) {}
      try {
        localStorage.setItem("akini_active_chat_id", cid);
      } catch (e) {}
      window.openSurveyCreate("contact");
    }

    var _tabHandler = function (e) {
      var tabBtn = e.target && e.target.closest ? e.target.closest(".wb-tabs .tab") : null;
      if (tabBtn && tabBtn.getAttribute("data-tab") === "survey") {
        window.__wbTab = "survey";
        _scheduleSurveyRender();
      }
      var addBtn = e.target && e.target.closest ? e.target.closest(".wb-head-add") : null;
      if (addBtn && window.__wbTab === "survey") {
        e.preventDefault();
        _openCreateForContact();
      }
    };
    document.addEventListener("click", _tabHandler, true);
    // 只保留 click，touchend 会导致一次点击触发两遍（create 弹窗/列表重渲染各执行两次）
    (function () {
      var tabs = document.querySelector(".wb-tabs");
      if (!tabs || !window.MutationObserver) return;
      new MutationObserver(function () {
        var act = tabs.querySelector(".tab.active");
        if (act && act.getAttribute("data-tab") === "survey") _scheduleSurveyRender();
      }).observe(tabs, { subtree: true, attributes: true, attributeFilter: ["class"] });
    })();

    /* ---------- 6. 商品详情按钮文案已由 shop.js 的 _setShopDetailMode 在打开前一并写死 ---------- */

    /* ---------- 7. 联系人回复后主动发问卷邀请 / 商店卡片 ---------- */
    (function () {
      if (window.__akiniInteractiveCardsReady) return;

      function activeChatId() {
        try {
          return window.akiniContacts && window.akiniContacts.getActiveChatId
            ? window.akiniContacts.getActiveChatId()
            : "";
        } catch (e) {
          return "";
        }
      }

      function contactName(chatId) {
        try {
          var t =
            window.akiniContacts && window.akiniContacts.getChatTarget
              ? window.akiniContacts.getChatTarget(chatId)
              : null;
          return (t && t.name) || "对方";
        } catch (e) {
          return "对方";
        }
      }

      function readJson(key, def) {
        try {
          var v = JSON.parse(localStorage.getItem(key) || "null");
          return v === null ? def : v;
        } catch (e) {
          return def;
        }
      }

      function wordNote(chatId) {
        try {
          var w = window.pickWordCards ? window.pickWordCards(1, chatId) : "";
          return (w && String(w).trim()) || "";
        } catch (e) {
          return "";
        }
      }

      /* 从该联系人的专属问卷库抽一份，生成「TA 发给我」的对话实例 */
      function sendSurveyInvite(chatId) {
        var list = readJson("akini_surveys_" + chatId, []);
        if (!Array.isArray(list)) return false;
        var pool = list.filter(function (s) {
          return (
            s &&
            !s.deleted &&
            s.direction !== "receive" &&
            !s.sentToChat &&
            String(s.id).indexOf("srv_recv_") !== 0 &&
            Array.isArray(s.questions) &&
            s.questions.length > 0
          );
        });
        if (!pool.length) return false;
        var src = pool[Math.floor(Math.random() * pool.length)];
        var clone = {
          id: "srv_recv_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
          sourceId: src.id,
          title: src.title || "",
          questions: JSON.parse(JSON.stringify(src.questions)),
          createdAt: Date.now(),
          qType: src.qType || "single",
          senderName: contactName(chatId),
          targetId: chatId,
          chatType: "contact",
          selectedMembers: [chatId],
          replies: [],
          replied: false,
          direction: "receive",
          replyAt: 0,
        };
        list.push(clone);
        try {
          var sk = "akini_surveys_" + chatId,
            sj = JSON.stringify(list);
          localStorage.setItem(sk, sj);
          try {
            window.akiniStore && window.akiniStore.memorySet && window.akiniStore.memorySet(sk, sj);
          } catch (e) {}
          if (localStorage.getItem(sk) !== sj) return false;
        } catch (e) {
          return false;
        }
        try {
          window.__akiniAllSurveys = window.__akiniAllSurveys || {};
          window.__akiniAllSurveys[clone.id] = clone;
        } catch (e) {}
        var row = null;
        try {
          row = window.insertSurveyBubble ? window.insertSurveyBubble(clone, false, "待回答", chatId) : null;
        } catch (e) {}
        if (row) {
          /* insertSurveyBubble 内部已把卡片写进 session.messagesHTML，
         这里只做一次去重校正，绝不重复落盘（否则会出现两张一样的邀请卡） */
          setTimeout(function () {
            try {
              var body = document.getElementById("chatBody");
              if (!body) return;
              var nodes = body.querySelectorAll('.bubble.survey-bubble[data-survey-id="' + clone.id + '"]');
              for (var i = 0; i < nodes.length - 1; i++) {
                var r = nodes[i].closest(".msg-row");
                if (r && r.parentNode) r.parentNode.removeChild(r);
              }
            } catch (e) {}
          }, 250);
        }
        return !!row;
      }

      /* 从商品库抽一件，让 TA 赠送或求你代付 */
      function sendShopCard(chatId) {
        var products = readJson("akini_shop_products", []);
        if (!Array.isArray(products) || !products.length) return false;
        var p = products[Math.floor(Math.random() * products.length)];
        if (!p || !p.id) return false;
        var type = Math.random() < 0.5 ? "delegate" : "gift";
        var orderId = "ord_recv_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
        try {
          window.__shopReceiveCard(chatId, type, p.id, orderId, wordNote(chatId));
        } catch (e) {
          return false;
        }
        return true;
      }

      /* 每项概率都是「每次回复独立判定」的字面百分比，100 就必定命中。
       一次回复最多发一张卡：按 一起听邀请 → 问卷邀请 → 商店卡片 的顺序取第一个真正发出的。
       三者与回复一样走「回复触发」，不受主动发消息开关约束。 */
      function triggerCards(chatId) {
        if (!chatId || chatId !== activeChatId()) return;
        if (window.__akiniCardTriggering) return;
        var AKR = window.AKR;
        if (!AKR || typeof AKR.getProb !== "function") return;
        window.__akiniCardTriggering = true;
        try {
          if (Math.random() < AKR.getProb("invite") && sendMusicInvite(chatId)) return;
          if (Math.random() < AKR.getProb("surveyInvite") && sendSurveyInvite(chatId)) return;
          if (Math.random() < AKR.getProb("shopCard")) sendShopCard(chatId);
        } finally {
          setTimeout(function () {
            window.__akiniCardTriggering = false;
          }, 1200);
        }
      }

      function sendMusicInvite(chatId) {
        try {
          if (!window.__akiniSendMusicInviteCard) return false;
          if (chatId !== activeChatId()) return false;
          /* 返回真实结果：60 秒节流/已在听歌等情况下没发出，就继续判定问卷与商店卡片 */
          return !!window.__akiniSendMusicInviteCard();
        } catch (e) {
          return false;
        }
      }

      /* core 的回复由内部函数直接插入，不经过 window.I / akiniTriggerReply，
       因此用 DOM 观察兜底：用户发消息后的 60 秒内，聊天里新增「对方」普通文字气泡时按概率触发。
       只统计「我发消息 → 联系人回复」这条路径，主动消息/定时内容不触发。 */
      function markUserSend() {
        window.__akiniUserSentAt = Date.now();
        window.__akiniCardTriggeredForSend = false;
      }
      document.addEventListener(
        "click",
        function (e) {
          try {
            if (e.target && e.target.closest && e.target.closest("#sendBtn")) markUserSend();
          } catch (err) {}
        },
        true,
      );
      document.addEventListener(
        "keydown",
        function (e) {
          try {
            if (e.key === "Enter" && e.target && e.target.id === "msgInput" && !e.isComposing) markUserSend();
          } catch (err) {}
        },
        true,
      );

      var CARD_CLASSES = [
        "survey-bubble",
        "shop-card-bubble",
        "music-invite-bubble",
        "music-end-bubble",
        "transfer-bubble",
        "sticker-bubble",
        "redpacket-bubble",
      ];
      function isPlainTextRow(row) {
        var b = row.querySelector(".bubble");
        if (!b) return false;
        for (var i = 0; i < CARD_CLASSES.length; i++) {
          if (b.classList.contains(CARD_CLASSES[i])) return false;
        }
        return true;
      }
      function onRowAdded(row) {
        try {
          if (!row || row.nodeType !== 1 || !row.classList || !row.classList.contains("msg-row")) return;
          if (!row.classList.contains("other") && !row.classList.contains("ta")) return;
          if (!isPlainTextRow(row)) return;
          if (window.__akiniCardTriggering || window.__akiniCardTriggeredForSend) return;
          var sentAt = window.__akiniUserSentAt || 0;
          if (!sentAt || Date.now() - sentAt > 60000) return;
          var ts = parseInt(row.getAttribute("data-ts") || "0", 10);
          if (ts > 0 && Date.now() - ts > 60000) return;
          var id = activeChatId();
          if (!id) return;
          window.__akiniCardTriggeredForSend = true;
          setTimeout(
            function () {
              triggerCards(id);
            },
            1600 + Math.random() * 800,
          );
        } catch (err) {}
      }
      function startCardObserver() {
        var body = document.getElementById("chatBody");
        if (!body || typeof MutationObserver !== "function") return false;
        if (body.__akiniCardObserver) return true;
        var mo = new MutationObserver(function (muts) {
          for (var i = 0; i < muts.length; i++) {
            var added = muts[i].addedNodes || [];
            for (var j = 0; j < added.length; j++) {
              var n = added[j];
              if (!n || n.nodeType !== 1) continue;
              if (n.classList && n.classList.contains("msg-row")) {
                onRowAdded(n);
                continue;
              }
              if (!n.querySelectorAll) continue;
              var rows = n.querySelectorAll(".msg-row");
              for (var k = 0; k < rows.length; k++) onRowAdded(rows[k]);
            }
          }
        });
        mo.observe(body, { childList: true });
        body.__akiniCardObserver = mo;
        return true;
      }
      if (!startCardObserver()) {
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startCardObserver);
        else setTimeout(startCardObserver, 300);
      }
    })();
  })();
});

(function () {
  /* 用户明确要求：任何情况下都不自动降载（不关动画、不去模糊）。 */
  return;
  var HEAP_LIMIT = 0.85;
  var IDLE_TIMEOUT = 25000;
  var lastInteraction = Date.now();
  ["touchstart", "touchmove", "mousedown", "keydown", "scroll"].forEach(function (ev) {
    document.addEventListener(
      ev,
      function () {
        lastInteraction = Date.now();
      },
      { passive: true, capture: true },
    );
  });
  function heapRatio() {
    try {
      if (performance && performance.memory && performance.memory.jsHeapSizeLimit) {
        return performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
      }
    } catch (e) {}
    return 0;
  }
  var degraded = false;
  function degrade(reason) {
    if (degraded) return;
    degraded = true;
    try {
      console.warn("[Akini] iOS 内存压力降载:", reason);
    } catch (e) {}
    try {
      document.documentElement.classList.add("akini-low-mem");
    } catch (e) {}
    try {
      document.querySelectorAll("video").forEach(function (v) {
        try {
          v.pause();
        } catch (e) {}
      });
    } catch (e) {}
  }
  var _memIv = setInterval(function () {
    if (document.hidden) return;
    var r = heapRatio();
    if (r > HEAP_LIMIT) {
      degrade("heap " + Math.round(r * 100) + "%");
      return;
    }
    if (r > 0.65 && Date.now() - lastInteraction > IDLE_TIMEOUT) {
      degrade("idle heap " + Math.round(r * 100) + "%");
    }
  }, 15000);
  window.__akiniOnVisible(function () { if (!degraded) lastInteraction = Date.now(); });
})();

(function () {
  function install() {
    if (
      window.__akiniChatSwitchPatched ||
      !window.akiniContacts ||
      typeof window.akiniContacts.setActiveChatId !== "function"
    )
      return;
    window.__akiniChatSwitchPatched = true;
    var orig = window.akiniContacts.setActiveChatId.bind(window.akiniContacts);
    window.akiniContacts.setActiveChatId = function (id) {
      var prev = "";
      try {
        prev = window.akiniContacts.getActiveChatId ? window.akiniContacts.getActiveChatId() : "";
      } catch (e) {}
      orig(id);
      if (id && prev !== id) {
        try {
          var body = document.getElementById("chatBody");
          if (body) {
            body.innerHTML = "";
            body.scrollTop = 0;
          }
        } catch (e) {}
        
window.__akiniIncCache = {};

        try {
          var zn = document.getElementById("chatBody");
          if (zn) zn.setAttribute("data-rendered-chat-id", "");
        } catch (e) {}
      }
    };
  }
  install();
  var _iv = setInterval(function () {
    install();
    if (window.__akiniChatSwitchPatched) clearInterval(_iv);
  }, 200);
  setTimeout(function () {
    try {
      clearInterval(_iv);
    } catch (e) {}
  }, 8000);
})();

(function () {
  var lastKick = 0;
  function toggleOn(name) {
    try {
      var v = localStorage.getItem("akini_toggle_" + name);
      return v === "1";
    } catch (e) {
      return false;
    }
  }
  function hasContacts() {
    try {
      if (!window.akiniContacts || !window.akiniContacts.getContacts) return false;
      var c = window.akiniContacts.getContacts();
      return !!(c && c.length);
    } catch (e) {
      return false;
    }
  }
  function hasSchedule(key) {
    try {
      var v = parseFloat(localStorage.getItem(key) || "0");
      return v > 0;
    } catch (e) {
      return false;
    }
  }
  function kick() {
    var now = Date.now();
    if (now - lastKick < 45000) return;
    lastKick = now;
    if (!hasContacts()) return;
    if (toggleOn("contactFriendsToggle") && !hasSchedule("akini_next_friendsPost")) {
      try {
        {
          window._akiniRescheduleFriendsPost();
          console.log("[Akini] 朋友圈调度死停，已重新排期");
        }
      } catch (e) {}
    }
    if (toggleOn("contactIcityToggle") && !hasSchedule("akini_next_icityPost")) {
      try {
        {
          window._akiniRescheduleIcityPost();
          console.log("[Akini] iCity调度死停，已重新排期");
        }
      } catch (e) {}
    }
    if (toggleOn("contactMailToggle")) {
      try {
        if (window.akiniMailEngine && typeof window.akiniMailEngine.checkStatus === "function") {
          window.akiniMailEngine.checkStatus();
        }
      } catch (e) {}
    }
  }
  var bootIv = setInterval(function () {
    if (hasContacts()) {
      clearInterval(bootIv);
      kick();
      setInterval(kick, 60000);
    }
  }, 1000);
  setTimeout(function () {
    try {
      clearInterval(bootIv);
    } catch (e) {}
  }, 120000);
  window.__akiniOnVisible(function () { 
      lastKick = 0;
      kick();
     });

  function firstKickIfNeeded() {
    try {
      if (localStorage.getItem("akini__first_kick") === "1") return;
      if (!hasContacts()) return;
      var friends = toggleOn("contactFriendsToggle");
      var icity = toggleOn("contactIcityToggle");
      var mail = toggleOn("contactMailToggle");
      if (!friends && !icity && !mail) return;
      localStorage.setItem("akini__first_kick", "1");
      var delay = 10000 + Math.floor(Math.random() * 80000);
      setTimeout(function () {
        try {
          if (friends && typeof window._akiniRescheduleFriendsPost === "function") {
            window._akiniRescheduleFriendsPost();
          }
          if (icity && typeof window._akiniRescheduleIcityPost === "function") {
            window._akiniRescheduleIcityPost();
          }
          if (mail) {
            try {
              localStorage.removeItem("akini_next_mailAutoSend");
            } catch (e0) {}
            if (window.akiniMailEngine && typeof window.akiniMailEngine.checkStatus === "function") {
              window.akiniMailEngine.checkStatus();
            }
          }
          console.log("[Akini] 首启快速互动已触发");
        } catch (e) {}
      }, delay);
    } catch (e) {}
  }
  var fkIv = setInterval(function () {
    firstKickIfNeeded();
    if (localStorage.getItem("akini__first_kick") === "1") clearInterval(fkIv);
  }, 1500);
  setTimeout(function () {
    try {
      clearInterval(fkIv);
    } catch (e) {}
  }, 60000);
})();

(function () {
  "use strict";

  /* ---------- 配置：区域 ↔ 元素ID ↔ inputID ↔ 存储键 ---------- */
  var AREAS = {
    s1cover: {
      elId: "s1CoverBg",
      inputId: "s1CoverInputDirect",
      keys: ["akini_s1_cover", "akini_s1_cover_bg", "s1_cover"],
    },
    polaroid: {
      elId: "s1PolaroidImg",
      inputId: "s1PhotoInputDirect",
      keys: ["akini_s1_photo", "akini_s1_polaroid_img"],
    },
    cover: {
      elId: "coverAreaMain",
      inputId: "s2CoverInputDirect",
      keys: ["akini_cover_bg", "akini_cover_img", "akini_s2_cover", "cover_bg"],
    },
    daybg: {
      elId: "bgArea",
      inputId: "s2DayBgInputDirect",
      keys: ["akini_day_bg", "akini_bg_img", "akini_anniv_bg", "day_bg"],
    },
  };

  /* ---------- 工具函数 ---------- */

  // 合法图片值校验：只接受真正的图片地址，截断/脏值一律拒绝，避免上墙后变成黑块
  function validImage(v) {
    if (!v || typeof v !== "string" || v.length < 100) return false;
    if (/^data:image\//i.test(v)) return true;
    if (/^(blob:|https?:\/\/|\/)/i.test(v)) return true;
    return false;
  }

  // 把 dataUrl 设为元素背景（用 !important 防止 CSS 简写覆盖）
  function applyBg(elId, dataUrl) {
    var el = document.getElementById(elId);
    if (!el) return;
    /* 取不到有效图片时什么都不做：这里绝不能 removeProperty，
       否则启动早期存储还没从 IDB 恢复完时，会把拍立得/封面上已恢复的
       背景图清掉，表现为「刷新后底图消失」 */
    if (!validImage(dataUrl)) return;
    el.style.setProperty("background-image", 'url("' + dataUrl + '")', "important");
    el.style.setProperty("background-size", "cover", "important");
    el.style.setProperty("background-position", "center", "important");
    el.style.setProperty("background-repeat", "no-repeat", "important");
  }

  // 只写主键：同一张图写 4 个键会把 localStorage 配额挤爆，导致其他图片被驱逐后变黑
  function persist(keys, dataUrl) {
    var primary = keys[0];
    /* 内存镜像先落，保证当前会话内任何同步读取都能拿到新图 */
    try {
      if (window.akiniStore && window.akiniStore.memorySet) window.akiniStore.memorySet(primary, dataUrl);
    } catch (eM0) {}
    try {
      localStorage.setItem(primary, dataUrl);
    } catch (e) {
      /* 配额写满：值留在内存副本里，保证下次启动前同会话仍可读 */
      try {
        var _fb = window.__akiniLsFallback || (window.__akiniLsFallback = Object.create(null));
        _fb[primary] = dataUrl;
      } catch (eFb) {}
    }
    /* 打写入时间戳：恢复侧用 akini_wts_<key> 判断谁更新，没时间戳的新图
       有可能被存储层当成"旧值"拒绝回填，表现为刷新后底图回到更早的状态 */
    try {
      if (window.__akiniImgWts && window.__akiniImgWts.stamp) window.__akiniImgWts.stamp(primary);
    } catch (eWt) {}
    /* 单通道：localStorage.setItem 已被存储层拦截（内存 + IndexedDB），不再额外直写 _idbStore */
    try {
      if (window.akiniStore && typeof window.akiniStore.set === "function") {
        window.akiniStore.set(primary, dataUrl);
        if (typeof window.akiniStore.flushIdb === "function") window.akiniStore.flushIdb();
      }
    } catch (e) {}
  }

  // 取第一个有效存储值（LS 优先，其次内存镜像）
  function firstValid(keys) {
    for (var i = 0; i < keys.length; i++) {
      var v = null;
      try {
        v = localStorage.getItem(keys[i]);
      } catch (e) {}
      if (!validImage(v) && window.akiniStore && window.akiniStore.memoryGet) {
        try {
          var m = window.akiniStore.memoryGet(keys[i]);
          if (validImage(m)) v = m;
        } catch (e2) {}
      }
      if (validImage(v)) return v;
    }
    return null;
  }

  // 压缩（如果有压缩函数），否则原样回调
  function compress(dataUrl, cb) {
    if (typeof window.compressImageDataUrl === "function") {
      window.compressImageDataUrl(dataUrl, function (c) {
        cb(c || dataUrl);
      });
    } else {
      cb(dataUrl);
    }
  }

  /* ---------- 核心：处理选中的图片文件 ---------- */
  function processFile(type, file) {
    if (!file) return;
    var area = AREAS[type];
    if (!area) return;

    var reader = new FileReader();
    reader.onload = function (ev) {
      var dataUrl = ev.target.result;
      compress(dataUrl, function (finalUrl) {
        applyBg(area.elId, finalUrl);
        persist(area.keys, finalUrl);
      });
    };
    reader.onerror = function () {
      if (window.akiniToast) window.akiniToast("图片读取失败，请重试");
    };
    reader.readAsDataURL(file);
  }

  /* ---------- 绑定 input 的 change 事件（幂等） ---------- */
  function bindInput(type) {
    var area = AREAS[type];
    var input = document.getElementById(area.inputId);
    if (!input || input.__akImgBound) return;
    input.__akImgBound = true;
    input.addEventListener("change", function (e) {
      processFile(type, e.target.files && e.target.files[0]);
      // 重置 input，允许重复选同一张图
      try {
        e.target.value = "";
      } catch (err) {}
    });
  }

  /* ---------- 全局点击委托：点击区域 → 触发对应 input ---------- */
  function setupClickDelegation() {
    document.addEventListener("click", function (ev) {
      var t = ev.target;
      // 点到 input 本身不处理
      if (t && t.tagName === "INPUT" && t.type === "file") return;

      var host =
        t && t.closest ? t.closest("#s1CoverBg, #s1PolaroidImg, #coverAreaMain, #dualAvatarWrap, #bgArea") : null;
      if (!host) return;

      var id = host.id;
      var inputId = null;
      if (id === "s1CoverBg") inputId = AREAS.s1cover.inputId;
      else if (id === "s1PolaroidImg") inputId = AREAS.polaroid.inputId;
      else if (id === "coverAreaMain" || id === "dualAvatarWrap") inputId = AREAS.cover.inputId;
      else if (id === "bgArea") inputId = AREAS.daybg.inputId;

      if (inputId) {
        ev.preventDefault();
        ev.stopPropagation();
        var inp = document.getElementById(inputId);
        if (inp) {
          try {
            inp.value = "";
          } catch (e) {}
          inp.click();
        }
      }
    });
  }

  /* ---------- 恢复已保存的图片 ---------- */
  function restoreAll() {
    applyBg(AREAS.s1cover.elId, firstValid(AREAS.s1cover.keys));
    applyBg(AREAS.polaroid.elId, firstValid(AREAS.polaroid.keys));
    applyBg(AREAS.cover.elId, firstValid(AREAS.cover.keys));
    applyBg(AREAS.daybg.elId, firstValid(AREAS.daybg.keys));
  }

  /* ---------- 初始化 ---------- */
  function init() {
    bindInput("s1cover");
    bindInput("polaroid");
    bindInput("cover");
    bindInput("daybg");
    setupClickDelegation();
    restoreAll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // 存储层恢复后再次恢复图片（数据可能从 IDB 异步加载）
  function onStorageReady() {
    restoreAll();
  }
  if (window.__akiniStorageRestored) {
    onStorageReady();
  } else {
    /* 存储层恢复完成后会调用 __akiniOnCriticalRestored；
       旧名 __akiniOnStorageRestored 从未被存储层触发，会导致被驱逐到 IDB 的
       第二屏封面/纪念日底图永远回不来——这里同时挂两个钩子兜底 */
    var prev = window.__akiniOnCriticalRestored;
    window.__akiniOnCriticalRestored = function () {
      if (typeof prev === "function") {
        try {
          prev();
        } catch (e) {}
      }
      onStorageReady();
    };
    var prev2 = window.__akiniOnStorageRestored;
    window.__akiniOnStorageRestored = function () {
      if (typeof prev2 === "function") {
        try {
          prev2();
        } catch (e) {}
      }
      onStorageReady();
    };
  }

  /* ---------- 兼容旧内联 onchange（core.js 19374 仍在调用） ---------- */
  window.handleS2DayBgDirect = function (e) {
    processFile("daybg", e.target && e.target.files && e.target.files[0]);
  };
})();


/* ===== 回复看门狗：兜掉「某些机型/浏览器联系人不回消息」 =====
   正常链路是 akiniTriggerReply → setTimeout(3~7s) → window.I() 渲染对方消息。
   但这条链路是「一次性」的：中间任何一步在某个机型上失败（渲染抛错、定时器被挂起、
   语料读取为空、开关值读不到），消息就永远不来了，页面上看不出任何报错。
   这里用 MutationObserver 监听聊天区：
     · 出现「我」的消息 → 起一个 15 秒的看门狗（正常回复最多 7 秒 + 打字延迟，不会误伤）；
     · 出现「对方」的消息 → 立刻撤掉看门狗；
     · 15 秒到点还没有对方消息、且仍停在这个会话、页面在前台 → 调 __akiniForceReply()
       （就是底部「继续」按钮用的那个函数）强制补一条。
   这样不管什么机型、什么浏览器，都不会再出现「发出去了但对方一条不回」。 */
(function () {
  if (window.__akiniReplyWatchdogInstalled) return;
  window.__akiniReplyWatchdogInstalled = true;

  var WATCH_MS = 15000;
  var timer = null;
  var tries = 0;

  function activeId() {
    try {
      return window.akiniContacts && window.akiniContacts.getActiveChatId
        ? window.akiniContacts.getActiveChatId()
        : null;
    } catch (e) {
      return null;
    }
  }

  function disarm() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function arm() {
    disarm();
    var cid = activeId();
    if (!cid) return;
    timer = setTimeout(function () {
      timer = null;
      try {
        if (activeId() !== cid) return; /* 用户已切到别的会话 */
        if (document.hidden) return; /* App 在后台：等回来再靠正常链路 */
        if (window.__akiniToggleOn && !window.__akiniToggleOn("contactReplyToggle", true)) return;
        if (typeof window.__akiniForceReply !== "function") return;
        window.__akiniForceReply();
      } catch (e) {}
    }, WATCH_MS);
  }

  function init() {
    var body = document.getElementById("chatBody");
    if (!body) {
      if (++tries < 100) setTimeout(init, 300);
      return;
    }
    var obs = new MutationObserver(function (muts) {
      var sawMe = false,
        sawOther = false;
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes || [];
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (!n || n.nodeType !== 1 || !n.classList) continue;
          if (!n.classList.contains("msg-row")) continue;
          if (n.classList.contains("me")) sawMe = true;
          if (n.classList.contains("other")) sawOther = true;
        }
      }
      if (sawOther) disarm();
      else if (sawMe) arm();
    });
    obs.observe(body, { childList: true });
  }

  init();
})();

/* ---- moved from index.html: 飞机票文本编辑：对齐单人模块局内弹窗（半透明遮罩+圆角卡片+ ---- */
/* 飞机票文本编辑：对齐单人模块局内弹窗（半透明遮罩+圆角卡片+输入框+确定/取消） */
(function () {
  var TXT_KEY = "akini_ticket_texts";
  function loadTxt() {
    try {
      var t = JSON.parse(localStorage.getItem(TXT_KEY) || "{}");
      return t || {};
    } catch (e) {
      return {};
    }
  }
  function saveTxt(t) {
    try {
      localStorage.setItem(TXT_KEY, JSON.stringify(t));
    } catch (e) {}
  }
  function applyTxt() {
    var t = loadTxt();
    var map = { from: "tkFrom", fromTime: "tkFromTime", to: "tkTo", toTime: "tkToTime", dur: "tkDur" };
    for (var k in map) {
      if (t[k]) {
        var el = document.getElementById(map[k]);
        if (el) el.textContent = t[k];
      }
    }
  }
  function showModal(field) {
    var labels = { from: "出发城市", fromTime: "出发时间", to: "到达城市", toTime: "到达时间", dur: "飞行时长" };
    var defaults = { from: "RPG", fromTime: "08:00 AM", to: "RPG", toTime: "09:30 AM", dur: "1h 30m" };
    var t = loadTxt();
    var cur = t[field] || defaults[field] || "";
    var title = "修改" + (labels[field] || "内容");

    var oldModal = document.getElementById("akiniTicketEditOverlay");
    if (oldModal) oldModal.remove();

    var overlay = document.createElement("div");
    overlay.id = "akiniTicketEditOverlay";
    overlay.style.cssText =
      "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:8900;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;-webkit-tap-highlight-color:transparent;";

    var card = document.createElement("div");
    card.style.cssText =
      "background:#ffffff;border-radius:18px;width:100%;max-width:320px;padding:20px;box-sizing:border-box;box-shadow:0 10px 30px rgba(0,0,0,0.2);animation:akiniModalPop 0.2s ease-out;";

    var titleEl = document.createElement("div");
    titleEl.textContent = title;
    titleEl.style.cssText = "font-size:16px;font-weight:700;color:#1a1a1a;margin-bottom:14px;text-align:center;";

    var input = document.createElement("input");
    input.type = "text";
    input.value = cur;
    input.placeholder = "请输入" + (labels[field] || field);
    input.style.cssText =
      "width:100%;height:42px;border:1px solid #e0e0e0;border-radius:10px;padding:0 12px;font-size:14px;box-sizing:border-box;outline:none;background:#f9f9f9;color:#1a1a1a;margin-bottom:18px;";

    var btnRow = document.createElement("div");
    btnRow.style.cssText = "display:flex;gap:10px;";

    var cancelBtn = document.createElement("button");
    cancelBtn.textContent = "取消";
    cancelBtn.type = "button";
    cancelBtn.style.cssText =
      "flex:1;height:40px;border:none;border-radius:10px;background:#f2f2f7;color:#666;font-size:14px;font-weight:600;cursor:pointer;";
    cancelBtn.onclick = function () {
      overlay.remove();
    };

    var confirmBtn = document.createElement("button");
    confirmBtn.textContent = "确定";
    confirmBtn.type = "button";
    confirmBtn.style.cssText =
      "flex:1;height:40px;border:none;border-radius:10px;background:#1a1a1a;color:#fff;font-size:14px;font-weight:600;cursor:pointer;";
    confirmBtn.onclick = function () {
      var v = input.value.trim();
      if (v) {
        t[field] = v;
        saveTxt(t);
        applyTxt();
      }
      overlay.remove();
    };

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(confirmBtn);
    card.appendChild(titleEl);
    card.appendChild(input);
    card.appendChild(btnRow);
    overlay.appendChild(card);

    overlay.onclick = function (e) {
      if (e.target === overlay) overlay.remove();
    };
    document.body.appendChild(overlay);
    setTimeout(function () {
      input.focus();
    }, 100);
  }

  window.__akiniEditTicketField = showModal;
  document.addEventListener("DOMContentLoaded", applyTxt);
  applyTxt();
})();

/* ---- moved from index.html: 重型库延迟加载：html2canvas(截图)/hls.js ---- */
/* 重型库延迟加载：html2canvas(截图)/hls.js(m3u8播放) 共 ~600KB，
   启动完成后 5 秒再加载，降低启动内存峰值，缓解 iOS 后台回收/崩溃。
   调用点均有 window.html2canvas / window.Hls 存在性检查，天然兼容。 */
(function () {
  setTimeout(function () {
    try {
      var libs = [
        "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js",
        "https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js",
      ];
      libs.forEach(function (u) {
        var s = document.createElement("script");
        s.src = u;
        s.async = true;
        document.head.appendChild(s);
      });
    } catch (e) {}
  }, 5000);
})();

/* ---- moved from index.html: ===== 联系人主动来电：使用现有通话弹窗，独立概率 35 ---- */
/* ===== 联系人主动来电：使用现有通话弹窗，独立概率 35% ===== */
(function () {
  var randomTimer = null;

  function getNum(key, def) {
    var v = parseFloat(localStorage.getItem(key));
    return isNaN(v) ? def : v;
  }

  function pickContact() {
    try {
      var dc = window.__akiniDefaultContact && window.__akiniDefaultContact();
      if (dc) return dc;
    } catch (e) {}
    var contacts = window.akiniContacts ? window.akiniContacts.getContacts() : [];
    if (!contacts || contacts.length === 0) return null;
    return contacts[0];
  }

  function triggerIncomingCall() {
    if ((window.isCallOngoing && window.isCallOngoing()) || (window._callState && window._callState.active)) return;
    var c = pickContact();
    if (!c || !window.Te) return;
    window.Te(c.name, false, { callerAvatar: c.avatar, targetId: c.id });
  }

  function scheduleRandomCall() {
    clearTimeout(randomTimer);
    var min = getNum("akini_num_activeCallMin", 30);
    var max = getNum("akini_num_activeCallMax", 120);
    if (min < 1) min = 1;
    if (max < min) max = min;
    var ms = (min + Math.random() * (max - min)) * 60 * 1000;
    randomTimer = setTimeout(function () {
      // 独立概率：每次触发点 35% 概率来电
      if (Math.random() < 0.35) triggerIncomingCall();
      scheduleRandomCall();
    }, ms);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleRandomCall);
  } else {
    scheduleRandomCall();
  }

})();
