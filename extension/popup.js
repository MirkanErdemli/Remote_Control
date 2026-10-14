chrome.runtime.sendMessage({ type: "vrc-get-status" }, (response) => {
  const dot = document.getElementById("dot");
  const label = document.getElementById("label");
  if (response?.connected) {
    dot.classList.add("connected");
    label.textContent = "Local server'a bagli";
  } else {
    label.textContent = "Baglanti yok";
  }
});
