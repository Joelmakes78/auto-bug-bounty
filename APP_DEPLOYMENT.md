# ScopeSafe app deployment

The `Publish ScopeSafe and build Android APK` workflow deploys the app to GitHub Pages and builds an installable Android debug APK whenever changes are pushed to `main`. It can also be started manually from the repository's Actions tab.

## Enable GitHub Pages

In the repository settings, open **Pages** and set the build and deployment source to **GitHub Actions**. After the workflow succeeds:

- App: <https://joelmakes78.github.io/auto-bug-bounty/>
- APK: <https://joelmakes78.github.io/auto-bug-bounty/downloads/ScopeSafe.apk>

The APK is a debug-signed build for direct installation, not a Play Store release.

## Build locally

Install Node.js 22, Java 21, and Android SDK platform/build tools 36, then run:

```sh
npm ci
npx cap sync android
npm run android:build
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.

## Data storage

The website and Android app store workspace data locally on the current browser or device. There is no account, server-side storage, or cross-device synchronization.
