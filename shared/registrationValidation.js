export const MIN_DOB_YEAR = 1900;

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

export function getTodayIsoDate(now = new Date()) {
  const year = now.getFullYear();
  const month = padDatePart(now.getMonth() + 1);
  const day = padDatePart(now.getDate());
  return `${year}-${month}-${day}`;
}

export function validateIsoCalendarDate(value = "", { minYear = null } = {}) {
  const trimmed = String(value).trim();
  if (!trimmed) {
    return { isValid: false, reason: "missing" };
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    return { isValid: false, reason: "format" };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (Number.isInteger(minYear) && year < minYear) {
    return { isValid: false, reason: "year_range" };
  }

  const parsedDate = new Date(Date.UTC(year, month - 1, day));
  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    return { isValid: false, reason: "calendar" };
  }

  return {
    isValid: true,
    normalized: `${match[1]}-${match[2]}-${match[3]}`,
    year,
    month,
    day
  };
}

export function validateDateOfBirth(
  value = "",
  { minYear = MIN_DOB_YEAR, todayIsoDate = getTodayIsoDate() } = {}
) {
  const result = validateIsoCalendarDate(value, { minYear });
  if (!result.isValid) {
    return result;
  }

  if (result.normalized > todayIsoDate) {
    return { isValid: false, reason: "future" };
  }

  return result;
}

export function validateVisitDate(
  value = "",
  { todayIsoDate = getTodayIsoDate() } = {}
) {
  const result = validateIsoCalendarDate(value);
  if (!result.isValid) {
    return result;
  }

  if (result.normalized < todayIsoDate) {
    return { isValid: false, reason: "past" };
  }

  return result;
}

export function calculateAgeFromDateOfBirth(value, options) {
  const dob = validateDateOfBirth(value, options);
  if (!dob.isValid) {
    return null;
  }

  const todayIsoDate = String(options?.todayIsoDate || getTodayIsoDate()).trim();
  const [todayYear, todayMonth, todayDay] = todayIsoDate
    .split("-")
    .map((part) => Number(part));

  if (![todayYear, todayMonth, todayDay].every(Number.isInteger)) {
    return null;
  }

  let age = todayYear - dob.year;
  if (
    todayMonth < dob.month ||
    (todayMonth === dob.month && todayDay < dob.day)
  ) {
    age -= 1;
  }

  return age;
}
