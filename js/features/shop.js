
/* ===== 商店完整功能 ===== */
(function () {
  var PK = "akini_shop_products",
    OK = "akini_shop_orders";
  var _cur = null,
    _act = null;

  function _shopLs(k) {
    try {
      /* 绕过 localStorage 实例级覆盖的内存缓存，直接读真实存储，避免读到启动时的旧快照 */
      var raw =
        window.akiniStore && window.akiniStore.rawLSGet
          ? window.akiniStore.rawLSGet(k)
          : localStorage.getItem(k);
      return JSON.parse(raw || "[]");
    } catch (e) {
      return [];
    }
  }
  function _shopLsAsync(k, cb) {
    /* 键存在（哪怕内容是空数组 []）都以 localStorage 为准；
       只有键完全不存在时才回退 IDB。否则删除最后一个商品后，
       IDB 里的旧备份会把商品「复活」。 */
    var raw = null;
    try {
      raw =
        window.akiniStore && window.akiniStore.rawLSGet
          ? window.akiniStore.rawLSGet(k)
          : localStorage.getItem(k);
    } catch (e) {}
    if (raw !== null && raw !== undefined) {
      cb(_shopLs(k));
      return;
    }
    try {
      if (window._idbStore && window._idbStore.get) {
        window._idbStore.get(k, function (v) {
          if (v) {
            try {
              var arr = JSON.parse(v);
              if (Array.isArray(arr) && arr.length) {
                try {
                  localStorage.setItem(k, v);
                } catch (e) {}
                cb(arr);
                return;
              }
            } catch (e) {}
          }
          cb([]);
        });
      } else cb([]);
    } catch (e) {
      cb([]);
    }
  }
  function _shopLsSet(k, v) {
    var json = JSON.stringify(v);
    var ok = true;
    try {
      /* 存储层已收敛为唯一一层包装（boot.js），直接调即可 */
      localStorage.setItem(k, json);
    } catch (e) {
      ok = false;
    }
    try {
      window.akiniStore && window.akiniStore.memorySet && window.akiniStore.memorySet(k, json);
    } catch (e) {}
    try {
      if (window._idbStore && window._idbStore.set) window._idbStore.set(k, json);
    } catch (e) {}
    return ok;
  }
  function rt(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  window.rt = rt;
  /* 头像渲染：把 data:/http 链接或 <img> 标签统一渲染为圆形头像；默认占位一律用线条人形图案 */
  function avatarHtml(avatar, fallback) {
    fallback = fallback || "";
    var _line = function () {
      return window.__akiniLineAvatarImg ? window.__akiniLineAvatarImg() : fallback;
    };
    var _isDef = function (x) {
      return !!(window.__akiniIsDefaultAvatarToken && window.__akiniIsDefaultAvatarToken(x));
    };
    var v = (avatar == null ? "" : String(avatar)).trim();
    if (!v) return _isDef(fallback) ? _line() : fallback;
    if (v.indexOf("<img") === 0) {
      var m = v.match(/src="([^"]*)"/);
      if (!m || !m[1]) return _isDef(fallback) ? _line() : fallback;
      v = m[1];
    }
    if (v.indexOf("data:") === 0 || v.indexOf("http") === 0) {
      return (
        '<img src="' +
        v.replace(/"/g, "&quot;") +
        '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
      );
    }
    if (_isDef(v)) return _line();
    return window.__akiniLineAvatarImg ? window.__akiniLineAvatarImg() : rt(v) || fallback;
  }
  window.avatarHtml = avatarHtml;

  /* 从字卡库随机选择备注（严格从字卡库抽取，无字卡直接返回空字符串，绝无兜底） */
  function randNote(contactId) {
    if (window.pickWordCards) {
      try {
        var note = window.pickWordCards(1, contactId);
        if (note && typeof note === "string" && note.trim()) return note.trim();
      } catch (e) {}
    }
    return "";
  }

  /* 返回 */
  var bb = document.getElementById("shopBackBtn");
  if (bb)
    bb.addEventListener("click", function () {
      var e = document.getElementById("app-shop");
      if (e) e.style.display = "none";
      if (window.navTo) navTo("home");
    });

  /* Tab切换 */
  window.__shopTab = function (tab) {
    var bp = document.getElementById("shopBuyPanel"),
      op = document.getElementById("shopOrdersPanel");
    var tb = document.getElementById("shopTabBuyBtn"),
      to = document.getElementById("shopTabOrdersBtn");
    var isBuy = tab === "buy";
    if (bp) bp.style.display = isBuy ? "block" : "none";
    if (op) op.style.display = isBuy ? "none" : "block";
    if (tb) tb.classList.toggle("is-active", isBuy);
    if (to) to.classList.toggle("is-active", !isBuy);
    if (!isBuy) renderOrders();
  };

  /* 渲染商品格子 */
  function renderGrid() {
    var g = document.getElementById("shopGrid");
    if (!g) return;
    _shopLsAsync(PK, function (P) {
      if (!P.length) {
        g.innerHTML = "";
        return;
      }
      g.innerHTML = P.map(function (p) {
        var icon = p.emoji || "🛒";
        var isImgIcon = /^https?:\/\//.test(icon) || /^data:image\//.test(icon);
        var iconHtml = isImgIcon ? '<img src="' + rt(icon) + '">' : rt(icon);
        return (
          '<div class=shop-card data-pid="' +
          p.id +
          '">' +
          "<div class=shop-card-icon>" +
          iconHtml +
          "</div>" +
          "<div class=shop-card-name>" +
          rt(p.name) +
          "</div>" +
          "<div class=shop-card-price>¥" +
          rt(p.price) +
          "</div>" +
          "</div>"
        );
      }).join("");
    });
  }

  /* 渲染订单：显示我送出去和代付出去的商品 */
  function renderOrders() {
    var L = document.getElementById("shopOrderList"),
      em = document.getElementById("shopOrdersEmpty");
    if (!L) return;
    _shopLsAsync(OK, function (O) {
      if (!O.length) {
        L.innerHTML = "";
        if (em) em.style.display = "block";
        return;
      }
      if (em) em.style.display = "none";
      L.innerHTML = O.slice()
        .reverse()
        .map(function (o) {
          var d = new Date(o.ts),
            time =
              d.getMonth() +
              1 +
              "月" +
              d.getDate() +
              "日 " +
              ("0" + d.getHours()).slice(-2) +
              ":" +
              ("0" + d.getMinutes()).slice(-2);
          var oIcon = o.emoji || "🛒";
          var oIsImg = /^https?:\/\//.test(oIcon) || /^data:image\//.test(oIcon);
          var oIconHtml = oIsImg ? '<img src="' + rt(oIcon) + '">' : rt(oIcon);
          var isReceive = o.direction === "receive";
          var footerLabel = "";
          if (isReceive) {
            footerLabel = (o.type === "delegate" ? "被代付：" : "赠送人：") + rt(o.contactName || "对方");
          } else {
            footerLabel = (o.type === "delegate" ? "代付人" : "被赠人") + "：" + rt(o.contactName || "对方");
          }
          var statusLabel = "";
          if (o.status === "pending") statusLabel = "待处理";
          else if (o.status === "reject") statusLabel = "已拒绝";
          else if (o.status === "success") statusLabel = "已完成";
          var noteHtml = o.note
            ? '<div style="font-size:12px;color:#999;margin-top:4px">备注：' + rt(o.note) + "</div>"
            : "";
          return (
            "<div class=shop-order-row>" +
            "<div class=shop-order-icon>" +
            oIconHtml +
            "</div>" +
            "<div class=shop-order-main>" +
            "<div class=shop-order-name>" +
            rt(o.productName) +
            "</div>" +
            "<div class=shop-order-desc>" +
            rt(o.productDesc || "暂无介绍") +
            "</div>" +
            noteHtml +
            "</div>" +
            "<div class=shop-order-price>¥" +
            rt(o.price) +
            "</div>" +
            "<div class=shop-order-footer>" +
            "<span>" +
            footerLabel +
            "</span>" +
            "<span>" +
            statusLabel +
            " · " +
            time +
            "</span>" +
            "</div>" +
            "</div>"
          );
        })
        .join("");
    });
  }

  /* 打开商品详情 */
  window.__shopOpenDetail = function (pid) {
    _shopLsAsync(PK, function (P) {
      var p = P.find(function (x) {
        return x.id === pid;
      });
      if (!p) return;
      _cur = p;
      _setShopDetailMode("product");
      _renderShopDetailContent(p);
      var o = document.getElementById("shopDetailOverlay");
      if (o) o.style.display = "flex";
    });
  };

  /* 打开接收到的代付/赠送详情 */
  window.__shopOpenReceiveDetail = function (orderId) {
    _shopLsAsync(OK, function (O) {
      var order = O.find(function (o) {
        return o.id === orderId;
      });
      if (!order) return;
      _shopLsAsync(PK, function (P) {
        var p = P.find(function (x) {
          return x.id === order.productId;
        }) || {
          id: order.productId,
          name: order.productName,
          desc: order.productDesc,
          emoji: order.emoji,
          price: order.price,
        };
        _cur = p;
        _renderShopDetailContent(p);
        _setShopDetailMode("receive", order);
        var o = document.getElementById("shopDetailOverlay");
        if (o) o.style.display = "flex";
      });
    });
  };

  function _renderShopDetailContent(p) {
    var di = document.getElementById("shopDetailIcon"),
      dn = document.getElementById("shopDetailName"),
      dp = document.getElementById("shopDetailPrice"),
      dd = document.getElementById("shopDetailDesc");
    var icon = p.emoji || "🛒";
    var isImgIcon = /^https?:\/\//.test(icon) || /^data:image\//.test(icon);
    if (di) {
      if (isImgIcon) {
        di.innerHTML =
          '<img src="' + rt(icon) + '" style="width:80px;height:80px;object-fit:cover;border-radius:20px">';
      } else {
        di.textContent = icon;
      }
    }
    if (dn) {
      dn.textContent = p.name;
      dn.style.color = "#1a1a1a";
    }
    if (dp) dp.textContent = "¥" + p.price;
    if (dd) dd.textContent = p.desc || "暂无介绍";
  }

  function _setShopDetailMode(mode, order) {
    var myActions = document.getElementById("shopDetailMyActions");
    var receiveActions = document.getElementById("shopDetailReceiveActions");
    var deleteBtn = document.getElementById("shopDetailDeleteBtn");
    var recvInfo = document.getElementById("shopDetailReceiveInfo");
    if (!myActions || !receiveActions) return;
    if (mode === "receive") {
      myActions.style.display = "none";
      receiveActions.style.display = "block";
      if (deleteBtn) deleteBtn.style.display = "none";
      if (recvInfo) recvInfo.style.display = "block";
      var fromEl = document.getElementById("shopDetailReceiveFrom");
      var statusEl = document.getElementById("shopDetailReceiveStatus");
      var acceptBtn = document.getElementById("shopDetailAcceptBtn");
      var rejectBtn = document.getElementById("shopDetailRejectBtn");
      var noteEl = document.getElementById("shopDetailNote");
      /* textContent 赋值不能再用 rt() 转义，否则 & < > 会被二次转义成乱码 */
      if (fromEl)
        fromEl.textContent = (order.type === "delegate" ? "被代付：" : "赠送人：") + (order.contactName || "对方");
      if (statusEl)
        statusEl.textContent =
          "状态：" + (order.status === "pending" ? "待处理" : order.status === "success" ? "已完成" : "已拒绝");
      var noteBox = document.getElementById("shopDetailNoteContainer");
      var noteText = (order.note || "").trim();
      if (noteBox) {
        if (noteText) {
          noteBox.style.display = "block";
          if (noteEl) noteEl.textContent = noteText;
        } else {
          noteBox.style.display = "none";
          if (noteEl) noteEl.textContent = "";
        }
      }
      /* 按钮文案和底色必须在这里一次定稿：弹层是「先设好内容再 display:flex」，
         以前这里先写「付款/接收」再由 runtime.js 延迟 50ms 改成「接收礼物」，
         于是打开瞬间会看到文案和底色来回跳一下（闪烁）。 */
      var isDelegate = order.type === "delegate";
      if (acceptBtn) {
        acceptBtn.textContent = isDelegate ? "给TA代付" : "接收礼物";
        acceptBtn.style.background = "#1a1a1a";
        acceptBtn.style.display = order.status === "pending" ? "block" : "none";
        acceptBtn.onclick = function () {
          window.__shopAcceptReceiveCard(order.id);
        };
      }
      if (rejectBtn) {
        rejectBtn.textContent = isDelegate ? "拒绝代付" : "拒收礼物";
        rejectBtn.style.display = order.status === "pending" ? "block" : "none";
        rejectBtn.onclick = function () {
          window.__shopRejectReceiveCard(order.id);
        };
      }
    } else {
      myActions.style.display = "block";
      receiveActions.style.display = "none";
      if (recvInfo) recvInfo.style.display = "none";
      if (deleteBtn) deleteBtn.style.display = "block";
    }
  }

  window.__shopOpenPicker = function (action) {
    _act = action;
    var dc = null;
    try {
      dc = window.__akiniDefaultContact && window.__akiniDefaultContact();
    } catch (e) {}
    if (!dc && window.akiniContacts && window.akiniContacts.getContacts) {
      var cs = window.akiniContacts.getContacts() || [];
      dc = cs[0] || null;
    }
    if (!dc) {
      return;
    }
    window.__shopSendCard(dc.id);
  };

  /* 发送卡片 + 98%成功/2%失败系统消息 */
  function addSystemMsg(chatId, text) {
    /* 必须走 tt() / __akiniAppendMessageHTML 这条统一落盘链路：
       它会把这一行写进 session.messagesHTML 和 akini_chat_history_<id>。
       以前这里只往 DOM 里 appendChild，外加调用一个根本不存在的
       akiniContacts.appendHistory，所以只要切个会话/重渲染，商店系统消息就整条消失。 */
    if (window.akiniContacts && window.akiniContacts.getContacts) {
      var _cs = window.akiniContacts.getContacts() || [];
      var _valid = function (id) {
        return (
          !!id &&
          _cs.some(function (c) {
            return c && String(c.id) === String(id);
          })
        );
      };
      if (!_valid(chatId)) {
        var _act = null;
        try {
          _act = window.akiniContacts.getActiveChatId && window.akiniContacts.getActiveChatId();
        } catch (e) {}
        chatId = _valid(_act) ? _act : "";
      }
    }
    if (text && chatId && window.__akiniAppendMessageHTML) {
      try {
        window.__akiniAppendMessageHTML(
          chatId,
          '<div class="msg-row system"><div class="bubble">' + rt(text) + "</div></div>",
          { lastMsg: text, lastTime: Date.now() },
        );
        return;
      } catch (e) {}
    }
    var chatBody = document.getElementById("chatBody");
    var U = window.__akiniChatBody || chatBody;
    if (U) {
      var row = document.createElement("div");
      row.className = "msg-row system";
      row.innerHTML = '<div class="bubble">' + rt(text) + "</div>";
      U.appendChild(row);
      if (U.scrollHeight - U.scrollTop - U.clientHeight < 150) U.scrollTop = U.scrollHeight;
    }
  }

  window.__shopSendCard = function (contactId) {
    if (!_cur) return;
    var contacts = window.akiniContacts && window.akiniContacts.getContacts ? window.akiniContacts.getContacts() : [];
    var ct = contacts.find(function (x) {
      return x.id === contactId;
    }) || { id: contactId, name: "对方" };
    var isDel = _act === "delegate";
    var note = randNote();
    var myName = "我";
    try {
      myName = localStorage.getItem("akini_my_name") || "我";
    } catch (e) {}
    // 关闭浮层
    ["shopDetailOverlay"].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) e.style.display = "none";
    });
    // 随机结果：默认成功
    var success = Math.random() < 0.98;
    // 记录订单（使用异步读取避免覆盖旧订单）
    var orderId = Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    _shopLsAsync(OK, function (O) {
      O.push({
        id: orderId,
        productId: _cur.id,
        productName: _cur.name,
        productDesc: _cur.desc || "",
        emoji: _cur.emoji || "🛒",
        price: _cur.price,
        type: _act,
        status: success ? "success" : "reject",
        direction: "send",
        contactId: ct.id,
        contactName: ct.name || "对方",
        note: note,
        ts: Date.now(),
      });
      _shopLsSet(OK, O);
    });
    // 跳转聊天并发送卡片
    try {
      if (window.akiniContacts && window.akiniContacts.setActiveChatId) window.akiniContacts.setActiveChatId(ct.id);
    } catch (e) {}
    setTimeout(function () {
      try {
        if (window.openChat) window.openChat(ct.id, true);
        else if (window.navTo) navTo("chat-list");
      } catch (e) {}
      setTimeout(function () {
        try {
          var U = document.getElementById("chatBody");
          if (!U || !window.akiniContacts) return;
          var cardId = "shop-card-" + orderId;
          var icon = _cur.emoji || "🛒";
          var isImgIcon = /^https?:\/\//.test(icon) || /^data:image\//.test(icon);
          var iconHtml = isImgIcon
            ? '<div class="shop-card-bubble-img"><img src="' + rt(icon) + '"></div>'
            : '<div class="shop-card-bubble-img"><span style="font-size:36px">' + icon + "</span></div>";
          var topText = isDel
            ? rt(myName) + "希望你帮付¥" + rt(_cur.price)
            : rt(myName) + "给" + rt(ct.name || "对方") + "赠送了商品";
          var statusText = isDel ? "待付款" : "待接收";
          var row = document.createElement("div");
          row.className = "msg-row me";
          row.setAttribute("data-ts", String(window.__akiniNextTs ? window.__akiniNextTs() : Date.now()));
          row.innerHTML =
            '<div class="msg-content-line"><div class="bubble shop-card-bubble" id="' +
            cardId +
            '">' +
            '<div class="shop-card-bubble-inner">' +
            iconHtml +
            '<div class="shop-card-bubble-text">' +
            '<div class="shop-card-bubble-title">' +
            topText +
            "</div>" +
            '<div class="shop-card-bubble-name">' +
            rt(_cur.name) +
            "</div>" +
            "</div>" +
            "</div>" +
            '<div class="shop-card-bubble-footer">' +
            "<span></span>" +
            '<span class="shop-card-bubble-status pending" id="' +
            cardId +
            '-status">' +
            statusText +
            "</span>" +
            "</div>" +
            '</div><div class="msg-avatar">' +
            window.getMyAvatar() +
            "</div></div>";
          U.appendChild(row);
          window.akiniContacts.updateSession(ct.id, {
            lastMsg: (isDel ? "【代付】" : "【赠送】") + _cur.name,
            lastTime: Date.now(),
            lastSenderAvatar: window.getMyAvatar() || "",
            lastSenderName: myName,
            messagesHTML: U.innerHTML,
          });
          U.scrollTop = U.scrollHeight;
          // 随机结果：成功 98% / 拒绝 2%
          if (!success) {
            // 拒绝：2-5秒后状态变为拒收款/拒接收
            setTimeout(
              function () {
                window.__shopRejectCardStatus(cardId, isDel);
              },
              2000 + Math.floor(Math.random() * 3000),
            );
          } else {
            // 成功订单：3-6秒后自动更新为已付款/已接收
            setTimeout(
              function () {
                window.__shopUpdateCardStatus(cardId);
              },
              3000 + Math.floor(Math.random() * 3000),
            );
          }
        } catch (e) {
          console.error("shop send card error", e);
        }
      }, 400);
    }, 200);
  };

  window.__shopUpdateCardStatus = function (cardId) {
    var statusEl = document.getElementById(cardId + "-status");
    if (!statusEl) return;
    if (statusEl.classList.contains("done")) return;
    var isDel = statusEl.textContent === "待付款";
    statusEl.textContent = isDel ? "已付款" : "已接收";
    statusEl.className = "shop-card-bubble-status done";
    var bubble = document.getElementById(cardId);
    if (bubble) {
      bubble.setAttribute("onclick", "");
    }
    var orderId = cardId.replace("shop-card-", "");
    _shopLsAsync(OK, function (O) {
      var orderIdx = O.findIndex(function (o) {
        return o.id === orderId;
      });
      if (orderIdx >= 0) {
        O[orderIdx].status = "success";
        _shopLsSet(OK, O);
      }
    });
    var U = document.getElementById("chatBody");
    if (U && window.akiniContacts) {
      var activeId = window.akiniContacts.getActiveChatId();
      if (activeId) window.akiniContacts.updateSession(activeId, { messagesHTML: U.innerHTML });
    }
    addSystemMsg(activeId || "ta", isDel ? "对方已付款" : "对方已收下");
  };

  window.__shopRejectCardStatus = function (cardId, isDel) {
    var statusEl = document.getElementById(cardId + "-status");
    if (!statusEl) return;
    if (statusEl.classList.contains("done")) return;
    statusEl.textContent = isDel ? "拒收款" : "拒接收";
    statusEl.className = "shop-card-bubble-status done";
    var bubble = document.getElementById(cardId);
    if (bubble) {
      bubble.setAttribute("onclick", "");
    }
    var orderId = cardId.replace("shop-card-", "");
    _shopLsAsync(OK, function (O) {
      var orderIdx = O.findIndex(function (o) {
        return o.id === orderId;
      });
      if (orderIdx >= 0) {
        O[orderIdx].status = "reject";
        _shopLsSet(OK, O);
      }
    });
    var U = document.getElementById("chatBody");
    if (U && window.akiniContacts) {
      var activeId = window.akiniContacts.getActiveChatId();
      if (activeId) window.akiniContacts.updateSession(activeId, { messagesHTML: U.innerHTML });
    }
    addSystemMsg(
      (window.akiniContacts && window.akiniContacts.getActiveChatId()) || "ta",
      isDel ? "对方拒收款" : "对方拒接收",
    );
  };

  /* 对方发送代付/赠送卡片给我 */
  window.__shopReceiveCard = function (contactId, type, productId, orderId, note) {
    var contacts = window.akiniContacts && window.akiniContacts.getContacts ? window.akiniContacts.getContacts() : [];
    var ct = contacts.find(function (x) {
      return x.id === contactId;
    }) || { id: contactId, name: "对方" };
    _shopLsAsync(PK, function (P) {
      var p = P.find(function (x) {
        return x.id === productId;
      });
      if (!p) return;
      var order = {
        id: orderId,
        productId: p.id,
        productName: p.name,
        productDesc: p.desc || "",
        emoji: p.emoji || "🛒",
        price: p.price,
        type: type,
        status: "pending",
        direction: "receive",
        contactId: ct.id,
        contactName: ct.name || "对方",
        note: note || "",
        ts: Date.now(),
      };
      _shopLsAsync(OK, function (O) {
        O.push(order);
        _shopLsSet(OK, O);
      });
      var icon = p.emoji || "🛒";
      var isImgIcon = /^https?:\/\//.test(icon) || /^data:image\//.test(icon);
      var iconHtml = isImgIcon
        ? '<div class="shop-card-bubble-img"><img src="' + rt(icon) + '"></div>'
        : '<div class="shop-card-bubble-img"><span style="font-size:36px">' + icon + "</span></div>";
      var topText =
        type === "delegate"
          ? rt(ct.name || "对方") + "希望你帮付¥" + rt(p.price)
          : rt(ct.name || "对方") + "给你赠送了商品";
      var statusText = type === "delegate" ? "待付款" : "待接收";
      var cardId = "shop-recv-card-" + orderId;
      var cardHtml =
        '<div class="msg-row other" data-ts="' +
        (window.__akiniNextTs ? window.__akiniNextTs() : Date.now()) +
        '"><div class="msg-content-line"><div class="msg-avatar">' +
        avatarHtml(ct.avatar, "") +
        '</div><div class="bubble shop-card-bubble" id="' +
        cardId +
        '" onclick="window.__shopOpenReceiveDetail(\'' +
        orderId +
        "')\">" +
        '<div class="shop-card-bubble-inner">' +
        iconHtml +
        '<div class="shop-card-bubble-text">' +
        '<div class="shop-card-bubble-title">' +
        topText +
        "</div>" +
        '<div class="shop-card-bubble-name">' +
        rt(p.name) +
        "</div>" +
        "</div>" +
        "</div>" +
        '<div class="shop-card-bubble-footer">' +
        "<span>" +
        rt(note || "") +
        "</span>" +
        '<span class="shop-card-bubble-status pending" id="' +
        cardId +
        '-status">' +
        statusText +
        "</span>" +
        "</div>" +
        "</div></div></div>";
      var session =
        window.akiniContacts && window.akiniContacts.getSession ? window.akiniContacts.getSession(ct.id) : {};
      var existingHTML = (session && session.messagesHTML) || "";
      window.akiniContacts.updateSession(ct.id, {
        messagesHTML: existingHTML + cardHtml,
        lastMsg: (type === "delegate" ? "【代付】" : "【赠送】") + p.name,
        lastTime: Date.now(),
        lastSenderAvatar: ct.avatar || "",
        lastSenderName: ct.name || "对方",
      });
      var activeId =
        window.akiniContacts && window.akiniContacts.getActiveChatId ? window.akiniContacts.getActiveChatId() : null;
      if (activeId === ct.id) {
        var U = document.getElementById("chatBody");
        if (U) {
          var div = document.createElement("div");
          div.innerHTML = cardHtml;
          var row = div.firstChild;
          U.appendChild(row);
          U.scrollTop = U.scrollHeight;
          window.akiniContacts.updateSession(ct.id, { messagesHTML: U.innerHTML });
        }
      }
      if (window.showInAppNotif) {
        window.showInAppNotif({
          app: "商店",
          appIcon: "🛍",
          name: ct.name || "对方",
          avatar: ct.avatar || "",
          fullContent: !0,
          msg: (type === "delegate" ? "【代付】" : "【赠送】") + p.name,
          onTap: function () {
            if (window.openChat) window.openChat(ct.id, true);
          },
        });
      }
    });
  };

  window.__shopAcceptReceiveCard = function (orderId) {
    _shopLsAsync(OK, function (O) {
      var idx = O.findIndex(function (o) {
        return o.id === orderId;
      });
      if (idx < 0) return;
      var order = O[idx];
      if (order.status !== "pending") return;
      order.status = "success";
      /* order.note 不被用户篡改 */
      _shopLsSet(OK, O);
      var cardId = "shop-recv-card-" + orderId;
      var statusEl = document.getElementById(cardId + "-status");
      if (statusEl) {
        statusEl.textContent = order.type === "delegate" ? "已付款" : "已接收";
        statusEl.className = "shop-card-bubble-status done";
      }
      var bubble = document.getElementById(cardId);
      if (bubble) bubble.setAttribute("onclick", "");
      var o = document.getElementById("shopDetailOverlay");
      if (o) o.style.display = "none";
      addSystemMsg(order.contactId || "ta", order.type === "delegate" ? "你已付款" : "你已收下");
      renderOrders();
    });
  };

  window.__shopRejectReceiveCard = function (orderId) {
    _shopLsAsync(OK, function (O) {
      var idx = O.findIndex(function (o) {
        return o.id === orderId;
      });
      if (idx < 0) return;
      var order = O[idx];
      if (order.status !== "pending") return;
      order.status = "reject";
      /* order.note 不被用户篡改 */
      _shopLsSet(OK, O);
      var cardId = "shop-recv-card-" + orderId;
      var statusEl = document.getElementById(cardId + "-status");
      if (statusEl) {
        statusEl.textContent = order.type === "delegate" ? "已拒付款" : "已拒接收";
        statusEl.className = "shop-card-bubble-status done";
      }
      var bubble = document.getElementById(cardId);
      if (bubble) bubble.setAttribute("onclick", "");
      var o = document.getElementById("shopDetailOverlay");
      if (o) o.style.display = "none";
      addSystemMsg(order.contactId || "ta", order.type === "delegate" ? "你已拒绝付款" : "你已拒绝接收");
      renderOrders();
    });
  };

  /* 商品图标选择 */
  var _iconFileInput = document.getElementById("shopIconFileInput");
  var _iconPreview = document.getElementById("shopIconPreview");
  var _iconPlaceholder = document.getElementById("shopIconPlaceholder");
  var _iconForm = document.getElementById("shopFormIcon");
  var _iconPicker = document.getElementById("shopIconPicker");
  function _openIconPicker() {
    if (_iconFileInput) _iconFileInput.click();
  }
  if (_iconPicker) {
    _iconPicker.addEventListener("click", function (e) {
      if (e.target === _iconFileInput) return;
      e.preventDefault();
      _openIconPicker();
    });
  }
  function _resizeImage(url, maxW, quality, cb) {
    if (typeof quality === "function") {
      cb = quality;
      quality = 0.85;
    }
    if (typeof cb !== "function") {
      cb = function (u) {};
    }
    var img = new Image();
    img.onload = function () {
      var canvas = document.createElement("canvas");
      var w = img.width,
        h = img.height;
      if (w > maxW) {
        h = Math.round((h * maxW) / w);
        w = maxW;
      }
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext("2d");
      /* 商品图标透明底：不填充白色，保留 PNG 透明通道 */
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      cb(canvas.toDataURL("image/png"));
    };
    img.onerror = function () {
      cb(url);
    };
    img.src = url;
  }
  /* 商品图标上传时自动去除白色底图，并压缩到 100KB 内 */
  function _processShopIcon(url, cb) {
    var finish = function (u) {
      if (u.length <= 100000) {
        cb(u);
        return;
      }
      _resizeImage(u, 500, 0.85, function (p1) {
        if (p1.length <= 100000) {
          cb(p1);
          return;
        }
        _resizeImage(p1, 300, 0.85, function (p2) {
          if (p2.length <= 100000) {
            cb(p2);
            return;
          }
          _resizeImage(p2, 200, 0.85, function (p3) {
            cb(p3);
          });
        });
      });
    };
    if (typeof removeWhiteBg === "function") {
      removeWhiteBg(url, finish);
    } else {
      finish(url);
    }
  }
  if (_iconFileInput) {
    _iconFileInput.addEventListener("change", function (ev) {
      var file = ev.target.files && ev.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        var url = e.target.result;
        /* 上传即去白底并压缩，压缩后仍带透明通道 */
        _processShopIcon(url, function (finalUrl) {
          if (_iconPreview) {
            _iconPreview.src = finalUrl;
            _iconPreview.style.display = "block";
          }
          if (_iconPlaceholder) _iconPlaceholder.style.display = "none";
          if (_iconForm) _iconForm.value = finalUrl;
        });
      };
      reader.readAsDataURL(file);
    });
  }

  /* 添加商品（按钮在 index.html 里已有 onclick -> __shopAddProduct，这里不再重复绑定） */
  window.__shopAddProduct = function () {
    _cur = null;
    ["shopFormName", "shopFormPrice", "shopFormDesc"].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) e.value = "";
    });
    if (_iconForm) _iconForm.value = "";
    if (_iconPreview) {
      _iconPreview.src = "";
      _iconPreview.style.display = "none";
    }
    if (_iconPlaceholder) _iconPlaceholder.style.display = "flex";
    if (_iconFileInput) _iconFileInput.value = "";
    var o = document.getElementById("shopAddOverlay");
    if (o) o.style.display = "flex";
  };

  window.__shopSaveProduct = function () {
    var defaultIcon =
      "https://miaoda-conversation-file.cdn.bcebos.com/user-db5macoyd5og/app-dyk6hsnjhh4x/20260818/image_AE62A578-B8BF-4810-AAE2-6870BE6EFC9D.jpg";
    var emoji = (document.getElementById("shopFormIcon").value || "").trim() || defaultIcon;
    var name = (document.getElementById("shopFormName").value || "").trim();
    var price = (document.getElementById("shopFormPrice").value || "").trim();
    var desc = (document.getElementById("shopFormDesc").value || "").trim();
    if (!name) {
      alert("请输入商品名称");
      return;
    }
    if (!price) {
      alert("请输入价格");
      return;
    }
    var P = _shopLs(PK);
    if (_cur) {
      var idx = P.findIndex(function (x) {
        return x.id === _cur.id;
      });
      if (idx >= 0) P[idx] = { id: _cur.id, emoji: emoji, name: name, price: price, desc: desc };
      else P.push({ id: Date.now() + "", emoji: emoji, name: name, price: price, desc: desc });
    } else {
      P.push({ id: Date.now() + "", emoji: emoji, name: name, price: price, desc: desc });
    }
    var saved = _shopLsSet(PK, P);
    if (!saved) {
      alert("商品保存失败：存储空间可能已满，请删除一些商品或清理缓存后重试");
      return;
    }
    var o = document.getElementById("shopAddOverlay");
    if (o) o.style.display = "none";
    var d = document.getElementById("shopDetailOverlay");
    if (d) d.style.display = "none";
    renderGrid();
  };

  window.__shopDeleteProduct = function () {
    if (!_cur) return;
    var name = _cur.name || "该商品";
    function doDelete() {
      _shopLsAsync(PK, function (P) {
        var next = (P || []).filter(function (x) {
          return x.id !== _cur.id;
        });
        _shopLsSet(PK, next);
        var d = document.getElementById("shopDetailOverlay");
        if (d) d.style.display = "none";
        renderGrid();
      });
    }
    if (window.__akiniCenterModal)
      window.__akiniCenterModal("删除商品？", "「" + name + "」删除后将无法恢复", {
        confirm: true,
        okText: "删除",
        cancelText: "取消",
        onClose: function (ok) {
          if (ok) doDelete();
        },
      });
    else if (confirm("确定要删除「" + name + "」吗？")) doDelete();
  };

  window.__shopEditProduct = function () {
    if (!_cur) return;
    var icon = document.getElementById("shopFormIcon");
    var name = document.getElementById("shopFormName");
    var price = document.getElementById("shopFormPrice");
    var desc = document.getElementById("shopFormDesc");
    if (icon) icon.value = _cur.emoji || "";
    if (name) name.value = _cur.name || "";
    if (price) price.value = _cur.price || "";
    if (desc) desc.value = _cur.desc || "";
    var o = document.getElementById("shopAddOverlay");
    if (o) o.style.display = "flex";
  };

  /* Tab 事件绑定 */
  var _tabBuy = document.getElementById("shopTabBuyBtn");
  var _tabOrd = document.getElementById("shopTabOrdersBtn");
  if (_tabBuy)
    _tabBuy.addEventListener("click", function () {
      window.__shopTab("buy");
    });
  if (_tabOrd)
    _tabOrd.addEventListener("click", function () {
      window.__shopTab("orders");
    });

  /* 商品卡片点击事件委托 */
  var _shopGridEl = document.getElementById("shopGrid");
  if (_shopGridEl) {
    _shopGridEl.addEventListener("click", function (e) {
      var card = e.target.closest(".shop-card");
      if (card) {
        var pid = card.getAttribute("data-pid");
        if (pid && window.__shopOpenDetail) window.__shopOpenDetail(pid);
      }
    });
  }

  /* 暴露渲染入口 */
  window.__renderShop = function () {
    renderGrid();
    window.__shopTab("buy");
  };

  /* 商店不预置任何商品；清理旧的默认商品 */
  (function () {
    var P = _shopLs(PK);
    var cleaned = P.filter(function (x) {
      return x.id !== "d1" && x.id !== "d2" && x.id !== "d3";
    });
    if (cleaned.length !== P.length) _shopLsSet(PK, cleaned);
  })();
})();


