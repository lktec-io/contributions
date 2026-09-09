import { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiCheck } from 'react-icons/fi';
import { ToastContext } from '../../context/ToastContext';
import { smsTemplateService } from '../../services/smsTemplateService';
import { smsService } from '../../services/smsService';
import { getErrorMessage } from '../../utils/helpers';
import Modal from '../common/Modal';
import ConfirmDialog from '../common/ConfirmDialog';
import './SavedMessagesModal.css';

/*  Saved Custom SMS messages.

    The preview deliberately calls the server's campaign-preview endpoint
    rather than rendering locally: that endpoint runs the same formatter the
    send path uses, so what is previewed here is exactly what a handset gets. */

const VARIABLES = [
  { token: '{{name}}',  hint: "member's name" },
  { token: '{{event}}', hint: 'selected event' },
];

const emptyDraft = { id: null, title: '', message: '' };

export default function SavedMessagesModal({ isOpen, onClose, eventId, onSelect }) {
  const { toast } = useContext(ToastContext);

  const [templates, setTemplates] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [draft,     setDraft]     = useState(null);   // null = list view
  const [errors,    setErrors]    = useState({});
  const [saving,    setSaving]    = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting,  setDeleting]  = useState(false);
  const [preview,   setPreview]   = useState(null);
  const [previewing, setPreviewing] = useState(false);

  const textareaRef = useRef(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await smsTemplateService.getAll();
      setTemplates(res.data.data.templates || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isOpen) { fetchTemplates(); setDraft(null); setPreview(null); }
  }, [isOpen, fetchTemplates]);

  // Inserts a variable at the caret so the user need not type the braces.
  const insertVariable = (token) => {
    const el = textareaRef.current;
    if (!el) { setDraft(d => ({ ...d, message: `${d.message}${token}` })); return; }
    const start = el.selectionStart ?? el.value.length;
    const end   = el.selectionEnd ?? start;
    const next  = el.value.slice(0, start) + token + el.value.slice(end);
    setDraft(d => ({ ...d, message: next }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const validate = () => {
    const e = {};
    if (!draft.title.trim())   e.title   = 'Title is required';
    if (!draft.message.trim()) e.message = 'Message is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async (ev) => {
    ev.preventDefault();
    if (!validate() || saving) return;
    setSaving(true);
    try {
      const payload = { title: draft.title.trim(), message: draft.message };
      if (draft.id) {
        await smsTemplateService.update(draft.id, payload);
        toast.success('Saved message updated');
      } else {
        await smsTemplateService.create(payload);
        toast.success('Message saved');
      }
      setDraft(null);
      setPreview(null);
      fetchTemplates();
    } catch (err) {
      // Surface field errors (e.g. an unsupported variable) next to the field
      const fieldErrors = err?.response?.data?.errors;
      if (Array.isArray(fieldErrors) && fieldErrors.length) {
        const mapped = {};
        fieldErrors.forEach(f => { mapped[f.field] = f.message; });
        setErrors(mapped);
      }
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await smsTemplateService.remove(confirmDelete.id);
      toast.success('Saved message deleted');
      setConfirmDelete(null);
      fetchTemplates();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const runPreview = async (message, templateId) => {
    setPreviewing(true);
    try {
      const res = await smsService.previewCustomCampaign({
        message: templateId ? undefined : message,
        templateId,
        eventId: eventId || undefined,
      });
      setPreview(res.data.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPreviewing(false);
    }
  };

  const title = draft ? (draft.id ? 'Edit Saved Message' : 'New Saved Message') : 'Saved Messages';

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={title} size="medium">
        {draft ? (
          <form onSubmit={save} noValidate className="sm-form">
            <div className="form-group">
              <label>Title *</label>
              <input
                value={draft.title}
                onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                placeholder="Wedding Invitation"
                maxLength={120}
              />
              {errors.title && <span className="field-error">{errors.title}</span>}
            </div>

            <div className="form-group">
              <label>Message *</label>
              <div className="sm-vars">
                <span className="sm-vars-label">Available variables:</span>
                {VARIABLES.map(v => (
                  <button
                    key={v.token}
                    type="button"
                    className="sm-var"
                    onClick={() => insertVariable(v.token)}
                    title={`Insert ${v.token} — ${v.hint}`}
                  >
                    {v.token}
                  </button>
                ))}
              </div>
              <textarea
                ref={textareaRef}
                className="sm-textarea"
                value={draft.message}
                onChange={e => setDraft(d => ({ ...d, message: e.target.value }))}
                placeholder="Ndugu {{name}}, tunakualika kushiriki nasi katika {{event}}."
                rows={6}
                maxLength={1600}
              />
              <div className="sm-meta">
                {errors.message
                  ? <span className="sm-error">{errors.message}</span>
                  : <span className="sm-chars">Characters: {draft.message.length}</span>}
              </div>
            </div>

            {preview && (
              <div className="sm-preview">
                <span className="sm-preview-label">
                  Preview{preview.previewFor ? ` — for ${preview.previewFor}` : ''}
                </span>
                <pre className="sm-preview-body">{preview.preview || '—'}</pre>
              </div>
            )}

            <div className="form-actions sm-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setDraft(null); setPreview(null); }}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => runPreview(draft.message, null)}
                disabled={previewing || !draft.message.trim()}
              >
                <FiEye size={14} /> {previewing ? 'Loading…' : 'Preview'}
              </button>
              <button type="submit" className="btn" disabled={saving}>
                {saving ? 'Saving…' : draft.id ? 'Save Changes' : 'Save Message'}
              </button>
            </div>
          </form>
        ) : (
          <div className="sm-list-wrap">
            <button className="btn sm-new" onClick={() => { setDraft(emptyDraft); setErrors({}); }}>
              <FiPlus size={15} /> New Saved Message
            </button>

            {loading ? (
              <p className="sm-empty">Loading…</p>
            ) : templates.length === 0 ? (
              <p className="sm-empty">
                No saved messages yet. Create one and reuse it for any member or campaign.
              </p>
            ) : (
              <ul className="sm-list">
                {templates.map(t => (
                  <li key={t.id} className="sm-item">
                    <div className="sm-item-info">
                      <span className="sm-item-title">{t.title}</span>
                      <span className="sm-item-text">{t.message}</span>
                    </div>
                    <div className="sm-item-actions">
                      {onSelect && (
                        <button
                          className="sm-btn sm-btn-use"
                          onClick={() => { onSelect(t); onClose(); }}
                        >
                          <FiCheck size={12} /> Use
                        </button>
                      )}
                      <button
                        className="sm-btn"
                        onClick={() => { setDraft({ id: t.id, title: t.title, message: t.message }); setErrors({}); setPreview(null); }}
                      >
                        <FiEdit2 size={12} /> Edit
                      </button>
                      <button className="sm-btn sm-btn-danger" onClick={() => setConfirmDelete(t)}>
                        <FiTrash2 size={12} /> Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        title="Delete Saved Message"
        message={`Delete "${confirmDelete?.title}"? This cannot be undone.`}
        confirmText="Delete"
        confirmVariant="danger"
        loading={deleting}
      />
    </>
  );
}
