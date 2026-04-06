import { FiInbox } from 'react-icons/fi';
import './EmptyState.css';

export default function EmptyState({
  icon = null,
  IconComponent = FiInbox,
  title = 'No data found',
  description = '',
  action = null,
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon-wrap">
        {icon
          ? <span className="empty-state-emoji">{icon}</span>
          : <IconComponent size={40} className="empty-state-icon" />
        }
      </div>
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-desc">{description}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}
