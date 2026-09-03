import React, { useState, useEffect, useCallback } from 'react';
import auditService from '../services/auditService';
import DataTable from '../components/DataTable';
import { 
  ClipboardList, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Key,
  LogIn,
  ExternalLink
} from 'lucide-react';

export const AdminAuditPage = () => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters and pagination
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [emailFilter, setEmailFilter] = useState('');

  // Input states for form before submit
  const [actionInput, setActionInput] = useState('');
  const [emailInput, setEmailInput] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await auditService.list({
        limit,
        offset,
        action: actionFilter,
        userEmail: emailFilter,
      });
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [limit, offset, actionFilter, emailFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    setOffset(0); // Reset to first page
    setActionFilter(actionInput);
    setEmailFilter(emailInput);
  };

  const handleClearFilter = () => {
    setActionInput('');
    setEmailInput('');
    setActionFilter('');
    setEmailFilter('');
    setOffset(0);
  };

  const totalPages = Math.ceil(total / limit) || 1;
  const currentPage = Math.floor(offset / limit) + 1;

  const handlePreviousPage = () => {
    if (offset >= limit) {
      setOffset(offset - limit);
    }
  };

  const handleNextPage = () => {
    if (offset + limit < total) {
      setOffset(offset + limit);
    }
  };

  const getActionBadge = (action) => {
    const act = action.toUpperCase();
    if (act.includes('DENIED') || act.includes('FAILED')) {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-red-100 border border-red-200 text-red-800 text-[10px] font-bold font-mono uppercase">
          <ShieldAlert className="w-3 h-3" />
          <span>{action}</span>
        </span>
      );
    }
    if (act.includes('LOGIN_SUCCESS')) {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-forest/10 border border-forest/30 text-forest text-[10px] font-bold font-mono uppercase">
          <LogIn className="w-3 h-3" />
          <span>{action}</span>
        </span>
      );
    }
    if (act.includes('ZOHO_APP_OPENED')) {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-800 text-[10px] font-bold font-mono uppercase">
          <ExternalLink className="w-3 h-3" />
          <span>{action}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-stone-100 border border-stone-300 text-stone-800 text-[10px] font-bold font-mono uppercase">
        <ShieldCheck className="w-3 h-3 text-stone-500" />
        <span>{action}</span>
      </span>
    );
  };

  const columns = [
    {
      title: 'Timestamp',
      key: 'created_at',
      render: (log) => {
        const d = new Date(log.created_at);
        return (
          <div className="font-mono text-[11px] text-stone-600 whitespace-nowrap">
            {d.toISOString().replace('T', ' ').substring(0, 19)}
          </div>
        );
      },
    },
    {
      title: 'Action Event',
      key: 'action',
      render: (log) => getActionBadge(log.action),
    },
    {
      title: 'User Email',
      key: 'user_email',
      render: (log) => (
        <div className="font-mono text-xs text-ink-text">
          {log.user_email}
          {log.user_id && <span className="text-stone-400 text-[10px] ml-1">#{log.user_id}</span>}
        </div>
      ),
    },
    {
      title: 'Event Detail',
      key: 'detail',
      render: (log) => (
        <p className="text-xs text-stone-700 max-w-md font-mono text-[11px] leading-relaxed break-words">
          {log.detail || '—'}
        </p>
      ),
    },
    {
      title: 'IP Address',
      key: 'ip_address',
      render: (log) => (
        <span className="font-mono text-[11px] text-stone-500">
          {log.ip_address || '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-heading font-bold uppercase tracking-widest text-stone-500">
            Security & Compliance
          </span>
          <h1 className="text-2xl font-heading font-bold text-ink-text uppercase tracking-tight">
            System Audit Trail
          </h1>
          <p className="text-xs text-stone-600 mt-0.5">
            Immutable log of user logins, access denials, Zoho session launches, and administrative mutations
          </p>
        </div>

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-border text-xs font-semibold uppercase tracking-wider text-stone-700 hover:text-ink hover:bg-stone-50 transition-colors disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <form
        onSubmit={handleFilterSubmit}
        className="bg-white border border-border p-4 flex flex-col md:flex-row md:items-end gap-3 text-xs"
      >
        <div className="flex-1">
          <label className="block text-[11px] font-heading font-bold uppercase tracking-wider text-stone-600 mb-1">
            Filter by Action
          </label>
          <input
            type="text"
            value={actionInput}
            onChange={(e) => setActionInput(e.target.value)}
            placeholder="e.g. LOGIN_SUCCESS, ACCESS_DENIED, USER_CREATED"
            className="w-full px-3 py-1.5 border border-border bg-stone-50 text-ink-text placeholder-stone-400 focus:bg-white focus:outline-none focus:border-forest"
          />
        </div>

        <div className="flex-1">
          <label className="block text-[11px] font-heading font-bold uppercase tracking-wider text-stone-600 mb-1">
            Filter by User Email
          </label>
          <input
            type="text"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="e.g. admin@brainwave.io"
            className="w-full px-3 py-1.5 border border-border bg-stone-50 text-ink-text placeholder-stone-400 focus:bg-white focus:outline-none focus:border-forest"
          />
        </div>

        <div className="flex items-center space-x-2 pt-2 md:pt-0">
          <button
            type="submit"
            className="flex items-center space-x-1.5 px-4 py-2 bg-forest hover:bg-[#25583E] text-white font-heading font-bold uppercase tracking-wider transition-colors border border-[#25583E]"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
          </button>
          <button
            type="button"
            onClick={handleClearFilter}
            className="px-3 py-2 bg-white border border-border text-stone-600 hover:text-ink hover:bg-stone-50 font-heading font-semibold uppercase tracking-wider transition-colors"
          >
            Reset
          </button>
        </div>
      </form>

      {/* Audit Log Table */}
      <DataTable
        columns={columns}
        data={logs}
        loading={loading}
        emptyMessage="No audit logs match the query parameters"
      />

      {/* Pagination Footer */}
      <div className="flex items-center justify-between bg-white border border-border px-4 py-3 text-xs text-stone-600">
        <div>
          Showing <span className="font-bold text-ink-text">{logs.length}</span> of{' '}
          <span className="font-bold text-ink-text">{total}</span> recorded events
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-[11px] font-mono">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center space-x-1">
            <button
              onClick={handlePreviousPage}
              disabled={offset === 0 || loading}
              className="p-1 border border-border bg-stone-50 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextPage}
              disabled={offset + limit >= total || loading}
              className="p-1 border border-border bg-stone-50 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAuditPage;
