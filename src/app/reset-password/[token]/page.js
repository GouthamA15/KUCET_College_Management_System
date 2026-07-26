"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Link from "next/link";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import HeaderMobileView from "@/components/Header-MobileView";
import ClientShell from "@/components/ClientShell.client";
import { Eye, EyeOff } from "lucide-react";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [_message, setMessage] = useState("");
  const [_error, setError] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  const [passwordValid, setPasswordValid] = useState(false);
  const [passwordStrengthLabel, setPasswordStrengthLabel] = useState('');
  const [tokenStatus, setTokenStatus] = useState('loading'); // 'loading' | 'VALID' | 'EXPIRED' | 'USED' | 'INVALID'
  const [tokenMessage, setTokenMessage] = useState('');

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
        const data = await res.json().catch(() => ({ /* empty */ }));

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
      } catch (_err) {
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

      const data = await response.json().catch(() => ({ /* empty */ }));

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
    } catch (_err) {
      toast.error("An error occurred");
      setError("An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans relative">
      <HeaderMobileView />
      <Header />
      <ClientShell />

      <div id="main-content" className="flex-2 flex flex-col relative overflow-x-hidden transition-all duration-300">
        <main className="flex-grow bg-gray-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full my-auto">
            <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-6 sm:p-8">
              <div className="mb-6">
                <h1 className="text-2xl font-semibold text-gray-800">Reset Password</h1>
                <p className="text-sm text-gray-600 mt-1">Please enter your new password to recover access to your account.</p>
              </div>

              {tokenStatus === 'loading' && (
                <div className="py-12 text-center">
                  <div className="w-8 h-8 border-4 border-[#0b3578] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-sm font-medium text-gray-600">Validating reset link...</p>
                </div>
              )}

              {tokenStatus === 'VALID' && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="password" className="text-sm font-medium text-gray-700">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPasswords ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => {
                          const v = e.target.value;
                          setPassword(v);
                          const score = v.length >= 12 ? 3 : v.length >= 10 ? 2 : v.length >= 8 ? 1 : 0;
                          const hasLower = /[a-z]/.test(v);
                          const hasUpper = /[A-Z]/.test(v);
                          const hasNum = /\d/.test(v);
                          const hasSpec = /[!@#$%^&*()_+\-=[\]{ /* empty */ };':"\\|,.<>/?]/.test(v);
                          const passed = v.length >= 8 && hasLower && hasUpper && hasNum && hasSpec;
                          setPasswordValid(passed);
                          if (!v) setPasswordStrengthLabel('');
                          else if (!passed) setPasswordStrengthLabel('Weak');
                          else if (score >= 3) setPasswordStrengthLabel('Strong');
                          else if (score === 2) setPasswordStrengthLabel('Good');
                          else setPasswordStrengthLabel('Fair');
                        }}
                        className="w-full border border-gray-300 rounded-md pl-3 pr-10 py-2 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578]"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0b3578] focus:outline-none"
                        aria-label={showPasswords ? 'Hide password' : 'Show password'}
                      >
                        {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {passwordStrengthLabel && (
                      <p className={`text-xs mt-1 font-medium ${passwordValid ? 'text-emerald-600' : 'text-amber-600'}`}>
                        Strength: {passwordStrengthLabel}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        type={showPasswords ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full border border-gray-300 rounded-md pl-3 pr-10 py-2 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578]"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0b3578] focus:outline-none"
                        aria-label={showPasswords ? 'Hide password' : 'Show password'}
                      >
                        {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {confirmPassword && password !== confirmPassword && (
                      <p className="text-rose-600 text-xs mt-1 font-medium">Passwords do not match</p>
                    )}
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full bg-[#0b3578] text-white font-medium py-2 rounded-md text-sm hover:bg-[#0a2d66] transition-all disabled:opacity-50"
                      disabled={isLoading || redirecting || !password || !confirmPassword || password !== confirmPassword}
                    >
                      {redirecting ? 'Redirecting...' : (isLoading ? 'Processing...' : 'Reset Password')}
                    </button>
                  </div>

                  <div className="text-center pt-2">
                    <Link href="/" className="text-sm font-medium text-[#0b3578] hover:underline">
                      Back to Login
                    </Link>
                  </div>
                </form>
              )}

              {tokenStatus !== 'loading' && tokenStatus !== 'VALID' && (
                <div className="text-center py-4">
                  <h2 className="text-lg font-semibold text-rose-600">
                    {tokenStatus === 'EXPIRED' ? 'Link Expired' : tokenStatus === 'USED' ? 'Link Used' : 'Invalid Link'}
                  </h2>
                  <p className="mt-2 text-sm text-gray-600">{tokenMessage || 'Please request a new reset link.'}</p>
                  <div className="mt-6">
                    <Link href="/" className="inline-block bg-[#0b3578] text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-[#0a2d66] transition-all">
                      Go to Home
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
}