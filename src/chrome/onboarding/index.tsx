/**
 * First run and the way back to dadi, as on the phone: the field with દાદી resolving on it,
 * then a glass card to paste (or scan) the setup code; the wordmark breathing while this
 * computer joins; one tap to join when provisioned and off; and a glass Can't reach dadi
 * card with the real error, Try again and Forget this device.
 *
 * One wordmark lives through every stage. It is laid out once at its largest size and each
 * stage holds an invisible slot of the size it should show there; the mark glides to the
 * slot's center and scales with a transform, so it never re-lays out or truncates mid-move.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { decodeProvisioningBundle, saveCredentials, type Credentials } from "../../shared/api/credentials";
import { transport } from "../../shared/api";
import { isTauriRuntime } from "../../shared/api/runtime";
import { useConnection } from "../../shared/hooks/useConnection";
import { FieldBloom } from "../../shared/components/FieldBloom";
import { Wordmark } from "../../shared/components/Wordmark";
import { IconCamera, IconPower, IconRetry } from "../../shared/components/IconButton";
import { EASE, SLOWER_S } from "../../shared/lib/ux/motion";
import { dispatchDesktopShell } from "../../store/desktopShell";
import { QrScanner } from "../QrScanner";
import { useNeedsProvisioning } from "../useNeedsProvisioning";
import { failureMessage, onboardingStage, type BootState, type OnboardingStage } from "./stage";

export type { BootState } from "./stage";

/** The size the wordmark is laid out at; every stage scales it down from here. */
const MARK_SIZE = 112;

/** How big the wordmark shows in each stage. */
const SLOT_SIZE: Record<OnboardingStage, number> = {
  starting: 96,
  intro: MARK_SIZE,
  paste: 72,
  scan: 44,
  connecting: 96,
  ready: 96,
  failed: 56,
};

/** How long the wordmark resolves alone before the paste card comes in. */
const INTRO_MS = 1_500;

/** The wordmark gliding between stages: a smooth, unbouncy spring. */
const GLIDE = { type: "spring", bounce: 0, duration: 0.7 } as const;

/** A card arriving a beat after the stage changes, and leaving quicker. */
const CARD = {
  initial: { opacity: 0, scale: 0.94 },
  animate: { opacity: 1, scale: 1, transition: { type: "spring", bounce: 0, duration: SLOWER_S, delay: 0.15 } },
  exit: { opacity: 0, scale: 0.94, y: 24, transition: { duration: 0.4, ease: EASE } },
} as const;

/** Content on the bare field: it only fades. */
const FIELD = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: SLOWER_S, ease: EASE, delay: 0.1 } },
  exit: { opacity: 0, transition: { duration: 0.25, ease: EASE } },
} as const;

/** Where the wordmark's center goes and how far it is scaled. */
type Placement = { x: number; y: number; scale: number };

export interface OnboardingProps {
  /** Launch's read of the saved setup code. */
  boot: BootState;
  /** Read the saved setup code again after it failed. */
  onRetryBoot: () => void;
}

/** Mesh join surface used with a new setup code. */
type MeshJoinTransport = {
  connect(override?: Credentials): Promise<void>;
};

