const fs = require('fs');

// 1. Update Admin Infrastructure Page
let adminCode = fs.readFileSync('src/app/admin/infrastructure/page.js', 'utf8');

if (!adminCode.includes('const [isMobileMenuOpen, setIsMobileMenuOpen]')) {
  adminCode = adminCode.replace(
    /const \[activeTab, setActiveTab\] = useState\('config'\);/g, 
    "const [activeTab, setActiveTab] = useState('config');\n  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);"
  );
}

let newAdminTabs = `
        {/* Mobile Section Drawer Button */}
        <div className="md:hidden mb-6">
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg shadow-sm"
          >
            <div className="flex flex-col items-start">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Infrastructure Section</span>
              <span className="text-sm font-black text-[#0b3578]">
                {activeTab === 'config' ? 'System Configuration' : activeTab === 'backups' ? 'Database Sovereignty' : 'Storage Explorer'}
              </span>
            </div>
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          {/* Mobile Drawer */}
          {isMobileMenuOpen && (
            <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-slate-900/50 backdrop-blur-sm animate-in fade-in" onClick={() => setIsMobileMenuOpen(false)}>
              <div className="bg-white w-full rounded-t-2xl p-6 shadow-2xl animate-in slide-in-from-bottom-full" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-black text-lg text-slate-800 uppercase tracking-tight">Infrastructure Sections</h3>
                  <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  {[
                    { id: 'config', name: 'System Configuration' },
                    { id: 'backups', name: 'Database Sovereignty' },
                    { id: 'storage', name: 'Storage Explorer' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => { setActiveTab(tab.id); setIsMobileMenuOpen(false); }}
                      className={\`w-full text-left px-5 py-4 rounded-xl text-sm font-bold uppercase tracking-widest transition-all \${
                        activeTab === tab.id
                          ? 'bg-blue-50 text-blue-700 border-2 border-blue-200'
                          : 'bg-white text-slate-600 border-2 border-slate-100 hover:border-slate-200'
                      }\`}
                    >
                      {tab.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Desktop Tab Navigation */}
        <div className="hidden md:flex gap-4 mb-8 border-b border-slate-200 pb-px">
          <button
            onClick={() => setActiveTab('config')}
            className={\`px-6 py-3 text-xs font-black uppercase tracking-[0.2em] transition-all \${
              activeTab === 'config'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-500 hover:text-slate-800'
            }\`}
          >
            System Configuration
          </button>
          <button
            onClick={() => setActiveTab('backups')}
            className={\`px-6 py-3 text-xs font-black uppercase tracking-[0.2em] transition-all \${
              activeTab === 'backups'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-500 hover:text-slate-800'
            }\`}
          >
            Database Sovereignty
          </button>
          <button
            onClick={() => setActiveTab('storage')}
            className={\`px-6 py-3 text-xs font-black uppercase tracking-[0.2em] transition-all \${
              activeTab === 'storage'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-500 hover:text-slate-800'
            }\`}
          >
            Storage Explorer
          </button>
        </div>
`;

adminCode = adminCode.replace(/\{\/\* Tab Navigation \(Chips for Mobile\) \*\/\}[\s\S]*?<\/button>\s*<\/div>/, newAdminTabs);

// Remove min-widths from Admin
adminCode = adminCode.replace(/min-w-\[.*\]/g, "");

fs.writeFileSync('src/app/admin/infrastructure/page.js', adminCode, 'utf8');

// 2. Update HOD Dashboard
let hodCode = fs.readFileSync('src/components/clerk/faculty/HODConsole.js', 'utf8');

if (!hodCode.includes('const [isMobileMenuOpen, setIsMobileMenuOpen]')) {
  hodCode = hodCode.replace(
    /const \[activeSubTab, setActiveSubTab\] = useState\('workload'\);/, 
    "const [activeSubTab, setActiveSubTab] = useState('workload');\n  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);"
  );
}

