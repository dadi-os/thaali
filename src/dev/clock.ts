/**
 * Dev only: `?clock=HH:MM` on a fixtures URL moves the app's clock to that time today (it keeps running from there; `&clockdays=-3` moves it that many days first), so a
 * render can put "now" inside a plan, in a free gap, or late in a busy day whatever time it is for real.
 */
export function installClock(search: string): void {
  const value = new URLSearchParams(search).get("clock");
  if (value === null) {
    return;
  }
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (match === null) {
    throw new Error(`clock must be HH:MM, got "${value}"`);
  }
  const RealDate = Date;
  const target = new RealDate();
  target.setDate(target.getDate() + Number(new URLSearchParams(search).get("clockdays") ?? 0));
  target.setHours(Number(match[1]), Number(match[2]), 0, 0);
  const offset = target.getTime() - RealDate.now();
  class ShiftedDate extends RealDate {
    constructor(...args: [] | [number | string | Date] | [number, number, number?, number?, number?, number?, number?]) {
      if (args.length === 0) {
        super(RealDate.now() + offset);
      } else {
        super(...(args as [number]));
      }
    }

    static override now(): number {
      return RealDate.now() + offset;
    }
  }
  globalThis.Date = ShiftedDate as DateConstructor;
}
