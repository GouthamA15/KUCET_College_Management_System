import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';

export function useEmailVerification(roll_no, initialEmail, onVerified) {
  const [emailInput, setEmailInput] = useState(initialEmail || '');
  const [otpInput, setOtpInput] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [emailEditing, setEmailEditing] = useState(false);

  const handleSendOtp = useCallback(async () => {
    if (!emailInput || !roll_no) return;
    setEmailSending(true);
    try {
      const res = await fetch('/api/student/send-update-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollno: roll_no, email: emailInput })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('OTP sent to your email.');
        setOtpSent(true);
      } else {
        toast.error(data.message || 'Failed to send OTP');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setEmailSending(false);
    }
  }, [emailInput, roll_no]);

  const handleVerifyOtp = useCallback(async () => {
    if (!otpInput || !roll_no) return;
    setOtpVerifying(true);
    try {
      const res = await fetch('/api/student/verify-update-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollno: roll_no, otp: otpInput, email: emailInput })
      });
      if (res.ok) {
        toast.success('Email verified successfully.');
        if (onVerified) await onVerified();
        setOtpSent(false);
        setEmailEditing(false);
        setOtpInput('');
      } else {
        const data = await res.json();
        toast.error(data.message || 'Verification failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setOtpVerifying(false);
    }
  }, [otpInput, roll_no, emailInput, onVerified]);

  return {
    emailInput, setEmailInput,
    otpInput, setOtpInput,
    emailSending, otpVerifying,
    otpSent, setOtpSent,
    emailEditing, setEmailEditing,
    handleSendOtp,
    handleVerifyOtp
  };
}
