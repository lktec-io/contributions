import { useState, useEffect, useRef } from 'react';
import { FiUpload, FiImage } from 'react-icons/fi';
import Modal from './Modal';
import './MobileLogoPreview.css';

const LOG = '[crop-debug]';

// Mobile logo picker: no client-side crop/canvas step at all — just a
// plain <img> preview (native rendering, the one image operation mobile
// browsers never fail at) and a direct upload of the original File.
// Resizing/center-cropping/orientation-correction all happen server-side
// (see uploadBrandingLogo in settingsController.js).
export default function MobileLogoPreview({ isOpen, file, allowedTypes, onCancel, onChooseAnother, onUpload, uploading }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !file) {
      setPreviewUrl(null);
      return;
    }

    let cancelled = false;
    const reader = new FileReader();
    reader.onload = () => {
      if (!cancelled) setPreviewUrl(reader.result);
    };
    reader.onerror = () => {
      console.error(`${LOG} mobile preview read failed`);
    };
    reader.readAsDataURL(file);

    return () => { cancelled = true; };
  }, [isOpen, file]);

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="Logo Preview" size="small">
      <div className="mlp-body">
        <div className="mlp-preview-wrap">
          {previewUrl ? (
            <img src={previewUrl} alt="Selected logo" className="mlp-preview-img" />
          ) : (
            <FiImage size={28} className="mlp-preview-placeholder" />
          )}
        </div>

        <p className="mlp-hint">Your logo will be automatically centered and resized after upload.</p>

        <input
          ref={inputRef}
          type="file"
          accept={allowedTypes?.join(',')}
          className="mlp-hidden-input"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) onChooseAnother(f);
            e.target.value = '';
          }}
        />

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            Choose Another Photo
          </button>
          <button
            type="button"
            className="btn"
            onClick={onUpload}
            disabled={!file || uploading}
          >
            <FiUpload size={14} /> {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
