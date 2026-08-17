'use client';
import { Camera, MapPin, Edit3, History, ArrowLeft } from 'lucide-react';

export default function AttendanceModeSelector({ assignment, onSelectMode, onBack }) {
  const modes = [
    {
      id: 'qr',
      title: 'Zero Trust Attendance',
      description: 'Continuous QR code scanner for ID cards.',
      icon: Camera,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
      hover: 'hover:bg-emerald-50 hover:border-emerald-300 hover:shadow-emerald-100',
      iconBg: 'bg-emerald-100'
    },
    {
      id: 'gps',
      title: 'GPS & PIN Based',
      description: 'Self-service proxy-free attendance.',
      icon: MapPin,
      color: 'bg-indigo-50 text-indigo-600 border-indigo-200',
      hover: 'hover:bg-indigo-50 hover:border-indigo-300 hover:shadow-indigo-100',
      iconBg: 'bg-indigo-100'
    },
    {
      id: 'manual',
      title: 'Manual Entry',
      description: 'Traditional grid for manual marking.',
      icon: Edit3,
      color: 'bg-amber-50 text-amber-600 border-amber-200',
      hover: 'hover:bg-amber-50 hover:border-amber-300 hover:shadow-amber-100',
      iconBg: 'bg-amber-100'
    }
  ];

  return (
    <div className="max-w-4xl mx-auto mt-4 animate-fadeIn">
      <button onClick={onBack} className="text-sm font-medium text-gray-700 hover:text-gray-900 mb-6 inline-flex items-center gap-2 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Subjects
      </button>

      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
        <div className="mb-8">
          <h2 className="text-2xl font-black text-gray-900 mb-2">Select Attendance Mode</h2>
          <p className="text-gray-500 font-medium text-sm">
            Choose how you want to record attendance for <span className="font-bold text-gray-700">{assignment.subject_name}</span>.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {modes.map((mode) => {
            const Icon = mode.icon;
            return (
              <button
                key={mode.id}
                onClick={() => onSelectMode(mode.id)}
                className={`text-left p-6 rounded-2xl border-2 transition-all duration-300 group hover:shadow-lg active:scale-[0.98] ${mode.hover} bg-white border-gray-100`}
              >
                <div className={`w-14 h-14 rounded-xl ${mode.iconBg} ${mode.color.split(' ')[1]} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-black text-gray-900 mb-2 tracking-tight">{mode.title}</h3>
                <p className="text-sm text-gray-500 font-medium leading-relaxed">{mode.description}</p>
              </button>
            );
          })}
        </div>

        <div className="border-t border-gray-100 pt-8">
          <button
            onClick={() => onSelectMode('view')}
            className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                <History className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h4 className="text-sm font-bold text-gray-900">View Attendance History</h4>
                <p className="text-xs text-gray-500 font-medium">Read-only view of all past sessions and records.</p>
              </div>
            </div>
            <div className="text-gray-400 group-hover:text-gray-600 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
