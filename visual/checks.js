/* Injected by snap.swift after a page settles; returns a report of layout and craft findings. */
window.__runChecks = function () {
  const found = {};
  const add = (type, el, detail) => {
    const list = (found[type] ||= []);
    if (list.length >= 40) return;
    const rect = el.getBoundingClientRect();
    const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 4).join(".") : "";
    list.push({
      el: el.tagName.toLowerCase() + (cls ? "." + cls : ""),
      text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60),
      rect: [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)],
      detail,
    });
  };
  const visible = (el, s) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.02;
  };
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/) || c.match(/color\(srgb ([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    const scale = c.startsWith("color(") ? 255 : 1;
    return { r: p[0] * scale, g: p[1] * scale, b: p[2] * scale, a: p.length > 3 ? p[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  const backdrop = (el) => {
    let layers = [];
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.backgroundImage !== "none") return null;
      const c = parse(s.backgroundColor);
      if (c && c.a > 0) {
        layers.push(c);
        if (c.a >= 1) break;
      }
    }
    let base = { r: 250, g: 250, b: 247, a: 1 };
    for (const layer of layers.reverse()) base = over(layer, base);
    return base;
  };
  const scrolls = (s) => /(auto|scroll)/.test(s.overflowY) || /(auto|scroll)/.test(s.overflowX);

  const all = [...document.body.querySelectorAll("*")];
  let checked = 0;
  for (const el of all) {
    const s = getComputedStyle(el);
    if (!visible(el, s) || el.closest("svg, canvas") || el.matches(".sr-only") || el.closest(".sr-only")) continue;
    checked++;
    const clipsX = /(hidden|clip)/.test(s.overflowX);
    const hasOwnText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);

    if (hasOwnText && clipsX && el.scrollWidth > el.clientWidth + 1) {
      const clamped = s.webkitLineClamp && s.webkitLineClamp !== "none";
      if (s.textOverflow !== "ellipsis" && !clamped) add("text-clipped-no-ellipsis", el, `scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}`);
      else if (!el.closest("[title],[aria-label]") && !el.closest("[data-tooltip]")) add("truncated-without-title", el, `scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}`);
    }
    if (hasOwnText && !clipsX && s.display !== "inline" && el.scrollWidth > el.clientWidth + 1 && !scrolls(s)) {
      add("content-spills-box", el, `scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}`);
    }
    if (s.display.includes("flex") && s.flexDirection.startsWith("row") && el.scrollWidth > el.clientWidth + 1 && !scrolls(s) && !clipsX) {
      for (const child of el.children) {
        const cs = getComputedStyle(child);
        if (cs.minWidth === "auto" && cs.overflowX === "visible" && cs.flexShrink !== "0" && child.scrollWidth > child.clientWidth + 1) {
          add("flex-child-missing-min-w-0", child, `parent ${el.tagName.toLowerCase()} overflows by ${el.scrollWidth - el.clientWidth}px`);
        }
      }
    }
    if (s.position !== "absolute" && s.position !== "fixed" && el.parentElement) {
      const ps = getComputedStyle(el.parentElement);
      if (!scrolls(ps) && ps.overflowX === "visible" && el.parentElement !== document.body) {
        const r = el.getBoundingClientRect();
        const p = el.parentElement.getBoundingClientRect();
        if (p.width > 0 && r.right > p.right + 2 && r.left >= p.left) add("overflows-parent", el, `${Math.round(r.right - p.right)}px past parent's right edge`);
      }
    }
    const disabled = el.matches(":disabled,[aria-disabled=true]") || !!el.closest("[aria-disabled=true]");
    if (el.matches("a[href],button,[role=button],input,select,textarea,[tabindex]:not([tabindex='-1'])") && s.pointerEvents !== "none" && !disabled) {
      const owner = el.tagName === "INPUT" ? el.closest("label") || el : el;
      const r = owner.getBoundingClientRect();
      if (r.width < 32 || r.height < 32) add("small-target", el, `${Math.round(r.width)}x${Math.round(r.height)}`);
      if (!el.textContent.trim() && !el.getAttribute("aria-label") && !el.getAttribute("title") && !el.querySelector("[aria-label]") && el.tagName !== "INPUT") add("icon-control-without-name", el, "no text, aria-label or title");
    }
    if (hasOwnText && !disabled) {
      const fg = parse(s.color);
      const bg = backdrop(el);
      if (fg && bg) {
        const eff = over({ ...fg, a: fg.a * Number(s.opacity) }, bg);
        const [a, b] = [lum(eff), lum(bg)].sort((x, y) => y - x);
        const ratio = (a + 0.05) / (b + 0.05);
        const size = parseFloat(s.fontSize);
        const large = size >= 24 || (size >= 18.66 && Number(s.fontWeight) >= 700);
        if (ratio < (large ? 3 : 4.5)) add("low-contrast", el, `${ratio.toFixed(2)}:1 at ${size}px`);
      }
    }
    if (/%$/.test(s.maxHeight)) add("percentage-max-height", el, s.maxHeight);
    if (scrolls(s) && el.scrollHeight > el.clientHeight + 1) {
      for (let n = el.parentElement; n; n = n.parentElement) {
        const ps = getComputedStyle(n);
        if (scrolls(ps) && n.scrollHeight > n.clientHeight + 1) {
          add("nested-scroll-container", el, `inside ${n.tagName.toLowerCase()}.${(typeof n.className === "string" ? n.className : "").trim().split(/\s+/).slice(0, 2).join(".")}`);
          break;
        }
      }
    }
    if (s.transitionDuration === "0s" && el.matches("button,a[href],[role=button],[tabindex]") && !el.disabled) add("interactive-without-transition", el, "no CSS transition on an interactive element");
  }
  const mounts = window.__mounts.filter((m) => !m.animated);
  if (mounts.length) found["mounted-without-animation"] = mounts.slice(0, 40).map((m) => ({ el: m.el, text: m.text, rect: [0, 0, m.w, m.h], detail: "appeared with no animation, opacity or transform change" }));
  const counts = Object.fromEntries(Object.entries(found).map(([k, v]) => [k, v.length]));
  return { checkedElements: checked, scroll: { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }, counts, found };
};
