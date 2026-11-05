import { useEffect, useState } from "react";
import { usingMesh } from "../../api";
import { OfflineNotice } from "../../states/OfflineNotice";
import { useConnection } from "../../hooks/useConnection";

/**
 * The one notice for dadi being out of reach, for the title bar: "Reconnecting to dadi…" while the
 * mesh reconnects, and "dadi unreachable" once a connection that was up has dropped for good (the
 * desktop app shows onboarding then, so only a browser build gets here). Pages keep their last
 * answers under it, and nothing else reports the loss.
 */
export function OfflinePill() {
  const { state } = useConnection();
  const [wasConnected, setWasConnected] = useState(false);

  useEffect(() => {
    if (state === "connected") {
      setWasConnected(true);
    }
  }, [state]);

  if (state === "reconnecting") {
    return <OfflineNotice text="Reconnecting to dadi…" />;
  }
  if (state === "disconnected" && wasConnected && !usingMesh) {
    return <OfflineNotice text="dadi unreachable" spin={false} />;
  }
  return null;
}
