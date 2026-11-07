/* iCity：编辑个人资料时兜底恢复头像预览 */
(function () {
  /* 判断头像是否属于默认/占位（线条头像、空值、类 emoji 短字符） */
  function _icityDef(v) {
    if (!v) return true;
    var s = String(v);
    if (s.indexOf("data:image/svg+xml") >= 0) return true;
    if (window.__akiniIsDefaultAvatarToken && window.__akiniIsDefaultAvatarToken(s)) return true;
    return false;
  }
  document.addEventListener("click", function (ev) {
    var btn = ev.target && ev.target.closest ? ev.target.closest("#icityEditProfileBtn") : null;
    if (!btn) return;
    setTimeout(function () {
      var p = document.getElementById("icityEditMyAvatarPreview");
      if (!p) return;
      var val = "";
      if (window.getMyAvatar) {
        try {
          val = window.getMyAvatar();
        } catch (e) {}
      }
      if (_icityDef(val)) {
        val = (window.__akiniAvatarCache && window.__akiniAvatarCache.my) || "";
      }
      if (_icityDef(val)) {
        val = localStorage.getItem("akini_my_avatar") || localStorage.getItem("akini_icity_my_avatar") || "";
      }
      if (_icityDef(val)) {
        try {
          var home = JSON.parse(localStorage.getItem("akini_home_avatars") || "{}");
          if (home && home.my) val = home.my;
        } catch (e) {}
      }
      if (_icityDef(val)) return;
      var inp = p.querySelector('input[type="file"]');
      if (inp) inp.remove();
      if (val.indexOf("<img") === 0) {
        p.innerHTML = val;
      } else if (val.indexOf("data:") === 0 || val.indexOf("http") === 0) {
        p.innerHTML =
          '<img src="' +
          val.replace(/"/g, "&quot;") +
          '" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">';
      } else {
        p.textContent = val;
      }
      if (inp) p.appendChild(inp);
    }, 60);
  });
})();
