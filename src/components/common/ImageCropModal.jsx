import { useState, useCallback, useEffect, useRef } from 'react';
import Cropper from 'react-easy-crop';
import { FiZoomIn, FiZoomOut, FiCheck, FiAlertCircle } from 'react-icons/fi';
import Modal from './Modal';
import { loadImageElement, getCroppedPreviewDataUrl } from '../../utils/cropImage';
import './ImageCropModal.css';

// status: idle | loading | ready | error
export default function ImageCropModal({ isOpen, imageSrc, onCancel, onConfirm, confirming }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [status, setStatus] = useState('idle');
  const [loadError, setLoadError] = useState('');
  const imageElRef = useRef(null);

  // Preload the image exactly once per imageSrc — the crop viewport is
  // only rendered once this resolves. Everything downstream (live
  // preview, final crop) reuses this same decoded element instead of
  // re-fetching the blob: URL on every interaction.
  useEffect(() => {
    if (!isOpen || !imageSrc) {
      setStatus('idle');
      return;
    }

    let cancelled = false;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setPreviewUrl(null);
    setStatus('loading');
    imageElRef.current = null;

    console.log('[crop-debug] preloading image', imageSrc);

    loadImageElement(imageSrc)
      .then(img => {
        if (cancelled) return;
        console.log('[crop-debug] image preload OK', img.naturalWidth, 'x', img.naturalHeight);
        imageElRef.current = img;
        setStatus('ready');
      })
      .catch(err => {
        if (cancelled) return;
        console.error('[crop-debug] image preload FAILED', err);
        setLoadError(err?.message || 'Could not load the selected image.');
        setStatus('error');
      });

    return () => { cancelled = true; };
  }, [isOpen, imageSrc]);

  const onCropComplete = useCallback((_croppedArea, pixels) => {
    setCroppedAreaPixels(pixels);
    if (imageElRef.current) {
      getCroppedPreviewDataUrl(imageElRef.current, pixels, 96)
        .then(setPreviewUrl)
        .catch(err => console.error('[crop-debug] preview draw failed', err));
    }
  }, []);

  const handleConfirm = () => {
    if (croppedAreaPixels && imageElRef.current) {
      console.log('[crop-debug] Use Photo tapped, drawing final crop');
      onConfirm(imageElRef.current, croppedAreaPixels);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="Crop Logo" size="small">
      <div className="icm-body">
        <div className="icm-cropper-wrap">
          {status === 'ready' && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="rect"
              showGrid
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
          {status === 'loading' && (
            <div className="icm-status">
              <span className="icm-spinner" />
              <p>Loading image…</p>
            </div>
          )}
          {status === 'error' && (
            <div className="icm-status icm-status-error">
              <FiAlertCircle size={22} />
              <p>{loadError}</p>
            </div>
          )}
        </div>

        <div className="icm-controls">
          <div className="icm-zoom-row">
            <FiZoomOut size={16} className="icm-zoom-icon" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              className="icm-zoom-slider"
              aria-label="Zoom"
              disabled={status !== 'ready'}
            />
            <FiZoomIn size={16} className="icm-zoom-icon" />
          </div>

          <div className="icm-preview-row">
            <span className="icm-preview-label">Preview</span>
            <div className="icm-preview-circle">
              {previewUrl && <img src={previewUrl} alt="Crop preview" />}
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={confirming}>
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            onClick={handleConfirm}
            disabled={status !== 'ready' || !croppedAreaPixels || confirming}
          >
            <FiCheck size={15} /> {confirming ? 'Uploading...' : 'Use Photo'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
