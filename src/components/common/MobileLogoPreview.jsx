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

    // URL.createObjectURL is synchronous (just registers a reference —
    // no file reading or base64 encoding), so the preview is available
    // on the very next paint. FileReader.readAsDataURL has to read and
    // base64-encode the entire file (up to 2MB) before onload fires,
    // which was slow enough on some Android devices to make the preview
    // look blank/stuck even though the underlying File was already fine
    // (the actual upload sends the raw File via FormData, no encoding
    // involved, which is why upload always worked while the preview
    // didn't).
    const url = URL.createObjectURL(file);
    console.log(`${LOG} mobile preview object URL created`, url);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
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
