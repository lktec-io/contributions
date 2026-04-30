import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiUser, FiSettings, FiBell, FiShield, FiGlobe,
  FiMessageSquare, FiEye, FiEyeOff, FiArrowLeft,
  FiSave, FiCheck, FiImage, FiAlertCircle,
} from 'react-icons/fi';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import { settingsService } from '../services/settingsService';
import { getErrorMessage } from '../utils/helpers';
import Sidebar from '../components/common/Sidebar';
import Header from '../components/common/Header';
import Footer from '../components/common/Footer';
import './Settings.css';

// ── Primitives ───────────────────────────────────────────────────

function Toggle({ value, onChange, disabled }) {
  return (
    <button
      type="button"
      className={`st-toggle${value ? ' st-toggle-on' : ''}`}
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      aria-pressed={value}
    />
  );
}

function SectionCard({ title, subtitle, children }) {
  return (
    <div className="st-card">
      <div className="st-card-head">
        <h2 className="st-card-title">{title}</h2>
        {subtitle && <p className="st-card-subtitle">{subtitle}</p>}
      </div>
      <div className="st-card-body">{children}</div>
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <div className="st-field">
      <label className="st-label">{label}</label>
      {children}
      {hint && <p className="st-hint">{hint}</p>}
    </div>
  );
}

