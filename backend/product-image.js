const MAX_IMAGE_BYTES = 72 * 1024;
const MAX_DATA_URL_BYTES = 100 * 1024;

export function validateProductImage(value) {
  if (value === null || value === undefined || value === '') return value;
  if (typeof value !== 'string') throw new Error('Invalid product image.');
  if (Buffer.byteLength(value, 'utf8') > MAX_DATA_URL_BYTES) {
    throw new Error('Product image is too large. Upload it again to compress it.');
  }
  if (!value.startsWith('data:')) return value;
  const match = value.match(/^data:image\/(webp|jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) throw new Error('Product image must be a compressed JPG, PNG or WebP image.');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES || bytes.toString('base64') !== match[2]) {
    throw new Error('Product image is invalid or too large. Upload it again to compress it.');
  }
  const valid = match[1] === 'webp'
    ? bytes.length >= 20 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
    : match[1] === 'png'
      ? bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!valid) throw new Error('Invalid product image content. Please upload another image.');
  return value;
}
