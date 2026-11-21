import type { ComponentPropsWithRef } from "react";

/** The look of a row in a list that opens or does something: a full-width control with a rounded wash on hover and press. */
export const LIST_ROW_CLASS = "ui-hover-fill ui-trans flex w-full min-w-0 items-center gap-3 rounded-[12px] px-3 py-2 text-left";

/** Props of {@link ListRow}: every button attribute. */
export type ListRowProps = ComponentPropsWithRef<"button">;

/** A list row that is a button: its content (a title and a quieter line, a leading mark, a trailing value) is yours, the wash and press are the app's. */
export function ListRow({ className, type = "button", ...rest }: ListRowProps) {
  return <button type={type} className={[LIST_ROW_CLASS, className ?? ""].filter(Boolean).join(" ")} {...rest} />;
}
