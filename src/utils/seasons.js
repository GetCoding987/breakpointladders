// BreakPoint Season Definitions
// Two competitive seasons per year:
// Spring:       March 1 - June 30
// Summer/Fall:  July 1 - October 31
// Off-season:   November 1 - February 28/29 (membership expires at end of next season)

export const SEASONS = [
  { name: 'Spring', startMonth: 2, startDay: 1, endMonth: 5, endDay: 30 },
  { name: 'Summer/Fall', startMonth: 6, startDay: 1, endMonth: 9, endDay: 31 },
];

export function getCurrentSeason(date = new Date()) {
  const month = date.getMonth();
  for (const s of SEASONS) {
    if (month >= s.startMonth && month <= s.endMonth) return s;
  }
  // Off-season (Nov-Feb): next season is Spring
  return SEASONS[0];
}

export function getSeasonExpiryDate(date = new Date()) {
  const month = date.getMonth();
  // Spring season: Mar-Jun → expires June 30
  if (month >= 2 && month <= 5) {
    return new Date(date.getFullYear(), 5, 30);
  }
  // Summer/Fall season: Jul-Oct → expires October 31
  if (month >= 6 && month <= 9) {
    return new Date(date.getFullYear(), 9, 31);
  }
  // Off-season (Nov-Feb): membership expires at end of next Spring season (June 30 next year)
  if (month >= 10) {
    return new Date(date.getFullYear() + 1, 5, 30);
  }
  // Jan-Feb: next Spring season ends June 30 same year
  return new Date(date.getFullYear(), 5, 30);
}

export function getSeasonExpiryString(date = new Date()) {
  return getSeasonExpiryDate(date).toISOString().split('T')[0];
}