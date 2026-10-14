// Site adapter: YouTube web player "next video" button.
(function () {
  if (!location.hostname.includes("youtube.com")) return;

  const NEXT_SELECTORS = [".ytp-next-button"];

  const previousNextVideo = window.__vrcNextVideo;
  window.__vrcNextVideo = function () {
    for (const selector of NEXT_SELECTORS) {
      const btn = document.querySelector(selector);
      if (btn) {
        btn.click();
        return true;
      }
    }
    return previousNextVideo ? previousNextVideo() : false;
  };
})();
