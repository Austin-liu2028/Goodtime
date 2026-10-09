# Goodtime

Goodtime helps groups find a meeting time. An organizer creates an event and shares a link or code; participants mark when they are free; the organizer confirms a time everyone can use.

## What you can do

- Create a poll for a date range, skip days within it, select separate dates, or repeat on chosen weekdays. Set the hours, time zone, location, and optional invitees.
- Join with a link or code. Participants can select times on the grid, add times without dragging, choose a display time zone, and suggest another time.
- See group availability and recommended meeting windows, then confirm a one-time or weekly meeting.
- Share an editable invitation, add the confirmed meeting to Google Calendar or download an `.ics` file, and prepare a personalized email for each recipient.
- Return to events you created or joined. Organizers can edit or delete their events.

Goodtime prepares email drafts for Gmail, Outlook, or the device's default mail app. **It does not send email itself.**

## Run locally

Requires Node.js 24 or later.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. With no Firebase configuration, events are stored in this browser's local storage, so other devices cannot see them.

### Enable shared events with Firebase

1. Create a Firebase project with a web app and a Cloud Firestore database.
2. Enable **Anonymous** sign-in in Firebase Authentication. Enable **Google** sign-in too if you want users to keep access to their events across devices. Add your local and deployed domains to Authentication's authorized domains as needed.
3. Copy `.env.example` to `.env.local` and fill in the `VITE_FIREBASE_*` values from Firebase Console → Project settings → Your apps → Web app.
4. Deploy the included Firestore rules to your Firebase project:

   ```sh
   npx firebase-tools deploy --only firestore:rules --project YOUR_PROJECT_ID
   ```

Then restart the development server. `.env.local` is ignored by Git. The Firebase web configuration is included in the browser build; access to event data is enforced by `firestore.rules` and Firebase Authentication.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and build into `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npx vitest run` | Run all tests once |
| `npm test` | Open the Vitest UI |
| `npm run coverage` | Run tests with coverage |

## Deploy

Set the Firebase environment values before building. Firebase Hosting serves `dist/`, and `firebase.json` rewrites event links to the app:

```sh
npm run build
npx firebase-tools deploy --only hosting,firestore:rules --project YOUR_PROJECT_ID
```

Dated events expire one week after their last selected day; weekly events expire one year after creation. Organizers can also delete an event immediately, including its responses, saved emails, and suggestions.

## Code map

- `src/components/`: pages and interface components
- `src/services/`: event storage, Firebase integration, and local browser fallback
- `src/utilities/`: dates, time zones, availability, email drafts, and calendar files
- `firestore.rules`: access rules for events and private contact data
