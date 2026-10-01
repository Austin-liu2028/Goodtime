# Beat When2Meet

## Goal

Build an improved version of When2Meet that makes scheduling easier, faster, and more useful for both organizers and participants.

## Problems With the Current When2Meet

1. When2Meet shows availability, but users still need to manually determine the best meeting time.

2. If there is no time where everyone is available, the organizer does not get a useful alternative suggestion.

3. Organizers cannot easily see who has responded and who still needs to submit availability.

4. Selecting availability on a mobile device can be awkward and inefficient.

## Features

### Event Information

The event creator should be able to enter:

- Event title
- Event description
- Date range
- Time range

### Date Selection

Allow the event creator to choose dates directly using a date input or date picker.

Do not require the user to drag across a calendar to select a very large date range.

Allow users to move through dates using arrows or scrolling.

### Availability Input

Users should be able to enter their availability in multiple ways:

- Click individual time slots
- Click and drag across multiple time slots
- Use text boxes or dropdown menus to enter availability

This should make the application easier to use on mobile devices.

### Best Time Recommendation

The application should automatically identify the best meeting times.

The organizer should not need to manually inspect every time slot.

If no time works for everyone, the application should show the times that work for the largest number of participants.

### Response Tracking

The organizer should be able to see:

- Who has submitted availability
- Who has not submitted availability
- How many people are available at each time

### Group Availability

Each time slot should clearly show how many participants are available.

For example:

3 / 4 available

Time slots with higher availability should be visually easier to identify.

## User Experience

Try to keep the main interaction on a single page.

Users should be able to:

1. Enter their name
2. Select availability
3. Edit availability
4. See group availability
5. See the recommended meeting times

without unnecessary page changes.

## Technology

Use:

- React
- TypeScript
- Firebase