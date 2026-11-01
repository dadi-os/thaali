/* Runs before the page's own scripts: records console errors and what mounts without motion. */
window.__errs = [];
for (const level of ["error", "warn"]) {
  const original = console[level].bind(console);
  console[level] = (...args) => {
    window.__errs.push(level + ": " + args.map((a) => (a instanceof Error ? a.stack : typeof a === "object" ? JSON.stringify(a) : String(a))).join(" "));
    original(...args);
  };
}
window.addEventListener("error", (e) => window.__errs.push("uncaught: " + e.message + " @ " + e.filename + ":" + e.lineno));
window.addEventListener("unhandledrejection", (e) => window.__errs.push("unhandled rejection: " + ((e.reason && e.reason.stack) || e.reason)));

window.__mounts = [];
window.__mountSince = 0;
function describe(el) {
  const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 3).join(".") : "";
  return el.tagName.toLowerCase() + (cls ? "." + cls : "");
}
new MutationObserver((records) => {
  const at = performance.now();
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (!(node instanceof HTMLElement) || at < window.__mountSince) continue;
      requestAnimationFrame(() => {
        const rect = node.getBoundingClientRect();
        if (!node.isConnected || rect.width < 12 || rect.height < 12) return;
        const style = getComputedStyle(node);
        let moving = node.getAnimations({ subtree: true }).length > 0 || Number(style.opacity) < 0.99 || style.transform !== "none" || parseFloat(style.transitionDuration) > 0;
        for (let up = node.parentElement; up && !moving && up !== document.body; up = up.parentElement) {
          const us = getComputedStyle(up);
          moving = up.getAnimations().length > 0 || Number(us.opacity) < 0.99 || (us.transform !== "none" && us.transform !== "matrix(1, 0, 0, 1, 0, 0)");
        }
        window.__mounts.push({ at, el: describe(node), text: (node.textContent || "").trim().slice(0, 48), animated: moving, w: Math.round(rect.width), h: Math.round(rect.height) });
      });
    }
  }
}).observe(document, { childList: true, subtree: true });
