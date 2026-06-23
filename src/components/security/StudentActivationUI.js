import React from 'react';
import { Mail, _Lock, Check, _X } from 'lucide-react';
import { SecurityAuthentication } from './SecurityAuthentication';

export function StudentActivationUI({
  emailInput, setEmailInput,
  handleSendOtp, emailSending, otpSent, setOtpSent,
  otpInput, setOtpInput, handleVerifyOtp, otpVerifying,
  isEmailVerified, isPasswordSet,
  resendCountdown,
  passwordManagement,
  isEmailValid
}) {
  return (
    <div className="border border-gray-300 rounded-md bg-white overflow-hidden shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-3 bg-gray-50 border-b border-gray-300">
        <ActivationStep num={1} title="Logged In" status="success" />
        <ActivationStep num={2} title="Verify Email" status={isEmailVerified ? "success" : "active"} />
        <ActivationStep num={3} title="Create Password" status={!isEmailVerified ? "waiting" : (isPasswordSet ? "success" : "active")} />
      </div>

      <div className="p-6 space-y-8">
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="text-gray-400" size={18} />
            <h2 className="text-sm font-semibold text-gray-800">Step 2: Verify Your Institutional Email</h2>
          </div>
          
          <div className="max-w-md space-y-3 pl-0 sm:pl-7">
            {isEmailVerified ? (
              <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-md p-3 text-xs">
                <Check size={16} className="text-green-600 font-bold" />
                <span className="font-semibold">Institutional Email Verified: {emailInput}</span>
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-600">Enter your primary email address. We will send a 6-digit verification code to this address.</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input 
                    type="email" 
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    disabled={otpSent}
                    placeholder="name@example.com"
                    className={`flex-1 border rounded-md px-3 py-2 text-sm focus:ring-1 transition-all outline-none disabled:bg-gray-50 ${
                      emailInput && !isEmailValid ? 'border-red-400 focus:ring-red-400 bg-red-50/10' : 'border-gray-300 focus:ring-[#0b3578]'
                    }`}
                  />
                  {!otpSent && (
                    <button 
                      onClick={handleSendOtp}
                      disabled={emailSending || !isEmailValid || otpSent}
                      className="bg-[#0b3578] hover:bg-[#0a2d66] text-white px-4 py-2 rounded-md text-sm font-medium transition-all disabled:opacity-50"
                    >
                      {emailSending ? 'Sending...' : 'Send OTP'}
                    </button>
                  )}
                </div>

                {otpSent && (
                  <div className="bg-blue-50 p-4 rounded-md border border-blue-200 animate-slideDown">
                    <label className="block text-[10px] font-bold text-[#0b3578] mb-1 uppercase tracking-wider">Enter Verification Code</label>
                    <div className="flex flex-wrap gap-2">
                      <input 
                        type="text"
                        maxLength={6}
                        value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                        placeholder="000000"
                        className="w-full sm:w-32 border border-blue-200 rounded-md px-3 py-2 text-center text-lg font-mono tracking-widest focus:ring-1 focus:ring-[#0b3578] outline-none"
                      />
                      <button 
                        onClick={handleVerifyOtp}
                        disabled={otpVerifying || otpInput.length !== 6}
                        className="flex-1 sm:flex-none bg-[#0b3578] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#0a2d66] disabled:opacity-50"
                      >
                        {otpVerifying ? 'Verifying...' : 'Verify'}
                      </button>
                      
                      <div className="w-full flex items-center justify-between mt-2">
                        <button 
                          onClick={() => { setOtpSent(false); setOtpInput(''); }}
                          className="text-[#0b3578] text-[10px] font-bold uppercase hover:underline"
                        >
                          Change Email
                        </button>
                        
                        {resendCountdown > 0 ? (
                          <span className="text-gray-400 text-[10px] font-bold uppercase">Resend in {resendCountdown}s</span>
                        ) : (
                          <button 
                            onClick={handleSendOtp}
                            className="text-[#0b3578] text-[10px] font-bold uppercase hover:underline"
                          >
                            Resend OTP
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        <section className={`space-y-4 ${!isEmailVerified ? 'opacity-40 pointer-events-none' : ''}`}>
          <SecurityAuthentication
            isPasswordSet={isPasswordSet}
            {...passwordManagement}
            buttonText="Complete Activation"
            title="Step 3: Secure Your Account"
            description="Create a strong password to protect your academic records."
          />
        </section>
      </div>
    </div>
  );
}

function ActivationStep({ num, title, status }) {
  const styles = {
    success: 'bg-green-50 text-green-700',
    active: 'bg-blue-50 text-[#0b3578]',
    waiting: 'bg-gray-50 text-gray-400',
  };
  
  return (
    <div className={`flex items-center justify-center p-4 gap-3 ${styles[status]}`}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
        status === 'success' ? 'bg-green-600 text-white border-green-600' : 
        status === 'active' ? 'bg-[#0b3578] text-white border-[#0b3578]' : 
        'bg-white border-gray-300 text-gray-400'
      }`}>
        {status === 'success' ? '✓' : num}
      </div>
      <span className="text-xs font-semibold uppercase tracking-wide">{title}</span>
    </div>
  );
}
