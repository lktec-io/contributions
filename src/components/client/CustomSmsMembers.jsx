import { useState, useEffect, useContext, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FiPlus, FiEdit2, FiSend, FiTrash2, FiUsers, FiUpload, FiDownload, FiFileText,
} from 'react-icons/fi';
import { ToastContext } from '../../context/ToastContext';
import { contributorService } from '../../services/contributorService';
import { eventService } from '../../services/eventService';
import { smsService } from '../../services/smsService';
import { getErrorMessage } from '../../utils/helpers';
import Modal from '../common/Modal';
import ConfirmDialog from '../common/ConfirmDialog';
import EmptyState from '../common/EmptyState';
import SmsSendingModal from '../common/SmsSendingModal';
import './CustomSmsMembers.css';

/*  Custom SMS workspace.
    Communication-only: members are name + phone. No contribution, pledge,
    payment or balance data is fetched or shown anywhere in this component.
    Each member carries their OWN cooldown, returned per row by the API.      */

const emptyForm = { name: '', phone: '' };

export default function CustomSmsMembers() {
  const { toast } = useContext(ToastContext);

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [events,  setEvents]  = useState([]);

  const [showForm,   setShowForm]   = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [form,       setForm]       = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [saving,     setSaving]     = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting,      setDeleting]      = useState(false);

  const [composeFor,  setComposeFor]  = useState(null);
  const [message,     setMessage]     = useState('');
  const [eventId,     setEventId]     = useState('');
  const [msgError,    setMsgError]    = useState('');
  const [sendingId,   setSendingId]   = useState(null);
  const [smsModal,    setSmsModal]    = useState({ open: false, status: 'sending', message: '' });

  // Send to All — campaign-level, separate window from per-member sends
  const [campaign,    setCampaign]    = useState({ canSend: true, daysRemaining: 0 });
  const [showSendAll, setShowSendAll] = useState(false);
  const [confirmAll,  setConfirmAll]  = useState(false);
  const [sendingAll,  setSendingAll]  = useState(false);

  // Excel import
  const [showImport,  setShowImport]  = useState(false);
  const [importFile,  setImportFile]  = useState(null);
  const [importing,   setImporting]   = useState(false);
  const [importResult, setImportResult] = useState(null);

  const [downloading, setDownloading] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await contributorService.getMembers();
      setMembers(res.data.data.members || []);
      if (res.data.data.campaign) setCampaign(res.data.data.campaign);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  // Events are contextual only. Only the id is sent; the server resolves the
  // name after checking the caller may access that event.
  useEffect(() => {
    eventService.getAll()
      .then(res => {
        const list = res.data.data || [];
        setEvents(list);
        if (list.length === 1) setEventId(String(list[0].id));
      })
      .catch(() => {});
  }, []);

  const filtered = members.filter(m => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (m.name || '').toLowerCase().includes(q) || (m.phone || '').includes(q);
  });

  // ── Add / Edit ───────────────────────────────────────────
  const openAdd = () => {
    setEditing(null); setForm(emptyForm); setFormErrors({}); setShowForm(true);
  };

  const openEdit = (m) => {
    setEditing(m); setForm({ name: m.name || '', phone: m.phone || '' });
    setFormErrors({}); setShowForm(true);
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim())  errs.name  = 'Name is required';
    if (!form.phone.trim()) errs.phone = 'Phone is required';
    else if (form.phone.replace(/\D/g, '').length < 9) errs.phone = 'Enter a valid phone number';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submitForm = async (e) => {
    e.preventDefault();
    if (!validate() || saving) return;
    setSaving(true);
    try {
      if (editing) {
        await contributorService.updateMember(editing.id, form);
        toast.success('Member updated');
      } else {
        await contributorService.createMember(form);
        toast.success('Member added');
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditing(null);
      fetchMembers();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────
  const doDelete = async () => {
    setDeleting(true);
    try {
      await contributorService.deleteMember(confirmDelete.id);
      toast.success('Member deleted');
      setConfirmDelete(null);
      fetchMembers();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  // ── Send individual Custom SMS ───────────────────────────
  const openCompose = (m) => {
    setComposeFor(m); setMsgError('');
    if (!eventId && events.length === 1) setEventId(String(events[0].id));
  };

  const sendToMember = async () => {
    if (!message.trim()) { setMsgError('Tafadhali andika ujumbe kwanza.'); return; }
    if (sendingId) return;                       // duplicate-click guard
    setMsgError('');
    setSendingId(composeFor.id);
    setSmsModal({ open: true, status: 'sending', message: '' });
    try {
      await smsService.sendMemberSms(composeFor.id, { message: message.trim(), eventId: eventId || undefined });
      toast.success(`SMS sent to ${composeFor.name}`);
      setSmsModal({
        open: true, status: 'success',
        message: `SMS sent to ${composeFor.name}. You can message them again in 7 days.`,
      });
      // Only this member enters cooldown — everyone else stays available.
      setMembers(prev => prev.map(m =>
        m.id === composeFor.id ? { ...m, canSend: false, daysRemaining: 7 } : m
      ));
      setComposeFor(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setSmsModal({ open: true, status: 'error', message: getErrorMessage(err) });
    } finally {
      setSendingId(null);
    }
  };

  // ── Send Custom SMS to All ───────────────────────────────
  const campaignLabel = () => {
    if (sendingAll) return 'Sending…';
    if (!campaign.canSend) return `Available in ${campaign.daysRemaining} day(s)`;
    return 'Send Custom SMS to All';
  };

  const openSendAll = () => {
    if (!members.length) { toast.error('No members available.'); return; }
    setMsgError('');
    if (!eventId && events.length === 1) setEventId(String(events[0].id));
    setShowSendAll(true);
  };

  const confirmSendAll = () => {
    if (!message.trim()) { setMsgError('Tafadhali andika ujumbe kwanza.'); return; }
    setConfirmAll(true);
  };

  const doSendAll = async () => {
    if (sendingAll) return;                       // duplicate-click guard
    setConfirmAll(false);
    setSendingAll(true);
    setSmsModal({ open: true, status: 'sending', message: '' });
    try {
      const res = await smsService.sendCustomCampaign({
        message: message.trim(),
        eventId: eventId || undefined,
      });
      const { sent, total } = res.data.data;
      toast.success(`SMS sent to ${sent} of ${total} member(s)`);
      setSmsModal({
        open: true, status: 'success',
        message: `SMS sent to ${sent} of ${total} member(s). Next campaign available in 7 days.`,
      });
      setCampaign({ canSend: false, daysRemaining: 7 });
      setShowSendAll(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setSmsModal({ open: true, status: 'error', message: getErrorMessage(err) });
    } finally {
      setSendingAll(false);
    }
  };

  // ── Excel import ─────────────────────────────────────────
  const doImport = async () => {
    if (!importFile || importing) return;
    setImporting(true);
    try {
      const res = await contributorService.importMembers(importFile);
      setImportResult(res.data.data);
      toast.success(res.data.message);
      fetchMembers();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setImporting(false);
    }
  };

  const closeImport = () => {
    setShowImport(false); setImportFile(null); setImportResult(null);
  };

  // ── Reports ──────────────────────────────────────────────
  const download = async (kind) => {
    setDownloading(kind);
    try {
      const res = kind === 'pdf'
        ? await contributorService.exportMembersPDF(eventId || undefined)
        : await contributorService.exportMembersXLSX(eventId || undefined);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `custom_sms_members_${new Date().toISOString().split('T')[0]}.${kind === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`${kind.toUpperCase()} downloaded`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDownloading('');
    }
  };

  // Dashboard quick actions deep-link here with ?action=…
  useEffect(() => {
    const action = searchParams.get('action');
    if (!action || loading) return;
    if (action === 'add')    openAdd();
    if (action === 'import') setShowImport(true);
    if (action === 'sendall') openSendAll();
    if (action === 'pdf')    download('pdf');
    if (action === 'xlsx')   download('xlsx');
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loading]);

  const sendLabel = (m) => {
    if (sendingId === m.id) return 'Sending…';
    if (!m.canSend) return `Available in ${m.daysRemaining} day(s)`;
    return 'Send Custom SMS';
  };

  return (
    <div className="csm">
      <SmsSendingModal
        open={smsModal.open}
        status={smsModal.status}
        title={smsModal.status === 'success' ? 'SMS Sent Successfully' : undefined}
        message={smsModal.message}
        onClose={() => setSmsModal({ open: false, status: 'sending', message: '' })}
      />

      <div className="page-header">
        <div>
          <h2 className="page-title">Custom SMS</h2>
          <p className="page-subtitle">
            Manage your members and send personalized event notifications.
          </p>
        </div>
        <div className="csm-header-actions">
          <button className="csm-action" onClick={() => setShowImport(true)}>
            <FiUpload size={13} /> Import Excel
          </button>
          <button className="csm-action" onClick={() => download('pdf')} disabled={!!downloading}>
            <FiFileText size={13} /> {downloading === 'pdf' ? '…' : 'PDF'}
          </button>
          <button className="csm-action" onClick={() => download('xlsx')} disabled={!!downloading}>
            <FiDownload size={13} /> {downloading === 'xlsx' ? '…' : 'Excel'}
          </button>
          <button
            className="csm-action csm-action-send"
            onClick={openSendAll}
            disabled={!campaign.canSend || sendingAll || members.length === 0}
            title={campaignLabel()}
          >
            <FiSend size={13} /> {campaignLabel()}
          </button>
          <button className="btn" onClick={openAdd}>
            <FiPlus size={16} /> Add Member
          </button>
        </div>
      </div>

      <div className="csm-toolbar">
        <input
          type="text"
          className="csm-search"
          placeholder="Search members…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span className="csm-count">
          {filtered.length} member{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <div className="csm-loading">Loading members…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          IconComponent={FiUsers}
          title={members.length === 0 ? 'No members yet' : 'No members match your search'}
          description={members.length === 0
            ? 'Add your first member to start sending custom notifications.'
            : 'Try a different name or phone number.'}
        />
      ) : (
        <ul className="csm-list">
          {filtered.map(m => (
            <li key={m.id} className="csm-card">
              <div className="csm-card-info">
                <span className="csm-card-name">{m.name}</span>
                <span className="csm-card-phone">{m.phone}</span>
              </div>
              <div className="csm-card-actions">
                <button className="csm-action" onClick={() => openEdit(m)}>
                  <FiEdit2 size={12} /> Edit
                </button>
                <button
                  className="csm-action csm-action-send"
                  onClick={() => openCompose(m)}
                  disabled={!m.canSend || sendingId === m.id}
                  title={sendLabel(m)}
                >
                  <FiSend size={12} /> {sendLabel(m)}
                </button>
                <button className="csm-action csm-action-danger" onClick={() => setConfirmDelete(m)}>
                  <FiTrash2 size={12} /> Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ── Add / Edit member — name + phone only ──────── */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditing(null); }}
        title={editing ? 'Edit Member' : 'Add Member'}
        size="small"
      >
        <form onSubmit={submitForm} noValidate>
          <div className="form-group">
            <label>Name *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="John Doe"
            />
            {formErrors.name && <span className="field-error">{formErrors.name}</span>}
          </div>
          <div className="form-group">
            <label>Phone *</label>
            <input
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="+255 7XX XXX XXX"
              inputMode="tel"
            />
            {formErrors.phone && <span className="field-error">{formErrors.phone}</span>}
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setShowForm(false); setEditing(null); }}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Member'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Compose for one member ─────────────────────── */}
      <Modal
        isOpen={!!composeFor}
        onClose={() => setComposeFor(null)}
        title="Send Custom SMS"
        size="medium"
      >
        {composeFor && (
          <div className="csm-compose">
            <div className="csm-recipient">
              <span className="csm-recipient-label">Recipient</span>
              <span className="csm-recipient-name">{composeFor.name}</span>
              <span className="csm-recipient-phone">{composeFor.phone}</span>
            </div>

            <div className="form-group">
              <label>Event</label>
              <select value={eventId} onChange={e => setEventId(e.target.value)}>
                <option value="">— No event —</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.name}</option>
                ))}
              </select>
              {events.length === 0 && (
                <span className="csm-chars">No events are assigned to your account yet.</span>
              )}
            </div>

            <div className="form-group">
              <label>Message</label>
              <textarea
                className="csm-textarea"
                value={message}
                onChange={e => { setMessage(e.target.value); if (msgError) setMsgError(''); }}
                placeholder="Andika ujumbe wako hapa..."
                rows={6}
                disabled={!!sendingId}
              />
              <div className="csm-meta">
                {msgError
                  ? <span className="csm-error">{msgError}</span>
                  : <span className="csm-chars">Characters: {message.length}</span>}
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setComposeFor(null)}
                disabled={!!sendingId}
              >
                Cancel
              </button>
              <button type="button" className="btn" onClick={sendToMember} disabled={!!sendingId}>
                <FiSend size={14} /> {sendingId ? 'Sending…' : 'Send Custom SMS'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Send Custom SMS to All ─────────────────────── */}
      <Modal
        isOpen={showSendAll}
        onClose={() => setShowSendAll(false)}
        title="Send Custom SMS to All"
        size="medium"
      >
        <div className="csm-compose">
          <div className="csm-recipient">
            <span className="csm-recipient-label">Recipients</span>
            <span className="csm-recipient-name">{members.length} member{members.length !== 1 ? 's' : ''}</span>
            <span className="csm-recipient-phone">Each member receives their own personalized message.</span>
          </div>

          <div className="form-group">
            <label>Event</label>
            <select value={eventId} onChange={e => setEventId(e.target.value)}>
              <option value="">— No event —</option>
              {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Message</label>
            <textarea
              className="csm-textarea"
              value={message}
              onChange={e => { setMessage(e.target.value); if (msgError) setMsgError(''); }}
              placeholder="Andika ujumbe wako hapa..."
              rows={6}
              disabled={sendingAll}
            />
            <div className="csm-meta">
              {msgError
                ? <span className="csm-error">{msgError}</span>
                : <span className="csm-chars">Characters: {message.length}</span>}
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowSendAll(false)} disabled={sendingAll}>
              Cancel
            </button>
            <button type="button" className="btn" onClick={confirmSendAll} disabled={sendingAll}>
              <FiSend size={14} /> {sendingAll ? 'Sending…' : 'Send to All'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmAll}
        onClose={() => setConfirmAll(false)}
        onConfirm={doSendAll}
        title="Send Custom SMS to All?"
        message={`You are about to send this message to ${members.length} member${members.length !== 1 ? 's' : ''}. This will send an SMS to every member in your list.`}
        confirmText="Confirm & Send"
        confirmVariant="danger"
        loading={sendingAll}
      />

      {/* ── Import members from Excel ──────────────────── */}
      <Modal isOpen={showImport} onClose={closeImport} title="Import Members" size="small">
        <div className="csm-import">
          {importResult ? (
            <>
              <p className="csm-import-done">Import completed.</p>
              <ul className="csm-import-stats">
                <li><strong>{importResult.imported}</strong> imported</li>
                <li><strong>{importResult.skipped}</strong> skipped</li>
              </ul>
              {importResult.reasons?.length > 0 && (
                <ul className="csm-import-reasons">
                  {importResult.reasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              )}
              <div className="form-actions">
                <button type="button" className="btn" onClick={closeImport}>Done</button>
              </div>
            </>
          ) : (
            <>
              <p className="csm-import-hint">
                Upload a spreadsheet with <strong>Name</strong> and <strong>Phone</strong> columns.
                Supported formats: .xlsx, .xls
              </p>
              <label className="csm-file">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={e => setImportFile(e.target.files?.[0] || null)}
                  disabled={importing}
                />
              </label>
              {importFile && (
                <p className="csm-file-name">File selected: <strong>{importFile.name}</strong></p>
              )}
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={closeImport} disabled={importing}>
                  Cancel
                </button>
                <button type="button" className="btn" onClick={doImport} disabled={!importFile || importing}>
                  <FiUpload size={14} /> {importing ? 'Importing…' : 'Import Members'}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        title="Delete Member"
        message={`Remove "${confirmDelete?.name}" from your members?`}
        confirmText="Delete"
        confirmVariant="danger"
        loading={deleting}
      />
    </div>
  );
}
