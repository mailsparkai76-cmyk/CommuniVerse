# Firebase Notification Setup

This folder contains guidance for configuring Firebase Cloud Messaging (FCM) and pushing notifications.

## What this app now supports

- Registers a Firebase Messaging service worker from `firebase-messaging-sw.js`
- Requests browser notification permission
- Saves the current user's FCM token to their `users/{uid}` document
- Exposes the function `postNotificationToUser(targetUid, title, body)` in `js/notifications.js`
- Stores app notification documents in Firestore under `notifications/{userId}/messages`
- Displays in-app notifications when a new document is added for the signed-in user

## What to do in Firebase Console

1. Open your Firebase project.
2. Go to **Cloud Messaging**.
3. Under **Web configuration** add your Web Push certificates if not already configured.
   - Use the VAPID key pair and paste the public key into `js/notifications.js` at `VAPID_KEY`.
4. Make sure the app's Firebase config in `js/firebase.js` matches your project settings.
5. Confirm that `firebase-messaging-sw.js` exists at the app root and is served by your site.

## Sending a notification from Firebase Console

### Option 1: Notification composer (manual)

1. In Firebase Console, go to **Cloud Messaging** > **Send your first message** or **New notification**.
2. Enter a title and message body.
3. For the target, choose a user segment or topic.
   - To target a specific user, use the FCM token stored in the user's Firestore profile under `users/{uid}.fcmToken`.
4. Send the message.

### Option 2: Use the FCM API

If you want to push notifications programmatically, use the Firebase Admin SDK or FCM HTTP v1 API.

- Send to the token stored in `users/{uid}.fcmToken`.
- For example, from a trusted backend or Cloud Function, send a notification payload to that token.

## Notes

- The app will display a browser notification when the user grants permission.
- The `notificationRequests` and `notifications` collections are useful if you want to add server-side triggers later.
- Keep `firebase-messaging-sw.js` at the root of the project so the service worker can handle background notifications.
