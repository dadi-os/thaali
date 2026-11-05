import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Icon } from "./Icon";

/** The classes of the bare element inside a field's box: it fills the row and draws nothing of its own, so the box shows focus. */
export const FIELD_INPUT = "cinp text-[15px] text-ink placeholder:text-ink-faint";

export type FieldProps = {
  /** The small capitals label above the box; leave it out for a row of inputs that carry their own `aria-label`. */
  label?: string;
  /** The box grows with its text, as notes do, instead of holding one 44 px line. */
  tall?: boolean;
  /** Drawn at the end of the box, such as a button or a chevron. */
  extra?: ReactNode;
  /** The id of the input the label names; without it the label is plain text and the input needs its own `aria-label`. */
  htmlFor?: string;
  /** Marks the field as having a problem: the box takes the error line. */
  invalid?: boolean;
  /** The input, textarea or select the box holds. */
  children: ReactNode;
};

/**
 * A label over a flat box that holds one input. The input is bare; the box takes the soft focus halo (see base.css),
 * so every text field in the app focuses the same way.
 */
export function Field({ label, tall = false, extra, htmlFor, invalid = false, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        htmlFor ? (
          <label htmlFor={htmlFor} className="ui-label">
            {label}
          </label>
        ) : (
          <span className="ui-label">{label}</span>
        )
      ) : null}
      <div
        className={`flex gap-2 rounded-[12px] border bg-bone px-3.5 transition-[border-color] duration-fast ease-dadi ${tall ? "min-h-24 items-start py-2.5" : "h-11 items-center"} ${invalid ? "border-error-line" : "border-glass-border"}`}
      >
        {children}
        {extra}
      </div>
    </div>
  );
}

export type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "size"> & {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  /** Drawn at the end of the box. */
  extra?: ReactNode;
  invalid?: boolean;
  /** Edit several lines (a textarea) instead of one. */
  rows?: number;
};

/** A {@link Field} holding a text input, or a textarea when `rows` is given; `onChange` receives the text. */
export function TextField({ label, value, onChange, extra, invalid, rows, className = "", ...rest }: TextFieldProps) {
  const id = useId();
  if (rows !== undefined) {
    const area = rest as TextareaHTMLAttributes<HTMLTextAreaElement>;
    return (
      <Field label={label} tall extra={extra} htmlFor={id} invalid={invalid}>
        <textarea id={id} aria-label={label} rows={rows} value={value} onChange={(event) => onChange(event.target.value)} className={`${FIELD_INPUT} resize-none leading-5 ${className}`} {...area} />
      </Field>
    );
  }
  return (
    <Field label={label} extra={extra} htmlFor={id} invalid={invalid}>
      <input id={id} type="text" aria-label={label} autoComplete="off" spellCheck={false} value={value} onChange={(event) => onChange(event.target.value)} className={`${FIELD_INPUT} ${className}`} {...rest} />
    </Field>
  );
}

export type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value"> & {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  /** The choices as [value, name] pairs. */
  options: ReadonlyArray<readonly [string, string]>;
};

/** A {@link Field} holding a select with a chevron; `onChange` receives the chosen value. */
export function SelectField({ label, value, onChange, options, className = "", ...rest }: SelectFieldProps) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} extra={<Icon name="chevDown" size={14} />}>
      <select id={id} aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className={`${FIELD_INPUT} appearance-none ${className}`} {...rest}>
        {options.map(([optionValue, name]) => (
          <option key={optionValue} value={optionValue}>
            {name}
          </option>
        ))}
      </select>
    </Field>
  );
}

export type FieldGroupProps = {
  /** A label over the whole group, such as "Websites". */
  label?: string;
  children: ReactNode;
};

/** Fields stacked on one 8 px gap, optionally under one label. */
export function FieldGroup({ label, children }: FieldGroupProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label ? <span className="ui-label">{label}</span> : null}
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}
