/**
 * The THREADS monogram (same shape as the favicon). By default the
 * colours follow the current theme; `fixed` locks the cream-on-ink
 * palette for always-dark surfaces (footer, admin sidebar, login).
 */
export default function Logo({ size = 26, fixed = false, className = '' }) {
  const tile = fixed ? '#f6f3ee' : 'var(--ink)';
  const glyph = fixed ? '#17130f' : 'var(--paper)';
  const accent = fixed ? '#c86b4a' : 'var(--accent)';
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="64" height="64" rx="14" fill={tile} />
      <rect x="14" y="17" width="36" height="9" rx="2" fill={glyph} />
      <rect x="27.5" y="17" width="9" height="31" rx="2" fill={glyph} />
      <rect x="14" y="50" width="16" height="5" rx="2.5" fill={accent} />
    </svg>
  );
}
