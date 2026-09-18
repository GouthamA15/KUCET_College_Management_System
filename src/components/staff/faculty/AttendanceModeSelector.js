'use client';
import { Camera, MapPin, Edit3, History, ArrowLeft } from 'lucide-react';

export default function AttendanceModeSelector({ selectedMode, onSelectMode }) {
  const modes = [
    {
      id: 'qr',
      title: 'Zero Trust Attendance',
      description: 'Continuous QR scanner.',
      icon: Camera,
      selectedClass: 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-1 ring-emerald-500',
      unselectedClass: 'bg-white border-gray-200 text-gray-700 hover:bg-emerald-50 hover:border-emerald-300'
    },
    {
      id: 'gps',
      title: 'GPS & PIN Based',
      description: 'Self-service proxy-free.',
      icon: MapPin,
      selectedClass: 'bg-indigo-50 border-indigo-500 text-indigo-800 ring-1 ring-indigo-500',
      unselectedClass: 'bg-white border-gray-200 text-gray-700 hover:bg-indigo-50 hover:border-indigo-300'
    },
    {
      id: 'manual',
      title: 'Manual Entry',
      description: 'Traditional grid marking.',
      icon: Edit3,
      selectedClass: 'bg-amber-50 border-amber-500 text-amber-800 ring-1 ring-amber-500',
      unselectedClass: 'bg-white border-gray-200 text-gray-700 hover:bg-amber-50 hover:border-amber-300'
    }
  ];

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Attendance Mode</h3>
        <button
          onClick={() => onSelectMode('view')}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
        >
          <History className="w-3.5 h-3.5" />
          View History
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const isSelected = selectedMode === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => onSelectMode(mode.id)}
              className={`text-left p-3 rounded-xl border transition-all duration-200 flex items-start gap-3 ${isSelected ? mode.selectedClass : mode.unselectedClass}`}
            >
              <div className={`p-2 rounded-lg shrink-0 ${isSelected ? 'bg-white/60' : 'bg-gray-100'}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold mb-0.5 leading-tight">{mode.title}</h4>
                <p className={`text-xs ${isSelected ? 'opacity-90' : 'text-gray-500'}`}>{mode.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
