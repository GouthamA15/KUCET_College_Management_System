const fs = require('fs');
let code = fs.readFileSync('src/components/clerk/faculty/HODConsole.js', 'utf8');

const regex = /<div className=\"flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 lg:gap-6 w-full max-w-full min-w-0\">[\s\S]*?<div className=\"mt-6 relative pt-2\">/g;

const match = code.match(regex);
if(match && match.length > 0) {
    const newBlock = `
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 lg:gap-6 w-full max-w-full min-w-0">
              
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
            </div>
            
            <div className="mt-6 relative pt-2">`;

    code = code.replace(regex, newBlock);
    fs.writeFileSync('src/components/clerk/faculty/HODConsole.js', code, 'utf8');
}
