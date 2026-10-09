// Time zones an organizer can pick for an event. Every date and time on the event is wall-clock
// time in this zone; calendar exports convert from it.

export const DEFAULT_TIME_ZONE = 'America/Chicago';

interface TimeZoneOption {
  id: string;
  name: string;
  city: string;
}

export const TIME_ZONE_OPTIONS: TimeZoneOption[] = [
  { id: 'America/New_York', name: 'Eastern Time', city: 'New York' },
  { id: 'America/Chicago', name: 'Central Time', city: 'Chicago' },
  { id: 'America/Denver', name: 'Mountain Time', city: 'Denver' },
  { id: 'America/Phoenix', name: 'Arizona Time', city: 'Phoenix' },
  { id: 'America/Los_Angeles', name: 'Pacific Time', city: 'Los Angeles' },
  { id: 'America/Anchorage', name: 'Alaska Time', city: 'Anchorage' },
  { id: 'Pacific/Honolulu', name: 'Hawaii Time', city: 'Honolulu' },
  { id: 'Europe/London', name: 'UK Time', city: 'London' },
  { id: 'Europe/Paris', name: 'Central European Time', city: 'Paris' },
  { id: 'Asia/Kolkata', name: 'India Time', city: 'Kolkata' },
  { id: 'Asia/Shanghai', name: 'China Time', city: 'Beijing' },
  { id: 'Asia/Singapore', name: 'Singapore Time', city: 'Singapore' },
  { id: 'Asia/Seoul', name: 'Korea Time', city: 'Seoul' },
  { id: 'Asia/Tokyo', name: 'Japan Time', city: 'Tokyo' },
  { id: 'Australia/Sydney', name: 'Australian Eastern Time', city: 'Sydney' },
  { id: 'UTC', name: 'UTC', city: '' },
];

// "Central Time" for America/Chicago; zones outside the list read as "Lisbon time".
export const getTimeZoneName = (timeZone: string) =>
  TIME_ZONE_OPTIONS.find(({ id }) => id === timeZone)?.name ??
  `${(timeZone.split('/').pop() ?? timeZone).replace(/_/g, ' ')} time`;

// "Central Time — Chicago", for the picker.
export const getTimeZoneOptionLabel = (timeZone: string) => {
  const option = TIME_ZONE_OPTIONS.find(({ id }) => id === timeZone);
  if (!option) return getTimeZoneName(timeZone);
  return option.city ? `${option.name} — ${option.city}` : option.name;
};

export const isSelectableTimeZone = (timeZone: string) =>
  TIME_ZONE_OPTIONS.some((option) => option.id === timeZone);
