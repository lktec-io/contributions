import { useState, useEffect, useContext, useCallback } from 'react';
import { FiDownload, FiAlertTriangle, FiDollarSign, FiArchive } from 'react-icons/fi';
import { ToastContext } from '../../context/ToastContext';
import { contributionService } from '../../services/contributionService';
import { eventService } from '../../services/eventService';
import { exportService } from '../../services/exportService';
import { formatCurrency, formatDate, getStatusBadgeClass } from '../../utils/formatters';
import { getErrorMessage, debounce } from '../../utils/helpers';
import LoadingSpinner from '../common/LoadingSpinner';
import EmptyState from '../common/EmptyState';
import ConfirmDialog from '../common/ConfirmDialog';
import './AdminContributions.css';

export default function AdminContributions() {
  const { toast } = useContext(ToastContext);
  const [contributions, setContributions] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedEvent, setSelectedEvent] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [exporting, setExporting] = useState('');

  const [confirmHide,  setConfirmHide]  = useState(null);
  const [hideLoading,  setHideLoading]  = useState(false);

  useEffect(() => {
    eventService.getAll()
      .then(res => setEvents(res.data.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchContributions({ search, eventId: selectedEvent, status: selectedStatus });
  }, [selectedEvent, selectedStatus]);

  const fetchContributions = async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await contributionService.getAll(params);
      const data = res.data.data;
      const list = data.contributions || data;
      setContributions(list);
      setTotal(data.total ?? list.length);
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearch = useCallback(
    debounce((q) => fetchContributions({ search: q, eventId: selectedEvent, status: selectedStatus }), 300),
    [selectedEvent, selectedStatus]
  );

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    debouncedSearch(e.target.value);
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedEvent('');
    setSelectedStatus('');
    fetchContributions({});
  };

  const hasFilters = search || selectedEvent || selectedStatus;

  const handleExport = async (type) => {
    setExporting(type);
    try {
      const eventName = events.find(e => String(e.id) === String(selectedEvent))?.name || 'all';
      await exportService[`export${type.toUpperCase()}`](selectedEvent || undefined, eventName);
      toast.success(`${type.toUpperCase()} exported`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExporting('');
    }
  };

  const handleHideConfirm = async () => {
    setHideLoading(true);
    try {
      await contributionService.hide(confirmHide.id);
      toast.success(`"${confirmHide.contributor_name}" moved to hidden`);
      setConfirmHide(null);
      fetchContributions({ search, eventId: selectedEvent, status: selectedStatus });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setHideLoading(false);
    }
  };

  return (
    <div className="admin-contributions">
      <div className="page-header">
        <div>
          <h2 className="page-title">All Contributions</h2>
          <p className="page-subtitle">
            Showing {contributions.length} of {total} contribution{total !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="export-buttons">
          <button className="btn btn-secondary btn-export" onClick={() => handleExport('csv')} disabled={!!exporting}>
            <FiDownload size={13} /> {exporting === 'csv' ? '…' : 'CSV'}
          </button>
          <button className="btn btn-secondary btn-export" onClick={() => handleExport('xlsx')} disabled={!!exporting}>
            <FiDownload size={13} /> {exporting === 'xlsx' ? '…' : 'Excel'}
          </button>
          <button className="btn btn-secondary btn-export" onClick={() => handleExport('pdf')} disabled={!!exporting}>
            <FiDownload size={13} /> {exporting === 'pdf' ? '…' : 'PDF'}
          </button>
        </div>
      </div>

      <div className="filters-bar">
        <input
          type="text"
          className="filter-search"
          placeholder="Search by name…"
          value={search}
          onChange={handleSearchChange}
        />
        <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)} className="filter-select">
          <option value="">All Events</option>
          {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} className="filter-select">
          <option value="">All Statuses</option>
          <option value="pledge">Pledge</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
        </select>
        {hasFilters && (
          <button className="btn btn-secondary" onClick={clearFilters}>Clear</button>
        )}
      </div>

      {loading ? (
        <div className="tab-loading"><LoadingSpinner size="large" /></div>
      ) : error ? (
        <div className="error-state">
          <FiAlertTriangle size={36} color="var(--accent-orange)" />
          <p>{error}</p>
          <button className="btn" onClick={() => fetchContributions({ search, eventId: selectedEvent, status: selectedStatus })}>Retry</button>
        </div>
      ) : contributions.length === 0 ? (
        <EmptyState IconComponent={FiDollarSign} title="No contributions found" description={hasFilters ? 'Try adjusting your filters.' : 'No contributions recorded yet.'} />
      ) : (
        <div className="section-card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Contributor</th>
                  <th>Event</th>
                  <th>Owner</th>
                  <th>Pledged</th>
                  <th>Paid</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contributions.map(c => (
                  <tr key={c.id}>
                    <td className="td-name">{c.contributor_name}</td>
                    <td>{c.event_name}</td>
                    <td className="td-muted">{c.owner_name || '—'}</td>
                    <td className="td-money">{formatCurrency(c.amount)}</td>
                    <td className="td-money td-paid">{formatCurrency(c.paid_amount)}</td>
                    <td className="td-money td-outstanding">
                      {formatCurrency(parseFloat(c.amount) - parseFloat(c.paid_amount))}
                    </td>
                    <td><span className={getStatusBadgeClass(c.status)}>{c.status}</span></td>
                    <td className="td-date">{formatDate(c.created_at)}</td>
                    <td className="td-actions">
                      <button
                        className="icon-btn icon-btn-orange"
                        onClick={() => setConfirmHide(c)}
                        title="Hide contributor"
                      >
                        <FiArchive size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmHide}
        onClose={() => setConfirmHide(null)}
        onConfirm={handleHideConfirm}
        title="Hide Contributor"
        message={`Hide "${confirmHide?.contributor_name}"? They will be moved to Hidden Records and auto-deleted after 30 days.`}
        confirmText="Hide"
        confirmVariant="warning"
        loading={hideLoading}
      />
    </div>
  );
}
