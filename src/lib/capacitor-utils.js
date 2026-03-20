import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';

/**
 * Detects if the app is running on a native platform (iOS/Android) via Capacitor.
 */
export const isCapacitor = () => {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform();
};

/**
 * Downloads a Blob to the local device filesystem and opens it using the native file opener.
 * @param {Blob} blob - The file content as a Blob.
 * @param {string} filename - The name to save the file as.
 * @param {string} contentType - The MIME type of the file.
 */
export const downloadToDevice = async (blob, filename, contentType = 'application/pdf') => {
  if (!isCapacitor()) return false;

  try {
    // 1. Convert blob to base64
    const base64Data = await blobToBase64(blob);

    // 2. Write to local filesystem (Documents directory is accessible to FileOpener)
    const result = await Filesystem.writeFile({
      path: filename,
      data: base64Data,
      directory: Directory.Documents,
      recursive: true
    });

    // 3. Open the file with the native app
    await FileOpener.open({
      filePath: result.uri,
      contentType: contentType
    });

    return true;
  } catch (error) {
    console.error('Capacitor download error:', error);
    throw error;
  }
};

/**
 * Helper: Converts a Blob to a Base64 string.
 */
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result.split(',')[1]); // Extract only the base64 part
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};
