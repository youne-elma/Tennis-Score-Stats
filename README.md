# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

To launch in Expo Go, use `npx expo start --go`.

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Run locally and connect Supabase

Run `npm run web` and choose **Continue offline** to track matches with local storage.

To enable accounts and cloud storage, set these values in a `.env.local` file at the project root using your Supabase project URL and publishable key. Reload the app after setting them.

```dotenv
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_KEY=
```

For an existing Supabase database, run [player-archive.sql](supabase/player-archive.sql) to enable player archiving and preserve historical match references.

### Score matches without a connection

Apply [match-sync.sql](supabase/match-sync.sql) after the match schema, policies, and player archiving script before distributing this build. The migration preserves the order of existing service events and supports writes from earlier app versions.

Sign in once on the device and load your players and matches. You can then create a match with saved players, record and correct serves, and finish the match offline. When you reopen the app, use **Continue with your account** to access those matches. **Saved on this device** means the match is queued for upload. The app retries while open with a connection and a session for the same account.

On the web, open the app in the browser before going offline.

If the match was also edited online, open **Review versions** to choose which score to keep. A new offline match involving a player archived online remains available on the device with its sync status.

### Password recovery

In your Supabase project, open **Authentication → Email Templates → Reset Password** and save [the recovery template](supabase/templates/recovery.html) as the message body. The template displays the one-time code entered on the **Forgot password?** screen.

Configure [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) for delivery to users outside your Supabase project team.

## Coach Chat

For a new Supabase database, run `schema.sql`, `rls.sql`, `player-archive.sql`, `auth-trigger.sql`, `user-roles.sql`, `chat-schema.sql`, and `chat-rls.sql` from `supabase/` in that order.

Open **Coach Chat** with a regular account to start a conversation. An admin can open any conversation and choose **Assign coach**. Each coach receives the conversations assigned to their account.

For an existing database, reapply [chat-rls.sql](supabase/chat-rls.sql). On upgrade it assigns previously unassigned conversations to the last coach who replied, where there is one. The admin can assign the remaining conversations from **Coach Chat**.

From **Match stats**, choose **Share with coach** to post a copy of the score and service statistics in Coach Chat.

Open conversations refresh automatically. To enable immediate delivery, add `chat_messages` to the `supabase_realtime` publication in your Supabase project.

### Coach applications by email

1. Apply [coach-applications.sql](supabase/coach-applications.sql) after the Coach Chat schema and policies. The account reviewing applications needs the `admin` role in `user_roles`.
2. In the Supabase Edge Function secrets, set `RESEND_API_KEY`, `COACH_APPLICATION_FROM` (a sender on your Resend-verified domain), `COACH_APPLICATION_TO` (the admin inbox), `COACH_APPLICATION_REVIEW_URL` (the complete HTTPS URL of `/coach-applications` on the deployed web app), and a random `COACH_APPLICATION_WORKER_SECRET`.
3. In Supabase Vault, save the same worker secret as `coach_application_worker_secret` and the project's HTTPS API URL as `coach_application_project_url`.
4. Deploy the worker with `supabase functions deploy coach-application-email --project-ref YOUR_PROJECT_REF --no-verify-jwt`. The worker checks the shared secret on each call.
5. Apply [coach-applications-schedule.sql](supabase/coach-applications-schedule.sql) to wake the worker on new applications and retry delivery through Supabase Cron. Applications remain available in the admin inbox while email is pending or has failed.
6. Submit a test application from **Coach Chat → Become a coach** with a player account. Open the email link with the admin account, then select **Approve as coach** or **Decline**. An approved account receives the `coach` role. The player can see the decision in **Coach Chat**.

### Mobile notifications for coach replies

1. Apply [coach-push.sql](supabase/coach-push.sql) after the Coach Chat schema and policies.
2. Set a random `COACH_PUSH_WORKER_SECRET` in the Supabase Edge Function secrets. In Supabase Vault, save the same value as `coach_push_worker_secret` and the project's HTTPS API URL as `coach_push_project_url`. If Expo push security is enabled, set `EXPO_ACCESS_TOKEN` in the Edge Function secrets too.
3. Deploy the worker with `supabase functions deploy coach-push --project-ref YOUR_PROJECT_REF --no-verify-jwt`. The worker authenticates requests with `COACH_PUSH_WORKER_SECRET`.
4. Apply [coach-push-schedule.sql](supabase/coach-push-schedule.sql). A database trigger wakes the worker when a reply is queued. Supabase Cron runs it again for retries and push receipts.
5. For Android, configure [FCM v1 credentials in EAS](https://docs.expo.dev/push-notifications/fcm-credentials/). Use a Firebase `google-services.json` for the Android package in `app.json` and provide it as an EAS file environment variable named `GOOGLE_SERVICES_JSON`. For a local build, set the same variable to the file path. For iOS, configure APNs credentials for the app's bundle identifier in EAS.
6. Build Android with `eas build --profile development --platform android` and run Metro with `npx expo start --dev-client`. Open Coach Chat on a physical phone, choose **Enable coach notifications**, close the app and reply from a coach account. Tapping the alert opens that conversation.

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
