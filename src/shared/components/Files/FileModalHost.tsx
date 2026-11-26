import { useSyncExternalStore } from "react";
import { getOpenBoxPath, setOpenBoxPath, subscribeOpenBoxPath } from "../../../contexts/files";
import { FileModal } from "./FileModal";

/** The explorer modal that `box://` links open: the app frame mounts it once, and it follows the path in `contexts/files`. */
export function FileModalHost() {
  const path = useSyncExternalStore(subscribeOpenBoxPath, getOpenBoxPath, getOpenBoxPath);
  return <FileModal path={path} onClose={() => setOpenBoxPath(null)} />;
}
