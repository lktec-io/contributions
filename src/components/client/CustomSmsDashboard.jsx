import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiUsers, FiSend, FiCheckCircle, FiClock,
  FiPlus, FiUpload, FiFileText, FiDownload,
} from 'react-icons/fi';
import { AuthContext } from '../../context/AuthContext';
import { ToastContext } from '../../context/ToastContext';
import { contributorService } from '../../services/contributorService';
import { eventService } from '../../services/eventService';
import { getErrorMessage } from '../../utils/helpers';
import { StatsSkeleton } from '../common/SkeletonLoader';
import './CustomSmsDashboard.css';

/*  Communication dashboard for sms_mode = 'custom'.
    Every figure below is derived from the member list the API actually
    returns — nothing is invented, and no financial data is read or shown.  */

export default function CustomSmsDashboard() {
  const { user }  = useContext(AuthContext);
  const { toast } = useContext(ToastContext);
  const navigate  = useNavigate();

  const [members,  setMembers]  = useState([]);
  const [campaign, setCampaign] = useState({ canSend: true, daysRemaining: 0 });
  const [eventName, setEventName] = useState('');
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    contributorService.getMembers()
      .then(res => {
        const d = res.data.data;
        setMembers(d.members || []);
        if (d.campaign) setCampaign(d.campaign);
      })
      .catch(err => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Event is context only — the API sends custom accounts just id + name.
  useEffect(() => {
    eventService.getAll()
      .then(res => {
        const list = res.data.data || [];
        if (list.length) setEventName(list[0].name || '');
      })
      .catch(() => {});
  }, []);

  const total     = members.length;
  const contacted = members.filter(m => !m.canSend).length;
  const available = total - contacted;

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const stats = [
    { key: 'members',   label: 'Members',           value: total,     Icon: FiUsers,       tone: 'blue' },
    { key: 'sent',      label: 'Recently Contacted', value: contacted, Icon: FiSend,        tone: 'green' },
    { key: 'available', label: 'Available Members', value: available, Icon: FiCheckCircle, tone: 'teal' },
    {
      key: 'campaign',
      label: 'Campaign Status',
      value: campaign.canSend ? 'Available' : `${campaign.daysRemaining}d`,
      hint:  campaign.canSend ? 'Ready to send' : 'Cooldown active',
      Icon: FiClock,
      tone: campaign.canSend ? 'green' : 'amber',
    },
  ];

  const actions = [
    { label: 'Add Member',            Icon: FiPlus,     to: '/contributions?action=add' },
    { label: 'Import Excel',          Icon: FiUpload,   to: '/contributions?action=import' },
    { label: 'Send Custom SMS to All', Icon: FiSend,    to: '/contributions?action=sendall', primary: true },
    { label: 'Download PDF',          Icon: FiFileText, to: '/contributions?action=pdf' },
    { label: 'Download Excel',        Icon: FiDownload, to: '/contributions?action=xlsx' },
  ];

  const recent = [...members]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 5);

  if (loading) return <StatsSkeleton />;

  return (
    <div className="csd">
      <section className="csd-welcome">
        <div className="csd-welcome-text">
          <h2 className="csd-title">Welcome back, {user?.name || 'there'} 👋</h2>
          <p className="csd-sub">
            Manage your members and send personalized event notifications with ease.
          </p>
          <p className="csd-date">{today}</p>
        </div>
        {eventName && (
          <div className="csd-event">
            <span className="csd-event-label">Current Event</span>
            <span className="csd-event-name">{eventName}</span>
          </div>
        )}
      </section>

      <section className="csd-stats">
        {stats.map(s => (
          <div key={s.key} className={`csd-stat csd-stat-${s.tone}`}>
            <span className="csd-stat-icon"><s.Icon size={16} /></span>
            <span className="csd-stat-value">{s.value}</span>
            <span className="csd-stat-label">{s.label}</span>
            {s.hint && <span className="csd-stat-hint">{s.hint}</span>}
          </div>
        ))}
      </section>

      <section className="csd-section">
        <h3 className="csd-section-title">Quick Actions</h3>
        <div className="csd-actions">
          {actions.map(a => (
            <button
              key={a.label}
              className={`csd-action ${a.primary ? 'csd-action-primary' : ''}`}
              onClick={() => navigate(a.to)}
            >
              <a.Icon size={15} />
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="csd-section">
        <h3 className="csd-section-title">Recent Members</h3>
        {recent.length === 0 ? (
          <p className="csd-empty">
            No members yet. Add your first member or import a spreadsheet to get started.
          </p>
        ) : (
          <ul className="csd-recent">
            {recent.map(m => (
              <li key={m.id} className="csd-recent-item">
                <span className="csd-recent-info">
                  <span className="csd-recent-name">{m.name}</span>
                  <span className="csd-recent-phone">{m.phone}</span>
                </span>
                <span className={`csd-pill ${m.canSend ? 'csd-pill-ok' : 'csd-pill-wait'}`}>
                  {m.canSend ? 'Available' : `${m.daysRemaining}d cooldown`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
