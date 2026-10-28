import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";

/** Seconds a digit takes to roll into place. */
const ROLL_S = 1.1;

/** Seconds between neighbouring digits starting their first roll, left to right. */
const STAGGER_S = 0.07;

/** Long, soft landing, like a mechanical counter coasting to a stop. */
const ROLL_EASE = [0.16, 1, 0.3, 1] as const;

/** The strip a digit rolls along: 0–9 twice, so a first landing spins a full turn before it stops. */
const STRIP = Array.from({ length: 20 }, (_, i) => i % 10);

export type TickerProps = {
  /** The number to show; null while it loads, which spins blurred digits in its place. */
  value: number | null;
  /** How many spinning digits stand in while `value` is null. */
  loadingDigits?: number;
  /** Seconds before the first digit lands, so a row of tickers settles in turn. */
  delay?: number;
  className?: string;
};

type DigitProps = {
  digit: number;
  /** Seconds before this digit's first roll; later changes roll at once. */
  delay: number;
};

/** One digit window: its first value rolls in through a full turn, every later one rolls the short way there. */
function Digit({ digit, delay }: DigitProps) {
  const first = useRef(true);
  useEffect(() => {
    first.current = false;
  }, []);
  return (
    <span className="ticker__slot">
      <motion.span
        className="ticker__strip"
        initial={{ y: "0em" }}
        animate={{ y: `${-(10 + digit)}em` }}
        transition={{ duration: ROLL_S, ease: ROLL_EASE, delay: first.current ? delay : 0 }}
      >
        {STRIP.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </motion.span>
    </span>
  );
}

/**
 * A number in the numeric face as an odometer: while it loads its digits spin in place,
 * when it arrives each digit rolls a full turn and lands left to right, and later changes
 * roll only the digits that moved. Digits are keyed by place value, so a number that
 * gains a digit grows on the left. Reduced motion shows the plain number.
 */
export function Ticker({ value, loadingDigits = 2, delay = 0, className = "" }: TickerProps) {
  const reduced = useReducedMotion() ?? false;
  const face = `inline-flex leading-none tabular-nums ${className}`;

  if (value === null) {
    return (
      <span className={face}>
        <span className="sr-only">Loading</span>
        {Array.from({ length: loadingDigits }, (_, i) => (
          <span key={i} aria-hidden className="ticker__slot">
            <span
              className={`ticker__strip ${reduced ? "" : "ticker__strip--spin"}`}
              style={{ animationDuration: `${0.62 + i * 0.17}s` }}
            >
              {STRIP.map((d, j) => (
                <span key={j}>{d}</span>
              ))}
            </span>
          </span>
        ))}
      </span>
    );
  }

  const text = value.toLocaleString("en-US");
  if (reduced) {
    return <span className={face}>{text}</span>;
  }
  const chars = [...text];
  const digitCount = chars.filter((c) => c >= "0" && c <= "9").length;
  let place = digitCount;
  return (
    <span className={face}>
      <span className="sr-only">{text}</span>
      <span aria-hidden className="inline-flex">
        {chars.map((char) => {
          if (char < "0" || char > "9") {
            return <span key={`sep-${place}`}>{char}</span>;
          }
          place -= 1;
          const order = digitCount - 1 - place;
          return <Digit key={`place-${place}`} digit={Number(char)} delay={delay + order * STAGGER_S} />;
        })}
      </span>
    </span>
  );
}
