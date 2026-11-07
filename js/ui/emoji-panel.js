/* 表情包面板开关与输入区交互 */

function hideEmojiPanel() {
  var e = document.getElementById("emojiPanel");
  e && ((e.style.display = "none"), (e.style.visibility = "hidden"), (e.style.pointerEvents = "none"));
}
