import { useState } from "react";
import { motion } from "motion/react";
import { useLocation, useSearchParams } from "react-router-dom";
import { PageHeader } from "../chrome/PageHeader";
import { GharHouse } from "../features/ghar/house";
import { EASE, SLOW_S } from "../shared/lib/ux/motion";

/** Full Ghar page. Pairing lives in Unplaced. `?device=` (from a toast) opens that device's controls. */
export function GharPage() {
  const [toolbar, setToolbar] = useState<HTMLDivElement | null>(null);
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
      <PageHeader
        title="GHAR"
        hint="Click a room or a device to switch it · hover a device for color and name"
        trailing={<div ref={setToolbar} className="flex items-center gap-2" />}
      />
      <div className="min-h-0 flex-1">
        <GharHouse
          mode="full"
          toolbar={toolbar}
          focus={deviceId ? { deviceId, key: location.key } : null}
        />
      </div>
    </motion.div>
  );
}
