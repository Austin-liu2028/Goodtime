# Goodtime

Goodtime helps a group find a meeting time that works. Organizers create an event and share a link or code; participants submit their availability, and the group can confirm a time.

## Requirements

Node.js 24 or later.

## Run locally

```sh
npm install
npm run dev
```

Without Firebase configuration, events are stored in the browser and do not sync across devices. To enable shared events, copy `.env.example` to `.env.local` and fill in the web app values from your Firebase project settings.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build |
| `npm exec vitest -- run` | Run the tests |
| `npm run coverage` | Run tests with coverage |
