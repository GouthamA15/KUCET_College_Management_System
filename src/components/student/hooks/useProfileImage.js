'use client';
import { useState, useRef } from 'react';
import toast from 'react-hot-toast';

export default function useProfileImage(initialSrc = null) {
  const [imageLoading, setImageLoading] = useState(true);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [imagePreviewSrc, setImagePreviewSrc] = useState(null);
  const fileInputRef = useRef(null);

  const handlePhotoChange = (e) => {
    const file = e?.target?.files?.[0];
    if (file) {
      if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
        toast.error('Only JPG, JPEG, and PNG files are allowed.');
        return;
      }
      if (file.size > 4 * 1024 * 1024) {
        toast.error('File size must be less than 4MB.');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setPreviewPhoto(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return {
    imageLoading,
    setImageLoading,
    previewPhoto,
    setPreviewPhoto,
    imagePreviewOpen,
    setImagePreviewOpen,
    imagePreviewSrc,
    setImagePreviewSrc,
    fileInputRef,
    handlePhotoChange,
  };
}
