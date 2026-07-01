const fs = require('fs');

let code = fs.readFileSync('src/components/student/FeeTransactionHistory.js', 'utf8');

const receiptCode = `
      {/* Mobile Stacked Cards */}
      <div className="md:hidden space-y-6">
        {feeRecords.map((payment, idx) => {
          const pId = payment.id || idx;
          const formattedDate = payment.transaction_date ? formatDate(payment.transaction_date) : '—';

          return (
            <div key={pId} className="bg-white rounded-xl shadow-lg border border-slate-200/60 overflow-hidden relative mx-1 mt-2">
               {/* Receipt Zig-Zag Top */}
               <div className="absolute top-0 left-0 right-0 h-2 bg-slate-50" style={{ clipPath: 'polygon(0 0, 5% 100%, 10% 0, 15% 100%, 20% 0, 25% 100%, 30% 0, 35% 100%, 40% 0, 45% 100%, 50% 0, 55% 100%, 60% 0, 65% 100%, 70% 0, 75% 100%, 80% 0, 85% 100%, 90% 0, 95% 100%, 100% 0)' }}></div>

               <div className="p-6 pt-8 pb-0 text-center flex flex-col items-center">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-700 rounded-full flex items-center justify-center mb-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Payment Successful</h3>
                  <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-1">{formattedDate}</p>
                  
                  <div className="mt-4 mb-2">
                    <span className="text-3xl font-black text-slate-900">₹{Number(payment.amount || 0).toLocaleString('en-IN')}</span>
                  </div>
               </div>

               <div className="px-6 py-4">
                 <div className="border-t-2 border-dashed border-slate-200 my-2"></div>
                 
                 <div className="space-y-4 py-4">
                   <div className="flex justify-between items-center">
                     <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Academic Year</span>
                     <span className="text-sm font-black text-slate-800">{payment.academic_year || '—'}</span>
                   </div>
                   <div className="flex justify-between items-center">
                     <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ref Number</span>
                     <span className="text-sm font-black font-mono text-indigo-700">{payment.transaction_ref_no || \`TRX-\${idx + 100}\`}</span>
                   </div>
                   <div className="flex justify-between items-center">
                     <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Payment Mode</span>
                     <span className="text-sm font-black text-slate-800 uppercase">{payment.payment_mode || 'ONLINE'}</span>
                   </div>
                   <div className="flex justify-between items-center">
                     <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Bank</span>
                     <span className="text-sm font-bold text-slate-700">{payment.bank_name || 'N/A'}</span>
                   </div>
                 </div>

                 <div className="border-t-2 border-dashed border-slate-200 my-2"></div>
               </div>

               <div className="px-6 pb-8 text-center flex flex-col items-center">
                  {/* Fake Barcode */}
                  <div className="h-10 w-full max-w-[200px] flex items-center justify-between opacity-50 mb-3">
                    {[...Array(24)].map((_, i) => (
                      <div key={i} className="bg-slate-800 h-full" style={{ width: Math.random() > 0.5 ? '2px' : '4px', opacity: Math.random() > 0.3 ? 1 : 0 }}></div>
                    ))}
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setSelectedReceipt(payment)}
                    className="mt-2 text-indigo-600 font-black text-xs uppercase tracking-widest hover:text-indigo-800 transition-colors inline-flex items-center gap-1"
                  >
                    View Official PDF
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
               </div>

               {/* Receipt Zig-Zag Bottom */}
               <div className="absolute bottom-0 left-0 right-0 h-2 bg-slate-50" style={{ clipPath: 'polygon(0 100%, 5% 0, 10% 100%, 15% 0, 20% 100%, 25% 0, 30% 100%, 35% 0, 40% 100%, 45% 0, 50% 100%, 55% 0, 60% 100%, 65% 0, 70% 100%, 75% 0, 80% 100%, 85% 0, 90% 100%, 95% 0, 100% 100%)' }}></div>
            </div>
          );
        })}
      </div>
`;

code = code.replace(/\{\/\* Mobile Stacked Cards \*\/\}[\s\S]*?\{\/\* Official Receipt Modal \*\/\}/, receiptCode + "\n\n      {/* Official Receipt Modal */}");

fs.writeFileSync('src/components/student/FeeTransactionHistory.js', code, 'utf8');
