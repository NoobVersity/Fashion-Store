export default function EmptyState({ title = 'Nothing here yet', message, action }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {message && <p className="muted mb-0">{message}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
