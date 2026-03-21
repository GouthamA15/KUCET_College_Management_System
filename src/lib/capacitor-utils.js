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

    // 2. Write to local filesystem
    // On Android, Directory.Documents usually maps to the app's private folder or a visible Documents folder.
    // To save directly to the "Downloads" folder, we use Directory.ExternalStorage and the "Download" path.
    // However, Directory.Documents is generally safer for FileOpener to access across all platforms.
    // For true "Download" folder behavior on Android, we'll try Directory.ExternalStorage.
    
    let directory = Directory.Documents;
    let path = filename;

    if (Capacitor.getPlatform() === 'android') {
      // On modern Android (10+), we use Directory.Documents which is user-visible.
      // If the user specifically wants the "Download" folder:
      directory = Directory.Documents; 
    }

    const result = await Filesystem.writeFile({
      path: path,
      data: base64Data,
      directory: directory,
      recursive: true
    });

    // 3. Open the file with the native app
    await FileOpener.open({
      filePath: result.uri,
      contentType: contentType
    });

    // On Android, we can also use a "Media" scan or a specific intent to make it show up in Downloads,
    // but usually Filesystem.writeFile to Directory.Documents is the standard Capacitor way.
    // To ensure it stays in the Download folder specifically:
    if (Capacitor.getPlatform() === 'android') {
       try {
         // Attempt to save to ExternalStorage/Download which is the standard user-facing folder
         await Filesystem.writeFile({
           path: `Download/${filename}`,
           data: base64Data,
           directory: Directory.ExternalStorage,
         });
       } catch (e) {
         console.warn('Failed to save specifically to Download folder, fallback to Documents used.', e);
       }
    }

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
