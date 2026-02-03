'use client';

import { useEffect, useState } from 'react';
import Header from '@/app/components/Header/Header';
import Navbar from '@/app/components/Navbar/Navbar';
import Footer from '@/components/Footer';

export default function SecurityPrivacyPage() {
  const [loading, setLoading] = useState(true);
  const [rollno, setRollno] = useState(null);
  const [student, setStudent] = useState(null);

  // Email section state
  const [emailInput, setEmailInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [emailMessage, setEmailMessage] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [emailEditing, setEmailEditing] = useState(false);

  // Password section state
  const [pwExpanded, setPwExpanded] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailValid, setEmailValid] = useState(false);
  const [pwStrength, setPwStrength] = useState({ score: 0, label: 'Too Weak' });

  useEffect(() => {
    const load = async () => {
      try {
        const meRes = await fetch('/api/student/me');
        if (!meRes.ok) { setLoading(false); return; }
        const me = await meRes.json();
        const rno = me.roll_no;
        setRollno(rno);
        const detailRes = await fetch(`/api/student/${rno}`);
        if (!detailRes.ok) { setLoading(false); return; }
        const detail = await detailRes.json();
        const st = detail.student;
        setStudent(st);
        setEmailInput(st?.email || '');
      } catch (e) {
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Email validation helper: valid format and must end with .com
  const validateEmail = (val) => {
    const e = (val || '').trim().toLowerCase();
    const basic = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(e);
    const endsCom = e.endsWith('.com');
    const valid = basic && endsCom;
    let msg = '';
    if (!basic) msg = 'Enter a valid email address.';
    else if (!endsCom) msg = 'Email must end with .com';
    return { valid, msg };
  };

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

  // Keep email validation state in sync
  useEffect(() => {
    const { valid, msg } = validateEmail(emailInput);
    setEmailValid(valid);
    setEmailError(msg);
  }, [emailInput]);

  // Update password strength when newPassword changes
  useEffect(() => {
    setPwStrength(measureStrength(newPassword));
  }, [newPassword]);

  const isEmailMissing = !student?.email;
  const isEmailVerified = !!student?.is_email_verified;
  const isPasswordSet = !!student?.password_hash;

  const badge = (ok) => (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${ok ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-800'}`}>{ok ? 'Verified' : 'Not Verified'}</span>
  );

  const statusBadge = (ok) => (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{ok ? 'Set' : 'Not Set'}</span>
  );

  const sendOtp = async () => {
    if (!rollno || !emailInput) return;
    setEmailMessage('');
    setEmailSending(true);
    try {
      const res = await fetch('/api/student/send-update-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollno: rollno, email: emailInput })
      });
      const data = await res.json();
      if (res.ok) {
        setEmailMessage('OTP sent to your email. Check inbox.');
        setOtpSent(true);
        setOtpInput('');
      } else {
        setEmailMessage(data?.message || 'Failed to send OTP');
        setOtpSent(false);
      }
    } catch {
      setEmailMessage('Network error while sending OTP');
      setOtpSent(false);
    } finally {
      setEmailSending(false);
    }
  };

  const verifyOtp = async () => {
    if (!rollno || !otpInput || !emailInput) return;
    setEmailMessage('');
    setOtpVerifying(true);
    try {
      const res = await fetch('/api/student/verify-update-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollno: rollno, otp: otpInput, email: emailInput })
      });
      const data = await res.json();
      if (res.ok) {
        setEmailMessage('Email verified successfully.');
        setStudent((prev) => prev ? { ...prev, email: emailInput, is_email_verified: true } : prev);
      } else {
        setEmailMessage(data?.message || 'Failed to verify OTP');
      }
    } catch {
      setEmailMessage('Network error while verifying OTP');
    } finally {
      setOtpVerifying(false);
    }
  };

  const canSaveNewPw = newPassword.length >= 6 && newPassword === confirmPassword;

  const savePassword = async () => {
    if (!rollno || !canSaveNewPw) return;
    setPwMessage('');
    setPwSaving(true);
    try {
      const res = await fetch('/api/student/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollno: rollno, password: newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setPwMessage('Password updated successfully.');
        setStudent((prev) => prev ? { ...prev, password_hash: 'set' } : prev);
        setPwExpanded(false);
        setNewPassword(''); setConfirmPassword(''); setCurrentPassword('');
      } else {
        setPwMessage(data?.error || 'Failed to update password');
      }
    } catch {
      setPwMessage('Network error while updating password');
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col overflow-hidden">
      <Header />
      <Navbar studentProfileMode={true} activeTab={'menu'} onLogout={async () => { await fetch('/api/student/logout', { method: 'POST' }); location.href = '/'; }} />

      <main className="flex-1 flex items-start justify-center px-6 py-8">
        <div className="w-full max-w-4xl bg-white shadow-xl rounded-lg p-6 md:p-8">
          <h1 className="text-2xl font-bold mb-6">Security & Privacy</h1>

          {loading ? (
            <div className="text-sm text-gray-600">Loading...</div>
          ) : (
            <div className="space-y-8">
              {/* Section 1: Account Security Status (Read-only) */}
              <section className="border rounded-md p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Account Security Status</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-500">Email</div>
                    <div className="font-medium">{student?.email || 'Not Set'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Email Status</div>
                    <div className="font-medium">{badge(isEmailVerified)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Password Status</div>
                    <div className="font-medium">{statusBadge(isPasswordSet)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Last Login</div>
                    <div className="font-medium">Not available</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Account Created</div>
                    <div className="font-medium">Not available</div>
                  </div>
                </div>
              </section>

              {/* Section 2: Email Setup (unverified) or Edit Email (verified) */}
              <section className="border rounded-md p-4">
                {(!isEmailVerified) ? (
                  <>
                    <h2 className="text-sm font-semibold text-gray-700 mb-3">Email Setup & Verification</h2>
                    {(() => {
                      const emailChanged = (emailInput || '').trim() !== (student?.email || '').trim();
                      const canSend = !!emailInput && emailValid && !emailSending;
                      const showOtpArea = otpSent === true;
                      const buttonLabel = isEmailMissing ? 'Send OTP' : (emailChanged ? 'Send OTP' : 'Resend OTP');
                      return (
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs text-gray-600">Email</label>
                            <input
                              className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                              type="email"
                              value={emailInput}
                              onChange={(e) => { setEmailInput(e.target.value); setOtpSent(false); setOtpInput(''); }}
                              placeholder="Enter your email"
                            />
                            {emailError && (
                              <div className="mt-1 text-xs text-red-600">{emailError}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={sendOtp} disabled={!canSend} className={`px-3 py-2 rounded text-white ${!canSend ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}>{emailSending ? 'Sending...' : buttonLabel}</button>
                            <span className="text-xs text-gray-500">Enter the OTP sent to your email</span>
                          </div>
                          {showOtpArea && (
                            <>
                              <div>
                                <label className="text-xs text-gray-600">OTP</label>
                                <input
                                  className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  maxLength={6}
                                  value={otpInput}
                                  onChange={(e) => {
                                    const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                                    setOtpInput(v);
                                  }}
                                  placeholder="Enter 6-digit OTP"
                                />
                              </div>
                              {(otpInput.trim().length === 6) && (
                                <button onClick={verifyOtp} disabled={otpVerifying} className={`px-4 py-2 rounded text-white ${otpVerifying ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}>{otpVerifying ? 'Verifying...' : 'Verify'}</button>
                              )}
                            </>
                          )}
                          {emailMessage && <div className="text-xs text-gray-600">{emailMessage}</div>}
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <>
                    <h2 className="text-sm font-semibold text-gray-700 mb-3">Edit Email</h2>
                    {(() => {
                      const emailChanged = (emailInput || '').trim() !== (student?.email || '').trim();
                      const canSendEdit = emailEditing && emailValid && emailChanged && !emailSending;
                      const showOtpArea = emailEditing && otpSent === true;
                      return (
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs text-gray-600">Email</label>
                            <input
                              className={`mt-1 w-full border rounded-md px-3 py-2 text-sm ${!emailEditing ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                              type="email"
                              value={emailInput}
                              onChange={(e) => { setEmailInput(e.target.value); setOtpSent(false); setOtpInput(''); }}
                              placeholder="Your email"
                              readOnly={!emailEditing}
                              disabled={!emailEditing}
                            />
                            {!emailEditing && (
                              <div className="mt-1 text-xs text-gray-500">Click Edit to change your email</div>
                            )}
                            {emailError && emailEditing && (
                              <div className="mt-1 text-xs text-red-600">{emailError}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {!emailEditing ? (
                              <button type="button" onClick={() => { setEmailEditing(true); setOtpSent(false); setOtpInput(''); }} className="px-3 py-2 rounded text-white bg-blue-600 hover:bg-blue-700">Edit</button>
                            ) : (
                              <>
                                <button type="button" onClick={() => { setEmailEditing(false); setEmailInput(student?.email || ''); setOtpSent(false); setOtpInput(''); }} className="px-3 py-2 rounded border bg-white hover:bg-gray-50">Cancel</button>
                                <button onClick={sendOtp} disabled={!canSendEdit} className={`px-3 py-2 rounded text-white ${!canSendEdit ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}>{emailSending ? 'Sending...' : 'Send OTP'}</button>
                                {emailChanged && (
                                  <span className="text-xs text-gray-500">Changing email requires verification</span>
                                )}
                              </>
                            )}
                          </div>
                          {showOtpArea && (
                            <>
                              <div>
                                <label className="text-xs text-gray-600">OTP</label>
                                <input
                                  className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  maxLength={6}
                                  value={otpInput}
                                  onChange={(e) => {
                                    const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                                    setOtpInput(v);
                                  }}
                                  placeholder="Enter 6-digit OTP"
                                />
                              </div>
                              {(otpInput.trim().length === 6) && (
                                <button onClick={async () => { await verifyOtp(); setEmailEditing(false); }} disabled={otpVerifying} className={`px-4 py-2 rounded text-white ${otpVerifying ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}>{otpVerifying ? 'Verifying...' : 'Verify'}</button>
                              )}
                            </>
                          )}
                          {emailMessage && <div className="text-xs text-gray-600">{emailMessage}</div>}
                        </div>
                      );
                    })()}
                  </>
                )}
              </section>

              {/* Section 3: Password Setup / Change */}
              {!isPasswordSet ? (
                // CASE A: Password NOT set - red warning banner with embedded form
                <section className="border border-red-300 bg-red-50 rounded-md p-4">
                  <div className="text-red-700 font-semibold mb-2">Security Warning: Please set your password ASAP</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-700">New Password</label>
                      <input
                        type="password"
                        className={`mt-1 w-full border rounded-md px-3 py-2 text-sm ${!isEmailVerified ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        disabled={!isEmailVerified}
                        minLength={8}
                        autoComplete="new-password"
                      />
                      <div className="mt-1 flex items-center gap-2 text-xs">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 ${pwStrength.label === 'Strong' ? 'bg-green-100 text-green-700' : pwStrength.label === 'Medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-700'}`}>{pwStrength.label}</span>
                        <span className="text-gray-600">Min 8 chars, include upper, lower, number, special</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-700">Confirm Password</label>
                      <input
                        type="password"
                        className={`mt-1 w-full border rounded-md px-3 py-2 text-sm ${!isEmailVerified ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        disabled={!isEmailVerified}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <button
                      onClick={savePassword}
                      disabled={!(pwStrength.score >= 5 && canSaveNewPw) || pwSaving || !isEmailVerified}
                      className={`px-4 py-2 rounded text-white ${pwSaving || !isEmailVerified ? 'bg-gray-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
                    >
                      {pwSaving ? 'Saving...' : 'Set Password'}
                    </button>
                    {pwMessage && <div className="mt-2 text-xs text-gray-700">{pwMessage}</div>}
                    {!isEmailVerified && (
                      <div className="mt-1 text-xs text-gray-600">Verify your email above to enable password setup.</div>
                    )}
                  </div>
                </section>
              ) : (
                // CASE B: Password IS set - collapsed Change Password section
                <section className="border rounded-md p-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-gray-700">Change Password</h2>
                    <button onClick={() => setPwExpanded((v) => !v)} className="text-xs text-blue-600 hover:underline">{pwExpanded ? 'Collapse' : 'Expand'}</button>
                  </div>
                  {pwExpanded && (
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="text-xs text-gray-700">Current Password</label>
                        <div className="relative">
                          <input type={showCurrentPw ? 'text' : 'password'} className="mt-1 w-full border rounded-md px-3 py-2 text-sm pr-14" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password" />
                          <button type="button" onClick={() => setShowCurrentPw((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-600 hover:text-gray-800">
                            {showCurrentPw ? 'Hide' : 'Show'}
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-700">New Password</label>
                          <div className="relative">
                            <input type={showNewPw ? 'text' : 'password'} className="mt-1 w-full border rounded-md px-3 py-2 text-sm pr-14" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" />
                            <button type="button" onClick={() => setShowNewPw((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-600 hover:text-gray-800">
                              {showNewPw ? 'Hide' : 'Show'}
                            </button>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-xs">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 ${pwStrength.label === 'Strong' ? 'bg-green-100 text-green-700' : pwStrength.label === 'Medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-700'}`}>{pwStrength.label}</span>
                            <span className="text-gray-600">Min 8 chars, include upper, lower, number, special</span>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-700">Confirm Password</label>
                          <div className="relative">
                            <input type={showConfirmPw ? 'text' : 'password'} className="mt-1 w-full border rounded-md px-3 py-2 text-sm pr-14" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password" />
                            <button type="button" onClick={() => setShowConfirmPw((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-600 hover:text-gray-800">
                              {showConfirmPw ? 'Hide' : 'Show'}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div>
                        {(currentPassword || newPassword || confirmPassword) && (
                          <button onClick={savePassword} disabled={!canSaveNewPw || pwSaving} className={`px-4 py-2 rounded text-white ${pwSaving ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}>{pwSaving ? 'Saving...' : 'Update Password'}</button>
                        )}
                        {pwMessage && <div className="mt-2 text-xs text-gray-700">{pwMessage}</div>}
                      </div>
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}