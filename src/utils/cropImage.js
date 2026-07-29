// Canvas helper for turning a react-easy-crop crop selection into an
// uploadable File — output is a fixed 512x512 square, matching the
// Cloudinary transformation already applied server-side.
const OUTPUT_SIZE = 512;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', reject);
    img.crossOrigin = 'anonymous';
    img.src = src;
  });
}

export async function getCroppedImageFile(imageSrc, croppedAreaPixels, fileName) {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');

  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  );

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.92));
  return new File([blob], fileName, { type: 'image/png' });
}

export async function getCroppedPreviewDataUrl(imageSrc, croppedAreaPixels, size = 96) {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    size,
    size,
  );

  return canvas.toDataURL('image/png');
}
