import { useRef, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { isMeshOnline, nas } from "../../../shared/api";
import { useRetained } from "../../../shared/hooks/useRetained";
import { useConnection } from "../../../shared/hooks/useConnection";
import { getTakeover, subscribeTakeover } from "../../../contexts/takeover";
import { tasksRefetchInterval } from "../sessions";
import { BrowserModal } from "./BrowserModal";
import { TerminalModal } from "./TerminalModal";

/**
 * The helper-task modal host: it shows the browser's or the terminal's modal, opened by a helper task's preview or its row on the System page.
 * It opens watching, with the helper still working and the screen read-only; Takeover pauses the helper and lets Ankur use the
 * browser or type into the terminal, and Return, closing the modal or half an hour without input hands it back with a summary of what he did.
 */
export function TakeoverModal() {
  const address = useSyncExternalStore(subscribeTakeover, getTakeover);
  const { state: connection } = useConnection();
  const tasks = useQuery({
    queryKey: ["nas", "tasks"],
    queryFn: () => nas.listTasks(),
    enabled: isMeshOnline(connection),
    refetchInterval: (query) => tasksRefetchInterval(query.state.data),
  });
  const found = address === null ? undefined : tasks.data?.find((candidate) => candidate.task === address);
  const live = found !== undefined && found.resource !== undefined ? found : null;
  const shown = useRetained(live);
  const wasOpen = useRef(false);
  const session = useRef(0);
  if (live !== null && !wasOpen.current) {
    session.current += 1;
  }
  wasOpen.current = live !== null;
  if (shown === null || shown.resource === undefined) {
    return null;
  }
  const props = { task: shown, resource: shown.resource, open: live !== null };
  const key = `${shown.task}:${session.current}`;
  return shown.kind === "browser" ? <BrowserModal key={key} {...props} /> : <TerminalModal key={key} {...props} />;
}
