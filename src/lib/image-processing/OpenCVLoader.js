/**
 * Utility to dynamically load OpenCV.js in the browser.
 */

let cvLoadingPromise = null;

export async function loadOpenCV() {
    if (window.cv && window.cv.Mat) {
        return window.cv;
    }

    if (cvLoadingPromise) {
        return cvLoadingPromise;
    }

    cvLoadingPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        // Load official OpenCV.js (v4.8.0)
        script.src = 'https://docs.opencv.org/4.8.0/opencv.js';
        script.async = true;
        
        script.onload = () => {
            // OpenCV.js uses a callback when WASM is fully initialized
            if (window.cv.getBuildInformation) {
                resolve(window.cv);
            } else {
                window.cv['onRuntimeInitialized'] = () => {
                    resolve(window.cv);
                };
            }
        };
        
        script.onerror = () => {
            cvLoadingPromise = null;
            reject(new Error('Failed to load OpenCV.js'));
        };

        document.body.appendChild(script);
    });

    return cvLoadingPromise;
}
