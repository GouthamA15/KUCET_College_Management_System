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
            try {
                if (window.cv && window.cv.getBuildInformation) {
                    resolve(window.cv);
                } else if (window.cv) {
                    window.cv['onRuntimeInitialized'] = () => {
                        resolve(window.cv);
                    };
                } else {
                    // Try polling for a few seconds if it's injected differently
                    let attempts = 0;
                    const interval = setInterval(() => {
                        if (window.cv && window.cv.Mat) {
                            clearInterval(interval);
                            resolve(window.cv);
                        }
                        if (++attempts > 50) {
                            clearInterval(interval);
                            reject(new Error('OpenCV object not found on window'));
                        }
                    }, 100);
                }
            } catch (e) {
                reject(e);
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
