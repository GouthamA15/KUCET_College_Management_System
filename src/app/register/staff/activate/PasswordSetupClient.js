'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Eye, EyeOff } from 'lucide-react';

export default function PasswordSetupClient({ token, staffDetailsNode }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const calculateStrength = (pwd) => {
    let strength = 0;
    if (pwd.length >= 8) strength += 25;
    if (/[A-Z]/.test(pwd)) strength += 25;
    if (/[a-z]/.test(pwd)) strength += 25;
    if (/[0-9]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) strength += 25;
    return strength;
  };

  const strength = calculateStrength(password);
  const strengthColor = 
    strength <= 25 ? 'bg-red-500' :
    strength === 50 ? 'bg-orange-500' :
    strength === 75 ? 'bg-yellow-500' :
    'bg-green-500';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (strength < 100) {
      setError('Password does not meet all requirements.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/public/staff-registration/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to activate account.');
      }

      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-slate-200 text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
          <CheckCircle2 className="h-6 w-6 text-green-600" />
        </div>
        <h3 className="text-lg font-medium text-slate-900 mb-2">Account Activated Successfully!</h3>
        <p className="text-sm text-slate-500 mb-6">Your staff account is now ready to use.</p>
        <button
          onClick={() => router.push('/?login=true')}
          className="w-full max-w-sm mx-auto flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#0b3578] hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0b3578] cursor-pointer"
        >
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
      {/* Instructions (Left on Desktop, Bottom on Mobile) */}
      <div className="order-2 md:order-1 bg-white p-6 shadow sm:rounded-lg border border-slate-200">
        <h3 className="text-lg font-medium text-slate-900 mb-4">Password Requirements</h3>
        <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600">
          <li className={password.length >= 8 ? "text-green-600 font-medium transition-colors" : "transition-colors"}>Minimum 8 characters long</li>
          <li className={/[A-Z]/.test(password) ? "text-green-600 font-medium transition-colors" : "transition-colors"}>At least one uppercase letter (A-Z)</li>
          <li className={/[a-z]/.test(password) ? "text-green-600 font-medium transition-colors" : "transition-colors"}>At least one lowercase letter (a-z)</li>
          <li className={/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password) ? "text-green-600 font-medium transition-colors" : "transition-colors"}>At least one number (0-9) or special character</li>
        </ul>
      </div>

      {/* Form Setup Box (Right on Desktop, Top on Mobile) */}
      <div className="order-1 md:order-2 bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-slate-200">
        {staffDetailsNode}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700">New Password <span className="text-red-500">*</span></label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <input
                type={showPasswords ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-3 py-2 pr-10 border border-slate-300 rounded-md focus:outline-none focus:ring-[#0b3578] focus:border-[#0b3578] sm:text-sm"
                required
                placeholder="Enter strong password"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-slate-400 hover:text-slate-600 focus:outline-none"
                onClick={() => setShowPasswords(!showPasswords)}
                tabIndex="-1"
              >
                {showPasswords ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
            {/* Password Strength Meter */}
            {password.length > 0 && (
              <div className="mt-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-slate-500 font-medium">Password strength</span>
                  <span className={`text-xs font-semibold ${
                    strength <= 25 ? 'text-red-500' :
                    strength === 50 ? 'text-orange-500' :
                    strength === 75 ? 'text-yellow-500' : 'text-green-500'
                  }`}>
                    {strength <= 25 ? 'Weak' : strength === 50 ? 'Fair' : strength === 75 ? 'Good' : 'Strong'}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className={`h-1.5 rounded-full transition-all duration-300 ${strengthColor}`} 
                    style={{ width: `${strength}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Confirm Password <span className="text-red-500">*</span></label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <input
                type={showPasswords ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full px-3 py-2 pr-10 border border-slate-300 rounded-md focus:outline-none focus:ring-[#0b3578] focus:border-[#0b3578] sm:text-sm"
                required
                placeholder="Re-enter your password"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-slate-400 hover:text-slate-600 focus:outline-none"
                onClick={() => setShowPasswords(!showPasswords)}
                tabIndex="-1"
              >
                {showPasswords ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || strength < 100 || !confirmPassword || password !== confirmPassword}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#0b3578] hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0b3578] disabled:opacity-50 cursor-pointer transition-colors"
          >
            {loading ? 'Activating...' : 'Set Password & Activate'}
          </button>
        </form>
      </div>
    </div>
  );
}
