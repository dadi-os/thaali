/*
 * Injected into both sides of the fidelity gate before the page's own scripts: pins the clock when the
 * URL carries `__clock=<ISO>`, and defines `window.__ds`, the gate's browser-side half:
 *   prepare(opts)  mark or place the case root (a primitive is placed on a plain ground; a `page` is left as it is), clone :hover/:active/:focus rules onto classes
 *   force(pairs)   put a state on matching elements (and their ancestors, as a real pointer would)
 *   addClass(pairs) add a real class, or remove it with a third element "remove", starting the transition it triggers
 *   finish()       jump every running transition and finite animation to its end, infinite ones to the start
 *   seek(ms)       jump every animation and transition to `ms` after its start
 *   extract(root)  the element tree: tag, own text, attributes, box, computed style, pseudo-element content, and the root's own rectangle on the page
 */
(() => {
  window.__errs = [];
  const params = new URLSearchParams(location.search);
  const clock = params.get("__clock");
  if (clock !== null) {
    const frozen = Date.parse(clock);
    if (Number.isNaN(frozen)) {
      throw new Error(`__clock "${clock}" is not an ISO instant`);
    }
    const RealDate = Date;
    class FrozenDate extends RealDate {
      constructor(...args) {
        if (args.length === 0) {
          super(frozen);
        } else {
          super(...args);
        }
      }
      static now() {
        return frozen;
      }
    }
    window.Date = FrozenDate;
  }

  const PROPS = [
    "display", "position", "top", "right", "bottom", "left", "z-index", "float", "box-sizing",
    "flex-direction", "flex-wrap", "flex-grow", "flex-shrink", "flex-basis", "order",
    "align-items", "align-self", "align-content", "justify-content", "justify-items", "justify-self",
    "row-gap", "column-gap", "grid-template-columns", "grid-template-rows", "grid-template-areas", "grid-area",
    "grid-column-start", "grid-column-end", "grid-row-start", "grid-row-end", "grid-auto-flow",
    "width", "height", "min-width", "min-height", "max-width", "max-height", "aspect-ratio",
    "margin-top", "margin-right", "margin-bottom", "margin-left",
    "padding-top", "padding-right", "padding-bottom", "padding-left",
    "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
    "border-top-style", "border-right-style", "border-bottom-style", "border-left-style",
    "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
    "border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius",
    "overflow-x", "overflow-y", "overscroll-behavior", "scrollbar-width",
    "color", "background-color", "background-image", "background-size", "background-position", "background-repeat",
    "opacity", "box-shadow", "filter", "backdrop-filter", "mix-blend-mode", "mask-image", "-webkit-mask-image",
    "transform", "transform-origin", "translate", "scale", "rotate",
    "transition-property", "transition-duration", "transition-timing-function", "transition-delay",
    "animation-name", "animation-duration", "animation-timing-function", "animation-delay",
    "animation-iteration-count", "animation-direction", "animation-fill-mode",
    "font-family", "font-size", "font-weight", "font-style", "font-variant-numeric", "font-feature-settings",
    "line-height", "letter-spacing", "word-spacing", "text-transform", "text-align", "text-indent", "text-overflow",
    "white-space", "overflow-wrap", "word-break", "-webkit-line-clamp", "-webkit-box-orient", "text-decoration-line",
    "vertical-align", "cursor", "pointer-events", "user-select", "resize", "visibility", "appearance",
    "outline-width", "outline-style", "outline-color", "outline-offset",
    "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
  ];
  const ATTRS = ["role", "title", "type", "tabindex", "href", "disabled", "placeholder", "name", "rows", "autocomplete", "spellcheck",
    "d", "viewBox", "width", "height", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "xmlns"];
  const SKIP = new Set(["SCRIPT", "STYLE", "LINK", "TITLE", "META", "HEAD", "NOSCRIPT"]);
  const STATES = { hover: [":hover"], active: [":active"], focus: [":focus-visible", ":focus-within", ":focus"] };

  /** Calls `visit(rule, container)` for every style rule under `container`, descending through @media, @layer, @supports and @container. */
  function visitRules(container, visit) {
    for (const rule of Array.from(container.cssRules)) {
      if (rule.cssRules && !rule.selectorText) {
        visitRules(rule, visit);
      }
      visit(rule, container);
    }
  }

  /** Adds, beside every rule that depends on a pointer or focus state, a copy keyed on a class the gate can set. */
  function cloneStateRules() {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        void sheet.cssRules;
      } catch {
        continue;
      }
      visitRules(sheet, (rule, container) => {
        if (!rule.selectorText) {
          return;
        }
        let selector = rule.selectorText;
        let changed = false;
        for (const [state, pseudos] of Object.entries(STATES)) {
          for (const pseudo of pseudos) {
            if (selector.includes(pseudo)) {
              selector = selector.split(pseudo).join(`.__ds-${state}`);
              changed = true;
            }
          }
        }
        if (!changed) {
          return;
        }
        const body = rule.cssText.slice(rule.cssText.indexOf("{"));
        container.insertRule(`${selector}${body}`, Array.from(container.cssRules).indexOf(rule) + 1);
      });
    }
  }

  const ds = {
    root: () => document.querySelector("[data-ds-case]"),

    prepare({ width = null, height = null, root: rootSelector = null, page = false, ground = "#fafaf7" }) {
      if (rootSelector !== null) {
        const chosen = document.querySelector(rootSelector);
        if (chosen === null) {
          throw new Error(`no element matches the case root "${rootSelector}"`);
        }
        for (const marked of document.querySelectorAll("[data-ds-case]")) {
          marked.removeAttribute("data-ds-case");
        }
        chosen.setAttribute("data-ds-case", "page");
      }
      const root = ds.root();
      if (root === null) {
        throw new Error("no [data-ds-case] root on the page");
      }
      if (!page) {
        const style = document.createElement("style");
        style.id = "__ds-gate";
        style.textContent = `html,body{background:${ground}!important;margin:0!important;height:auto!important;min-height:0!important;overflow:visible!important}#root{height:auto!important;overflow:visible!important}`;
        document.head.appendChild(style);
        root.style.position = "fixed";
        root.style.left = "24px";
        root.style.top = "24px";
      }
      if (width !== null) {
        root.style.width = `${width}px`;
      }
      if (height !== null) {
        root.style.height = `${height}px`;
      }
      cloneStateRules();
      return true;
    },

    force(pairs) {
      const root = ds.root();
      for (const [selector, state] of pairs) {
        for (const el of root.querySelectorAll(selector)) {
          el.classList.add(`__ds-${state}`);
          if (state !== "focus") {
            for (let up = el.parentElement; up && up !== document.body; up = up.parentElement) {
              up.classList.add(`__ds-${state}`);
            }
          }
        }
      }
      return pairs.length;
    },

    /** Adds a real class to matching elements, starting whatever transition that class triggers: the gate's stand-in for a click that opens something. */
    addClass(pairs) {
      const root = ds.root();
      for (const [selector, name, op] of pairs) {
        for (const el of root.querySelectorAll(selector)) {
          if (op === "remove") {
            el.classList.remove(name);
          } else {
            el.classList.add(name);
          }
        }
      }
      return pairs.length;
    },

    finish() {
      for (const animation of document.getAnimations()) {
        const timing = animation.effect.getComputedTiming();
        animation.pause();
        animation.currentTime = Number.isFinite(timing.endTime) ? timing.endTime : 0;
      }
      return document.getAnimations().length;
    },

    seek(ms) {
      for (const animation of document.getAnimations()) {
        animation.pause();
        animation.currentTime = ms;
      }
      return document.getAnimations().length;
    },

    extract() {
      const root = ds.root();
      const origin = root.getBoundingClientRect();
      const walk = (el) => {
        const cs = getComputedStyle(el);
        const style = {};
        for (const prop of PROPS) {
          style[prop] = cs.getPropertyValue(prop);
        }
        const attrs = {};
        for (const name of ATTRS) {
          if (el.hasAttribute(name)) {
            attrs[name] = el.getAttribute(name);
          }
        }
        for (const attr of Array.from(el.attributes)) {
          if (attr.name.startsWith("aria-")) {
            attrs[attr.name] = attr.value;
          }
        }
        const pseudo = {};
        for (const which of ["::before", "::after"]) {
          const content = getComputedStyle(el, which).content;
          if (content !== "none" && content !== "normal") {
            pseudo[which] = { content, display: getComputedStyle(el, which).display };
          }
        }
        const rect = el.getBoundingClientRect();
        const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").replace(/\s+/g, " ").trim();
        return {
          tag: el.tagName.toLowerCase(),
          text: own,
          attrs,
          rect: { x: +(rect.x - origin.x).toFixed(2), y: +(rect.y - origin.y).toFixed(2), w: +rect.width.toFixed(2), h: +rect.height.toFixed(2) },
          style,
          pseudo,
          children: Array.from(el.children).filter((c) => !SKIP.has(c.tagName)).map(walk),
        };
      };
      const tree = walk(root);
      tree.page = { x: +origin.x.toFixed(2), y: +origin.y.toFixed(2), w: +origin.width.toFixed(2), h: +origin.height.toFixed(2) };
      return JSON.stringify(tree);
    },
  };
  window.__ds = ds;
})();
