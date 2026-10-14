// Site adapter: Netflix web player "next episode" button.
// Netflix changes its DOM/data-uia attributes periodically; keep a short
// list of known selectors and try them in order.
(function () {
  if (!location.hostname.includes("netflix.com")) return;

  const NEXT_SELECTORS = [
    '[data-uia="next-episode-seamless-button"]',
    '[data-uia="next-episode-button"]',
    "button.button-nfplayerNext",
  ];

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