let newHodTabs = `
        {/* Mobile Section Drawer Button */}
        <div className="md:hidden mt-4 px-1">
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="w-full flex items-center justify-between p-3.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg shadow-sm transition-all"
          >
            <div className="flex flex-col items-start">
              <span className="text-[9px] font-bold text-blue-200/80 uppercase tracking-widest">Department Menu</span>
              <span className="text-sm font-black text-white">
                {[
                  { id: 'workload', label: 'Faculty Load' },
                  { id: 'timetable', label: 'Edit Timetable' },
                  { id: 'allocation', label: 'Assignment Registry' },
                  { id: 'syllabus', label: 'Branch Syllabus' },
                  { id: 'analytics', label: 'Data Analytics' },
                  { id: 'config', label: 'Department Config' },
                  { id: 'interests', label: 'Faculty Interests' }
                ].find(t => t.id === activeSubTab)?.label || 'Menu'}
              </span>
            </div>
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </button>
          
          {/* Mobile Drawer */}
          {isMobileMenuOpen && (
            <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-slate-900/80 backdrop-blur-sm animate-in fade-in" onClick={() => setIsMobileMenuOpen(false)}>
              <div className="bg-white w-full rounded-t-2xl p-6 shadow-2xl animate-in slide-in-from-bottom-full" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-black text-lg text-slate-800 uppercase tracking-tight">Department Menu</h3>
                  <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="flex flex-col gap-2 overflow-y-auto max-h-[60vh] pb-4">
                  {[
                    { id: 'workload', label: 'Faculty Load', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
                    { id: 'timetable', label: 'Edit Timetable', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z' },
                    { id: 'allocation', label: 'Assignment Registry', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4' },
                    { id: 'syllabus', label: 'Branch Syllabus', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
                    { id: 'analytics', label: 'Data Analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
                    { id: 'config', label: 'Department Config', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
                    { id: 'interests', label: 'Faculty Interests', icon: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => { setActiveSubTab(tab.id); setIsMobileMenuOpen(false); }}
                      className={\`w-full flex items-center gap-3 text-left px-5 py-4 rounded-xl text-sm font-bold uppercase tracking-widest transition-all \${
                        activeSubTab === tab.id
                          ? 'bg-[#0b3578] text-white border-2 border-[#0b3578]'
                          : 'bg-white text-slate-600 border-2 border-slate-100 hover:border-slate-200'
                      }\`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={tab.icon} /></svg>
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Desktop Tab Navigation */}
        <div className="hidden md:flex gap-2 mt-6 pb-2 border-t border-white/5 pt-4 px-1">
`;

const hodRegex = /<div className=\"flex gap-2 mt-6 overflow-x-auto pb-2 no-scrollbar border-t border-white\/5 pt-4 px-1\">([\s\S]*?)<\/div>/;
hodCode = hodCode.replace(hodRegex, newHodTabs + "</div>");

const oldFacultyCard = /<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6">\s*<div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full md:w-auto">([\s\S]*?)<\/div>\s*<\/div>/;

const newFacultyCard = `<div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 lg:gap-6 w-full max-w-full min-w-0">
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto min-w-0">
                <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
                  <div className="w-12 h-12 bg-slate-50 border border-slate-200 flex items-center justify-center font-bold text-[#0b3578] text-xl group-hover:bg-[#0b3578] group-hover:text-white transition-all flex-shrink-0 rounded-sm">
                    {f.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-base text-slate-800 group-hover:text-[#0b3578] transition-colors uppercase tracking-wider truncate">{f.name}</h4>
                    <p className="text-xs text-slate-400 font-medium tracking-widest uppercase mt-0.5 truncate">{f.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 w-full sm:w-auto min-w-0">
                   {f.subjects ? f.subjects.split(', ').map(s => (
                     <span key={s} className="text-[10px] font-bold bg-slate-50 text-slate-500 px-2 py-1 border border-slate-200 uppercase tracking-tighter rounded-sm break-all">{s}</span>
                   )) : <span className="text-[10px] font-medium text-slate-300 italic">No Official Authorization</span>}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 w-full lg:w-auto min-w-0">
                 <div className="bg-slate-50 border border-slate-100 p-3 text-center rounded-sm flex flex-col justify-center min-w-0">
                    <div className="text-lg font-bold text-slate-800">{f.scheduled_weekly}</div>
                    <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest truncate">Weekly / Sch</div>
                 </div>
                 <div className="bg-slate-50 border border-slate-100 p-3 text-center rounded-sm flex flex-col justify-center min-w-0">
                    <div className="text-lg font-bold text-slate-800">{f.total_conducted}</div>
                    <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest truncate">Sem / Reg</div>
                 </div>
                 <div className="bg-[#0b3578]/5 border border-[#0b3578]/10 p-3 text-center rounded-sm flex flex-col justify-center min-w-0">
                    <div className="text-lg font-bold text-[#0b3578]">
                       {f.scheduled_weekly > 0 ? Math.min(Math.round((f.total_conducted / (f.scheduled_weekly * 4)) * 100), 100) : 0}%
                    </div>
                    <div className="text-[8px] font-bold text-[#0b3578]/60 uppercase tracking-widest truncate">Performance</div>
                 </div>
              </div>
            </div>`;

hodCode = hodCode.replace(oldFacultyCard, newFacultyCard);

fs.writeFileSync('src/components/clerk/faculty/HODConsole.js', hodCode, 'utf8');
