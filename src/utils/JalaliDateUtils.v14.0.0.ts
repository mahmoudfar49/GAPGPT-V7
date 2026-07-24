// ============================================================
// FILE: src/utils/JalaliDateUtils.v14.0.0.ts
// VERSION: v14.0.0
// COMMIT: 14 (Market Data Foundation)
// STATUS: Draft 🟡
// NOTE: Zero external dependencies. Pure algorithmic conversion.
// ============================================================

/**
 * Converts a Jalali date string (e.g., "1403/10/15" or "1403-10-15") 
 * and optional time (e.g., "12:30:00") to UTC Epoch Milliseconds.
 */
export function jalaliToUtcMs(jalaliDate: string, time?: string): number {
  const normalizedDate = jalaliDate.replace(/\//g, '-');
  const [jy, jm, jd] = normalizedDate.split('-').map(Number);
  
  if (!jy || !jm || !jd) return Date.now();

  const gy = jalaliToGregorianYear(jy, jm, jd);
  const gm = jalaliToGregorianMonth(jy, jm, jd);
  const gd = jalaliToGregorianDay(jy, jm, jd);

  let utcString = `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
  if (time) {
    utcString += `T${time}:00.000Z`;
  } else {
    utcString += `T00:00:00.000Z`;
  }

  return new Date(utcString).getTime();
}

function jalaliToGregorianYear(jy: number, jm: number, jd: number): number {
  const gy = jy + 621;
  return jm < 10 ? gy : gy + 1; 
}

function jalaliToGregorianMonth(jy: number, jm: number, jd: number): number {
  const dayOfYear = (jm - 1) * 31 + jd;
  const gMonth = Math.ceil((dayOfYear + 79) / 30.44); 
  return gMonth > 12 ? 12 : gMonth;
}

function jalaliToGregorianDay(jy: number, jm: number, jd: number): number {
  return jd; 
}
