import { useState, useRef } from 'react';

export default function OrderImport({ onImportComplete }) {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState(null); // { message, created[], errors[] }
  const inputRef = useRef(null);
  const token = localStorage.getItem('token');

  /* ── Drag-and-drop helpers ── */
  const handleDragOver  = (e) => { e.preventDefault(); setDragging(true);  };
  const handleDragLeave = ()  => setDragging(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) pickFile(dropped);
  };

  const pickFile = (f) => {
    if (!f.name.match(/\.xlsx$/i)) {
      alert('Only .xlsx files are supported. Please use the sample template.');
      return;
    }
    setFile(f);
    setResult(null);
  };

  /* ── Upload ── */
  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('http://localhost:5000/api/orders/import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      // Top-level error (parse failure, no rows, etc.)
      if (data.error) {
        setResult({ message: data.error, created: [], errors: [] });
        return;
      }
      setResult(data);
      if (data.created && data.created.length > 0 && onImportComplete) {
        // Don't auto-navigate — let user see the result table first
      }
    } catch (err) {
      setResult({ message: 'Network error — could not reach the server. Is Docker running?', created: [], errors: [] });
    } finally {
      setIsUploading(false);
    }
  };

  const reset = () => { setFile(null); setResult(null); if (inputRef.current) inputRef.current.value = ''; };

  return (
    <div className="oi-container">
      <div className="oi-card">
        {/* Header */}
        <div className="oi-header">
          <div>
            <h2 className="oi-title">Bulk Order Import</h2>
            <p className="oi-subtitle">
              Upload a filled Excel template to create multiple orders automatically.
              Each unique <code>po_number</code> becomes one order.
            </p>
          </div>
          <a
            href={`http://localhost:5000/api/template/download?token=${token}`}
            className="oi-download-btn"
            title="Download the sample template"
            download="order_import_template.xlsx"
          >
            ⬇ Download Template
          </a>
        </div>

        {/* Drop Zone */}
        {!result && (
          <div
            className={`oi-dropzone${dragging ? ' oi-dragging' : ''}${file ? ' oi-has-file' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !file && inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              hidden
              onChange={(e) => e.target.files[0] && pickFile(e.target.files[0])}
            />
            {file ? (
              <div className="oi-file-preview">
                <span className="oi-file-icon">📊</span>
                <div className="oi-file-info">
                  <span className="oi-file-name">{file.name}</span>
                  <span className="oi-file-size">{(file.size / 1024).toFixed(1)} KB</span>
                </div>
                <button className="oi-clear-btn" onClick={(e) => { e.stopPropagation(); reset(); }} title="Remove">✕</button>
              </div>
            ) : (
              <div className="oi-drop-prompt">
                <div className="oi-drop-icon">📂</div>
                <div className="oi-drop-text">Drag &amp; drop your <strong>.xlsx</strong> file here</div>
                <div className="oi-drop-sub">or click to browse</div>
              </div>
            )}
          </div>
        )}

        {/* Action */}
        {!result && (
          <div className="oi-actions">
            <button
              className="oi-upload-btn"
              disabled={!file || isUploading}
              onClick={handleUpload}
            >
              {isUploading ? (
                <><span className="oi-spinner" /> Processing...</>
              ) : 'Import Orders'}
            </button>
          </div>
        )}

        {/* Instructions */}
        {!result && (
          <div className="oi-instructions">
            <h3 className="oi-inst-title">How to use</h3>
            <ol className="oi-inst-list">
              <li>Download the template using the button above.</li>
              <li>Open the <strong>"Import Template"</strong> sheet and fill in your data.</li>
              <li>Each row = one line item. Rows with the same <code>po_number</code> are grouped into one order.</li>
              <li>Company name &amp; city must match entries in <strong>Masters → Companies</strong>.</li>
              <li>Dates must be in <strong>YYYY-MM-DD</strong> format or a proper Excel date.</li>
              <li>Save as <code>.xlsx</code> and upload here.</li>
            </ol>

            <div className="oi-field-ref">
              <h4>Required Fields</h4>
              <div className="oi-field-grid">
                {[
                  { f: 'company_name', r: true,  note: 'Exact match in Masters' },
                  { f: 'company_city', r: true,  note: 'Exact match in Masters' },
                  { f: 'order_date',   r: true,  note: 'YYYY-MM-DD' },
                  { f: 'delivery_date',r: true,  note: 'YYYY-MM-DD' },
                  { f: 'po_number',    r: true,  note: 'Groups rows into one order' },
                  { f: 'priority',     r: true,  note: 'Low / Medium / High / Urgent' },
                  { f: 'material_description', r: true, note: 'Per line item' },
                  { f: 'quantity',     r: true,  note: 'Positive integer' },
                  { f: 'unit',         r: true,  note: 'e.g. Nos, Sets' },
                  { f: 'unit_price',   r: true,  note: 'Numeric, no ₹' },
                  { f: 'packaging_type', r: false, note: 'Wooden Packaging / Foam Packaging' },
                  { f: 'order_notes',  r: false, note: 'Optional' },
                  { f: 'part_number',  r: false, note: 'Optional' },
                  { f: 'panel_type_size', r: false, note: 'e.g. 800x600' },
                  { f: 'line_item_delivery_date', r: false, note: 'Defaults to delivery_date' },
                  { f: 'line_item_notes', r: false, note: 'Optional' },
                ].map(({ f, r, note }) => (
                  <div key={f} className="oi-field-row">
                    <code className="oi-field-name">{f}</code>
                    <span className={`oi-badge ${r ? 'req' : 'opt'}`}>{r ? 'Required' : 'Optional'}</span>
                    <span className="oi-field-note">{note}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Result Panel */}
        {result && (
          <div className="oi-result">
            <p className={`oi-result-msg ${result.created?.length > 0 ? 'success' : 'fail'}`}>
              {result.created?.length > 0 ? '✅' : '⚠️'} {result.message}
            </p>

            {result.created?.length > 0 && (
              <div className="oi-result-section">
                <h4>Created &amp; Merged Orders</h4>
                <table className="oi-result-table">
                  <thead>
                    <tr><th>PO Number</th><th>Order Number</th><th>Units Added</th><th>Action Taken</th></tr>
                  </thead>
                  <tbody>
                    {result.created.map((r, i) => (
                      <tr key={i}>
                        <td>{r.po_number}</td>
                        <td><strong style={{ color: '#60a5fa' }}>{r.order_number}</strong></td>
                        <td>{r.units}</td>
                        <td>
                          <span style={{
                            background: r.is_appended ? '#1e3a8a' : '#064e3b',
                            color: r.is_appended ? '#60a5fa' : '#34d399',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            display: 'inline-block'
                          }}>
                            {r.is_appended ? 'Merged (Appended)' : 'Created (New)'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {result.errors?.length > 0 && (
              <div className="oi-result-section">
                <h4 style={{ color: '#f87171' }}>Errors</h4>
                <table className="oi-result-table">
                  <thead>
                    <tr><th>PO Number</th><th>Reason</th></tr>
                  </thead>
                  <tbody>
                    {result.errors.map((e, i) => (
                      <tr key={i}>
                        <td>{e.po_number}</td>
                        <td style={{ color: '#f87171' }}>{e.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button className="oi-upload-btn" onClick={reset}>Import Another File</button>
              {result.created?.length > 0 && (
                <button
                  className="oi-upload-btn"
                  style={{ background: '#10b981' }}
                  onClick={() => onImportComplete?.()}
                >
                  View Orders →
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .oi-container { padding: 24px; max-width: 960px; margin: 0 auto; }
        .oi-card {
          background: #1a1a1a; border: 1px solid #2a2a2a;
          border-radius: 16px; padding: 32px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        }

        /* Header */
        .oi-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; gap: 16px; }
        .oi-title  { margin: 0 0 6px; color: #fff; font-size: 22px; font-weight: 700; }
        .oi-subtitle { color: #888; font-size: 13px; margin: 0; line-height: 1.6; }
        .oi-subtitle code { background: #222; padding: 1px 5px; border-radius: 4px; color: #60a5fa; font-size: 12px; }
        .oi-download-btn {
          flex-shrink: 0;
          display: inline-flex; align-items: center; gap: 6px;
          background: #1e3a5f; color: #60a5fa; border: 1px solid #2a5298;
          padding: 10px 18px; border-radius: 8px; font-size: 13px; font-weight: 600;
          text-decoration: none; transition: background 0.2s;
          white-space: nowrap;
        }
        .oi-download-btn:hover { background: #2a4a7a; }

        /* Drop Zone */
        .oi-dropzone {
          border: 2px dashed #333; border-radius: 12px; padding: 40px 24px;
          text-align: center; cursor: pointer; transition: all 0.2s; margin-bottom: 20px;
          background: #111;
        }
        .oi-dropzone:hover { border-color: #3b82f6; background: #131e35; }
        .oi-dragging  { border-color: #3b82f6 !important; background: #131e35 !important; }
        .oi-has-file  { cursor: default; border-color: #10b981 !important; background: #0d1f1a !important; }

        .oi-drop-icon { font-size: 42px; margin-bottom: 12px; }
        .oi-drop-text { color: #ccc; font-size: 15px; margin-bottom: 6px; }
        .oi-drop-sub  { color: #666; font-size: 12px; }

        .oi-file-preview { display: flex; align-items: center; gap: 14px; }
        .oi-file-icon { font-size: 36px; }
        .oi-file-info { flex: 1; text-align: left; }
        .oi-file-name { display: block; color: #fff; font-weight: 600; font-size: 14px; }
        .oi-file-size { display: block; color: #888; font-size: 12px; margin-top: 2px; }
        .oi-clear-btn {
          background: transparent; border: none; color: #ef4444;
          font-size: 18px; cursor: pointer; padding: 4px 8px;
        }
        .oi-clear-btn:hover { color: #f87171; }

        /* Actions */
        .oi-actions { display: flex; justify-content: flex-end; margin-bottom: 28px; }
        .oi-upload-btn {
          background: #3b82f6; color: #fff; border: none;
          padding: 12px 28px; border-radius: 10px; font-size: 14px; font-weight: 600;
          cursor: pointer; transition: background 0.2s, transform 0.1s;
          display: inline-flex; align-items: center; gap: 8px;
        }
        .oi-upload-btn:hover:not(:disabled) { background: #2563eb; transform: translateY(-1px); }
        .oi-upload-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .oi-spinner {
          width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Instructions */
        .oi-instructions { padding-top: 24px; border-top: 1px solid #222; }
        .oi-inst-title { color: #fff; font-size: 15px; margin: 0 0 14px; }
        .oi-inst-list { color: #aaa; font-size: 13px; line-height: 2; padding-left: 18px; margin: 0 0 24px; }
        .oi-inst-list strong { color: #ddd; }
        .oi-inst-list code { background: #222; padding: 1px 5px; border-radius: 4px; color: #60a5fa; font-size: 12px; }

        .oi-field-ref h4 { color: #fff; font-size: 14px; margin: 0 0 12px; }
        .oi-field-grid { display: flex; flex-direction: column; gap: 6px; }
        .oi-field-row {
          display: grid; grid-template-columns: 220px 80px 1fr; align-items: center;
          gap: 12px; padding: 6px 10px; border-radius: 6px; background: #111;
        }
        .oi-field-name { color: #60a5fa; font-size: 12px; }
        .oi-badge {
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          padding: 2px 7px; border-radius: 4px; text-align: center;
        }
        .oi-badge.req { background: rgba(239,68,68,0.15); color: #f87171; }
        .oi-badge.opt { background: rgba(107,114,128,0.2); color: #9ca3af; }
        .oi-field-note { color: #888; font-size: 12px; }

        /* Results */
        .oi-result { padding-top: 24px; border-top: 1px solid #222; }
        .oi-result-msg { font-size: 15px; font-weight: 600; margin-bottom: 20px; }
        .oi-result-msg.success { color: #34d399; }
        .oi-result-msg.fail    { color: #f87171; }
        .oi-result-section { margin-bottom: 20px; }
        .oi-result-section h4 { color: #fff; font-size: 13px; margin: 0 0 10px; }
        .oi-result-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .oi-result-table th {
          text-align: left; padding: 8px 12px; color: #888; font-weight: 500;
          border-bottom: 1px solid #2a2a2a; font-size: 11px; text-transform: uppercase;
        }
        .oi-result-table td {
          padding: 10px 12px; color: #ccc; border-bottom: 1px solid #1a1a1a;
        }
        .oi-result-table tr:last-child td { border-bottom: none; }
      `}</style>
    </div>
  );
}
