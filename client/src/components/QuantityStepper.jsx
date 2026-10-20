export default function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  disabled = false,
}) {
  const clamp = (n) => Math.max(min, Math.min(max, n));
  return (
    <div className="qty-stepper" role="group" aria-label="Quantity">
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled || value <= min}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        aria-label="Quantity"
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!Number.isNaN(n)) onChange(clamp(n));
        }}
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={disabled || value >= max}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
