/**
 * The DOM half of the fidelity gate: walks the design tree and the app tree in step and lists every
 * difference in structure, text, attributes, box and computed style. A tree is the JSON that
 * `window.__ds.extract()` returns.
 */

/**
 * Normalises a computed value before comparing: the font stack is reduced to its first family, since
 * the design's and the app's fallbacks differ and the first family is what both render.
 */
function normalise(prop, value, config) {
  if (prop === "font-family") {
    return value.split(",")[0].trim().replace(/["']/g, "");
  }
  return config.normalise?.[prop]?.(value) ?? value;
}

/**
 * Compares two element trees.
 * @param design the design side's tree
 * @param app the app side's tree
 * @param config `{ boxTolerance, ignoreProps, ignoreAttrs }`: pixels of slack on x/y/w/h, computed properties and attributes to skip
 * @returns the differences, each `{ path, kind, prop, design, app }`
 */
export function compareTrees(design, app, config) {
  const diffs = [];
  const ignored = new Set(config.ignoreProps);
  const ignoredAttrs = new Set(config.ignoreAttrs);
  const visit = (a, b, path) => {
    if (a.tag !== b.tag) {
      diffs.push({ path, kind: "tag", prop: "tag", design: a.tag, app: b.tag });
      return;
    }
    const here = `${path}>${a.tag}`;
    if (a.text !== b.text) {
      diffs.push({ path: here, kind: "text", prop: "text", design: a.text, app: b.text });
    }
    for (const name of new Set([...Object.keys(a.attrs), ...Object.keys(b.attrs)])) {
      if (!ignoredAttrs.has(name) && a.attrs[name] !== b.attrs[name]) {
        diffs.push({ path: here, kind: "attr", prop: name, design: a.attrs[name] ?? null, app: b.attrs[name] ?? null });
      }
    }
    for (const axis of ["x", "y", "w", "h"]) {
      if (Math.abs(a.rect[axis] - b.rect[axis]) > config.boxTolerance) {
        diffs.push({ path: here, kind: "box", prop: axis, design: a.rect[axis], app: b.rect[axis] });
      }
    }
    for (const prop of Object.keys(a.style)) {
      if (ignored.has(prop)) {
        continue;
      }
      const left = normalise(prop, a.style[prop], config);
      const right = normalise(prop, b.style[prop], config);
      if (left !== right) {
        diffs.push({ path: here, kind: "style", prop, design: left, app: right });
      }
    }
    for (const which of new Set([...Object.keys(a.pseudo), ...Object.keys(b.pseudo)])) {
      if (JSON.stringify(a.pseudo[which]) !== JSON.stringify(b.pseudo[which])) {
        diffs.push({ path: here, kind: "pseudo", prop: which, design: JSON.stringify(a.pseudo[which] ?? null), app: JSON.stringify(b.pseudo[which] ?? null) });
      }
    }
    if (a.children.length !== b.children.length) {
      diffs.push({ path: here, kind: "children", prop: "count", design: a.children.length, app: b.children.length });
    }
    const shared = Math.min(a.children.length, b.children.length);
    for (let i = 0; i < shared; i++) {
      visit(a.children[i], b.children[i], `${here}[${i}]`);
    }
  };
  visit(design, app, "");
  return diffs;
}
