import { useMutation } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { isMeshOnline, nas } from "../../shared/api";
import { copyText } from "../../shared/desktop/clipboard";
import { useConnection } from "../../shared/hooks/useConnection";
import { renderBrandedQr } from "../../shared/lib/content/brandedQr";
import { StateView } from "../../shared/states/ModuleState";
import { Button } from "../../shared/ui/Button";
import { TextField } from "../../shared/ui/Field";

/**
 * Mint a single-use setup code for a new device: name → Nas /provision →
 * branded QR + pasteable text for the joining device.
 */
export function ProvisionDevice() {
  const { state } = useConnection();
  const connected = isMeshOnline(state);
  const [nodeName, setNodeName] = useState("");
  const [bundle, setBundle] = useState<string | null>(null);

  const mint = useMutation({
    mutationFn: (name: string) => nas.provision(name),
    onSuccess: (res) => setBundle(res.bundle),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const name = nodeName.trim();
    if (!name || mint.isPending) {
      return;
    }
    setBundle(null);
    mint.mutate(name);
  };

  if (!connected) {
    return <StateView kind="offline" title="Connect to create a setup code" />;
  }

  return (
    <div className="flex min-h-0 flex-col gap-5">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <TextField label="Node name" placeholder="phone" value={nodeName} onChange={setNodeName} disabled={mint.isPending} />
        <Button type="submit" tone="fill" size="xl" disabled={mint.isPending || !nodeName.trim()}>
          {mint.isPending ? "Creating…" : "Create setup code"}
        </Button>
      </form>
      {mint.error instanceof Error ? (
        <p role="alert" data-selectable className="m-0 text-center text-[13px] text-error">
          {mint.error.message}
        </p>
      ) : null}
      {bundle ? <SetupCodeDisplay bundle={bundle} /> : null}
    </div>
  );
}

type SetupCodeDisplayProps = {
  /** The single-use setup code the box minted. */
  bundle: string;
};

/** The minted code as a branded QR and as text, with a button that copies it. */
function SetupCodeDisplay({ bundle }: SetupCodeDisplayProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [encodeError, setEncodeError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEncodeError(null);
    setDataUrl(null);
    setCopied(false);
    void renderBrandedQr(bundle, { size: 220 })
      .then((url) => {
        if (!cancelled) {
          setDataUrl(url);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setDataUrl(null);
          setEncodeError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [bundle]);

  const onCopy = () => {
    setCopyError(null);
    copyText(bundle)
      .then(() => setCopied(true))
      .catch((err: unknown) => setCopyError(err instanceof Error ? err.message : String(err)));
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {dataUrl ? (
        <img src={dataUrl} alt="Setup code QR" className="size-[220px]" />
      ) : (
        <div className="flex size-[220px] items-center justify-center px-3 text-center text-[13px] text-ink-ghost">{encodeError ?? "Encoding…"}</div>
      )}
      <p className="m-0 text-center text-[13px] text-ink-ghost">Scan it with the new device, or copy the code.</p>
      <Button tone="sage" size="md" pill icon={copied ? "check" : "copy"} onClick={onCopy}>
        {copied ? "Copied" : "Copy code"}
      </Button>
      {copyError ? (
        <p role="alert" className="m-0 text-center text-[13px] text-error">
          Copy failed: {copyError}
        </p>
      ) : null}
      <textarea readOnly value={bundle} rows={3} onFocus={(e) => e.target.select()} className="w-full resize-none rounded-[12px] border border-glass-border bg-bone px-3 py-2 font-numeric text-[11px] text-ink-muted" />
    </div>
  );
}
