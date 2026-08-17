'use client';

const RequestTabs = ({ activeTab, onTabChange, badges = {} }) => {
    const tabs = [
        { id: 'admissions', label: 'Admission Intake', badge: badges.admissions },
        { id: 'certificates', label: 'Certificates & IDs', badge: badges.certificates },
        { id: 'updates', label: 'Profile Modifications', badge: badges.updates }
    ];

    return (
        <div className="flex flex-wrap items-center gap-2 mb-3">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`px-3 py-2 rounded-md text-sm transition-colors ${
                        activeTab === tab.id
                            ? 'bg-[#0b3578] text-white shadow-sm border border-[#0b3578]'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        {tab.label}
                        {tab.badge > 0 && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                activeTab === tab.id ? 'bg-white text-[#0b3578]' : 'bg-gray-100 text-gray-600'
                            }`}>
                                {tab.badge}
                            </span>
                        )}
                    </div>
                </button>
            ))}
        </div>
    );
};

export default RequestTabs;
