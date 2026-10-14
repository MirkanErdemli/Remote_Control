# Video Remote Control — Proje Spec (Faz 1)

## Amaç
Telefonu, video izlerken uzaktan kumanda olarak kullanan bir sistem. Play/pause, hız
ayarı, altyazı/dublaj toggle (player destekliyorsa), sonraki video.

## Karar: Faz 1 kapsamı = Tarayıcı Extension + Local Server + Companion App
Native mobil uygulamalar (Netflix app, YouTube app) sandbox'lı; dışarıdan gerçek kod
erişimi yok. Faz 1'de bu kapsam dışı. Faz 1 sadece **masaüstü/tarayıcıda** izlenen
video (Netflix web, YouTube web, herhangi bir HTML5 `<video>` kullanan site) için
tam işlevsellik hedefliyor.

## Mimari
```
[Telefon - Companion App]  <--WiFi/WebSocket-->  [Local Server]  <-->  [Browser Extension]  <-->  [<video> elementi]
```

- **Browser Extension**: Sayfadaki `<video>` elementine content script ile erişir.
  - `video.pause()` / `video.play()`
  - `video.playbackRate = x`
  - `video.currentTime += n` (ileri/geri sarma)
  - Altyazı: `video.textTracks` üzerinden toggle (player DOM'da native `<track>`
    kullanıyorsa çalışır; custom player'larda garanti değil — best-effort)
  - "Sonraki video": platforma özel DOM seçicisi gerekir (Netflix/YouTube "next"
    butonuna programatik tıklama) — site bazlı ayrı modül olarak yazılacak
- **Local Server**: Extension içinde veya extension'a bağlı, aynı makinede çalışan
  hafif bir WebSocket sunucusu. Telefon ile aynı yerel ağdaki extension arasında
  köprü.
- **Companion App (telefon)**: Basit UI — play/pause, hız slider'ı, ileri/geri,
  sonraki video butonları. Local server'a WebSocket ile bağlanır, komut gönderir.

## Komut Protokolü (taslak, JSON)
```json
{ "cmd": "playpause" }
{ "cmd": "setSpeed", "value": 1.5 }
{ "cmd": "seek", "seconds": 10 }
{ "cmd": "next" }
{ "cmd": "toggleSubtitles" }
```

## Faz 1 Teslimatlar
1. Chrome extension iskeleti (manifest v3, content script, background service worker)
2. Local WebSocket server (extension background'da veya ayrı Node process)
3. Basit companion app (React Native veya Flutter — karar verilecek) tek ekran: 
   bağlantı durumu + kontrol butonları
4. Netflix web + YouTube web için "next video" seçicileri

## Kapsam Dışı (Faz 2+)
- Native mobil app kontrolü (Accessibility Service, kırılgan, ayrı araştırma gerektirir)
- Dublaj oluşturma/ekleme (player'ın kendi dublaj desteğine bağlı, biz üretmiyoruz)
- Korsan indirme sitelerine özel "next video" mantığı (genel HTML5 video desteği
  yeterli olacak, siteye özel seçici Faz 1'de yazılmayacak)

## Notlar
- Proje amaç: GitHub'a açık kaynak, ticari/kötü niyetli kullanım yok.
- Geliştirici: Unity/C# deneyimi var (Scoundrel projesi), web/extension geliştirme
  yeni olabilir — Claude Code başlangıçta temel kavramları (manifest v3, content
  script izolasyonu) kısaca açıklayarak ilerleyebilir.
