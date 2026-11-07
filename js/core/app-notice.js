function __akiniBindSplashEntry() {
  var t = document.getElementById("openSplashNoticeBtn");
  t &&
    (t.onclick = function (t) {
      (t && t.preventDefault(), window.__akiniOpenSplashNotice());
    });
}
window.__akiniOpenSplashNotice = function () {
  try {
    var t = document.getElementById("akiniSiteNoticeModal");
    t && (t.style.display = "flex");
  } catch (t) {
    console.error(t);
  }
};
window.__akiniCloseSplashNotice = function () {
  try {
    var t = document.getElementById("akiniSiteNoticeModal");
    t && (t.style.display = "none");
  } catch (t) {}
};
"loading" === document.readyState
  ? document.addEventListener("DOMContentLoaded", __akiniBindSplashEntry)
  : __akiniBindSplashEntry();
