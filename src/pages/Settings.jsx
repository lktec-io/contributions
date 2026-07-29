import { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiUser, FiSettings, FiBell, FiShield, FiGlobe,
  FiMessageSquare, FiEye, FiEyeOff, FiArrowLeft,
  FiSave, FiCheck, FiImage, FiAlertCircle, FiCreditCard,
  FiPlus, FiTrash2, FiUpload, FiX,
} from 'react-icons/fi';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import { BrandingContext } from '../context/BrandingContext';
import { settingsService } from '../services/settingsService';
import { getErrorMessage } from '../utils/helpers';
import { getCroppedImageFile } from '../utils/cropImage';
import Sidebar from '../components/common/Sidebar';
import Header from '../components/common/Header';
import Footer from '../components/common/Footer';
import ImageCropModal from '../components/common/ImageCropModal';
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

// ── Branding logo upload ────────────────────────────────────────────
const LOGO_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

function BrandingLogoField({ logoUrl, uploading, removing, onSelectFile, onRemove }) {
  const inputRef = useRef(null);

  return (
    <div className="st-brand-logo-field">
      <div className="st-brand-logo-preview">
        {logoUrl ? (
          <img src={logoUrl} alt="Organization logo" className="st-brand-logo-img" />
        ) : (
          <div className="st-brand-logo-placeholder">
            <span>FH</span>
          </div>
        )}
      </div>

      <div className="st-brand-logo-actions">
        <input
          ref={inputRef}
          type="file"
          accept={LOGO_ALLOWED_TYPES.join(',')}
          className="st-brand-logo-input"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) onSelectFile(file);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          className="btn btn-secondary st-brand-upload-btn"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || removing}
        >
          <FiUpload size={14} /> {uploading ? 'Uploading...' : logoUrl ? 'Replace Logo' : 'Upload Logo'}
        </button>
        {logoUrl && (
          <button
            type="button"
            className="btn btn-secondary st-brand-remove-btn"
            onClick={onRemove}
            disabled={uploading || removing}
          >
            <FiX size={14} /> {removing ? 'Removing...' : 'Remove Logo'}
          </button>
        )}
      </div>
      <p className="st-hint">PNG, JPG, or WEBP. Max 2MB. Automatically resized to fit.</p>
    </div>
  );
}

// ── SMS provider badge ────────────────────────────────────────────
const SMS_LABELS = {
  beem:           'Beem Africa',
  africastalking: "Africa's Talking",
};

