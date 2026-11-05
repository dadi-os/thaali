import { useEffect, useMemo, useRef, useState, type ReactNode, type UIEvent } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { isMeshOnline, nas } from "../../shared/api";
import type { NasLogEntry, NasLogLevel } from "../../shared/api/nas";
import { Pill } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { MenuItem, MenuPanel } from "../../shared/overlay/Floating";
import { Icon } from "../../shared/ui/Icon";
import { StateView } from "../../shared/states/ModuleState";
import { Segmented } from "../../shared/ui/Segmented";
import { Skeleton } from "../../shared/ui/Skeleton";
import { Truncate } from "../../shared/ui/Truncate";
import { useConnection } from "../../shared/hooks/useConnection";
import { useModuleState } from "../../shared/hooks/useModuleState";
import { failureProps } from "../../shared/lib/ux/moduleState";
import { POLL_MS } from "../../shared/lib/ux/poll";
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

/** The button that narrows the logs to some services, and the menu of services it opens under it, drawn on the page so no card clips or offsets it. */
function ServiceMenu({ services, selected, onToggle, onClear }: ServiceMenuProps) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (anchor === null) {
      return undefined;
    }
    const away = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!button.current?.contains(target) && !menu.current?.contains(target)) {
        setAnchor(null);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAnchor(null);
      }
    };
    document.addEventListener("mousedown", away);
    window.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", away);
      window.removeEventListener("keydown", escape);
    };
  }, [anchor]);
  const [only] = selected;
  const summary = selected.size === 0 ? "All services" : selected.size === 1 && only !== undefined ? only : `${selected.size} services`;
  return (
    <>
      <button
        ref={button}
        type="button"
        className="ui-trans ui-hover-fill"
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        onClick={() => setAnchor(anchor === null ? (button.current?.getBoundingClientRect() ?? null) : null)}
        style={{ height: 40, padding: "0 13px", borderRadius: 12, border: "1px solid var(--glass-border)", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", flex: "none" }}
      >
        {summary}
        <Icon name="chevDown" size={14} />
      </button>
      {anchor === null
        ? null
        : createPortal(
            <div ref={menu} style={{ position: "fixed", top: anchor.bottom + 6, right: window.innerWidth - anchor.right, zIndex: "var(--z-menu)" }}>
              <MenuPanel>
                <MenuItem label="All services" icon="server" on={selected.size === 0} check={selected.size === 0} onClick={onClear} />
                {services.map((name) => (
                  <MenuItem key={name} label={name} icon="server" on={selected.has(name)} check={selected.has(name)} onClick={() => onToggle(name)} />
                ))}
              </MenuPanel>
            </div>,
            document.body,
          )}
    </>
  );
}

type LogLineProps = {
  line: KeyedLog;
  pinned: boolean;
  onPin: () => void;
};

/** One line: its time, service and message, and, pinned open, its whole record under it. */
function LogLine({ line, pinned, onPin }: LogLineProps) {
  const { entry } = line;
  return (
    <div data-log-key={line.key} style={{ borderTop: "1px solid var(--rule)", background: pinned ? "var(--sage-fill)" : (WASH[entry.level] ?? "transparent"), borderRadius: pinned ? 10 : 0 }}>
      <button
        type="button"
        className="ui-trans ui-hover-fill"
        aria-expanded={pinned}
        onClick={onPin}
        style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", height: 38, padding: "0 10px", borderRadius: 8 }}
      >
        <span className="ui-mono" style={{ whiteSpace: "nowrap", width: 86, flex: "none" }}>{logTime(entry.time)}</span>
        <span style={{ width: 54, flex: "none", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: levelDot(entry.level), flex: "none" }} />
          {entry.service}
        </span>
        <Truncate text={entry.msg} style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: entry.level === "error" ? "var(--error)" : "var(--ink)" }} />
      </button>
      {pinned && entry.raw !== undefined ? (
        <div style={{ padding: "2px 10px 12px 10px", animation: "rise 320ms cubic-bezier(0.22, 0.61, 0.36, 1) both" }}>
          <pre className="ui-mono" style={{ margin: 0, padding: "10px 12px", borderRadius: 10, background: "var(--bone)", border: "1px solid var(--rule)", fontSize: 11.5, lineHeight: "17px", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {prettyRaw(entry.raw)}
          </pre>
        </div>
      ) : null}
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
      <div style={{ display: "flex", flexDirection: "column", padding: "0 16px" }}>
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, height: 40, borderTop: "1px solid var(--rule)" }}>
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
        className="scroll"
        onScroll={onScroll}
        data-vp={flat ? undefined : "1"}
        style={flat ? { flex: "none", maxHeight: FLAT_LINES * LINE_PX, minHeight: 0, padding: "0 8px" } : { flex: 1, minHeight: 0, padding: "0 8px" }}
      >
        {listed.slice(0, shown).map((line) => (
          <LogLine key={line.key} line={line} pinned={pinned === line.key} onPin={() => setPinned(pinned === line.key ? null : line.key)} />
        ))}
      </div>
    );
  }

  return (
    <Card style={{ flex: 1, minWidth: 0, minHeight: 0, borderRadius: 18 }}>
      <div style={{ display: "flex", alignItems: "center", padding: "16px 16px 6px 18px", gap: 10 }}>
        <span className="ui-label">Logs</span>
        <div style={{ flex: 1 }} />
        <Segmented options={RANGE_PRESETS} value={range} onChange={setRange} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "6px 16px 10px", flex: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label className="search-field">
              <Icon name="search" size={15} />
              <input type="search" className="sfi" placeholder="Filter messages" aria-label="Filter messages" value={draft} onChange={(event) => setDraft(event.target.value)} />
            </label>
          </div>
          <ServiceMenu services={services.data?.services ?? []} selected={selected} onToggle={toggleService} onClear={() => setSelected(new Set())} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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
      {body}
      <div style={{ display: "flex", alignItems: "center", height: 38, padding: "0 18px", borderTop: "1px solid var(--rule)", fontSize: 12.5, color: "var(--ink-muted)", flex: "none", gap: 8 }}>
        {showing ? (
          <>
            {`${listed.length} lines`}
            <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--sage)", flex: "none", animation: "ui-pulse 1.6s ease-in-out infinite" }} />
              Live
            </span>
          </>
        ) : null}
      </div>
    </Card>
  );
}
