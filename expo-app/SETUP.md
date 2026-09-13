# Running and building Junior School Analytics (Expo + Firebase)

## 1. Get the code
```
git clone https://github.com/munga068-ctrl/junior-school-analytics.git
cd junior-school-analytics/expo-app
npm install
```

## 2. Connect your Firebase project
In the Firebase console: Project settings > General > Your apps > Add app > Web app.
Copy the config values into `firebaseConfig.js` (replace the YOUR_... placeholders).

Enable these in the Firebase console:
- **Authentication** > Sign-in method > Email/Password > Enable
- **Firestore Database** > Create database (production mode)

Add teacher accounts manually: Authentication > Users > Add user (email + password).
Share those credentials with your staff — there is no self-signup screen by design,
so only accounts you create can access the data.

## 3. Set Firestore security rules
In Firestore > Rules, paste the contents of `firestore.rules` (requires sign-in for all
reads/writes) and click Publish.

## 4. Run it locally to test
```
npx expo start
```
Scan the QR code with the Expo Go app on your Android phone to try it before building.

## 5. Build the APK
Install the EAS CLI once, and log in to your Expo account:
```
npm install -g eas-cli
eas login
eas build:configure
```
This will ask to create a project on expo.dev and will fill in the `extra.eas.projectId`
in `app.json` for you.

Then build:
```
eas build -p android --profile preview
```
This runs in Expo's cloud (needs internet, no local Android Studio required) and gives you
a link to download the finished `.apk` when it completes (usually 10-20 minutes).

To install a local `preview` build profile that produces an APK (not an .aab), make sure
`eas.json` has:
```json
{
  "build": {
    "preview": { "android": { "buildType": "apk" } }
  }
}
```
`eas build:configure` normally sets this up for you — check `eas.json` after running it.

## 6. Install on a device
Download the `.apk` from the link EAS gives you, transfer it to an Android phone, and open
it to install (you may need to allow "install from unknown sources" once).
