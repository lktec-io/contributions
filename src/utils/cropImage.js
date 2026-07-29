// Canvas helper for turning a react-easy-crop crop selection into an
// uploadable File — output is a fixed 512x512 square, matching the
// Cloudinary transformation already applied server-side.
const OUTPUT_SIZE = 512;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    // NOTE: no `img.crossOrigin` here. `src` is always a local blob: URL
    // (created via URL.createObjectURL in Settings.jsx), never a remote
    // URL. Setting crossOrigin on a blob: URL forces several mobile
    // browsers (Chrome/Samsung Internet in particular) to treat it as a
    // CORS request, which a blob: URL can never satisfy — the image then
    // fails to decode properly, producing a blank/black canvas and a
    // tainted-canvas error out of toBlob().
    img.onload = async () => {
      // The 'load' event can fire before the bitmap is fully decoded on
      // some mobile browsers, which is what produces a black crop area.
      // decode() guarantees the image is fully ready to be drawn.
      if (typeof img.decode === 'function') {
        try {
          await img.decode();
        } catch {
          // Some mobile browsers reject decode() even though 'load'
          // already fired successfully (e.g. certain iOS Safari builds
          // with camera-originated blobs). The image is still usable —
          // fall through and resolve with what we have.
        }
      }
      resolve(img);
    };

    img.onerror = () => reject(new Error('Could not load the selected image. Please try a different photo.'));
    img.src = src;
  });
}

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = /data:(.*?);base64/.exec(header || '');
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function canvasToBlob(canvas, mime, quality) {
  let blob = null;
  try {
    blob = await new Promise(resolve => canvas.toBlob(resolve, mime, quality));
  } catch {
    blob = null;
  }
  if (blob) return blob;

  // toBlob() can silently resolve null on some mobile browsers (low
  // memory, unsupported codec path, etc). Fall back to the more widely
  // supported toDataURL() and convert that to a Blob ourselves.
  const dataUrl = canvas.toDataURL(mime, quality);
  return dataUrlToBlob(dataUrl);
}

function drawCrop(image, croppedAreaPixels, outSize) {
  const canvas = document.createElement('canvas');
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('This device could not process the image. Please try a different browser.');
  }

  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    outSize,
    outSize,
  );

  return canvas;
}

export async function getCroppedImageFile(imageSrc, croppedAreaPixels, fileName) {
  try {
    const image = await loadImage(imageSrc);
    const canvas = drawCrop(image, croppedAreaPixels, OUTPUT_SIZE);
    const blob = await canvasToBlob(canvas, 'image/png', 0.92);
    if (!blob) {
      throw new Error('Could not process the cropped image on this device. Please try a different photo.');
    }
    return new File([blob], fileName, { type: 'image/png' });
  } catch (err) {
    throw err instanceof Error && err.message
      ? err
      : new Error('Could not crop the image. Please try again.');
  }
}

export async function getCroppedPreviewDataUrl(imageSrc, croppedAreaPixels, size = 96) {
  try {
    const image = await loadImage(imageSrc);
    const canvas = drawCrop(image, croppedAreaPixels, size);
    return canvas.toDataURL('image/png');
  } catch (err) {
    throw err instanceof Error && err.message
      ? err
      : new Error('Could not generate the crop preview.');
  }
}
