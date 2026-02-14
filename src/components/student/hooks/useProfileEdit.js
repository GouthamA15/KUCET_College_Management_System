'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import useProfileImage from './useProfileImage';

export default function useProfileEdit(studentData = null, refreshData = () => {}) {
  const [isEditing, setIsEditing] = useState(false);
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [originalMobile, setOriginalMobile] = useState('');
  const [originalEmail, setOriginalEmail] = useState('');
  const [originalAddress, setOriginalAddress] = useState('');
  const [photoChanged, setPhotoChanged] = useState(false);
  const [photoProcessing, setPhotoProcessing] = useState(false);

  const profileImage = useProfileImage(studentData?.student?.pfp || null);

  useEffect(() => {
    if (studentData) {
      setMobile(studentData.student.mobile || '');
      setEmail(studentData.student.email || '');
      setAddress(studentData.student.personal_details?.address || '');
      setOriginalMobile(studentData.student.mobile || '');
      setOriginalEmail(studentData.student.email || '');
      setOriginalAddress(studentData.student.personal_details?.address || '');
    }
  }, [studentData]);

  const sanitizeDigits = (val, maxLen = 12) => {
    if (val == null) return '';
    return String(val).replace(/\D/g, '').slice(0, maxLen);
  };

  const handleSave = async (rollno) => {
    if (profileImage.previewPhoto && !photoChanged) setPhotoChanged(true);
    if (profileImage.previewPhoto && photoChanged) {
      setPhotoProcessing(true);
      try {
        const response = await fetch('/api/student/upload-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roll_no: rollno, pfp: profileImage.previewPhoto }),
        });
        const result = await response.json();
        if (!response.ok) {
          toast.error(result.message || 'Photo update failed. Try again.');
          setPhotoProcessing(false);
          return false;
        }
        profileImage.setPreviewPhoto(null);
        setPhotoChanged(false);
      } catch (e) {
        toast.error('Network error. Please try again.');
        setPhotoProcessing(false);
        return false;
      } finally {
        setPhotoProcessing(false);
      }
    }

    try {
      const response = await fetch('/api/student/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollno, phone: sanitizeDigits(mobile, 12), address }),
      });
      const result = await response.json();
      if (response.ok) {
        toast.success('Profile updated successfully!');
        setIsEditing(false);
        setOriginalMobile(sanitizeDigits(mobile, 12));
        setOriginalAddress(address);
        setOriginalEmail(email);
        setPhotoChanged(false);
        refreshData();
        return true;
      } else {
        toast.error(result.error || 'Failed to update profile.');
        return false;
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
      return false;
    }
  };

  return {
    isEditing,
    setIsEditing,
    mobile,
    setMobile,
    email,
    setEmail,
    address,
    setAddress,
    originalMobile,
    originalEmail,
    originalAddress,
    sanitizeDigits,
    handleSave,
    photoChanged,
    setPhotoChanged,
    photoProcessing,
    profileImage,
  };
}
