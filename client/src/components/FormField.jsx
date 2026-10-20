/**
 * Labelled form control used by checkout and the admin forms.
 * Renders an <input> by default; use `as="textarea"` or
 * `as="select"` (with `options`) otherwise.
 */
export default function FormField({
  label,
  value,
  onChange,
  as = 'input',
  type = 'text',
  options = [],
  error,
  hint,
  required = false,
  name,
  placeholder,
  autoComplete,
  min,
  max,
  rows = 4,
  disabled = false,
}) {
  const id = `f-${name || label.replace(/\s+/g, '-').toLowerCase()}`;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {as === 'textarea' ? (
        <textarea
          id={id}
          name={name}
          rows={rows}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : as === 'select' ? (
        <select
          id={id}
          name={name}
          value={value}
          disabled={disabled}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((o) => (
            <option key={String(o.value)} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          value={value}
          min={min}
          max={max}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {error && (
        <span className="field-error" id={`${id}-error`}>
          {error}
        </span>
      )}
      {!error && hint && (
        <span className="field-hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
    </div>
  );
}
