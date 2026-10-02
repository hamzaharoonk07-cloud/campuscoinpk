// Ramadan and Eid mode (brief: "Local context").
//
// The Islamic calendar is lunar, so these Gregorian dates shift about 11 days
// earlier every year and have to be looked up, not computed - there is no
// clean formula the way there is for a fixed-date holiday. Rather than add a
// Hijri-calendar dependency for a handful of banner days a year, the widely
// published Gregorian dates for the years this app is realistically run or
// evaluated in are listed directly, with a few days' grace around each Eid
// since the exact day depends on moon sighting and can move by one.
//
// Not a source of religious authority - a mode the app turns on for a few
// weeks a year, nothing more.

const WINDOWS = [
  // year: [ramadanStart, ramadanEnd, eidFitr, eidAdha] - each a [Y, M(0-based), D] pair.
  { year: 2025, ramadan: [[2025, 2, 1], [2025, 2, 29]], eidFitr: [2025, 2, 30], eidAdha: [2025, 5, 6] },
  { year: 2026, ramadan: [[2026, 1, 18], [2026, 2, 19]], eidFitr: [2026, 2, 20], eidAdha: [2026, 4, 26] },
  { year: 2027, ramadan: [[2027, 1, 8], [2027, 2, 9]], eidFitr: [2027, 2, 10], eidAdha: [2027, 4, 15] },
  { year: 2028, ramadan: [[2028, 0, 28], [2028, 1, 26]], eidFitr: [2028, 1, 27], eidAdha: [2028, 4, 4] },
];

const d = ([y, m, day]) => new Date(y, m, day);
const inRange = (date, [from, to], graceDays = 0) => {
  const start = new Date(d(from));
  start.setDate(start.getDate() - graceDays);
  const end = new Date(d(to));
  end.setDate(end.getDate() + graceDays);
  return date >= start && date <= end;
};

/**
 * Returns { kind: 'ramadan' | 'eid-fitr' | 'eid-adha', label } for the given
 * date, or null the rest of the year. Eid gets a 3-day grace window either
 * side; Ramadan does not, since its own start/end are already the full month.
 */
export function currentIslamicSeason(date = new Date()) {
  for (const w of WINDOWS) {
    if (inRange(date, w.ramadan)) return { kind: 'ramadan', label: 'Ramadan' };
    if (inRange(date, [w.eidFitr, w.eidFitr], 3)) return { kind: 'eid-fitr', label: 'Eid al-Fitr' };
    if (inRange(date, [w.eidAdha, w.eidAdha], 3)) return { kind: 'eid-adha', label: 'Eid al-Adha' };
  }
  return null;
}
