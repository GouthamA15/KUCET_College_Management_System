'use client';

import { useEffect, useState } from 'react';
import { useClerk } from '@/context/ClerkContext';
import Header from '@/app/components/Header/Header';
import Navbar from '@/app/components/Navbar/Navbar';
import Footer from '@/components/Footer';
import toast from 'react-hot-toast';

export default function ClerkSecurityPage() {
  const { clerkData, loading, refreshClerk } = useClerk();
  const clerk = clerkData;

  // Password section state
  const [pwExpanded, setPwExpanded] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwStrength, setPwStrength] = useState({ score: 0, label: 'Too Weak' });

  // Password strength meter (min 8, upper, lower, digit, special)
  const measureStrength = (val) => {
    const v = val || '';
    const rules = {
      length: v.length >= 8,
      upper: /[A-Z]/.test(v),
      lower: /[a-z]/.test(v),
      digit: /\d/.test(v),
      special: /[^A-Za-z0-9]/.test(v),
    };
    const score = Object.values(rules).filter(Boolean).length;
    const label = score >= 5 ? 'Strong' : score === 4 ? 'Medium' : score === 3 ? 'Weak' : 'Too Weak';
    return { score, label, rules };
  };

  // Update password strength when newPassword changes
  useEffect(() => {
    setPwStrength(measureStrength(newPassword));
  }, [newPassword]);

  const canSaveNewPw = newPassword.length >= 8 && newPassword === confirmPassword && currentPassword.length > 0;

  const savePassword = async () => {
    if (!canSaveNewPw) return;
    setPwSaving(true);
    try {
      const res = await fetch('/api/auth/change-password/clerk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          oldPassword: currentPassword,
          newPassword 
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Password updated successfully.');
        setNewPassword(''); 
        setConfirmPassword(''); 
        setCurrentPassword('');
      } else {
        toast.error(data.error || 'Failed to update password');
      }
    } catch {
      toast.error('Network error while updating password');
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col overflow-hidden">
      <Header />
      <Navbar clerkMode={true} activeTab={'menu'} onLogout={async () => { await fetch('/api/clerk/logout', { method: 'POST' }); location.href = '/'; }} />

      <main className="flex-1 flex items-start justify-center px-6 py-8">
        <div className="w-full max-w-4xl bg-white shadow-xl rounded-lg p-6 md:p-8">
          <h1 className="text-2xl font-bold mb-6">Security & Privacy</h1>

          {!clerkData && loading ? (
            <div className="text-sm text-gray-600">Loading...</div>
          ) : !clerkData ? (
            <div className="text-sm text-gray-600">Clerk data not found.</div>
          ) : (
            <div className="space-y-8">
              {/* Account Info Summary */}
              <section className="border rounded-md p-4 bg-gray-50">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Account Status</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500 uppercase font-bold">Role</div>
                    <div className="font-medium text-indigo-700 capitalize">{clerk.role} Clerk</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase font-bold">Email</div>
                    <div className="font-medium">{clerk.email}</div>
                  </div>
                </div>
              </section>

              {/* Change Password Section */}
              <section className="border rounded-md p-4">
                <div className="flex items-center justify-between border-b pb-3 mb-4">
                  <h2 className="text-lg font-semibold text-gray-800">Change Password</h2>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Current Password</label>
                    <div className="relative">
                      <input 
                        type={showCurrentPw ? 'text' : 'password'} 
                        className="w-full border rounded-md px-3 py-2 text-sm pr-14 focus:ring-2 focus:ring-indigo-500 outline-none" 
                        value={currentPassword} 
                        onChange={(e) => setCurrentPassword(e.target.value)} 
                        placeholder="Enter current password" 
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowCurrentPw((v) => !v)} 
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-indigo-600"
                      >
                        {showCurrentPw ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">New Password</label>
                      <div className="relative">
                        <input 
                          type={showNewPw ? 'text' : 'password'} 
                          className="w-full border rounded-md px-3 py-2 text-sm pr-14 focus:ring-2 focus:ring-indigo-500 outline-none" 
                          value={newPassword} 
                          onChange={(e) => setNewPassword(e.target.value)} 
                          placeholder="Enter new password" 
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowNewPw((v) => !v)} 
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-indigo-600"
                        >
                          {showNewPw ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-bold ${
                          pwStrength.label === 'Strong' ? 'bg-green-100 text-green-700' : 
                          pwStrength.label === 'Medium' ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-red-100 text-red-700'
                        }`}>
                          {pwStrength.label}
                        </span>
                        <span className="text-gray-500">Min 8 chars, mixed case, numbers & symbols</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Confirm New Password</label>
                      <div className="relative">
                        <input 
                          type={showConfirmPw ? 'text' : 'password'} 
                          className="w-full border rounded-md px-3 py-2 text-sm pr-14 focus:ring-2 focus:ring-indigo-500 outline-none" 
                          value={confirmPassword} 
                          onChange={(e) => setConfirmPassword(e.target.value)} 
                          placeholder="Re-enter new password" 
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowConfirmPw((v) => !v)} 
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-indigo-600"
                        >
                          {showConfirmPw ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      {confirmPassword && (
                        <div className="mt-1 text-xs">
                          {confirmPassword !== newPassword ? (
                            <span className="text-red-600 font-medium">Passwords do not match</span>
                          ) : (
                            <span className="text-green-600 font-medium">Passwords match</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2">
                    <button 
                      onClick={savePassword} 
                      disabled={!canSaveNewPw || pwSaving} 
                      className={`px-6 py-2 rounded-md text-white font-semibold transition-all ${
                        !canSaveNewPw || pwSaving 
                        ? 'bg-gray-300 cursor-not-allowed' 
                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-md active:scale-95'
                      }`}
                    >
                      {pwSaving ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
