// Image normalization + canvas export helpers for the branding logo
// cropper. Cropper.js (via react-cropper) owns all of the actual
// drag/zoom/pinch/crop-box UI and math — this module only prepares the
// source image before Cropper.js ever sees it, and converts the final
// cropped canvas Cropper.js hands back into an uploadable File.
//
//   File
//    -> FileReader.readAsDataURL()
//    -> HTMLImageElement (fully decoded)
//    -> drawn once onto an offscreen <canvas>, correcting EXIF
//       orientation and capping oversized camera photos
//    -> exported as a normalized PNG data URL
//
// No blob: URL is ever created — object URLs proved unreliable on some
// Android Chrome / Samsung Internet builds. Cropper.js's `src` only ever
// receives this normalized data URL.
const NORMALIZED_MAX_DIM = 3072; // working resolution cap for huge camera photos
const LOG = '[crop-debug]';

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.onabort = () => reject(new Error('Reading the selected file was aborted.'));
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
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
        reject(new Error('The browser could not decode this image.'));
        return;
      }
      resolve(img);
    };
    img.onerror = () => reject(new Error('The browser could not decode this image.'));
    img.src = dataUrl;
  });
}

// ── EXIF orientation ──────────────────────────────────────────────
// canvas drawImage() never applies EXIF rotation on its own, so without
// this, photos taken in portrait on many Android cameras come out
// sideways. Returns 1 (normal) for non-JPEG files or when no tag/parse
// failure occurs — this is a best-effort enhancement, never a hard
// requirement for the rest of the pipeline to work.
async function readExifOrientation(file) {
  if (file.type !== 'image/jpeg') return 1;
  try {
    const buffer = await file.slice(0, 128 * 1024).arrayBuffer();
    const view = new DataView(buffer);
    if (view.getUint16(0, false) !== 0xFFD8) return 1;

    let offset = 2;
    while (offset < view.byteLength - 4) {
      const marker = view.getUint16(offset, false);
      offset += 2;
      if (marker === 0xFFE1) {
        if (view.getUint32(offset + 2, false) !== 0x45786966) return 1; // "Exif"
        const tiffOffset = offset + 8;
        const little = view.getUint16(tiffOffset, false) === 0x4949;
        const firstIfdOffset = view.getUint32(tiffOffset + 4, little);
        const dirStart = tiffOffset + firstIfdOffset;
        const entries = view.getUint16(dirStart, little);
        for (let i = 0; i < entries; i++) {
          const entryOffset = dirStart + 2 + i * 12;
          if (view.getUint16(entryOffset, little) === 0x0112) {
            return view.getUint16(entryOffset + 8, little);
          }
        }
        return 1;
      } else if ((marker & 0xFF00) !== 0xFF00) {
        break;
      } else {
        offset += view.getUint16(offset, false);
      }
    }
  } catch {
    // Malformed/truncated EXIF block — fall through to "normal".
  }
  return 1;
}

const ORIENTATION_SWAPS_DIMENSIONS = orientation => orientation >= 5 && orientation <= 8;

// Applies the canvas transform for a given EXIF orientation (1–8).
// `drawW`/`drawH` are the image's own dimensions as drawn (pre-swap) —
// the transform repositions that drawn rect into the (possibly swapped)
// destination canvas.
function applyExifTransform(ctx, orientation, drawW, drawH) {
  switch (orientation) {
    case 2: ctx.transform(-1, 0, 0, 1, drawW, 0); break;
    case 3: ctx.transform(-1, 0, 0, -1, drawW, drawH); break;
    case 4: ctx.transform(1, 0, 0, -1, 0, drawH); break;
    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
    case 6: ctx.transform(0, 1, -1, 0, drawH, 0); break;
    case 7: ctx.transform(0, -1, -1, 0, drawH, drawW); break;
    case 8: ctx.transform(0, -1, 1, 0, 0, drawW); break;
    default: break;
  }
}

// Decodes the original file exactly once, corrects EXIF orientation,
// downsamples oversized camera photos to a safe working resolution, and
// produces a single normalized PNG data URL — the only thing Cropper.js
// ever loads. Drawing through a fresh 2D canvas context also naturally
// strips embedded ICC color profiles (canvas output is always sRGB) and
// finishes decoding progressive JPEGs — both already fully handled by
// the browser's decoder by the time `onload` fires, so no special-case
// code is needed for either. Transparency is preserved: the canvas is
// never pre-filled with an opaque background.
export async function normalizeImage(file) {
  console.log(`${LOG} normalizing`, file.name, file.size, file.type);

  const [dataUrl, orientation] = await Promise.all([
    readFileAsDataUrl(file),
    readExifOrientation(file),
  ]);
  console.log(`${LOG} file read as data URL, EXIF orientation`, orientation);

  const img = await loadImageFromDataUrl(dataUrl);
  console.log(`${LOG} source image decoded`, img.naturalWidth, 'x', img.naturalHeight);

  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  const scale = Math.min(1, NORMALIZED_MAX_DIM / Math.max(srcW, srcH));
  const drawW = Math.round(srcW * scale);
  const drawH = Math.round(srcH * scale);
  const swapped = ORIENTATION_SWAPS_DIMENSIONS(orientation);
  const outW = swapped ? drawH : drawW;
  const outH = swapped ? drawW : drawH;

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('This device could not create a 2D canvas context.');
  }

  ctx.save();
  applyExifTransform(ctx, orientation, drawW, drawH);
  ctx.drawImage(img, 0, 0, drawW, drawH);
  ctx.restore();

  const normalizedSrc = canvas.toDataURL('image/png');
  console.log(`${LOG} normalized to`, outW, 'x', outH);

  return { src: normalizedSrc, width: outW, height: outH };
}

// ── Cropper.js output -> uploadable File ───────────────────────────
function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = /data:(.*?);base64/.exec(header || '');
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// `canvas` is whatever Cropper.js's own getCroppedCanvas() returns — we
// do no drawing of our own here, only a reliable canvas -> Blob -> File
// conversion. toBlob() can silently resolve null on some mobile
// browsers, so it falls back to toDataURL() + a manual Blob conversion.
export async function canvasToFile(canvas, fileName, mime = 'image/png', quality = 0.92) {
  try {
    if (!canvas) {
      throw new Error('No cropped canvas was produced.');
    }
    let blob = null;
    try {
      blob = await new Promise(resolve => canvas.toBlob(resolve, mime, quality));
    } catch {
      blob = null;
    }
    if (!blob) {
      blob = dataUrlToBlob(canvas.toDataURL(mime, quality));
    }
    if (!blob) {
      throw new Error('Could not process the cropped image on this device.');
    }
    console.log(`${LOG} cropped file ready`, fileName, blob.size, 'bytes');
    return new File([blob], fileName, { type: mime });
  } catch (err) {
    throw err instanceof Error && err.message
      ? err
      : new Error('Could not crop the image. Please try again.');
  }
}
