/**
 * The ground dadi's waiting and onboarding screens sit on, as on the phone: bone, with sage
 * light pooling low on the left and high on the right, drifting slowly. Reduced motion holds
 * the pools still. Fills its positioned parent.
 */
export function FieldBloom() {
  return (
    <div aria-hidden className="field-bloom">
      <span className="field-bloom__pool field-bloom__pool--low" />
      <span className="field-bloom__pool field-bloom__pool--high" />
      <span className="field-bloom__pool field-bloom__pool--mid" />
    </div>
  );
}
