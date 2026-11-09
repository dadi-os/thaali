import { useEffect, useState } from "react";

/**
 * `value` while it is present, and for `ms` after it goes null the last value it had, then null. A view driven by something that
 * blinks off and on (a task between two states, a poll that missed) keeps drawing instead of unmounting and remounting.
 */
export function useLingering<Value>(value: Value | null, ms: number): Value | null {
  const [held, setHeld] = useState<Value | null>(value);
  useEffect(() => {
    if (value !== null) {
      setHeld(value);
      return undefined;
    }
    const timer = window.setTimeout(() => setHeld(null), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return value ?? held;
}