function asMeshJoin(t: unknown): MeshJoinTransport | null {
  if (t && typeof t === "object" && "connect" in t && typeof (t as MeshJoinTransport).connect === "function") {
    return t as MeshJoinTransport;
  }
  return null;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Full-window onboarding over the shell (desktop only), on the field bloom. */
export function Onboarding({ boot, onRetryBoot }: OnboardingProps) {
  const needsProvisioning = useNeedsProvisioning();
  const { state, connect } = useConnection();
  const reduce = useReducedMotion() ?? false;
  const [setupView, setSetupView] = useState<"intro" | "paste" | "scan">("intro");
  const [code, setCode] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const stage = onboardingStage({
    boot,
    needsProvisioning,
    connection: state,
    setupView,
    joining,
    connecting,
    failure,
  });
  const failed = failureMessage({ boot, failure });

  useEffect(() => {
    if (needsProvisioning) {
      setSetupView("intro");
      setFailure(null);
    }
  }, [needsProvisioning]);

  useEffect(() => {
    if (stage !== "intro") {
      return;
    }
    const timer = window.setTimeout(() => setSetupView("paste"), reduce ? INTRO_MS / 3 : INTRO_MS);
    return () => window.clearTimeout(timer);
  }, [stage, reduce]);

  const joinWithCode = useCallback(async (raw: string) => {
    setSetupError(null);
    let credentials: Credentials;
    try {
      credentials = decodeProvisioningBundle(raw);
    } catch (err) {
      setCode(raw);
      setSetupView("paste");
      setSetupError(messageOf(err));
      return;
    }
    setJoining(true);
    try {
      const api = asMeshJoin(transport);
      if (!api) {
        throw new Error("Joining dadi needs the desktop app.");
      }
      await api.connect(credentials);
      await saveCredentials(credentials);
      setCode("");
    } catch (err) {
      setCode(raw);
      setSetupView("paste");
      setSetupError(messageOf(err));
    } finally {
      setJoining(false);
    }
  }, []);

  const acceptingCode = stage === "intro" || stage === "paste" || stage === "scan";

  useEffect(() => {
    if (!acceptingCode) {
      return;
    }
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target;
      if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
        return;
      }
      e.preventDefault();
      void readClipboardText(e).then(
        (text) => {
          if (!text) {
            return;
          }
          setCode(text);
          return joinWithCode(text);
        },
        (err: unknown) => {
          setSetupView("paste");
          setSetupError(messageOf(err));
        },
      );
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [acceptingCode, joinWithCode]);

  const onConnect = async () => {
    setFailure(null);
    setConnecting(true);
    try {
      await connect();
    } catch (err) {
      setFailure(messageOf(err));
    } finally {
      setConnecting(false);
    }
  };

  const onTryAgain = () => {
    if (boot.status === "failed") {
      onRetryBoot();
      return;
    }
    void onConnect();
  };

  const onForget = () => {
    dispatchDesktopShell({ type: "forget_device" });
  };

  const onScanDecode = useCallback(
    (text: string) => {
      void joinWithCode(text);
    },
    [joinWithCode],
  );

  const { rootRef, slotRef, placement, onScroll } = useWordmarkSlots(stage);
  const breathing = stage === "starting" || stage === "connecting";

  return (
    <motion.div
      ref={rootRef}
      className="absolute inset-0 z-50 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: SLOWER_S, ease: EASE } }}
      transition={{ duration: SLOWER_S, ease: EASE }}
      onScrollCapture={onScroll}
      role="dialog"
      aria-modal="true"
      aria-label="Connect to dadi"
    >
      <FieldBloom />

      <AnimatePresence initial={false}>
        {stage === "starting" || stage === "intro" ? (
          <Stage key={stage} motionProps={FIELD}>
            <Slot size={SLOT_SIZE[stage]} slotRef={slotRef(stage)} />
          </Stage>
        ) : null}

        {stage === "connecting" ? (
          <Stage key="connecting" motionProps={FIELD}>
            <div className="flex flex-col items-center gap-7 text-center">
              <Slot size={SLOT_SIZE.connecting} slotRef={slotRef("connecting")} />
              <div className="flex flex-col items-center gap-2.5">
                <h1 className="m-0 text-[20px] font-semibold text-ink">Connecting to dadi</h1>
                <p className="m-0 max-w-[22rem] text-[14px] leading-relaxed text-ink-muted">
                  {joining
                    ? "Joining with your new setup code. The first time, your computer may ask for your password."
                    : "Joining this computer to dadi. The first time, your computer may ask for your password."}
                </p>
              </div>
            </div>
          </Stage>
        ) : null}

        {stage === "ready" ? (
          <Stage key="ready" motionProps={FIELD}>
            <div className="flex flex-col items-center gap-7 text-center">
              <Slot size={SLOT_SIZE.ready} slotRef={slotRef("ready")} />
              <div className="flex flex-col items-center gap-2.5">
                <h1 className="m-0 text-[20px] font-semibold text-ink">Connect to dadi</h1>
                <p className="m-0 max-w-[22rem] text-[14px] leading-relaxed text-ink-muted">
                  Joins this computer to dadi, so this app, your browser and Terminal can all reach it.
                </p>
              </div>
              <button
                type="button"
                autoFocus
                className="glass-button glass-button--prominent min-w-[9rem]"
                onClick={() => {
                  void onConnect();
                }}
              >
                <span className="size-4 [&_svg]:size-full">
                  <IconPower />
                </span>
                Connect
              </button>
            </div>
            <QuietForget onForget={onForget} />
          </Stage>
        ) : null}

        {stage === "failed" ? (
          <Stage key="failed" motionProps={CARD}>
            <div className="flex w-full flex-col items-center gap-6">
              <Slot size={SLOT_SIZE.failed} slotRef={slotRef("failed")} />
              <div className="glass-card flex w-full max-w-[29rem] flex-col items-center gap-4 px-8 py-8 text-center">
                <IconUnreachable />
                <h1 className="m-0 text-[21px] font-semibold text-ink">Can't reach dadi</h1>
                <p className="m-0 select-text text-[14px] leading-relaxed break-words text-ink-muted">{failed}</p>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                  <button type="button" className="glass-button glass-button--danger" onClick={onForget}>
                    Forget this device
                  </button>
                  <button type="button" autoFocus className="glass-button glass-button--prominent" onClick={onTryAgain}>
                    <IconRetry />
                    Try again
                  </button>
                </div>
              </div>
            </div>
          </Stage>
        ) : null}

        {stage === "paste" ? (
          <Stage key="paste" motionProps={CARD}>
            <PasteCard
              code={code}
              error={setupError}
              slot={<Slot size={SLOT_SIZE.paste} slotRef={slotRef("paste")} />}
              onCode={setCode}
              onJoin={() => {
                void joinWithCode(code);
              }}
              onScan={() => {
                setSetupError(null);
                setSetupView("scan");
              }}
            />
          </Stage>
        ) : null}

        {stage === "scan" ? (
          <Stage key="scan" motionProps={CARD}>
            <div className="glass-card flex w-full max-w-[30rem] flex-col items-center gap-5 px-8 py-7 text-center">
              <Slot size={SLOT_SIZE.scan} slotRef={slotRef("scan")} />
              <h1 className="m-0 text-[19px] font-semibold text-ink">Scan the code on your box</h1>
              <div className="w-[min(18rem,100%)]">
                <QrScanner onDecode={onScanDecode} />
              </div>
              {setupError ? <Problem text={setupError} /> : null}
              <button
                type="button"
                className="glass-button"
                onClick={() => {
                  setSetupError(null);
                  setSetupView("paste");
                }}
              >
                Paste a setup code
              </button>
            </div>
          </Stage>
        ) : null}
      </AnimatePresence>

      <motion.div
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 z-10"
        initial={false}
        animate={placement ? { x: placement.x, y: placement.y, opacity: 1 } : { opacity: 0 }}
        transition={placement?.instant || reduce ? { duration: 0 } : GLIDE}
      >
        <div style={{ transform: "translate(-50%, -50%)" }}>
          <motion.div
            initial={false}
            animate={{ scale: placement?.scale ?? 1 }}
            transition={placement?.instant || reduce ? { duration: 0 } : GLIDE}
          >
            <Wordmark size={MARK_SIZE} resolve breathe={breathing} className="text-sage-deep" />
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}

type StageProps = {
  motionProps: typeof CARD | typeof FIELD;
  children: ReactNode;
};

/** One stage's content, stacked over the others while they cross, scrolling when the window is short. */
function Stage({ motionProps, children }: StageProps) {
  return (
    <motion.div className="absolute inset-0 overflow-y-auto" {...motionProps}>
      <div className="relative flex min-h-full flex-col items-center justify-center px-6 py-12">{children}</div>
    </motion.div>
  );
}

type SlotProps = {
  /** The size the wordmark shows at here. */
  size: number;
  slotRef: (el: HTMLSpanElement) => () => void;
};

/** An invisible દાદી of the size the wordmark shows at in a stage, marking where it goes. */
function Slot({ size, slotRef }: SlotProps) {
  return (
    <span
      ref={slotRef}
      aria-hidden
      className="invisible inline-block shrink-0 whitespace-nowrap font-gujarati font-medium leading-none"
      style={{ fontSize: size }}
    >
      દાદી
    </span>
  );
}

type PasteCardProps = {
  code: string;
  error: string | null;
  /** The wordmark's slot at the top of the card. */
  slot: ReactNode;
  onCode: (code: string) => void;
  onJoin: () => void;
  onScan: () => void;
};

/** The glass paste card: the wordmark, Join dadi, the dashed setup-code field and Join. */
function PasteCard({ code, error, slot, onCode, onJoin, onScan }: PasteCardProps) {
  const empty = code.trim().length === 0;
  const submit = (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!empty) {
      onJoin();
    }
  };
  return (
    <form
      onSubmit={submit}
      className="glass-card flex w-full max-w-[32rem] flex-col items-center gap-5 px-9 py-8 text-center"
    >
      {slot}
      <div className="flex flex-col items-center gap-2">
        <h1 className="m-0 text-[22px] font-semibold text-ink">Join dadi</h1>
        <p className="m-0 max-w-[25rem] text-[14px] leading-relaxed text-ink-muted">
          On your box, open Preferences → Devices, add this computer, and paste its setup code here.
        </p>
      </div>
      <textarea
        autoFocus
        autoComplete="off"
        spellCheck={false}
        aria-label="Setup code"
        placeholder="Setup code"
        rows={4}
        value={code}
        onChange={(e) => onCode(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            submit(e);
          }
        }}
        className="w-full resize-none rounded-[16px] border-[1.5px] border-dashed border-sage-line bg-bone-raised/70 px-4 py-3 text-left font-mono text-[13px] leading-relaxed break-all text-ink outline-none placeholder:text-ink-faint focus:border-sage"
      />
      <AnimatePresence initial={false}>
        {error ? (
          <motion.div
            key={error}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", bounce: 0, duration: 0.32 }}
          >
            <Problem text={error} />
          </motion.div>
        ) : null}
      </AnimatePresence>
      <button type="submit" disabled={empty} className="glass-button glass-button--prominent min-w-[9rem]">
        Join
      </button>
      <button type="button" className="glass-button" onClick={onScan}>
        <span className="size-4 [&_svg]:size-full">
          <IconCamera />
        </span>
        Scan the code instead
      </button>
    </form>
  );
}

