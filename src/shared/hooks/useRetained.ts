import { useRef } from "react";

/**
 * The last non-null value of `value`, held after it goes null. An overlay whose content comes from the thing
 * that opened it keeps drawing that content while its exit animation plays, instead of emptying as it leaves.
 */
export function useRetained<Value>(value: Value | null): Value | null {
  const held = useRef<Value | null>(value);
  if (value !== null) {
    held.current = value;
  }
  return held.current;
}
