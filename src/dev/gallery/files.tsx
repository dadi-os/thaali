import { useEffect, type ReactNode } from "react";
import { isMeshOnline } from "../../shared/api";
import { useConnection } from "../../shared/hooks/useConnection";
import { FileModal } from "../../shared/components/Files";
import { MarkdownBody } from "../../shared/components/Markdown";
import { CASES } from "./cases";

/** The file explorer's and the box link's cases, against the fixture tree in `fixtures/files.ts`. */

const noop = () => undefined;
const HOME = "/var/home/dadi";
const COURSE = `${HOME}/msu/semester-5/cse-431`;

/** Connects the fixture transport once and shows its children when it is online, as the app does at boot, so a case reads the fixture tree instead of the offline state. */
function Connected({ children }: { children: ReactNode }) {
  const { state, connect } = useConnection();
  useEffect(() => {
    void connect();
  }, [connect]);
  return isMeshOnline(state) ? <>{children}</> : null;
}

/** The explorer opened at `path` in a window of 1440 x 900, as the modal sits over the app. */
function explorer(path: string, props: { onPick?: (paths: string[]) => void } = {}) {
  return (
    <Connected>
      <div style={{ position: "relative", width: 1440, height: 900 }}>
        <FileModal scoped path={path} onClose={noop} {...props} />
      </div>
    </Connected>
  );
}

/** Adds the row at `path` to the selection with a Command-click once it has listed, as a person would. */
function SelectAlso({ path, children }: { path: string; children: React.ReactNode }) {
  useEffect(() => {
    const timer = window.setInterval(() => {
      const row = [...document.querySelectorAll("[data-path]")].find((el) => el.getAttribute("data-path") === path);
      if (row !== undefined) {
        window.clearInterval(timer);
        row.dispatchEvent(new MouseEvent("click", { bubbles: true, metaKey: true }));
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [path]);
  return <>{children}</>;
}

CASES["files.explorer.folder"] = () => explorer(`${COURSE}/materials/lecture-09.md`);
CASES["files.explorer.image"] = () => explorer(`${HOME}/career/resume/headshot.png`);
CASES["files.explorer.dead"] = () => explorer(`${COURSE}/submissions/hw2.pdf`);
CASES["files.explorer.empty"] = () => explorer(`${HOME}/scratch/`);
CASES["files.explorer.pick"] = () => <SelectAlso path={`${COURSE}/work`}>{explorer(`${COURSE}/syllabus.pdf`, { onPick: noop })}</SelectAlso>;

CASES["files.link.message"] = () => (
  <Connected>
    <div data-selectable style={{ width: 520, padding: 24, fontSize: 15, lineHeight: 1.65 }}>
      <MarkdownBody
        content={[
          "I filed the answers in [hw3.zip](box:///var/home/dadi/msu/semester-5/cse-431/submissions/hw3.zip) and the notes are in the",
          "[materials folder](box:///var/home/dadi/msu/semester-5/cse-431/materials/). The earlier draft,",
          "[hw2.pdf](box:///var/home/dadi/msu/semester-5/cse-431/submissions/hw2.pdf), was removed.",
        ].join(" ")}
      />
    </div>
  </Connected>
);
