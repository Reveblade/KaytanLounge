import { addDays, addMinutes, istanbulLocalToDate, startOfIstanbulDay, timezoneOffsetMinutes } from './time';

/**
 * Istanbul has been on a fixed +03:00 since 2016, but the conversion is written against
 * the runtime's tz database rather than a hard-coded offset, so these pin the behaviour.
 */
describe('istanbul time', () => {
  it('reads the offset from the tz database', () => {
    expect(timezoneOffsetMinutes(new Date('2026-01-15T12:00:00Z'))).toBe(180);
    expect(timezoneOffsetMinutes(new Date('2026-07-15T12:00:00Z'))).toBe(180);
  });

  it('turns a local departure time into the right instant', () => {
    expect(istanbulLocalToDate('2026-09-14', '09:00').toISOString()).toBe('2026-09-14T06:00:00.000Z');
    expect(istanbulLocalToDate('2026-12-31', '23:30').toISOString()).toBe('2026-12-31T20:30:00.000Z');
  });

  it('finds the start of the local day for an instant late in the evening UTC', () => {
    // 22:30 UTC is already the next calendar day in Istanbul.
    expect(startOfIstanbulDay(new Date('2026-09-14T22:30:00Z')).toISOString()).toBe('2026-09-14T21:00:00.000Z');
  });

  it('adds minutes and days without drifting', () => {
    const base = new Date('2026-09-14T06:00:00Z');
    expect(addMinutes(base, 90).toISOString()).toBe('2026-09-14T07:30:00.000Z');
    expect(addDays(base, 7).toISOString()).toBe('2026-09-21T06:00:00.000Z');
  });
});
