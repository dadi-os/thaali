import { useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { PageHeader } from "../chrome/PageHeader";
import { MemoryGraph3D } from "../features/memory/MemoryGraph3D";
import { EASE, SLOW_S } from "../shared/lib/ux/motion";

/**
 * Yaad page: the knowledge network as a live 3D force graph behind the header, the kind chips
 * under it, and the focused node's sheet docked at the right.
 */
export function YaadPage() {
  const location = useLocation();
  const entranceKey = `yaad:${location.key}`;
  const [params] = useSearchParams();
  const [toolbar, setToolbar] = useState<HTMLDivElement | null>(null);
  const [filters, setFilters] = useState<HTMLDivElement | null>(null);
  const [sheet, setSheet] = useState<HTMLDivElement | null>(null);

  return (
    <motion.div
      className="relative flex h-full min-h-0 w-full flex-col overflow-hidden"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: SLOW_S, ease: EASE }}
    >
      <div className="absolute inset-0">
        <MemoryGraph3D
          entranceKey={entranceKey}
          toolbar={toolbar}
          filters={filters}
          sheet={sheet}
          focusNodeId={params.get("focus")}
        />
      </div>
      <div className="pointer-events-none relative z-10 flex min-h-0 flex-1 flex-col">
        <PageHeader
          title="YAAD"
          hint="Click anything to bring its connections forward · drag to orbit · scroll to zoom"
          trailing={<div ref={setToolbar} className="flex items-center gap-2" />}
        />
        <div ref={setFilters} className="pointer-events-auto self-start px-1" />
        <div ref={setSheet} className="flex min-h-0 flex-1 justify-end pt-4 pb-1" />
      </div>
    </motion.div>
  );
}
