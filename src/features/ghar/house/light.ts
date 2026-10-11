/**
 * The light a Ghar lamp gives off, for drawing it: its color from the last color Ghar
 * heard it take (hue and saturation, or a white's color temperature) and its level.
 */

import type { GharDevice } from "../../../types/ghar";

/** What a lit lamp with no color reading (a plain on/off light) glows: the house sage. */
export const PLAIN_LAMP = "var(--sage)";

/** True for devices that switch on and off. */
export function isSwitchable(device: GharDevice): boolean {
  return device.capabilities.some((cap) => cap.capability === "switchable");
}

/** True when Ghar last heard the device on. */
export function isOn(device: GharDevice): boolean {
  return device.state.on?.value === true;
}

/** A reported attribute with when it changed, or null when Ghar has none or it is not a number. */
function reading(device: GharDevice, key: string): { value: number; at: number } | null {
  const attr = device.state[key];
  return attr && typeof attr.value === "number"
    ? { value: attr.value, at: Date.parse(attr.changed_at) }
    : null;
}

/**
 * kelvinRgb approximates the color of a white at `kelvin` (Tanner Helland's fit of the
 * blackbody curve, good from 1000 K to 40000 K) as 0–255 channels.
 */
export function kelvinRgb(kelvin: number): [number, number, number] {
  const t = Math.min(40_000, Math.max(1_000, kelvin)) / 100;
  const clamp = (v: number) => Math.round(Math.min(255, Math.max(0, v)));
  const red = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const green = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492;
  const blue = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [clamp(red), clamp(green), clamp(blue)];
}

/**
 * lampColor is the CSS color a lamp shines when on, or null for a device with no color
 * reading. Matter does not report which color mode is active, so the reading Ghar heard
 * change last wins; on a tie (both set at commissioning) the white point does.
 */
export function lampColor(device: GharDevice): string | null {
  const hue = reading(device, "hue");
  const temp = reading(device, "color_temp");
  if (temp && temp.value > 0 && (!hue || temp.at >= hue.at)) {
    const [r, g, b] = kelvinRgb(1_000_000 / temp.value);
    return `rgb(${r} ${g} ${b})`;
  }
  if (hue) {
    const saturation = reading(device, "saturation")?.value;
    const sat = saturation === undefined ? 100 : Math.round((saturation / 254) * 100);
    return `hsl(${Math.round((hue.value / 254) * 360)} ${sat}% 58%)`;
  }
  return null;
}

/** How bright a lamp is, 0–1: its brightness over the dimmable range, or 1 when it does not dim. */
export function lampLevel(device: GharDevice): number {
  const dimmable = device.capabilities.find((cap) => cap.capability === "dimmable");
  const brightness = reading(device, "brightness");
  if (!dimmable || !brightness) {
    return 1;
  }
  const max = typeof dimmable.config?.max === "number" ? dimmable.config.max : 254;
  return Math.min(1, Math.max(0, brightness.value / max));
}

/**
 * roomGlow is a CSS background that washes a room in the light of its lit lamps (one soft
 * pool per lamp from the top edge, stronger the brighter it is), or null when none is lit.
 */
export function roomGlow(lamps: GharDevice[]): string | null {
  const lit = lamps.filter((lamp) => lamp.online && isOn(lamp));
  if (lit.length === 0) {
    return null;
  }
  return lit
    .map((lamp, index) => {
      const x = Math.round(((index + 0.5) / lit.length) * 100);
      const strength = Math.round(14 + 22 * lampLevel(lamp));
      const color = lampColor(lamp) ?? PLAIN_LAMP;
      return `radial-gradient(120% 90% at ${x}% -10%, color-mix(in srgb, ${color} ${strength}%, transparent), transparent 70%)`;
    })
    .join(", ");
}
