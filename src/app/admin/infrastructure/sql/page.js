'use client';

import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { 
  Database, Table as TableIcon, Download, RefreshCw, 
  ChevronRight, ChevronDown, Columns, Settings, 
  CheckCircle2, XCircle, Zap, Search, Server, FileText, Save, FolderOpen,
  Plus, X, Trash2, Copy, FileCode, Clock, HardDrive
} from 'lucide-react';

const STORAGE_KEY = 'kucet_sql_workbench_v1';

export default function AdvancedSQLWorkbench() {
  // Tabs & Queries
  const [tabs, setTabs] = useState([{ id: 1, name: 'Query 1', content: 'SELECT * FROM students LIMIT 10;' }]);
  const [activeTabId, setActiveTabId] = useState(1);
  const [results, setResults] = useState({}); // TabId -> Results
  const [loading, setLoading] = useState(false);
  
  // Schema State
  const [schema, setSchema] = useState({});
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [schemaFilter, setSchemaFilter] = useState('');
  
  // History & Logs
  const [actionOutput, setActionOutput] = useState([]);
  const [queryHistory, setHistory] = useState([]);
  
  // UI Panels
  const [activeBottomTab, setActiveBottomTab] = useState('Result Grid');
  const [sidebarWidth] = useState(280);
  const [bottomHeight] = useState(320);
  const [showHistory, setShowHistory] = useState(false);

  const editorRef = useRef(null);
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  // --- METHODS ---
  
  const fetchSchema = async () => {
    setSchemaLoading(true);
    try {
      const res = await fetch('/api/admin/infrastructure/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fetch_schema' })
      });
      const data = await res.json();
      if (res.ok && data.schema) setSchema(data.schema);
    } catch (_err) {
      toast.error("Schema fetch failed");
    } finally {
      setSchemaLoading(false);
    }
  };

  const logAction = (action, message, timeStr, isError = false) => {
    setActionOutput(prev => [{
      id: Date.now(),
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      action,
      message,
      duration: timeStr,
      isError
    }, ...prev]);
  };

  const executeQuery = async (overrideQuery = null) => {
    const currentQuery = overrideQuery || activeTab.content;
    if (!currentQuery.trim()) return toast.error('Query is empty');

    setLoading(true);
    const startTime = performance.now();
    const querySnippet = currentQuery.trim().substring(0, 60).replace(/\n/g, ' ') + (currentQuery.length > 60 ? '...' : '');

    try {
      const res = await fetch('/api/admin/infrastructure/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: currentQuery })
      });

      const data = await res.json();
      const duration = ((performance.now() - startTime) / 1000).toFixed(3) + 's';

      if (!res.ok) throw new Error(data.error || 'Execution failed');

      // Success logic
      setResults(prev => ({ ...prev, [activeTabId]: data }));
      setActiveBottomTab('Result Grid');
      
      // Update History
      const hItem = { id: Date.now(), query: currentQuery, time: new Date().toLocaleString() };
      setHistory(prev => [hItem, ...prev].slice(0, 50));

      // Log Output
      logAction(querySnippet, `${data.results?.length || 0} row(s) returned / ${data.affectedRows || 0} affected`, duration);
      toast.success('Query successful');
    } catch (err) {
      const errorDuration = ((performance.now() - startTime) / 1000).toFixed(3) + 's';
      setResults(prev => ({ ...prev, [activeTabId]: null }));
      setActiveBottomTab('Action Output');
      logAction(querySnippet, err.message, errorDuration, true);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateTabContent = (val) => {
    setTabs(tabs.map(t => t.id === activeTabId ? { ...t, content: val } : t));
  };

  // --- INITIALIZATION ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (p.tabs?.length) setTabs(p.tabs);
        if (p.activeTabId) setActiveTabId(p.activeTabId);
        if (p.history) setHistory(p.history);
      } catch (e) {
        console.error("Load state failed", e);
      }
    }
    fetchSchema();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- PERSISTENCE ---
  useEffect(() => {
    const state = { tabs, activeTabId, history: queryHistory };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [tabs, activeTabId, queryHistory]);

  // --- TAB MANAGEMENT ---
  const addTab = () => {
    const newId = Math.max(0, ...tabs.map(t => t.id)) + 1;
    setTabs([...tabs, { id: newId, name: `Query ${newId}`, content: '' }]);
    setActiveTabId(newId);
  };

  const closeTab = (e, id) => {
    e.stopPropagation();
    if (tabs.length === 1) return;
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) setActiveTabId(newTabs[newTabs.length - 1].id);
    const newRes = { ...results };
    delete newRes[id];
    setResults(newRes);
  };

  // --- HELPERS ---
  const quickQuery = (tableName) => {
    const q = `SELECT * FROM \`${tableName}\` LIMIT 100;`;
    updateTabContent(q);
    executeQuery(q);
  };

  const insertAtCursor = (text) => {
    const el = editorRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newContent = activeTab.content.substring(0, start) + text + activeTab.content.substring(end);
    updateTabContent(newContent);
    setTimeout(() => {
      el.selectionStart = el.selectionEnd = start + text.length;
      el.focus();
    }, 0);
  };

  const exportCSV = () => {
    const cur = results[activeTabId];
    if (!cur?.results?.length) return;
    const h = cur.fields.join(',');
    const r = cur.results.map(row => 
      cur.fields.map(f => `"${String(row[f] ?? '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    const b = new Blob([h + '\n' + r], { type: 'text/csv' });
    const u = window.URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u;
    a.download = `sql_export_${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(u);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-72px)] bg-[#f3f4f6] font-sans overflow-hidden select-none">
      
      {/* 1. TOP MENU BAR */}
      <div className="flex items-center px-3 py-1.5 bg-white border-b border-slate-300 gap-6">
        <div className="flex items-center gap-2 text-indigo-700 font-bold italic mr-4">
           <Database className="w-4 h-4" /> SQL Workbench <span className="text-[10px] bg-indigo-100 px-1 rounded not-italic">V2.1</span>
        </div>
        <div className="flex gap-4 text-xs font-medium text-slate-600">
           {['File', 'Edit', 'View', 'Query', 'Database', 'Server', 'Tools'].map(m => (
             <span key={m} className="hover:text-indigo-600 cursor-pointer">{m}</span>
           ))}
        </div>
      </div>

      {/* 2. PRIMARY TOOLBAR */}
      <div className="flex items-center justify-between px-3 py-1 bg-[#eeeeee] border-b border-slate-300">
        <div className="flex items-center gap-1">
          <div className="flex bg-white rounded border border-slate-300 p-0.5 shadow-sm mr-2">
            <button onClick={addTab} className="p-1 hover:bg-slate-100 text-slate-600" title="New Query Tab"><Plus className="w-3.5 h-3.5" /></button>
            <button className="p-1 hover:bg-slate-100 text-slate-600" title="Open SQL File"><FolderOpen className="w-3.5 h-3.5" /></button>
            <button onClick={() => toast.success('Workspace Saved')} className="p-1 hover:bg-slate-100 text-slate-600" title="Save Workspace"><Save className="w-3.5 h-3.5" /></button>
          </div>

          <div className="flex bg-white rounded border border-slate-300 p-0.5 shadow-sm mr-2">
            <button 
              onClick={() => executeQuery()} 
              disabled={loading}
              className={`p-1 flex items-center gap-1.5 px-2 font-bold text-xs ${loading ? 'text-slate-400' : 'text-amber-600 hover:bg-amber-50'}`}
              title="Execute Query (Ctrl+Enter)"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 fill-amber-500" />}
              Run
            </button>
            <div className="w-px h-4 bg-slate-200 my-auto"></div>
            <button 
              onClick={() => { updateTabContent(''); setResults(prev => ({ ...prev, [activeTabId]: null })); }}
              className="p-1 hover:bg-slate-100 text-slate-500" title="Clear Editor"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex bg-white rounded border border-slate-300 p-0.5 shadow-sm">
            <button onClick={fetchSchema} className="p-1 hover:bg-slate-100 text-indigo-600" title="Refresh Schema"><RefreshCw className="w-3.5 h-3.5" /></button>
            <button onClick={() => setShowHistory(!showHistory)} className={`p-1 px-2 flex items-center gap-1 text-[11px] font-bold ${showHistory ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
              <Clock className="w-3.5 h-3.5" /> History
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-[10px] text-slate-500 font-mono hidden md:block">Connected: <span className="text-green-600 font-bold underline">kucet_cms@127.0.0.1</span></div>
          <button className="p-1.5 bg-white border border-slate-300 rounded shadow-sm hover:bg-slate-50 text-slate-600"><Settings className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* 3. MAIN WORK AREA */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* SIDEBAR: NAVIGATOR */}
        <div 
          className="bg-white border-r border-slate-300 flex flex-col shrink-0 transition-all duration-75"
          style={{ width: sidebarWidth }}
        >
          <div className="bg-slate-100 p-2 border-b border-slate-300 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5" /> Navigator
            </span>
          </div>

          {/* Schema Search */}
          <div className="p-2 border-b border-slate-200 bg-slate-50/50">
            <div className="relative">
              <Search className="absolute left-2 top-1.5 w-3 h-3 text-slate-400" />
              <input 
                value={schemaFilter}
                onChange={(e) => setSchemaFilter(e.target.value)}
                placeholder="Filter tables..." 
                className="w-full bg-white border border-slate-300 rounded pl-7 pr-2 py-1 text-[11px] focus:ring-1 focus:ring-indigo-400 outline-none" 
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden p-1 bg-[#fcfcfc] custom-scrollbar">
            {/* SCHEMA TREE */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 p-1 font-bold text-xs text-slate-800">
                <Database className="w-3.5 h-3.5 text-indigo-600" /> kucet_cms
              </div>
              
              <div className="ml-4 space-y-0.5 border-l border-slate-200">
                {Object.keys(schema)
                  .filter(t => !schemaFilter || t.toLowerCase().includes(schemaFilter.toLowerCase()))
                  .sort()
                  .map(tableName => (
                    <TableItem 
                      key={tableName} 
                      name={tableName} 
                      cols={schema[tableName]} 
                      onSelect={() => quickQuery(tableName)} 
                      onInsert={() => insertAtCursor(`\`${tableName}\``)}
                    />
                  ))
                }
                {schemaLoading && [1,2,3].map(i => <div key={i} className="h-4 bg-slate-100 animate-pulse m-2 rounded" />)}
              </div>
            </div>
          </div>
          
          <div className="h-24 border-t border-slate-300 bg-slate-50 p-2 overflow-hidden">
             <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Context Info</div>
             <p className="text-[11px] text-slate-600 italic">Double-click table to select rows. Drag to resize panes.</p>
          </div>
        </div>

        {/* DRAGGABLE RESIZER */}
        <div className="w-1 cursor-col-resize hover:bg-indigo-400 transition-colors bg-slate-200 group relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-8 flex flex-col gap-0.5 items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="w-0.5 h-0.5 bg-white rounded-full"></div>
            <div className="w-0.5 h-0.5 bg-white rounded-full"></div>
            <div className="w-0.5 h-0.5 bg-white rounded-full"></div>
          </div>
        </div>

        {/* RIGHT SIDE: EDITOR & RESULTS */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          
          {/* TABS */}
          <div className="flex bg-[#e2e8f0] px-1 pt-1 gap-0.5 border-b border-slate-300">
            {tabs.map(tab => (
              <div 
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`group flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold border border-b-0 border-slate-300 rounded-t-md cursor-pointer transition-all ${
                  activeTabId === tab.id ? 'bg-white text-indigo-700 shadow-sm' : 'bg-slate-200/60 text-slate-500 hover:bg-slate-100'
                }`}
              >
                <FileCode className={`w-3.5 h-3.5 ${activeTabId === tab.id ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span className="truncate max-w-[120px]">{tab.name}</span>
                {tabs.length > 1 && (
                  <X 
                    className="w-3 h-3 opacity-0 group-hover:opacity-100 hover:text-red-500 rounded transition-opacity" 
                    onClick={(e) => closeTab(e, tab.id)}
                  />
                )}
              </div>
            ))}
            <button onClick={addTab} className="px-2 py-1.5 text-slate-500 hover:text-indigo-600" title="Add Tab"><Plus className="w-4 h-4" /></button>
          </div>

          {/* QUERY EDITOR CONTAINER */}
          <div className="flex-1 flex flex-col min-h-0">
             <div className="flex-1 relative flex">
                {/* Line Numbers Simulation */}
                <div className="w-10 bg-slate-50 border-r border-slate-200 flex flex-col items-end pt-3 pr-2 text-[11px] font-mono text-slate-400 select-none">
                   {(activeTab.content || '').split('\n').map((_, i) => <div key={i}>{i+1}</div>)}
                </div>
                {/* Textarea Editor */}
                <textarea
                  ref={editorRef}
                  value={activeTab.content}
                  onChange={(e) => updateTabContent(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault();
                      executeQuery();
                    }
                  }}
                  className="flex-1 p-3 font-mono text-[13px] text-slate-800 focus:outline-none resize-none bg-white leading-relaxed whitespace-pre caret-indigo-600"
                  spellCheck="false"
                  placeholder="-- Write SQL here and press Ctrl+Enter to run"
                />
                
                {/* Floating History overlay */}
                {showHistory && (
                  <div className="absolute top-0 right-0 w-80 h-full bg-white shadow-2xl border-l border-slate-200 z-20 flex flex-col animate-in slide-in-from-right duration-200">
                    <div className="p-3 bg-slate-50 border-b flex justify-between items-center">
                      <span className="font-bold text-xs">Query History</span>
                      <X className="w-4 h-4 cursor-pointer hover:text-red-500" onClick={() => setShowHistory(false)} />
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                       {queryHistory.map(h => (
                         <div key={h.id} className="p-2 hover:bg-slate-50 border border-slate-100 rounded group relative">
                           <div className="text-[10px] text-slate-400 mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> {h.time}</div>
                           <code className="text-[11px] text-indigo-600 block truncate">{h.query}</code>
                           <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100">
                             <Copy className="w-3.5 h-3.5 cursor-pointer hover:text-indigo-600" onClick={() => { updateTabContent(h.query); setShowHistory(false); }} />
                           </div>
                         </div>
                       ))}
                       {queryHistory.length === 0 && <div className="text-center py-10 text-slate-400 text-xs italic">No history yet</div>}
                    </div>
                  </div>
                )}
             </div>

             {/* HORIZONTAL RESIZER */}
             <div className="h-1 cursor-row-resize hover:bg-indigo-400 transition-colors bg-slate-300"></div>

             {/* BOTTOM PANEL: GRID & OUTPUT */}
             <div className="bg-[#f0f0f0] flex flex-col" style={{ height: bottomHeight }}>
                {/* Tabs */}
                <div className="flex border-b border-slate-300 bg-white">
                   <BottomTab 
                    label="Result Grid" 
                    active={activeBottomTab === 'Result Grid'} 
                    onClick={() => setActiveBottomTab('Result Grid')} 
                    icon={<TableIcon className="w-3.5 h-3.5" />}
                   />
                   <BottomTab 
                    label="Action Output" 
                    active={activeBottomTab === 'Action Output'} 
                    onClick={() => setActiveBottomTab('Action Output')} 
                    icon={<Server className="w-3.5 h-3.5" />}
                   />
                </div>

                {/* Content Area */}
                <div className="flex-1 bg-white overflow-hidden flex flex-col">
                  {activeBottomTab === 'Result Grid' && (
                    <ResultGrid 
                      results={results[activeTabId]} 
                      loading={loading} 
                      onExport={exportCSV}
                    />
                  )}
                  {activeBottomTab === 'Action Output' && (
                    <ActionLog logs={actionOutput} />
                  )}
                </div>
             </div>
          </div>

        </div>

      </div>

      {/* 4. FOOTER STATUS BAR */}
      <div className="h-6 bg-[#eeeeee] border-t border-slate-300 flex items-center justify-between px-3 text-[10px] font-medium text-slate-500 shrink-0">
         <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="w-3 h-3" /> System Operational</span>
            <span className="w-px h-3 bg-slate-300"></span>
            <span>UTF-8</span>
         </div>
         <div className="flex items-center gap-4">
            <span>MySQL 8.0.x</span>
            <span className="w-px h-3 bg-slate-300"></span>
            <span className="uppercase tracking-widest font-bold">KUCET CMS CONTROL</span>
         </div>
      </div>

    </div>
  );
}

// --- SUB-COMPONENTS ---

function TableItem({ name, cols, onSelect, onInsert }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="select-none">
      <div 
        className="flex items-center gap-1.5 p-1 hover:bg-indigo-50 cursor-pointer group rounded"
        onDoubleClick={onSelect}
      >
        <span onClick={(e) => { e.stopPropagation(); setOpen(!open); }} className="hover:bg-slate-200 rounded p-0.5">
          {open ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
        </span>
        <TableIcon className="w-3.5 h-3.5 text-blue-500" />
        <span className="text-[12px] text-slate-700 font-medium group-hover:text-indigo-700">{name}</span>
        <div className="ml-auto opacity-0 group-hover:opacity-100 flex gap-1">
           <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-indigo-600" onClick={(e) => { e.stopPropagation(); onInsert(); }} title="Copy Name" />
        </div>
      </div>
      
      {open && (
        <div className="ml-6 border-l border-slate-100 pb-1">
          {cols?.map(col => (
            <div key={col.name} className="flex items-center gap-2 py-0.5 px-2 hover:bg-slate-50 text-[11px] text-slate-500">
               <Columns className="w-3 h-3 text-indigo-300" />
               <span className="truncate">{col.name}</span>
               <span className="text-[9px] text-slate-300 ml-auto uppercase">{col.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BottomTab({ label, active, onClick, icon }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-bold border-r border-slate-200 transition-all ${
        active ? 'bg-white text-indigo-700 border-b-2 border-b-indigo-600' : 'bg-slate-50 text-slate-400 hover:text-slate-700'
      }`}
    >
      {icon} {label}
    </button>
  );
}

function ResultGrid({ results, loading, onExport }) {
  if (loading) return (
    <div className="h-full flex flex-col items-center justify-center gap-3 animate-pulse">
      <RefreshCw className="w-8 h-8 text-indigo-200 animate-spin" />
      <span className="text-sm font-medium text-slate-300 italic">Executing SQL Transaction...</span>
    </div>
  );

  if (!results) return (
    <div className="h-full flex flex-col items-center justify-center text-slate-300">
       <TableIcon className="w-12 h-12 mb-2 opacity-20" />
       <span className="text-xs italic font-medium">No results to display. Execute a query to see data.</span>
    </div>
  );

  const rowCount = results.results?.length || 0;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      {/* Grid Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#f9fafb] border-b border-slate-200">
        <div className="flex items-center gap-4 text-[11px] font-bold text-slate-500 uppercase tracking-tight">
           <span className="flex items-center gap-1.5 text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full shadow-sm"><FileText className="w-3.5 h-3.5" /> Result Set</span>
           <span className="text-slate-400">{rowCount} Rows Loaded</span>
        </div>
        <button onClick={onExport} className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-300 rounded shadow-sm text-[11px] font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      {/* Real Table */}
      <div className="flex-1 overflow-auto bg-slate-50/30">
        <table className="min-w-full text-[12px] text-left border-collapse border-spacing-0">
          <thead className="bg-[#f0f3f9] sticky top-0 z-10 shadow-xs">
            <tr>
              <th className="w-10 px-2 py-2 text-center text-slate-400 font-normal border-r border-b border-slate-300">#</th>
              {results.fields.map(f => (
                <th key={f} className="px-3 py-2 font-bold text-slate-700 border-r border-b border-slate-300 uppercase tracking-wide text-[10px]">
                  {f}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-mono divide-y divide-slate-200 bg-white">
            {results.results.map((row, i) => (
              <tr key={i} className="hover:bg-indigo-50 group">
                <td className="px-2 py-1.5 text-center text-[10px] text-slate-300 bg-[#fbfbfb] border-r border-slate-200 group-hover:text-indigo-400">{i + 1}</td>
                {results.fields.map(f => (
                  <td key={f} className={`px-3 py-1.5 border-r border-slate-100 max-w-[400px] truncate ${row[f] === null ? 'text-slate-300 italic' : 'text-slate-700'}`}>
                    {row[f] === null ? 'NULL' : String(row[f])}
                  </td>
                ))}
              </tr>
            ))}
            {rowCount === 0 && (
              <tr><td colSpan={results.fields.length + 1} className="py-20 text-center text-slate-400 italic">Query executed successfully but returned zero rows.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActionLog({ logs }) {
  return (
    <div className="flex-1 overflow-auto bg-white">
      <table className="min-w-full text-[11px] text-left border-collapse">
        <thead className="bg-[#f8fafc] sticky top-0 shadow-xs">
          <tr>
            <th className="px-3 py-2 font-bold text-slate-500 border-b border-r border-slate-200 w-8">#</th>
            <th className="px-3 py-2 font-bold text-slate-500 border-b border-r border-slate-200 w-24">Time</th>
            <th className="px-3 py-2 font-bold text-slate-500 border-b border-r border-slate-200">Action</th>
            <th className="px-3 py-2 font-bold text-slate-500 border-b border-r border-slate-200">Status</th>
            <th className="px-3 py-2 font-bold text-slate-500 border-b w-24">Duration</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 font-sans">
          {logs.map((l, i) => (
            <tr key={l.id} className={l.isError ? 'bg-red-50/50' : 'hover:bg-slate-50'}>
              <td className="px-3 py-1.5 text-center border-r border-slate-100">
                {l.isError ? <XCircle className="w-3.5 h-3.5 text-red-500 inline" /> : <CheckCircle2 className="w-3.5 h-3.5 text-green-500 inline" />}
              </td>
              <td className="px-3 py-1.5 text-slate-400 font-mono border-r border-slate-100">{l.time}</td>
              <td className="px-3 py-1.5 font-mono text-indigo-600 truncate max-w-md border-r border-slate-100">{l.action}</td>
              <td className={`px-3 py-1.5 border-r border-slate-100 ${l.isError ? 'text-red-700 font-semibold' : 'text-slate-600'}`}>{l.message}</td>
              <td className="px-3 py-1.5 text-slate-400 text-right font-mono italic">{l.duration}</td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr><td colSpan="5" className="py-20 text-center text-slate-300 italic">No activity recorded for this session.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
