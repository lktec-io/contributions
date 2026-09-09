import { useState, useEffect, useContext, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FiPlus, FiEdit2, FiSend, FiTrash2, FiUsers, FiUpload, FiDownload, FiFileText,
  FiBookmark,
} from 'react-icons/fi';
import SavedMessagesModal from './SavedMessagesModal';
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
const PAGE_SIZE = 20;

export default function CustomSmsMembers() {
  const { toast } = useContext(ToastContext);

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [events,  setEvents]  = useState([]);

  // Pagination (A-Z sorted server-side)
  const [page,    setPage]    = useState(1);
  const [pages,   setPages]   = useState(1);
  const [total,   setTotal]   = useState(0);
  const [matched, setMatched] = useState(0);

  const [confirmWipe, setConfirmWipe] = useState(false);
  const [wipeText,    setWipeText]    = useState('');
  const [wiping,      setWiping]      = useState(false);

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

  // Saved messages: a chosen template drives the body server-side, so
  // `templateId` (not the text) is what gets submitted.
  const [showSaved,  setShowSaved]  = useState(false);
  const [pickTemplate, setPickTemplate] = useState(false); // true = choosing, false = managing
  const [template,   setTemplate]   = useState(null);
  const [campaignPlan, setCampaignPlan] = useState(null); // eligible/skipped/preview
  const [planning,   setPlanning]   = useState(false);

  const [downloading, setDownloading] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  // Server returns one A-Z sorted page; totals in the same response stay
  // whole-list so counts never reflect only the visible page.
  const fetchMembers = useCallback(async (p = page, q = search) => {
    setLoading(true);
    try {
      const res = await contributorService.getMembers({ page: p, limit: PAGE_SIZE, search: q || undefined });
      const d = res.data.data;
      setMembers(d.members || []);
      setTotal(d.total ?? 0);
      setMatched(d.matched ?? d.total ?? 0);
      setPages(d.pages ?? 1);
      if (d.page && d.page !== p) setPage(d.page);   // server clamped the page
      if (d.campaign) setCampaign(d.campaign);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  // Debounce only the search box; page changes fetch immediately.
  useEffect(() => {
    const t = setTimeout(() => fetchMembers(page, search), search ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

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

  // Searching restarts at page 1 so the user is never left on a page that no
  // longer exists for the new result set.
  const onSearch = (value) => { setSearch(value); setPage(1); };

  // ── Add / Edit ───────────────────────────────────────────
  const openAdd = () => {
    setEditing(null); setForm(emptyForm); setFormErrors({}); setShowForm(true);
  };

  const openEdit = (m) => {
    setEditing(m); setForm({ name: m.name || '', phone: m.phone || '' });
    setFormErrors({}); setShowForm(true);
  };

  // Phone is optional — a member can be added now and given a number later.
  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (form.phone.trim() && form.phone.replace(/\D/g, '').length < 9) {
      errs.phone = 'Enter a valid phone number';
    }
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
    if (!template && !message.trim()) { setMsgError('Tafadhali andika ujumbe kwanza.'); return; }
    if (sendingId) return;                       // duplicate-click guard
    setMsgError('');
    setSendingId(composeFor.id);
    setSmsModal({ open: true, status: 'sending', message: '' });
    try {
      await smsService.sendMemberSms(composeFor.id, {
        message:    template ? undefined : message.trim(),
        templateId: template ? template.id : undefined,
        eventId:    eventId || undefined,
      });
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
    setCampaignPlan(null);
    if (!eventId && events.length === 1) setEventId(String(events[0].id));
    setShowSendAll(true);
  };

  // The backend decides who is eligible; this only shows the operator that
  // decision before they commit to sending.
  const confirmSendAll = async () => {
    if (!template && !message.trim()) { setMsgError('Tafadhali andika ujumbe kwanza.'); return; }
    setMsgError('');
    setPlanning(true);
    try {
      const res = await smsService.previewCustomCampaign({
        message:    template ? undefined : message.trim(),
        templateId: template ? template.id : undefined,
        eventId:    eventId || undefined,
      });
      const plan = res.data.data;
      setCampaignPlan(plan);
      if (plan.eligible === 0) {
        toast.error('All members have already received this message.');
        return;
      }
      setConfirmAll(true);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPlanning(false);
    }
  };

  const doSendAll = async () => {
    if (sendingAll) return;                       // duplicate-click guard
    setConfirmAll(false);
    setSendingAll(true);
    setSmsModal({ open: true, status: 'sending', message: '' });
    try {
      const res = await smsService.sendCustomCampaign({
        message:    template ? undefined : message.trim(),
        templateId: template ? template.id : undefined,
        eventId:    eventId || undefined,
      });
      const { sent, skipped, failed, overLimit } = res.data.data;
      toast.success(`Campaign completed — sent ${sent}, skipped ${skipped}, failed ${failed}`);
      setSmsModal({
        open: true, status: 'success',
        message: `Custom SMS campaign completed. Sent: ${sent}. Skipped: ${skipped}. Failed: ${failed}.`
          + (overLimit ? ` ${overLimit} over the one-SMS limit and not sent.` : ''),
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

  // Shared by both composers: pick a saved message, or clear it to type freely.
  const templatePicker = (disabled) => (
    <div className="form-group">
      <label>Saved Message</label>
      {template ? (
        <div className="csm-tpl">
          <span className="csm-tpl-name">{template.title}</span>
          <button
            type="button"
            className="csm-tpl-clear"
            onClick={() => setTemplate(null)}
            disabled={disabled}
          >
            Clear
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="csm-action"
          onClick={() => { setPickTemplate(true); setShowSaved(true); }}
          disabled={disabled}
        >
          <FiBookmark size={13} /> Choose a saved message
        </button>
      )}
    </div>
  );

  // ── Delete all members ───────────────────────────────────
  const doDeleteAll = async () => {
    if (wiping) return;
    setWiping(true);
    try {
      const res = await contributorService.deleteAllMembers();
      const { deleted, kept } = res.data.data;
      toast.success(`${deleted} member${deleted !== 1 ? 's' : ''} deleted successfully.`);
      if (kept) toast.error(`${kept} kept — they have contribution records.`);
      setConfirmWipe(false);
      setWipeText('');
      setPage(1);
      fetchMembers(1, search);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setWiping(false);
    }
  };

  const sendLabel = (m) => {
    if (sendingId === m.id) return 'Sending…';
    if (!m.phone) return 'No phone number';
    if (!m.canSend) return `Available in ${m.daysRemaining} day(s)`;
    return 'Send Custom SMS';
  };

  // Compact page list: always first/last, a window around the current page,
  // ellipses for the gaps. Keeps the bar small on a phone.
  const pageList = () => {
    if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
    const out = [1];
    const from = Math.max(2, page - 1);
    const to   = Math.min(pages - 1, page + 1);
    if (from > 2) out.push('…');
    for (let i = from; i <= to; i++) out.push(i);
    if (to < pages - 1) out.push('…');
    out.push(pages);
    return out;
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
          <button className="csm-action" onClick={() => { setPickTemplate(false); setShowSaved(true); }}>
            <FiBookmark size={13} /> Saved Messages
          </button>
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
            disabled={!campaign.canSend || sendingAll || total === 0}
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
          onChange={e => onSearch(e.target.value)}
        />
        <span className="csm-count">
          {search ? `${matched} of ${total}` : total} member{total !== 1 ? 's' : ''}
        </span>
        {total > 0 && (
          <button
            className="csm-action csm-action-danger csm-wipe"
            onClick={() => { setWipeText(''); setConfirmWipe(true); }}
          >
            <FiTrash2 size={13} /> Delete All Members
          </button>
        )}
      </div>

      {loading ? (
        <div className="csm-loading">Loading members…</div>
      ) : members.length === 0 ? (
        <EmptyState
          IconComponent={FiUsers}
          title={total === 0 ? 'No members yet' : 'No members match your search'}
          description={total === 0
            ? 'Add your first member to start sending custom notifications.'
            : 'Try a different name or phone number.'}
        />
      ) : (
        <ul className="csm-list">
          {members.map(m => (
            <li key={m.id} className="csm-card">
              <div className="csm-card-info">
                <span className="csm-card-name">{m.name}</span>
                {m.phone
                  ? <span className="csm-card-phone">{m.phone}</span>
                  : <span className="csm-card-nophone">Phone number not yet provided</span>}
              </div>
              <div className="csm-card-actions">
                <button className="csm-action" onClick={() => openEdit(m)}>
                  <FiEdit2 size={12} /> Edit
                </button>
                <button
                  className="csm-action csm-action-send"
                  onClick={() => openCompose(m)}
                  disabled={!m.phone || !m.canSend || sendingId === m.id}
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

      {!loading && pages > 1 && (
        <nav className="csm-pager" aria-label="Member pages">
          <button
            className="csm-page csm-page-step"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ‹ <span className="csm-page-word">Previous</span>
          </button>

          {pageList().map((p, i) => (
            p === '…'
              ? <span key={`gap${i}`} className="csm-page-gap">…</span>
              : (
                <button
                  key={p}
                  className={`csm-page ${p === page ? 'is-current' : ''}`}
                  onClick={() => setPage(p)}
                  aria-current={p === page ? 'page' : undefined}
                >
                  {p}
                </button>
              )
          ))}

          <button
            className="csm-page csm-page-step"
            onClick={() => setPage(p => Math.min(pages, p + 1))}
            disabled={page === pages}
          >
            <span className="csm-page-word">Next</span> ›
          </button>
        </nav>
      )}

      {/* ── Delete all members — typed confirmation ────── */}
      <Modal
        isOpen={confirmWipe}
        onClose={() => { setConfirmWipe(false); setWipeText(''); }}
        title="Delete All Members?"
        size="small"
      >
        <div className="csm-wipe-box">
          <p className="csm-wipe-lead">
            You are about to permanently delete <strong>{total}</strong> member{total !== 1 ? 's' : ''}.
          </p>
          <p className="csm-wipe-note">
            This action cannot be undone. Your saved messages and SMS history are kept.
            Anyone with contribution records is kept as well.
          </p>
          <label className="csm-wipe-label" htmlFor="csm-wipe-input">
            Type <strong>DELETE ALL</strong> to confirm
          </label>
          <input
            id="csm-wipe-input"
            className="csm-wipe-input"
            value={wipeText}
            onChange={e => setWipeText(e.target.value)}
            placeholder="DELETE ALL"
            autoComplete="off"
            disabled={wiping}
          />
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setConfirmWipe(false); setWipeText(''); }}
              disabled={wiping}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn csm-wipe-go"
              onClick={doDeleteAll}
              disabled={wiping || wipeText.trim().toUpperCase() !== 'DELETE ALL'}
            >
              <FiTrash2 size={14} /> {wiping ? 'Deleting…' : 'Delete All Members'}
            </button>
          </div>
        </div>
      </Modal>

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
            <label>Phone <span className="csm-optional">(optional — can be added later)</span></label>
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

            {templatePicker(!!sendingId)}

            <div className="form-group">
              <label>Message</label>
              <textarea
                className="csm-textarea"
                value={template ? template.message : message}
                onChange={e => { setMessage(e.target.value); if (msgError) setMsgError(''); }}
                placeholder="Andika ujumbe wako hapa..."
                rows={6}
                disabled={!!sendingId || !!template}
              />
              <div className="csm-meta">
                {msgError
                  ? <span className="csm-error">{msgError}</span>
                  : <span className="csm-chars">
                      {template
                        ? 'Using a saved message — clear it to write your own.'
                        : `Characters: ${message.length}`}
                    </span>}
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

          {templatePicker(sendingAll)}

          <div className="form-group">
            <label>Message</label>
            <textarea
              className="csm-textarea"
              value={template ? template.message : message}
              onChange={e => { setMessage(e.target.value); if (msgError) setMsgError(''); }}
              placeholder="Andika ujumbe wako hapa..."
              rows={6}
              disabled={sendingAll || !!template}
            />
            <div className="csm-meta">
              {msgError
                ? <span className="csm-error">{msgError}</span>
                : <span className="csm-chars">
                    {template
                      ? 'Using a saved message — clear it to write your own.'
                      : `Characters: ${message.length}`}
                  </span>}
            </div>
          </div>

          {campaignPlan && (
            <div className="csm-plan">
              <span className="csm-plan-label">Preview{campaignPlan.previewFor ? ` — for ${campaignPlan.previewFor}` : ''}</span>
              <pre className="csm-plan-body">{campaignPlan.preview || '—'}</pre>
              <span className="csm-plan-counts">
                {campaignPlan.chars != null && (
                  <>{campaignPlan.chars} / {campaignPlan.limit} characters · {campaignPlan.segments} SMS · </>
                )}
                {campaignPlan.eligible} will receive · {campaignPlan.alreadySent} already received
                {campaignPlan.noPhone > 0 && <> · {campaignPlan.noPhone} without a phone</>}
              </span>
              {campaignPlan.overLimit > 0 && (
                <span className="csm-plan-warn">
                  {campaignPlan.overLimit} member{campaignPlan.overLimit !== 1 ? 's' : ''} over the
                  one-SMS limit and will not be sent
                  {campaignPlan.overLimitNames?.length
                    ? ` (${campaignPlan.overLimitNames.join(', ')})` : ''}.
                  Shorten the message to include them.
                </span>
              )}
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowSendAll(false)} disabled={sendingAll}>
              Cancel
            </button>
            <button type="button" className="btn" onClick={confirmSendAll} disabled={sendingAll || planning}>
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
        message={campaignPlan
          ? `${campaignPlan.eligible} member${campaignPlan.eligible !== 1 ? 's' : ''} will receive this SMS.`
            + (campaignPlan.alreadySent
              ? ` ${campaignPlan.alreadySent} will be skipped because they already received this message.`
              : '')
          : ''}
        confirmText={campaignPlan ? `Send to ${campaignPlan.eligible} Members` : 'Confirm & Send'}
        confirmVariant="danger"
        loading={sendingAll}
      />

      <SavedMessagesModal
        isOpen={showSaved}
        onClose={() => setShowSaved(false)}
        eventId={eventId || undefined}
        onSelect={pickTemplate ? (t) => { setTemplate(t); setPickTemplate(false); } : undefined}
      />

      {/* ── Import members from Excel ──────────────────── */}
      <Modal isOpen={showImport} onClose={closeImport} title="Import Members" size="small">
        <div className="csm-import">
          {importResult ? (
            <>
              <p className="csm-import-done">Import completed.</p>
              <ul className="csm-import-stats">
                <li><strong>{importResult.rows ?? '—'}</strong> rows read</li>
                <li><strong>{importResult.imported}</strong> added</li>
                <li><strong>{importResult.skipped}</strong> skipped</li>
                {importResult.withoutPhone > 0 && (
                  <li><strong>{importResult.withoutPhone}</strong> without a phone number</li>
                )}
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
                Upload a spreadsheet with a <strong>Name</strong> column and an optional
                <strong> Phone</strong> column. Members without a phone number are still
                imported — you can add their number later. Supported: .xlsx, .xls
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
