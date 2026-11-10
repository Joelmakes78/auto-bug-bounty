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

The website and Android app store programs, eligibility notes, findings, and coding projects locally on the current browser or device. Public-listing search opens an external search engine; it does not crawl targets or verify eligibility. ScopeSafe has no account, app backend, or cross-device synchronization. Identity and payout notes are reminders based on terms you review, not a guarantee of eligibility or payment; never try to bypass a platform's verification requirements.

Coding projects can be organized into tasks. The app can copy or download a project brief to share with a coding assistant.

The optional AI assistant calls Google's Gemini API directly from the browser after the user activates their own API key and submits a message. Submitted messages and the in-memory conversation context are sent to Google; Google’s terms, privacy practices, usage limits, and billing apply. ScopeSafe does not save the key or AI conversation to local storage, and clearing the chat clears both from the current page. Closing or reloading the page also clears them. Do not enter secrets, private source code, or personal data. For cybersecurity, use only authorized, defensive work; the assistant does not scan or act on targets.
