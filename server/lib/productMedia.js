export function isImageUrl(src) {
  if (!src || typeof src !== 'string') return false;
  return src.startsWith('/') || src.startsWith('http://') || src.startsWith('https://');
}

export function normalizeProductImages(images) {
  if (!Array.isArray(images)) return [];
  return images.filter((x) => typeof x === 'string' && x.trim());
}
