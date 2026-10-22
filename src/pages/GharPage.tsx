import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLocation, useSearchParams } from "react-router-dom";
import { PageHeader } from "../chrome/PageHeader";
import { GharHouse } from "../features/ghar/house";
import { GharTiles } from "../features/ghar/tiles";
import { loadGharView, saveGharView, type GharView } from "../store/gharView";
import { EASE, SLOW_S } from "../shared/lib/ux/motion";

/** The two ways to see Ghar, in toggle order. */
const VIEWS: Array<{ id: GharView; label: string }> = [
  { id: "tiles", label: "Tiles" },
  { id: "house", label: "House" },
];

/** What the header says each view does. */
const HINT: Record<GharView, string> = {
  tiles: "Click to switch · hold or right-click for controls",
  house: "Tap to switch · hover for controls · drag between rooms",
};

/**
 * Full Ghar page: the tiles by default, or the house (with Add device, New room and search)
 * behind the toggle, remembered on this computer. `?device=` (from a toast) opens that
 * device's controls in the house.
 */
export function GharPage() {
  const [toolbar, setToolbar] = useState<HTMLDivElement | null>(null);
  const [params] = useSearchParams();
  const location = useLocation();
  const deviceId = params.get("device");
  const [view, setView] = useState<GharView>(() => (deviceId ? "house" : loadGharView()));

  useEffect(() => {
    if (deviceId) {
      setView("house");
    }
  }, [deviceId, location.key]);

  const choose = (next: GharView) => {
    setView(next);
    saveGharView(next);
  };

  return (
    <motion.div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: SLOW_S, ease: EASE }}
    >
      <PageHeader
        title="GHAR"
        hint={HINT[view]}
        trailing={
          <div className="flex items-center gap-2">
            {view === "house" ? <div ref={setToolbar} className="flex items-center gap-2" /> : null}
            <ViewToggle view={view} onChoose={choose} />
          </div>
        }
      />
      <div className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            className="h-full min-h-0"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: SLOW_S, ease: EASE }}
          >
            {view === "tiles" ? (
              <GharTiles />
            ) : (
              <GharHouse mode="full" toolbar={toolbar} focus={deviceId ? { deviceId, key: location.key } : null} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

type ViewToggleProps = {
  view: GharView;
  onChoose: (view: GharView) => void;
};

/** A small segmented control between the tiles and the house; the sage fill slides. */
function ViewToggle({ view, onChoose }: ViewToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Ghar view"
      className="flex items-center rounded-full border border-[var(--glass-border)] bg-[var(--glass-veil)] p-0.5"
    >
      {VIEWS.map((option) => {
        const selected = option.id === view;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChoose(option.id)}
            className={`relative h-6 rounded-full px-3 text-[11.5px] font-medium transition-colors duration-[var(--slow)] ${
              selected ? "text-bone" : "text-ink-muted hover:text-ink"
            }`}
          >
            {selected ? (
              <motion.span
                layoutId="ghar-view-fill"
                className="absolute inset-0 rounded-full bg-sage-deep"
                transition={{ type: "spring", bounce: 0, duration: 0.32 }}
              />
            ) : null}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
