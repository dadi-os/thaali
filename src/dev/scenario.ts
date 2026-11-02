/**
 * The states the fixture transport can put Thaali in, chosen with `?fixtures=<name>` on a
 * dev-server URL (see README "Visual loop"). Each one is a different answer from the same
 * typed fixtures, so every page can be looked at in every state without a box.
 */
export const SCENARIOS = [
  "normal",
  "loading",
  "offline",
  "blip",
  "module-offline",
  "errors",
  "empty",
  "long",
  "many",
  "asking",
  "tasks-error",
  "refused",
] as const;

/** One of {@link SCENARIOS}. */
export type Scenario = (typeof SCENARIOS)[number];

function isScenario(name: string): name is Scenario {
  return (SCENARIOS as readonly string[]).includes(name);
}

/**
 * The scenario the `fixtures` query parameter names, or null when it is absent.
 * @throws When the parameter names no scenario.
 */
export function readScenario(search: string): Scenario | null {
  const name = new URLSearchParams(search).get("fixtures");
  if (name === null) {
    return null;
  }
  if (!isScenario(name)) {
    throw new Error(`unknown fixtures scenario "${name}"; use one of ${SCENARIOS.join(", ")}`);
  }
  return name;
}
