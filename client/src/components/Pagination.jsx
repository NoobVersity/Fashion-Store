/** Compact page control: previous, a small page window, next. */
export default function Pagination({ page, totalPages, onChange }) {
  if (!totalPages || totalPages <= 1) return null;

  const pages = [];
  const push = (n) => pages.push(n);
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i += 1) push(i);
  } else {
    push(1);
    if (page > 3) pages.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i += 1) push(i);
    if (page < totalPages - 2) pages.push('…');
    push(totalPages);
  }

  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        ‹
      </button>
      {pages.map((p, idx) =>
        p === '…' ? (
          <span key={`e-${idx}`} className="ellipsis">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            className={p === page ? 'active' : ''}
            aria-current={p === page ? 'page' : undefined}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        )
      )}
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next page"
      >
        ›
      </button>
    </nav>
  );
}
