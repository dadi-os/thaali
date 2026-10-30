import type { StatusView } from "./statusView";

const MARK = { ok: "ok", error: "error", running: "…" } as const;

function Heading({ children }: { children: string }) {
  return <h3 className="mb-1 text-[10.5px] font-semibold tracking-[2.5px] text-ink-ghost">{children}</h3>;
}

/** What the agent is doing now: its job, work state, step, last tool calls, helper tasks and queued messages. */
export function StatusBlock({ view }: { view: StatusView }) {
  return (
    <section aria-label="Status" className="flex max-h-[34%] shrink-0 flex-col gap-2.5 overflow-y-auto border-b border-rule/60 px-5 py-3 text-[12.5px]">
      <div>
        <Heading>JOB</Heading>
        <p className="line-clamp-2 text-ink" title={view.job ?? undefined}>
          {view.job ?? "No open job"}
        </p>
      </div>
      <div>
        <Heading>WORK</Heading>
        <p className="text-ink">{view.work}</p>
        {view.step ? <p className="truncate font-mono text-[11.5px] text-ink-muted" title={view.step}>{view.step}</p> : null}
      </div>
      {view.recent.length > 0 ? (
        <div>
          <Heading>LAST CALLS</Heading>
          <ul className="flex flex-col gap-0.5">
            {view.recent.map((call, i) => (
              <li key={i} className="flex items-baseline gap-2 font-mono text-[11.5px]">
                <span className="min-w-0 flex-1 truncate text-ink-muted" title={call.text}>{call.text}</span>
                <span className={`shrink-0 ${call.mark === "error" ? "text-ink" : "text-ink-ghost"}`}>{MARK[call.mark]}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div>
        <Heading>TASKS</Heading>
        {view.tasksUnreadable !== null ? (
          <p className="text-ink">{view.tasksUnreadable}</p>
        ) : view.tasks.length === 0 ? (
          <p className="text-ink-muted">None in flight</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {view.tasks.map((line) => (
              <li key={line} className="truncate font-mono text-[11.5px] text-ink-muted" title={line}>{line}</li>
            ))}
          </ul>
        )}
      </div>
      {view.pending.length > 0 ? (
        <div>
          <Heading>QUEUED TO SEND</Heading>
          <ul className="flex flex-col gap-0.5">
            {view.pending.map((line) => (
              <li key={line} className="truncate text-ink-muted" title={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