(function () {
  var PROB_KEYS = {
    emoji: "akini_prob_emoji",
    quote: "akini_prob_quote",
    miniBubble: "akini_prob_miniBubble",
    poke: "akini_prob_poke",
    noReply: "akini_prob_noReply",
    missCall: "akini_prob_missCall",
    answerCall: "akini_prob_answerCall",
    incomingCall: "akini_prob_incomingCall",
    refundTransfer: "akini_prob_refundTransfer",
    collectTransfer: "akini_prob_collectTransfer",
    meaningfulNumber: "akini_prob_meaningfulNumber",
    taTransfer: "akini_prob_taTransfer",
    groupCall: "akini_prob_groupCall",
    groupAtMe: "akini_prob_groupAtMe",
    groupAtOther: "akini_prob_groupAtOther",
    groupTransferOther: "akini_prob_groupTransferOther",
    groupTransferMe: "akini_prob_groupTransferMe",
    replySticker: "akini_prob_replySticker",
    pinyinCard: "akini_prob_pinyinCard",
    emojiMixMsg: "akini_prob_emojiMixMsg",
    postWithSticker: "akini_prob_postWithSticker",
    surveyInvite: "akini_prob_surveyInvite",
    shopCard: "akini_prob_shopCard",
    musicInvite: "akini_prob_invite",
    musicSkip: "akini_prob_skip",
    taPhoneChat: "akini_prob_taPhoneChat",
    taPhoneMoments: "akini_prob_taPhoneMoments",
    taPhoneIcity: "akini_prob_taPhoneIcity",
    taPhoneMusic: "akini_prob_taPhoneMusic",
    taPhoneMail: "akini_prob_taPhoneMail",
  };
  var DEFAULT_PROBS = {
    emoji: 20,
    quote: 30,
    miniBubble: 10,
    poke: 3,
    noReply: 10,
    missCall: 15,
    answerCall: 85,
    incomingCall: 10,
    refundTransfer: 30,
    collectTransfer: 70,
    meaningfulNumber: 15,
    taTransfer: 7,
    groupCall: 15,
    groupAtMe: 15,
    groupAtOther: 5,
    groupTransferOther: 15,
    groupTransferMe: 15,
    replySticker: 20,
    pinyinCard: 35,
    emojiMixMsg: 20,
    postWithSticker: 10,
    surveyInvite: 10,
    shopCard: 10,
    musicInvite: 10,
    musicSkip: 5,
    taPhoneChat: 2,
    taPhoneMoments: 10,
    taPhoneIcity: 10,
    taPhoneMusic: 10,
    taPhoneMail: 10,
  };
  /* 概率值一旦被用户改过就必须尊重：旧代码会把 20/2 强行改回 10，
     用户设好的「不回概率」被悄悄调低，表现就是「概率没问题但触发太高」。 */
  try {
    if (localStorage.getItem("akini_toggle_contactTransferToggle") === null) {
      localStorage.setItem("akini_toggle_contactTransferToggle", "1");
    }
  } catch (e) {}
  var TIME_KEYS = {
    reply: ["akini_time_reply_start", "akini_time_reply_end"],
    mail: ["akini_time_mail_start", "akini_time_mail_end"],
    activeMsg: ["akini_time_activemsg_start", "akini_time_activemsg_end"],
    friends: ["akini_time_friends_start", "akini_time_friends_end"],
    icity: ["akini_time_icity_start", "akini_time_icity_end"],
  };
  function lsGet(k, def) {
    try {
      var v = localStorage.getItem(k);
      return v !== null ? v : def;
    } catch (e) {
      return def;
    }
  }
  function lsSet(k, v) {
    /* 必须走 akiniStore.set：它会同步更新内存缓存(memSet)，
       而直接 localStorage.setItem 的覆盖层不会更新 memCache，
       导致 critical 键（所有 akini_prob_* / akini_num_*）保存后 getItem 仍读旧值 */
    try {
      if (window.akiniStore && window.akiniStore.set) {
        window.akiniStore.set(k, v);
      } else {
        localStorage.setItem(k, v);
        try {
          if (window._idbStore && window._idbStore.set) window._idbStore.set(k, v);
        } catch (e) {}
      }
    } catch (e) {}
  }
  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, parseFloat(n) || 0));
  }
  /* core 生成一条回复时会执行两次附加动作队列（文字前、文字后各一次），
     附加开关是普通布尔值时，转账/表情包/拍一拍/来电就会各发两条。
     这里把它们改成只在第一次读取时为真，第二次队列执行自然跳过。 */
  function onceFlag(v) {
    var used = false;
    return {
      enumerable: true,
      configurable: true,
      get: function () {
        if (used) return false;
        used = true;
        return v;
      },
    };
  }
  function installOnceExtras() {
    var akr = window.AKR;
    if (!akr || typeof akr.pickReplyBehavior !== "function") return;
    var orig = akr.pickReplyBehavior;
    akr.pickReplyBehavior = function () {
      var b = orig.apply(this, arguments);
      var e = b && b.type === "text" && b.extra;
      if (e) {
        var snapshot = {
          transfer: e.transfer,
          sticker: e.sticker,
          poke: e.poke,
          call: e.call,
          quote: e.quote,
          emojiMix: e.emojiMix,
        };
        Object.defineProperty(e, "transfer", onceFlag(snapshot.transfer));
        Object.defineProperty(e, "sticker", onceFlag(snapshot.sticker));
        Object.defineProperty(e, "poke", onceFlag(snapshot.poke));
        Object.defineProperty(e, "call", onceFlag(snapshot.call));
        /* core 创建回复时会 JSON.stringify 一次附加项写日志；直接给快照，
           避免那次序列化提前消耗掉单次开关 */
        e.toJSON = function () {
          return snapshot;
        };
      }
      return b;
    };
  }
  // UI bindings
  /* 概率调整独立页开关（与设置页互斥显示，hideAll 已收录防 overlay 残留） */
  window.__openProbArea = function () {
    try {
      var sa = document.getElementById("settingsArea"),
        pa = document.getElementById("akiniProbArea");
      if (sa) sa.style.display = "none";
      if (pa) pa.style.display = "flex";
    } catch (e) {}
  };
  window.__closeProbArea = function () {
    try {
      var sa = document.getElementById("settingsArea"),
        pa = document.getElementById("akiniProbArea");
      if (pa) pa.style.display = "none";
      if (sa) sa.style.display = "flex";
    } catch (e) {}
  };
  function bindProbInput(id, key) {
    var el = document.getElementById(id);
    if (!el) return;
    el.value = lsGet(PROB_KEYS[key], DEFAULT_PROBS[key]);
    var k = PROB_KEYS[key];
    /* lsSet 内部走 akiniStore.set（更新 memCache + localStorage + 防抖 IDB），
       每键一次输入即保存，失焦时再补一次完整同步 */
    el.addEventListener("input", function () {
      lsSet(k, clamp(el.value, 0, 100));
    });
    el.addEventListener("change", function () {
      lsSet(k, clamp(el.value, 0, 100));
    });
  }
  function bindTimeInput(id, key, idx) {
    var el = document.getElementById(id);
    if (!el) return;
    el.value = lsGet(TIME_KEYS[key][idx], idx === 0 ? "08:00" : "23:00");
    el.addEventListener("change", function () {
      lsSet(TIME_KEYS[key][idx], el.value);
    });
  }
  function resetProbDefaultsIfNeeded() {
    var CURR = "20261102ac";
    /* 问卷邀请 / 商店卡片的默认值在 56c8aa0 已从 20 改成 10，但当时没把这两项收进 RESET_KEYS，
       老存档里写死的 20 一直没被迁掉，设置页读的又是存档值 → 用户看到的还是 20%。
       补进 RESET_KEYS 并升版本，让存量安装一次性回到 10%。 */
    var RESET_KEYS = ["noReply", "taTransfer", "emoji", "quote", "poke", "miniBubble", "surveyInvite", "shopCard"];
    var applyValues = function (forceReset) {
      try {
        for (var k in DEFAULT_PROBS) {
          if (DEFAULT_PROBS.hasOwnProperty(k)) {
            if (forceReset && RESET_KEYS.indexOf(k) >= 0) {
              lsSet(PROB_KEYS[k], DEFAULT_PROBS[k]);
            } else if (localStorage.getItem(PROB_KEYS[k]) === null) {
              /* 版本号已是最新时也要补齐缺失的键：
                 老版本没写过的概率键（如 akini_prob_invite）若为空，getProb 会返回 0 → 永远不触发 */
              lsSet(PROB_KEYS[k], DEFAULT_PROBS[k]);
            }
          }
        }
      } catch (e) {
        console.warn("resetProbDefaults apply error:", e);
      }
    };
    var run = function (skipVersionCheck) {
      try {
        var forceReset = !!skipVersionCheck || localStorage.getItem("akini_prob_version") !== CURR;
        if (forceReset) lsSet("akini_prob_version", CURR);
        applyValues(forceReset);
        console.log("[Akini] 概率默认值已校准(20261102a):", DEFAULT_PROBS);
      } catch (e) {
        console.warn("resetProbDefaults error:", e);
      }
    };
    /* 存储层有启动恢复流程（restoreAll）会用 IDB 旧值覆盖内存，且 queueIdbWrite/flushIdbQueue
       存在异步竞态。首次写入可能被恢复流程覆盖，因此在恢复完成后分多次写入，确保最终值落定。
       两次兜底必须走 run(false) 重新校验版本号，而不是直接 applyValues()：
       恢复流程连 akini_prob_version 一起写回旧值，只有重跑版本校验才会再强刷一次默认值，
       否则第一次启动会出现「输入框显示 10、真实概率仍是 20」的不一致。 */
    var runWhenReady = function () {
      if (window.__akiniStorageRestored) {
        run(false);
        setTimeout(function () {
          run(false);
        }, 1500);
        setTimeout(function () {
          run(false);
        }, 4000);
      } else {
        setTimeout(runWhenReady, 100);
      }
    };
    runWhenReady();
  }
  /* shop.js 是 window load 之后才注入的，DOMContentLoaded 早已触发，
     直接 addEventListener("DOMContentLoaded") 永远不会执行，导致
     installOnceExtras / bindProbInput 全部失效 → 拍一拍/转账等附加动作发两条。
     这里根据 readyState 立即执行或兜底等待。 */
  function __akiniShopInit() {
    resetProbDefaultsIfNeeded();
    installOnceExtras();
    bindProbInput("probEmoji", "emoji");
    bindProbInput("probQuote", "quote");
    bindProbInput("probMiniBubble", "miniBubble");
    bindProbInput("probPoke", "poke");
    bindProbInput("probNoReply", "noReply");
    bindProbInput("probMusicInvite", "musicInvite");
    bindProbInput("probMusicSkip", "musicSkip");
    bindProbInput("probMissCall", "missCall");
    bindProbInput("probAnswerCall", "answerCall");
    bindProbInput("probIncomingCall", "incomingCall");
    bindProbInput("probRefundTransfer", "refundTransfer");
    bindProbInput("probCollectTransfer", "collectTransfer");
    bindProbInput("probMeaningfulNumber", "meaningfulNumber");
    bindProbInput("probReplySticker", "replySticker");
    bindProbInput("probPinyinCard", "pinyinCard");
    bindProbInput("probEmojiMixMsg", "emojiMixMsg");
    bindProbInput("probPostWithSticker", "postWithSticker");
    bindProbInput("probSurveyInvite", "surveyInvite");
    bindProbInput("probShopCard", "shopCard");
    bindProbInput("probGroupCall", "groupCall");
    bindProbInput("probGroupAtMe", "groupAtMe");
    bindProbInput("probGroupAtOther", "groupAtOther");
    bindProbInput("probTaTransfer", "taTransfer");
    bindProbInput("probGroupTransferOther", "groupTransferOther");
    bindProbInput("probGroupTransferMe", "groupTransferMe");
    bindProbInput("probTaChat", "taPhoneChat");
    bindProbInput("probTaMoments", "taPhoneMoments");
    bindProbInput("probTaIcity", "taPhoneIcity");
    bindProbInput("probTaMusic", "taPhoneMusic");
    bindProbInput("probTaMail", "taPhoneMail");
    bindTimeInput("timeReplyStart", "reply", 0);
    bindTimeInput("timeReplyEnd", "reply", 1);
    bindTimeInput("timeMailStart", "mail", 0);
    bindTimeInput("timeMailEnd", "mail", 1);
    bindTimeInput("timeActiveMsgStart", "activeMsg", 0);
    bindTimeInput("timeActiveMsgEnd", "activeMsg", 1);
    bindTimeInput("timeFriendsStart", "friends", 0);
    bindTimeInput("timeFriendsEnd", "friends", 1);
    bindTimeInput("timeIcityStart", "icity", 0);
    bindTimeInput("timeIcityEnd", "icity", 1);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", __akiniShopInit);
  } else {
    __akiniShopInit();
  }
})();
