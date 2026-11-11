/* 第一屏：封面、头像、文字与拍立得的加载与更换 */
window.loadS1SavedData = function () {
  try {
    try {
      if (localStorage.getItem("akini_s1_migrated_") !== "1") {
        localStorage.setItem("akini_s1_migrated_", "1");
        var _old3 = localStorage.getItem("akini_s1_custom_text_3");
        var _old4 = localStorage.getItem("akini_s1_custom_text_4");
        if (_old3 !== null && _old3 !== "" && !localStorage.getItem("akini_s1_custom_text_2")) {
          localStorage.setItem("akini_s1_custom_text_2", _old3);
        }
        if (_old4 !== null && _old4 !== "") {
          var _cur3 = localStorage.getItem("akini_s1_custom_text_3");
          if (_cur3 === null || _cur3 === "" || _cur3 === _old3) {
            localStorage.setItem("akini_s1_custom_text_3", _old4);
          }
        }
        var _sj = {};
        try {
          _sj = JSON.parse(localStorage.getItem("akini_s1_texts") || "{}");
        } catch (_eJ) {}
        if (!_sj["line2"] && _sj["line3"]) _sj["line2"] = _sj["line3"];
        if (_sj["line4"] && (!_sj["line3"] || _sj["line3"] === _sj["line2"])) _sj["line3"] = _sj["line4"];
        try {
          localStorage.setItem("akini_s1_texts", JSON.stringify(_sj));
        } catch (_eJ2) {}
      }
    } catch (_eMig) {}

    var t1 = localStorage.getItem("akini_s1_custom_text_1");
    var t2 = localStorage.getItem("akini_s1_custom_text_2");
    var t3 = localStorage.getItem("akini_s1_custom_text_3");
    var t5 = localStorage.getItem("akini_s1_custom_text_5");
    var note = localStorage.getItem("akini_s1_polaroid_note");
    var cover = localStorage.getItem("akini_s1_cover") || localStorage.getItem("akini_s1_cover_bg");
    var avatar =
      localStorage.getItem("akini_my_avatar") ||
      localStorage.getItem("akini_icity_my_avatar") ||
      localStorage.getItem("akini_s1_avatar");
    if (avatar) {
      try {
        localStorage.setItem("akini_my_avatar", avatar);
      } catch (eSav1) {}
      try {
        localStorage.setItem("akini_icity_my_avatar", avatar);
      } catch (eSav2) {}
      try {
        localStorage.setItem("akini_s1_avatar", avatar);
      } catch (eSav3) {}
      try {
        localStorage.setItem("akini_avatar_left", avatar);
      } catch (eSav4) {}
      try {
        if (window.__akiniAvatarCache) window.__akiniAvatarCache.my = avatar;
      } catch (eSav5) {}
    }
    var photo = localStorage.getItem("akini_s1_photo") || localStorage.getItem("akini_s1_polaroid_img");

    if (!photo && window.akiniStore && window.akiniStore.get) {
      try {
        window.akiniStore.get("akini_s1_photo", function (_pv) {
          if (_pv) {
            var _pe = document.getElementById("s1PolaroidImg");
            if (_pe) _pe.style.setProperty("background-image", 'url("' + _pv + '")', "important");
            try {
              localStorage.setItem("akini_s1_photo", _pv);
            } catch (ePh1) {}
          }
        });
      } catch (ePh2) {}
    }
    if (!cover && window.akiniStore && window.akiniStore.get) {
      try {
        window.akiniStore.get("akini_s1_cover", function (_cv) {
          if (_cv) {
            var _ce = document.getElementById("s1CoverBg");
            if (_ce) _ce.style.setProperty("background-image", 'url("' + _cv + '")', "important");
            try {
              localStorage.setItem("akini_s1_cover", _cv);
            } catch (eCov) {}
          }
        });
      } catch (eCov2) {}
    }
    if (!avatar && window.akiniStore && window.akiniStore.get) {
      try {
        window.akiniStore.get("akini_my_avatar", function (_av) {
          if (_av && /^(data:image\/|https?:)/i.test(String(_av)) && String(_av).indexOf("blob:") !== 0) {
            var _ae = document.getElementById("s1AvatarImg");
            if (_ae) _ae.src = _av;
            try {
              localStorage.setItem("akini_s1_avatar", _av);
            } catch (eAv) {}
          }
        });
      } catch (eAv2) {}
    }
    /* 文字键从 IDB 兜底恢复：浏览器清理 LS 后，文字设置会丢失——
       因为 IDB 是持久化存储（iOS Safari 例外），只要用户没手动清数据就能救回来 */
    var _textKeys = [
      { lsKey: "akini_s1_custom_text_1", elId: "s1Text1", prop: t1 },
      { lsKey: "akini_s1_custom_text_2", elId: "s1Text2", prop: t2 },
      { lsKey: "akini_s1_custom_text_3", elId: "s1Text3", prop: t3 },
      { lsKey: "akini_s1_custom_text_5", elId: "s1TextLoc", prop: t5 },
      { lsKey: "akini_s1_polaroid_note", elId: "s1PolaroidNote", prop: note },
    ];
    _textKeys.forEach(function (_tk) {
      if ((!_tk.prop || _tk.prop === "") && window.akiniStore && window.akiniStore.get) {
        try {
          window.akiniStore.get(_tk.lsKey, function (_tv) {
            if (_tv && _tv.trim() && _tv.trim() !== "null" && _tv.trim() !== "undefined") {
              var _el = document.getElementById(_tk.elId);
              if (_el) _el.textContent = _tv;
              try {
                localStorage.setItem(_tk.lsKey, _tv);
              } catch (_eTk) {}
            }
          });
        } catch (_eFb) {}
      }
    });

    if (t1 && document.getElementById("s1Text1")) document.getElementById("s1Text1").textContent = t1;
    if (t2 && document.getElementById("s1Text2")) document.getElementById("s1Text2").textContent = t2;
    if (t3 && document.getElementById("s1Text3")) document.getElementById("s1Text3").textContent = t3;
    if (t5 && document.getElementById("s1TextLoc")) document.getElementById("s1TextLoc").textContent = t5;
    if (note && document.getElementById("s1PolaroidNote")) document.getElementById("s1PolaroidNote").textContent = note;
    /* 幂等设置：已经是同一张图就跳过，避免重复赋值触发重新解码造成闪烁 */
    var _cEl = document.getElementById("s1CoverBg");
    if (cover && _cEl && (_cEl.style.backgroundImage || "").indexOf(cover) < 0)
      _cEl.style.setProperty("background-image", 'url("' + cover + '")', "important");
    var _aEl = document.getElementById("s1AvatarImg");
    if (avatar && _aEl && __akiniS1ValidImg(avatar) && (_aEl.getAttribute("src") || "") !== avatar)
      _aEl.src = avatar;
    var _pEl = document.getElementById("s1PolaroidImg");
    if (photo && _pEl && (_pEl.style.backgroundImage || "").indexOf(photo) < 0)
      _pEl.style.setProperty("background-image", 'url("' + photo + '")', "important");
  } catch (e) {}
};

