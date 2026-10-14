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

Node.js LTS kurulu (`node -v`, `npm -v` ile dogrulanabilir).

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

### 4. APK olusturma (GitHub Actions — birincil yontem)

Baska bir hesaba ihtiyac yok: APK, bu repo GitHub'a push edildikten sonra
GitHub'in kendi ucretsiz Actions runner'inda deriliyor (Agamia Bulmaca
Koleksiyonu projesindeki ayni yontem, Capacitor yerine `expo prebuild` ile).

1. Repo'yu GitHub'a push edin.
2. GitHub'da repo -> **Actions** sekmesi -> **Build Companion App APK** ->
   **Run workflow**.
3. Build bitince ayni run sayfasinin **Artifacts** bolumunden
   `video-remote-control-companion-debug-apk` dosyasini indirin, icinden
   cikan `.apk`'yi telefona kurun.

Workflow dosyasi: `.github/workflows/build-companion-apk.yml`. `android/`
klasoru (Flutter projesindeki gibi) gitignore'da — her calistirmada
`expo prebuild` ile sifirdan uretiliyor.

### 5. Alternatif: EAS Build (bulut, ucretsiz Expo hesabi gerekir)

`app.json`'da paket adi, `eas.json`'da `preview` profili (`buildType: apk`)
hazir dursun diye birakildi, ama varsayilan yontem degil. Kullanmak isterseniz:

```bash
cd companion-app
npx eas-cli login       # ucretsiz Expo hesabinla giris (interaktif, bunu siz yapmalisiniz)
npx eas-cli build:configure
npx eas-cli build -p android --profile preview
```

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
