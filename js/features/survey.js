window.__akiniDefer = function (fn) {
  if ("requestIdleCallback" in window) {
    requestIdleCallback(fn, { timeout: 3000 });
  } else {
    setTimeout(fn, 100);
  }
};
window.__akiniDefer(function () {
  (function () {
    // ===== State =====
    var surveys = [];
    var questions = []; // [{ text:"", options:["",""] }]
    var editingSurveyId = null;
    var surveyTitle = "";
    var surveyQType = "single"; // single=单选 | multi=多选 | yesno=是与否
    var currentSurveyChatId = "";

    /* core 覆盖过 localStorage.setItem（对已有 akini_ 键写入会静默失败），问卷数据统一走原型写入，
     保证字卡库新增专属问卷、回答状态都能真正落盘，联系人发来的问卷点击时也能读到完整题目 */
    function lsSetRaw(k, v) {
      try {
        var s = String(v);
        localStorage.setItem(k, s);
        try {
          window.akiniStore && window.akiniStore.memorySet && window.akiniStore.memorySet(k, s);
        } catch (e) {}
        return localStorage.getItem(k) === s;
      } catch (e) {
        return false;
      }
    }

    function getSurveyKey(chatId) {
      var id = chatId || currentSurveyChatId || getCurrentSurveyChatId();
      return "akini_surveys_" + (id || "default");
    }

    function loadSurveys(chatId) {
      if (chatId) currentSurveyChatId = chatId;
      if (!currentSurveyChatId) currentSurveyChatId = getCurrentSurveyChatId();
      try {
        var raw = localStorage.getItem(getSurveyKey());
        surveys = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(surveys)) surveys = [];
      } catch (e) {
        surveys = [];
      }
      // 双向同步全局问卷注册池，防止跨会话查找丢失
      try {
        window.__akiniAllSurveys = window.__akiniAllSurveys || {};
        surveys.forEach(function (s) {
          if (s && s.id) window.__akiniAllSurveys[s.id] = s;
        });
      } catch (e) {}
      window.surveys = surveys;
    }

    function migrateOldSurveys() {
      try {
        var raw = localStorage.getItem("akini_surveys");
        if (!raw) return;
        var old = JSON.parse(raw);
        if (!Array.isArray(old) || old.length === 0) return;
        var map = {};
        old.forEach(function (s) {
          var cid = s.targetId || s.chatId || getCurrentSurveyChatId() || "default";
          if (!map[cid]) map[cid] = [];
          map[cid].push(s);
        });
        Object.keys(map).forEach(function (cid) {
          try {
            var key = "akini_surveys_" + cid;
            if (!localStorage.getItem(key)) {
              lsSetRaw(key, JSON.stringify(map[cid]));
            }
          } catch (e) {}
        });
        localStorage.removeItem("akini_surveys");
        localStorage.removeItem("akini_surveys_backup");
      } catch (e) {
        console.error("[survey] migrateOldSurveys error", e);
      }
    }
    // 从聊天记录中的 survey-bubble 恢复问卷数据（带会话级缓存）
    var __surveyRecoverCache = {};
    function recoverSurveysFromChat(chatId) {
      try {
        if (!window.akiniContacts || !window.akiniContacts.getContacts) return;
        var contacts = window.akiniContacts.getContacts();
        if (!contacts || !contacts.forEach) return;
        var contactsToRecover = [];
        if (chatId) {
          contactsToRecover = contacts.filter(function (c) {
            return c.id === chatId;
          });
        } else {
          contactsToRecover = contacts.slice();
        }
        contactsToRecover.forEach(function (ct) {
          currentSurveyChatId = ct.id;
          loadSurveys(ct.id);
          var changed = false;
          var session = window.akiniContacts.getSession(ct.id);
          var html = session && session.messagesHTML;
          if (!html) return;
          var htmlLen = html.length;
          var cached = __surveyRecoverCache[ct.id];
          if (cached && cached.len === htmlLen && cached.count === surveys.length) return;
          __surveyRecoverCache[ct.id] = { len: htmlLen, count: surveys.length };
          var tmp = document.createElement("div");
          tmp.innerHTML = html;
          var bubbles = tmp.querySelectorAll(".bubble.survey-bubble");
          bubbles.forEach(function (bubble) {
            var sid = bubble.getAttribute("data-survey-id");
            if (!sid) return;
            var exists =
              surveys.findIndex(function (s) {
                return s.id === sid;
              }) >= 0;
            if (exists) return;
            var isReply = bubble.getAttribute("data-survey-reply") === "1";
            var memberId = bubble.getAttribute("data-member-id");
            var titleEl = bubble.querySelector(".survey-bubble-title");
            var qEl = bubble.querySelector(".survey-bubble-q");
            var statusEl = bubble.querySelector(".survey-bubble-status");
            var countEl = bubble.querySelector(".survey-bubble-count");
            var title = (titleEl && titleEl.textContent) || "";
            var qText = (qEl && qEl.textContent) || "";
            var status = (statusEl && statusEl.textContent) || "";
            var qCount = 1;
            if (countEl) {
              var cm = (countEl.textContent || "").match(/(\d+)/);
              if (cm) qCount = parseInt(cm[1], 10) || 1;
            }
            /* 重建残缺问卷卡片 */
            var q = { text: qText.replace(/^问题：/, "").trim() || "问卷", options: [] };
            var s = {
              id: sid,
              title: isReply ? q.text || "问卷" : "问卷",
              questions: qCount > 0 ? [q] : [q],
              createdAt: Date.now() - 1000,
              senderName: isReply ? "对方" : "我",
              targetId: ct.id,
              chatType: "contact",
              selectedMembers: [ct.id],
              replies: [],
              replied: isReply || status.indexOf("已回答") >= 0,
              direction: isReply ? "receive" : "send",
              _recovered: true,
            };
            if (isReply || status.indexOf("已回答") >= 0) s.replied = true;
            surveys.push(s);
            try {
              window.__akiniAllSurveys = window.__akiniAllSurveys || {};
              window.__akiniAllSurveys[sid] = s;
            } catch (x) {}
            changed = true;
          });
          if (changed) {
            saveSurveys();
            window.surveys = surveys;
            /* 恢复成功后同步缓存计数，避免下次因数量变化重复全量解析 */
            __surveyRecoverCache[ct.id] = { len: htmlLen, count: surveys.length };
          }
        });
      } catch (e) {
        console.error("[survey] recoverSurveysFromChat error", e);
      }
    }
    function saveSurveys() {
      try {
        var json = JSON.stringify(surveys);
        var key = getSurveyKey();
        lsSetRaw(key, json);
        window.surveys = surveys;
        try {
          window.__akiniAllSurveys = window.__akiniAllSurveys || {};
          surveys.forEach(function (s) {
            if (s && s.id) window.__akiniAllSurveys[s.id] = s;
          });
        } catch (x) {}
      } catch (e) {}
    }
    function escapeHtml(s) {
      return (s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    // ===== Render survey list =====
    window.__surveyChatTab = "mine";
    function switchSurveyChatTab(tab) {
      window.__surveyChatTab = tab;
      var btnMine = document.getElementById("surveyTabMine");
      var btnTa = document.getElementById("surveyTabTa");
      if (btnMine) {
        var onM = tab === "mine";
        btnMine.style.borderBottom = onM ? "2.5px solid #1a1a1a" : "2.5px solid transparent";
        btnMine.style.color = onM ? "#1a1a1a" : "#888";
        btnMine.style.fontWeight = onM ? "600" : "400";
      }
      if (btnTa) {
        var onT = tab === "ta";
        btnTa.style.borderBottom = onT ? "2.5px solid #1a1a1a" : "2.5px solid transparent";
        btnTa.style.color = onT ? "#1a1a1a" : "#888";
        btnTa.style.fontWeight = onT ? "600" : "400";
      }
      var fab = document.getElementById("surveyAddFab");
      if (fab) fab.style.display = tab === "mine" ? "flex" : "none";
      renderSurveyList();
    }
    window.__switchSurveyChatTab = switchSurveyChatTab;

    function bindSurveyChatTabs() {
      var btnMine = document.getElementById("surveyTabMine");
      var btnTa = document.getElementById("surveyTabTa");
      if (btnMine && !btnMine.__boundChatTab) {
        btnMine.__boundChatTab = true;
        var hM = function (e) {
          if (e) {
            e.preventDefault();
          }
          switchSurveyChatTab("mine");
        };
        btnMine.onclick = hM;
      }
      if (btnTa && !btnTa.__boundChatTab) {
        btnTa.__boundChatTab = true;
        var hT = function (e) {
          if (e) {
            e.preventDefault();
          }
          switchSurveyChatTab("ta");
        };
        btnTa.onclick = hT;
      }
    }

    function getCurrentSurveyChatId() {
      var id =
        window.akiniContacts && window.akiniContacts.getActiveChatId ? window.akiniContacts.getActiveChatId() : "";
      if (!id) {
        try {
          id = localStorage.getItem("akini_active_chat_id") || "";
        } catch (e) {}
      }
      return id || "";
    }

    function renderSurveyList() {
      /* 列表渲染只有 runtime.js 一套实现（含直接展示回答结果），这里只做转发 */
      if (window.renderSurveyList) window.renderSurveyList();
    }

    // ===== 我创建的问卷列表（从右上角菜单进入）=====
    function openSurveyCreatedList() {
      var modal = document.getElementById("surveyCreatedListModal");
      if (!modal) return;
      modal.style.display = "flex";
      modal.style.zIndex = "8600";
      renderSurveyCreatedList();
    }
    function closeSurveyCreatedList() {
      var modal = document.getElementById("surveyCreatedListModal");
      if (modal) modal.style.display = "none";
    }
    function renderSurveyCreatedList() {
      var container = document.getElementById("surveyCreatedListContainer");
      if (!container) return;
      var chatId = getCurrentSurveyChatId();
      if (!chatId) {
        container.innerHTML =
          '<div style="text-align:center;color:#999;padding:60px 20px;font-size:14px">请进入聊天后查看问卷</div>';
        return;
      }
      loadSurveys(chatId);
      var created = surveys.filter(function (s) {
        return !s.deleted && s.direction !== "receive";
      });
      if (created.length === 0) {
        container.innerHTML =
          '<div style="text-align:center;color:#999;padding:60px 20px;font-size:14px">暂无创建的问卷<br>点击右上角新建问卷</div>';
        return;
      }
      var html = "";
      created.forEach(function (s, idx) {
        var realIdx = surveys.indexOf(s);
        var qCount = (s.questions && s.questions.length) || 0;
        var timeStr = s.createdAt
          ? new Date(s.createdAt).toLocaleString("zh-CN", {
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";
        var title = (s.title || "").trim() || "问卷 " + (idx + 1);
        var replyCount = (s.replies && s.replies.length) || 0;
        var qPreview = (s.questions || [])
          .map(function (q, i) {
            return escapeHtml(i + 1 + ". " + (q.text || "未命名问题"));
          })
          .join("<br>");
        html +=
          '<div class="survey-created-item" data-idx="' +
          realIdx +
          '" style="background:#fff;border-radius:12px;padding:14px;margin-bottom:12px;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.04);border:1px solid #f0f0f0">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">' +
          '<div style="font-size:16px;font-weight:600;color:#111">' +
          escapeHtml(title) +
          "</div>" +
          '<div style="display:flex;gap:6px;align-items:center">' +
          '<button type="button" class="survey-fast-send-btn" data-idx="' +
          realIdx +
          '" style="padding:4px 12px;background:#4f7cff;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:500;cursor:pointer">发送</button>' +
          '<button type="button" class="survey-created-del-btn" data-idx="' +
          realIdx +
          '" style="padding:4px 10px;background:#fff;color:#ff3b30;border:1px solid #ff3b30;border-radius:6px;font-size:13px;font-weight:500;cursor:pointer">删除</button>' +
          "</div>" +
          "</div>" +
          '<div style="font-size:13px;color:#555;line-height:1.6">' +
          qPreview +
          "</div>" +
          "</div>";
      });
      container.innerHTML = html;
      container.querySelectorAll(".survey-created-item").forEach(function (item) {
        item.addEventListener("click", function (e) {
          if (e.target.closest(".survey-fast-send-btn")) return;
          var idx = parseInt(item.getAttribute("data-idx"));
          closeSurveyCreatedList();
          openSurveyEdit(idx);
        });
      });
      container.querySelectorAll(".survey-fast-send-btn").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          var idx = parseInt(btn.getAttribute("data-idx"));
          sendExistingSurvey(idx);
        });
      });
      container.querySelectorAll(".survey-created-del-btn").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          var idx = parseInt(btn.getAttribute("data-idx"));
          deleteSurvey(idx);
          renderSurveyCreatedList();
        });
      });
    }

    function showSurveyDetail(idx, memberId, fromChat) {
      try {
        var s = surveys[idx];
        if (!s) return;
        var modal = document.getElementById("surveyDetailModal");
        var titleEl = document.getElementById("surveyDetailTitle");
        var bodyEl = document.getElementById("surveyDetailBody");
        if (!modal || !titleEl || !bodyEl) return;
        // 记录返回目标：问卷列表当前打开则返回列表，否则返回聊天上下文
        var listModal = document.getElementById("surveyListModal");
        window._surveyDetailReturn = listModal && listModal.style.display === "flex" ? "list" : "chat";
        titleEl.textContent = (s.title || "").trim() || "问卷详情";
        var html = "";
        var isGroup = false; /* 单人对单聊，无群成员 */
        var replyToShow = null;
        if (memberId && s.replies && Array.isArray(s.replies)) {
          replyToShow = s.replies.find(function (r) {
            return r && r.memberId === memberId;
          });
        }
        if (!replyToShow && s.replies && s.replies.length === 1 && !isGroup) {
          replyToShow = s.replies[0];
        }
        (s.questions || []).forEach(function (q, qIdx) {
          if (!q) return;
          var opts = (q.options || []).filter(function (o) {
            return (o || "").trim();
          });
          if (q.type === "yesno") opts = ["是", "否"];
          var ans = replyToShow && replyToShow.answers ? replyToShow.answers[qIdx] : undefined;
          var _multiQ = q.type === "multi" || Array.isArray(ans);
          html += '<div style="margin-bottom:16px;background:#f9f9f9;border-radius:10px;padding:12px">';
          html +=
            '<div style="font-size:15px;font-weight:600;color:#111;margin-bottom:10px">' +
            (qIdx + 1) +
            ". " +
            escapeHtml(q.text || "未命名问题") +
            "</div>";
          if (opts.length >= 2) {
            html += '<div style="display:flex;flex-direction:column;gap:8px">';
            var singlePickedIndex = -1;
            if (!_multiQ && ans !== undefined && ans !== null && ans !== "") {
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
            opts.forEach(function (opt, oIdx) {
              if (_multiQ) {
                var picked = Array.isArray(ans) && ans.indexOf(opt) >= 0;
                var boxStyle = picked
                  ? "width:18px;height:18px;border-radius:50%;background:#000000;border:none;flex-shrink:0"
                  : "width:18px;height:18px;border-radius:50%;border:1.8px solid #000000;background:#ffffff;box-sizing:border-box;flex-shrink:0";
                var boxTextStyle = picked
                  ? "font-size:15px;color:#000000;font-weight:600"
                  : "font-size:15px;color:#111111;font-weight:400";
                var mLabel = String.fromCharCode(65 + oIdx);
                html +=
                  '<div style="display:flex;align-items:center;gap:12px;min-height:36px">' +
                  '<div style="' +
                  boxStyle +
                  '"></div>' +
                  '<span style="' +
                  boxTextStyle +
                  '"><b style="margin-right:6px">' +
                  mLabel +
                  ".</b>" +
                  escapeHtml(opt) +
                  "</span>" +
                  "</div>";
                return;
              }
              var selected = oIdx === singlePickedIndex;
              var circleStyle = selected
                ? "width:18px;height:18px;border-radius:50%;background:#000000;border:none;flex-shrink:0"
                : "width:18px;height:18px;border-radius:50%;border:1.8px solid #000000;background:#ffffff;box-sizing:border-box;flex-shrink:0";
              var textStyle = selected
                ? "font-size:15px;color:#000000;font-weight:600"
                : "font-size:15px;color:#111111;font-weight:400";
              var label = String.fromCharCode(65 + oIdx);
              html +=
                '<div style="display:flex;align-items:center;gap:12px;min-height:36px">' +
                '<div style="' +
                circleStyle +
                '"></div>' +
                '<span style="' +
                textStyle +
                '"><b style="margin-right:6px">' +
                label +
                ".</b>" +
                escapeHtml(opt) +
                "</span>" +
                "</div>";
            });
            html += "</div>";
          } else {
            html +=
              '<div style="font-size:14px;color:#333">' +
              escapeHtml(Array.isArray(ans) ? ans.join("、") : ans || "未回答") +
              "</div>";
          }
          html += "</div>";
        });
        if (replyToShow && replyToShow.note && String(replyToShow.note).trim()) {
          html +=
            '<div style="margin-top:12px;padding:12px;background:#fff;border-radius:10px;border:1px solid #e8e8e8">';
          html += '<div style="font-size:13px;color:#666;margin-bottom:6px">备注</div>';
          html += '<div style="font-size:14px;color:#333">' + escapeHtml(replyToShow.note) + "</div>";
          html += "</div>";
        }
        // 单人对单聊：无群成员「回答记录」列表，回答详情已直接展示在上方单条回复区
        // 收到的未回答问卷在详情页增加“回答”入口，防止用户误以为没有回答选项
        if (s.direction === "receive" && !s.replied) {
          html +=
            '<button type="button" id="surveyDetailReplyBtn" data-idx="' +
            idx +
            '" style="width:100%;margin-top:14px;padding:12px;border:none;border-radius:10px;background:#1a1a1a;color:#fff;font-size:15px;font-weight:600;cursor:pointer">回答</button>';
        }
        bodyEl.innerHTML = html;
        modal.style.display = "flex";
        modal.style.zIndex = "8600";
        var replyBtn = document.getElementById("surveyDetailReplyBtn");
        if (replyBtn) {
          replyBtn.addEventListener("click", function () {
            var i = parseInt(this.getAttribute("data-idx"), 10);
            openSurveyReply(i);
          });
        }
      } catch (eErr) {
        console.error("[survey] showSurveyDetail error:", eErr);
      }
    }

    // ===== 我回答联系人发来的问卷（可选答案 + 备注 + 完成发送卡片）=====

    function replySourceOf(s) {
      if (!s) return null;
      return {
        survey: s,
        questions: s.questions || [],
        title: (s.title || "").trim() || "问卷调查",
        fromLibrary: false,
      };
    }
    function openSurveyReply(idx) {
      try {
        var s = surveys[idx];
        if (!s || s.replied) return;
        var modal = document.getElementById("surveyDetailModal");
        var titleEl = document.getElementById("surveyDetailTitle");
        var bodyEl = document.getElementById("surveyDetailBody");
        if (!modal || !titleEl || !bodyEl) return;
        var srcInfo = replySourceOf(s);
        if (!srcInfo) {
          alert("请先在 字卡库-问卷 里添加问卷，再来回答 TA 的邀请");
          return;
        }
        var surveyMainTitle = srcInfo.title;
        titleEl.textContent = surveyMainTitle;
        var html = "";
        srcInfo.questions.forEach(function (q, qIdx) {
          if (!q) return;
          html += '<div style="margin-bottom:16px;background:#f9f9f9;border-radius:10px;padding:12px">';
          var curType = q.type || s.qType || "single";
          var typeDesc = "";
          if (curType === "multi") typeDesc = "（多选）";
          else if (curType === "yesno") typeDesc = "（判断）";
          else if (curType === "text") typeDesc = "（问答）";
          else typeDesc = "（单选）";

          html +=
            '<div style="font-size:15px;font-weight:600;color:#111;margin-bottom:8px">' +
            (qIdx + 1) +
            ". " +
            escapeHtml(q.text || "未命名问题") +
            ' <span style="font-size:12px;color:#888;font-weight:normal">' +
            typeDesc +
            "</span></div>";

          var opts = (q.options || []).filter(function (o) {
            return (o || "").trim();
          });
          if (curType === "yesno") opts = ["是", "否"];

          if (curType === "text" || opts.length === 0) {
            html +=
              '<input type="text" class="survey-reply-text" data-q="' +
              qIdx +
              '" placeholder="请输入你的回答" style="width:100%;height:38px;border:1px solid #e8e8e8;border-radius:8px;padding:0 10px;font-size:14px;outline:0;color:#333;box-sizing:border-box;background:#fff">';
          } else if (curType === "multi") {
            html += '<div style="display:flex;flex-direction:column;gap:8px">';
            opts.forEach(function (opt, oIdx) {
              var label = String.fromCharCode(65 + oIdx);
              html +=
                '<label class="survey-reply-option-item" data-q="' +
                qIdx +
                '" style="display:flex;align-items:center;gap:10px;min-height:44px;padding:8px 10px;background:#fff;border-radius:8px;border:1px solid #e8e8e8;cursor:pointer">';
              html +=
                '<input type="checkbox" name="survey-q-' +
                qIdx +
                '" class="survey-reply-checkbox" data-q="' +
                qIdx +
                '" data-opt="' +
                oIdx +
                '" value="' +
                escapeHtml(opt) +
                '" style="display:none">';
              html +=
                '<div class="survey-custom-radio-dot" style="width:18px;height:18px;border-radius:4px;border:1.8px solid #000000;background:#ffffff;box-sizing:border-box;flex-shrink:0"></div>';
              html +=
                '<span style="font-size:14px;color:#333"><b style="margin-right:6px">' +
                label +
                ".</b>" +
                escapeHtml(opt) +
                "</span>";
              html += "</label>";
            });
            html += "</div>";
          } else {
            // single 或者 yesno 单选
            html += '<div style="display:flex;flex-direction:column;gap:8px">';
            opts.forEach(function (opt, oIdx) {
              var label = String.fromCharCode(65 + oIdx);
              html +=
                '<label class="survey-reply-option-item" data-q="' +
                qIdx +
                '" style="display:flex;align-items:center;gap:10px;min-height:44px;padding:8px 10px;background:#fff;border-radius:8px;border:1px solid #e8e8e8;cursor:pointer">';
              html +=
                '<input type="radio" name="survey-q-' +
                qIdx +
                '" class="survey-reply-radio" data-q="' +
                qIdx +
                '" data-opt="' +
                oIdx +
                '" value="' +
                escapeHtml(opt) +
                '" style="display:none">';
              html +=
                '<div class="survey-custom-radio-dot" style="width:18px;height:18px;border-radius:50%;border:1.8px solid #000000;background:#ffffff;box-sizing:border-box;flex-shrink:0"></div>';
              html +=
                '<span style="font-size:14px;color:#333"><b style="margin-right:6px">' +
                label +
                ".</b>" +
                escapeHtml(opt) +
                "</span>";
              html += "</label>";
            });
            html += "</div>";
          }
          html += "</div>";
        });
        html += '<div style="margin-top:8px">';
        html += '<div style="font-size:13px;color:#666;margin-bottom:6px">备注</div>';
        html +=
          '<textarea id="surveyReplyNote" placeholder="可填写备注（选填）" style="width:100%;height:64px;border:1px solid #e8e8e8;border-radius:8px;padding:10px;font-size:14px;outline:0;color:#333;box-sizing:border-box;resize:none"></textarea>';
        html += "</div>";
        html +=
          '<button type="button" id="surveyReplyDoneBtn" style="width:100%;margin-top:14px;padding:12px;border:none;border-radius:10px;background:#1a1a1a;color:#fff;font-size:15px;font-weight:600;cursor:pointer">确定回答</button>';
        bodyEl.innerHTML = html;
        modal.style.display = "flex";
        modal.style.zIndex = "8600";
        bodyEl.querySelectorAll(".survey-reply-radio").forEach(function (rad) {
          rad.addEventListener("change", function () {
            var q = this.getAttribute("data-q");
            bodyEl.querySelectorAll(".survey-reply-option-item[data-q='" + q + "']").forEach(function (lbl) {
              var r = lbl.querySelector(".survey-reply-radio");
              var dot = lbl.querySelector(".survey-custom-radio-dot");
              if (r && dot) {
                if (r.checked) {
                  dot.style.background = "#000000";
                  dot.style.border = "none";
                } else {
                  dot.style.background = "#ffffff";
                  dot.style.border = "1.8px solid #000000";
                }
              }
            });
          });
        });
        bodyEl.querySelectorAll(".survey-reply-checkbox").forEach(function (chk) {
          chk.addEventListener("change", function () {
            var lbl = chk.closest(".survey-reply-option-item");
            var box = lbl ? lbl.querySelector(".survey-custom-radio-dot") : null;
            if (box) {
              if (chk.checked) {
                box.style.background = "#000000";
                box.style.border = "none";
              } else {
                box.style.background = "#ffffff";
                box.style.border = "1.8px solid #000000";
              }
            }
          });
        });
        var doneBtn = document.getElementById("surveyReplyDoneBtn");
        if (doneBtn)
          doneBtn.addEventListener("click", function () {
            submitSurveyReply(idx);
          });
      } catch (eOpen) {
        console.error("[survey] openSurveyReply error:", eOpen);
      }
    }

    // ===== Submit reply (manual) =====
    function submitSurveyReply(idx) {
      var s = surveys[idx];
      if (!s || s.replied) return;
      var srcInfo = replySourceOf(s);
      if (!srcInfo || !srcInfo.questions || !srcInfo.questions.length) {
        alert("请先在 字卡库-问卷 里选择一份问卷");
        return;
      }
      var activeId = window.akiniContacts.getActiveChatId();
      if (!activeId) activeId = s.targetId || "ta";
      var answers = [];
      var allAnswered = true;
      s.replySrcId = srcInfo.fromLibrary && srcInfo.survey ? srcInfo.survey.id : null;
      s.replySrcTitle = srcInfo.fromLibrary ? srcInfo.title : null;
      srcInfo.questions.forEach(function (q, qIdx) {
        var opts = (q.options || []).filter(function (o) {
          return (o || "").trim();
        });
        if (q.type === "yesno") opts = ["是", "否"];
        var val = "";
        if (q.type === "multi" && opts.length >= 2) {
          var picks = [];
          document.querySelectorAll('.survey-reply-checkbox[data-q="' + qIdx + '"]:checked').forEach(function (c) {
            var v = (c.value || "").trim();
            if (v) picks.push(v);
          });
          val = picks;
          if (picks.length < 1) {
            allAnswered = false;
          }
        } else if (opts.length >= 2) {
          var checked = document.querySelector('.survey-reply-radio[data-q="' + qIdx + '"]:checked');
          val = checked ? (checked.value || "").trim() : "";
          if (!val) {
            allAnswered = false;
          }
        } else {
          var inp = document.querySelector('.survey-reply-text[data-q="' + qIdx + '"]');
          val = inp ? (inp.value || "").trim() : "";
          if (!val) {
            allAnswered = false;
          }
        }
        answers[qIdx] = val;
      });
      if (!allAnswered) {
        alert("请回答所有问题");
        return;
      }
      var noteInput = document.getElementById("surveyReplyNote");
      var note = "";
      if (noteInput) note = (noteInput.value || "").trim();
      s.replies = s.replies || [];
      // 避免重复：若已有同 memberId 的回复则替换
      var existing = s.replies.findIndex(function (r) {
        return r.memberId === activeId;
      });
      var replyObj = { memberId: activeId, answers: answers, note: note, ts: Date.now() };
      if (existing >= 0) s.replies[existing] = replyObj;
      else s.replies.push(replyObj);
      if ((s.selectedMembers || []).length > 0) {
        var repliedSet = s.replies.map(function (r) {
          return r.memberId;
        });
        if (
          s.selectedMembers.every(function (m) {
            return repliedSet.indexOf(m) >= 0;
          })
        )
          s.replied = true;
      } else {
        s.replied = true;
      }
      saveSurveys();
      updateSurveyBubbleStatus(s.id, "已回答");
      insertSurveyBubble(s, true, "已回答", s.targetId);
      if (window._saveChat) window._saveChat();
      var modal = document.getElementById("surveyDetailModal");
      if (modal) modal.style.display = "none";
    }

    // ===== 点击问卷卡片打开详情/回答 =====
    // 在本脚本初始化时尚不存在，直接绑定会失败，改用委托确保点击始终生效。
    function initSurveyBubbleHandlers() {
      document.addEventListener(
        "click",
        function (e) {
          if (!e.target || !e.target.closest) return;
          var bubble = e.target.closest(".bubble.survey-bubble");
          if (!bubble) return;
          e.preventDefault && e.preventDefault();
          var sid = bubble.getAttribute("data-survey-id");
          if (!sid) return;
          var activeChatId =
            window.akiniContacts && window.akiniContacts.getActiveChatId ? window.akiniContacts.getActiveChatId() : "";
          if (activeChatId) window._akiniLastChatId = activeChatId;
          loadSurveys(activeChatId);
          var sIdx = surveys.findIndex(function (s) {
            return s.id === sid;
          });
          /* zzzq 20260918先查数据再恢复——绝大多数点击都能直接命中，
         避免每次点击问卷卡片都全量解析聊天记录（大记录时点击即卡崩） */
          if (sIdx < 0) {
            recoverSurveysFromChat(activeChatId);
            sIdx = surveys.findIndex(function (s) {
              return s.id === sid;
            });
          }
          if (sIdx >= 0) {
            var memberId = bubble.getAttribute("data-member-id") || activeChatId;
            var s = surveys[sIdx];
            try {
              if (window.__akiniFixSurveyOptions) window.__akiniFixSurveyOptions(s, activeChatId);
            } catch (eFix) {}
            var isReplied = !!s.replied || (s.replies && s.replies.length > 0);
            var bSt = bubble.querySelector(".survey-bubble-status");
            if (bSt && bSt.textContent.indexOf("已回答") >= 0) isReplied = true;
            if (s.direction === "receive" && !isReplied) {
              openSurveyReply(sIdx);
            } else {
              showSurveyDetail(sIdx, memberId, true);
            }
          } else {
            console.warn("[survey] 未找到问卷，可能已被删除", sid);
          }
        },
        true,
      );
    }

    // ===== Open/Close =====
    window._openSurveyList = function () {
      var modal = document.getElementById("surveyListModal");
      if (!modal) return;
      if (window.akiniContacts && window.akiniContacts.getActiveChatId) {
        var active = window.akiniContacts.getActiveChatId();
        if (active) window._akiniLastChatId = active;
      }
      modal.style.display = "flex";
      modal.style.zIndex = "6001";
      bindSurveyChatTabs();
      switchSurveyChatTab(window.__surveyChatTab || "mine");
    };
    initSurveyBubbleHandlers();
    // 将问卷弹窗移动到 body 根层级，避免被父级堆叠上下文遮挡
    ["surveyListModal", "surveyDetailModal", "surveyCreatedListModal"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.parentNode !== document.body) document.body.appendChild(el);
    });

    function closeSurveyList() {
      var modal = document.getElementById("surveyListModal");
      if (modal) modal.style.display = "none";
      // 问卷列表从聊天界面进入，关闭后返回聊天（避免直接回到首页）
      if (window.openChat) {
        var cid =
          window._akiniLastChatId ||
          (window.akiniContacts && window.akiniContacts.getActiveChatId ? window.akiniContacts.getActiveChatId() : "");
        if (cid) {
          try {
            window.openChat(cid, false);
          } catch (e) {
            console.error("[survey] closeSurveyList openChat error", e);
          }
        }
      }
    }
    /* 单人对单聊应用：不存在「群成员」概念，已整体移除群成员选择器 renderSurveyMemberSelect 与 selectedSurveyMembers */
    function applySurveyChatContext() {
      var activeId = getCurrentSurveyChatId();
      if (activeId) loadSurveys(activeId);
      var activeTarget = activeId ? window.akiniContacts.getChatTarget(activeId) : null;
      /* 单人对单聊：无群成员选择，成员选择条永远隐藏 */
      var memberSelect = document.getElementById("surveyMemberSelect");
      if (memberSelect) {
        memberSelect.style.display = "none";
        memberSelect.innerHTML = "";
      }
      window.akiniSurveyContext = activeTarget
        ? { targetId: activeId, chatType: activeTarget.type || "contact" }
        : null;
    }

    function openSurveyCreate(mode) {
      editingSurveyId = null;
      surveyTitle = "";
      var modal = document.getElementById("surveyCreateModal");
      if (!modal) return;
      questions = [{ text: "", options: ["", ""] }];
      surveyQType = "single";
      var titleInput = document.getElementById("surveyTitleInput");
      if (titleInput) titleInput.value = "";
      var label = document.getElementById("surveyCreateTitleLabel");
      var sendBtn = document.getElementById("surveyCreateSendBtn");

      if (mode === "contact") {
        if (!window.__surveyForContactConfig) {
          var curCid = window.__currentWbSurveyCid;
          if (!curCid && window.akiniContacts && window.akiniContacts.getContacts) {
            var _cs2 = window.akiniContacts.getContacts() || [];
            if (_cs2[0]) curCid = _cs2[0].id;
          }
          window.__surveyForContactConfig = curCid || "ta";
        }
      } else {
        window.__surveyForContactConfig = "";
      }
      var targetCid = window.__surveyForContactConfig;
      if (targetCid) {
        var ctName = "TA";
        try {
          var cs = window.akiniContacts && window.akiniContacts.getContacts ? window.akiniContacts.getContacts() : [];
          var c = cs.find(function (x) {
            return String(x.id) === String(targetCid);
          });
          if (c && c.name) ctName = c.name;
        } catch (e) {}
        if (label) label.textContent = "为「" + ctName + "」添加问卷";
        if (sendBtn) {
          sendBtn.textContent = "保存";
          sendBtn.style.display = "";
        }
      } else {
        if (label) label.textContent = "新建问卷";
        if (sendBtn) {
          sendBtn.textContent = "发送";
          sendBtn.style.display = "";
        }
      }
      var footer = document.getElementById("surveyEditFooter");
      if (footer) footer.style.display = "none";
      renderSurveyTypePills();
      renderQuestionForm();
      applySurveyChatContext();
      modal.style.display = "flex";
      modal.style.zIndex = "8600";
    }
    window.openSurveyCreate = openSurveyCreate;
    function openSurveyEdit(idx) {
      var chatId = getCurrentSurveyChatId();
      if (chatId) loadSurveys(chatId);
      var s = surveys[idx];
      if (!s) return;
      editingSurveyId = s.id;
      surveyTitle = s.title || "";
      surveyQType = s.qType || ((s.questions || [])[0] && s.questions[0].type) || "single";
      if (["single", "multi", "yesno"].indexOf(surveyQType) < 0) surveyQType = "single";
      questions = (s.questions || []).map(function (q) {
        var opts = Array.isArray(q.options) && q.options.length >= 2 ? q.options.slice(0, 10) : ["", ""];
        return { text: q.text || "", options: opts };
      });
      if (questions.length === 0) questions = [{ text: "", options: ["", ""] }];
      var modal = document.getElementById("surveyCreateModal");
      if (!modal) return;
      var titleInput = document.getElementById("surveyTitleInput");
      if (titleInput) titleInput.value = surveyTitle;
      var label = document.getElementById("surveyCreateTitleLabel");
      if (label) label.textContent = "编辑问卷";
      var sendBtn = document.getElementById("surveyCreateSendBtn");
      if (sendBtn) sendBtn.style.display = "none";
      var footer = document.getElementById("surveyEditFooter");
      if (footer) footer.style.display = "flex";
      renderSurveyTypePills();
      renderQuestionForm();
      applySurveyChatContext();
      modal.style.display = "flex";
      modal.style.zIndex = "8600";
    }
    function closeSurveyCreate() {
      window.__surveyForContactConfig = null;
      var modal = document.getElementById("surveyCreateModal");
      if (modal) modal.style.display = "none";
      var footer = document.getElementById("surveyEditFooter");
      if (footer) footer.style.display = "none";
    }

    // ===== Render question form =====
    function renderQuestionForm() {
      var container = document.getElementById("surveyQuestionsContainer");
      if (!container) return;
      if (questions.length === 0) {
        container.innerHTML =
          '<div style="text-align:center;color:#999;padding:20px;font-size:14px">点击"添加问题"开始创建问卷</div>';
        return;
      }
      container.innerHTML = "";
      var qTypeCur = surveyQType === "multi" || surveyQType === "yesno" ? surveyQType : "single";
      questions.forEach(function (q, qIdx) {
        var div = document.createElement("div");
        div.className = "survey-question-item";
        div.style.cssText =
          "background:#fff;border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:10px";
        var headHtml =
          '<div style="display:flex;align-items:center;gap:8px">' +
          '<span style="font-size:14px;color:#666;font-weight:600">问题 ' +
          (qIdx + 1) +
          "</span>" +
          '<input type="text" class="survey-q-text" data-q="' +
          qIdx +
          '" placeholder="请输入问题" value="' +
          escapeHtml(q.text) +
          '" style="flex:1;height:36px;border:1px solid #e8e8e8;border-radius:8px;padding:0 10px;font-size:14px;outline:0;color:#333;box-sizing:border-box">' +
          (questions.length > 1
            ? '<button type="button" class="survey-del-q" data-q="' +
              qIdx +
              '" style="background:0 0;border:none;font-size:20px;color:#ccc;cursor:pointer;padding:0 4px;width:28px">×</button>'
            : '<span style="width:28px"></span>') +
          "</div>";
        if (qTypeCur === "yesno") {
          div.innerHTML =
            headHtml +
            '<div style="display:flex;flex-direction:column;gap:6px;padding-left:32px">' +
            '<div style="display:flex;align-items:center;gap:8px">' +
            '<span style="font-size:13px;color:#999;font-weight:600;width:24px;text-align:center">A</span>' +
            '<div style="flex:1;height:36px;border:1px solid #f0f0f0;border-radius:8px;padding:0 10px;font-size:14px;color:#333;display:flex;align-items:center;background:#fafafa;box-sizing:border-box">是</div>' +
            '<span style="width:28px"></span>' +
            "</div>" +
            '<div style="display:flex;align-items:center;gap:8px">' +
            '<span style="font-size:13px;color:#999;font-weight:600;width:24px;text-align:center">B</span>' +
            '<div style="flex:1;height:36px;border:1px solid #f0f0f0;border-radius:8px;padding:0 10px;font-size:14px;color:#333;display:flex;align-items:center;background:#fafafa;box-sizing:border-box">否</div>' +
            '<span style="width:28px"></span>' +
            "</div>" +
            "</div>";
          container.appendChild(div);
          return;
        }
        var optsHtml = "";
        var opts = q.options && q.options.length >= 2 ? q.options : ["", ""];
        opts.forEach(function (opt, oIdx) {
          var label = String.fromCharCode(65 + oIdx); // A, B, C...
          optsHtml +=
            '<div style="display:flex;align-items:center;gap:8px">' +
            '<span style="font-size:13px;color:#999;font-weight:600;width:24px;text-align:center">' +
            label +
            "</span>" +
            '<input type="text" class="survey-q-opt" data-q="' +
            qIdx +
            '" data-opt="' +
            oIdx +
            '" placeholder="选项 ' +
            label +
            '" value="' +
            escapeHtml(opt) +
            '" style="flex:1;height:36px;border:1px solid #e8e8e8;border-radius:8px;padding:0 10px;font-size:14px;outline:0;color:#333;box-sizing:border-box">' +
            (opts.length > 2
              ? '<button type="button" class="survey-del-opt" data-q="' +
                qIdx +
                '" data-opt="' +
                oIdx +
                '" style="background:0 0;border:none;font-size:18px;color:#ccc;cursor:pointer;padding:0 4px;width:28px">×</button>'
              : '<span style="width:28px"></span>') +
            "</div>";
        });
        div.innerHTML =
          headHtml +
          '<div style="display:flex;flex-direction:column;gap:6px;padding-left:32px">' +
          optsHtml +
          "</div>" +
          '<div style="display:flex;gap:10px;padding-left:32px">' +
          '<button type="button" class="survey-add-opt" data-q="' +
          qIdx +
          '" style="background:transparent;border:none;color:#1a1a1a;font-size:13px;cursor:pointer;padding:6px 0;display:flex;align-items:center;gap:4px">+ 添加选项</button>' +
          "</div>";
        container.appendChild(div);
      });
      bindQuestionFormEvents();
    }

    function bindQuestionFormEvents() {
      var container = document.getElementById("surveyQuestionsContainer");
      if (!container) return;
      container.querySelectorAll(".survey-del-q").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var qIdx = parseInt(btn.getAttribute("data-q"));
          saveFormValues();
          questions.splice(qIdx, 1);
          renderQuestionForm();
        });
      });
      container.querySelectorAll(".survey-add-opt").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var qIdx = parseInt(btn.getAttribute("data-q"));
          saveFormValues();
          if (!questions[qIdx].options) questions[qIdx].options = [];
          if (questions[qIdx].options.length >= 10) {
            alert("每个问题最多10个选项");
            return;
          }
          questions[qIdx].options.push("");
          renderQuestionForm();
        });
      });
      container.querySelectorAll(".survey-del-opt").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var qIdx = parseInt(btn.getAttribute("data-q"));
          var oIdx = parseInt(btn.getAttribute("data-opt"));
          saveFormValues();
          if (questions[qIdx].options && questions[qIdx].options.length > 2) {
            questions[qIdx].options.splice(oIdx, 1);
          }
          renderQuestionForm();
        });
      });
    }

    function saveFormValues() {
      document.querySelectorAll(".survey-q-text").forEach(function (inp) {
        var qIdx = parseInt(inp.getAttribute("data-q"));
        if (questions[qIdx]) questions[qIdx].text = inp.value;
      });
      document.querySelectorAll(".survey-q-opt").forEach(function (inp) {
        var qIdx = parseInt(inp.getAttribute("data-q"));
        var oIdx = parseInt(inp.getAttribute("data-opt"));
        if (questions[qIdx] && questions[qIdx].options) {
          questions[qIdx].options[oIdx] = inp.value;
        }
      });
      var titleInput = document.getElementById("surveyTitleInput");
      if (titleInput) surveyTitle = titleInput.value;
    }

    // ===== 题型选择渲染（单选/多选/是与否）=====
    function renderSurveyTypePills() {
      var wrap = document.getElementById("surveyTypePills");
      if (wrap) {
        wrap.querySelectorAll(".survey-type-pill").forEach(function (btn) {
          var active = btn.getAttribute("data-type") === surveyQType;
          btn.style.borderColor = active ? "#1a1a1a" : "#e8e8e8";
          btn.style.color = active ? "#1a1a1a" : "#333";
          btn.style.background = active ? "rgba(26,26,26,0.07)" : "#fff";
          btn.style.fontWeight = active ? "600" : "400";
        });
      }
      var hint = document.getElementById("surveyTypeHint");
      if (hint) {
        if (surveyQType === "multi") {
          hint.style.display = "block";
          hint.textContent = "多选：对方回答时会从你填写的选项中随机选中多项";
        } else if (surveyQType === "yesno") {
          hint.style.display = "block";
          hint.textContent = "是与否：只需填写问题，选项固定为「是 / 否」";
        } else {
          hint.style.display = "none";
          hint.textContent = "";
        }
      }
    }

    // ===== Helper: Build survey card HTML =====
    // 问卷卡片线条图标（剪贴板轮廓 SVG，替代 emoji）
    var SURVEY_ICON_SVG =
      '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#1a1a1a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="4.2" width="15" height="16.6" rx="2.5"/><rect x="9" y="2.2" width="6" height="3.6" rx="1.3" fill="rgba(0,0,0,0.06)"/><path d="M9 11h6M9 15h4.2"/></svg>';
    window.__akiniSurveyIconSVG = SURVEY_ICON_SVG;
    function buildSurveyCardHtml(survey, isReply, statusText, targetName) {
      var isTaSurvey = survey.direction === "receive";
      var ctName = targetName || survey.senderName || survey.targetName || "对方";
      var title = "";
      /* 名字只做一次转义：下面 rt(title) 会统一转义，这里再 rt(ctName) 会导致
       联系人名字里的 > / < / & 变成 &amp;gt; 之类的乱码 */
      if (isTaSurvey) {
        title = isReply ? "我回答了问卷" : ctName + "邀请你回答问卷";
      } else {
        title = isReply ? ctName + "回答了问卷" : "邀请" + ctName + "回答问卷";
      }
      var qText = (survey.title || "").trim() || "问卷";
      var qs = (survey.questions || []).filter(function (q) {
        return (q.text || "").trim();
      });
      if (qs.length > 0) {
        qText = "问题：" + qs[0].text.trim();
        if (qs.length > 1) qText += "…";
      }
      var qCount = qs.length || 0;
      var html =
        '<div class="survey-bubble-inner">' +
        '<div class="survey-bubble-icon">' +
        SURVEY_ICON_SVG +
        "</div>" +
        '<div class="survey-bubble-content">' +
        '<div class="survey-bubble-title">' +
        rt(title) +
        "</div>" +
        '<div class="survey-bubble-q">' +
        rt(qText) +
        "</div>" +
        "</div>" +
        "</div>" +
        '<div class="survey-bubble-divider"></div>' +
        '<div class="survey-bubble-footer">' +
        '<span class="survey-bubble-count">' +
        (survey.cardNote ? rt(survey.cardNote) : qCount + "个问题") +
        "</span>" +
        '<span class="survey-bubble-status">' +
        rt(statusText) +
        "</span>" +
        "</div>";
      return html;
    }

    // ===== Helper: Insert survey bubble into chat =====
    window.__akiniOpenSurveyById = function (surveyId, memberId, fromChat) {
      if (!surveyId) return;
      var activeChatId =
        window.akiniContacts && window.akiniContacts.getActiveChatId ? window.akiniContacts.getActiveChatId() : "";
      if (activeChatId) window._akiniLastChatId = activeChatId;
      loadSurveys(activeChatId);
      var sIdx = surveys.findIndex(function (s) {
        return s.id === surveyId;
      });
      if (sIdx < 0) {
        // 1. 先查全局池
        if (window.__akiniAllSurveys && window.__akiniAllSurveys[surveyId]) {
          surveys.push(window.__akiniAllSurveys[surveyId]);
          saveSurveys();
          sIdx = surveys.length - 1;
        }
      }
      if (sIdx < 0) {
        /* zzzq 20260918未命中才恢复，避免每次都全量解析聊天记录 */
        recoverSurveysFromChat(activeChatId);
        sIdx = surveys.findIndex(function (s) {
          return s.id === surveyId;
        });
      }
      if (sIdx < 0) {
        console.warn("[survey] not found", surveyId);
        return;
      }
      var s = surveys[sIdx];
      try {
        if (window.__akiniFixSurveyOptions) window.__akiniFixSurveyOptions(s, activeChatId);
      } catch (e) {}
      // 检查卡片状态或全局回复状态同步
      var bDom = document.querySelector('.bubble.survey-bubble[data-survey-id="' + surveyId + '"]');
      var isAnsweredDom =
        bDom &&
        bDom.querySelector(".survey-bubble-status") &&
        bDom.querySelector(".survey-bubble-status").textContent.indexOf("已回答") >= 0;
      if (isAnsweredDom) s.replied = true;
      if (s.replies && s.replies.length > 0) s.replied = true;

      if (fromChat && !memberId) memberId = activeChatId;
      var isReplied = !!s.replied || (s.replies && s.replies.length > 0);
      var bDom = document.querySelector('.bubble.survey-bubble[data-survey-id="' + surveyId + '"]');
      if (
        bDom &&
        bDom.querySelector(".survey-bubble-status") &&
        bDom.querySelector(".survey-bubble-status").textContent.indexOf("已回答") >= 0
      )
        isReplied = true;
      if (s.direction === "receive" && !isReplied) {
        openSurveyReply(sIdx);
      } else {
        showSurveyDetail(sIdx, memberId, !!fromChat);
      }
    };

    (function () {
      try {
        if (localStorage.getItem("__akini__fix") === "1") return;
        Object.keys(localStorage).forEach(function (k) {
          if (k.indexOf("akini_surveys_") !== 0) return;
          var arr = null;
          try {
            arr = JSON.parse(localStorage.getItem(k)) || [];
          } catch (e) {
            return;
          }
          if (!arr.length) return;
          var changed = false;
          var sigMap = {};
          arr
            .slice()
            .sort(function (a, b) {
              return ((a && a.createdAt) || 0) - ((b && b.createdAt) || 0);
            })
            .forEach(function (s) {
              if (!s || typeof s !== "object") return;
              if (s.direction === "receive" && String(s.id).indexOf("srv_recv_") !== 0) {
                s.direction = "send";
                changed = true;
              }
              var qs = (s.questions || [])
                .map(function (q) {
                  return String((q && q.text) || "").trim();
                })
                .join("||");
              if (qs) {
                if (sigMap[qs]) {
                  if (!s.deleted) {
                    s.deleted = true;
                    changed = true;
                  }
                } else sigMap[qs] = true;
              }
            });
          if (changed) localStorage.setItem(k, JSON.stringify(arr));
        });
        localStorage.setItem("__akini__fix", "1");
      } catch (e) {}
    })();

    window.__akiniFixSurveyOptions = function (s, chatId) {
      try {
        if (!s || !s.questions) return s;
        var needFix = s.questions.some(function (q) {
          if (!q || q.type === "text" || q.type === "yesno") return false;
          return (
            (q.options || []).filter(function (o) {
              return (o || "").trim();
            }).length < 2
          );
        });
        if (!needFix) return s;
        var pool = [];
        try {
          var raw2 = localStorage.getItem("akini_surveys_" + (chatId || s.targetId || ""));
          if (raw2) pool = JSON.parse(raw2) || [];
        } catch (e) {}
        s.questions.forEach(function (q) {
          if (!q || q.type === "text" || q.type === "yesno") return;
          var qText = String(q.text || "").trim();
          if (!qText) return;
          if (
            (q.options || []).filter(function (o) {
              return (o || "").trim();
            }).length >= 2
          )
            return;
          pool.forEach(function (p) {
            if (!p || p.deleted) return;
            (p.questions || []).forEach(function (pq) {
              if (!pq) return;
              if (String(pq.text || "").trim() !== qText) return;
              if (
                (pq.options || []).filter(function (o) {
                  return (o || "").trim();
                }).length >= 2 &&
                (q.options || []).filter(function (o) {
                  return (o || "").trim();
                }).length < 2
              ) {
                q.options = pq.options.slice();
              }
            });
          });
        });
      } catch (e) {}
      return s;
    };

    function insertSurveyBubble(survey, isReply, statusText, targetId, memberId) {
      try {
        var chatId =
          targetId ||
          (window.akiniContacts && window.akiniContacts.getActiveChatId
            ? window.akiniContacts.getActiveChatId()
            : "ta");
        var chatBody = document.getElementById("chatBody");
        var U = window.__akiniChatBody || chatBody;
        if (!U) return;
        var target =
          window.akiniContacts && window.akiniContacts.getChatTarget
            ? window.akiniContacts.getChatTarget(chatId)
            : null;
        var member =
          memberId && window.akiniContacts && window.akiniContacts.getChatTarget
            ? window.akiniContacts.getChatTarget(memberId)
            : target;

        var isTaSurvey = survey.direction === "receive";
        // 问卷视角严格校准：
        // 1. 联系人主动发我 (receive):
        //    - !isReply (初始卡片): TA 发来邀请 -> 左侧 other, TA 头像, 待回答, 点击去回答
        //    - isReply (我确认回答): 我发出的回答 -> 右侧 me, 我的头像, 已回答, 点击查看我的答案
        // 2. 我主动发联系人 (!receive):
        //    - !isReply (初始卡片): 我发出的邀请 -> 右侧 me, 我的头像, 待回答
        //    - isReply (TA确认回答): TA发出的回答 -> 左侧 other, TA 头像, 已回答, 点击查看TA的答案
        var isMe = false;
        if (isTaSurvey) {
          isMe = !!isReply;
        } else {
          isMe = !isReply;
        }

        var row = document.createElement("div");
        row.className = "msg-row " + (isMe ? "me" : "other");
        row.setAttribute("data-meta-v", "10");
        row.setAttribute("data-ts", String(window.__akiniNextTs ? window.__akiniNextTs() : Date.now()));

        var avatar = isMe
          ? window.getMyAvatar
            ? window.getMyAvatar()
            : ""
          : window.getTaAvatar
            ? window.getTaAvatar(memberId || chatId)
            : window.__akAvatarPH || "";
        /* 时间戳必须跟随设置里的「时间格式」，不能写死 hh:mm:ss */
        var timeStr = "";
        try {
          timeStr = String(
            window.__akiniFmtTs ? window.__akiniFmtTs(parseInt(row.getAttribute("data-ts"), 10) || Date.now()) : "",
          );
        } catch (eTs) {}
        if (!timeStr) {
          var now = new Date();
          timeStr = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
        }
        var tsHtml = '<div class="msg-ts">' + timeStr + "</div>";
        var avatarCol =
          '<div class="avatar-col" style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;width:38px;"><div class="msg-avatar">' +
          avatar +
          "</div>" +
          tsHtml +
          "</div>";

        var cardStatus = statusText || (isReply ? "已回答" : "待回答");
        var bubbleHtml =
          '<div class="bubble-wrap" style="flex-shrink:0;width:auto;min-width:180px;max-width:220px;margin:0;"><div class="bubble survey-bubble" style="width:auto;min-width:180px;max-width:220px;box-sizing:border-box;margin:0;background:#ffffff !important;background-color:#ffffff !important;color:#1a1a1a !important;border:1px solid #e8e8e8 !important;" data-survey-id="' +
          survey.id +
          '" data-survey-reply="' +
          (isReply ? "1" : "0") +
          '"' +
          (isReply && memberId ? ' data-member-id="' + memberId + '"' : "") +
          '">' +
          buildSurveyCardHtml(survey, isReply, cardStatus, target ? target.name : "") +
          "</div></div>";

        var lineJustify = isMe ? "flex-end" : "flex-start";
        var contentLine = document.createElement("div");
        contentLine.className = "msg-content-line";
        contentLine.style.cssText =
          "display:flex;align-items:flex-start;width:100%;justify-content:" + lineJustify + ";gap:8px;";
        if (isMe) {
          contentLine.innerHTML = bubbleHtml + avatarCol;
        } else {
          contentLine.innerHTML = avatarCol + bubbleHtml;
        }
        row.appendChild(contentLine);
        U.appendChild(row);
        U.scrollTop = U.scrollHeight;
        /* 落盘：以前只 appendChild 到 DOM，没写回 session.messagesHTML / akini_chat_history_<id>，
         于是切个会话或重渲染，问卷卡片就整张消失（和商店系统消息同一个毛病）。 */
        try {
          if (window.akiniContacts && window.akiniContacts.updateSession) {
            var _sess = window.akiniContacts.getSession ? window.akiniContacts.getSession(chatId) || {} : {};
            var _prev = typeof _sess.messagesHTML === "string" ? _sess.messagesHTML : "";
            var _label = (isReply ? "【问卷回答】" : "【问卷】") + (survey.title || "");
            window.akiniContacts.updateSession(chatId, {
              messagesHTML: _prev + row.outerHTML,
              lastMsg: _label,
              lastTime: Date.now(),
              lastSenderName: isMe ? localStorage.getItem("akini_my_name") || "我" : target ? target.name : "对方",
              lastSenderAvatar: isMe
                ? window.getMyAvatar
                  ? window.getMyAvatar()
                  : ""
                : target
                  ? target.avatar || ""
                  : "",
            });
          }
        } catch (eSess) {}
        /* 数组模型：上面 updateSession 的 messagesHTML setter 已经追加到 chat-log，
           这里不再读原始存储拼字符串（JSON 里直接拼 HTML 会把记录写坏）。 */
        try {
          if (window.__akiniChatLog) window.__akiniChatLog.flush();
        } catch (eH) {}
        return row;
      } catch (err) {
        console.error("[insertSurveyBubble] error:", err);
        return null;
      }
    }

    // ===== Update survey card status in chat =====
    function updateSurveyBubbleStatus(surveyId, statusText) {
      try {
        var chatBody = document.getElementById("chatBody");
        if (!chatBody) return;
        var bubbles = chatBody.querySelectorAll('.bubble.survey-bubble[data-survey-id="' + rt(surveyId) + '"]');
        bubbles.forEach(function (b) {
          var st = b.querySelector(".survey-bubble-status");
          if (st) st.textContent = statusText;
        });
        try {
          var survey =
            typeof surveys !== "undefined"
              ? surveys.find(function (x) {
                  return x.id === surveyId;
                })
              : null;
          var chatId2 =
            (survey && survey.targetId) ||
            (window.akiniContacts && window.akiniContacts.getActiveChatId
              ? window.akiniContacts.getActiveChatId()
              : "ta");
          /* 限定 1500 字符内匹配，避免在大聊天记录上跨卡片回溯 */
          var rx = new RegExp('(data-survey-id="' + surveyId + '"[\\s\\S]{0,1500}?survey-bubble-status">)[^<]*');
          /* 数组模型：逐行替换状态文案，不再读写原始 localStorage 字符串 */
          if (window.__akiniChatLog)
            window.__akiniChatLog.mapRows(chatId2, function (h) {
              return h.indexOf('data-survey-id="' + surveyId + '"') >= 0 ? h.replace(rx, "$1" + statusText) : h;
            });
        } catch (e) {}
      } catch (e) {
        console.error("[survey] updateSurveyBubbleStatus error", e);
      }
    }

    // ===== 校验并构建问卷对象 =====
    function validateAndBuildSurvey(targetId, chatType, selectedMembers) {
      saveFormValues();
      if (questions.length === 0) {
        alert("请至少添加一个问题");
        return null;
      }
      var qType = surveyQType === "multi" || surveyQType === "yesno" ? surveyQType : "single";
      for (var i = 0; i < questions.length; i++) {
        var q = questions[i];
        if (!(q.text || "").trim()) {
          alert("请填写问题 " + (i + 1) + " 的内容");
          return null;
        }
        if (qType === "yesno") {
          q.options = ["是", "否"];
        } else {
          var opts = (q.options || [])
            .map(function (o) {
              return (o || "").trim();
            })
            .filter(Boolean);
          if (opts.length < 2) {
            alert("问题 " + (i + 1) + " 至少需要 2 个有效选项");
            return null;
          }
          q.options = opts;
        }
        q.type = qType;
      }
      var myName = localStorage.getItem("akini_my_name") || "我";
      return {
        id: "survey_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
        title: (surveyTitle || "").trim(),
        questions: questions.slice(),
        createdAt: Date.now(),
        qType: qType,
        senderName: myName,
        targetId: targetId,
        chatType: chatType,
        selectedMembers: selectedMembers,
        replies: [],
        replied: false,
        direction: "send",
      };
    }

    // ===== 发送问卷（新建）=====
    function sendSurvey() {
      /* 联系人专属问卷保存模式（只保存给联系人，不以我的视角发到聊天） */
      var targetCid = window.__surveyForContactConfig;
      if (targetCid) {
        var ctName = "TA";
        try {
          var cs = window.akiniContacts && window.akiniContacts.getContacts ? window.akiniContacts.getContacts() : [];
          var c = cs.find(function (x) {
            return String(x.id) === String(targetCid);
          });
          if (c && c.name) ctName = c.name;
        } catch (e) {}
        var sObj = validateAndBuildSurvey(targetCid, "contact", [targetCid]);
        if (!sObj) return;
        sObj.direction = "send"; // 我创建的专属问卷归「我的提问」
        sObj.senderName = ctName;
        sObj.targetId = targetCid;
        sObj.replied = false;
        sObj.replies = [];
        sObj.createdAt = Date.now();

        var list = [];
        try {
          var raw = localStorage.getItem("akini_surveys_" + targetCid);
          if (raw) list = JSON.parse(raw) || [];
        } catch (e) {}
        list.unshift(sObj);
        try {
          lsSetRaw("akini_surveys_" + targetCid, JSON.stringify(list));
        } catch (e) {}
        window.__akiniAllSurveys = window.__akiniAllSurveys || {};
        window.__akiniAllSurveys[sObj.id] = sObj;

        window.__surveyForContactConfig = null;
        closeSurveyCreate();
        /* 联系人专属问卷走的是 lsSetRaw 而非 _srvWrite，不会推进 _srvRev，
         必须主动 bump 一次，否则 renderSurveyWbTab 的内容签名缓存会命中并直接 return，
         导致刚保存的问卷不显示（需刷新才看得到） */
        window.__srvBumpRev();
        window.renderSurveyWbTab();
        alert("已为「" + ctName + "」保存专属问卷！TA 后续将有机会主动向你发起。");
        return;
      }

      var targetId = getCurrentSurveyChatId();
      if (!targetId) {
        alert("请先进入一个聊天再发送问卷");
        return;
      }
      loadSurveys(targetId);
      var target =
        window.akiniContacts && window.akiniContacts.getChatTarget
          ? window.akiniContacts.getChatTarget(targetId)
          : null;
      var chatType = (target && target.type) || "contact";
      var selectedMembers = [targetId]; /* 单人对单聊：问卷固定发给当前联系人 */
      var survey = validateAndBuildSurvey(targetId, chatType, selectedMembers);
      if (!survey) return;
      survey.sentToChat = true;
      if (editingSurveyId) {
        var existIdx = surveys.findIndex(function (s) {
          return s.id === editingSurveyId;
        });
        if (existIdx >= 0) {
          survey.id = editingSurveyId;
          survey.replies = surveys[existIdx].replies || [];
          survey.replied = surveys[existIdx].replied || false;
          surveys[existIdx] = survey;
        } else {
          surveys.push(survey);
        }
      } else {
        surveys.push(survey);
      }
      editingSurveyId = null;
      /* 记录最晚回答时刻，页面刷新后由 catch-up 补投（防延迟投递丢失） */
      try {
        survey.replyAt = Date.now() + 20000;
      } catch (eRa) {}
      saveSurveys();
      if (window.openChat) window.openChat(targetId, false);
      setTimeout(function () {
        insertSurveyBubble(survey, false, "未回答", targetId);
        closeSurveyCreate();
        selectedMembers.forEach(function (mid, idx) {
          var replyDelay = Math.min(20000, 10000 + idx * 1500 + Math.random() * 4000);
          /* 在卡片发出前 4~8 秒提前展示「对方正在输入...」动态 */
          var typingLead = Math.min(replyDelay * 0.35, 6000);
          setTimeout(
            function () {
              try {
                if (window.showTypingBubble) window.showTypingBubble(targetId, mid);
              } catch (eTyp) {}
            },
            Math.max(1000, replyDelay - typingLead),
          );
          setTimeout(function () {
            simulateReply(survey.id, targetId, mid);
          }, replyDelay);
        });
      }, 300);
    }

    // ===== 发送已创建的问卷（从列表）=====
    function sendExistingSurvey(idx) {
      var s = surveys[idx];
      if (!s) return;
      var targetId = getCurrentSurveyChatId();
      if (!targetId) {
        alert("请先进入一个聊天再发送问卷");
        return;
      }
      loadSurveys(targetId);
      var target =
        window.akiniContacts && window.akiniContacts.getChatTarget
          ? window.akiniContacts.getChatTarget(targetId)
          : null;
      var chatType = (target && target.type) || s.chatType || "contact";
      var selectedMembers = [targetId]; /* 单人对单聊 */
      var copy = {
        id: "survey_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
        title: s.title || "",
        qType: s.qType || ((s.questions || [])[0] && s.questions[0].type) || "single",
        questions: (s.questions || []).map(function (q) {
          return {
            text: q.text || "",
            type: q.type || s.qType || "single",
            options: Array.isArray(q.options) && q.options.length >= 2 ? q.options.slice(0, 10) : ["", ""],
          };
        }),
        createdAt: Date.now(),
        senderName: s.senderName || "我",
        targetId: targetId,
        chatType: chatType,
        selectedMembers: selectedMembers,
        replies: [],
        replied: false,
        direction: "send",
      };
      copy.sentToChat = true;
      surveys.push(copy);
      saveSurveys();
      closeSurveyList();
      closeSurveyCreatedList();
      if (window.openChat) window.openChat(targetId, false);
      setTimeout(function () {
        try {
          copy.replyAt = Date.now() + 20000;
        } catch (eRa2) {}
        insertSurveyBubble(copy, false, "未回答", targetId);
        selectedMembers.forEach(function (mid, i) {
          var replyDelay = Math.min(20000, 10000 + i * 1500 + Math.random() * 4000);
          /* 在卡片发出前 4~8 秒提前展示「对方正在输入...」动态 */
          var typingLead = Math.min(replyDelay * 0.35, 6000);
          setTimeout(
            function () {
              try {
                if (window.showTypingBubble) window.showTypingBubble(targetId, mid);
              } catch (eTyp) {}
            },
            Math.max(1000, replyDelay - typingLead),
          );
          setTimeout(function () {
            simulateReply(copy.id, targetId, mid);
          }, replyDelay);
        });
      }, 300);
    }

    // ===== 删除问卷：标记删除，保留聊天中的卡片和回答记录 =====
    function deleteSurvey(idx) {
      var s = surveys[idx];
      if (!s) return;
      var title = (s.title || "").trim() || "问卷 " + (idx + 1);
      if (!confirm("确定删除「" + title + "」吗？")) return;
      s.deleted = true;
      saveSurveys();
      renderSurveyList();
      renderSurveyCreatedList();
    }

    // ===== 编辑模式：保存当前问卷 =====
    function saveSurveyEdit() {
      if (!editingSurveyId) return;
      saveFormValues();
      if (questions.length === 0) {
        alert("请至少添加一个问题");
        return;
      }
      for (var i = 0; i < questions.length; i++) {
        var q = questions[i];
        if (!(q.text || "").trim()) {
          alert("请填写问题 " + (i + 1) + " 的内容");
          return;
        }
      }
      var existIdx = surveys.findIndex(function (s) {
        return s.id === editingSurveyId;
      });
      var _seQType = surveyQType === "multi" || surveyQType === "yesno" ? surveyQType : "single";
      if (existIdx >= 0) {
        surveys[existIdx].title = (surveyTitle || "").trim();
        surveys[existIdx].qType = _seQType;
        surveys[existIdx].questions = questions.slice().map(function (q) {
          var o = { text: q.text || "", options: Array.isArray(q.options) ? q.options : ["", ""] };
          if (_seQType === "yesno") o.options = ["是", "否"];
          o.type = _seQType;
          return o;
        });
        saveSurveys();
        alert("问卷已保存");
        closeSurveyCreate();
        renderSurveyList();
        renderSurveyCreatedList();
      }
      editingSurveyId = null;
    }

    function sendSurveyEdit() {
      if (!editingSurveyId) return;
      var existIdx = surveys.findIndex(function (s) {
        return s.id === editingSurveyId;
      });
      if (existIdx < 0) return;
      sendExistingSurvey(existIdx);
    }

    function deleteSurveyEdit() {
      if (!editingSurveyId) return;
      var idx = surveys.findIndex(function (s) {
        return s.id === editingSurveyId;
      });
      if (idx < 0) return;
      deleteSurvey(idx);
      closeSurveyCreate();
      openSurveyCreatedList();
    }

    // ===== Simulate contact reply =====
    // ===== 问卷延迟回答 catch-up——刷新/重进后补投未到点的 TA 回答 =====
    window.__akiniCatchUpSurveyReplies = function () {
      try {
        var chatId =
          window.akiniContacts && window.akiniContacts.getActiveChatId
            ? window.akiniContacts.getActiveChatId()
            : window._akiniLastChatId || "";
        if (!chatId) return;
        loadSurveys(chatId);
        var now = Date.now();
        window.__akiniSrvSch = window.__akiniSrvSch || {};
        surveys.forEach(function (s) {
          if (!s || s.replied || !s.replyAt || s.replyAt < 1000) return;
          var mids = s.selectedMembers && s.selectedMembers.length ? s.selectedMembers : [chatId];
          mids.forEach(function (mid) {
            var done = (s.replies || []).some(function (r) {
              return r.memberId === mid;
            });
            if (done) return;
            var key = s.id + "::" + mid;
            if (window.__akiniSrvSch[key]) return;
            var diff = s.replyAt - now;
            if (diff <= 0) {
              simulateReply(s.id, chatId, mid);
            } else {
              window.__akiniSrvSch[key] = 1;
              setTimeout(function () {
                simulateReply(s.id, chatId, mid);
              }, diff);
            }
          });
        });
      } catch (eC) {}
    };
    try {
      setTimeout(function () {
        window.__akiniCatchUpSurveyReplies && window.__akiniCatchUpSurveyReplies();
      }, 1500);
    } catch (eCs) {}
    try {
      setInterval(function () {
        if (!document.hidden) window.__akiniCatchUpSurveyReplies && window.__akiniCatchUpSurveyReplies();
      }, 120000);
    } catch (eCt) {}

    function simulateReply(surveyId, targetId, memberId) {
      if (window.__akiniToggleOn && !window.__akiniToggleOn("contactReplyToggle", true)) return;
      try {
        var chatId =
          targetId ||
          (window.akiniContacts && window.akiniContacts.getActiveChatId ? window.akiniContacts.getActiveChatId() : "");
        if (chatId) loadSurveys(chatId);
        var survey = surveys.find(function (s) {
          return s.id === surveyId;
        });
        if (!survey) return;
        targetId =
          targetId ||
          survey.targetId ||
          (window.akiniContacts && window.akiniContacts.getActiveChatId
            ? window.akiniContacts.getActiveChatId()
            : "ta");
        memberId = memberId || targetId;
        survey.replies = survey.replies || [];
        if (
          survey.replies.find(function (r) {
            return r.memberId === memberId;
          })
        )
          return;
        var answers = (survey.questions || []).map(function (q) {
          var opts = (q.options || []).filter(function (o) {
            return (o || "").trim();
          });
          if (q.type === "yesno") opts = ["是", "否"];
          if (opts.length >= 2) {
            if (q.type === "multi") {
              var _pool = opts.slice();
              for (var _pi = _pool.length - 1; _pi > 0; _pi--) {
                var _pj = Math.floor(Math.random() * (_pi + 1));
                var _pt = _pool[_pi];
                _pool[_pi] = _pool[_pj];
                _pool[_pj] = _pt;
              }
              var _cnt = 2 + Math.floor(Math.random() * (_pool.length - 1));
              return _pool.slice(0, Math.min(_cnt, _pool.length));
            }
            return opts[Math.floor(Math.random() * opts.length)];
          }
          return (window.pickWordCards ? window.pickWordCards(1, memberId) : "") || "";
        });
        var note = "";
        if (window.pickWordCards) {
          try {
            var _cw = window.pickWordCards(1, memberId);
            if (_cw && typeof _cw === "string" && _cw.trim()) note = _cw.trim();
          } catch (e) {}
        }
        survey.replies.push({ memberId: memberId, answers: answers, note: note, ts: Date.now() });
        try {
          survey.replyAt = 0;
        } catch (eRb) {} /* 已回答清调度标记 */
        var allReplied = true;
        if ((survey.selectedMembers || []).length > 0) {
          var repliedSet = survey.replies.map(function (r) {
            return r.memberId;
          });
          allReplied = survey.selectedMembers.every(function (m) {
            return repliedSet.indexOf(m) >= 0;
          });
          if (allReplied) survey.replied = true;
        } else {
          survey.replied = true;
        }
        saveSurveys();
        if (allReplied) updateSurveyBubbleStatus(surveyId, "已回答");
        /* TA 回答问卷卡片发出前也先展示输入动态，再投递卡片，避免凭空跳出卡片 */
        try {
          if (window.hideTypingBubble) window.hideTypingBubble(targetId);
        } catch (eHTyp2) {}
        insertSurveyBubble(survey, true, "已回答", targetId, memberId);
        /* TA 回答问卷的卡片到达时走通知（前台弹窗+后台系统推送），与聊天消息一致 */
        try {
          {
            var _tgt2 = null;
            try {
              _tgt2 =
                window.akiniContacts && window.akiniContacts.getChatTarget
                  ? window.akiniContacts.getChatTarget(targetId)
                  : null;
            } catch (eTg2) {}
            window.showInAppNotif({
              app: "微信",
              appIcon: "📋",
              avatar: (_tgt2 && _tgt2.avatar) || "",
              name: (_tgt2 && _tgt2.name) || "对方",
              fullContent: !0,
              msg: "【问卷回应】TA 回答了你发起的问卷，快去查看吧",
              chatId: targetId,
              onTap: function () {
                try {
                  window.openChat && window.openChat(targetId);
                } catch (eOp) {}
              },
            });
          }
        } catch (eSvN) {}
        /* zzzq 20260918仅当对应弹窗可见时才重渲染——问卷列表/我创建的列表
         大多数时候在后台关闭状态，白白解析渲染只会加剧卡顿 */
        try {
          var slm = document.getElementById("surveyListModal");
          if (slm && slm.style.display === "flex") renderSurveyList();
          var scm = document.getElementById("surveyCreatedListModal");
          if (scm && scm.style.display === "flex") renderSurveyCreatedList();
        } catch (e) {}
      } catch (e) {
        console.error("[survey] simulateReply error", e);
      }
    }

    function bindEvents() {
      var backBtn = document.getElementById("surveyListBackBtn");
      if (backBtn) backBtn.addEventListener("click", closeSurveyList);
      /* surveyAddFab 已在 index.html 里通过 onclick 绑定 openSurveyCreate，这里不再重复绑定 */
      var cancelBtn = document.getElementById("surveyCreateCancelBtn");
      if (cancelBtn) cancelBtn.addEventListener("click", closeSurveyCreate);
      var sendBtn = document.getElementById("surveyCreateSendBtn");
      if (sendBtn) sendBtn.addEventListener("click", sendSurvey);
      window.__addSurveyQuestionHtml = function () {
        saveFormValues();
        if (questions.length >= 20) {
          alert("最多20个问题");
          return;
        }
        questions.push({ text: "", options: ["", ""] });
        renderQuestionForm();
      };
      var addQBtn = document.getElementById("surveyAddQuestionBtn");
      if (addQBtn)
        addQBtn.addEventListener("click", function () {
          window.__addSurveyQuestionHtml();
        });
      var pillsWrap = document.getElementById("surveyTypePills");
      if (pillsWrap) {
        pillsWrap.querySelectorAll(".survey-type-pill").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var t = btn.getAttribute("data-type");
            if (t !== "single" && t !== "multi" && t !== "yesno") t = "single";
            if (surveyQType !== t) {
              saveFormValues();
              surveyQType = t;
              renderSurveyTypePills();
              renderQuestionForm();
            }
          });
        });
      }
      var detailClose = document.getElementById("surveyDetailCloseBtn");
      if (detailClose)
        detailClose.addEventListener("click", function () {
          document.getElementById("surveyDetailModal").style.display = "none";
          // 详情页关闭时按打开来源返回：列表 -> 问卷列表；否则 -> 聊天上下文
          var ret = window._surveyDetailReturn;
          window._surveyDetailReturn = null;
          if (ret === "list") {
            if (window._openSurveyList) window._openSurveyList();
          }
          // 聊天来源：聊天界面一直在弹层后面且未被改动，直接关闭即可（不重开聊天、不滚动）
        });
      var createdBackBtn = document.getElementById("surveyCreatedListBackBtn");
      if (createdBackBtn) createdBackBtn.addEventListener("click", closeSurveyCreatedList);
      var editSaveBtn = document.getElementById("surveyEditSaveBtn");
      if (editSaveBtn) editSaveBtn.addEventListener("click", saveSurveyEdit);
      var editSendBtn = document.getElementById("surveyEditSendBtn");
      if (editSendBtn) editSendBtn.addEventListener("click", sendSurveyEdit);
      var editDeleteBtn = document.getElementById("surveyEditDeleteBtn");
      if (editDeleteBtn) editDeleteBtn.addEventListener("click", deleteSurveyEdit);
    }

    /* 导出核心函数供字卡库问卷引擎与自动化触发使用（闭包内函数不导出则外部全部失效） */
    window.loadSurveys = loadSurveys;
    window.saveSurveys = saveSurveys;
    window.openSurveyReply = openSurveyReply;
    window.showSurveyDetail = showSurveyDetail;
    window.openSurveyEdit = openSurveyEdit;
    window.insertSurveyBubble = insertSurveyBubble;
    window.simulateReply = simulateReply;

    // Initialize
    migrateOldSurveys();
    loadSurveys();
    if (document.readyState === "complete" || document.readyState === "interactive") {
      setTimeout(bindEvents, 0);
    } else {
      document.addEventListener("DOMContentLoaded", function () {
        setTimeout(bindEvents, 0);
      });
    }
  })();
});
