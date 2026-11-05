import { useEffect, useMemo, useRef, useState, type ReactNode, type UIEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { isMeshOnline, nas } from "../../shared/api";
import type { NasLogEntry, NasLogLevel } from "../../shared/api/nas";
import { Pill } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import type { ActionList } from "../../shared/interaction/actions";
import { useContextActions } from "../../shared/interaction/contextMenu";
import { AnchoredMenu } from "../../shared/overlay/AnchoredMenu";
import { FADE, REVEAL } from "../../shared/motion";
import { Icon } from "../../shared/ui/Icon";
import { StateView } from "../../shared/states/ModuleState";
import { Segmented } from "../../shared/ui/Segmented";
import { Skeleton } from "../../shared/ui/Skeleton";
import { Truncate } from "../../shared/ui/Truncate";
import { useConnection } from "../../shared/hooks/useConnection";
import { useModuleState } from "../../shared/hooks/useModuleState";
import { failureProps } from "../../shared/lib/ux/moduleState";
import { POLL_MS } from "../../shared/lib/ux/poll";
import { logActions } from "./actions";
import { isNoiseLog, keyEntries, LOG_LEVELS, logTime, nearestLog, prettyRaw, RANGE_PRESETS, rangeBounds, rangeFor, type KeyedLog, type LogFocus, type RangePreset } from "./logLines";

/** How long typing in the filter waits before the logs are asked for again. */
const SEARCH_DEBOUNCE_MS = 250;
/** Lines asked of Nas at once. */
const LIMIT = 200;
/** Lines drawn at first, and added each time the list is scrolled near its end. */
const STEP = 40;
/** Lines the stacked card draws; the list scrolls when there are more. */
const FLAT_LINES = 12;
/** A line is 38 px and its hairline 1 px. */
const LINE_PX = 39;

/** The tint behind a line by severity: a wash for errors and warnings, none for the rest. */
const WASH: Record<string, string> = { error: "rgba(196, 164, 154, 0.2)", warn: "rgba(184, 154, 99, 0.14)" };

/** The color of a line's severity dot. */
function levelDot(level: string): string {
  return level === "error" ? "var(--error)" : level === "warn" ? "var(--clay)" : "var(--sage)";
}

type ServiceMenuProps = {
  services: string[];
  selected: ReadonlySet<string>;
  onToggle: (name: string) => void;
  onClear: () => void;
};

/** The button that narrows the logs to some services, and the shared menu of services it opens under it. */
function ServiceMenu({ services, selected, onToggle, onClear }: ServiceMenuProps) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [only] = selected;
  const summary = selected.size === 0 ? "All services" : selected.size === 1 && only !== undefined ? only : `${selected.size} services`;
  const actions: ActionList = [
    { id: "service.all", label: "All services", icon: "server", selected: selected.size === 0, run: onClear },
    ...services.map((name) => ({ id: `service.${name}`, label: name, icon: "server" as const, selected: selected.has(name), run: () => onToggle(name) })),
  ];
  return (
    <>
      <button
        type="button"
        className="ui-trans ui-hover-fill inline-flex h-10 flex-none items-center gap-[7px] rounded-xl border border-glass-border px-[13px] text-[13px] font-medium whitespace-nowrap"
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        onClick={(event) => setAnchor(anchor === null ? event.currentTarget.getBoundingClientRect() : null)}
      >
        {summary}
        <Icon name="chevDown" size={14} />
      </button>
      <AnchoredMenu actions={actions} anchor={anchor} onClose={() => setAnchor(null)} width={200} />
    </>
  );
}

type LogLineProps = {
  line: KeyedLog;
  pinned: boolean;
  onPin: () => void;
  onFilterService: (service: string) => void;
};

