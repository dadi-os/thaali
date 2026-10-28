import { motion } from "motion/react";
import { useLocation, useSearchParams } from "react-router-dom";
import { PageHeader } from "../chrome/PageHeader";
import { LogExplorer } from "../features/logs/LogExplorer";
import { SystemMap } from "../features/system/SystemMap";
import { EASE, SLOW_S } from "../shared/lib/ux/motion";

/**
 * Split system view, as on the canvas: the health card, services, drives, devices and recent
 * errors on one side, the log explorer in a card on the other.
 * Device provisioning lives on the desktop tray / app menu (Dadi → Provision client).
 * Stacks under `@container` when the page body is narrow. `?service=&q=&at=` (from an
 * error toast) focuses the explorer on that log line.
 */
export function SystemPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const service = params.get("service");
  const at = params.get("at");
  const focus =
    service && at ? { service, q: params.get("q") || "", at, key: location.key } : null;

  return (
    <motion.div
      className="relative flex h-full min-h-0 w-full flex-col overflow-hidden"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: SLOW_S, ease: EASE }}
    >
      <PageHeader title="SYSTEM" hint="Services, drives, devices on dadi, and the box's logs" />

      <div className="@container min-h-0 flex-1 px-1 pb-1">
        <div className="grid h-full min-h-0 grid-cols-1 gap-5 @min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-h-0 min-w-0 overflow-y-auto pr-1 pb-4 [scrollbar-width:thin]">
            <SystemMap />
          </div>
          <section className="flex min-h-[min(460px,52vh)] min-w-0 flex-col overflow-hidden rounded-[18px] border border-(--glass-border) bg-(--glass-veil) p-[18px] shadow-[0_1px_2px_rgba(92,107,82,0.05),0_10px_30px_rgba(44,48,42,0.05)] @min-[900px]:min-h-0">
            <span className="mb-3 shrink-0 text-[10.5px] font-semibold tracking-[2.5px] text-ink-ghost">LOGS</span>
            <div className="min-h-0 min-w-0 flex-1">
              <LogExplorer focus={focus} />
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
}
