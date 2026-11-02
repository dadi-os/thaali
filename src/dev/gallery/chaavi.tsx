import { DeleteDialog } from "../../features/chaavi/DeleteDialog";
import { emptyDraft } from "../../features/chaavi/draft";
import { ItemSheet } from "../../features/chaavi/ItemSheet";
import { folders } from "../fixtures/chaavi";
import { CASES } from "./cases";

/** The vault's overlays over a window of the design's size: the new-item sheet as it opens and the delete question for GitHub. */

const noop = () => undefined;

/** A window the overlay covers, as the page the overlay sits in would be. */
function Window({ children }: { children: React.ReactNode }) {
  return <div style={{ position: "relative", width: 1440, height: 900, background: "var(--bone)" }}>{children}</div>;
}

CASES["chaavi.sheet.login"] = () => (
  <Window>
    <ItemSheet mode="create" initial={emptyDraft("login", null)} folders={folders("normal")} pending={false} onClose={noop} onSubmit={noop} />
  </Window>
);

CASES["chaavi.dialog.delete"] = () => (
  <Window>
    <DeleteDialog name="GitHub" pending={false} onCancel={noop} onConfirm={noop} />
  </Window>
);
