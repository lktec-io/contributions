import { useState, useEffect, useContext } from 'react';
import { FiCalendar, FiAlertTriangle, FiEye } from 'react-icons/fi';
import { ToastContext } from '../../context/ToastContext';
import { eventService } from '../../services/eventService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/helpers';
import LoadingSpinner from '../common/LoadingSpinner';
import EmptyState from '../common/EmptyState';
import './ClientEvents.css';

export default function ClientEvents({ onViewContributions }) {
  const { toast } = useContext(ToastContext);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { fetchEvents(); }, []);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await eventService.getAll();
      setEvents(res.data.data || []);
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="tab-loading"><LoadingSpinner size="large" /></div>;
  if (error) return (
    <div className="error-state">
      <FiAlertTriangle size={36} color="var(--accent-orange)" />
      <p>{error}</p>
      <button className="btn" onClick={fetchEvents}>Retry</button>
    </div>
  );

  return (
    <div className="client-events">
      <div className="page-header">
        <div>
          <h2 className="page-title">My Events</h2>
          <p className="page-subtitle">{events.length} event{events.length !== 1 ? 's' : ''} assigned to you</p>
        </div>
      </div>

      {events.length === 0 ? (
        <EmptyState
          IconComponent={FiCalendar}
          title="No events assigned"
          description="Your events will appear here once the admin assigns them to you."
        />
      ) : (
        <div className="events-grid">
          {events.map(ev => (
            <div key={ev.id} className="event-card">
              <div className="event-card-top">
                <h3 className="event-card-name">{ev.name}</h3>
                <span className="event-card-date">{formatDate(ev.created_at)}</span>
              </div>
              {ev.description && (
                <p className="event-card-desc">{ev.description}</p>
              )}
              <div className="event-card-meta">
                <div className="meta-item">
                  <span className="meta-label">Target</span>
                  <span className="meta-value">{formatCurrency(ev.target_amount)}</span>
                </div>
              </div>
              <button
                className="btn event-view-btn"
                onClick={() => onViewContributions && onViewContributions(ev)}
              >
                <FiEye size={14} /> View Contributors
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
