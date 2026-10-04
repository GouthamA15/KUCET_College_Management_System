/**
 * PhotoProcessor - Processes student photos for Phase 1.
 * Ensures a strict 3:4 portrait aspect ratio (Target: 900x1200), center-cropped.
 * Compresses to WebP, maximum 1MB.
 */

const TARGET_WIDTH = 900;
const TARGET_HEIGHT = 1200;
const TARGET_RATIO = TARGET_WIDTH / TARGET_HEIGHT; // 0.75
const MAX_BYTES = 1048576; // 1 MB

export async function processPhoto(file) {
    if (!file || !file.type.startsWith('image/')) {
        throw new Error('Invalid file type. Please upload an image.');
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;

            img.onload = () => {
                const srcWidth = img.width;
                const srcHeight = img.height;
                const srcRatio = srcWidth / srcHeight;

                let cropX = 0;
                let cropY = 0;
                let cropWidth = srcWidth;
                let cropHeight = srcHeight;

                // Center crop to 3:4 aspect ratio
                if (srcRatio > TARGET_RATIO) {
                    // Source is wider than target ratio - crop width
                    cropWidth = srcHeight * TARGET_RATIO;
                    cropX = (srcWidth - cropWidth) / 2;
                } else if (srcRatio < TARGET_RATIO) {
                    // Source is taller than target ratio - crop height
                    cropHeight = srcWidth / TARGET_RATIO;
                    cropY = (srcHeight - cropHeight) / 2;
                }

                // Scale down if larger than target dimensions, but don't upscale
                let finalWidth = cropWidth;
                let finalHeight = cropHeight;
                if (finalWidth > TARGET_WIDTH) {
                    finalWidth = TARGET_WIDTH;
                    finalHeight = TARGET_HEIGHT;
                }

                const canvas = document.createElement('canvas');
                canvas.width = finalWidth;
                canvas.height = finalHeight;
                const ctx = canvas.getContext('2d');

                // Draw center-cropped image
                ctx.drawImage(
                    img,
                    cropX, cropY, cropWidth, cropHeight,
                    0, 0, finalWidth, finalHeight
                );

                const exportWithQuality = (quality) => {
                    return new Promise((res) => {
                        canvas.toBlob((blob) => res(blob), 'image/webp', quality);
                    });
                };

                const attemptCompression = async () => {
                    let quality = 0.9;
                    let blob = await exportWithQuality(quality);
                    
                    // Iteratively reduce quality if size > 1MB
                    while (blob.size > MAX_BYTES && quality > 0.1) {
                        quality -= 0.1;
                        blob = await exportWithQuality(quality);
                    }
                    
                    if (blob.size > MAX_BYTES) {
                        return reject(new Error('Unable to compress photo under 1MB. Please use a smaller image.'));
                    }

                    const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
                    const compressedFile = new File([blob], newFileName, {
                        type: 'image/webp',
                        lastModified: Date.now(),
                    });
                    
                    resolve(compressedFile);
                };

                attemptCompression().catch(reject);
            };

            img.onerror = () => reject(new Error('Failed to load image.'));
        };

        reader.onerror = () => reject(new Error('Failed to read file.'));
    });
}
