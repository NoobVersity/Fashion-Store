export default function Loader({ label = 'Loading…', inline = false }) {
  if (inline) {
    return (
      <span className="row" role="status">
        <span className="spinner spinner-sm" />
        <span className="muted small">{label}</span>
      </span>
    );
  }
  return (
    <div className="loading-block" role="status">
      <div className="spinner" />
      <p className="muted small mt-2">{label}</p>
    </div>
  );
}
