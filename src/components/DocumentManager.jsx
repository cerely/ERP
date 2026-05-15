import { useState, useEffect } from 'react';

const DOC_TYPES = [
  'PO', 'Quotation', 'BOM', 'Drawing', 'QC Report', 'Dispatch Document', 'Photo'
];

export default function DocumentManager({ entityType, entityId, initialDocs = [], onUploadSuccess }) {
  const [docs, setDocs] = useState(initialDocs);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedType, setSelectedType] = useState(DOC_TYPES[0]);
  const token = localStorage.getItem('token');

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    if (docs.length + files.length > 20) {
      alert('Maximum 20 files allowed per entity.');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('entity_type', entityType);
    formData.append('entity_id', entityId);
    formData.append('doc_type', selectedType);
    files.forEach(file => formData.append('files', file));

    try {
      const res = await fetch('http://localhost:5000/api/documents/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (res.ok) {
        const newDocs = await res.json();
        setDocs([...docs, ...newDocs]);
        if (onUploadSuccess) onUploadSuccess(newDocs);
      } else {
        const err = await res.json();
        alert(err.error || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('Network error during upload');
    } finally {
      setIsUploading(false);
      e.target.value = ''; // Reset input
    }
  };

  return (
    <div className="doc-manager">
      <div className="doc-header">
        <h4>Documents ({docs.length}/20)</h4>
        <div className="doc-upload-controls">
          <select 
            value={selectedType} 
            onChange={(e) => setSelectedType(e.target.value)}
            className="doc-type-select"
          >
            {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <label className="upload-btn">
            {isUploading ? 'Uploading...' : 'Add Files'}
            <input 
              type="file" 
              multiple 
              hidden 
              onChange={handleFileChange} 
              disabled={isUploading || docs.length >= 20}
            />
          </label>
        </div>
      </div>

      <div className="doc-list">
        {docs.length === 0 ? (
          <div className="no-docs">No documents uploaded yet.</div>
        ) : (
          docs.map((doc) => (
            <div key={doc.id} className="doc-item">
              <div className="doc-info">
                <span className="doc-type-badge">{doc.doc_type}</span>
                <span className="doc-name" title={doc.file_name}>{doc.file_name}</span>
              </div>
              <div className="doc-meta">
                <span>{(doc.file_size / 1024).toFixed(1)} KB</span>
                <a 
                  href={`http://localhost:5000/${doc.file_path.replace(/\\/g, '/')}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="doc-link"
                >
                  View
                </a>
              </div>
            </div>
          ))
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .doc-manager {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 16px;
          margin-top: 16px;
        }
        .doc-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .doc-header h4 { margin: 0; color: #fff; font-weight: 500; }
        .doc-upload-controls { display: flex; gap: 8px; }
        .doc-type-select {
          background: #1a1a1a;
          border: 1px solid #333;
          color: #ccc;
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 13px;
        }
        .upload-btn {
          background: #3b82f6;
          color: white;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .upload-btn:hover { background: #2563eb; }
        .upload-btn[disabled] { opacity: 0.5; cursor: not-allowed; }
        
        .doc-list {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
          max-height: 300px;
          overflow-y: auto;
          padding-right: 4px;
        }
        .doc-item {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          padding: 10px 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .doc-info { display: flex; align-items: center; gap: 10px; overflow: hidden; }
        .doc-type-badge {
          font-size: 10px;
          text-transform: uppercase;
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
          padding: 2px 6px;
          border-radius: 4px;
          white-space: nowrap;
        }
        .doc-name {
          font-size: 13px;
          color: #eee;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .doc-meta { display: flex; align-items: center; gap: 12px; font-size: 12px; color: #888; }
        .doc-link { color: #3b82f6; text-decoration: none; font-weight: 500; }
        .doc-link:hover { text-decoration: underline; }
        .no-docs { text-align: center; color: #666; font-size: 13px; padding: 20px; }
      `}} />
    </div>
  );
}
