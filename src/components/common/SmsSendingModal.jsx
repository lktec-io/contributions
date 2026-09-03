import { useEffect, useRef, useState } from 'react';
import { FiMessageSquare, FiAlertTriangle } from 'react-icons/fi';
import './SmsSendingModal.css';

/*  Visual-only progress layer for the SMS send action.
    It never drives, delays or resolves the real request — the parent owns the
    request and simply reports its outcome through the `status` prop:
      'sending' → progress creeps toward the ceiling and waits there
      'success' → progress rushes to 100%, then the success state is revealed
      'error'   → the error state is revealed immediately                      */

const RAMP_MS = 5000; // 1% → ceiling takes ~5s
const RUSH_MS = 420;  // graceful catch-up once the real request has resolved
const CEILING = 96;   // never reaches 100% until the request actually succeeds

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export default function SmsSendingModal({ open, status = 'sending', title, message, onClose }) {
  // Unmounting while closed keeps every open starting from a clean 1%.
  if (!open) return null;
  return <SmsSendingModalBody status={status} title={title} message={message} onClose={onClose} />;
}

function SmsSendingModalBody({ status, title, message, onClose }) {
  const [progress, setProgress] = useState(1);
  const [view, setView]         = useState('sending');

  const statusRef = useRef(status);
  const valueRef  = useRef(1);
  const rushRef   = useRef(null);
  const rafRef    = useRef(null);

  useEffect(() => { statusRef.current = status; }, [status]);

  useEffect(() => {
    const startedAt = performance.now();

    const tick = (now) => {
      const current = statusRef.current;

      if (current === 'error') {
        rafRef.current = null;
        setView('error');
        return;
      }

      if (current === 'success' && !rushRef.current) {
        rushRef.current = { from: valueRef.current, at: now };
      }

      let next;
      if (rushRef.current) {
        const t = Math.min(1, (now - rushRef.current.at) / RUSH_MS);
        next = rushRef.current.from + (100 - rushRef.current.from) * easeOut(t);
        if (t >= 1) {
          valueRef.current = 100;
          rafRef.current = null;
          setProgress(100);
          setView('success');
          return;
        }
      } else {
        const t = Math.min(1, (now - startedAt) / RAMP_MS);
        next = 1 + (CEILING - 1) * easeOut(t);
      }

      valueRef.current = next;
      setProgress(next);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, []);

  const pct = Math.round(progress);

  const heading =
    view === 'success' ? (title || 'SMS Sent Successfully')
      : view === 'error' ? (title || 'SMS Not Sent')
        : 'Sending SMS…';

  const sub =
    view === 'success' ? (message || 'Your SMS has been sent successfully.')
      : view === 'error' ? (message || 'The SMS could not be sent. Please try again.')
        : 'Please wait…';

  return (
    <div className="sms-modal-overlay" role="dialog" aria-modal="true" aria-live="polite">
      <div className={`sms-modal sms-modal-${view}`}>

        {view === 'sending' && (
          <>
            <div className="sms-modal-orb">
              <span className="sms-modal-pulse" />
              <span className="sms-modal-pulse sms-modal-pulse-2" />
              <FiMessageSquare className="sms-modal-orb-icon" size={30} />
            </div>

            <h3 className="sms-modal-title">{heading}</h3>

            <div className="sms-modal-pct">
              <span className="sms-modal-pct-value">{pct}</span>
              <span className="sms-modal-pct-sign">%</span>
            </div>

            <div className="sms-modal-track">
              <div className="sms-modal-fill" style={{ width: `${progress}%` }}>
                <span className="sms-modal-fill-shine" />
              </div>
            </div>

            <p className="sms-modal-sub">{sub}</p>
          </>
        )}

        {view === 'success' && (
          <>
            <div className="sms-modal-badge">
              <span className="sms-modal-ripple" />
              <svg className="sms-modal-tick" viewBox="0 0 52 52" aria-hidden="true">
                <circle className="sms-modal-tick-circle" cx="26" cy="26" r="23" />
                <path className="sms-modal-tick-path" d="M15 27.5 L23 35 L38 19" />
              </svg>
            </div>

            <h3 className="sms-modal-title">{heading}</h3>
            <p className="sms-modal-sub">{sub}</p>

            <button type="button" className="sms-modal-btn" onClick={onClose}>Done</button>
          </>
        )}

        {view === 'error' && (
          <>
            <div className="sms-modal-badge sms-modal-badge-error">
              <FiAlertTriangle size={34} />
            </div>

            <h3 className="sms-modal-title">{heading}</h3>
            <p className="sms-modal-sub">{sub}</p>

            <button type="button" className="sms-modal-btn sms-modal-btn-error" onClick={onClose}>Close</button>
          </>
        )}

      </div>
    </div>
  );
}
