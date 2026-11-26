// @vitest-environment happy-dom
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppRouter } from "./AppRouter";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;
let go: (path: string) => void = () => undefined;

function Probe() {
  const location = useLocation();
  const navigate = useNavigate();
  go = (path) => navigate(path);
  return <p data-testid="where">{location.pathname}</p>;
}

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root.render(
      <AppRouter>
        <Probe />
      </AppRouter>,
    ),
  );
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("AppRouter", () => {
  it("commits a page change at the priority of any other update, so it never waits behind the rail", () => {
    const where = () => host.querySelector('[data-testid="where"]')!.textContent;
    expect(where()).toBe("/");
    // An urgent flush (what a chat-rail store update causes) must carry the navigation with it. A navigation wrapped in
    // startTransition stays on the old page here, and is left to be rendered in slices and restarted by later urgent updates.
    flushSync(() => go("/planner"));
    expect(where()).toBe("/planner");
  });
});
