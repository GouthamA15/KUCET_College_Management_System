"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Link from "next/link";
import Footer from "@/components/Footer";
import PublicSidebar from "@/components/PublicSidebar";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  const [passwordValid, setPasswordValid] = useState(false);
  const [passwordStrengthLabel, setPasswordStrengthLabel] = useState('');
  const [tokenStatus, setTokenStatus] = useState('loading'); // 'loading' | 'VALID' | 'EXPIRED' | 'USED' | 'INVALID'
  const [tokenMessage, setTokenMessage] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const params = useParams();
  const router = useRouter();
  const token = params?.token;

  useEffect(() => {
    let cancelled = false;
    async function validateToken() {
      if (!token) {
        setTokenStatus('INVALID');
        setTokenMessage('Invalid reset link');
        return;
      }

      setTokenStatus('loading');
      try {
        const res = await fetch(`/api/auth/reset-password/${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));

        let status = data.status;
        if (!status) {
          if (res.status === 200) status = 'VALID';
          else if (res.status === 410) status = 'EXPIRED';
          else if (res.status === 409) status = 'USED';
          else status = 'INVALID';
        }

        if (!cancelled) {
          setTokenStatus(status);
          setTokenMessage(data.message || '');
        }
      } catch (err) {
        if (!cancelled) {
          setTokenStatus('INVALID');
          setTokenMessage('Invalid reset link');
        }
      }
    }

    validateToken();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");
    setError("");

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/auth/reset-password/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        toast.success(data.message || "Password reset successful");
        setMessage(data.message || "Password reset successful");
        setRedirecting(true);
        setIsLoading(false);
        setTimeout(() => router.push("/"), 2000);
      } else {
        const msg = data.error || "An error occurred";
        toast.error(msg);
        setError(msg);
      }
    } catch (err) {
      toast.error("An error occurred");
      setError("An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
      
      {/* Mobile Menu Trigger */}
      <div className="lg:hidden fixed top-4 left-4 z-[70]">
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 bg-[#0b3578] text-white rounded-lg shadow-lg hover:bg-[#0a2d66] transition-all"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      <PublicSidebar 
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
      />

      <div className="flex-1 flex flex-col min-h-screen relative overflow-x-hidden transition-all duration-300 lg:ml-16">
        <main className="flex-1 bg-gray-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-[#0b3578] uppercase tracking-tight">Reset Password</h1>
                <p className="text-xs text-slate-400 mt-2 uppercase tracking-widest font-bold">Credential Recovery</p>
              </div>

              {tokenStatus === 'loading' && (
                <div className="py-12 text-center">
                  <div className="w-8 h-8 border-4 border-[#0b3578] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Validating reset link...</p>
                </div>
              )}

              {tokenStatus === 'VALID' && (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-1.5">
                    <label htmlFor="password" uncomfortable className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={passwordVisible ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => {
                          const v = e.target.value;
                          setPassword(v);
                          const score = v.length >= 12 ? 3 : v.length >= 10 ? 2 : v.length >= 8 ? 1 : 0;
                          const hasLower = /[a-z]/.test(v);
                          const hasUpper = /[A-Z]/.test(v);
                          const hasNum = /\d/.test(v);
                          const hasSpec = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(v);
                          const passed = v.length >= 8 && hasLower && hasUpper && hasNum && hasSpec;
                          setPasswordValid(passed);
                          if (!v) setPasswordStrengthLabel('');
                          else if (!passed) setPasswordStrengthLabel('Weak');
                          else if (score >= 3) setPasswordStrengthLabel('Strong');
                          else if (score === 2) setPasswordStrengthLabel('Good');
                          else setPasswordStrengthLabel('Fair');
                        }}
                        className="w-full border border-gray-200 rounded px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#0b3578]"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setPasswordVisible((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 hover:text-[#0b3578] uppercase"
                      >
                        {passwordVisible ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    {passwordStrengthLabel && (
                      <p className={`text-[9px] font-black uppercase tracking-widest ${passwordValid ? 'text-green-600' : 'text-yellow-600'}`}>Strength: {passwordStrengthLabel}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="confirmPassword" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        type={confirmVisible ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full border border-gray-200 rounded px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#0b3578]"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setConfirmVisible((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 hover:text-[#0b3578] uppercase"
                      >
                        {confirmVisible ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    {confirmPassword && password !== confirmPassword && (
                      <p className="text-red-600 text-[9px] font-black uppercase tracking-widest mt-1">Passwords do not match</p>
                    )}
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full bg-[#0b3578] text-white font-bold py-2 rounded text-xs uppercase tracking-widest hover:bg-[#0a2d66] transition-all disabled:opacity-50"
                      disabled={isLoading || redirecting || !password || !confirmPassword || password !== confirmPassword}
                    >
                      {redirecting ? 'Redirecting...' : (isLoading ? 'Processing...' : 'Reset Password')}
                    </button>
                  </div>

                  <div className="text-center">
                    <Link href="/" className="text-[10px] font-black text-[#0b3578] hover:underline uppercase tracking-widest">
                      Back to Login
                    </Link>
                  </div>
                </form>
              )}

              {tokenStatus !== 'loading' && tokenStatus !== 'VALID' && (
                <div className="text-center">
                  <h2 className="text-lg font-bold text-red-600 uppercase tracking-tight">
                    {tokenStatus === 'EXPIRED' ? 'Link Expired' : tokenStatus === 'USED' ? 'Link Used' : 'Invalid Link'}
                  </h2>
                  <p className="mt-2 text-xs text-slate-500">{tokenMessage || 'Please request a new reset link.'}</p>
                  <div className="mt-6">
                    <Link href="/" className="inline-block bg-[#0b3578] text-white px-6 py-2 rounded text-xs font-bold uppercase tracking-widest hover:bg-[#0a2d66] transition-all">Go to Home</Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        <Footer />
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 lg:hidden transition-all duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}