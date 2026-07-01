'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

export default function VerificationsDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/admin/verifications/stats');
                const data = await res.json();
                if (res.ok) {
                    setStats(data);
                } else {
                    toast.error(data.message || 'Failed to load stats');
                }
            } catch (_err) {
                toast.error('Connection error');
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="p-8 flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
            </div>
        );
    }

    if (!stats) return <div className="p-8 text-center text-red-600">Failed to load dashboard data.</div>;

    return (
        <div className="p-4 sm:p-8 bg-slate-50 min-h-screen font-sans">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Institutional Verification Registry</h1>
                        <p className="text-slate-500 text-sm">Monitoring certificate authenticity and global scan patterns.</p>
                    </div>
                </div>

                {/* Dashboard Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    
                    {/* Potential Forgery Alerts (Top Verified Certs) */}
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                        <div className="bg-red-50 p-4 border-b border-slate-200 flex items-center justify-between">
                            <h2 className="text-sm font-bold text-red-900 uppercase tracking-widest flex items-center gap-2">
                                ⚠️ High-Frequency Scans
                            </h2>
                            <span className="text-[10px] text-red-600 font-bold uppercase">Potential Forgery Risk</span>
                        </div>
                        <>
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 text-slate-400 uppercase font-black border-b border-slate-100">
                                        <tr>
                                            <th className="px-4 py-3">Certificate ID</th>
                                            <th className="px-4 py-3">Student Name</th>
                                            <th className="px-4 py-3 text-right">Total Scans</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {stats.topVerifiedCerts.map((cert) => (
                                            <tr key={cert.request_id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3 font-bold text-blue-900">{cert.cert_id}</td>
                                                <td className="px-4 py-3 text-slate-600">{cert.student_name}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className={`px-2 py-0.5 rounded-full font-black ${cert.count > 10 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                                                        {cert.count}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="md:hidden flex flex-col divide-y divide-slate-100">
                                {stats.topVerifiedCerts.map((cert) => (
                                    <div key={cert.request_id} className="p-4 flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-blue-900 text-xs">{cert.cert_id}</span>
                                            <span className="text-[10px] text-slate-600 font-medium">{cert.student_name}</span>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-full font-black text-xs ${cert.count > 10 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                                            {cert.count} Scans
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </>
                    </div>

                    {/* Global Location Heatmap (List version) */}
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                        <div className="bg-slate-50 p-4 border-b border-slate-200">
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Global Scan Locations</h2>
                        </div>
                        <>
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 text-slate-400 uppercase font-black border-b border-slate-100">
                                        <tr>
                                            <th className="px-4 py-3">Location Name</th>
                                            <th className="px-4 py-3 text-right">Scans</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {stats.locationStats.map((loc, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3 text-slate-600 font-medium">{loc.location || 'Unknown'}</td>
                                                <td className="px-4 py-3 text-right font-black text-slate-900">{loc.count}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="md:hidden flex flex-col divide-y divide-slate-100">
                                {stats.locationStats.map((loc, idx) => (
                                    <div key={idx} className="p-4 flex items-center justify-between">
                                        <span className="text-xs text-slate-600 font-medium">{loc.location || 'Unknown'}</span>
                                        <span className="text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">{loc.count} Scans</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    </div>
                </div>

                {/* Recent Activity Log */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="bg-[#0b3578] p-4 flex items-center justify-between">
                        <h2 className="text-sm font-bold text-white uppercase tracking-widest">Live Verification Log</h2>
                        <span className="text-[10px] text-blue-200 font-bold uppercase">Real-time monitoring</span>
                    </div>
                    <>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-slate-400 uppercase font-black border-b border-slate-100">
                                    <tr>
                                        <th className="px-4 py-3">Timestamp</th>
                                        <th className="px-4 py-3">Cert ID</th>
                                        <th className="px-4 py-3">Student</th>
                                        <th className="px-4 py-3">Location</th>
                                        <th className="px-4 py-3">Device / IP</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {stats.recentVerifications.map((log) => (
                                        <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3 text-slate-400 tabular-nums">
                                                {new Date(log.verification_date).toLocaleString('en-GB', { 
                                                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                                                })}
                                            </td>
                                            <td className="px-4 py-3 font-bold text-blue-900">{log.cert_id}</td>
                                            <td className="px-4 py-3 text-slate-600 font-medium">{log.student_name}</td>
                                            <td className="px-4 py-3 text-slate-500">{log.location}</td>
                                            <td className="px-4 py-3 text-slate-400 italic">
                                                {log.device} <br/>
                                                <span className="text-[10px] opacity-70">{log.ip}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="md:hidden flex flex-col gap-3 p-3 bg-slate-50/50">
                            {stats.recentVerifications.map((log) => (
                                <div key={log.id} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex flex-col gap-2">
                                    <div className="flex justify-between items-start border-b border-slate-50 pb-2">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-blue-900 text-sm">{log.cert_id}</span>
                                            <span className="text-[11px] text-slate-600 font-medium">{log.student_name}</span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-medium tabular-nums text-right">
                                            {new Date(log.verification_date).toLocaleString('en-GB', { 
                                                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-start gap-1">
                                            <svg className="w-3 h-3 text-slate-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            <span className="text-xs text-slate-600">{log.location}</span>
                                        </div>
                                        <div className="flex items-start gap-1">
                                            <svg className="w-3 h-3 text-slate-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                            </svg>
                                            <span className="text-[10px] text-slate-500 italic">
                                                {log.device} • {log.ip}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                </div>
            </div>
        </div>
    );
}
