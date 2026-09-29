import { makeEvent } from './events';
import { hm } from './time';
import type { Profile, TimeBlock, WeekEvent } from './types';

const shift = (start: number, end: number): TimeBlock => ({ start, end });

/**
 * Starting point for a full-time athlete: ~50 h of retail/sales shifts,
 * a four-day upper/lower split, weekend clients, and a toddler at home.
 * Everything here is editable from the Profile screen.
 */
export const DEFAULT_PROFILE: Profile = {
  name: 'Athlete',
  sport: 'soccer',
  bodyWeightLb: 175,
  trainingDays: 4,
  availableDays: ['Mon', 'Tue', 'Thu', 'Sat'],
  sessionMinutes: 60,
  wakeTime: hm(7, 0),
  sleepHours: 8,
  chronotype: 'late',
  commuteMinutes: 25,
  work: {
    Mon: shift(hm(9, 30), hm(19, 30)),
    Tue: shift(hm(9, 30), hm(19, 30)),
    Wed: shift(hm(9, 30), hm(19, 30)),
    Thu: shift(hm(9, 30), hm(19, 30)),
    Fri: shift(hm(9, 30), hm(19, 30)),
    Sat: null,
    Sun: null,
  },
  familyBlock: null,
  commitments: [
    {
      id: 'clients-sat',
      day: 'Sat',
      start: hm(8, 0),
      end: hm(11, 0),
      label: 'PT clients',
      kind: 'clients',
    },
  ],
  diet: 'omnivore',
  exclusions: [],
};

export const DEFAULT_EVENT: WeekEvent = makeEvent('midweek-match');
