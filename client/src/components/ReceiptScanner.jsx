import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { api } from '../lib/api.js';
import { receiptPhotos } from '../lib/images.js';
import { parseReceipt, readText } from '../lib/receipt.js';
import { formatDate, money } from '../lib/format.js';

/**
 * Photo of a receipt in, form fields out.
 *
 * The photo is shrunk in the browser, read with OCR (also in the browser -
 * see lib/receipt.js), and whatever was found is handed to the form through
 * onRead. The student always sees what was found and can correct any of it:
 * the scan fills the form, it never saves anything on its own.
 *
 * `photo` is the picture that will be stored with the transaction; `onPhoto`
 * changes it (null removes it). When editing a saved transaction that already
 * has a receipt, the stored picture is fetched only if the student opens it.
 */
export default function ReceiptScanner({ photo, onPhoto, onRead, currency, savedId, hasSaved }) {
  const input = useRef(null);
  const uploadInput = useRef(null);
  const [stage, setStage] = useState(photo ? 'found' : 'idle'); // idle | reading | found | failed
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState(photo || '');
  const [found, setFound] = useState(null);
  const [error, setError] = useState('');
  const [enlarged, setEnlarged] = useState(false);
  const [dragging, setDragging] = useState(false);

  // An existing receipt on a saved transaction: load it when asked.
  const [loadingSaved, setLoadingSaved] = useState(false);
  const showSaved = async () => {
    setLoadingSaved(true);
    try {
      const { receipt } = await api.get(`/transactions/${savedId}/receipt`);
      setPreview(receipt);
      setStage('found');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingSaved(false);
    }
  };

  useEffect(() => {
    if (!photo && stage === 'found' && !hasSaved) {
      setPreview('');
      setStage('idle');
    }
  }, [photo, stage, hasSaved]);

  const scan = async (file) => {
    if (!file) return;
    setError('');
    setFound(null);
    setProgress(0);
    try {
      const { forReading, forStoring } = await receiptPhotos(file);
      setPreview(forStoring);
      setStage('reading');
      onPhoto(forStoring);
      const text = await readText(forReading, (p) => setProgress(p));
      const result = parseReceipt(text);
      setFound(result);
      setStage('found');
      onRead(result);
    } catch (err) {
      setError(err.message || 'The picture could not be read.');
      setStage('failed');
    } finally {
      if (input.current) input.current.value = '';
    }
  };

  // A ready-made receipt, so the feature can be tried without a real one.
  const trySample = async () => {
    const blob = await (await fetch('/samples/receipt-cafe.png')).blob();
    scan(new File([blob], 'sample-receipt.png', { type: blob.type || 'image/png' }));
  };

  const remove = () => {
    onPhoto(null);
    setPreview('');
    setFound(null);
    setStage('idle');
  };

  const picker = (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => scan(e.target.files[0])}
      />
      {/* No capture = pick an existing image from the gallery/files. */}
      <input
        ref={uploadInput}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => scan(e.target.files[0])}
      />
    </>
  );

  // A saved receipt the student has not opened yet.
  if (hasSaved && !preview && photo === undefined) {
    return (
      <div className="receipt-saved">
        <Icon name="receipt" size={18} />
        <span>A receipt is attached to this transaction.</span>
        <button type="button" className="btn btn-sm" onClick={showSaved} disabled={loadingSaved}>
          {loadingSaved ? <span className="spinner" /> : <Icon name="eye" size={14} />}
          View it
        </button>
        {error ? <span className="small" style={{ color: 'var(--bad)' }}>{error}</span> : null}
      </div>
    );
  }

  if (stage === 'idle' || stage === 'failed') {
    return (
      <div
        className={`receipt-drop${dragging ? ' is-dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          scan(e.dataTransfer.files[0]);
        }}
      >
        <span className="receipt-drop-icon" aria-hidden="true">
          <Icon name="receipt" size={22} />
        </span>
        <div className="receipt-drop-copy">
          <strong>Scan a receipt</strong>
          <span>
            Take a photo, upload one, or drop it here. Campus Coin reads the total, the shop and the date, all on this device.
          </span>
          {stage === 'failed' ? <span className="receipt-error">{error}</span> : null}
        </div>
        <div className="receipt-drop-actions">
          <button type="button" className="btn btn-sm btn-primary" onClick={() => input.current?.click()}>
            <Icon name="camera" size={15} />
            Photo
          </button>
          <button type="button" className="btn btn-sm" onClick={() => uploadInput.current?.click()}>
            <Icon name="upload" size={15} />
            Upload
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={trySample}>
            Try a sample
          </button>
        </div>
        {picker}
      </div>
    );
  }

  return (
    <div className="receipt-card">
      <button
        type="button"
        className={`receipt-thumb${stage === 'reading' ? ' is-reading' : ''}`}
        onClick={() => setEnlarged(true)}
        aria-label="Show the receipt larger"
      >
        <img src={preview} alt="The receipt photo" />
        {stage === 'reading' ? <span className="receipt-scanline" aria-hidden="true" /> : null}
      </button>

      <div className="receipt-body">
        {stage === 'reading' ? (
          <>
            <strong>Reading the receipt&hellip;</strong>
            <div className="receipt-progress" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
              <i style={{ transform: `scaleX(${Math.max(0.04, progress)})` }} />
            </div>
            <span className="small muted">{Math.round(progress * 100)}% · the first scan also downloads the reader (about 3 MB)</span>
          </>
        ) : found ? (
          <>
            <strong>Found on the receipt</strong>
            <div className="receipt-found">
              <span className={found.amount ? 'is-ok' : 'is-miss'}>
                <Icon name={found.amount ? 'check' : 'alert'} size={13} />
                {found.amount ? money(found.amount, currency, { decimals: found.amount % 1 !== 0 }) : 'Total not found'}
              </span>
              <span className={found.merchant ? 'is-ok' : 'is-miss'}>
                <Icon name={found.merchant ? 'check' : 'alert'} size={13} />
                {found.merchant || 'Shop not found'}
              </span>
              <span className={found.date ? 'is-ok' : 'is-miss'}>
                <Icon name={found.date ? 'check' : 'alert'} size={13} />
                {found.date ? formatDate(found.date) : 'Date not found'}
              </span>
            </div>
            <span className="small muted">Filled in below. Check them before you save.</span>
          </>
        ) : (
          <>
            <strong>Receipt attached</strong>
            <span className="small muted">It is kept with this transaction.</span>
          </>
        )}
        {stage !== 'reading' ? (
          <div className="row">
            <button type="button" className="btn btn-sm" onClick={() => input.current?.click()}>
              <Icon name="camera" size={14} />
              Scan another
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={remove}>
              <Icon name="trash" size={14} />
              Remove
            </button>
          </div>
        ) : null}
      </div>
      {picker}

      {enlarged ? (
        <div className="receipt-lightbox" onClick={() => setEnlarged(false)} role="presentation">
          <img src={preview} alt="The receipt photo, enlarged" />
          <span className="small">Click anywhere to close</span>
        </div>
      ) : null}
    </div>
  );
}
