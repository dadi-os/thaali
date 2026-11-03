import { DeleteDialog } from "../../features/chaavi/DeleteDialog";
import { draftFromItem, emptyDraft, retype } from "../../features/chaavi/draft";
import { FolderPane } from "../../features/chaavi/FolderPane";
import { DragGhost, ItemList } from "../../features/chaavi/ItemList";
import { ItemSheet } from "../../features/chaavi/ItemSheet";
import type { ChaaviItem, ChaaviItemType } from "../../types/chaavi";
import { folders, items } from "../fixtures/chaavi";
import { CASES } from "./cases";

/** The vault's overlays over a window of the design's size: the new-item sheet as it opens and the delete question for GitHub. */

const noop = () => undefined;

/** A window the overlay covers, as the page the overlay sits in would be. */
function Window({ children }: { children: React.ReactNode }) {
  return <div style={{ position: "relative", width: 1440, height: 900, background: "var(--bone)" }}>{children}</div>;
}

CASES["chaavi.sheet.login"] = () => (
  <Window>
    <ItemSheet mode="create" initial={emptyDraft("login", null)} itemId={null} folders={folders("normal")} pending={false} onClose={noop} onSubmit={noop} />
  </Window>
);

CASES["chaavi.dialog.delete"] = () => (
  <Window>
    <DeleteDialog name="GitHub" pending={false} onCancel={noop} onConfirm={noop} />
  </Window>
);

/** A new item of `type` in the sheet, as it opens. */
function createSheet(type: ChaaviItemType) {
  CASES[`chaavi.sheet.${type}`] = () => (
    <Window>
      <ItemSheet mode="create" initial={retype(emptyDraft("login", null), type)} itemId={null} folders={folders("normal")} pending={false} onClose={noop} onSubmit={noop} />
    </Window>
  );
}
for (const type of ["card", "identity", "sshKey", "bankAccount", "driversLicense", "passport"] as const) {
  createSheet(type);
}

/** A login with two websites, an authenticator key, a note and a custom field of each kind, edited. */
const FULL_LOGIN: ChaaviItem = {
  id: "full",
  name: "GitHub",
  type: "login",
  folderId: folders("normal")[0]!.id,
  favorite: false,
  hasNotes: true,
  fields: [
    { type: "text", name: "Recovery email", value: "ankur@example.test" },
    { type: "hidden", name: "Recovery code", hasValue: true },
    { type: "boolean", name: "Security key", value: true },
    { type: "linked", name: "Primary", linkedTo: "username" },
  ],
  revisionDate: null,
  login: {
    username: "octocat@example.test",
    uris: [
      { uri: "github.com", match: "default" },
      { uri: "gist.github.com", match: "host" },
    ],
    hasPassword: true,
    hasTotp: true,
    passkeys: [],
  },
};

CASES["chaavi.sheet.edit.login"] = () => (
  <Window>
    <ItemSheet mode="edit" initial={draftFromItem(FULL_LOGIN)} itemId={FULL_LOGIN.id} folders={folders("normal")} pending={false} onClose={noop} onSubmit={noop} />
  </Window>
);

/** The pane and the list while an item is dragged over `hot`, its ghost at the pointer. */
function dragCase(id: string, hot: string) {
  CASES[id] = () => {
    const all = items("normal");
    const dragged = all.find((item) => item.name === "GitHub")!;
    const drag = { onPointerDown: noop, onPointerMove: noop, onPointerUp: noop, onPointerCancel: noop };
    return (
      <div style={{ position: "relative", display: "flex", alignItems: "stretch", gap: 14, width: 1440, height: 900, padding: 20, background: "var(--bone)" }}>
        <FolderPane items={all} folders={folders("normal")} scope={{ kind: "all" }} busy={false} hot={hot} onScope={noop} onCreate={noop} onRename={noop} onDelete={noop} />
        <ItemList items={[...all].sort((a, b) => a.name.localeCompare(b.name))} selectedId={dragged.id} query="" onQuery={noop} onSelect={noop} draggingId={dragged.id} drag={drag} width={340} />
        <DragGhost name={dragged.name} x={300} y={420} />
      </div>
    );
  };
}
dragCase("chaavi.drag.folder", `folder:${folders("normal")[2]!.id}`);
dragCase("chaavi.drag.favorites", "favorites");
dragCase("chaavi.drag.none", "none");
