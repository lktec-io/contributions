import { useState, useEffect, useContext } from 'react';
import {
  FiUser, FiPhone, FiMail, FiCreditCard, FiSend, FiEdit2,
  FiCalendar, FiAlertTriangle,
} from 'react-icons/fi';
import { ToastContext } from '../../context/ToastContext';
import { contributorService } from '../../services/contributorService';
import { paymentService } from '../../services/paymentService';
import { smsService } from '../../services/smsService';
import { contributionService } from '../../services/contributionService';
import { formatCurrency, formatDate, getStatusBadgeClass } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/helpers';
import Modal from '../common/Modal';
import PaymentForm from './PaymentForm';
import ContributorForm from './ContributorForm';
import LoadingSpinner from '../common/LoadingSpinner';
import './ContributorDetails.css';

export default function ContributorDetails({ contributorId, events, onClose, onRefreshList }) {
  const { toast } = useContext(ToastContext);

  const [contributor, setContributor] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  const [showPayModal,  setShowPayModal]  = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null); // contribution_id + event info

  const [smsSending, setSmsSending] = useState(new Set());
  const [smsSuccess, setSmsSuccess] = useState(new Set());
  const [payLoading, setPayLoading]  = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    if (contributorId) fetchContributor();
  }, [contributorId]);

  const fetchContributor = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await contributorService.getById(contributorId);
      setContributor(res.data.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSendSms = async (ev) => {
    if (!contributor.phone) {
      toast.error('This contributor has no phone number');
      return;
    }
    const id = ev.contribution_id;
    setSmsSending(prev => new Set(prev).add(id));
    try {
      await smsService.sendReminder(id);
      setSmsSuccess(prev => {
        const next = new Set(prev).add(id);
        setTimeout(() => setSmsSuccess(s => { const n = new Set(s); n.delete(id); return n; }), 3000);
        return next;
      });
      toast.success(`SMS sent for "${ev.event_name}"`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSmsSending(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const openPayment = (ev) => {
    // Build a contribution-like object PaymentForm expects
    setSelectedEvent({
      id:               ev.contribution_id,
      contributor_name: contributor.name,
      amount:           ev.amount,
      paid_amount:      ev.paid_amount,
      status:           ev.status,
      event_name:       ev.event_name,
    });
    setShowPayModal(true);
  };

  const handlePaySubmit = async (data) => {
    setPayLoading(true);
    try {
      await paymentService.create(data);
      toast.success('Payment recorded');
      setShowPayModal(false);
      setSelectedEvent(null);
      fetchContributor();
      onRefreshList?.();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPayLoading(false);
    }
  };

  const openEdit = (ev) => {
    // Populate ContributorForm with the specific event's contribution data
    setSelectedEvent({
      id:               ev.contribution_id,
      event_id:         ev.event_id,
      contributor_name: contributor.name,
      phone:            contributor.phone || '',
      email:            contributor.email || '',
      amount:           ev.amount,
      event_name:       ev.event_name,
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (data) => {
    setEditLoading(true);
    try {
      await contributionService.update(selectedEvent.id, data);
      toast.success('Updated successfully');
      setShowEditModal(false);
      setSelectedEvent(null);
      fetchContributor();
      onRefreshList?.();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setEditLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="cd-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error || !contributor) {
    return (
      <div className="cd-error">
        <FiAlertTriangle size={32} color="var(--accent-orange)" />
        <p>{error || 'Contributor not found'}</p>
      </div>
    );
  }

  return (
    <div className="contributor-details">
      {/* ── Profile header ── */}
      <div className="cd-profile">
        <div className="cd-avatar">{contributor.name?.[0]?.toUpperCase()}</div>
        <div className="cd-info">
          <h3 className="cd-name">{contributor.name}</h3>
          <div className="cd-meta">
            {contributor.phone && (
              <span className="cd-meta-item"><FiPhone size={13} /> {contributor.phone}</span>
            )}
            {contributor.email && (
              <span className="cd-meta-item"><FiMail size={13} /> {contributor.email}</span>
            )}
            <span className="cd-meta-item">
              <FiCalendar size={13} /> Since {formatDate(contributor.created_at)}
            </span>
          </div>
        </div>
        <div className="cd-stats">
          <div className="cd-stat">
            <span className="cd-stat-value">{contributor.events?.length ?? 0}</span>
            <span className="cd-stat-label">Events</span>
          </div>
          <div className="cd-stat">
            <span className="cd-stat-value">
              {formatCurrency(
                contributor.events?.reduce((s, e) => s + parseFloat(e.paid_amount || 0), 0) ?? 0
              )}
            </span>
            <span className="cd-stat-label">Total Paid</span>
          </div>
        </div>
      </div>

      {/* ── Event assignments ── */}
      <div className="cd-events-section">
        <h4 className="cd-events-title">
          <FiCalendar size={15} /> Event Assignments ({contributor.events?.length ?? 0})
        </h4>

        {!contributor.events?.length ? (
          <p className="cd-no-events">No event assignments found.</p>
        ) : (
          <div className="cd-events-list">
            {contributor.events.map(ev => {
              const pledge      = parseFloat(ev.amount || 0);
              const paid        = parseFloat(ev.paid_amount || 0);
              const balance     = pledge - paid;
              const isSending   = smsSending.has(ev.contribution_id);
              const isSent      = smsSuccess.has(ev.contribution_id);

              return (
                <div key={ev.contribution_id} className="cd-event-card">
                  <div className="cd-ec-header">
                    <span className="cd-ec-name">{ev.event_name}</span>
                    <span className={`status-badge ${ev.status}`}>{ev.status}</span>
                  </div>

                  <div className="cd-ec-amounts">
                    <div className="cd-ec-amount-item">
                      <span className="cd-ec-label">Target</span>
                      <span className="cd-ec-value">{formatCurrency(pledge)}</span>
                    </div>
                    <div className="cd-ec-amount-item">
                      <span className="cd-ec-label">Paid</span>
                      <span className="cd-ec-value cd-paid">{formatCurrency(paid)}</span>
                    </div>
                    <div className="cd-ec-amount-item">
                      <span className="cd-ec-label">Balance</span>
                      <span className={`cd-ec-value ${balance > 0 ? 'cd-outstanding' : 'cd-paid'}`}>
                        {formatCurrency(balance)}
                      </span>
                    </div>
                  </div>

                  <div className="cd-ec-actions">
                    <button
                      className="icon-btn"
                      onClick={() => openEdit(ev)}
                      title="Edit pledge"
                    >
                      <FiEdit2 size={15} />
                    </button>
                    <button
                      className="icon-btn icon-btn-green"
                      onClick={() => openPayment(ev)}
                      disabled={ev.status === 'paid'}
                      title={ev.status === 'paid' ? 'Fully paid' : 'Record payment'}
                    >
                      <FiCreditCard size={15} />
                    </button>
                    <button
                      className={`icon-btn icon-btn-sms ${isSent ? 'icon-btn-sms-sent' : ''}`}
                      onClick={() => handleSendSms(ev)}
                      disabled={!contributor.phone || isSending || ev.status === 'paid'}
                      title={!contributor.phone ? 'No phone number' : isSent ? 'Sent!' : `Send SMS for ${ev.event_name}`}
                    >
                      <FiSend size={14} className={isSending ? 'spin' : ''} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Record Payment modal ── */}
      <Modal
        isOpen={showPayModal}
        onClose={() => { setShowPayModal(false); setSelectedEvent(null); }}
        title={`Record Payment — ${selectedEvent?.event_name ?? ''}`}
        size="small"
      >
        <PaymentForm
          contribution={selectedEvent}
          onSubmit={handlePaySubmit}
          onCancel={() => { setShowPayModal(false); setSelectedEvent(null); }}
          loading={payLoading}
        />
      </Modal>

      {/* ── Edit pledge modal ── */}
      <Modal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setSelectedEvent(null); }}
        title={`Edit — ${selectedEvent?.event_name ?? ''}`}
        size="medium"
      >
        <ContributorForm
          initialData={selectedEvent}
          events={events}
          onSubmit={handleEditSubmit}
          onCancel={() => { setShowEditModal(false); setSelectedEvent(null); }}
          loading={editLoading}
        />
      </Modal>
    </div>
  );
}
