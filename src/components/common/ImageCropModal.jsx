import { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { FiZoomIn, FiZoomOut, FiCheck } from 'react-icons/fi';
import Modal from './Modal';
import { getCroppedPreviewDataUrl } from '../../utils/cropImage';
import './ImageCropModal.css';

export default function ImageCropModal({ isOpen, imageSrc, onCancel, onConfirm, confirming }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setPreviewUrl(null);
    }
  }, [isOpen, imageSrc]);

  const onCropComplete = useCallback((_croppedArea, pixels) => {
    setCroppedAreaPixels(pixels);
    if (imageSrc) {
      getCroppedPreviewDataUrl(imageSrc, pixels, 96)
        .then(setPreviewUrl)
        .catch(() => {});
    }
  }, [imageSrc]);

  const handleConfirm = () => {
    if (croppedAreaPixels) onConfirm(croppedAreaPixels);
  };

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="Crop Logo" size="small">
      <div className="icm-body">
        <div className="icm-cropper-wrap">
          {imageSrc && (
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
            disabled={!croppedAreaPixels || confirming}
          >
            <FiCheck size={15} /> {confirming ? 'Uploading...' : 'Use Photo'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
