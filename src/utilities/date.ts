// Dates are passed around as local "YYYY-MM-DD" strings so they compare and sort as plain text.

export const twoDigits = (value: number) => value < 10 ? `0${value}` : `${value}`;

export const toDateValue = (date: Date) => {
  const year = date.getFullYear();
  const month = twoDigits(date.getMonth() + 1);
  const day = twoDigits(date.getDate());
  return `${year}-${month}-${day}`;
};

// Noon avoids daylight-saving shifts pushing the date into the previous or next day.
export const parseDateValue = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
};

export const addDays = (dateValue: string, days: number) => {
  const date = parseDateValue(dateValue);
  date.setDate(date.getDate() + days);
  return toDateValue(date);
};

export const daysBetween = (first: string, last: string) =>
  Math.round((parseDateValue(last).getTime() - parseDateValue(first).getTime()) / 86400000);

export const formatDate = (dateValue: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', options).format(parseDateValue(dateValue));

export const startOfMonth = (dateValue: string) => `${dateValue.slice(0, 7)}-01`;

export const addMonths = (monthValue: string, months: number) => {
  const date = parseDateValue(monthValue);
  return toDateValue(new Date(date.getFullYear(), date.getMonth() + months, 1, 12));
};

// Calendar cells for one month, Sunday first; null marks the blanks before the 1st.
export const getMonthDays = (monthValue: string) => {
  const firstDay = parseDateValue(startOfMonth(monthValue));
  const dayCount = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0).getDate();
  const blanks: null[] = Array.from({ length: firstDay.getDay() }, () => null);
  const days = Array.from({ length: dayCount }, (_, index) => addDays(startOfMonth(monthValue), index));
  return [...blanks, ...days];
};
