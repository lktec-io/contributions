import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiUser, FiSettings, FiBell, FiShield, FiGlobe,
  FiEye, FiEyeOff, FiArrowLeft, FiSave, FiCheck,
} from 'react-icons/fi';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import { settingsService } from '../services/settingsService';
import { getErrorMessage } from '../utils/helpers';
import Sidebar from '../components/common/Sidebar';
import Header from '../components/common/Header';
import Footer from '../components/common/Footer';
import './Settings.css';

// ── Toggle switch component ─────────────────────────────────────
function Toggle({ value, onChange, disabled }) {
  return (
    <button
      type="button"
      className={`st-toggle ${value ? 'st-toggle-on' : ''}`}
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      aria-pressed={value}
    >
      <span className="st-toggle-thumb" />
    </button>
  );
}

// ── Section heading ─────────────────────────────────────────────
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

// ── Form field ──────────────────────────────────────────────────
function Field({ label, children, hint }) {
  return (
    <div className="st-field">
      <label className="st-label">{label}</label>
      {children}
      {hint && <p className="st-hint">{hint}</p>}
    </div>
  );
}

// ── Save button ─────────────────────────────────────────────────
function SaveBtn({ loading, done }) {
  return (
    <button className={`st-save-btn ${done ? 'st-save-btn-done' : ''}`} type="submit" disabled={loading}>
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

export default function Settings() {
  const { user }  = useContext(AuthContext);
  const { toast } = useContext(ToastContext);
  const navigate  = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [section,     setSection]     = useState('profile');
  const [loading,     setLoading]     = useState(true);

  // ── Profile state ────────────────────────────────────────────
  const [profile, setProfile]   = useState({ profile_name: '', profile_email: '' });
  const [savingProfile,  setSavingProfile]  = useState(false);
  const [doneProfile,    setDoneProfile]    = useState(false);

  // ── System state (super_admin) ───────────────────────────────
  const [system, setSystem] = useState({
    system_name:           '',
    system_logo:           '',
    default_currency:      'TZS',
    sms_provider:          'beem',
    enable_notifications:  'true',
  });
  const [savingSystem, setSavingSystem] = useState(false);
  const [doneSystem,   setDoneSystem]   = useState(false);

  // ── Organization state (admin) ───────────────────────────────
  const [org, setOrg] = useState({
    organization_name:    '',
    enable_notifications: 'true',
    enable_sms:           'true',
  });
  const [savingOrg, setSavingOrg] = useState(false);
  const [doneOrg,   setDoneOrg]   = useState(false);

  // ── Notifications state ──────────────────────────────────────
  const [notifPref, setNotifPref] = useState('true');
  const [savingNotif, setSavingNotif] = useState(false);
  const [doneNotif,   setDoneNotif]   = useState(false);

  // ── Security (password) state ────────────────────────────────
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false });
  const [savingPw, setSavingPw] = useState(false);

  // ── Load settings ────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await settingsService.get();
        const d   = res.data.data;

        setProfile({
          profile_name:  d.profile_name  || '',
          profile_email: d.profile_email || '',
        });
        setSystem({
          system_name:          d.system_name          || '',
          system_logo:          d.system_logo          || '',
          default_currency:     d.default_currency     || 'TZS',
          sms_provider:         d.sms_provider         || 'beem',
          enable_notifications: d.enable_notifications ?? 'true',
        });
        setOrg({
          organization_name:    d.organization_name    || '',
          enable_notifications: d.enable_notifications ?? 'true',
          enable_sms:           d.enable_sms           ?? 'true',
        });
        setNotifPref(d.notification_preference ?? 'true');
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function flashDone(setDone) {
    setDone(true);
    setTimeout(() => setDone(false), 2500);
  }

  // ── Save handlers ────────────────────────────────────────────
  async function saveProfile(e) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await settingsService.update(profile);
      toast.success('Profile updated');
      flashDone(setDoneProfile);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveSystem(e) {
    e.preventDefault();
    setSavingSystem(true);
    try {
      await settingsService.update(system);
      toast.success('System settings saved');
      flashDone(setDoneSystem);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingSystem(false);
    }
  }

  async function saveOrg(e) {
    e.preventDefault();
    setSavingOrg(true);
    try {
      await settingsService.update(org);
      toast.success('Organisation settings saved');
      flashDone(setDoneOrg);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingOrg(false);
    }
  }

  async function saveNotif(e) {
    e.preventDefault();
    setSavingNotif(true);
    try {
      await settingsService.update({ notification_preference: notifPref });
      toast.success('Notification preference saved');
      flashDone(setDoneNotif);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingNotif(false);
    }
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
    } finally {
      setSavingPw(false);
    }
  }

  // ── Navigation items ─────────────────────────────────────────
  const navItems = [
    { id: 'profile',      label: 'Profile',         Icon: FiUser   },
    ...(user?.role === 'super_admin' ? [{ id: 'system', label: 'System',  Icon: FiSettings }] : []),
    ...(user?.role === 'admin'       ? [{ id: 'org',    label: 'Organisation', Icon: FiGlobe    }] : []),
    { id: 'notifications', label: 'Notifications',  Icon: FiBell   },
    { id: 'security',      label: 'Security',        Icon: FiShield },
  ];

  // ── Section content ──────────────────────────────────────────
  function renderSection() {
    if (loading) {
      return (
        <div className="st-card">
          <div className="st-card-body st-skeleton-wrap">
            {[1,2,3].map(i => <div key={i} className="st-skeleton-line" style={{ width: i === 2 ? '60%' : '100%' }} />)}
          </div>
        </div>
      );
    }

    switch (section) {
      case 'profile':
        return (
          <SectionCard title="Profile" subtitle="Update your name and email address.">
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

      case 'system':
        return (
          <SectionCard title="System Settings" subtitle="Global platform configuration visible to all users.">
            <form onSubmit={saveSystem} className="st-form">
              <Field label="System Name" hint="Displayed in the header and emails.">
                <input
                  className="st-input"
                  value={system.system_name}
                  onChange={e => setSystem(s => ({ ...s, system_name: e.target.value }))}
                  placeholder="Finance Hub"
                />
              </Field>
              <Field label="Logo URL" hint="Paste a direct image URL or leave blank.">
                <input
                  className="st-input"
                  value={system.system_logo}
                  onChange={e => setSystem(s => ({ ...s, system_logo: e.target.value }))}
                  placeholder="https://example.com/logo.png"
                />
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
                </select>
              </Field>
              <Field label="SMS Provider">
                <select
                  className="st-select"
                  value={system.sms_provider}
                  onChange={e => setSystem(s => ({ ...s, sms_provider: e.target.value }))}
                >
                  <option value="beem">Beem Africa</option>
                  <option value="africastalking">Africa's Talking</option>
                </select>
              </Field>
              <div className="st-toggle-row">
                <div>
                  <p className="st-toggle-label">Enable Notifications</p>
                  <p className="st-toggle-sub">Platform-wide notification system</p>
                </div>
                <Toggle
                  value={system.enable_notifications === 'true'}
                  onChange={v => setSystem(s => ({ ...s, enable_notifications: String(v) }))}
                />
              </div>
              <div className="st-form-footer">
                <SaveBtn loading={savingSystem} done={doneSystem} />
              </div>
            </form>
          </SectionCard>
        );

      case 'org':
        return (
          <SectionCard title="Organisation" subtitle="Settings scoped to your organisation.">
            <form onSubmit={saveOrg} className="st-form">
              <Field label="Organisation Name">
                <input
                  className="st-input"
                  value={org.organization_name}
                  onChange={e => setOrg(o => ({ ...o, organization_name: e.target.value }))}
                  placeholder="Your organisation name"
                />
              </Field>
              <div className="st-toggle-row">
                <div>
                  <p className="st-toggle-label">Enable Notifications</p>
                  <p className="st-toggle-sub">Send system notifications to your users</p>
                </div>
                <Toggle
                  value={org.enable_notifications === 'true'}
                  onChange={v => setOrg(o => ({ ...o, enable_notifications: String(v) }))}
                />
              </div>
              <div className="st-toggle-row">
                <div>
                  <p className="st-toggle-label">Enable SMS Reminders</p>
                  <p className="st-toggle-sub">Allow SMS reminders to be sent from your account</p>
                </div>
                <Toggle
                  value={org.enable_sms === 'true'}
                  onChange={v => setOrg(o => ({ ...o, enable_sms: String(v) }))}
                />
              </div>
              <div className="st-form-footer">
                <SaveBtn loading={savingOrg} done={doneOrg} />
              </div>
            </form>
          </SectionCard>
        );

      case 'notifications':
        return (
          <SectionCard title="Notifications" subtitle="Control how you receive notifications.">
            <form onSubmit={saveNotif} className="st-form">
              <div className="st-toggle-row">
                <div>
                  <p className="st-toggle-label">Receive Notifications</p>
                  <p className="st-toggle-sub">Get notified about contributions, events, and updates</p>
                </div>
                <Toggle
                  value={notifPref === 'true'}
                  onChange={v => setNotifPref(String(v))}
                />
              </div>
              <div className="st-form-footer">
                <SaveBtn loading={savingNotif} done={doneNotif} />
              </div>
            </form>
          </SectionCard>
        );

      case 'security':
        return (
          <SectionCard title="Security" subtitle="Change your account password.">
            <form onSubmit={savePassword} className="st-form">
              {['current_password', 'new_password', 'confirm'].map(field => {
                const labels = {
                  current_password: 'Current Password',
                  new_password:     'New Password',
                  confirm:          'Confirm New Password',
                };
                const key = field === 'current_password' ? 'current' : field === 'new_password' ? 'new' : 'confirm';
                return (
                  <Field key={field} label={labels[field]}>
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
                        aria-label={showPw[key] ? 'Hide' : 'Show'}
                      >
                        {showPw[key] ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                      </button>
                    </div>
                  </Field>
                );
              })}
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

            {/* ── Page header ───────────────────────────────── */}
            <div className="st-page-header">
              <button className="st-back-btn" onClick={() => navigate('/dashboard')}>
                <FiArrowLeft size={16} />
                Back to Dashboard
              </button>
              <div>
                <h1 className="st-page-title">Settings</h1>
                <p className="st-page-sub">Manage your account and platform preferences</p>
              </div>
            </div>

            {/* ── Body ──────────────────────────────────────── */}
            <div className="st-body">

              {/* Left nav */}
              <nav className="st-nav">
                {navItems.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    className={`st-nav-item ${section === id ? 'st-nav-item-active' : ''}`}
                    onClick={() => setSection(id)}
                  >
                    <Icon size={17} className="st-nav-icon" />
                    <span>{label}</span>
                  </button>
                ))}
              </nav>

              {/* Content */}
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
