var __akiniGuardSrc = function (el, v) {
  if (el && el.getAttribute) {
    if (el.getAttribute("src") !== v) el.setAttribute("src", v);
  } else if (el) {
    el.src = v;
  }
  return v;
};
var __akiniGuardBg = function (el, v) {
  var s = "url(" + v + ")";
  if (el && el.style && el.style.backgroundImage !== s) el.style.backgroundImage = s;
  return s;
};
var __akiniGuardBgRaw = function (el, v) {
  if (el && el.style && el.style.backgroundImage !== v) el.style.backgroundImage = v;
  return v;
};
var __akiniGuardHtml = function (el, v) {
  if (el && el.innerHTML !== v) el.innerHTML = v;
  return v;
};
function __akiniIsCardBubble(b) {
  try {
    if (!b || !b.classList) return !1;
    var l = b.classList;
    if (
      l.contains("transfer-bubble") ||
      l.contains("shop-card-bubble") ||
      l.contains("survey-bubble") ||
      l.contains("music-invite-bubble") ||
      l.contains("music-end-bubble")
    )
      return !0;
    for (var i = 0; i < l.length; i++) {
      if (/-card-bubble$/.test(l[i])) return !0;
    }
  } catch (e) {}
  return !1;
}
window.__akiniIsCardBubble = __akiniIsCardBubble;
function escapeHtmlSafe(t) {
  return String(t || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function __akiniStripMedia(t) {
  if (null == t) return "";
  if ("string" != typeof t)
    try {
      t = String(t);
    } catch (t) {
      return "";
    }
  return !t || t.indexOf("data:image") < 0 || !window.__akiniMedia
    ? t
    : t.replace(/<img([^>]*?)src="(data:image\/[^"]{8000,})"([^>]*)>/g, function (t, e, n, i) {
        if (e.indexOf("data-preserve-inline") >= 0 || i.indexOf("data-preserve-inline") >= 0) return t;
        var a = window.__akiniMedia.put(n);
        return a ? '<img data-mh="' + a + '"' + e + ' src="' + window.__akiniMedia.PLACEHOLDER + '"' + i + ">" : t;
      });
}
