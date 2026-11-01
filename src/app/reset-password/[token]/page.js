"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Link from "next/link";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import HeaderMobileView from "@/components/Header-MobileView";
import ClientShell from "@/components/ClientShell.client";
import { Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [_message, setMessage] = useState("");
  const [_error, setError] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  const [passwordStrengthLabel, setPasswordStrengthLabel] = useState('');
  const [tokenStatus, setTokenStatus] = useState('loading'); // 'loading' | 'VALID' | 'EXPIRED' | 'USED' | 'INVALID'
  const [tokenMessage, setTokenMessage] = useState('');

  // Granular criteria checks
  const criteria = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    digit: /\d/.test(password),
    special: /[^a-zA-Z\d]/.test(password),
  };
  const isAllCriteriaMet = Object.values(criteria).every(Boolean);

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

        let status = data.status || data.code;
        if (!status) {
          if (res.status === 200) status = 'VALID';
          else if (res.status === 410) status = 'EXPIRED';
          else if (res.status === 409) status = 'USED';
          else status = 'INVALID';
        }

        if (!cancelled) {
          setTokenStatus(status);
          setTokenMessage(data.message || data.error || '');
        }
      } catch (_err) {
        if (!cancelled) {
          setTokenStatus('INVALID');
          setTokenMessage('Unable to validate reset link. Please check your internet connection and try again.');
        }
      }
    }

    validateToken();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handlePasswordChange = (e) => {
    const v = e.target.value;
    setPassword(v);

    const hasLen = v.length >= 8;
    const hasLower = /[a-z]/.test(v);
    const hasUpper = /[A-Z]/.test(v);
    const hasNum = /\d/.test(v);
    const hasSpec = /[^a-zA-Z\d]/.test(v);
    const passed = hasLen && hasLower && hasUpper && hasNum && hasSpec;

    if (!v) {
      setPasswordStrengthLabel('');
    } else if (!passed) {
      setPasswordStrengthLabel('Weak');
    } else if (v.length >= 12) {
      setPasswordStrengthLabel('Strong');
    } else if (v.length >= 10) {
      setPasswordStrengthLabel('Good');
    } else {
      setPasswordStrengthLabel('Fair');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isAllCriteriaMet) {
      toast.error("Please satisfy all password strength requirements.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsLoading(true);
    setMessage("");
    setError("");

    try {
      // POST with token in JSON body to prevent URL leakage in proxy access logs
      let response = await fetch('/api/auth/reset-password', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      // Backward compatibility fallback to path-based endpoint if body endpoint is 404
      if (response.status === 404) {
        response = await fetch(`/api/auth/reset-password/${encodeURIComponent(token)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
      }

      const data = await response.json().catch(() => ({ /* empty */ }));

      if (response.ok) {
        toast.success(data.message || "Password reset successful");
        setMessage(data.message || "Password reset successful");
        setRedirecting(true);
        setTimeout(() => router.push("/"), 2000);
      } else {
        const msg = data.error || data.message || "Unable to reset password. Please try again.";
        toast.error(msg);
        setError(msg);
      }
    } catch (_err) {
      const netMsg = "Unable to connect to the server. Please check your internet connection and try again.";
      toast.error(netMsg);
      setError(netMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans relative">
      {/* Strict referrer policy prevents reset token leakage in Referer headers */}
      <head>
        <meta name="referrer" content="strict-origin-when-cross-origin" />
      </head>
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
                        onChange={handlePasswordChange}
                        className="w-full border border-gray-300 rounded-md pl-3 pr-10 py-2 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578]"
                        required
                        autoComplete="new-password"
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
                      <p className={`text-xs mt-1 font-medium ${isAllCriteriaMet ? 'text-emerald-600' : 'text-amber-600'}`}>
                        Strength: {passwordStrengthLabel}
                      </p>
                    )}

                    {/* Granular Password Criteria Checklist */}
                    {password.length > 0 && (
                      <div className="mt-2.5 p-2.5 bg-gray-50 border border-gray-200 rounded text-xs space-y-1">
                        <div className={`flex items-center gap-1.5 ${criteria.length ? 'text-emerald-700 font-medium' : 'text-gray-500'}`}>
                          {criteria.length ? <CheckCircle2 size={13} className="text-emerald-600 flex-shrink-0" /> : <XCircle size={13} className="text-gray-400 flex-shrink-0" />}
                          <span>At least 8 characters</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${criteria.lowercase ? 'text-emerald-700 font-medium' : 'text-gray-500'}`}>
                          {criteria.lowercase ? <CheckCircle2 size={13} className="text-emerald-600 flex-shrink-0" /> : <XCircle size={13} className="text-gray-400 flex-shrink-0" />}
                          <span>At least one lowercase letter (a-z)</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${criteria.uppercase ? 'text-emerald-700 font-medium' : 'text-gray-500'}`}>
                          {criteria.uppercase ? <CheckCircle2 size={13} className="text-emerald-600 flex-shrink-0" /> : <XCircle size={13} className="text-gray-400 flex-shrink-0" />}
                          <span>At least one uppercase letter (A-Z)</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${criteria.digit ? 'text-emerald-700 font-medium' : 'text-gray-500'}`}>
                          {criteria.digit ? <CheckCircle2 size={13} className="text-emerald-600 flex-shrink-0" /> : <XCircle size={13} className="text-gray-400 flex-shrink-0" />}
                          <span>At least one digit (0-9)</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${criteria.special ? 'text-emerald-700 font-medium' : 'text-gray-500'}`}>
                          {criteria.special ? <CheckCircle2 size={13} className="text-emerald-600 flex-shrink-0" /> : <XCircle size={13} className="text-gray-400 flex-shrink-0" />}
                          <span>At least one special character (!@#$%^&amp;*...)</span>
                        </div>
                      </div>
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
                        autoComplete="new-password"
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
                      className="w-full bg-[#0b3578] text-white font-medium py-2 rounded-md text-sm hover:bg-[#0a2d66] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isLoading || redirecting || !isAllCriteriaMet || !password || !confirmPassword || password !== confirmPassword}
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