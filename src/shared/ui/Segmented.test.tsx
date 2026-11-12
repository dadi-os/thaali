// @vitest-environment happy-dom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { Segmented } from "./Segmented";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const OPTIONS = ["Day", "Week", "Month"] as const;

function Harness({ onChange }: { onChange: (value: string) => void }) {
  const [value, setValue] = useState<(typeof OPTIONS)[number]>("Day");
  return (
    <Segmented
      options={OPTIONS}
      value={value}
      onChange={(next) => {
        onChange(next);
        setValue(next);
      }}
    />
  );
}

async function mount(onChange = vi.fn()): Promise<HTMLElement> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  await act(async () => {
    createRoot(host).render(<Harness onChange={onChange} />);
  });
  return host;
}

describe("Segmented", () => {
  it("marks the chosen choice and draws one thumb behind it", async () => {
    const host = await mount();
    const radios = [...host.querySelectorAll<HTMLElement>("[role=radio]")];
    expect(radios.map((radio) => radio.getAttribute("aria-checked"))).toEqual(["true", "false", "false"]);
    expect(host.querySelectorAll(".seg-thumb")).toHaveLength(1);
    expect(radios[0]!.querySelector(".seg-thumb")).not.toBeNull();
  });

  it("moves the one thumb to the choice picked and reports it", async () => {
    const onChange = vi.fn();
    const host = await mount(onChange);
    const radios = [...host.querySelectorAll<HTMLElement>("[role=radio]")];
    await act(async () => {
      radios[2]!.click();
    });
    expect(onChange).toHaveBeenCalledWith("Month");
    expect(host.querySelectorAll(".seg-thumb")).toHaveLength(1);
    expect(radios[2]!.querySelector(".seg-thumb")).not.toBeNull();
    expect(radios[2]!.getAttribute("aria-checked")).toBe("true");
  });

  it("gives every choice the hover, press and focus treatment of the .seg class", async () => {
    const host = await mount();
    const radios = [...host.querySelectorAll<HTMLElement>("[role=radio]")];
    expect(radios.every((radio) => radio.classList.contains("seg") && radio.classList.contains("ui-trans"))).toBe(true);
  });
});
