'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Database, Play, Trash2, Table as TableIcon, Download } from 'lucide-react';

export default function SQLWorkbench() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const executeQuery = async () => {
    if (!query.trim()) return toast.error('Please enter a query');
    
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const res = await fetch('/api/admin/infrastructure/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Execution failed');

      setResults(data);
      toast.success('Query executed successfully');
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const clearResults = () => {
    setResults(null);
    setError(null);
  };

  const downloadResults = () => {
    if (!results || !results.results || !results.results.length) return;
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + results.fields.join(",") + "\n"
      + results.results.map(row => results.fields.map(f => row[f]).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sql_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg shadow-md">
              <Database className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">SQL Workbench</h1>
              <p className="text-slate-500 text-sm">Direct database access for Super Admins</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={clearResults}
              disabled={!results && !error}
              className="px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" /> Clear
            </button>
            <button
              onClick={executeQuery}
              disabled={loading}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
            >
              {loading ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <Play className="w-4 h-4 fill-current" />}
              Run Query
            </button>
          </div>
        </div>

        {/* Editor Area */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-widest">Query Editor</span>
          </div>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="SELECT * FROM students LIMIT 10;"
            className="w-full h-48 p-4 font-mono text-sm focus:outline-none bg-slate-900 text-indigo-300 resize-y"
            spellCheck="false"
          />
        </div>

        {/* Results Area */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex flex-col gap-2">
            <div className="font-bold flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Execution Error
            </div>
            <pre className="text-xs whitespace-pre-wrap font-mono bg-red-100/50 p-2 rounded">{error}</pre>
          </div>
        )}

        {results && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <TableIcon className="w-3 h-3" /> Result Set
                </span>
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-bold">
                  {results.results?.length || 0} Rows
                </span>
              </div>
              <button 
                onClick={downloadResults}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
              >
                <Download className="w-3 h-3" /> Export CSV
              </button>
            </div>
            
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                  <tr>
                    {results.fields.map(field => (
                      <th key={field} className="px-4 py-3 font-bold text-slate-600 border-b border-slate-200 min-w-[120px]">
                        {field}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[13px]">
                  {results.results && Array.isArray(results.results) ? (
                    results.results.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        {results.fields.map(field => (
                          <td key={field} className="px-4 py-3 text-slate-700 max-w-xs truncate">
                            {row[field] === null ? <span className="text-slate-300 italic">null</span> : String(row[field])}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={results.fields.length} className="px-4 py-8 text-center text-slate-400 italic">
                        No rows returned. (Affected: {results.affectedRows})
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
