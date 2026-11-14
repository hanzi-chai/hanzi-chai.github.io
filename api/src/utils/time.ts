export const UnixSecond = 1;
export const UnixMinute = 60 * UnixSecond;
export const UnixHour = 60 * UnixMinute;
export const UnixDay = 24 * UnixHour;

/** 当前时间的 Unix 时间戳 */
export function nowUnix(): number {
  return Math.floor(Date.now() / 1000);
}