document.addEventListener("DOMContentLoaded", function () {
  window.loadS1SavedData();
});

function __akiniS1ValidImg(v) {
  return !!(
    v &&
    typeof v === "string" &&
    v.length >= 100 &&
    (/^data:image\//i.test(v) || /^(blob:|https?:\/\/)/i.test(v))
  );
}

function __akiniS1ApplyImg(slot, val) {
  if (!__akiniS1ValidImg(val)) return false;
  var el = document.getElementById(slot.elId);
  if (!el) {
    /* 元素还没渲染出来：先把值落盘，等元素出现再补渲染 */
    try {
      localStorage.setItem(slot.lsKey, val);
    } catch (e0) {}
    return false;
  }
  /* 幂等：已经是同一张图就直接跳过，避免重进时反复设置 data URL 触发重新解码 → 闪烁卡顿 */
  try {
    if (slot.mode === "src") {
      var curSrc = el.getAttribute("src") || el.src || "";
      if (curSrc && curSrc === val) {
        slot._applied = true;
        return true;
      }
    } else {
      var curBg = el.style.backgroundImage || "";
      /* 只有「同一张图 + 仍是 important 内联」才跳过；普通内联会被样式表规则覆盖 */
      if (curBg && curBg.indexOf(val) >= 0 && el.style.getPropertyPriority("background-image") === "important") {
        slot._applied = true;
        return true;
      }
    }
  } catch (eEq) {}
  try {
    localStorage.setItem(slot.lsKey, val);
  } catch (e0) {}
  try {
    if (window.akiniStore && window.akiniStore.memorySet) window.akiniStore.memorySet(slot.lsKey, val);
  } catch (e1) {}
  if (slot.mode === "src") {
    el.src = val;
  } else {
    el.style.setProperty("background-image", 'url("' + val + '")', "important");
    el.style.setProperty("background-size", "cover", "important");
    el.style.setProperty("background-position", "center", "important");
    el.style.setProperty("background-repeat", "no-repeat", "important");
  }
  slot._applied = true;
  return true;
}

function __akiniS1RestoreSlot(slot) {
  if (slot._applied) {
    var _elChk = document.getElementById(slot.elId);
    var _stillOk = false;
    if (_elChk) {
      if (slot.mode === "src") {
        var _cs = _elChk.getAttribute("src") || _elChk.src || "";
        _stillOk = !!_cs && _cs.length >= 100;
      } else {
        _stillOk =
          !!(String(_elChk.style.backgroundImage || "").replace(/\s/g, "").length > 12) &&
          _elChk.style.getPropertyPriority("background-image") === "important";
      }
    }
    if (_stillOk) return;
    slot._applied = false;
  }
  /* ① localStorage（拦截层会优先返回内存镜像） */
  var v = null;
  try {
    v = localStorage.getItem(slot.lsKey);
  } catch (e0) {}
  if (__akiniS1ApplyImg(slot, v)) return;
  /* ② 内存镜像 */
  try {
    if (window.akiniStore && window.akiniStore.memoryGet) {
      var m = window.akiniStore.memoryGet(slot.lsKey);
      if (__akiniS1ApplyImg(slot, m)) return;
    }
  } catch (e1) {}
  /* ③ IndexedDB 主键 + 备份键（异步，拿不到时继续尝试别名键） */
  var IDB = window._idbStore;
  if (!IDB || !IDB.get) return;
  var keys = [slot.lsKey].concat(slot.altKeys || []);
  var ki = 0;
  (function nextKey() {
    if (ki >= keys.length) return;
    var k = keys[ki++];
    try {
      IDB.get(k, function (dv) {
        if (__akiniS1ApplyImg(slot, dv)) return;
        nextKey();
      });
    } catch (e2) {
      nextKey();
    }
  })();
  /* 顺带用 akiniStore.get（内部同样查 IDB，作为另一条兜底链路） */
  try {
    if (window.akiniStore && window.akiniStore.get) {
      window.akiniStore.get(slot.lsKey, function (sv) {
        if (__akiniS1ValidImg(sv)) __akiniS1ApplyImg(slot, sv);
      });
    }
  } catch (e4) {}
}

var __akiniS1ImgSlots = [
  { lsKey: "akini_s1_cover", elId: "s1CoverBg", mode: "bg", altKeys: ["akini_s1_cover_bg"] },
  { lsKey: "akini_s1_photo", elId: "s1PolaroidImg", mode: "bg", altKeys: ["akini_s1_polaroid_img"] },
  { lsKey: "akini_my_avatar", elId: "s1AvatarImg", mode: "src", altKeys: ["akini_s1_avatar", "akini_icity_my_avatar"] },
];

window.__akiniS1HardRestore = function () {
  try {
    __akiniS1ImgSlots.forEach(__akiniS1RestoreSlot);
  } catch (e) {}
};
window.__akiniS1HardRestore();
document.addEventListener("DOMContentLoaded", function () {
  window.__akiniS1HardRestore();
});
/* 首屏之后数据才从 IDB 回填，必须补渲染（只兜底不覆盖，有值即跳过）。
   原来 5 个定时器 + 4 个事件并发触发，每次都把大图重新塞进 DOM 让 Safari 重新解码；
   现在合并节流：短窗口内只执行一次，定时器也减到 2 个递进补刷。 */
var __akiniS1LastRun = 0,
  __akiniS1Timer = null;
function __akiniS1Throttled(minGap) {
  var now = Date.now();
  if (now - __akiniS1LastRun < minGap) {
    if (__akiniS1Timer) return;
    __akiniS1Timer = setTimeout(function () {
      __akiniS1Timer = null;
      __akiniS1LastRun = Date.now();
      try {
        window.__akiniS1HardRestore();
      } catch (e) {}
    }, minGap - (now - __akiniS1LastRun));
    return;
  }
  __akiniS1LastRun = now;
  try {
    window.__akiniS1HardRestore();
  } catch (e) {}
}
[1500, 6000].forEach(function (ms) {
  setTimeout(function () {
    __akiniS1Throttled(0);
  }, ms);
});
["akini-storage-restored", "akini-img-ready", "load", "pageshow"].forEach(function (evt) {
  window.addEventListener(evt, function () {
    __akiniS1Throttled(800);
  });
});
window.__akiniOnVisible(function () { 
    try {
      window.__akiniS1HardRestore();
    } catch (e) {}
   });
