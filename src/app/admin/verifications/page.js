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
            } catch (err) {
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
                        <div className="overflow-x-auto">
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
                    </div>

                    {/* Global Location Heatmap (List version) */}
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                        <div className="bg-slate-50 p-4 border-b border-slate-200">
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Global Scan Locations</h2>
                        </div>
                        <div className="overflow-x-auto">
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
                    </div>
                </div>

                {/* Recent Activity Log */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="bg-[#0b3578] p-4 flex items-center justify-between">
                        <h2 className="text-sm font-bold text-white uppercase tracking-widest">Live Verification Log</h2>
                        <span className="text-[10px] text-blue-200 font-bold uppercase">Real-time monitoring</span>
                    </div>
                    <div className="overflow-x-auto">
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
                </div>
            </div>
        </div>
    );
}
