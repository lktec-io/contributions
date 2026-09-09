import { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiCheck } from 'react-icons/fi';
import { ToastContext } from '../../context/ToastContext';
import { smsTemplateService } from '../../services/smsTemplateService';
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

  // Live counter. Debounced so typing doesn't flood the endpoint, and always
  // server-rendered so the count matches the message that would be sent.
  useEffect(() => {
    if (!draft) { setPreview(null); return; }
    const text = draft.message;
    if (!text.trim()) { setPreview(null); return; }

    let alive = true;
    setPreviewing(true);
    const t = setTimeout(() => {
      smsTemplateService.preview(text, eventId || undefined)
        .then(res => { if (alive) setPreview(res.data.data); })
        .catch(() => { /* counter is advisory; save is still validated server-side */ })
        .finally(() => { if (alive) setPreviewing(false); });
    }, 300);

    return () => { alive = false; clearTimeout(t); };
  }, [draft?.message, eventId, draft]);

  // Over the one-SMS limit — blocks saving until the operator shortens it.
  const over = !!preview && preview.withinSingle === false;

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
              {/* Counts the FINAL rendered SMS — event, greeting, name and
                  line breaks included — not just the textarea contents. */}
              <div className={`sm-meta sm-counter ${over ? 'is-over' : ''}`}>
                {errors.message && <span className="sm-error">{errors.message}</span>}
                {!errors.message && preview && (
                  <>
                    <span className="sm-count-main">
                      {preview.chars} / {preview.limit} characters
                    </span>
                    <span className={`sm-seg ${over ? 'sm-seg-over' : ''}`}>
                      {preview.segments} SMS
                    </span>
                  </>
                )}
                {!errors.message && !preview && (
                  <span className="sm-chars">{previewing ? 'Counting…' : '—'}</span>
                )}
              </div>

              {over && (
                <p className="sm-over-note">
                  This is {preview.chars - preview.limit} character
                  {preview.chars - preview.limit !== 1 ? 's' : ''} over one SMS
                  {preview.measuredFor ? ` for your longest member name, “${preview.measuredFor}”` : ''}.
                  Shorten it to save.
                </p>
              )}
            </div>

            {preview && (
              <div className="sm-preview">
                <span className="sm-preview-label">
                  Preview{preview.measuredFor ? ` — for ${preview.measuredFor}` : ''}
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
              <button type="submit" className="btn" disabled={saving || over}>
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
