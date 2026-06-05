"use client";

import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { formatIndianNumber } from '@/lib/financial-utils';
import { formatDate } from '@/lib/date';
import ImagePreviewModal from '@/components/ImagePreviewModal';
import { getAssetUrl } from '@/lib/assets';

export default function AdminPaymentsPage() {
  const [stats, setStats] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchRoll, setSearchRoll] = useState('');
  
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewSrc, setPreviewSrc] = useState('');

  const [selectedTx, setSelectedTx] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.append('type', filterType);
      if (filterStatus) params.append('status', filterStatus);
      if (searchRoll) params.append('rollNo', searchRoll);

      const res = await fetch(`/api/admin/payments?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch payments');
      const data = await res.json();
      setStats(data.stats);
      setTransactions(data.transactions);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus, searchRoll]);

  useEffect(() => {
    const id = setTimeout(() => {
      fetchPayments();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchPayments]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchPayments();
  };

  const handleViewDetails = (tx) => {
    setSelectedTx(tx);
    setIsDetailsOpen(true);
  };

  const getStatusColor = (status, type) => {
    if (type === 'FEE') return 'text-green-600 font-bold';
    switch (status) {
      case 'APPROVED':
      case 'RELEASED':
      case 'SUCCESS':
      case 'SANCTIONED':
        return 'text-green-600 font-bold';
      case 'REJECTED':
        return 'text-red-600 font-bold';
      case 'PENDING':
        return 'text-amber-600 font-bold animate-pulse';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white border border-slate-200 shadow-sm p-6 lg:p-8">
        <h1 className="text-2xl font-bold text-[#0b3578] mb-8 tracking-tight uppercase">Payment Management</h1>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard 
            title="Fee Collection" 
            value={stats?.totalFees} 
            color="text-green-700" 
            loading={loading}
          />
          <StatCard 
            title="Certificate Revenue" 
            value={stats?.totalCertFees} 
            color="text-blue-700" 
            loading={loading}
          />
          <StatCard 
            title="Scholarship Released" 
            value={stats?.totalScholarshipReleased} 
            color="text-purple-700" 
            loading={loading}
          />
          <StatCard 
            title="Total Revenue" 
            value={stats?.totalRevenue} 
            color="text-[#0b3578]" 
            loading={loading}
            subtitle="Fees + Certificates"
          />
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6 items-end">
          <div className="flex-1 w-full">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Search Student</label>
            <form onSubmit={handleSearch} className="flex gap-2">
              <input 
                type="text" 
                placeholder="Roll Number..."
                value={searchRoll}
                onChange={e => setSearchRoll(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-200 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-hidden"
              />
              <button type="submit" className="bg-[#0b3578] text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-widest hover:bg-[#0a2d66] transition-colors">Search</button>
            </form>
          </div>
          
          <div className="w-full lg:w-48">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Payment Type</label>
            <select 
              value={filterType} 
              onChange={e => setFilterType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-hidden bg-white"
            >
              <option value="">All Types</option>
              <option value="FEE">Fee Payments</option>
              <option value="SCHOLARSHIP">Scholarships</option>
              <option value="CERTIFICATE">Certificates</option>
            </select>
          </div>

          <div className="w-full lg:w-48">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Status</label>
            <select 
              value={filterStatus} 
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-hidden bg-white"
            >
              <option value="">All Statuses</option>
              <option value="SUCCESS">Success / Released</option>
              <option value="PENDING">Pending</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Student</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Type</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Amount</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Reference</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-sm text-slate-400 animate-pulse italic">Loading transactions...</td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-sm text-slate-400 italic">No transactions found matching your filters.</td>
                </tr>
              ) : (
                transactions.map((tx, idx) => (
                  <tr key={`${tx.type}-${tx.id}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-600">{formatDate(tx.date)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-900">{tx.studentName}</span>
                        <span className="text-[10px] text-slate-500 font-mono tracking-tighter">{tx.rollNo}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                        tx.type === 'FEE' ? 'bg-green-50 text-green-700 border-green-200' :
                        tx.type === 'SCHOLARSHIP' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                        'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-slate-900">
                      ₹{formatIndianNumber(tx.amount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[10px] font-mono text-slate-500 uppercase truncate max-w-[120px]" title={tx.reference}>
                      {tx.reference || 'N/A'}
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap text-[10px] uppercase tracking-wider ${getStatusColor(tx.status, tx.type)}`}>
                      {tx.status}
                    </td>
                    <td className="px-4 py-3 text-center">
                       <button 
                         className="text-blue-600 hover:text-blue-800 text-[10px] font-bold uppercase tracking-widest cursor-pointer"
                         onClick={() => handleViewDetails(tx)}
                       >
                         Details
                       </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Details Modal */}
      {isDetailsOpen && selectedTx && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg border border-slate-200 shadow-2xl rounded-sm overflow-hidden flex flex-col">
                <div className="bg-[#0b3578] p-4 flex justify-between items-center">
                    <h2 className="text-white font-black uppercase text-xs tracking-[0.2em]">Transaction Details</h2>
                    <button onClick={() => setIsDetailsOpen(false)} className="text-white/60 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh]">
                    {/* Header Info */}
                    <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Student</p>
                            <p className="text-sm font-bold text-slate-900">{selectedTx.studentName}</p>
                            <p className="text-xs text-slate-500 font-mono">{selectedTx.rollNo}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Date</p>
                            <p className="text-sm font-bold text-slate-900">{formatDate(selectedTx.date)}</p>
                        </div>
                    </div>

                    {/* Financial Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-3 border border-slate-100 rounded-sm">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Amount</p>
                            <p className="text-lg font-black text-[#0b3578]">₹{formatIndianNumber(selectedTx.amount)}</p>
                        </div>
                        <div className="bg-slate-50 p-3 border border-slate-100 rounded-sm">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Type</p>
                            <p className="text-lg font-black text-slate-900 uppercase">{selectedTx.type}</p>
                        </div>
                    </div>

                    {/* Metadata Section */}
                    <div className="space-y-3">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">Additional Metadata</p>
                        
                        <div className="grid grid-cols-1 gap-2">
                           <DetailRow label="Reference ID" value={selectedTx.reference} mono />
                           <DetailRow label="Internal Status" value={selectedTx.status} highlight />
                           
                           {/* Dynamic Fields based on Type */}
                           {selectedTx.details && Object.entries(selectedTx.details).map(([key, val]) => {
                               if (val === null || val === undefined) return null;
                               
                               if (key === 'payment_screenshot') {
                                  return (
                                    <div key={key} className="flex justify-between items-center py-2 border-t border-slate-100 mt-2">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">Payment Proof</span>
                                        <button 
                                            onClick={() => {
                                                setPreviewSrc(getAssetUrl(val));
                                                setIsPreviewOpen(true);
                                            }}
                                            className="text-[10px] font-black uppercase tracking-widest text-[#0b3578] hover:text-blue-900 flex items-center gap-1 cursor-pointer bg-blue-50 px-3 py-1.5 rounded-sm transition-colors"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                            View Screenshot
                                        </button>
                                    </div>
                                  );
                               }

                               if (key.includes('date') || key.includes('_at')) {
                                   val = formatDate(val);
                               }
                               
                               // Pretty format the key
                               const formatKey = (k) => {
                                  const keyMap = {
                                    'action_by_clerk_name': 'Approved/Processed By (Name)',
                                    'action_by_clerk_id': 'Clerk ID',
                                    'action_by_role': 'Clerk Role',
                                    'generated_cert_id': 'Certificate ID',
                                    'cert_type': 'Certificate Type',
                                    'payment_mode': 'Payment Mode',
                                    'bank_name': 'Bank Name',
                                    'academic_year': 'Academic Year',
                                    'application_no': 'Scholarship App No.',
                                    'sanctioned_amount': 'Sanctioned Amount',
                                    'sanctioned_date': 'Sanction Date',
                                    'bank_account_no': 'Bank Account No',
                                    'reject_reason': 'Rejection Reason',
                                    'is_flagged': 'Security Flag',
                                    'purpose': 'Purpose',
                                    'from_date': 'From Date',
                                    'to_date': 'To Date',
                                    'completed_at': 'Completed At'
                                  };
                                  return keyMap[k] || k.replace(/_/g, ' ');
                               };

                               return <DetailRow key={key} label={formatKey(key)} value={val} />;
                           })}
                        </div>
                    </div>

                    {/* Certificate Screenshot logic could go here if available */}
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <button 
                        onClick={() => setIsDetailsOpen(false)}
                        className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-colors cursor-pointer shadow-sm"
                    >
                        Close Registry Entry
                    </button>
                </div>
            </div>
        </div>
      )}
      
      <ImagePreviewModal 
        src={previewSrc} 
        open={isPreviewOpen} 
        onClose={() => setIsPreviewOpen(false)} 
        alt="Payment Proof"
      />
    </div>
  );
}

function DetailRow({ label, value, mono, highlight }) {
    if (!value) return null;
    return (
        <div className="flex justify-between items-center py-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase">{label}</span>
            <span className={`text-xs ${mono ? 'font-mono' : 'font-medium'} ${highlight ? 'text-[#0b3578] font-bold uppercase' : 'text-slate-900'} capitalize`}>
                {String(value)}
            </span>
        </div>
    );
}

function StatCard({ title, value, color, loading, subtitle }) {
  return (
    <div className="bg-white border border-slate-200 p-5 rounded-sm shadow-xs flex flex-col justify-between">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">{title}</span>
      <div className="flex flex-col gap-1">
        {loading ? (
          <div className="h-8 w-24 bg-slate-100 animate-pulse rounded-sm"></div>
        ) : (
          <span className={`text-2xl font-black ${color} tracking-tight tabular-nums`}>
            ₹{formatIndianNumber(value || 0)}
          </span>
        )}
        {subtitle && <span className="text-[9px] text-slate-400 font-bold uppercase">{subtitle}</span>}
      </div>
    </div>
  );
}
