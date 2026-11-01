import ImageWithLoading from '@/components/ui/ImageWithLoading';
import { getAssetUrl } from '@/lib/assets';

export default function StudentInfoCard({ student, onImageClick }) {
  if (!student) return null;
  const p = getAssetUrl(student.pfp);
  const has = p && String(p).trim() !== '';
  const isData = has && String(p).startsWith('data:');
  const dataHasBody = !isData || (String(p).includes(',') && String(p).split(',')[1].trim() !== '');

  const fields = [
    { label: 'Roll Number', value: student.roll_no || '-' },
    { label: 'Student Name', value: student.name || '-' },
    { label: 'Email', value: student.email || '-' },
    { label: 'Mobile', value: student.mobile || '-' },
  ];

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Student Identity</p>
          <h3 className="text-base font-semibold text-slate-900 tracking-tight">Operational identity record</h3>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest bg-slate-50 border border-slate-100 text-slate-600 px-2 py-1 rounded-full">
          {student.roll_no}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-[128px_1fr] gap-5">
        <div>
          {has && dataHasBody ? (
            <div 
              onClick={(e) => {
                e.stopPropagation();
                onImageClick?.(String(p));
              }}
              className="relative w-32 h-36 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 cursor-pointer shadow-2xs hover:border-[#0b3578] transition-colors"
              title="Click to preview photo"
            >
              <ImageWithLoading
                src={String(p)}
                alt={`${student.name || 'Student'}'s photograph`}
                width={128}
                height={144}
                className="w-full h-full"
                imageClassName="w-full h-full object-cover"
                variant="photo"
                fallbackText="No Photo"
              />
            </div>
          ) : (
            <div className="w-32 h-36 rounded-xl border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">No Photo</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {fields.map((f) => (
            <div key={f.label} className="space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{f.label}</div>
              <div className="text-sm font-semibold text-slate-700 break-words">{f.value}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