function ToggleRow({ label, sub, value, onChange, disabled }) {
  return (
    <div className="st-toggle-row">
      <div className="st-toggle-info">
        <p className="st-toggle-label">{label}</p>
        {sub && <p className="st-toggle-sub">{sub}</p>}
      </div>
      <Toggle value={value} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function SaveBtn({ loading, done }) {
  return (
    <button
      className={`st-save-btn${done ? ' st-save-btn-done' : ''}`}
      type="submit"
      disabled={loading || done}
    >
      {loading ? (
        <span className="st-btn-dots"><span /><span /><span /></span>
      ) : done ? (
        <><FiCheck size={15} /> Saved</>
      ) : (
        <><FiSave size={15} /> Save Changes</>
      )}
    </button>
  );
}

// ── Logo preview ─────────────────────────────────────────────────
function LogoPreview({ url }) {
  const [status, setStatus] = useState('idle'); // idle | loading | ok | error

  useEffect(() => {
    if (!url?.trim()) { setStatus('idle'); return; }
    setStatus('loading');
    const img = new Image();
    img.onload  = () => setStatus('ok');
    img.onerror = () => setStatus('error');
    img.src = url;
  }, [url]);

  if (status === 'idle') return null;

  return (
    <div className={`st-logo-preview${status === 'error' ? ' st-logo-preview-error' : ''}`}>
      {status === 'ok' ? (
        <img src={url} alt="Logo preview" className="st-logo-img" />
      ) : status === 'loading' ? (
        <span className="st-logo-loading"><span /><span /><span /></span>
      ) : (
        <span className="st-logo-err"><FiAlertCircle size={14} /> Invalid image URL</span>
      )}
    </div>
  );
}

// ── SMS provider badge ────────────────────────────────────────────
const SMS_LABELS = {
  beem:           'Beem Africa',
  africastalking: "Africa's Talking",
};

// ════════════════════════════════════════════════════════════════
// Settings page
// ════════════════════════════════════════════════════════════════
export default function Settings() {
  const { user }  = useContext(AuthContext);
  const { toast } = useContext(ToastContext);
  const navigate  = useNavigate();
  const role      = user?.role;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [section,     setSection]     = useState('profile');
  const [loading,     setLoading]     = useState(true);

  // ── State blocks (each section is independent) ────────────────

  const [profile, setProfile] = useState({ profile_name: '', profile_email: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [doneProfile,   setDoneProfile]   = useState(false);

  // super_admin: global system settings
  const [system, setSystem] = useState({
    system_name:          '',
    system_logo:          '',
    default_currency:     'TZS',
    enable_notifications: 'true',
  });
  const [savingSystem, setSavingSystem] = useState(false);
  const [doneSystem,   setDoneSystem]   = useState(false);

  // super_admin: SMS platform settings
  const [sms, setSms] = useState({ sms_provider: 'beem' });
  const [savingSms, setSavingSms] = useState(false);
  const [doneSms,   setDoneSms]   = useState(false);

  // admin: organisation settings
  const [org, setOrg] = useState({
    organization_name:    '',
    enable_notifications: 'true',
    enable_sms:           'true',
    sms_provider:         'beem',
  });
  const [savingOrg, setSavingOrg] = useState(false);
  const [doneOrg,   setDoneOrg]   = useState(false);

  // all roles: personal notification preference
  const [notifPref,   setNotifPref]   = useState('true');
  const [savingNotif, setSavingNotif] = useState(false);
  const [doneNotif,   setDoneNotif]   = useState(false);

  // all roles: password change
  const [pw,     setPw]     = useState({ current_password: '', new_password: '', confirm: '' });
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false });
  const [savingPw, setSavingPw] = useState(false);

  // ── Load ──────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { data: { data: d } } = await settingsService.get();

        setProfile({
          profile_name:  d.profile_name  ?? '',
          profile_email: d.profile_email ?? '',
        });
        setSystem({
          system_name:          d.system_name          ?? '',
          system_logo:          d.system_logo          ?? '',
          default_currency:     d.default_currency     ?? 'TZS',
          enable_notifications: d.enable_notifications ?? 'true',
        });
        setSms({ sms_provider: d.sms_provider ?? 'beem' });
        setOrg({
          organization_name:    d.organization_name    ?? '',
          enable_notifications: d.enable_notifications ?? 'true',
          enable_sms:           d.enable_sms           ?? 'true',
          sms_provider:         d.sms_provider         ?? 'beem',
        });
        setNotifPref(d.notification_preference ?? 'true');
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function flash(setter) {
    setter(true);
    setTimeout(() => setter(false), 2500);
  }

  // ── Save handlers ─────────────────────────────────────────────

  async function saveProfile(e) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await settingsService.update(profile);
      toast.success('Profile updated');
      flash(setDoneProfile);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally { setSavingProfile(false); }
  }

  async function saveSystem(e) {
    e.preventDefault();
    setSavingSystem(true);
    try {
      await settingsService.update(system);
      toast.success('System settings saved');
      flash(setDoneSystem);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally { setSavingSystem(false); }
  }

  async function saveSms(e) {
    e.preventDefault();
    setSavingSms(true);
    try {
      await settingsService.update(sms);
      toast.success('SMS settings saved');
      flash(setDoneSms);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally { setSavingSms(false); }
  }

  async function saveOrg(e) {
    e.preventDefault();
    setSavingOrg(true);
    try {
      await settingsService.update(org);
      toast.success('Organisation settings saved');
      flash(setDoneOrg);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally { setSavingOrg(false); }
  }

  async function saveNotif(e) {
    e.preventDefault();
    setSavingNotif(true);
    try {
      await settingsService.update({ notification_preference: notifPref });
      toast.success('Notification preference saved');
      flash(setDoneNotif);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally { setSavingNotif(false); }
  }

  async function savePassword(e) {
    e.preventDefault();
    if (pw.new_password !== pw.confirm) {
      toast.error('New passwords do not match');
      return;
    }
    setSavingPw(true);
    try {
      await settingsService.updatePassword({
        current_password: pw.current_password,
        new_password:     pw.new_password,
      });
      toast.success('Password changed successfully');
      setPw({ current_password: '', new_password: '', confirm: '' });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally { setSavingPw(false); }
  }

  // ── Nav items (role-based) ────────────────────────────────────
  const navItems = [
    { id: 'profile',       label: 'Profile',       Icon: FiUser          },
    ...(role === 'super_admin' ? [
      { id: 'system',      label: 'System',         Icon: FiSettings      },
      { id: 'sms',         label: 'SMS',            Icon: FiMessageSquare },
    ] : []),
    ...(role === 'admin' ? [
      { id: 'org',         label: 'Organisation',   Icon: FiGlobe         },
    ] : []),
    { id: 'notifications', label: 'Notifications',  Icon: FiBell          },
    { id: 'security',      label: 'Security',        Icon: FiShield        },
  ];

  // ── Section renderer ──────────────────────────────────────────
  function renderSection() {
    if (loading) {
      return (
        <div className="st-card">
          <div className="st-card-body st-skeleton-wrap">
            {[100, 60, 80].map((w, i) => (
              <div key={i} className="st-skeleton-line" style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>
      );
    }

    switch (section) {

      // ── Profile ─────────────────────────────────────────────
      case 'profile':
        return (
          <SectionCard title="Profile" subtitle="Your name and email address visible across the platform.">
            <form onSubmit={saveProfile} className="st-form">
              <Field label="Full Name">
                <input
                  className="st-input"
                  value={profile.profile_name}
                  onChange={e => setProfile(p => ({ ...p, profile_name: e.target.value }))}
                  placeholder="Your full name"
                  required
                />
              </Field>
              <Field label="Email Address">
                <input
                  type="email"
                  className="st-input"
                  value={profile.profile_email}
                  onChange={e => setProfile(p => ({ ...p, profile_email: e.target.value }))}
                  placeholder="your@email.com"
                  required
                />
              </Field>
              <div className="st-form-footer">
                <SaveBtn loading={savingProfile} done={doneProfile} />
              </div>
            </form>
          </SectionCard>
        );

      // ── System (super_admin only) ────────────────────────────
      case 'system':
        return (
          <SectionCard title="System Settings" subtitle="Global platform configuration. Changes affect all users.">
            <form onSubmit={saveSystem} className="st-form">
              <Field label="System Name" hint="Displayed in the header, emails and browser tab.">
                <input
                  className="st-input"
                  value={system.system_name}
                  onChange={e => setSystem(s => ({ ...s, system_name: e.target.value }))}
                  placeholder="Finance Hub"
                />
              </Field>

              <Field label="Logo URL" hint="Direct link to a .png / .svg image (recommended 120 × 40 px).">
                <div className="st-logo-field">
                  <div className="st-input-icon-wrap">
                    <FiImage size={14} className="st-input-icon" />
                    <input
                      className="st-input st-input-has-icon"
                      value={system.system_logo}
                      onChange={e => setSystem(s => ({ ...s, system_logo: e.target.value }))}
                      placeholder="https://example.com/logo.png"
                    />
                  </div>
                  <LogoPreview url={system.system_logo} />
                </div>
              </Field>

              <Field label="Default Currency">
                <select
                  className="st-select"
                  value={system.default_currency}
                  onChange={e => setSystem(s => ({ ...s, default_currency: e.target.value }))}
                >
                  <option value="TZS">TZS — Tanzanian Shilling</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="KES">KES — Kenyan Shilling</option>
                  <option value="UGX">UGX — Ugandan Shilling</option>
                  <option value="ZAR">ZAR — South African Rand</option>
                </select>
              </Field>

              <ToggleRow
                label="Enable Notifications"
                sub="Platform-wide notification system for all users"
                value={system.enable_notifications === 'true'}
                onChange={v => setSystem(s => ({ ...s, enable_notifications: String(v) }))}
              />

              <div className="st-form-footer">
                <SaveBtn loading={savingSystem} done={doneSystem} />
              </div>
            </form>
          </SectionCard>
        );

      // ── SMS (super_admin only) ───────────────────────────────
      case 'sms':
        return (
          <SectionCard title="SMS Settings" subtitle="Choose the SMS gateway used for all outbound messages.">
            <form onSubmit={saveSms} className="st-form">
              <Field label="SMS Provider">
                <div className="st-sms-cards">
                  {[
                    { value: 'beem',           label: 'Beem Africa',      desc: 'Recommended for Tanzania & East Africa' },
                    { value: 'africastalking', label: "Africa's Talking", desc: 'Pan-African coverage' },
                  ].map(opt => (
                    <label
                      key={opt.value}
                      className={`st-sms-card${sms.sms_provider === opt.value ? ' st-sms-card-active' : ''}`}
                    >
                      <input
                        type="radio"
                        name="sms_provider"
                        value={opt.value}
                        checked={sms.sms_provider === opt.value}
                        onChange={() => setSms({ sms_provider: opt.value })}
                        className="st-sms-radio"
                      />
                      <span className="st-sms-card-dot" />
                      <span className="st-sms-card-content">
                        <span className="st-sms-card-label">{opt.label}</span>
                        <span className="st-sms-card-desc">{opt.desc}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </Field>

              <div className="st-info-box">
                <FiAlertCircle size={14} />
                <p>
                  API credentials for{' '}
                  <strong>{SMS_LABELS[sms.sms_provider] ?? sms.sms_provider}</strong>{' '}
                  are configured in <code>.env</code> on the server
                  (<code>BEEM_API_KEY</code> / <code>BEEM_SECRET_KEY</code> or{' '}
                  <code>AT_API_KEY</code> / <code>AT_USERNAME</code>).
                </p>
              </div>

              <div className="st-form-footer">
                <SaveBtn loading={savingSms} done={doneSms} />
              </div>
            </form>
          </SectionCard>
        );

      // ── Organisation (admin only) ────────────────────────────
      case 'org':
        return (
          <SectionCard title="Organisation" subtitle="Settings scoped to your organisation and its users.">
            <form onSubmit={saveOrg} className="st-form">
              <Field label="Organisation Name">
                <input
                  className="st-input"
                  value={org.organization_name}
                  onChange={e => setOrg(o => ({ ...o, organization_name: e.target.value }))}
                  placeholder="Your organisation name"
                />
              </Field>

              <ToggleRow
                label="Enable Notifications"
                sub="Send in-app notifications to your users"
                value={org.enable_notifications === 'true'}
                onChange={v => setOrg(o => ({ ...o, enable_notifications: String(v) }))}
              />

              <ToggleRow
                label="Enable SMS Reminders"
                sub="Allow the platform to send SMS reminders via your account"
                value={org.enable_sms === 'true'}
                onChange={v => setOrg(o => ({ ...o, enable_sms: String(v) }))}
              />

              {org.enable_sms === 'true' && (
                <Field label="SMS Provider" hint="Choose which gateway to use for your organisation.">
                  <select
                    className="st-select"
                    value={org.sms_provider}
                    onChange={e => setOrg(o => ({ ...o, sms_provider: e.target.value }))}
                  >
                    <option value="beem">Beem Africa</option>
                    <option value="africastalking">Africa's Talking</option>
                  </select>
                </Field>
              )}

              <div className="st-form-footer">
                <SaveBtn loading={savingOrg} done={doneOrg} />
              </div>
            </form>
          </SectionCard>
        );

      // ── Notifications (all roles) ────────────────────────────
      case 'notifications':
        return (
          <SectionCard title="Notifications" subtitle="Your personal notification preference.">
            <form onSubmit={saveNotif} className="st-form">
              <ToggleRow
                label="Receive Notifications"
                sub="Get notified about contributions, events, payments and updates"
                value={notifPref === 'true'}
                onChange={v => setNotifPref(String(v))}
              />
              <div className="st-form-footer">
                <SaveBtn loading={savingNotif} done={doneNotif} />
              </div>
            </form>
          </SectionCard>
        );

      // ── Security (all roles) ─────────────────────────────────
      case 'security':
        return (
          <SectionCard title="Security" subtitle="Change your account password.">
            <form onSubmit={savePassword} className="st-form">
              {[
                { field: 'current_password', label: 'Current Password',     key: 'current' },
                { field: 'new_password',     label: 'New Password',          key: 'new'     },
                { field: 'confirm',          label: 'Confirm New Password',  key: 'confirm' },
              ].map(({ field, label, key }) => (
                <Field key={field} label={label}>
                  <div className="st-pw-wrap">
                    <input
                      type={showPw[key] ? 'text' : 'password'}
                      className="st-input st-input-pw"
                      value={pw[field]}
                      onChange={e => setPw(p => ({ ...p, [field]: e.target.value }))}
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      className="st-pw-eye"
                      onClick={() => setShowPw(s => ({ ...s, [key]: !s[key] }))}
                      tabIndex={-1}
                      aria-label={showPw[key] ? 'Hide password' : 'Show password'}
                    >
                      {showPw[key] ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                    </button>
                  </div>
                </Field>
              ))}
              <div className="st-form-footer">
                <SaveBtn loading={savingPw} done={false} />
              </div>
            </form>
          </SectionCard>
        );

      default:
        return null;
    }
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="app-layout">
      <Sidebar
        activeTab="settings"
        onTabChange={() => navigate('/dashboard')}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="main-area">
        <Header
          onMenuToggle={() => setSidebarOpen(o => !o)}
          menuOpen={sidebarOpen}
        />

        <main className="main-content">
          <div className="st-page">

            <div className="st-page-header">
              <button className="st-back-btn" onClick={() => navigate('/dashboard')}>
                <FiArrowLeft size={16} /> Back to Dashboard
              </button>
              <div>
                <h1 className="st-page-title">Settings</h1>
                <p className="st-page-sub">Manage your account and platform preferences</p>
              </div>
            </div>

            <div className="st-body">
              <nav className="st-nav" aria-label="Settings navigation">
                {navItems.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    className={`st-nav-item${section === id ? ' st-nav-item-active' : ''}`}
                    onClick={() => setSection(id)}
                  >
                    <Icon size={17} className="st-nav-icon" />
                    <span>{label}</span>
                  </button>
                ))}
              </nav>

              <div className="st-content">
                {renderSection()}
              </div>
            </div>

          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
}
