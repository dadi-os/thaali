import { useEffect, useState } from "react";
import { subscribeDesktopShell } from "../../contexts/desktopShell";
import { Onboarding } from "../../features/onboarding";
import { ForgetDeviceDialog } from "../../features/onboarding/ForgetDevice";
import { useConnection } from "../../shared/hooks/useConnection";
import { TitleBar } from "../../shared/layout/shell/TitleBar";
import { CASES } from "./cases";

/** Onboarding over the title bar as AppShell stacks them, in the state the fixture scenario puts the transport in (`connecting` joins and never settles, `offline` waits for a tap), with the Forget this device confirmation AppShell hosts. */
function OnboardingFrame() {
  const { connect } = useConnection();
  const [forgetOpen, setForgetOpen] = useState(false);
  useEffect(() => {
    void connect();
  }, [connect]);
  useEffect(
    () =>
      subscribeDesktopShell((action) => {
        if (action.type === "forget_device") {
          setForgetOpen(true);
        }
      }),
    [],
  );
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: "var(--field-bloom)" }}>
      <TitleBar wordmark={false} notice={null} onHome={() => undefined} />
      <div className="relative flex min-h-0 flex-1">
        <Onboarding boot={{ status: "ready" }} onRetryBoot={() => undefined} />
      </div>
      <ForgetDeviceDialog open={forgetOpen} onClose={() => setForgetOpen(false)} />
    </div>
  );
}

CASES["onboarding.frame"] = () => <OnboardingFrame />;
