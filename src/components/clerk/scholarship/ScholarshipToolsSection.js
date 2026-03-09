"use client";

export default function ScholarshipToolsSection({ onOpenCertificates }) {
  const tools = [
    {
      key: 'certificates',
      title: 'Certificate Requests',
      description: 'View and process student certificate requests.',
      onClick: onOpenCertificates,
      disabled: false,
    },
    {
      key: 'reports',
      title: 'Reports',
      description: 'Coming Soon',
      disabled: true,
    },
    {
      key: 'notifications',
      title: 'Notifications',
      description: 'Coming Soon',
      disabled: true,
    },
  ];

  return (
    <section className="mt-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-3">Secondary Tools</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {tools.map((tool) => (
          <div
            key={tool.key}
            role={tool.disabled ? undefined : 'button'}
            tabIndex={tool.disabled ? -1 : 0}
            onClick={tool.disabled ? undefined : tool.onClick}
            className={
              'rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow flex flex-col cursor-pointer ' +
              (tool.disabled
                ? 'opacity-60 cursor-not-allowed'
                : 'hover:shadow-md')
            }
          >
            <h3 className="text-md font-semibold text-gray-800 mb-1">{tool.title}</h3>
            <p className="text-sm text-gray-500">{tool.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
