export default function ErrorState({ title = 'Something went wrong', error, onRetry }) {
  const message =
    typeof error === 'string'
      ? error
      : error?.message || 'An unexpected error occurred. Please try again.';
  return (
    <div className="error-state" role="alert">
      <h3>{title}</h3>
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-outline btn-sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