/** One line: its time, service and message, and, pinned open, its whole record under it. Right-click offers copying it or its request id and filtering to its service. */
function LogLine({ line, pinned, onPin, onFilterService }: LogLineProps) {
  const { entry } = line;
  const context = useContextActions(() => logActions(entry, { onFilterService }));
  return (
    <div
      {...context}
      data-log-key={line.key}
      className={`border-t border-rule ${pinned ? "rounded-[10px] bg-sage-fill" : ""}`}
      style={pinned ? undefined : { background: WASH[entry.level] ?? "transparent" }}
    >
      <button type="button" className="ui-trans ui-hover-fill flex h-[38px] w-full items-center gap-3 rounded-lg px-2.5" aria-expanded={pinned} onClick={onPin}>
        <span data-selectable className="ui-mono w-[86px] flex-none whitespace-nowrap">
          {logTime(entry.time)}
        </span>
        <span data-selectable className="flex w-[54px] flex-none items-center gap-1.5 text-[13px] font-semibold">
          <span className="size-[7px] flex-none rounded-full" style={{ background: levelDot(entry.level) }} />
          {entry.service}
        </span>
        <span data-selectable className="min-w-0 flex-1">
          <Truncate text={entry.msg} className={`text-[13.5px] ${entry.level === "error" ? "text-error" : "text-ink"}`} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {pinned && entry.raw !== undefined ? (
          <motion.div key="raw" {...REVEAL} className="overflow-hidden">
            <div className="px-2.5 pt-0.5 pb-3">
              <pre data-selectable className="ui-mono m-0 rounded-[10px] border border-rule bg-bone px-3 py-2.5 text-[11.5px] leading-[17px] break-words whitespace-pre-wrap">
                {prettyRaw(entry.raw)}
              </pre>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export type LogsCardProps = {
  /** A line to filter to and pin open; null leaves the filters alone. */
  focus: LogFocus | null;
  /** Drawn inside a scrolling page, at the height of {@link FLAT_LINES} lines, instead of filling the column. */
  flat?: boolean;
};

/**
 * The box of Nas logs: a window of time, a filter over the messages, a menu of services, a chip per severity with its
 * count, then one line per record, newest first. A line opens to its whole record. Nas is asked again every few seconds.
 */
export function LogsCard({ focus, flat = false }: LogsCardProps) {
  const { state: connection } = useConnection();
  const connected = isMeshOnline(connection);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [level, setLevel] = useState<NasLogLevel | null>(null);
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  const [range, setRange] = useState<RangePreset>("1h");
  const [pinned, setPinned] = useState<string | null>(null);
  const [shown, setShown] = useState(flat ? FLAT_LINES : STEP);
  const appliedFocus = useRef<string | null>(null);
  const pending = useRef<LogFocus | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setQ(draft.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draft]);

  useEffect(() => {
    if (focus === null || appliedFocus.current === focus.key) {
      return;
    }
    appliedFocus.current = focus.key;
    setSelected(new Set([focus.service]));
    setLevel(null);
    setDraft(focus.q);
    setQ(focus.q);
    setRange(rangeFor(focus.at));
    setPinned(null);
    pending.current = focus.q === "" ? null : focus;
  }, [focus]);

  const services = useQuery({ queryKey: ["nas", "logs", "services"], queryFn: () => nas.listLogServices(), enabled: connected, refetchInterval: POLL_MS });
  const servicesParam = selected.size > 0 ? [...selected].sort().join(",") : undefined;
  const logs = useQuery({
    queryKey: ["nas", "logs", servicesParam ?? "", q, range],
    queryFn: () => {
      const { from, to } = rangeBounds(range);
      return nas.getLogs({ services: servicesParam, q: q || undefined, from, to, limit: LIMIT });
    },
    enabled: connected,
    refetchInterval: POLL_MS,
  });
  const state = useModuleState(logs, (answer) => answer.entries.length === 0 && q === "" && level === null && selected.size === 0);

  const lines = useMemo(() => {
    const entries: NasLogEntry[] = state.kind === "ready" ? state.data.entries : [];
    return keyEntries(q !== "" && /request completed|incoming request|\/health/i.test(q) ? entries : entries.filter((entry) => !isNoiseLog(entry)));
  }, [state, q]);
  const counted = (name: string) => lines.filter((line) => line.entry.level === name).length;
  const listed = level === null ? lines : lines.filter((line) => line.entry.level === level);
  const showing = state.kind === "ready" && listed.length > 0;

  useEffect(() => {
    const target = pending.current;
    if (target === null || q !== target.q || logs.data === undefined || logs.isFetching) {
      return;
    }
    pending.current = null;
    const nearest = nearestLog(lines, target.at);
    if (nearest === null) {
      return;
    }
    setPinned(nearest.key);
    setShown((count) => Math.max(count, listed.findIndex((line) => line.key === nearest.key) + 1));
  });

  const toggleService = (name: string) =>
    setSelected((now) => {
      const next = new Set(now);
      if (!next.delete(name)) {
        next.add(name);
      }
      return next;
    });
  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const list = event.currentTarget;
    if (list.scrollHeight - list.scrollTop - list.clientHeight < 200) {
      setShown((count) => count + STEP);
    }
  };

  let body: ReactNode;
  if (state.kind === "loading") {
    body = (
      <div className="flex flex-col px-4">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="flex h-10 items-center gap-3 border-t border-rule">
            <Skeleton width={76} height={12} />
            <Skeleton width={46} height={12} />
            <Skeleton width={`${30 + ((i * 17) % 50)}%`} height={12} />
          </div>
        ))}
      </div>
    );
  } else if (state.kind === "offline") {
    body = <StateView kind="offline" title="dadi is unreachable" detail="Waiting for the mesh to reconnect" />;
  } else if (state.kind === "error" || state.kind === "module-offline") {
    body = <StateView kind="error" title="Couldn’t load the logs" {...failureProps(state.error)} detail="GET /logs failed." onRetry={() => void logs.refetch()} />;
  } else if (!showing) {
    body = <StateView kind="empty" title="No log lines match" detail={`Nothing from ${selected.size || services.data?.services.length || 0} services in the last ${range === "1h" ? "hour" : range === "6h" ? "6 hours" : "day"} at this level.`} />;
  } else {
    body = (
      <div
        className={`scroll min-h-0 px-2 ${flat ? "flex-none" : "flex-1"}`}
        onScroll={onScroll}
        data-vp={flat ? undefined : "1"}
        style={flat ? { maxHeight: FLAT_LINES * LINE_PX } : undefined}
      >
        {listed.slice(0, shown).map((line) => (
          <LogLine key={line.key} line={line} pinned={pinned === line.key} onPin={() => setPinned(pinned === line.key ? null : line.key)} onFilterService={(service) => setSelected(new Set([service]))} />
        ))}
      </div>
    );
  }

  const bodyKey = state.kind === "ready" && showing ? "lines" : state.kind === "ready" ? "none" : state.kind;
  return (
    <Card style={{ flex: 1, minWidth: 0, minHeight: 0, borderRadius: 18 }}>
      <div className="flex items-center gap-2.5 pt-4 pr-4 pb-1.5 pl-[18px]">
        <span className="ui-label">Logs</span>
        <div className="flex-1" />
        <Segmented options={RANGE_PRESETS} value={range} onChange={setRange} />
      </div>
      <div className="flex flex-none flex-col gap-2.5 px-4 pt-1.5 pb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="min-w-0 flex-1">
            <label className="search-field">
              <Icon name="search" size={15} />
              <input type="search" className="sfi" placeholder="Filter messages" aria-label="Filter messages" value={draft} onChange={(event) => setDraft(event.target.value)} />
            </label>
          </div>
          <ServiceMenu services={services.data?.services ?? []} selected={selected} onToggle={toggleService} onClear={() => setSelected(new Set())} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Pill active={level === null} onClick={() => setLevel(null)}>
            All
          </Pill>
          {LOG_LEVELS.map((name) => (
            <Pill key={name} active={level === name} count={state.kind === "ready" && (name === "error" || name === "warn") ? counted(name) : undefined} onClick={() => setLevel(name)}>
              {name.charAt(0).toUpperCase() + name.slice(1)}
            </Pill>
          ))}
        </div>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={bodyKey} {...FADE} className={`flex min-h-0 flex-col ${showing && !flat ? "flex-1" : "flex-none"}`}>
          {body}
        </motion.div>
      </AnimatePresence>
      <div className="flex h-[38px] flex-none items-center gap-2 border-t border-rule px-[18px] text-[12.5px] text-ink-muted">
        {showing ? (
          <>
            {`${listed.length} lines`}
            <span className="ml-auto inline-flex items-center gap-1.5">
              <span className="size-1.5 flex-none animate-breath rounded-full bg-sage" />
              Live
            </span>
          </>
        ) : null}
      </div>
    </Card>
  );
}
