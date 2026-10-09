# Goodtime: Product Requirements (v2)

| | |
| --- | --- |
| **Status** | Live at https://react-challenges-6b8a6.web.app |
| **Last updated** | October 5, 2026 |
| **Replaces** | [`when2meet.md`](when2meet.md), the original "Beat When2Meet" spec, kept for history |
| **Code** | `goodtime-firebase-redesign` branch, [PR #1](https://github.com/Austin-liu2028/beat-when2meet/pull/1) |

---

## 1. One-line summary

Goodtime finds a meeting time a whole group can make, tells the organizer which time to pick, and gets the confirmed time onto everyone's calendar, with no accounts and no heatmap reading.

**Create → collect availability → summarize → confirm → notify.**

When2Meet covers the first two steps. Goodtime covers all five.

---

## 2. User pain points

We started from the four problems in the original spec, then added what we learned while building and from testing with friends.

### Organizers

| # | Pain point | What it looks like today |
| --- | --- | --- |
| O1 | **"So when do we meet?"** The tool collects availability but leaves the decision to you. | You squint at a heatmap, compare shades of green, and count names cell by cell. |
| O2 | **No plan B.** When no time works for everyone, you get nothing useful. | You don't know which times come closest, who would miss them, or whether adding dates would help. |
| O3 | **Chasing people.** You can't tell who hasn't answered. | Without an invite list, missing people are invisible, and you write every reminder by hand. |
| O4 | **The loop never closes.** Finding the time isn't the end of the job. | You still have to announce it, put it on everyone's calendar, and answer "wait, what time was it?" in the group chat. |
| O5 | **Events are frozen.** You can't change dates after creating an event. | If nobody overlaps, you start over and ask everyone to fill it in again. |
| O6 | **Time zone confusion.** Remote members aren't sure which zone the hours are in. | People enter times in their own zone, or ask in the chat. |

### Participants

| # | Pain point | What it looks like today |
| --- | --- | --- |
| P1 | **Mobile input is painful.** Dragging across tiny cells on a phone is slow and error-prone. | Missed cells, accidental scrolling, giving up and doing it later. |
| P2 | **No feedback on what you did.** It's hard to tell what you've selected or whether it saved. | People submit twice, or think they submitted and didn't. |
| P3 | **Coming back to edit is awkward.** | You can't remember how you signed in, or overwrite someone else's times. |
| P4 | **Privacy worries.** Contact details shared with a group can end up visible to everyone. | People hesitate to leave an email, so they never hear the final time. |

### Learned while building

- **Sharing is the product.** A scheduler that only works on one device fails the first time a friend opens the link. (Our first prototype stored events in the browser; it had to move to a shared database.)
- **"Live" needs a backstop.** In testing, an organizer's page stopped updating after a real-time connection silently dropped. Users don't notice a stale page; they just think the app is broken.
- **People don't leave emails up front.** The organizer needs a way to add a missing email at the moment of sending.

---

## 3. Users

| Persona | Context | What they need most |
| --- | --- | --- |
| **Student project lead** (primary) | 3–6 classmates, a deadline, everyone's class schedule is different | A clear answer fast, and a way to nudge the one person who hasn't replied |
| **Club or society organizer** | 10–30 members, recurring meetups, mixed commitment | Best-available time when perfect overlap is impossible; a clean announcement |
| **TA or instructor** | Office hours or review sessions for a section | Collect availability without accounts; share one link or code |
| **Participant** (everyone else) | Opens a link on their phone from a group chat | Mark times in under a minute, without signing up |

---

## 4. Goals and non-goals

### Goals
1. The organizer never has to interpret raw availability: the app recommends a time.
2. Every event can end in a confirmed time that's on people's calendars.
3. A participant can respond on a phone in under a minute, without an account.
4. Personal data is limited to what scheduling needs, and emails are seen only by the organizer.

### Non-goals (for now)
- Accounts, passwords or social sign-in.
- Sending email from our servers. Drafts open in the organizer's own mail.
- Reading people's existing calendars to fill in availability.
- Recurring events, paid features, or ads.

### Success metrics (targets to measure, not results)
| Metric | Target |
| --- | --- |
| Time for an organizer to create and share an event | Under 1 minute |
| Time for a participant to submit on a phone | Under 1 minute |
| Events with at least 2 responses that reach "confirmed" | Over 60% |
| Participants who see the confirmed time (calendar add or email) | Over 80% |
| Support questions like "which time zone?" or "did my times save?" | Near zero in user tests |

---

## 5. Core flow

1. **Create.** The organizer enters a title, optional location and note, a date range, earliest and latest times, and a time zone (default Central Time). They can also add invitees, one per row, with optional emails.
2. **Share.** They get a link and a 6-character code (no 0/O or 1/I/L), plus a ready-made reminder message.
3. **Respond.** A participant opens the link, enters a name and optional email, and selects times by tapping, dragging, keyboard, or "Add times without dragging".
4. **Summarize.** Everyone sees the group heatmap. The organizer sees "Best times", ranked, and who has and hasn't responded.
5. **Confirm.** The organizer chooses a time (optionally a shorter slice of a free window) and confirms it.
6. **Notify.** Everyone can add it to Google Calendar or download an .ics file. The organizer opens one personalized email per person in Gmail, Outlook or Apple Mail, or copies it.

---

## 6. Functional requirements

Priority: **P0** must have, **P1** should have, **P2** nice to have. Status reflects the live site.

### 6.1 Home and navigation
| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| H1 | Home shows two clear paths, "I'm organizing" and "I was invited", with joining by code right on the page | P0 | Shipped |
| H2 | Organizers see the events they created, each with a status: "2/4 responded", "Ready to choose" or "Confirmed · date" | P1 | Shipped |
| H3 | Every page offers a way home and to a new event; the event page keeps "Home" at the top | P0 | Shipped |
| H4 | Joining accepts a code in any case or spacing, or a pasted invite link | P0 | Shipped |

### 6.2 Creating and editing an event
| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| C1 | Title (required), location and note (optional) | P0 | Shipped |
| C2 | Two-month date-range picker; no dragging across a long range | P0 | Shipped |
| C3 | Earliest and latest time in 30-minute steps, validated | P0 | Shipped |
| C4 | Time zone picker, default Central Time (Chicago); shown wherever times appear | P1 | Shipped |
| C5 | Invitees one per row, with Enter to add, × to remove, and paste "A, B, C" to split into rows | P1 | Shipped |
| C6 | Optional email per invitee, stored privately (see 7.1) | P1 | Shipped |
| C7 | Organizer can edit everything later, including adding dates; existing responses are kept, and picks outside a narrowed range are hidden, not deleted, with a warning | P0 | Shipped |

### 6.3 Responding
| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| R1 | Grid of 30-minute slots; tap or drag to select or deselect; one week at a time with Earlier/Later | P0 | Shipped |
| R2 | Full keyboard support: arrow keys, Home/End, Page Up/Down, Space | P0 | Shipped |
| R3 | "Add times without dragging": pick a day and range from menus that only offer the event's hours | P0 | Shipped |
| R4 | Selection readout in time, not cells ("2 hr selected across 2 days"), plus an unsaved-changes warning | P1 | Shipped |
| R5 | Re-entering the same name loads and edits your earlier response without losing unsaved picks | P0 | Shipped |
| R6 | Optional email "only the organizer can see", remembered for the same name on the same device | P1 | Shipped |

### 6.4 Group results and decision
| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| G1 | Heatmap with "x/y" counts per slot; the best slots outlined; your own picks marked separately | P0 | Shipped |
| G2 | "Best times": up to 5 options ranked by people free, then length, then earliest. The top option is labelled "Best option" with a reason, and each option lists who can't make it | P0 | Shipped |
| G3 | Recommendations start at 2 responses; times only 1 person can make are never recommended | P1 | Shipped |
| G4 | When no time works for everyone, say so, show the closest options, and offer the organizer "+ Add more dates" | P0 | Shipped |
| G5 | Organizer panel: responded vs waiting on, from the invite list plus anyone who responded | P0 | Shipped |
| G6 | "Copy reminder" message that names who hasn't responded, and switches to an announcement once confirmed | P1 | Shipped |

### 6.5 Confirm and notify
| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| N1 | Organizer confirms an option, optionally narrowing it (e.g. 1 hour of a free afternoon); can reopen scheduling | P0 | Shipped |
| N2 | Confirmed banner for everyone: date, time, time zone, location | P0 | Shipped |
| N3 | "Add to my Google Calendar" and "Download .ics", converted correctly from the event's time zone (DST-safe) | P0 | Shipped |
| N4 | "Email everyone" drafts **one email per person** from an editable template (greeting by name, time, address, organizer's note, event link, sign-off) | P1 | Shipped |
| N5 | Send with Gmail, Outlook (school accounts) or Apple Mail (the default mail app on other devices), or "Copy email" | P1 | Shipped |
| N6 | Recipient list updates live; people without an email are listed so the organizer can add one | P1 | Shipped |

### 6.6 Trust and legal
| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| L1 | Consent banner: essential storage only; Accept = agreeing to Terms and Privacy Policy; honors Global Privacy Control | P1 | Shipped |
| L2 | Privacy Policy written against what the app actually does, covering state privacy laws, CalOPPA, COPPA and breach notice | P1 | Shipped (needs team contact email) |
| L3 | Terms of Use with platform disclaimers and no-affiliation notice | P1 | Shipped (governing law and liability cap to confirm) |

---

## 7. Non-functional requirements

### 7.1 Privacy and security
- Events are readable by anyone with the code or link, since that's how sharing works, but **nobody can list all events**.
- Only the event's organizer can edit it or confirm a time; participants can change only the `responses` field. This is enforced by `firestore.rules`, not just hidden in the UI, and was verified with a second account.
- Emails live in a separate `contacts` subcollection: each person can write only their own, and only the organizer can read them. They never appear in the event that link-holders can read.
- No ads, analytics, tracking cookies, data sales or AI training.

### 7.2 Reliability
- Shared across devices through Firestore; changes appear live.
- Backstop: the page re-reads the event when the tab regains focus and every 30 seconds while visible.
- HTML is served `no-cache` and hashed assets are cached for a year, so a deploy reaches everyone on their next load.

### 7.3 Accessibility
- Keyboard-operable grid with roving focus; visible focus rings on every control.
- Labelled form fields, live regions for save status, and contrast of 4.5:1 or better on text.
- Reduced-motion users get no transitions.

### 7.4 Mobile
- Works from 320 px wide with no horizontal scroll.
- 40 px slot height and 44 px controls on phones.
- Event details collapse to a one-line summary so the grid appears sooner.

### 7.5 Performance
- First load is about 90 KB of gzipped JavaScript. The Firebase SDK loads separately, only when needed.

---

## 8. Architecture (summary)

| Piece | Choice |
| --- | --- |
| Front end | React 19 + TypeScript, Vite, React Compiler |
| Hosting | Firebase Hosting |
| Data | Cloud Firestore (`nam5`): `events/{code}`, `events/{code}/contacts/{uid}:{name}` |
| Identity | Firebase anonymous auth: one stable ID per browser; the creator's ID is the event owner |
| Local mode | Without Firebase config, the same service API runs on localStorage, which tests and dev use |
| Tests | Vitest + Testing Library: 82 tests covering flows, utilities and services |

---

## 9. Selling points

What we'd tell a classmate in one breath:

> **"Goodtime doesn't just show you when people are free. It tells you which time to pick, gets it on everyone's calendar, and lets you email each person, without anyone making an account."**

### The five we lead with

1. **It answers the question.** "Best times" ranks options and explains the top one ("Longest window everyone can make"), so no one has to read a heatmap. *(Pain O1)*
2. **It has a plan B.** When no time works for everyone, you see the closest options and exactly who would miss each one, and can add dates without anyone re-entering their times. *(O2, O5)*
3. **It closes the loop.** Confirm a time, then add it to Google Calendar or any calendar app, and send each person their own email from Gmail, Outlook or Apple Mail. *(O4)*
4. **It shows who's missing and helps you nudge them.** Responded vs. waiting on at a glance, plus a reminder message with their names already in it. *(O3)*
5. **It's private by design.** No accounts and no tracking. Emails are visible only to the organizer, and each email names only its recipient. *(P4)*

### Also
- **Built for phones:** tap, drag, or pick a time range from menus. *(P1)*
- **Time-zone aware:** the event's zone is shown everywhere, and calendar invites convert it. *(O6)*
- **Clear feedback:** "2 hr selected across 2 days", unsaved-change warnings, and confirmation messages. *(P2)*

### Compared with When2Meet

Based on our review of When2Meet's public site.

| | When2Meet | Goodtime |
| --- | --- | --- |
| Group availability heatmap | ✓ | ✓ |
| Recommends the best time | — | ✓ ranked, with reasons |
| Useful alternatives when no one overlaps | — | ✓ closest options + who's missing |
| Track who hasn't responded (invite list) | — | ✓ |
| Change dates after creating | — | ✓ responses kept |
| Confirm a final time | — | ✓ |
| Add to calendar (.ics / Google) | — | ✓ |
| Personal confirmation emails | — | ✓ one per person |
| Mobile input besides dragging | — | ✓ range menus |
| Account needed | No | No |

---

## 10. Risks and open questions

| Risk or question | Impact | Mitigation / next step |
| --- | --- | --- |
| **Organizer = this browser.** Clearing site data or switching devices loses organizer controls | High for real use | P1: optional Google sign-in to link the anonymous account, so organizers can return from any device |
| Anyone with the link sees names and times | Medium | Documented in the Privacy Policy; consider an optional organizer-only results view |
| Free Firebase tier (about 50k reads/day) | Low for class use | Monitor usage; the 30-second refresh runs only while the tab is visible |
| Email delivery depends on the organizer's mail client | Low | Copy-email fallback; a server-sent email would need the paid Blaze plan |
| Legal text is a good-faith draft | Medium | Team contact email; confirm governing law (Illinois) and liability cap |
| No way for users to delete an event in the app | Medium | P1: organizer "Delete event", which also removes contacts |

---

## 11. Roadmap

| Priority | Item |
| --- | --- |
| **P1** | Optional Google sign-in so organizers keep control across devices |
| **P1** | Delete event (organizer), and auto-expire old events |
| **P1** | Required vs. optional attendees, so recommendations weigh required people first |
| **P2** | Calendar import (busy times from Google Calendar) |
| **P2** | Per-viewer time zone display (show the grid in each participant's own zone) |
| **P2** | Recurring meetings and "same time next week" |
