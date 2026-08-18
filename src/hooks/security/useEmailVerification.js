import { useState, useCallback, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

export function useEmailVerification(identifier, initialEmail, onVerified, role = 'student') {
  const [emailInput, setEmailInput] = useState(initialEmail || '');
  const [otpInput, setOtpInput] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [emailEditing, setEmailEditing] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const timerRef = useRef(null);

  const [prevInitialEmail, setPrevInitialEmail] = useState(initialEmail);
  if (initialEmail !== prevInitialEmail) {
    setPrevInitialEmail(initialEmail);
    if (!emailEditing) {
      setEmailInput(initialEmail);
    }
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startCountdown = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setResendCountdown(60);
    timerRef.current = setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput || '');

  const handleSendOtp = useCallback(async () => {
    if (!emailInput || !identifier || resendCountdown > 0) return;

    if (!isEmailValid) {
      toast.error('Please enter a valid email address.');
      return;
    }

    setEmailSending(true);
    try {
      const url = role === 'student' ? '/api/student/send-update-email-otp' : '/api/staff/send-update-email-otp';
      const payload = role === 'student' 
        ? { rollno: identifier, email: emailInput } 
        : { id: identifier, email: emailInput };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('OTP sent to your email.');
        setOtpSent(true);
        startCountdown();
      } else {
        toast.error(data.error || data.message || 'Failed to send OTP');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setEmailSending(false);
    }
  }, [emailInput, identifier, resendCountdown, startCountdown, isEmailValid, role]);

  const handleVerifyOtp = useCallback(async () => {
    if (!otpInput || !identifier) return;
    setOtpVerifying(true);
    try {
      const url = role === 'student' ? '/api/student/verify-update-email-otp' : '/api/staff/verify-update-email-otp';
      const payload = role === 'student' 
        ? { rollno: identifier, otp: otpInput, email: emailInput }
        : { id: identifier, otp: otpInput, email: emailInput };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        toast.success('Email verified successfully.');
        if (onVerified) await onVerified();
        setOtpSent(false);
        setEmailEditing(false);
        setOtpInput('');
      } else {
        const data = await res.json();
        toast.error(data.error || data.message || 'Verification failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setOtpVerifying(false);
    }
  }, [otpInput, identifier, emailInput, onVerified, role]);

  return {
    emailInput, setEmailInput,
    otpInput, setOtpInput,
    emailSending, otpVerifying,
    otpSent, setOtpSent,
    emailEditing, setEmailEditing,
    resendCountdown,
    isEmailValid,
    handleSendOtp,
    handleVerifyOtp
  };
}
