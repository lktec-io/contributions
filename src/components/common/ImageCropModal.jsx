import { useState, useCallback, useEffect, useRef } from 'react';
import Cropper from 'react-cropper';
import 'cropperjs/dist/cropper.css';
import { FiZoomIn, FiZoomOut, FiCheck, FiAlertCircle } from 'react-icons/fi';
import Modal from './Modal';
import { normalizeImage } from '../../utils/cropImage';
import './ImageCropModal.css';

const LOG = '[crop-debug]';
const OUTPUT_SIZE = 1024;
const ZOOM_MIN = 1;
const ZOOM_MAX = 3;

// status: idle | loading | ready | error
// `file` is the raw File the user picked. It's normalized exactly once
// (see normalizeImage in cropImage.js — EXIF-corrects, strips color
// profiles, caps oversized photos) into a plain PNG data URL, which is
// the ONLY thing ever handed to Cropper.js as `src` — no blob: URL is
// ever created. Cropper.js (a mature, widely-used library) owns all of
// the actual drag/pinch/wheel-zoom/crop-box interaction and the live
// preview; this component just wires it up and extracts the final
// cropped canvas on confirm.
export default function ImageCropModal({ isOpen, file, onCancel, onConfirm, confirming }) {
  const [status, setStatus] = useState('idle');
  const [loadError, setLoadError] = useState('');
  const [normalizedSrc, setNormalizedSrc] = useState(null);
  const [zoom, setZoom] = useState(ZOOM_MIN);
  const [previewEl, setPreviewEl] = useState(null);
  const cropperRef = useRef(null);
  const baseZoomRatioRef = useRef(1);

  useEffect(() => {
    if (!isOpen || !file) {
      setStatus('idle');
      return;
    }

    let cancelled = false;
    setNormalizedSrc(null);
    setZoom(ZOOM_MIN);
    setLoadError('');
    setStatus('loading');

    normalizeImage(file)
      .then(result => {
        if (cancelled) return;
        console.log(`${LOG} normalization complete, mounting Cropper.js`, result.width, 'x', result.height);
        setNormalizedSrc(result.src);
        setStatus('ready');
      })
      .catch(err => {
        if (cancelled) return;
        console.error(`${LOG} normalization failed`, err);
        setLoadError(err?.message || 'Could not load the selected image.');
        setStatus('error');
      });

    return () => { cancelled = true; };
  }, [isOpen, file]);

  // Cropper.js's own zoom ratio is relative to the image's natural pixel
  // size, not to "fit the view" — capture the auto-fit ratio once ready
  // so our 1x–3x slider means the same thing it did before (1x = the
  // initial auto-fit view).
  const handleReady = useCallback(() => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;
    const { ratio } = cropper.getImageData();
    baseZoomRatioRef.current = ratio || 1;
    setZoom(ZOOM_MIN);
    console.log(`${LOG} Cropper.js ready, base zoom ratio`, ratio);
  }, []);

  const handleZoomEvent = useCallback((e) => {
    const base = baseZoomRatioRef.current || 1;
    const relative = e.detail.ratio / base;
    setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, relative)));
  }, []);

  const handleSliderChange = (e) => {
    const value = Number(e.target.value);
    setZoom(value);
    cropperRef.current?.cropper?.zoomTo(baseZoomRatioRef.current * value);
  };

  const handleConfirm = () => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper || confirming) return;
    console.log(`${LOG} Use Photo tapped, extracting cropped canvas`);
    const canvas = cropper.getCroppedCanvas({
      width: OUTPUT_SIZE,
      height: OUTPUT_SIZE,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
    });
    if (!canvas) {
      console.error(`${LOG} getCroppedCanvas returned null`);
      setLoadError('Could not process the cropped image on this device.');
      setStatus('error');
      return;
    }
    onConfirm(canvas);
  };

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="Crop Logo" size="small">
      <div className="icm-body">
        <div className="icm-cropper-wrap">
          {status === 'ready' && normalizedSrc && (
            <Cropper
              ref={cropperRef}
              src={normalizedSrc}
              style={{ width: '100%', height: '100%' }}
              aspectRatio={1}
              viewMode={1}
              dragMode="move"
              cropBoxMovable={false}
              cropBoxResizable={false}
              toggleDragModeOnDblclick={false}
              autoCropArea={1}
              background={false}
              guides
              responsive
              zoomOnWheel
              zoomOnTouch
              wheelZoomRatio={0.1}
              ready={handleReady}
              zoom={handleZoomEvent}
              preview={previewEl || undefined}
            />
          )}
          {status === 'loading' && (
            <div className="icm-status">
              <span className="icm-spinner" />
              <p>Preparing image…</p>
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
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={0.01}
              value={zoom}
              onChange={handleSliderChange}
              className="icm-zoom-slider"
              aria-label="Zoom"
              disabled={status !== 'ready'}
            />
            <FiZoomIn size={16} className="icm-zoom-icon" />
          </div>

          <div className="icm-preview-row">
            <span className="icm-preview-label">Preview</span>
            <div className="icm-preview-circle" ref={setPreviewEl} />
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
            disabled={status !== 'ready' || confirming}
          >
            <FiCheck size={15} /> {confirming ? 'Uploading...' : 'Use Photo'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
