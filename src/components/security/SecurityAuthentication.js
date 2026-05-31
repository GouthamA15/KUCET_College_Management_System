import React, { useState } from 'react';
import { Clock, Lock, Check, X } from 'lucide-react';

export function SecurityAuthentication({
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  pwSaving,
  onSavePassword,
  pwStrength,
  requirements,
  isPasswordSet = true,
  buttonText = "Update Password",
  title = "Password Management",
  description = "Update your account access credentials.",
  children
}) {
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  return (
    <div className="space-y-6 animate-fadeIn">
      {children}
      
      <section className="border border-gray-300 rounded-md bg-white p-4 sm:p-6">
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          <p className="text-sm text-gray-600">{description}</p>
        </div>

        <div className="max-w-md space-y-5">
          {isPasswordSet && (
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-tight">Current Password</label>
              <div className="relative">
                <input 
                  type={showCurrentPw ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-[#0b3578] outline-none pr-10"
                  placeholder="••••••••"
                />
                <button onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showCurrentPw ? <Clock size={16} /> : <Lock size={16} />}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-tight">New Password</label>
            <div className="relative">
              <input 
                type={showNewPw ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-[#0b3578] outline-none pr-10"
                placeholder="••••••••"
              />
              <button onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showNewPw ? <Clock size={16} /> : <Lock size={16} />}
              </button>
            </div>
            
            {newPassword && (
              <div className="pt-1.5 animate-fadeIn">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Strength</span>
                  <span className={`text-[10px] font-bold uppercase ${pwStrength?.text}`}>{pwStrength?.label}</span>
                </div>
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full transition-all duration-500 ${pwStrength?.color} ${pwStrength?.label === 'Strong' ? 'w-3/4' : pwStrength?.label === 'Very Strong' ? 'w-full' : pwStrength?.label === 'Medium' ? 'w-1/2' : 'w-1/4'}`} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 pt-2">
              {requirements.map((req, i) => (
                <div key={i} className={`flex items-center gap-1.5 text-[10px] font-medium transition-colors ${req.met ? 'text-green-600' : 'text-gray-400'}`}>
                  {req.met ? <Check size={10} /> : <X size={10} />}
                  {req.label}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-tight">Confirm New Password</label>
            <input 
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-[#0b3578] outline-none"
              placeholder="••••••••"
            />
          </div>

          <button 
            onClick={onSavePassword}
            disabled={pwSaving || (newPassword && pwStrength?.label === 'Weak') || !newPassword || newPassword !== confirmPassword || (isPasswordSet && !currentPassword)}
            className="w-full bg-[#0b3578] text-white py-2.5 rounded-md font-semibold hover:bg-[#0a2d66] disabled:bg-gray-100 disabled:text-gray-400 transition-all text-sm shadow-sm"
          >
            {pwSaving ? 'Processing...' : buttonText}
          </button>
        </div>
      </section>

      <div className="bg-gray-50 p-4 rounded-md border border-gray-300">
        <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-2">Security Guidelines</h3>
        <ul className="space-y-2 text-xs text-gray-600">
          <li className="flex items-start gap-2">
            <div className="w-1 h-1 rounded-full bg-[#0b3578] mt-1.5 shrink-0" />
            Passwords must be at least 8 characters long and meet complexity requirements.
          </li>
          <li className="flex items-start gap-2">
            <div className="w-1 h-1 rounded-full bg-[#0b3578] mt-1.5 shrink-0" />
            Never share your credentials or multi-factor tokens with anyone.
          </li>
          <li className="flex items-start gap-2">
            <div className="w-1 h-1 rounded-full bg-[#0b3578] mt-1.5 shrink-0" />
            Audit logs are maintained for all security-sensitive actions.
          </li>
        </ul>
      </div>
    </div>
  );
}
