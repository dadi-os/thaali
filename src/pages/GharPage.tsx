import { motion } from "motion/react";
import { useLocation, useSearchParams } from "react-router-dom";
import { PageHeader } from "../chrome/PageHeader";
import { GharHouse } from "../features/ghar";
import { EASE, SLOW_S } from "../shared/lib/ux/motion";

/** Full Ghar page. `?device=` (from a toast) selects that device into the inspector. */
export function GharPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const deviceId = params.get("device");

  return (
    <motion.div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: SLOW_S, ease: EASE }}
    >
      <PageHeader title="GHAR" hint="Click a light to switch it · hold it or use its controls to adjust it" />
      <div className="min-h-0 flex-1 px-1 pb-1">
        <GharHouse focus={deviceId ? { deviceId, key: location.key } : null} />
      </div>
    </motion.div>
  );
}
