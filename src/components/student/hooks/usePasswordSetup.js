'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function usePasswordSetup(rollno) {
  const [isPasswordSet, setIsPasswordSet] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);

  const checkPasswordStatus = async () => {
    try {
      const passRes = await fetch(`/api/student/set-password?rollno=${rollno}`);
      if (passRes.ok) {
        const passData = await passRes.json();
        setIsPasswordSet(passData.isPasswordSet);
      }
    } catch (e) {
      console.error('Error checking password status', e);
    }
  };

  useEffect(() => { if (rollno) checkPasswordStatus(); }, [rollno]);

  const handlePasswordSave = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return false;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return false;
    }
    setPasswordSaving(true);
    try {
      const res = await fetch('/api/student/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollno, password: newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Password set successfully! Please use this for future logins.');
        setIsPasswordSet(true);
        setNewPassword('');
        setConfirmPassword('');
        setShowSetPasswordModal(false);
        return true;
      } else {
        toast.error(data.error || 'Failed to set password');
        return false;
      }
    } catch (e) {
      toast.error('Network error');
      return false;
    } finally {
      setPasswordSaving(false);
    }
  };

  return {
    isPasswordSet,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    passwordSaving,
    showSetPasswordModal,
    setShowSetPasswordModal,
    handlePasswordSave,
    checkPasswordStatus,
  };
}
