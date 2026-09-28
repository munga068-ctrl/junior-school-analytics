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

## 7. Over-the-air (OTA) updates — no reinstall needed for JS-only changes

The app is wired for **EAS Update**. Once every teacher has the APK from step 6 installed
(this build already includes the `expo-updates` runtime), future **JS-only** changes —
new screens, logic fixes, report layout tweaks, style changes — can be pushed straight to
everyone's phones without a new APK.

**One-time setup (do this once, after pulling the update-enabled app.json/package.json):**
```
npm install
eas build -p android --profile preview
```
Install this build once on every teacher's phone. This is the *last* time you need to
reinstall an APK for a JS-only change.

**From then on, to ship a JS-only change:**
```
eas update --branch preview --message "Describe what changed"
```
The app checks for updates on launch and applies them automatically (a restart of the app
picks up the new version — no app store, no APK, no reinstalling).

**When you DO still need a new APK (not just `eas update`):**
- Adding a new native package (anything with native/platform code)
- Changing `app.json` settings like icon, splash, package name, or permissions
- Upgrading the Expo SDK version

If unsure whether a change needs a rebuild, ask: "does this only touch `.js` files and
plain JSON data, with no new packages in `package.json` that have native code?" — if yes,
`eas update` is enough.

## 8. Automating it with EAS Workflows

Two workflow files live in `.eas/workflows/`:

- **`publish-update.yml`** — runs automatically on every push to `main`. Publishes a
  JS-only OTA update to the `preview` channel, so most changes reach teachers' phones
  without you typing `eas update` yourself.
- **`build-preview.yml`** — manual only (does not run on push, so it never eats into
  your build-minute quota by accident). Trigger it from the EAS dashboard's
  **Run workflow** button, or with `eas workflow:run .eas/workflows/build-preview.yml`,
  whenever a change needs a real rebuild (see the list above).

**One-time setup to make `push`-triggered workflows fire at all:**
1. On the [expo.dev dashboard](https://expo.dev), open this project → **Project settings** → **GitHub**.
2. Connect your GitHub repo and authorize the Expo GitHub App.
3. If asked for a **base directory** (since the Expo app lives in `expo-app/`, not the
   repo root), set it to `expo-app`.

Once connected, every push to `main` will show up under the **Workflows** tab and
auto-publish an update. No connection needed for the manual build workflow — you can run
that anytime from the dashboard regardless of GitHub App status.


<!-- Workflow test: confirming publish-update.yml triggers on push to main. -->

## 9. Admin role & updated Firestore rules

This update adds an admin-only Teachers directory and school-details section.
Two things to do once:

1. **Re-publish Firestore rules.** In the Firebase console, go to Firestore Database
   > Rules, replace the contents with the updated `firestore.rules` from this repo,
   and click Publish.
2. **Nothing else to do for admin setup** — the first person who signs into the app
   after this update automatically becomes the sole admin. From there, an admin can
   manage the Teachers list and school details; everyone else sees those screens
   read-only.

Note: the school logo field takes an **image URL** (a link to an already-hosted
image), not a file upload — there's no in-app upload flow yet.
