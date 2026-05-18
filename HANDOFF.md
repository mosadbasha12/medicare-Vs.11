# Medicare Project Handoff

Last updated: 2026-05-18

This file summarizes the current state of the Medicare Expo/React Native project so another developer can continue safely.

## Project

Local project path:

```text
C:\Users\moham\Downloads\medicare Vs.12
```

GitHub repo:

```text
https://github.com/mosadbasha12/medicare-Vs.11.git
```

Branch:

```text
main
```

Production web URL:

```text
https://medicare-26.netlify.app/
```

Tech stack:

- Expo SDK 54
- React Native / React Native Web
- Firebase Auth
- Firestore
- Netlify web hosting
- GitHub Actions for APK / IPA builds
- EAS Update for JS-only app updates

## Recent Commits

```text
fa72538 Limit Google sign in to patients and fix password reset
841f4c7 Fix Google sign in on web
78f4204 Add Google sign in
f2e5dd5 Enable Firebase email verification
102c1f6 Fix Firebase user registration payload
ad68152 Pass Firebase config to native builds
5b10950 Use Firebase for shared users and appointments
```

## Firebase

Firebase project:

```text
medicare-bae8a
```

Firestore location:

```text
eur3
```

Firebase client env values used by the app:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyA0CsuITaLJX6ujILeedBtEWzvcsDOx_0M
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=medicare-bae8a.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=medicare-bae8a
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=medicare-bae8a.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1022689386382
EXPO_PUBLIC_FIREBASE_APP_ID=1:1022689386382:web:65ef1cebb6818cc5c4cedf
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=1022689386382-ept8g808scof7lfo80qmcqhpkrbh8ppb.apps.googleusercontent.com
```

These are public client config values, not service-account secrets.

They should exist in:

- Local `.env`
- Netlify environment variables
- GitHub Actions repository secrets

Do not commit `.env`.

## Firebase Authentication

Enabled providers needed:

- Email/Password
- Google

Authorized domains should include:

```text
medicare-26.netlify.app
```

Current auth behavior:

- Normal patient/doctor registration uses Email/Password.
- Email verification is sent after registration.
- Login blocks unverified non-admin users and sends a new verification email.
- Google login is allowed for patients only.
- Doctors must register using the normal form, fill their professional data, then wait for admin approval.
- Forgot password now uses Firebase `sendPasswordResetEmail`, so users receive a real reset link by email.

## Firestore Rules

Current temporary rules are permissive for the main collections:

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

Important: these rules are not production-secure. A future developer must replace them with authenticated role-based rules.

## Admin Account

Admin email:

```text
admin@medicare.com
```

Admin password:

```text
Mm20121011#
```

Password hash stored in Firestore/code:

```text
hashed_l4y4l7_11
```

Admin Firestore document:

```text
users/admin_001
```

Expected fields:

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

## Main Files Changed

`src/utils/storage.ts`

- Handles Firebase Auth registration/login.
- Sends email verification.
- Sends real password reset emails.
- Handles Google login for patients only.
- Creates/updates user documents in Firestore.
- Initializes the admin document.
- Keeps AsyncStorage as local session/fallback.

`src/screens/LoginScreen.tsx`

- Email/password login.
- Google login button.
- Forgot password flow.
- Blocks inactive/pending/unverified users with Arabic alerts.
- Shows a clear message if a doctor tries Google login.

`src/screens/RegisterScreen.tsx`

- Patient registration.
- Doctor registration.
- Doctor fields currently required:
  - specialty
  - nationalId
  - medicalId
  - clinicLocation
- Doctor accounts are created with `isApproved: false`.
- Admin approval is required before doctor login works.

`src/utils/localDataService.ts`

- Firestore-backed shared data for:
  - users
  - doctors
  - appointments
  - appointment status updates
  - admin user activation/deletion
  - doctor approval/rejection

`netlify.toml`

- Builds the web app for Netlify.
- Copies redirects/favicon assets.

`.github/workflows/android-apk.yml`

- Builds Android APK through GitHub Actions/EAS.

`.github/workflows/ios-unsigned-ipa.yml`

- Builds unsigned/ad-hoc IPA artifact for Sideloadly testing.

`update.bat`

- Adds files, commits, pushes, then runs EAS Update.

## Web Deployment

Netlify project:

```text
medicare-26
```

After any code or env change:

```text
Netlify > Deploys > Trigger deploy > Deploy project without cache
```

If Google login fails:

1. Make sure Google provider is enabled in Firebase Authentication.
2. Make sure `medicare-26.netlify.app` is in Firebase authorized domains.
3. Make sure `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` exists in Netlify env vars.
4. Redeploy without cache.

## Android / iPhone Builds

Android:

1. Run GitHub Action `Build Android APK`.
2. Download artifact.
3. Install the APK.

iPhone:

1. Run GitHub Action `Build unsigned iOS IPA`.
2. Download artifact.
3. Install with Sideloadly.
4. Enable Developer Mode on iPhone.

Free iPhone sideloading may need reinstall/refresh after about 7 days.

## Updates

For JS-only updates:

```powershell
.\update.bat
```

This does:

1. `git add .`
2. `git commit`
3. `git push`
4. `npx.cmd eas update --branch production --message "..."`

Native changes still require a fresh APK/IPA. Examples:

- Adding native libraries
- Permission changes
- App icon/splash changes
- Package/bundle ID changes
- First-time Firebase/native config changes

## Current Completed Behavior

- Web app works on Netlify.
- Firebase env values are connected.
- Admin login works after Firestore admin document exists.
- Patient registration sends email verification.
- Patient login requires verified email.
- Forgot password sends a Firebase reset email.
- Google login works through Firebase popup on web and is intended for patients only.
- Doctor registration requires professional data.
- Doctor accounts wait for admin approval.
- Users/doctors/appointments are shared through Firestore instead of device-only AsyncStorage.

## Not Yet Finished / Important Next Tasks

The latest requested profile changes have not been implemented yet:

- Patient weight should default to `0`.
- User should be able to tap weight and edit it manually.
- Blood type should default to empty.
- User should be able to choose blood type from a dropdown:
  - A+
  - A-
  - B+
  - B-
  - AB+
  - AB-
  - O+
  - O-
- Consultations count should default to `0`.
- Consultations count should increase automatically whenever the patient creates a doctor consultation/appointment.

Recommended implementation locations:

- Add fields to `AppUser` in `src/types/index.ts`:
  - `weight?: number`
  - `bloodType?: string`
  - `consultationsCount?: number`
- Add default values in `saveUserToDB` and Google user creation in `src/utils/storage.ts`.
- Update profile UI in `src/screens/ProfileScreen.tsx`.
- Increment consultation count when appointment/consultation is created in `src/utils/localDataService.ts` or booking flow.

Other technical debt:

- Firestore rules are too open.
- Password hash for admin/custom auth is frontend-side and not production-grade.
- Some app areas may still use AsyncStorage/local defaults:
  - chat
  - notifications
  - prescriptions
  - lab results
  - transactions
  - doctor schedules
- Android/iOS Google sign-in may need extra native client IDs and SHA fingerprints. Web Google login was the main tested path.

## Recommended Next Developer Flow

1. Pull latest `main`.
2. Run:

```powershell
npm install
npx.cmd tsc --noEmit
```

3. Verify `.env` has all Firebase and Google values.
4. Test web login/register/reset/Google login.
5. Implement the profile fields request.
6. Harden Firestore rules.
7. Build fresh APK/IPA after any native-impacting change.
