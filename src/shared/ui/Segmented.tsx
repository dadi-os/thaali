export type SegmentedProps<Option extends string> = {
  options: readonly Option[];
  value: Option;
  onChange: (option: Option) => void;
};

/** A switch between a few exclusive options, the chosen one raised on a sage track. */
export function Segmented<Option extends string>({ options, value, onChange }: SegmentedProps<Option>) {
  return (
    <div className="segmented">
      {options.map((option) => (
        <button key={option} type="button" className="ui-trans" aria-pressed={option === value} onClick={() => onChange(option)}>
          {option}
        </button>
      ))}
    </div>
  );
}
