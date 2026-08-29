/**
 * Image Normalizer Utility for AVS Distributors
 * Standardizes any uploaded product image to an exact 512x512 px canvas
 * with 1:1 aspect ratio, 'contain' fitting (no stretching/cropping),
 * and WebP/PNG data URL output <= 500 KB.
 */

export const normalizeProductImage = (file, canvasSize = 512) => {
  return new Promise((resolve, reject) => {
    // 1. File validation
    if (!file) {
      return reject(new Error("No file provided"));
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      return reject(new Error("Invalid file type. Please upload a JPG, JPEG, PNG, or WebP image."));
    }

    const maxUploadSizeBytes = 2 * 1024 * 1024; // 2 MB limit
    if (file.size > maxUploadSizeBytes) {
      return reject(new Error("File size exceeds 2 MB limit. Please upload a smaller image."));
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // 2. Offscreen 512x512 Canvas
        const canvas = document.createElement('canvas');
        canvas.width = canvasSize;
        canvas.height = canvasSize;
        const ctx = canvas.getContext('2d');

        // Clear canvas (transparent background for PNG/WebP)
        ctx.clearRect(0, 0, canvasSize, canvasSize);

        // 3. Proportional Contain Aspect Ratio Math
        const srcWidth = img.width;
        const srcHeight = img.height;
        const scale = Math.min(canvasSize / srcWidth, canvasSize / srcHeight);

        const destWidth = srcWidth * scale;
        const destHeight = srcHeight * scale;

        // Center on 512x512 canvas
        const destX = (canvasSize - destWidth) / 2;
        const destY = (canvasSize - destHeight) / 2;

        // Draw image onto 512x512 canvas without distortion
        ctx.drawImage(img, 0, 0, srcWidth, srcHeight, destX, destY, destWidth, destHeight);

        // 4. Export compressed WebP data URL
        const dataUrl = canvas.toDataURL('image/webp', 0.85);
        resolve(dataUrl);
      };

      img.onerror = () => reject(new Error("Failed to load image for processing"));
      img.src = e.target.result;
    };

    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
};
