// Parse a date string as UTC if it doesn't already have timezone info.
// The backend may return created_date without a 'Z' or offset, causing
// new Date() to interpret it as the browser's local timezone — which
// produces wrong times for users outside EST.
export const parseDateUTC = (date) => {
  if (!date) return null;
  const str = String(date);
  // ISO-like datetime without timezone indicator → treat as UTC
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(str) && !/[Zz]|[+-]\d{2}:?\d{2}$/.test(str)) {
    return new Date(str.replace(' ', 'T') + 'Z');
  }
  return new Date(date);
};

export const formatEasternTime = (date) => {
  const d = parseDateUTC(date);
  if (!d || isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export const formatEasternDate = (date) => {
  const d = parseDateUTC(date);
  if (!d || isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
  });
};

export const formatEasternDateTime = (date) => {
  const d = parseDateUTC(date);
  if (!d || isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export const formatEasternDateFull = (date) => {
  const d = parseDateUTC(date);
  if (!d || isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// For date-only fields (YYYY-MM-DD) — parse as local date to avoid timezone day shift
export const formatDateOnly = (date) => {
  if (!date) return '';
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  return new Date(date).toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};