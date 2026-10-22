import { useState } from "react";
import { MotionConfig, motion } from "motion/react";
import { PageHeader } from "../chrome/PageHeader";
import { PasswordManager } from "../features/chaavi";
import { EASE, SLOW_S } from "../shared/lib/ux/motion";

/**
 * Chaavi password manager page: every item type, folders, search and reveal on demand.
 * Chaavi is the vault (a Vaultwarden fork that also serves /v1); the Bitwarden extension fills the browser.
 * The vault's motion follows the system's reduced-motion setting: it keeps its fades and
 * drops its slides, glides and layout moves.
 */
export function ChaaviPage() {
  const [toolbar, setToolbar] = useState<HTMLDivElement | null>(null);
  return (
    <motion.div
      className="relative flex h-full min-h-0 w-full flex-col overflow-hidden"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: SLOW_S, ease: EASE }}
    >
      <PageHeader
        title="CHAAVI"
        hint="Reveal a secret only when you need it · drag an item onto a folder to move it"
        trailing={<div ref={setToolbar} className="flex items-center gap-2" />}
      />
      <div className="min-h-0 flex-1 px-1 pb-1">
        <MotionConfig reducedMotion="user">
          <PasswordManager toolbar={toolbar} />
        </MotionConfig>
      </div>
    </motion.div>
  );
}
