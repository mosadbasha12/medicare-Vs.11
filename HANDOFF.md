# Medicare Project Handoff

Last updated: 2026-05-12

## Current Goal

This Expo/React Native project is being prepared to run as:

- Web app on Netlify
- Android APK distributed outside Google Play
- iPhone test app installed through Sideloadly

The important recent fix was moving shared data away from device-only `AsyncStorage` toward Firebase Firestore, so users, doctors, admin, and the web app can see the same data.

## Project Path

Current local project folder:

```text
C:\Users\moham\Downloads\medicare Vs.12
```

Git remote:

```text
https://github.com/mosadbasha12/medicare-Vs.11.git
```

Main branch:

```text
main
```

## Firebase

Firebase project:

```text
medicare-bae8a
```

Firestore database location:

```text
eur3
```

Web Firebase config currently used:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyA0CsuITaLJX6ujILeedBtEWzvcsDOx_0M
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=medicare-bae8a.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=medicare-bae8a
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=medicare-bae8a.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1022689386382
EXPO_PUBLIC_FIREBASE_APP_ID=1:1022689386382:web:65ef1cebb6818cc5c4cedf
```

These values are public client config, not service-account secrets.

They were added to:

- Local `.env`
- GitHub Actions repository secrets
- Netlify environment variables

Do not commit `.env`; it is ignored.

## Firestore Rules

Current suggested temporary rules are:

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if true;
    }

    match /appointments/{appointmentId} {
      allow read, write: if true;
    }

    match /doctors/{doctorId} {
      allow read: if true;
      allow write: if true;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

These are still not production-secure. They are only a temporary middle step after test mode. A future developer should implement real auth-based rules.

## Admin Account

Admin email:

```text
admin@medicare.com
```

Admin password:

```text
Mm20121011#
```

The password is not stored as plaintext in code. The current hash is:

```text
hashed_l4y4l7_11
```

The admin Firestore document should exist at:

```text
users/admin_001
```

Required fields:

```text
uid: admin_001
name: المسؤول الرئيسي
email: admin@medicare.com
emailLower: admin@medicare.com
password: hashed_l4y4l7_11
level: ذهبي
role: admin
isActive: true
isApproved: true
balance: 0
phone: ""
emailVerified: true
phoneVerified: true
createdAt: 2026-05-12
```

## What Was Changed Recently

Important files changed:

- `src/utils/storage.ts`
  - Added Firebase/Firestore-backed user registration and login.
  - Creates/updates admin document when possible.
  - Removes `undefined` fields before writing users to Firestore.
  - Admin password is stored as hash, not plaintext.

- `src/utils/localDataService.ts`
  - Added Firebase-backed shared data for:
    - users
    - doctors
    - appointments
    - appointment status updates
    - admin user activation/deletion
    - doctor approval/rejection
  - Falls back to AsyncStorage if Firebase config is missing.

- `.github/workflows/android-apk.yml`
  - Builds Android APK through EAS.
  - Reads Firebase values from GitHub repository secrets.

- `.github/workflows/ios-unsigned-ipa.yml`
  - Builds an iOS IPA artifact for Sideloadly testing.
  - Reads Firebase values from GitHub repository secrets.
  - Adds ad-hoc codesign before packaging.

- `netlify.toml`
  - Builds web app for Netlify.
  - Copies redirects and favicon into `dist`.

- `public/_redirects`
  - SPA fallback:
    ```text
    /* /index.html 200
    ```

- `scripts/patch-web-head.cjs`
  - Ensures favicon links are injected into web `index.html`.

- `update.bat`
  - Adds, commits, pushes, then runs EAS Update.

## Hosting

Netlify URL:

```text
https://medicare-26.netlify.app/
```

Netlify must have the Firebase environment variables listed above.

When env vars change, use:

```text
Deploys > Trigger deploy > Deploy project without cache
```

## Builds

GitHub Actions workflows:

- `Build Android APK`
- `Build unsigned iOS IPA`
- `Deploy Web App`

Android:

1. Run `Build Android APK`.
2. Download artifact `medicare-apk`.
3. Extract and install `medicare.apk`.

iPhone:

1. Run `Build unsigned iOS IPA`.
2. Download artifact `medicare-ios-unsigned-ipa`.
3. Extract `medicare-unsigned.ipa`.
4. Install with Sideloadly.
5. Enable Developer Mode on iPhone if prompted.

Free iPhone sideloading is not permanent. It may require refresh/reinstall about every 7 days.

## Updates

The project has `expo-updates` configured.

For normal JS-only updates:

```powershell
.\update.bat
```

This does:

1. `git add .`
2. `git commit`
3. `git push`
4. `npx.cmd eas update --branch production --message "..."`

Important: existing installed apps must be built after `expo-updates` and Firebase config were added. Older APK/IPA builds will not receive the current shared-data behavior correctly.

Native changes still require a new APK/IPA, for example:

- New native library
- Permission changes
- Icon/splash changes
- Firebase config first-time native build
- Package/bundle identifier changes

## Current Status

Web:

- Netlify is deployed.
- Firebase config was added to Netlify.
- Admin login was fixed after creating `users/admin_001`.
- User registration had an `undefined` Firestore payload bug; fixed by filtering undefined values.

Android:

- A new APK build should be generated from GitHub Actions after the Firebase fixes.
- Users must install that new APK to be connected to Firestore.

iPhone:

- A new IPA should be generated from GitHub Actions after the Firebase fixes.
- Install with Sideloadly.

## Known Technical Debt

- Firestore rules are still too open for production.
- Password handling is not production-grade. It uses a simple local hash in frontend code.
- Proper Firebase Auth should replace custom password storage.
- Some features still use local storage defaults/fallbacks:
  - results
  - prescriptions
  - prescription orders
  - transactions
  - notifications
  - chat
  - doctor schedules
- The highest priority shared flows are now users/doctors/appointments/admin views.

## Recommended Next Steps

1. Finish testing web registration, login, booking, admin view, and doctor view.
2. Build and install fresh Android APK and iOS IPA.
3. Test the same patient booking from web and verify it appears on Android/iPhone/admin.
4. Move chat and prescriptions to Firestore next.
5. Replace custom auth with Firebase Auth.
6. Harden Firestore rules.
