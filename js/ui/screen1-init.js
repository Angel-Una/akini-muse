/* 第一屏初始化与防误删标记 */

(function () {
  try {
    var _init = localStorage.getItem("__akini_s1__init");
    if (!_init) {
      /* 防误删：标记键不进 vault，Safari 清 LS 后标记丢失会误触发"首次清理"，
         把 vault/IDB 已恢复的用户文字再删一遍——首页编辑文字"重进总是初始化"元凶之一。
         仅当新旧键全部为空（用户从未编辑过）才执行清理 */
      var _HasUser = false;
      try {
        for (var _ci = 1; _ci <= 5; _ci++) {
          if (localStorage.getItem("akini_s1_custom_text_" + _ci)) {
            _HasUser = true;
            break;
          }
        }
        if (!_HasUser) {
          var _ot = localStorage.getItem("akini_s1_texts");
          if (_ot && _ot !== "{}" && _ot !== "") _HasUser = true;
        }
        if (!_HasUser && localStorage.getItem("akini_s1_polaroid_note")) _HasUser = true;
      } catch (_eC) {}
      if (_HasUser) {
        try {
          localStorage.setItem("__akini_s1__init", "1");
        } catch (_eM) {}
      } else {
        localStorage.removeItem("akini_s1_custom_text_1");
        localStorage.removeItem("akini_s1_custom_text_2");
        localStorage.removeItem("akini_s1_custom_text_3");
        localStorage.removeItem("akini_s1_custom_text_4");
        localStorage.removeItem("akini_s1_custom_text_5");
        localStorage.removeItem("akini_s1_polaroid_note");
        localStorage.removeItem("akini_s1_texts");
        localStorage.setItem("__akini_s1__init", "1");
      }
    }
  } catch (e) {}
})();
