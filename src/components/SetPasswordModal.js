import React, { useState } from 'react';
import { Lock, Shield, Check, X, AlertCircle, Wand2, Copy, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { generateStrongPassword } from '@/lib/security';

const SetPasswordModal = ({ rollno, email, onPasswordSet }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const handlePasswordSave = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }
    
    setPasswordSaving(true);
    try {
      const res = await fetch('/api/student/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollno, password: newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Password set successfully!');
        if (onPasswordSet) onPasswordSet();
      } else {
        toast.error(data.error || 'Failed to set password');
      }
    } catch (e) {
      toast.error('Network error');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleGeneratePassword = () => {
    const pw = generateStrongPassword();
    setNewPassword(pw);
    setConfirmPassword(pw);
    toast.success('Strong password generated!');
  };

  const copyToClipboard = () => {
    if (!newPassword) return;
    navigator.clipboard.writeText(newPassword);
    toast.success('Password copied to clipboard!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
        <div className="bg-[#0b3578] p-6 text-white text-center relative">
          <div className="absolute top-0 left-0 w-full h-full opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, white 0%, transparent 40%)' }} />
          <Shield className="mx-auto mb-3 opacity-80" size={32} />
          <h2 className="text-xl font-bold tracking-tight uppercase">Secure Your Account</h2>
          <p className="text-blue-100 text-xs mt-1 uppercase tracking-widest font-medium">Create a personal password</p>
        </div>

        <div className="p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl flex gap-3 flex-1">
              <AlertCircle className="text-blue-600 shrink-0" size={18} />
              <p className="text-[10px] text-blue-800 leading-relaxed font-medium">
                Set a strong personal password to replace your temporary DOB password.
              </p>
            </div>
            <button 
              onClick={handleGeneratePassword}
              className="ml-3 p-3 bg-slate-50 text-[#0b3578] rounded-xl border border-slate-200 hover:bg-slate-100 transition-all group"
              title="Generate Strong Password"
            >
              <Wand2 size={20} className="group-hover:rotate-12 transition-transform" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between px-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">New Password</label>
                {newPassword && (
                  <button onClick={copyToClipboard} className="text-[#0b3578] hover:underline text-[9px] font-bold uppercase flex items-center gap-1">
                    <Copy size={12} /> Copy
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Lock size={16} /></span>
                <input 
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-[#0b3578]/20 focus:border-[#0b3578] outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Confirm Password</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Check size={16} /></span>
                <input 
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-[#0b3578]/20 focus:border-[#0b3578] outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {newPassword && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex gap-3 animate-slideDown">
              <Share2 className="text-emerald-600 shrink-0" size={18} />
              <p className="text-[10px] text-emerald-800 leading-relaxed font-medium">
                <strong className="uppercase">Save Password:</strong> Please copy and save this password in your <span className="font-bold">WhatsApp</span> or a safe place before saving.
              </p>
            </div>
          )}

          <div className="space-y-3 pt-2">
            <button
              onClick={handlePasswordSave}
              disabled={passwordSaving || !newPassword || newPassword !== confirmPassword || newPassword.length < 8}
              className="w-full py-3 bg-[#0b3578] text-white rounded-xl font-bold uppercase tracking-[0.15em] text-xs hover:bg-[#0a2d66] disabled:bg-slate-100 disabled:text-slate-400 transition-all shadow-lg shadow-blue-900/20"
            >
              {passwordSaving ? 'Saving Credentials...' : 'Set Password'}
            </button>
            <p className="text-[10px] text-center text-slate-400 uppercase font-medium tracking-tighter">
              Password must be at least 8 characters long.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetPasswordModal;