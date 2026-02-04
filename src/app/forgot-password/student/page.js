'use client';
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function StudentForgotPassword() {
  const [rollno, setRollno] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isEligibleForReset, setIsEligibleForReset] = useState(false);
  const [showDOBLoginMessage, setShowDOBLoginMessage] = useState(false);
  const [displayMessage, setDisplayMessage] = useState('');

  const checkStudentStatus = useCallback(async (currentRollno) => {
    if (!currentRollno) {
      setIsEligibleForReset(false);
      setShowDOBLoginMessage(false);
      setDisplayMessage('');
      return;
    }

    setIsCheckingStatus(true);
    try {
      const response = await fetch(`/api/auth/forgot-password/student?rollno=${currentRollno}`);
      const data = await response.json();

      if (response.ok) {
        if (data.is_email_verified && data.has_password_set) {
          setIsEligibleForReset(true);
          setShowDOBLoginMessage(false);
          setDisplayMessage('');
        } else {
          setIsEligibleForReset(false);
          setShowDOBLoginMessage(true);
          setDisplayMessage(
            "You haven't set a password and verified your email. Please login using your Date of Birth as password in (DD-MM-YYYY) format. If you need further assistance, contact support."
          );
        }
      } else {
        // Handle cases like student not found or server error
        setIsEligibleForReset(false);
        setShowDOBLoginMessage(false);
        setDisplayMessage(data.error || 'Unable to retrieve student status.');
        toast.error(data.error || 'An error occurred while checking status.');
      }
    } catch (error) {
      console.error("Error checking student status:", error);
      setIsEligibleForReset(false);
      setShowDOBLoginMessage(false);
      setDisplayMessage('Network error. Please try again.');
      toast.error('Network error. Please try again.');
    } finally {
      setIsCheckingStatus(false);
    }
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      checkStudentStatus(rollno);
    }, 500); // Debounce to avoid too many requests

    return () => {
      clearTimeout(handler);
    };
  }, [rollno, checkStudentStatus]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setDisplayMessage('');

    try {
      const response = await fetch('/api/auth/forgot-password/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollno }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        setDisplayMessage(data.message);
      } else {
        toast.error(data.error || 'An error occurred');
        setDisplayMessage(data.error || 'An error occurred');
        if (data.can_dob_login) {
          setShowDOBLoginMessage(true);
          setDisplayMessage(
            "Password reset not available. Please login using your Date of Birth as password. If you need further assistance, contact support."
          );
        }
      }
    } catch (error) {
      toast.error('An error occurred');
      setDisplayMessage('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Student Forgot Password</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="rollno" className="block text-gray-700 text-sm font-bold mb-2">
              Roll Number
            </label>
            <input
              type="text"
              id="rollno"
              value={rollno}
              onChange={(e) => setRollno(e.target.value.toUpperCase())}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              placeholder="Enter your roll number"
              required
              disabled={isCheckingStatus || isLoading}
            />
          </div>

          {(isCheckingStatus || rollno.length === 0) ? (
            <p className="text-sm text-gray-500 text-center mt-4">Enter your Roll Number to check eligibility...</p>
          ) : showDOBLoginMessage ? (
            <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4" role="alert">
              <p className="font-bold">Information</p>
              <p>{displayMessage}</p>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <button
                type="submit"
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                disabled={isLoading || !isEligibleForReset}
              >
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
              <Link href="/" className="inline-block align-baseline font-bold text-sm text-blue-500 hover:text-blue-800">
                Back to Login
              </Link>
            </div>
          )}
        </form>
        {displayMessage && !showDOBLoginMessage && <p className="text-green-500 text-xs italic mt-4">{displayMessage}</p>}
      </div>
    </div>
  );
}