import { loadOpenCV } from './OpenCVLoader';

const TARGET_RATIO = 3 / 1; // 3:1
const MAX_BYTES = 1048576; // 1 MB
const MIN_INK_COVERAGE = 0.005; // Signature must cover at least 0.5% of the bounding box

export async function processSignature(file) {
    if (!file || !file.type.startsWith('image/')) {
        throw new Error('Invalid file type. Please upload an image.');
    }

    const cv = await loadOpenCV();

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;

            img.onload = () => {
                try {
                    // 1. Draw to canvas (Scale down to prevent OpenCV Wasm memory crash)
                    const MAX_DIM = 1200;
                    let width = img.width;
                    let height = img.height;
                    if (width > MAX_DIM || height > MAX_DIM) {
                        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
                        width = Math.round(width * ratio);
                        height = Math.round(height * ratio);
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // 2. Read into OpenCV Mat
                    let src = cv.imread(canvas);
                    let gray = new cv.Mat();
                    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

                    // 3. Adaptive Thresholding to normalize lighting/background
                    let thresh = new cv.Mat();
                    // Block size 21, constant 10. Ink becomes black (0), background white (255)
                    cv.adaptiveThreshold(gray, thresh, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 21, 10);

                    // 4. Invert to make ink white, background black (required for contour finding)
                    cv.bitwise_not(thresh, thresh);

                    // 5. Morphological closing to connect fragmented strokes
                    let kernel = cv.Mat.ones(3, 3, cv.CV_8U);
                    let morphed = new cv.Mat();
                    cv.morphologyEx(thresh, morphed, cv.MORPH_CLOSE, kernel);

                    // 6. Find contours
                    let contours = new cv.MatVector();
                    let hierarchy = new cv.Mat();
                    cv.findContours(morphed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

                    // 7. Determine bounding box of all significant ink
                    let minX = src.cols, minY = src.rows, maxX = 0, maxY = 0;
                    let foundInk = false;

                    for (let i = 0; i < contours.size(); ++i) {
                        let cnt = contours.get(i);
                        let area = cv.contourArea(cnt);
                        // Filter out tiny noise
                        if (area > 50) {
                            let rect = cv.boundingRect(cnt);
                            if (rect.x < minX) minX = rect.x;
                            if (rect.y < minY) minY = rect.y;
                            if (rect.x + rect.width > maxX) maxX = rect.x + rect.width;
                            if (rect.y + rect.height > maxY) maxY = rect.y + rect.height;
                            foundInk = true;
                        }
                    }

                    if (!foundInk) {
                        throw new Error('Signature not detected. Please upload a clear image of a signature.');
                    }

                    let inkWidth = maxX - minX;
                    let inkHeight = maxY - minY;

                    if (inkWidth < 20 || inkHeight < 20) {
                        throw new Error('Signature is too small or faint. Please retake the photo.');
                    }

                    // 8. Extract the tightly cropped signature
                    let rect = new cv.Rect(minX, minY, inkWidth, inkHeight);
                    let cropped = src.roi(rect);
                    
                    // Create an alpha-channel version by using the original cropped area
                    // and making the background transparent based on the threshold
                    let croppedThresh = thresh.roi(rect);
                    
                    // 9. Create 3:1 padded canvas
                    let paddedWidth, paddedHeight;
                    let inkRatio = inkWidth / inkHeight;

                    if (inkRatio > TARGET_RATIO) {
                        // Ink is wider than 3:1, so width dictates dimensions
                        paddedWidth = inkWidth;
                        paddedHeight = inkWidth / TARGET_RATIO;
                    } else {
                        // Ink is taller than 3:1, so height dictates dimensions
                        paddedHeight = inkHeight;
                        paddedWidth = inkHeight * TARGET_RATIO;
                    }

                    // Add a small 5% padding around the ink
                    const padding = Math.max(paddedWidth, paddedHeight) * 0.05;
                    paddedWidth += padding * 2;
                    paddedHeight += padding * 2;

                    const finalCanvas = document.createElement('canvas');
                    finalCanvas.width = paddedWidth;
                    finalCanvas.height = paddedHeight;
                    const finalCtx = finalCanvas.getContext('2d');

                    // Fill white background
                    finalCtx.fillStyle = '#ffffff';
                    finalCtx.fillRect(0, 0, paddedWidth, paddedHeight);

                    // Draw the cropped source image into the center
                    const offsetX = (paddedWidth - inkWidth) / 2;
                    const offsetY = (paddedHeight - inkHeight) / 2;
                    
                    // We need to convert the cropped OpenCV Mat back to an ImageData object to draw it
                    let imgData = new ImageData(new Uint8ClampedArray(cropped.data), cropped.cols, cropped.rows);
                    
                    // But we want to apply the threshold mask to make background truly white and remove noise
                    // A simple approach: use the original cropped pixels, but if the threshold is 0 (black ink), keep it.
                    // If threshold is 255 (white bg), set it to pure white to clean it up.
                    for (let i = 0; i < imgData.data.length; i += 4) {
                        let maskVal = croppedThresh.data[i / 4]; // 255 is ink, 0 is background
                        if (maskVal === 0) {
                            // Background -> force white
                            imgData.data[i] = 255;
                            imgData.data[i+1] = 255;
                            imgData.data[i+2] = 255;
                            imgData.data[i+3] = 255;
                        }
                    }

                    // Put cropped image on a temporary canvas, then draw to final canvas
                    let tempCanvas = document.createElement('canvas');
                    tempCanvas.width = cropped.cols;
                    tempCanvas.height = cropped.rows;
                    tempCanvas.getContext('2d').putImageData(imgData, 0, 0);

                    finalCtx.drawImage(tempCanvas, offsetX, offsetY);

                    // Cleanup OpenCV resources
                    src.delete(); gray.delete(); thresh.delete(); morphed.delete(); kernel.delete(); 
                    contours.delete(); hierarchy.delete(); cropped.delete(); croppedThresh.delete();

                    // 10. Compress to WebP <= 1MB
                    const exportWithQuality = (quality) => {
                        return new Promise((res) => {
                            finalCanvas.toBlob((blob) => res(blob), 'image/webp', quality);
                        });
                    };

                    const attemptCompression = async () => {
                        let quality = 0.9;
                        let blob = await exportWithQuality(quality);
                        
                        while (blob.size > MAX_BYTES && quality > 0.1) {
                            quality -= 0.1;
                            blob = await exportWithQuality(quality);
                        }
                        
                        if (blob.size > MAX_BYTES) {
                            return reject(new Error('Unable to compress signature under 1MB.'));
                        }

                        const newFileName = file.name.replace(/\.[^/.]+$/, "") + "_processed.webp";
                        const compressedFile = new File([blob], newFileName, {
                            type: 'image/webp',
                            lastModified: Date.now(),
                        });
                        
                        resolve(compressedFile);
                    };

                    attemptCompression().catch(reject);

                } catch (err) {
                    reject(new Error('Failed to process signature: ' + err.message));
                }
            };
            img.onerror = () => reject(new Error('Failed to load image.'));
        };
        reader.onerror = () => reject(new Error('Failed to read file.'));
    });
}
