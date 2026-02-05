"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

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
        const res = await fetch(`/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));

        // Expect backend to return explicit status: VALID | EXPIRED | USED | INVALID
        const status = data.status || (res.ok ? 'VALID' : 'INVALID');
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

    // Server-side will enforce password policy; allow form submission once both fields are filled and match.

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
        // show redirecting state on the button
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
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Header />

      <main className="flex-1 bg-gray-100 pt-6 pb-2 flex items-center justify-center overflow-hidden">
        <div className="max-w-2xl mx-auto px-4 w-full">
          <div className="bg-white border border-gray-200 rounded-sm p-6">
            <h1 className="text-2xl font-semibold text-[#0b3578] mb-2">Reset Password</h1>
            <p className="text-sm text-gray-600 mb-6">
              Please choose a new password for your account. This operation is sensitive — ensure your new
              password is secure.
            </p>

            {tokenStatus === 'loading' && (
              <div className="py-12 text-center text-gray-600">Validating reset link...</div>
            )}

            {tokenStatus === 'VALID' && (
              <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-800 mb-1">
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
                      // quick strength heuristic
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
                    className="w-full border border-gray-300 rounded-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#0b3578]"
                    required
                    aria-describedby="pwd-requirements"
                  />
                  <button
                    type="button"
                    aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                    onClick={() => setPasswordVisible((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {passwordVisible ? 'Hide' : 'Show'}
                  </button>
                </div>

                <p id="pwd-requirements" className="text-xs text-gray-600 mt-2">
                  Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.
                </p>
                {passwordStrengthLabel && (
                  <p className={`mt-1 text-sm ${passwordValid ? 'text-green-700' : 'text-yellow-700'}`}>Strength: {passwordStrengthLabel}</p>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-800 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={confirmVisible ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full border border-gray-300 rounded-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#0b3578]"
                    required
                  />
                  <button
                    type="button"
                    aria-label={confirmVisible ? 'Hide password' : 'Show password'}
                    onClick={() => setConfirmVisible((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {confirmVisible ? 'Hide' : 'Show'}
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-red-600 text-sm mt-1">Passwords do not match</p>
                )}
              </div>

                <div>
                  <button
                    type="submit"
                    className="w-full bg-[#0b3578] text-white font-semibold py-2 px-4 rounded-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#0b3578] disabled:opacity-60"
                    disabled={isLoading || redirecting || !password || !confirmPassword || password !== confirmPassword}
                  >
                    {redirecting ? 'Redirecting to Home...' : (isLoading ? 'Resetting...' : 'Reset Password')}
                  </button>
                </div>

                <div className="text-center">
                  <Link href="/" className="text-sm text-[#0b3578] hover:underline">
                    Back to Login
                  </Link>
                </div>
              </form>
            )}

            {tokenStatus !== 'loading' && tokenStatus !== 'VALID' && (
              <div className="p-6 text-center">
                <h2 className="text-xl font-semibold text-red-700">
                  {tokenStatus === 'EXPIRED' ? 'Reset link has expired' : tokenStatus === 'USED' ? 'Reset link already used' : 'Invalid reset link'}
                </h2>
                <p className="mt-2 text-sm text-gray-700">{tokenMessage || 'Please request a new reset link.'}</p>
                <div className="mt-4">
                  <Link href="/" className="inline-block bg-[#0b3578] text-white px-4 py-2 rounded-sm hover:opacity-95">Go back to Home</Link>
                </div>
              </div>
            )}

            {message && <p className="text-green-700 text-sm mt-4">{message}</p>}
            {error && <p className="text-red-700 text-sm mt-4">{error}</p>}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
