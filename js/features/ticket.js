/* 票根模块 */

/* 票根模块 JS */
(function () {
  try {
    var saved = JSON.parse(localStorage.getItem("akini_ticket_imgs") || "{}");
    Object.keys(saved).forEach(function (idx) {
      var wrap = document.getElementById("ticketImg" + idx);
      if (wrap && saved[idx]) {
        wrap.innerHTML =
          '<img src="' + saved[idx] + '" style="width:100%;height:100%;object-fit:cover;display:block;" />';
      }
    });
  } catch (e) {}
})();
