# Video Remote Control

Telefonu, tarayicida (Netflix web, YouTube web, herhangi bir HTML5 `<video>`)
izlenen videoyu uzaktan kumanda olarak kontrol etmek icin kullanan sistem.
Faz 1 kapsami: masaustu/tarayici video. Native mobil app kontrolu (Netflix/
YouTube uygulamalari) Faz 2+.

Detayli spec icin orijinal `video-remote-control-spec.md` dosyasina bakin.

## Mimari

```
[Telefon - Companion App]  <--WiFi/WebSocket-->  [Local Server]  <-->  [Browser Extension]  <-->  [<video> elementi]
```

Local server, telefon ve extension arasinda basit bir JSON komut relay'i.
Extension MV3 oldugu icin WebSocket *server*'i degil, *client*'i (background
service worker) calistirir; asil WebSocket sunucusu ayri bir Node process
(`server/`).

## Klasorler

- `extension/` — Chrome extension (Manifest V3)
- `server/` — Local WebSocket relay server (Node.js)
- `companion-app/` — Telefon uygulamasi (React Native / Expo)

## Kurulum ve Calistirma

### 0. On kosul: Node.js

Bu makinede Node.js kurulu degil. Once [nodejs.org](https://nodejs.org) uzerinden
LTS surumunu kurun (`node -v` ile dogrulayin).

### 1. Local server

```bash
cd server
npm install
npm start
```

Konsolda `ws://<LAN-IP>:8787` seklinde adresler yazdirilir — telefon uygulamasinda
bu IP'yi kullanacaksiniz. Bilgisayar ve telefon ayni WiFi agina bagli olmali.

### 2. Browser extension

1. Chrome'da `chrome://extensions` acin.
2. "Developer mode" acin.
3. "Load unpacked" ile `extension/` klasorunu secin.
4. Extension ikonuna tiklayip local server'a baglandigini (yesil nokta) dogrulayin.

### 3. Companion app (telefon)

```bash
cd companion-app
npm install
npx expo start
```

Expo Go uygulamasi ile QR kodu okutup telefonda acin, server IP'sini girip
"Baglan" deyin.

## Komut Protokolu

```json
{ "cmd": "playpause" }
{ "cmd": "setSpeed", "value": 1.5 }
{ "cmd": "seek", "seconds": 10 }
{ "cmd": "next" }
{ "cmd": "toggleSubtitles" }
```

## Bilinen Sinirlamalar (Faz 1)

- MV3 service worker kalici degil; uzun sure etkilesimsiz kalirsa uyuyabilir,
  bir sonraki alarm/mesajda yeniden baglanir (`extension/background.js`).
- Altyazi toggle sadece player native `<track>` kullaniyorsa calisir
  (`video.textTracks`); custom altyazi render eden playerlarda best-effort.
- "Sonraki video" sadece Netflix ve YouTube icin site-ozel secicilerle
  calisir (`extension/site-adapters/`); diger siteler desteklenmiyor.
