// Pictures are shrunk in the browser before they are ever uploaded: a phone
// photo is several megabytes, and the server only needs a small copy. Drawing
// the image onto a canvas at a smaller size and exporting it as JPEG does both
// the resize and the compression in one step.

async function loadImage(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('Choose a picture file (JPEG, PNG or WebP).');
  // createImageBitmap also applies the photo's EXIF rotation, so a portrait
  // photo from a phone does not come out sideways.
  if ('createImageBitmap' in window) return createImageBitmap(file, { imageOrientation: 'from-image' });
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toDataUrl(source, sx, sy, sw, sh, width, height, quality) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  // White behind any transparency, since JPEG has none.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

/** A square profile photo, cropped from the centre. About 15-30 KB. */
export async function squarePhoto(file, size = 256) {
  const img = await loadImage(file);
  const side = Math.min(img.width, img.height);
  return toDataUrl(img, (img.width - side) / 2, (img.height - side) / 2, side, side, size, size, 0.85);
}

/**
 * A high-contrast grayscale copy for OCR. Tesseract reads clean black-on-white
 * text far better than a raw phone photo, so the reading image is: scaled into
 * a band where the text is big enough (small photos are upscaled, huge ones
 * shrunk), turned grayscale, and contrast-stretched around its own midtone so
 * faint thermal-receipt ink darkens and a grey background washes out. It is
 * deliberately a soft stretch, not a hard black/white threshold, which would
 * erase light print on a crumpled receipt.
 */
function toReadingImage(img) {
  const longest = Math.max(img.width, img.height);
  // Aim for ~1600px on the long edge: upscale a small photo, shrink a big one.
  const scale = Math.min(2, Math.max(0.3, 1600 / longest));
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  try {
    const px = ctx.getImageData(0, 0, width, height);
    const d = px.data;
    // Contrast curve: push values away from mid-grey (128). ~1.5x is a strong
    // but safe boost for receipt print.
    const c = 1.5;
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      let v = (g - 128) * c + 128;
      v = v < 0 ? 0 : v > 255 ? 255 : v;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(px, 0, 0);
  } catch {
    /* getImageData can throw on a tainted canvas; the plain resized image
       still reads, just without the contrast boost. */
  }
  return canvas.toDataURL('image/jpeg', 0.95);
}

/**
 * Two copies of a receipt photo: a high-contrast grayscale one for reading the
 * text (see toReadingImage), and a smaller colour one to keep with the
 * transaction.
 */
export async function receiptPhotos(file) {
  const img = await loadImage(file);
  const scale = Math.min(1, 1000 / Math.max(img.width, img.height));
  const [sw, sh] = [Math.round(img.width * scale), Math.round(img.height * scale)];
  return {
    forReading: toReadingImage(img),
    forStoring: toDataUrl(img, 0, 0, img.width, img.height, sw, sh, 0.7),
  };
}