/** A join or read problem, in the error color with its mark. */
function Problem({ text }: { text: string }) {
  return (
    <p role="alert" className="m-0 flex items-start gap-2 text-left text-[13px] leading-relaxed text-error select-text">
      <svg viewBox="0 0 16 16" fill="none" aria-hidden className="mt-[3px] size-[14px] shrink-0">
        <circle cx="8" cy="8" r="6.6" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 4.6v4.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="11.2" r="0.9" fill="currentColor" />
      </svg>
      <span className="min-w-0 break-words">{text}</span>
    </p>
  );
}

/** Forget this device as a quiet line at the foot of the field. */
function QuietForget({ onForget }: { onForget: () => void }) {
  return (
    <button
      type="button"
      onClick={onForget}
      className="absolute bottom-7 left-1/2 -translate-x-1/2 text-[13px] text-ink-faint transition-colors hover:text-ink-muted"
    >
      Forget this device
    </button>
  );
}

/** Wi-Fi with an exclamation, in clay: dadi is out of reach. */
function IconUnreachable() {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden className="size-11 text-[var(--clay)]">
      <path d="M6 18.5a26 26 0 0 1 30.5-4.2" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M12.2 25a17 17 0 0 1 18.6-3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M18.4 31.4a8 8 0 0 1 8.4-1.6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="22.6" cy="37.4" r="2.4" fill="currentColor" />
      <path d="M40 20v10" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="40" cy="37" r="2.2" fill="currentColor" />
    </svg>
  );
}

