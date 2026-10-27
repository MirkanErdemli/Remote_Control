// Site adapter: YouTube web player buttons.
// YouTube renders its own captions overlay instead of using the <video>
// element's native textTracks, so toggling subtitles has to click YouTube's
// own CC button rather than touch video.textTracks.
(function () {
  if (!location.hostname.includes("youtube.com")) return;

  const NEXT_SELECTORS = [".ytp-next-button"];
  // Only present/enabled when playing inside a playlist - otherwise this is
  // a no-op, same as "next" is a no-op outside a playlist.
  const PREV_SELECTORS = [".ytp-prev-button"];
  const SUBTITLES_SELECTORS = [".ytp-subtitles-button"];

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

  const previousToggleSubtitles = window.__vrcToggleSubtitles;
  window.__vrcToggleSubtitles = function () {
    return clickFirst(SUBTITLES_SELECTORS) || (previousToggleSubtitles ? previousToggleSubtitles() : false);
  };

  const previousSubtitlesOn = window.__vrcSubtitlesOn;
  window.__vrcSubtitlesOn = function () {
    const btn = document.querySelector(SUBTITLES_SELECTORS[0]);
    if (btn) return btn.getAttribute("aria-pressed") === "true";
    return previousSubtitlesOn ? previousSubtitlesOn() : null;
  };
})();
