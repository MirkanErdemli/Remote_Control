// Site adapter: Netflix web player buttons.
// Netflix changes its DOM/data-uia attributes periodically; keep a short
// list of known selectors and try them in order.
(function () {
  if (!location.hostname.includes("netflix.com")) return;

  const NEXT_SELECTORS = [
    '[data-uia="next-episode-seamless-button"]',
    '[data-uia="next-episode-button"]',
    "button.button-nfplayerNext",
  ];
  // Netflix doesn't have a standard "previous episode" control in the
  // player UI the way it has "next" - this is best-effort and will likely
  // be a no-op most of the time.
  const PREV_SELECTORS = [
    '[data-uia="prev-episode-seamless-button"]',
    '[data-uia="prev-episode-button"]',
  ];

  function clickFirst(selectors) {
    for (const selector of selectors) {
      const btn = document.querySelector(selector);
      if (btn) {
        btn.click();
        return true;
      }
    }
    return false;
  }

  const previousNextVideo = window.__vrcNextVideo;
  window.__vrcNextVideo = function () {
    return clickFirst(NEXT_SELECTORS) || (previousNextVideo ? previousNextVideo() : false);
  };

  const previousPrevVideo = window.__vrcPrevVideo;
  window.__vrcPrevVideo = function () {
    return clickFirst(PREV_SELECTORS) || (previousPrevVideo ? previousPrevVideo() : false);
  };
})();
