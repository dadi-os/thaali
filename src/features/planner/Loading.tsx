import { Card } from "../../shared/ui/Card";
import { Skeleton } from "../../shared/ui/Skeleton";
import { AXIS_W } from "./TimeGrid";
import { WEEK, weekColumns, weekHeadHeight } from "./weekLayout";

/** Skeleton hour rows: a label and a rule, with a block drawn on some of them. */
function Hours({ blocks }: { blocks: number[] }) {
  return (
    <div className="flex flex-1 flex-col">
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} className="relative flex items-start" style={{ height: 56, borderTop: "1px solid var(--rule)" }}>
          <span style={{ width: AXIS_W, paddingRight: 10, paddingTop: 2, display: "flex", justifyContent: "flex-end" }}>
            <Skeleton width={30} height={10} />
          </span>
          {blocks.includes(i) ? <Skeleton width="62%" height={44} radius={14} /> : null}
        </div>
      ))}
    </div>
  );
}

/** What the Day view looks like while it loads: hour rows with a few plan blocks beside a checklist of rows. */
export function DayLoading({ wide }: { wide: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: wide ? "row" : "column", flex: 1, gap: wide ? 16 : 12, minWidth: 0, minHeight: 0 }}>
      <Card style={{ flex: 1, padding: "12px 14px 14px", minHeight: 0 }}>
        <Hours blocks={[1, 3, 4, 6]} />
      </Card>
      <div style={{ display: "flex", flexDirection: "column", width: wide ? 320 : undefined, flex: wide ? "none" : 1, gap: 12, minHeight: 0 }}>
        <Skeleton width="100%" height={110} radius={18} />
        <Card style={{ flex: 1, padding: 16, gap: 14, minHeight: 0 }}>
          <Skeleton width="45%" height={16} />
          <Skeleton width="100%" height={6} radius={3} />
          {[72, 54, 66, 48, 60].map((w, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton width={20} height={20} radius={10} />
              <Skeleton width={`${w}%`} height={12} />
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

/** What the Week view looks like while it loads: seven day bubbles floating over the hour lines, with a few slabs in the columns, on the Week's own spacing. */
export function WeekLoading() {
  const blocks = [[1, 4], [2], [1, 3, 5], [4], [2, 5], [3], []];
  const origin = weekHeadHeight(0);
  return (
    <Card style={{ position: "relative", flex: 1, padding: 0, minHeight: 0, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: WEEK.top, left: 0, right: 0, display: "grid", gridTemplateColumns: weekColumns(7), zIndex: 1 }}>
        <div />
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "center" }}>
            <Skeleton width={96} height={WEEK.bubble} radius={WEEK.bubble / 2} />
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: origin, bottom: 0 }}>
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} style={{ position: "absolute", left: WEEK.edge + WEEK.axis, right: 0, top: i * WEEK.hour, borderTop: "1px solid color-mix(in srgb, var(--rule) 70%, transparent)" }}>
            <div style={{ position: "absolute", top: -5, left: -WEEK.axis, width: WEEK.axis, display: "flex", justifyContent: "flex-end" }}>
              <Skeleton width={32} height={10} />
            </div>
          </div>
        ))}
        <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: weekColumns(7) }}>
          <div />
          {blocks.map((rows, c) => (
            <div key={c} style={{ position: "relative" }}>
              {rows.map((row) => (
                <div key={row} style={{ position: "absolute", left: WEEK.inset, right: WEEK.inset, top: row * WEEK.hour + WEEK.blockGap / 2 }}>
                  <Skeleton width="100%" height={row % 2 === 0 ? WEEK.hour - WEEK.blockGap : WEEK.hour * 1.5 - WEEK.blockGap} radius={11} />
                </div>
              ))}
            </div>
          ))}
          <div />
        </div>
      </div>
    </Card>
  );
}

/** What the Month view looks like while it loads: a weekday row over a grid of day tiles with date and plan lines. */
export function MonthLoading({ weeks }: { weeks: number }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} className="flex flex-1 justify-center">
            <Skeleton width={28} height={10} />
          </span>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 gap-1.5" style={{ gridTemplateColumns: "repeat(7,minmax(0,1fr))", gridTemplateRows: `repeat(${weeks},minmax(0,1fr))` }}>
        {Array.from({ length: weeks * 7 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 overflow-hidden rounded-[12px] border border-glass-border bg-glass-veil p-2">
            <Skeleton width={16} height={12} />
            {i % 3 !== 2 ? <Skeleton width="80%" height={10} /> : null}
            {i % 2 === 0 ? <Skeleton width="60%" height={10} /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
