// Canvas helpers for turning a react-easy-crop crop selection into an
// uploadable File. The image is decoded exactly once (loadImageElement)
// and the resulting HTMLImageElement is reused for every subsequent draw
// — repeatedly re-fetching/re-decoding the same blob: URL on every crop
// interaction tick overwhelmed mobile devices and caused later loads of
// the same blob: URL to fail outright.
const OUTPUT_SIZE = 512;

export function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    // NOTE: no `img.crossOrigin` here. `src` is always a local blob: URL
    // (created via URL.createObjectURL), never a remote URL — forcing
    // CORS mode on a blob: URL breaks image loading on several mobile
    // browsers (Chrome/Samsung Internet in particular).
    img.onload = async () => {
      // The 'load' event can fire before the bitmap is fully decoded on
      // some mobile browsers. decode() guarantees it's ready to draw.
      if (typeof img.decode === 'function') {
        try {
          await img.decode();
        } catch {
          // 'load' already fired successfully — some mobile browsers
          // reject decode() anyway (e.g. certain iOS builds). Fall
          // through and use the image as-is.
        }
      }
      if (!img.naturalWidth || !img.naturalHeight) {
        reject(new Error('The selected image could not be read on this device. Please try a different photo.'));
        return;
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

  // toBlob() can silently resolve null on some mobile browsers. Fall back
  // to the more widely supported toDataURL() and convert it ourselves.
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

// `image` must be an already-loaded HTMLImageElement (see loadImageElement
// above) — these two functions do no network/decoding work of their own,
// they only draw from a bitmap that's already ready.
export async function getCroppedImageFile(image, croppedAreaPixels, fileName) {
  try {
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

export async function getCroppedPreviewDataUrl(image, croppedAreaPixels, size = 96) {
  try {
    const canvas = drawCrop(image, croppedAreaPixels, size);
    return canvas.toDataURL('image/png');
  } catch (err) {
    throw err instanceof Error && err.message
      ? err
      : new Error('Could not generate the crop preview.');
  }
}
