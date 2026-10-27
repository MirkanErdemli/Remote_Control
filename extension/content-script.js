// Content script: receives commands from the background service worker and
// applies them to the page's <video> element. Runs in every frame so it also
// works inside video players loaded in an <iframe>.

// video -> { ctx, gainNode }. Lets volume go above 100% by routing audio
// through a Web Audio gain stage once the plain <video>.volume cap (1.0) is
// reached. DRM-protected video (Netflix etc.) can't be routed through Web
// Audio, so boosting is skipped there and volume stays capped at 100%.
const vrcAudioBoost = new WeakMap();

function getActiveVideo() {
  const videos = Array.from(document.querySelectorAll("video"));
  if (videos.length === 0) return null;
  // Prefer the biggest visible video (handles pages with hidden/ad videos).
  return videos
    .filter((v) => v.offsetWidth > 0 && v.offsetHeight > 0)
    .sort((a, b) => b.offsetWidth * b.offsetHeight - a.offsetWidth * a.offsetHeight)[0] || videos[0];
}

function ensureAudioBoost(video) {
  let boost = vrcAudioBoost.get(video);
  if (boost) return boost;
  if (video.mediaKeys) {
    console.warn("[VRC] Volume boost unavailable: DRM-protected video (e.g. Netflix) can't be routed through Web Audio.");
    return null;
  }
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const source = ctx.createMediaElementSource(video);
    const gainNode = ctx.createGain();
    gainNode.gain.value = 1;
    source.connect(gainNode).connect(ctx.destination);
    boost = { ctx, gainNode };
    vrcAudioBoost.set(video, boost);
    return boost;
  } catch (err) {
    console.warn("[VRC] Volume boost unavailable on this video:", err);
    return null;
  }
}

// 0..1 is the native <video>.volume range; 1..2 is Web Audio gain on top of
// that, so the overall range is 0% (0) to 200% (2).
function getVolumeLevel(video) {
  const boost = vrcAudioBoost.get(video);
  return boost ? boost.gainNode.gain.value : video.volume;
}

function setVolumeLevel(video, level) {
  const clamped = Math.min(2, Math.max(0, level));
  if (clamped <= 1) {
    const boost = vrcAudioBoost.get(video);
    if (boost) boost.gainNode.gain.value = 1;
    video.volume = clamped;
    return;
  }
  video.volume = 1;
  const boost = ensureAudioBoost(video);
  if (boost) boost.gainNode.gain.value = clamped;
}

function subtitlesOn(video) {
  if (window.__vrcSubtitlesOn) {
    const result = window.__vrcSubtitlesOn();
    if (result !== null) return result;
  }
  const tracks = video.textTracks;
  if (!tracks || tracks.length === 0) return false;
  return Array.from(tracks).some((t) => t.mode === "showing");
}

function toggleSubtitlesFallback(video) {
  const tracks = video.textTracks;
  if (!tracks || tracks.length === 0) {
    console.warn("[VRC] No native textTracks on this <video> (custom player, best-effort only).");
    return;
  }
  const anyShowing = Array.from(tracks).some((t) => t.mode === "showing");
  for (const track of tracks) {
    track.mode = anyShowing ? "disabled" : "showing";
  }
}

function handleCommand(command) {
  const video = getActiveVideo();

  // These don't need a <video> reference - they're DOM clicks on
  // site-specific buttons, handled by a site adapter if one matched.
  if (command.cmd === "next") {
    if (window.__vrcNextVideo && window.__vrcNextVideo()) return;
    console.warn("[VRC] No next-video adapter matched this site.");
    return;
  }
  if (command.cmd === "prev") {
    if (window.__vrcPrevVideo && window.__vrcPrevVideo()) return;
    console.warn("[VRC] No previous-video adapter matched this site.");
    return;
  }
  if (command.cmd === "toggleSubtitles" && window.__vrcToggleSubtitles) {
    if (window.__vrcToggleSubtitles()) {
      reportStatus();
      return;
    }
    // fall through to the generic textTracks-based fallback below
  }

  if (!video) {
    console.warn("[VRC] No <video> element found on page.");
    return;
  }

  switch (command.cmd) {
    case "playpause":
      if (video.paused) video.play();
      else video.pause();
      break;
    case "setSpeed":
      if (typeof command.value === "number" && command.value > 0) {
        video.playbackRate = command.value;
      }
      break;
    case "seek":
      if (typeof command.seconds === "number") {
        video.currentTime = Math.max(0, video.currentTime + command.seconds);
      }
      break;
    case "volume":
      if (typeof command.delta === "number") {
        setVolumeLevel(video, getVolumeLevel(video) + command.delta);
      }
      break;
    case "toggleSubtitles":
      toggleSubtitlesFallback(video);
      break;
    default:
      console.warn("[VRC] Unknown command:", command);
  }

  reportStatus();
}

// Pushes the current video state back to the phone (through the background
// worker and relay server) so the companion app can show real numbers
// (volume %, speed) instead of guessing from the deltas it sent.
function reportStatus() {
  const video = getActiveVideo();
  if (!video) return;
  chrome.runtime.sendMessage({
    source: "vrc-content",
    hasVideo: true,
    status: {
      volume: getVolumeLevel(video),
      speed: video.playbackRate,
      paused: video.paused,
      subtitlesOn: subtitlesOn(video),
    },
  });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.source === "vrc-background" && msg.command) {
    handleCommand(msg.command);
  }
});

// Announce this tab + push an initial status as soon as a video shows up, and
// periodically after that so the remote stays in sync even when the user
// changes something directly on the page (e.g. drags the native volume
// slider) instead of through the phone.
setInterval(() => {
  if (getActiveVideo()) reportStatus();
}, 2000);
