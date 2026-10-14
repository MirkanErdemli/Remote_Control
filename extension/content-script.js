// Content script: receives commands from the background service worker and
// applies them to the page's <video> element. Runs in every frame so it also
// works inside video players loaded in an <iframe>.

function getActiveVideo() {
  const videos = Array.from(document.querySelectorAll("video"));
  if (videos.length === 0) return null;
  // Prefer the biggest visible video (handles pages with hidden/ad videos).
  return videos
    .filter((v) => v.offsetWidth > 0 && v.offsetHeight > 0)
    .sort((a, b) => b.offsetWidth * b.offsetHeight - a.offsetWidth * a.offsetHeight)[0] || videos[0];
}

function toggleSubtitles(video) {
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

  // "next" doesn't need a <video> reference - it's a DOM click on a
  // site-specific button, handled by a site adapter if one matched.
  if (command.cmd === "next") {
    if (window.__vrcNextVideo && window.__vrcNextVideo()) return;
    console.warn("[VRC] No next-video adapter matched this site.");
    return;
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
    case "toggleSubtitles":
      toggleSubtitles(video);
      break;
    default:
      console.warn("[VRC] Unknown command:", command);
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.source === "vrc-background" && msg.command) {
    handleCommand(msg.command);
  }
});
