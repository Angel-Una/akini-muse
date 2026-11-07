/* 动态星期英文 */

// 动态真实星期英文更新
(function () {
  var weekdaysEn = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  function refreshCalendarWeekday() {
    var d = new Date();
    var el = document.getElementById("calLiveWeekday");
    if (el) {
      el.textContent = weekdaysEn[d.getDay()];
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refreshCalendarWeekday);
  } else {
    refreshCalendarWeekday();
  }
  /* 星期几只会在零点变化，1 秒轮询纯属空转 */
  setInterval(function () {
    if (!document.hidden) refreshCalendarWeekday();
  }, 300000);
})();
