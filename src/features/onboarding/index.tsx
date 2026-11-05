/**
 * First run and the way back to dadi, as on the phone: the field with દાદી resolving on it,
 * then the setup-code field to paste (or scan) into; the wordmark breathing while this
 * computer joins; one tap to join when provisioned and off; and the Can't reach dadi state
 * with the real error, Try again and Forget this device. Every stage is flat, built from the
 * shared parts, and enters and leaves the same way.
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
import { isTauriRuntime } from "../../shared/desktop/runtime";
import { useConnection } from "../../shared/hooks/useConnection";
import { FieldBloom } from "../../shared/layout/FieldBloom";
import { Wordmark } from "../../shared/layout/Wordmark";
import { StateView } from "../../shared/states/ModuleState";
import { Button, ButtonGroup } from "../../shared/ui/Button";
import { TextField } from "../../shared/ui/Field";
import { Icon } from "../../shared/ui/Icon";
import { EASE, RISE, SLOWER_S } from "../../shared/motion";
import { dispatchDesktopShell } from "../../contexts/desktopShell";
import { QrScanner } from "./QrScanner";
import { useNeedsProvisioning } from "./useNeedsProvisioning";
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
const GLIDE = { type: "spring", bounce: 0, duration: SLOWER_S } as const;

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
          <Stage key={stage}>
            <Slot size={SLOT_SIZE[stage]} slotRef={slotRef(stage)} />
          </Stage>
        ) : null}

        {stage === "connecting" ? (
          <Stage key="connecting">
            <Slot size={SLOT_SIZE.connecting} slotRef={slotRef("connecting")} />
            <Heading
              title="Connecting to dadi"
              text={
                joining
                  ? "Joining with your new setup code. The first time, your computer may ask for your password."
                  : "Joining this computer to dadi. The first time, your computer may ask for your password."
              }
            />
          </Stage>
        ) : null}

        {stage === "ready" ? (
          <Stage key="ready">
            <Slot size={SLOT_SIZE.ready} slotRef={slotRef("ready")} />
            <Heading title="Connect to dadi" text="Joins this computer to dadi, so this app, your browser and Terminal can all reach it." />
            <Button tone="fill" size="xl" pill icon="power" autoFocus className="min-w-36" onClick={() => void onConnect()}>
              Connect
            </Button>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
              <Button tone="quiet" size="md" onClick={onForget}>
                Forget this device
              </Button>
            </div>
          </Stage>
        ) : null}

        {stage === "failed" ? (
          <Stage key="failed">
            <Slot size={SLOT_SIZE.failed} slotRef={slotRef("failed")} />
            <div data-selectable className="flex w-full flex-col">
              <StateView kind="error" title="Can't reach dadi" detail={failed ?? undefined} />
            </div>
            <ButtonGroup justify="center" wrap>
              <Button tone="danger" size="xl" pill onClick={onForget}>
                Forget this device
              </Button>
              <Button tone="fill" size="xl" pill icon="retry" autoFocus onClick={onTryAgain}>
                Try again
              </Button>
            </ButtonGroup>
          </Stage>
        ) : null}

        {stage === "paste" ? (
          <Stage key="paste">
            <Slot size={SLOT_SIZE.paste} slotRef={slotRef("paste")} />
            <Heading title="Join dadi" text="On your box, open Preferences → Devices, add this computer, and paste its setup code here." />
            <PasteForm
              code={code}
              error={setupError}
              onCode={setCode}
              onJoin={() => void joinWithCode(code)}
              onScan={() => {
                setSetupError(null);
                setSetupView("scan");
              }}
            />
          </Stage>
        ) : null}

        {stage === "scan" ? (
          <Stage key="scan">
            <Slot size={SLOT_SIZE.scan} slotRef={slotRef("scan")} />
            <Heading title="Scan the code on your box" />
            <div className="w-[min(18rem,100%)]">
              <QrScanner onDecode={onScanDecode} />
            </div>
            <Problem text={setupError} />
            <Button
              tone="outline"
              size="xl"
              pill
              onClick={() => {
                setSetupError(null);
                setSetupView("paste");
              }}
            >
              Paste a setup code
            </Button>
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
        <div className="-translate-x-1/2 -translate-y-1/2">
          <motion.div initial={false} animate={{ scale: placement?.scale ?? 1 }} transition={placement?.instant || reduce ? { duration: 0 } : GLIDE}>
            <Wordmark size={MARK_SIZE} resolve breathe={breathing} className="text-sage-deep" />
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}

type StageProps = {
  children: ReactNode;
};

/** One stage: a centered, un-boxed column on the field. Every stage enters and leaves the same way, stacked while they cross, and scrolls when the window is short. */
function Stage({ children }: StageProps) {
  return (
    <motion.div className="scroll absolute inset-0" {...RISE}>
      <div className="relative mx-auto flex min-h-full w-full max-w-[28rem] flex-col items-center justify-center gap-6 px-6 py-12 text-center">{children}</div>
    </motion.div>
  );
}

type HeadingProps = {
  title: string;
  /** One line of explanation under the title. */
  text?: string;
};

/** A stage's title and the sentence under it. */
function Heading({ title, text }: HeadingProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <h1 className="m-0 text-[20px] font-semibold text-ink">{title}</h1>
      {text ? <p className="m-0 text-[14px] leading-relaxed text-ink-muted">{text}</p> : null}
    </div>
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
    <span ref={slotRef} aria-hidden className="invisible inline-block shrink-0 font-gujarati leading-none font-medium whitespace-nowrap" style={{ fontSize: size }}>
      દાદી
    </span>
  );
}

type PasteFormProps = {
  code: string;
  /** Why the last join failed, or null. */
  error: string | null;
  onCode: (code: string) => void;
  onJoin: () => void;
  onScan: () => void;
};

/** The setup-code field with Join and the way to scan instead; Enter joins, Shift+Enter breaks the line. */
function PasteForm({ code, error, onCode, onJoin, onScan }: PasteFormProps) {
  const empty = code.trim().length === 0;
  const submit = (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!empty) {
      onJoin();
    }
  };
  return (
    <form onSubmit={submit} className="flex w-full flex-col items-stretch gap-4 text-left">
      <TextField
        autoFocus
        label="Setup code"
        placeholder="Paste the setup code"
        rows={4}
        value={code}
        invalid={error !== null}
        className="font-numeric text-[13px] break-all"
        onChange={onCode}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            submit(e);
          }
        }}
      />
      <Problem text={error} />
      <div className="flex flex-col items-center gap-2">
        <Button type="submit" tone="fill" size="xl" pill disabled={empty} className="min-w-36">
          Join
        </Button>
        <Button tone="quiet" size="md" pill icon="camera" onClick={onScan}>
          Scan the code instead
        </Button>
      </div>
    </form>
  );
}

type ProblemProps = {
  /** The join or read problem, or null for none. */
  text: string | null;
};

/** A join or read problem in the error color; it rises in and leaves when the problem clears. */
function Problem({ text }: ProblemProps) {
  return (
    <AnimatePresence initial={false}>
      {text ? (
        <motion.p key={text} role="alert" data-selectable className="m-0 flex items-start gap-2 text-left text-[13px] leading-relaxed text-error" {...RISE}>
          <span className="mt-0.5 flex-none">
            <Icon name="alert" size={14} />
          </span>
          <span className="min-w-0 break-words">{text}</span>
        </motion.p>
      ) : null}
    </AnimatePresence>
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
