/**
 * Compresses an image file in the browser using the HTML5 Canvas API.
 * Reduces the size of large uploads (e.g. from mobile phones) to save storage costs.
 * 
 * @param {File} file - The original image file
 * @param {number} maxWidth - Maximum width of the compressed image
 * @param {number} maxHeight - Maximum height of the compressed image
 * @param {number} quality - Compression quality (0 to 1, where 1 is highest)
 * @returns {Promise<File>} - A promise that resolves to the compressed File object
 */
export async function compressImage(file, maxWidth = 1200, maxHeight = 1200, quality = 0.6) {
    if (!file || !file.type.startsWith('image/')) {
        return file; // Return original if not an image
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Calculate the new dimensions while maintaining aspect ratio
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                
                // Draw the image onto the canvas with new dimensions
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert to webp to save space, fallback to jpeg if webp isn't supported
                const outputType = 'image/webp';
                
                canvas.toBlob((blob) => {
                    if (!blob) {
                        return reject(new Error('Canvas to Blob conversion failed'));
                    }
                    
                    // Keep the original name but change extension
                    const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
                    const compressedFile = new File([blob], newFileName, {
                        type: outputType,
                        lastModified: Date.now(),
                    });
                    
                    resolve(compressedFile);
                }, outputType, quality);
            };
            
            img.onerror = (error) => reject(error);
        };
        
        reader.onerror = (error) => reject(error);
    });
}
