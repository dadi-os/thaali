import type { NasLogEntry } from "../../shared/api/nas";
import { copyText } from "../../shared/desktop/clipboard";
import type { ActionList } from "../../shared/interaction/actions";
import { logTime, requestIdOf } from "./logLines";

/** What a log line's actions need from the card that shows it. */
export type LogActionDeps = {
  /** Narrow the logs to this line's service. */
  onFilterService: (service: string) => void;
};

/** The actions on a log line, declared once for its right-click menu: copy the line, copy its request id, filter to its service. */
export function logActions(entry: NasLogEntry, deps: LogActionDeps): ActionList {
  const requestId = requestIdOf(entry);
  return [
    { id: "log.copy-line", label: "Copy line", icon: "copy", run: () => copyText(`${logTime(entry.time)} ${entry.service} ${entry.level} ${entry.msg}`) },
    { id: "log.copy-request", label: "Copy request id", icon: "copy", disabledReason: requestId === null ? "This line carries no request id" : undefined, run: () => copyText(requestId ?? "") },
    "separator",
    { id: "log.filter-service", label: `Filter to ${entry.service}`, icon: "filter", run: () => deps.onFilterService(entry.service) },
  ];
}
