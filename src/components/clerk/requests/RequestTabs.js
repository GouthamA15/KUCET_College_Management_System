'use client';

const RequestTabs = ({ activeTab, onTabChange, badges = {} }) => {
    const tabs = [
        { id: 'admissions', label: 'Admission Intake', badge: badges.admissions },
        { id: 'certificates', label: 'Certificates & IDs', badge: badges.certificates },
        { id: 'updates', label: 'Profile Modifications', badge: badges.updates }
    ];

    return (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-px">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all relative ${
                        activeTab === tab.id
                            ? 'text-[#0b3578] border-b-2 border-[#0b3578]'
                            : 'text-slate-400 hover:text-slate-600 border-b-2 border-transparent'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        {tab.label}
                        {tab.badge > 0 && (
                            <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black ${
                                activeTab === tab.id ? 'bg-[#0b3578] text-white' : 'bg-slate-100 text-slate-500'
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
