import { useState, useCallback, useEffect, useRef } from 'react';
import Cropper from 'react-easy-crop';
import { FiZoomIn, FiZoomOut, FiCheck, FiAlertCircle } from 'react-icons/fi';
import Modal from './Modal';
import { loadImageSource, getCroppedPreviewDataUrl } from '../../utils/cropImage';
import './ImageCropModal.css';

const LOG = '[crop-debug]';

// status: idle | loading | ready | error
// `file` is the raw File the user picked — this component owns the full
// object-URL + decoded-bitmap lifecycle for it: created once per file,
// released exactly once (cancel, successful confirm, or a new file
// replacing this one) via the effect's own cleanup.
export default function ImageCropModal({ isOpen, file, onCancel, onConfirm, confirming }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [status, setStatus] = useState('idle');
  const [loadError, setLoadError] = useState('');
  const [objectUrl, setObjectUrl] = useState(null);
  const imageSourceRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !file) {
      setStatus('idle');
      return;
    }

    let cancelled = false;
    const url = URL.createObjectURL(file);
    console.log(`${LOG} object URL created`, url);

    setObjectUrl(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setPreviewUrl(null);
    setStatus('loading');
    imageSourceRef.current = null;

    loadImageSource(file, url)
      .then(result => {
        if (cancelled) { result.release(); return; }
        console.log(`${LOG} image ready, mounting cropper`, result.width, 'x', result.height);
        imageSourceRef.current = result;
        setStatus('ready');
      })
      .catch(err => {
        if (cancelled) return;
        console.error(`${LOG} image load failed after all strategies`, err);
        setLoadError(err?.message || 'Could not load the selected image.');
        setStatus('error');
      });

    return () => {
      cancelled = true;
      console.log(`${LOG} cleanup: revoking object URL, releasing image source`, url);
      URL.revokeObjectURL(url);
      imageSourceRef.current?.release();
      imageSourceRef.current = null;
    };
  }, [isOpen, file]);

  const onCropComplete = useCallback((_croppedArea, pixels) => {
    setCroppedAreaPixels(pixels);
    if (imageSourceRef.current) {
      getCroppedPreviewDataUrl(imageSourceRef.current.source, pixels, 96)
        .then(setPreviewUrl)
        .catch(err => console.error(`${LOG} preview draw failed`, err));
    }
  }, []);

  const handleConfirm = () => {
    if (croppedAreaPixels && imageSourceRef.current) {
      console.log(`${LOG} Use Photo tapped, drawing final crop`);
      onConfirm(imageSourceRef.current.source, croppedAreaPixels);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="Crop Logo" size="small">
      <div className="icm-body">
        <div className="icm-cropper-wrap">
          {status === 'ready' && (
            <Cropper
              image={objectUrl}
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
