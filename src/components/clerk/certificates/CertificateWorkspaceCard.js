"use client";

export default function CertificateWorkspaceCard({ mode = "active", onChange }) {
  const options = [
    { key: "active", label: "Active Requests" },
    { key: "history", label: "History" },
  ];

  return (
    <section className="bg-white border rounded-lg p-3 shadow-sm">
      <h4 className="text-sm font-semibold text-gray-800 mb-3">Workspace</h4>
      <div className="flex items-center gap-2">
        {options.map((opt) => {
          const isActive = mode === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange && onChange(opt.key)}
              className={
                "px-3 py-1.5 text-sm rounded-md border transition-colors cursor-pointer " +
                (isActive
                  ? "bg-indigo-600 border-indigo-600 text-white"
                  : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100")
              }
              
              
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
