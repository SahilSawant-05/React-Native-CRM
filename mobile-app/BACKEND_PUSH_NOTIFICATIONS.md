# Backend push notifications — implementation spec

> ## ⛔ WHY NOTIFICATIONS DON'T SHOW WHEN THE APP IS CLOSED
>
> When the app is **closed/killed**, no app code runs. Android shows a
> notification **only if the FCM message contains a top-level `notification`
> block**. A **data-only** message (only `.putData(...)`) shows **nothing**
> when the app is closed — it is only handed to the running app, which is
> why it appears when the app is open and never when it's closed.
>
> **THE FIX = add `.setNotification(...)` to your FCM send.** Registering the
> push-token is not enough; the token only says *where* to send. This says
> *what* to send. Minimal working send:
>
> ```java
> FirebaseMessaging.getInstance().send(Message.builder()
>     .setToken(userFcmToken)
>     .setNotification(Notification.builder()      // ← REQUIRED for closed-app
>         .setTitle("New message")
>         .setBody(text)
>         .build())
>     .putData("screen", "chat")                   // optional (tap routing)
>     .setAndroidConfig(AndroidConfig.builder()
>         .setPriority(AndroidConfig.Priority.HIGH)
>         .setNotification(AndroidNotification.builder()
>             .setChannelId("default")             // matches the app's channel
>             .setSound("default")
>             .build())
>         .build())
>     .build());
> ```
>
> **Proof test:** Firebase Console → *Send test message* → paste the device
> token (logged as `[FCM] Device token:` in Metro) → **close the app** → it
> appears. The console sends a `notification` block; your backend must too.

The mobile app is fully push-ready. It registers its FCM device token,
displays notifications in every app state, refreshes tab badges on
arrival, and handles taps. What remains is **server-side**: the Spring
Boot backend must send FCM messages (with a `notification` block) when
events happen.

Until this is implemented, the app falls back to local notifications
generated from its 30-second unread polling — but those only work while
the app is running. Real FCM pushes work when the app is closed.

## 1. Store device tokens

The app already calls this on every login and token rotation:

```
POST /api/users/push-token
Authorization: Bearer <jwt>
{ "token": "<fcm-device-token>", "platform": "android" | "ios", "tokenType": "FCM" }
```

Store per user (upsert on token; one user may have several devices):

```sql
CREATE TABLE user_push_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  token VARCHAR(512) NOT NULL UNIQUE,
  platform VARCHAR(16),
  updated_at TIMESTAMP DEFAULT now()
);
```

## 2. Firebase Admin SDK setup

```xml
<dependency>
  <groupId>com.google.firebase</groupId>
  <artifactId>firebase-admin</artifactId>
  <version>9.3.0</version>
</dependency>
```

Download the service-account JSON: Firebase Console → Project Settings →
Service accounts → Generate new private key. Initialize once at startup:

```java
@PostConstruct
void initFirebase() throws IOException {
  if (FirebaseApp.getApps().isEmpty()) {
    FirebaseApp.initializeApp(FirebaseOptions.builder()
        .setCredentials(GoogleCredentials.fromStream(
            new FileInputStream(firebaseServiceAccountPath)))
        .build());
  }
}
```

## 3. Send helper

```java
public void sendPush(Long userId, String title, String body, Map<String, String> data) {
  for (UserPushToken t : tokenRepo.findByUserId(userId)) {
    try {
      FirebaseMessaging.getInstance().send(Message.builder()
          .setToken(t.getToken())
          // The `notification` block is REQUIRED for the notification to
          // appear when the app is closed/killed — Android's system tray
          // renders it automatically. A data-only message would only be
          // delivered to the running app, so it would silently NOT show
          // when the app is not open.
          .setNotification(Notification.builder().setTitle(title).setBody(body).build())
          .putAllData(data == null ? Map.of() : data)
          .setAndroidConfig(AndroidConfig.builder()
              .setPriority(AndroidConfig.Priority.HIGH)
              // Must match the channel the app creates at startup, or
              // Android 8+ drops the notification when the app is closed.
              .setNotification(AndroidNotification.builder()
                  .setChannelId("default")
                  .setSound("default")
                  .build())
              .build())
          .build());
    } catch (FirebaseMessagingException e) {
      // UNREGISTERED / INVALID_ARGUMENT → token is dead, delete it
      if (e.getMessagingErrorCode() == MessagingErrorCode.UNREGISTERED) {
        tokenRepo.delete(t);
      }
    }
  }
}
```

## 4. Fire it on the three events

Wherever these already happen in the backend, add one call:

**New inbound WhatsApp message** (webhook handler that saves the message):
```java
sendPush(assignedUserId,
    contact.getName(),
    message.getTextBody() != null ? message.getTextBody() : "Sent you a message",
    Map.of("screen", "Chat", "contactId", String.valueOf(contact.getId())));
```

**New lead created** (contact-created service / Facebook lead sync / lead assignment):
```java
sendPush(assignedUserId,
    "New lead: " + contact.getName(),
    contact.getPhone() != null ? contact.getPhone() : "A new lead was assigned to you",
    Map.of("screen", "Contacts", "contactId", String.valueOf(contact.getId())));
```

**New inbound email** (email ingestion handler):
```java
sendPush(ownerUserId,
    emailLog.getFromEmail(),
    emailLog.getSubject() != null ? emailLog.getSubject() : "New email received",
    Map.of("screen", "Mail", "emailId", String.valueOf(emailLog.getId())));
```

The `data.screen` values ("Chat" / "Contacts" / "Mail") are what the
mobile app expects for future tap-to-navigate deep linking.

## 5. Test without backend code

Verify the device pipeline first from Firebase Console → Messaging →
"New campaign" → Notification → send a test message to the FCM token
(log it from the app or read it from the push-token table). If that
notification appears on the phone, the client side is confirmed and any
remaining issue is in the backend sending.
