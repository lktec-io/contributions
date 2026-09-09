import { FiMessageSquare } from 'react-icons/fi';

/*  Presentational helpers for the Custom SMS workspace.
    These render only — no data fetching, no handlers, no business rules.   */

// Deterministic initials from the member's own name. Two letters max.
function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/*  Six brand-adjacent hues, picked deterministically from the name so a member
    keeps the same colour between renders and pages. Not random.            */
const AVATAR_TONES = 6;
function toneOf(name) {
  const s = String(name || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % AVATAR_TONES;
}

export function MemberAvatar({ name, size = 'md' }) {
  return (
    <span
      className={`csm-avatar csm-avatar-${size} csm-tone-${toneOf(name)}`}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  );
}

/*  Phone-style rendering of the exact body the formatter produced.
    `body` must already be the server-rendered SMS — nothing is formatted here. */
export function SmsPhonePreview({ body, meta, title = 'Messages' }) {
  return (
    <div className="csm-phone">
      <div className="csm-phone-bar">
        <FiMessageSquare size={12} aria-hidden="true" />
        <span>{title}</span>
      </div>
      <div className="csm-phone-screen">
        <div className="csm-bubble">
          <pre className="csm-bubble-text">{body || '—'}</pre>
        </div>
        {meta && <p className="csm-phone-meta">{meta}</p>}
      </div>
    </div>
  );
}

// Shimmer placeholder matching the real member row, so the list doesn't jump.
export function MemberSkeleton({ rows = 6, view = 'list' }) {
  return (
    <ul className={`csm-list ${view === 'grid' ? 'csm-list-grid' : ''}`} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="csm-card csm-card-skel">
          <span className="csm-skel csm-skel-avatar" />
          <span className="csm-skel-lines">
            <span className="csm-skel csm-skel-line" />
            <span className="csm-skel csm-skel-line csm-skel-short" />
          </span>
        </li>
      ))}
    </ul>
  );
}
