'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function useEmailVerification({ rollno, newEmail, setEmail, originalEmail, isPasswordSet, openSetPasswordModal, refreshData }) {
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSendOtp = async () => {
    if (newEmail && newEmail !== originalEmail) {
      // client-side uniqueness check
      try {
        const uniquenessRes = await fetch(`/api/student/check-email-uniqueness?email=${encodeURIComponent(newEmail)}&currentRollno=${rollno}`);
        const uniquenessData = await uniquenessRes.json();
        if (!uniquenessData.isUnique) {
          toast.error(uniquenessData.message || 'This email is already in use.');
          return;
        }
      } catch (e) {
        // ignore, server will validate
      }
    }

    setIsVerifying(true);
    try {
      const res = await fetch('/api/student/send-update-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollno, email: newEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setIsOtpSent(true);
      } else {
        toast.error(data.message || 'Failed to send OTP.');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyOtp = async () => {
    setIsVerifying(true);
    try {
      const res = await fetch('/api/student/verify-update-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollno, otp, email: newEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        if (!isPasswordSet && openSetPasswordModal) {
          openSetPasswordModal(true);
        } else {
          setIsOtpVerified(true);
          setEmail(newEmail);
          refreshData && refreshData();
        }
      } else {
        toast.error(data.message || 'OTP verification failed.');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  return {
    otp,
    setOtp,
    isOtpSent,
    isOtpVerified,
    isVerifying,
    handleSendOtp,
    handleVerifyOtp,
  };
}