// ── Payment methods list editor ────────────────────────────────────
const newRowId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const parsePaymentList = (raw) => {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

function PaymentMethodRow({ fields, values, onChange, onRemove }) {
  return (
    <div className="st-pm-row">
      <div className="st-pm-row-grid">
        {fields.map(f => (
          <div key={f.name} className="st-pm-row-field">
            <label className="st-pm-row-label">{f.label}</label>
            <input
              className="st-input"
              list={f.list}
              value={values[f.name] ?? ''}
              onChange={e => onChange(f.name, e.target.value)}
              placeholder={f.placeholder}
            />
          </div>
        ))}
        <div className="st-pm-row-field st-pm-row-order">
          <label className="st-pm-row-label">Order</label>
          <input
            type="number"
            className="st-input"
            value={values.order ?? 0}
            onChange={e => onChange('order', Number(e.target.value) || 0)}
          />
        </div>
      </div>
      <div className="st-pm-row-actions">
        <Toggle value={values.enabled !== false} onChange={v => onChange('enabled', v)} />
        <button type="button" className="st-pm-remove-btn" onClick={onRemove} aria-label="Remove">
          <FiTrash2 size={15} />
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Settings page
// ════════════════════════════════════════════════════════════════
export default function Settings() {
  const { user }  = useContext(AuthContext);
  const { toast } = useContext(ToastContext);
  const { logoUrl, setBranding } = useContext(BrandingContext);
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

  // admin / client_user: payment methods shown on the public contribution portal
  const [mobileMethods, setMobileMethods] = useState([]);
  const [bankMethods,   setBankMethods]   = useState([]);
  const [savingPayment, setSavingPayment] = useState(false);
  const [donePayment,   setDonePayment]   = useState(false);

  // all roles: organization branding (logo + name)
  const [orgNameInput,   setOrgNameInput]   = useState('');
  const [savingBranding, setSavingBranding] = useState(false);
  const [doneBranding,   setDoneBranding]   = useState(false);
  const [uploadingLogo,  setUploadingLogo]  = useState(false);
  const [removingLogo,   setRemovingLogo]   = useState(false);
  const [cropSrc,        setCropSrc]        = useState(null);
  const [cropFileName,   setCropFileName]   = useState('logo.png');

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
        setOrgNameInput(d.branding_org_name ?? '');
        setMobileMethods(parsePaymentList(d.payment_methods_mobile).map(m => ({
          id: newRowId(),
          network: m.network ?? '',
          account_name: m.account_name ?? '',
          phone: m.phone ?? '',
          order: m.order ?? 0,
          enabled: m.enabled !== false,
        })));
        setBankMethods(parsePaymentList(d.payment_methods_bank).map(b => ({
          id: newRowId(),
          bank_name: b.bank_name ?? '',
          account_name: b.account_name ?? '',
          account_number: b.account_number ?? '',
          branch: b.branch ?? '',
          order: b.order ?? 0,
          enabled: b.enabled !== false,
        })));
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

  async function savePaymentMethods(e) {
    e.preventDefault();
    setSavingPayment(true);
    try {
      await settingsService.update({
        payment_methods_mobile: JSON.stringify(mobileMethods.map(({ network, account_name, phone, order, enabled }) => ({ network, account_name, phone, order, enabled }))),
        payment_methods_bank:   JSON.stringify(bankMethods.map(({ bank_name, account_name, account_number, branch, order, enabled }) => ({ bank_name, account_name, account_number, branch, order, enabled }))),
      });
      toast.success('Payment methods saved');
      flash(setDonePayment);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally { setSavingPayment(false); }
  }

  const addMobileMethod = () => setMobileMethods(prev => [
    ...prev, { id: newRowId(), network: '', account_name: '', phone: '', order: prev.length, enabled: true },
  ]);
  const removeMobileMethod = (id) => setMobileMethods(prev => prev.filter(m => m.id !== id));
  const updateMobileMethod = (id, field, value) =>
    setMobileMethods(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));

  const addBankMethod = () => setBankMethods(prev => [
    ...prev, { id: newRowId(), bank_name: '', account_name: '', account_number: '', branch: '', order: prev.length, enabled: true },
  ]);
  const removeBankMethod = (id) => setBankMethods(prev => prev.filter(b => b.id !== id));
  const updateBankMethod = (id, field, value) =>
    setBankMethods(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));

  async function saveBrandingName(e) {
    e.preventDefault();
    setSavingBranding(true);
    try {
      await settingsService.update({ branding_org_name: orgNameInput });
      setBranding({ organizationName: orgNameInput || 'Finance Hub' });
      toast.success('Organization name saved');
      flash(setDoneBranding);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally { setSavingBranding(false); }
  }

  function handleLogoSelect(file) {
    if (!LOGO_ALLOWED_TYPES.includes(file.type)) {
      toast.error('Only PNG, JPG, JPEG, or WEBP images are allowed');
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      toast.error('Logo must be 2MB or smaller');
      return;
    }
    setCropFileName(file.name || 'logo.png');
    setCropSrc(URL.createObjectURL(file));
  }

  function closeCropModal() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  async function handleCropConfirm(croppedAreaPixels) {
    setUploadingLogo(true);
    try {
      const croppedFile = await getCroppedImageFile(cropSrc, croppedAreaPixels, cropFileName);
      const res = await settingsService.uploadLogo(croppedFile);
      setBranding({ logoUrl: res.data.data.logo_url });
      toast.success('Logo uploaded');
      closeCropModal();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally { setUploadingLogo(false); }
  }

  async function handleLogoRemove() {
    setRemovingLogo(true);
    try {
      await settingsService.removeLogo();
      setBranding({ logoUrl: null });
      toast.success('Logo removed');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally { setRemovingLogo(false); }
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
    { id: 'branding',      label: 'Branding',      Icon: FiImage         },
    ...(role === 'super_admin' ? [
      { id: 'system',      label: 'System',         Icon: FiSettings      },
      { id: 'sms',         label: 'SMS',            Icon: FiMessageSquare },
    ] : []),
    ...(role === 'admin' ? [
      { id: 'org',         label: 'Organisation',   Icon: FiGlobe         },
    ] : []),
    ...(role === 'admin' || role === 'client_user' ? [
      { id: 'payment-methods', label: 'Payment Methods', Icon: FiCreditCard },
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

      // ── Organization Branding (all roles) ────────────────────
      case 'branding':
        return (
          <SectionCard
            title="Organization Branding"
            subtitle="Your own logo and organization name — shown throughout the app and on generated reports and receipts. Only visible on your account."
          >
            <div className="st-form">
              <Field label="Organization Logo">
                <BrandingLogoField
                  logoUrl={logoUrl}
                  uploading={uploadingLogo}
                  removing={removingLogo}
                  onSelectFile={handleLogoSelect}
                  onRemove={handleLogoRemove}
                />
              </Field>

              <form onSubmit={saveBrandingName}>
                <Field label="Organization Name" hint="Shown in place of &ldquo;Finance Hub&rdquo; wherever your branding appears.">
                  <input
                    className="st-input"
                    value={orgNameInput}
                    onChange={e => setOrgNameInput(e.target.value.slice(0, 100))}
                    placeholder="Finance Hub"
                    maxLength={100}
                  />
                </Field>
                <div className="st-form-footer">
                  <SaveBtn loading={savingBranding} done={doneBranding} />
                </div>
              </form>
            </div>
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

      // ── Payment Methods (admin / client_user) ────────────────
      case 'payment-methods':
        return (
          <SectionCard
            title="Payment Methods"
            subtitle="Shown as structured, read-only cards on your contributors' public contribution pages. Disabled entries are hidden."
          >
            <datalist id="st-network-presets">
              <option value="M-Pesa" /><option value="Mixx" /><option value="Airtel Money" /><option value="HaloPesa" />
            </datalist>
            <datalist id="st-bank-presets">
              <option value="CRDB" /><option value="NMB" /><option value="NBC" /><option value="Equity" /><option value="ABSA" />
            </datalist>

            <form onSubmit={savePaymentMethods} className="st-form">
              <div className="st-pm-section">
                <h3 className="st-pm-section-title">Mobile Money</h3>
                {mobileMethods.length === 0 && (
                  <p className="st-pm-empty">No mobile money accounts added yet.</p>
                )}
                <div className="st-pm-list">
                  {mobileMethods.map(m => (
                    <PaymentMethodRow
                      key={m.id}
                      values={m}
                      onChange={(field, value) => updateMobileMethod(m.id, field, value)}
                      onRemove={() => removeMobileMethod(m.id)}
                      fields={[
                        { name: 'network', label: 'Network', list: 'st-network-presets', placeholder: 'M-Pesa' },
                        { name: 'account_name', label: 'Account Name', placeholder: 'Clix Digital' },
                        { name: 'phone', label: 'Phone Number', placeholder: '0712 345 678' },
                      ]}
                    />
                  ))}
                </div>
                <button type="button" className="st-pm-add-btn" onClick={addMobileMethod}>
                  <FiPlus size={14} /> Add Mobile Money
                </button>
              </div>

              <div className="st-pm-section">
                <h3 className="st-pm-section-title">Bank</h3>
                {bankMethods.length === 0 && (
                  <p className="st-pm-empty">No bank accounts added yet.</p>
                )}
                <div className="st-pm-list">
                  {bankMethods.map(b => (
                    <PaymentMethodRow
                      key={b.id}
                      values={b}
                      onChange={(field, value) => updateBankMethod(b.id, field, value)}
                      onRemove={() => removeBankMethod(b.id)}
                      fields={[
                        { name: 'bank_name', label: 'Bank Name', list: 'st-bank-presets', placeholder: 'CRDB' },
                        { name: 'account_name', label: 'Account Name', placeholder: 'Clix Digital' },
                        { name: 'account_number', label: 'Account Number', placeholder: '0150 234 567 890' },
                        { name: 'branch', label: 'Branch (optional)', placeholder: 'Mlimani City' },
                      ]}
                    />
                  ))}
                </div>
                <button type="button" className="st-pm-add-btn" onClick={addBankMethod}>
                  <FiPlus size={14} /> Add Bank Account
                </button>
              </div>

              <div className="st-form-footer">
                <SaveBtn loading={savingPayment} done={donePayment} />
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

      <ImageCropModal
        isOpen={!!cropSrc}
        imageSrc={cropSrc}
        onCancel={closeCropModal}
        onConfirm={handleCropConfirm}
        confirming={uploadingLogo}
      />
    </div>
  );
}
