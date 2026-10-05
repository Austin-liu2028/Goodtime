import { describe, expect, it } from 'vitest';
import { getTimeZoneName, getTimeZoneOptionLabel } from './timeZones';

describe('time zone names', () => {
  it('uses familiar names for listed zones and the city for others', () => {
    expect(getTimeZoneName('America/Chicago')).toBe('Central Time');
    expect(getTimeZoneName('America/Argentina/Buenos_Aires')).toBe('Buenos Aires time');
    expect(getTimeZoneOptionLabel('Asia/Shanghai')).toBe('China Time — Beijing');
    expect(getTimeZoneOptionLabel('UTC')).toBe('UTC');
  });
});
