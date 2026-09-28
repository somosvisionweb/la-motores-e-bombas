export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      {icon ? <div className="empty__icon">{icon}</div> : null}
      <p className="empty__title">{title}</p>
      {children ? <p style={{ maxWidth: 420 }}>{children}</p> : null}
      {action ? <div style={{ marginTop: 6 }}>{action}</div> : null}
    </div>
  );
}
