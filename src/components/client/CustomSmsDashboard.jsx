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
import './MemberPosture.css';

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

  /* Posture maths — every ratio below comes from the member list this page
     already holds. Nothing extra is fetched and nothing is estimated. */
  const share = (part) => (total ? Math.round((part / total) * 100) : 0);

  const withPhone    = members.filter(m => m.phone).length;
  const reachPct     = share(withPhone);
  const availablePct = share(available);
  const cooldownPct  = total ? 100 - availablePct : 0;

  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  const newThisMonth = members.filter(
    m => m.created_at && Date.now() - new Date(m.created_at).getTime() < THIRTY_DAYS,
  ).length;

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
          <h2 className="csd-title">Welcome back, {user?.name || 'there'}</h2>
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

      {/* ══════════════════════════════════════════
          MEMBERSHIP POSTURE — engagement intelligence
          ══════════════════════════════════════════ */}
      <section className="mp" aria-label="Membership posture">
        <header className="mp-head">
          <div className="mp-head-copy">
            <p className="mp-eyebrow">Engagement posture</p>
            <h3 className="mp-title">Membership intelligence</h3>
          </div>
          <p className="mp-total">
            <span className="mp-total-value">{total}</span>
            <span className="mp-total-label">{total === 1 ? 'member' : 'members'}</span>
          </p>
        </header>

        {/* Distribution: who can be reached right now */}
        <div
          className="mp-dist"
          role="img"
          aria-label={`${available} available, ${contacted} in cooldown`}
        >
          <span className="mp-seg mp-seg--ready" style={{ width: `${availablePct}%` }} />
          <span className="mp-seg mp-seg--wait"  style={{ width: `${cooldownPct}%` }} />
        </div>

        <dl className="mp-keys">
          <div className="mp-key">
            <dt className="mp-key-term">
              <i className="mp-dot mp-dot--ready" aria-hidden="true" />
              Available
            </dt>
            <dd className="mp-key-val">
              <b>{available}</b><span>{availablePct}%</span>
            </dd>
          </div>
          <div className="mp-key">
            <dt className="mp-key-term">
              <i className="mp-dot mp-dot--wait" aria-hidden="true" />
              In cooldown
            </dt>
            <dd className="mp-key-val">
              <b>{contacted}</b><span>{cooldownPct}%</span>
            </dd>
          </div>
        </dl>

        {/* Nested analytics tiles */}
        <div className="mp-tiles">
          <article className="mp-tile">
            <span className="mp-tile-head">
              <FiSend size={14} aria-hidden="true" />
              Communication reach
            </span>
            <span className="mp-tile-value">{reachPct}<i>%</i></span>
            <span className="mp-tile-track" aria-hidden="true">
              <i style={{ width: `${reachPct}%` }} />
            </span>
            <span className="mp-tile-note">{withPhone} of {total} have a phone number</span>
          </article>

          <article className="mp-tile">
            <span className="mp-tile-head">
              <FiUsers size={14} aria-hidden="true" />
              Growth momentum
            </span>
            <span className="mp-tile-value">{newThisMonth}</span>
            <span className="mp-tile-track" aria-hidden="true">
              <i style={{ width: `${share(newThisMonth)}%` }} />
            </span>
            <span className="mp-tile-note">joined in the last 30 days</span>
          </article>

          <article className={`mp-tile ${campaign.canSend ? 'is-open' : 'is-waiting'}`}>
            <span className="mp-tile-head">
              <FiClock size={14} aria-hidden="true" />
              Campaign window
            </span>
            <span className="mp-tile-value">
              {campaign.canSend ? 'Open' : `${campaign.daysRemaining}d`}
            </span>
            <span className="mp-tile-track" aria-hidden="true">
              <i style={{ width: `${campaign.canSend ? 100 : Math.max(0, Math.round(((7 - campaign.daysRemaining) / 7) * 100))}%` }} />
            </span>
            <span className="mp-tile-note">
              {campaign.canSend ? 'Ready to send to all' : 'Cooldown active'}
            </span>
          </article>
        </div>
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
