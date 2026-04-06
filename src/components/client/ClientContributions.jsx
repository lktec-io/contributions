import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { FiPlus, FiDownload, FiGrid, FiList } from 'react-icons/fi';
import { ToastContext } from '../../context/ToastContext';
import { useContributions } from '../../hooks/useContributions';
import { eventService } from '../../services/eventService';
import { paymentService } from '../../services/paymentService';
import { exportService } from '../../services/exportService';
import { getErrorMessage, debounce } from '../../utils/helpers';
import Modal from '../common/Modal';
import ConfirmDialog from '../common/ConfirmDialog';
import ContributorForm from './ContributorForm';
import PaymentForm from './PaymentForm';
import ContributorsTable from './ContributorsTable';
import ContributorsGrid from './ContributorsGrid';
import './ClientContributions.css';

export default function ClientContributions() {
  const { toast } = useContext(ToastContext);
  const { contributions, loading, total, fetchContributions, createContribution, updateContribution, deleteContribution } = useContributions();

  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedEvent, setSelectedEvent] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [viewMode, setViewMode] = useState('table');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [selectedContrib, setSelectedContrib] = useState(null);
  const [addLoading, setAddLoading] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [exporting, setExporting] = useState('');

  const currentFilters = useRef({ search: '', eventId: '', status: '' });

  useEffect(() => {
    eventService.getAll()
      .then(res => setEvents(res.data.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const params = { search, eventId: selectedEvent, status: selectedStatus };
    currentFilters.current = params;
    fetchContributions(params);
  }, [selectedEvent, selectedStatus]);

  const debouncedFetch = useCallback(
    debounce((q) => {
      const params = { search: q, eventId: currentFilters.current.eventId, status: currentFilters.current.status };
      currentFilters.current = params;
      fetchContributions(params);
    }, 300),
    [fetchContributions]
  );

  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearch(q);
    currentFilters.current.search = q;
    debouncedFetch(q);
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedEvent('');
    setSelectedStatus('');
    currentFilters.current = { search: '', eventId: '', status: '' };
    fetchContributions({});
  };

  const refreshList = () => {
    fetchContributions(currentFilters.current);
  };

  const hasFilters = search || selectedEvent || selectedStatus;

  const handleAddSubmit = async (data) => {
    setAddLoading(true);
    try {
      await createContribution(data);
      toast.success('Contributor added');
      setShowAddModal(false);
      refreshList();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setAddLoading(false);
    }
  };

  const handleEditSubmit = async (data) => {
    setAddLoading(true);
    try {
      await updateContribution(selectedContrib.id, data);
      toast.success('Contributor updated');
      setShowEditModal(false);
      setSelectedContrib(null);
      refreshList();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setAddLoading(false);
    }
  };

  const handlePaymentSubmit = async (data) => {
    setPayLoading(true);
    try {
      await paymentService.create(data);
      toast.success('Payment recorded');
      setShowPaymentModal(false);
      setSelectedContrib(null);
      refreshList();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPayLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleteLoading(true);
    try {
      await deleteContribution(selectedContrib.id);
      toast.success('Contributor deleted');
      setShowDeleteConfirm(false);
      setSelectedContrib(null);
      refreshList();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleExport = async (type) => {
    setExporting(type);
    try {
      const eventName = events.find(e => String(e.id) === String(selectedEvent))?.name || 'all';
      if (type === 'csv')  await exportService.exportCSV(selectedEvent || undefined, eventName);
      if (type === 'xlsx') await exportService.exportXLSX(selectedEvent || undefined, eventName);
      if (type === 'pdf')  await exportService.exportPDF(selectedEvent || undefined, eventName);
      toast.success(`${type.toUpperCase()} exported`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExporting('');
    }
  };

  const tableActions = {
    onEdit: (c) => { setSelectedContrib(c); setShowEditModal(true); },
    onRecordPayment: (c) => { setSelectedContrib(c); setShowPaymentModal(true); },
    onDelete: (c) => { setSelectedContrib(c); setShowDeleteConfirm(true); },
  };

  return (
    <div className="client-contributions">
      <div className="page-header">
        <div>
          <h2 className="page-title">My Contributions</h2>
          <p className="page-subtitle">
            Showing {contributions.length} of {total} contributor{total !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="cc-header-actions">
          <div className="view-toggle">
            <button
              className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Table view"
            >
              <FiList size={16} />
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid view"
            >
              <FiGrid size={16} />
            </button>
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
          <button className="btn" onClick={() => setShowAddModal(true)}>
            <FiPlus size={16} /> Add Contributor
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
          <button className="btn btn-secondary" onClick={clearFilters}>Clear Filters</button>
        )}
      </div>

      {viewMode === 'table' ? (
        <div className="section-card">
          <ContributorsTable
            contributions={contributions}
            loading={loading}
            {...tableActions}
          />
        </div>
      ) : (
        <ContributorsGrid
          contributions={contributions}
          loading={loading}
          hasFilters={hasFilters}
          {...tableActions}
        />
      )}

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Contributor" size="medium">
        <ContributorForm
          events={events}
          onSubmit={handleAddSubmit}
          onCancel={() => setShowAddModal(false)}
          loading={addLoading}
        />
      </Modal>

      <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setSelectedContrib(null); }} title="Edit Contributor" size="medium">
        <ContributorForm
          initialData={selectedContrib}
          events={events}
          onSubmit={handleEditSubmit}
          onCancel={() => { setShowEditModal(false); setSelectedContrib(null); }}
          loading={addLoading}
        />
      </Modal>

      <Modal isOpen={showPaymentModal} onClose={() => { setShowPaymentModal(false); setSelectedContrib(null); }} title="Record Payment" size="small">
        <PaymentForm
          contribution={selectedContrib}
          onSubmit={handlePaymentSubmit}
          onCancel={() => { setShowPaymentModal(false); setSelectedContrib(null); }}
          loading={payLoading}
        />
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setSelectedContrib(null); }}
        onConfirm={handleDeleteConfirm}
        title="Delete Contributor"
        message={`Delete "${selectedContrib?.contributor_name}"? All payment history will also be removed.`}
        confirmText="Delete"
        confirmVariant="danger"
        loading={deleteLoading}
      />
    </div>
  );
}
