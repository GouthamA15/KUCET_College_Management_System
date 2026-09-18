import { formatDate } from '@/lib/date';

export default function CertificateDateHistory({ dates = [], selectedDate, onSelectDate }) {
  const toDmy = (val) => formatDate(val, '-');

  return (
    <section className="bg-white border rounded-lg p-3 shadow-sm">
      <h4 className="text-sm font-semibold text-gray-800 mb-3">History Dates</h4>
      <ul className="space-y-2 text-sm max-h-64 overflow-auto pr-1">
        {dates.map((d) => {
          const isActive = selectedDate === d;
          return (
            <li key={d}>
              <button
                type="button"
                onClick={() => onSelectDate && onSelectDate(d)}
                className={
                  "w-full text-left px-3 py-2 rounded-md border transition-colors cursor-pointer " +
                  (isActive
                    ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                    : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100")
                }
                
                
              >
                {toDmy(d)}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
