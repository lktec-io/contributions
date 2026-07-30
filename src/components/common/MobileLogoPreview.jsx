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

  // Preview comes directly from the local File — URL.createObjectURL is
  // synchronous (just registers a reference, no file reading or base64
  // encoding) so it's ready before the next paint. Keyed on `file` alone
  // (not `isOpen`) since `isOpen` is always derived from the same file
  // in the parent and adds nothing to the dependency check.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    console.log(`${LOG} mobile preview object URL created`, url, file.name, file.size);
    setPreviewUrl(url);

    return () => {
      console.log(`${LOG} mobile preview object URL revoked`, url);
      URL.revokeObjectURL(url);
    };
  }, [file]);

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="Logo Preview" size="small">
      <div className="mlp-body">
        <div className="mlp-preview-wrap">
          {previewUrl ? (
            <img
              key={previewUrl}
              src={previewUrl}
              alt="Selected logo"
              className="mlp-preview-img"
              style={{
                display: 'block',
                visibility: 'visible',
                opacity: 1,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
              onLoad={() => console.log(`${LOG} mobile preview <img> loaded OK`, previewUrl)}
              onError={(e) => console.error(`${LOG} mobile preview <img> FAILED to load`, previewUrl, e)}
            />
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
