export const MAX_PRODUCT_UPLOAD_BYTES = 50 * 1024 * 1024;
export const MAX_PRODUCT_IMAGE_BYTES = 72 * 1024;
export const MAX_PRODUCT_IMAGE_DATA_BYTES = 100 * 1024;

const encodeCanvas = (canvas, type, quality) => new Promise((resolve, reject) => {
  canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Unable to compress this image.')), type, quality);
});

const readDataUrl = blob => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Unable to read the compressed image.'));
  reader.readAsDataURL(blob);
});

export async function normalizeProductImage(file, canvasSize = 512) {
  if (!file) throw new Error('Please choose an image.');
  if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type.toLowerCase())) {
    throw new Error('Please upload a JPG, PNG or WebP image.');
  }
  if (!file.size || file.size > MAX_PRODUCT_UPLOAD_BYTES) {
    throw new Error('Please choose a nonempty image up to 50 MB.');
  }
  if (!Number.isInteger(canvasSize) || canvasSize < 128 || canvasSize > 512) {
    throw new Error('Invalid product image dimensions.');
  }

  const sourceUrl = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('This image is damaged or cannot be decoded.'));
      image.src = sourceUrl;
    });
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40_000_000) {
      throw new Error('Please choose an image up to 40 megapixels.');
    }

    const sizes = [...new Set([canvasSize, ...[448, 384, 320, 256, 192, 128].filter(size => size < canvasSize)])];
    for (const size of sizes) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Image processing is unavailable in this browser.');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight);
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);

      let format = 'image/webp';
      for (const quality of [0.9, 0.82, 0.74, 0.66]) {
        let blob = await encodeCanvas(canvas, format, quality);
        if (blob.type !== format) {
          format = 'image/jpeg';
          context.globalCompositeOperation = 'destination-over';
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, size, size);
          context.globalCompositeOperation = 'source-over';
          blob = await encodeCanvas(canvas, format, quality);
        }
        if (blob.size <= MAX_PRODUCT_IMAGE_BYTES) {
          const dataUrl = await readDataUrl(blob);
          if (dataUrl.length <= MAX_PRODUCT_IMAGE_DATA_BYTES) return dataUrl;
        }
      }
    }
    throw new Error('Unable to compress this image safely. Please choose another image.');
  } finally {
    image.onload = null;
    image.onerror = null;
    image.src = '';
    URL.revokeObjectURL(sourceUrl);
  }
}
