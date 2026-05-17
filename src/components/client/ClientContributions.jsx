import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { FiPlus, FiDownload, FiGrid, FiList, FiSend } from 'react-icons/fi';
import { ToastContext } from '../../context/ToastContext';
import { contributorService } from '../../services/contributorService';
import { eventService } from '../../services/eventService';
import { exportService } from '../../services/exportService';
import { smsService } from '../../services/smsService';
import { getErrorMessage, debounce } from '../../utils/helpers';
import Modal from '../common/Modal';
import ContributorForm from './ContributorForm';
import ContributorDetails from './ContributorDetails';
import ContributorsTable from './ContributorsTable';
import ContributorsGrid from './ContributorsGrid';
import './ClientContributions.css';

export default function ClientContributions() {
  const { toast } = useContext(ToastContext);

  const [contributors, setContributors] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [events, setEvents]             = useState([]);
  const [total, setTotal]               = useState(0);

  const [search, setSearch]               = useState('');
  const [selectedEvent, setSelectedEvent] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [viewMode, setViewMode]           = useState('table');

  const [showAddModal,     setShowAddModal]     = useState(false);
  const [showDetailModal,  setShowDetailModal]  = useState(false);

  const [selectedContributor, setSelectedContributor] = useState(null);
  const [addLoading, setAddLoading]   = useState(false);
  const [exporting, setExporting]     = useState('');
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkStatus, setBulkStatus]   = useState(null);

  const currentFilters = useRef({ search: '', eventId: '', status: '' });

  useEffect(() => {
    eventService.getAll()
      .then(res => setEvents(res.data.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    smsService.getBulkStatus()
      .then(res => setBulkStatus(res.data.data))
      .catch(() => setBulkStatus({ canSend: true, daysRemaining: 0 }));
  }, []);

  useEffect(() => {
    const params = { search, eventId: selectedEvent, status: selectedStatus };
    currentFilters.current = params;
    fetchContributors(params);
  }, [selectedEvent, selectedStatus]);

  const fetchContributors = async (params = {}) => {
    setLoading(true);
    try {
      const res = await contributorService.getAll(params);
      const list = res.data.data?.contributors || [];
      setContributors(list);
      setTotal(list.length);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const debouncedFetch = useCallback(
    debounce((q) => {
      const params = { search: q, eventId: currentFilters.current.eventId, status: currentFilters.current.status };
      currentFilters.current = params;
      fetchContributors(params);
    }, 300),
    []
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
    fetchContributors({});
  };

  const hasFilters = search || selectedEvent || selectedStatus;

  const canDispatch  = bulkStatus?.canSend ?? true;
  const dispatchLabel = () => {
    if (bulkSending) return 'Sending…';
    if (bulkStatus && !bulkStatus.canSend) return `Next SMS in ${bulkStatus.daysRemaining} day(s)`;
    return 'Dispatch SMS to All';
  };

  const handleDispatch = async () => {
    setBulkSending(true);
    try {
      const res = await smsService.sendBulkReminders(selectedEvent || undefined);
      const { sent, total: t } = res.data.data;
      toast.success(`SMS dispatched to ${sent} of ${t} contributor(s)`);
      const statusRes = await smsService.getBulkStatus();
      setBulkStatus(statusRes.data.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBulkSending(false);
    }
  };

  const handleAddSubmit = async (data) => {
    setAddLoading(true);
    // Use the underlying contributions API to create the event-contributor record
    try {
      const { contributionService } = await import('../../services/contributionService');
      await contributionService.create(data);
      toast.success('Contributor added');
      setShowAddModal(false);
      fetchContributors(currentFilters.current);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setAddLoading(false);
    }
  };

  const handleExport = async (type) => {
    setExporting(type);
    try {
      const eventName = events.find(e => String(e.id) === String(selectedEvent))?.name || 'all';
      if (type === 'xlsx') await exportService.exportXLSX(selectedEvent || undefined, eventName);
      if (type === 'pdf')  await exportService.exportPDF(selectedEvent || undefined, eventName);
      toast.success(`${type.toUpperCase()} exported`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExporting('');
    }
  };

  const openDetail = (contributor) => {
    setSelectedContributor(contributor);
    setShowDetailModal(true);
  };

  const closeDetail = () => {
    setShowDetailModal(false);
    setSelectedContributor(null);
  };

  return (
    <div className="client-contributions">
      <div className="page-header">
        <div>
          <h2 className="page-title">My Contributors</h2>
          <p className="page-subtitle">
            {total} unique contributor{total !== 1 ? 's' : ''}
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
            <button className="btn btn-secondary btn-export" onClick={() => handleExport('xlsx')} disabled={!!exporting}>
              <FiDownload size={13} /> {exporting === 'xlsx' ? '…' : 'Excel'}
            </button>
            <button className="btn btn-secondary btn-export" onClick={() => handleExport('pdf')} disabled={!!exporting}>
              <FiDownload size={13} /> {exporting === 'pdf' ? '…' : 'PDF'}
            </button>
          </div>
          <button
            className="btn btn-dispatch"
            onClick={handleDispatch}
            disabled={!canDispatch || bulkSending}
            title={dispatchLabel()}
          >
            <FiSend size={14} className={bulkSending ? 'spin' : ''} />
            {dispatchLabel()}
          </button>
          <button className="btn" onClick={() => setShowAddModal(true)}>
            <FiPlus size={16} /> Add Contributor
          </button>
        </div>
      </div>

      <div className="filters-bar">
        <input
          type="text"
          className="filter-search"
          placeholder="Search by name, phone or email…"
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
            contributors={contributors}
            loading={loading}
            onView={openDetail}
          />
        </div>
      ) : (
        <ContributorsGrid
          contributors={contributors}
          loading={loading}
          hasFilters={hasFilters}
          onView={openDetail}
        />
      )}

      {/* Add Contributor */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Contributor" size="medium">
        <ContributorForm
          events={events}
          onSubmit={handleAddSubmit}
          onCancel={() => setShowAddModal(false)}
          loading={addLoading}
        />
      </Modal>

      {/* Contributor Detail — all event assignments */}
      <Modal
        isOpen={showDetailModal}
        onClose={closeDetail}
        title={selectedContributor ? selectedContributor.name : 'Contributor Details'}
        size="large"
      >
        {selectedContributor && (
          <ContributorDetails
            contributorId={selectedContributor.id}
            events={events}
            onClose={closeDetail}
            onRefreshList={() => fetchContributors(currentFilters.current)}
          />
        )}
      </Modal>
    </div>
  );
}