/**
 * Tracks each stage's wordmark slot and where the current one sits in the overlay, in
 * layout coordinates (offsets, not bounding rects), so a card still scaling in does not
 * throw the mark off. The first placement is instant; later ones glide.
 */
function useWordmarkSlots(stage: OnboardingStage) {
  const rootRef = useRef<HTMLDivElement>(null);
  const slots = useRef(new Map<OnboardingStage, HTMLElement>());
  const stageRef = useRef(stage);
  const refs = useRef(new Map<OnboardingStage, (el: HTMLSpanElement) => () => void>());
  const observer = useRef<ResizeObserver | null>(null);
  const [placement, setPlacement] = useState<(Placement & { instant: boolean }) | null>(null);
  stageRef.current = stage;

  const measure = useCallback(() => {
    const root = rootRef.current;
    const current = stageRef.current;
    const el = slots.current.get(current);
    if (!root || !el) {
      return;
    }
    const at = offsetWithin(el, root);
    const next = {
      x: at.x + el.offsetWidth / 2,
      y: at.y + el.offsetHeight / 2,
      scale: SLOT_SIZE[current] / MARK_SIZE,
    };
    setPlacement((prev) => {
      if (prev && prev.x === next.x && prev.y === next.y && prev.scale === next.scale) {
        return prev;
      }
      return { ...next, instant: prev === null };
    });
  }, []);

  useEffect(() => {
    observer.current = new ResizeObserver(() => measure());
    if (rootRef.current) {
      observer.current.observe(rootRef.current);
    }
    for (const el of slots.current.values()) {
      observer.current.observe(el);
    }
    return () => {
      observer.current?.disconnect();
      observer.current = null;
    };
  }, [measure]);

  useLayoutEffect(() => {
    measure();
  }, [stage, measure]);

  const slotRef = useCallback(
    (key: OnboardingStage) => {
      let ref = refs.current.get(key);
      if (!ref) {
        ref = (el: HTMLSpanElement) => {
          slots.current.set(key, el);
          observer.current?.observe(el);
          measure();
          return () => {
            observer.current?.unobserve(el);
            if (slots.current.get(key) === el) {
              slots.current.delete(key);
            }
          };
        };
        refs.current.set(key, ref);
      }
      return ref;
    },
    [measure],
  );

  return { rootRef, slotRef, placement, onScroll: measure };
}

/** An element's top-left inside `root` by layout offsets, less any scrolling between them. */
function offsetWithin(el: HTMLElement, root: HTMLElement): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== root) {
    x += node.offsetLeft;
    y += node.offsetTop;
    const parent = node.offsetParent as HTMLElement | null;
    for (let up: HTMLElement | null = node.parentElement; up && up !== root; up = up.parentElement) {
      x -= up.scrollLeft;
      y -= up.scrollTop;
      if (up === parent) {
        break;
      }
    }
    node = parent;
  }
  return { x, y };
}

/** Full clipboard text. Tauri's paste event often truncates; the plugin does not. */
async function readClipboardText(e: ClipboardEvent): Promise<string> {
  if (isTauriRuntime()) {
    const { readText } = await import("@tauri-apps/plugin-clipboard-manager");
    return (await readText()).trim();
  }
  return e.clipboardData?.getData("text")?.trim() ?? "";
}
