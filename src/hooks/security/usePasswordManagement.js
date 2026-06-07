import { useState, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getPasswordRequirements, getPasswordStrength, generateStrongPassword } from '@/lib/security';

export function usePasswordManagement({ role, roll_no, isPasswordSet, onSuccess }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const requirements = useMemo(() => getPasswordRequirements(newPassword), [newPassword]);
  const pwStrength = useMemo(() => getPasswordStrength(newPassword, requirements), [newPassword, requirements]);

  const generatePassword = useCallback(() => {
    const pw = generateStrongPassword();
    setNewPassword(pw);
    setConfirmPassword(pw);
    toast.success('Strong password generated!');
  }, []);

  const handleSavePassword = async () => {
    if (role === 'clerk') {
      if (!currentPassword || !newPassword || !confirmPassword) {
        toast.error('Please fill all password fields');
        return;
      }
      if (currentPassword === newPassword) {
        toast.error('New password must be different from the current password');
        return;
      }
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    setPwSaving(true);
    try {
      const url = role === 'clerk' ? '/api/auth/change-password/clerk' : '/api/student/set-password';
      const body = role === 'clerk' 
        ? { oldPassword: currentPassword, newPassword }
        : { rollno: roll_no, password: newPassword, currentPassword: isPasswordSet ? currentPassword : null };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (res.ok) {
        toast.success(role === 'clerk' ? 'Password updated successfully.' : (isPasswordSet ? 'Password updated.' : 'Password set successfully.'));
        setNewPassword('');
        setConfirmPassword('');
        setCurrentPassword('');
        if (onSuccess) onSuccess();
        return true;
      } else {
        const data = await res.json();
        toast.error(data.error || data.message || 'Failed to update password');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setPwSaving(false);
    }
    return false;
  };

  return {
    currentPassword, setCurrentPassword,
    newPassword, setNewPassword,
    confirmPassword, setConfirmPassword,
    pwSaving,
    requirements,
    pwStrength,
    generatePassword,
    onSavePassword: handleSavePassword
  };
}
