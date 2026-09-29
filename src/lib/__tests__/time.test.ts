import { formatClock, isoWeek, startOfWeek, subtractBlocks, toISODate } from '../time';

describe('time helpers', () => {
  it('formats clock times', () => {
    expect(formatClock(0)).toBe('12:00 AM');
    expect(formatClock(7 * 60)).toBe('7:00 AM');
    expect(formatClock(12 * 60 + 10)).toBe('12:10 PM');
    expect(formatClock(22 * 60 + 30)).toBe('10:30 PM');
    expect(formatClock(24 * 60 + 15)).toBe('12:15 AM');
  });

  it('subtracts busy blocks from a window', () => {
    const free = subtractBlocks({ start: 420, end: 1350 }, [
      { start: 545, end: 1195 },
      { start: 1200, end: 1260 },
    ]);
    expect(free).toEqual([
      { start: 420, end: 545 },
      { start: 1195, end: 1200 },
      { start: 1260, end: 1350 },
    ]);
  });

  it('finds Monday and the ISO week', () => {
    const tuesday = new Date(2026, 8, 29);
    expect(toISODate(startOfWeek(tuesday))).toBe('2026-09-28');
    expect(isoWeek(tuesday)).toEqual({ year: 2026, week: 40 });
    expect(toISODate(startOfWeek(new Date(2026, 9, 4)))).toBe('2026-09-28');
  });
});
