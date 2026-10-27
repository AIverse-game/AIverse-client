/** Seconds as m:ss, rounded up so the clock never shows 0:00 while time is left. */
export function formatDuration(seconds: number): string {
  const whole = Math.ceil(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
