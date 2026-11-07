/* 加号菜单功能分发 */

(function () {
  function handlePlusMenuAction(action) {
    var pm = document.getElementById("plusMenu");
    if (pm) {
      pm.style.display = "none";
      pm.classList.remove("show");
    }

    if (action === "emoji") {
      if (typeof window.__akiniToggleEmojiPanel === "function") {
        window.__akiniToggleEmojiPanel();
      } else {
        var ep = document.getElementById("emojiPanel");
        if (ep) {
          if (ep.style.display === "flex" || ep.classList.contains("show")) {
            ep.style.display = "none";
            ep.classList.remove("show");
          } else {
            ep.style.display = "flex";
            ep.classList.add("show");
            window.__akiniRenderEmojiPanel();
          }
        }
      }
    } else if (action === "continue") {
      if (typeof window.__akiniForceReply === "function") {
        window.__akiniForceReply();
      } else {
        var cid = window.akiniContacts
          ? window.akiniContacts.getActiveChatId()
          : localStorage.getItem("akini_active_chat_id");
        window.__akiniScheduleReply(cid, null, 600);
      }
    } else if (action === "transfer") {
      var tb = document.getElementById("transferBtn");
      if (tb) tb.click();
      else window.__akiniOpenTransferModal();
    } else if (action === "poke") {
      if (typeof window.__akiniSendPoke === "function") {
        window.__akiniSendPoke();
      } else {
        var pkm = document.getElementById("pokeSendModal");
        if (pkm) {
          pkm.style.display = "flex";
          pkm.style.zIndex = "6002";
        }
      }
    } else if (action === "batch") {
      if (typeof window.__akiniOpenBatchSend === "function") {
        window.__akiniOpenBatchSend();
      } else {
        var bsm = document.getElementById("batchSendModal");
        if (bsm) {
          bsm.style.display = "flex";
          bsm.style.zIndex = "6002";
        }
      }
    } else if (action === "survey") {
      if (typeof window._openSurveyList === "function") {
        window._openSurveyList();
      } else if (typeof window.navTo === "function") {
        window.navTo("survey");
      } else {
        var sm = document.getElementById("surveyListModal");
        if (sm) {
          sm.style.display = "flex";
          sm.style.zIndex = "6001";
          window.renderSurveyList();
        }
      }
    } else if (action === "image" || action === "camera") {
      var fi = document.getElementById("fileInputImageSend");
      if (fi) fi.click();
    } else if (action === "record") {
      {
        window.__akiniOpenRecordPanel();
      }
    }
  }

  function bindPlusMenu() {
    var pm = document.getElementById("plusMenu");
    if (!pm || pm.__boundPlusMenu) return;
    pm.__boundPlusMenu = true;

    pm.addEventListener(
      "click",
      function (e) {
        var item = e.target.closest && e.target.closest(".plus-menu-item[data-action]");
        if (!item || !pm.contains(item)) return;
        // 捕获阶段先于 core 的冒泡处理器执行，阻止其重复触发
        e.stopImmediatePropagation();
        handlePlusMenuAction(item.getAttribute("data-action"));
      },
      true,
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindPlusMenu);
  } else {
    bindPlusMenu();
  }
  setTimeout(bindPlusMenu, 300);
  setTimeout(bindPlusMenu, 1000);
})();
