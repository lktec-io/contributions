// Production-grade image preprocessing pipeline for the branding logo
// cropper. Loading and canvas encoding each try the most modern browser
// API first and fall back automatically — no single strategy is assumed
// to work on every mobile engine (Android Chrome, Samsung Internet,
// Safari iOS, Firefox Mobile, Edge Mobile all differ).
const OUTPUT_SIZE = 512;

const LOG = '[crop-debug]';

// ── Stage 1: decode the source file into something drawImage() accepts ──
// Returns { source, width, height, release } where `source` is either an
// ImageBitmap or an HTMLImageElement — both are valid CanvasImageSource,
// so nothing downstream needs to know which one it got.

async function viaImageBitmap(file) {
  if (typeof createImageBitmap !== 'function') {
    throw new Error('createImageBitmap is not supported on this browser');
  }
  // No resize options here on purpose: react-easy-crop computes
  // croppedAreaPixels against the *original* natural dimensions (it
  // decodes the same file independently via its own <img>). If we asked
  // createImageBitmap to downscale, our coordinate space would no longer
  // match Cropper's and every crop would land in the wrong place.
  const bitmap = await createImageBitmap(file);
  if (!bitmap.width || !bitmap.height) {
    bitmap.close();
    throw new Error('createImageBitmap produced a zero-size bitmap');
  }
  return {
    source: bitmap,
    width: bitmap.width,
    height: bitmap.height,
    release: () => { try { bitmap.close(); } catch { /* already closed */ } },
  };
}

function viaImageElement(objectUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    // No `img.crossOrigin` — `objectUrl` is always a local blob: URL.
    // Forcing CORS mode on a blob: URL breaks loading on several mobile
    // browsers.
    img.onload = async () => {
      if (typeof img.decode === 'function') {
        try {
          await img.decode();
        } catch {
          // 'load' already fired successfully — some mobile browsers
          // reject decode() anyway. The image is still usable.
        }
      }
      if (!img.naturalWidth || !img.naturalHeight) {
        reject(new Error('the browser decoded a zero-size image'));
        return;
      }
      resolve({
        source: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        release: () => { /* HTMLImageElement needs no explicit release */ },
      });
    };

    img.onerror = () => reject(new Error('the browser could not decode this image file'));
    img.src = objectUrl;
  });
}

// Tries each loading strategy in order and only fails once every
// strategy has been exhausted. `file` and `objectUrl` describe the same
// image — different strategies need different input shapes.
export async function loadImageSource(file, objectUrl) {
  const strategies = [
    ['createImageBitmap', () => viaImageBitmap(file)],
    ['Image+decode/onload', () => viaImageElement(objectUrl)],
  ];

  let lastError = null;
  for (const [name, run] of strategies) {
    try {
      console.log(`${LOG} trying image load strategy: ${name}`);
      const result = await run();
      console.log(`${LOG} strategy succeeded: ${name} (${result.width}x${result.height})`);
      return result;
    } catch (err) {
      console.warn(`${LOG} strategy failed: ${name} —`, err?.message || err);
      lastError = err;
    }
  }

  throw new Error(
    lastError?.message
      ? `Could not load the selected image (${lastError.message}). Please try a different photo.`
      : 'Could not load the selected image. Please try a different photo.',
  );
}

// ── Stage 2: draw the crop rect onto a canvas ────────────────────────
function drawOntoCanvas(canvas, source, croppedAreaPixels, outSize) {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('this device could not create a 2D canvas context');
  }
  ctx.drawImage(
    source,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    outSize,
    outSize,
  );
  return ctx;
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

// ── Stage 3: encode the canvas to a Blob, preferring OffscreenCanvas ──
// (a real Promise-based API that rejects properly on failure) and
// falling back to the classic HTMLCanvasElement.toBlob(), which can
// silently resolve null on some mobile browsers — in which case we fall
// back once more to toDataURL() and convert that ourselves.
async function viaOffscreenCanvas(source, croppedAreaPixels, outSize, mime, quality) {
  if (typeof OffscreenCanvas === 'undefined') {
    throw new Error('OffscreenCanvas is not supported on this browser');
  }
  const canvas = new OffscreenCanvas(outSize, outSize);
  drawOntoCanvas(canvas, source, croppedAreaPixels, outSize);
  const blob = await canvas.convertToBlob({ type: mime, quality });
  if (!blob) throw new Error('OffscreenCanvas.convertToBlob returned no data');
  return blob;
}

async function viaHtmlCanvas(source, croppedAreaPixels, outSize, mime, quality) {
  const canvas = document.createElement('canvas');
  canvas.width = outSize;
  canvas.height = outSize;
  drawOntoCanvas(canvas, source, croppedAreaPixels, outSize);

  let blob = null;
  try {
    blob = await new Promise(resolve => canvas.toBlob(resolve, mime, quality));
  } catch {
    blob = null;
  }
  if (blob) return blob;

  // toBlob() resolved null — fall back to the more widely supported
  // toDataURL() and convert it ourselves.
  const dataUrl = canvas.toDataURL(mime, quality);
  return dataUrlToBlob(dataUrl);
}

async function encodeCroppedBlob(source, croppedAreaPixels, outSize, mime, quality) {
  const strategies = [
    ['OffscreenCanvas', () => viaOffscreenCanvas(source, croppedAreaPixels, outSize, mime, quality)],
    ['HTMLCanvas', () => viaHtmlCanvas(source, croppedAreaPixels, outSize, mime, quality)],
  ];

  let lastError = null;
  for (const [name, run] of strategies) {
    try {
      const blob = await run();
      console.log(`${LOG} canvas encode succeeded: ${name} (${blob.size} bytes)`);
      return blob;
    } catch (err) {
      console.warn(`${LOG} canvas encode failed: ${name} —`, err?.message || err);
      lastError = err;
    }
  }

  throw new Error(
    lastError?.message
      ? `Could not process the cropped image on this device (${lastError.message}).`
      : 'Could not process the cropped image on this device.',
  );
}

// `source` must come from loadImageSource() above (an ImageBitmap or
// HTMLImageElement) — these two functions do no loading/decoding of
// their own, they only draw+encode a bitmap that's already ready.
export async function getCroppedImageFile(source, croppedAreaPixels, fileName) {
  try {
    const blob = await encodeCroppedBlob(source, croppedAreaPixels, OUTPUT_SIZE, 'image/png', 0.92);
    console.log(`${LOG} cropped file ready: ${fileName} (${blob.size} bytes)`);
    return new File([blob], fileName, { type: 'image/png' });
  } catch (err) {
    throw err instanceof Error && err.message
      ? err
      : new Error('Could not crop the image. Please try again.');
  }
}

export async function getCroppedPreviewDataUrl(source, croppedAreaPixels, size = 96) {
  try {
    // The live preview is tiny and non-critical (failures are swallowed
    // by the caller) — a plain HTMLCanvasElement + toDataURL is simplest
    // and needs no object-URL lifecycle of its own.
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    drawOntoCanvas(canvas, source, croppedAreaPixels, size);
    return canvas.toDataURL('image/png');
  } catch (err) {
    throw err instanceof Error && err.message
      ? err
      : new Error('Could not generate the crop preview.');
  }
}
