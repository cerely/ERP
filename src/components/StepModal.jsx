import { useState, useEffect } from 'react';
import DocumentManager from './DocumentManager';

export default function StepModal({ step, isOpen, onClose, onSave, onDelete, userRole, selectedOrder }) {
  const [status, setStatus] = useState('pending');
  const [notes, setNotes] = useState('');
  const [qcFailTarget, setQcFailTarget] = useState(null);
  const [dispatchDate, setDispatchDate] = useState('');
  const [checklist, setChecklist] = useState({ layout: false, electrical: false, bom: false });
  const [docCount, setDocCount] = useState(0);
  const [customFields, setCustomFields] = useState([]);
  const [activeTab, setActiveTab] = useState('details');

  const canEditStructure = ['Admin', 'Manager'].includes(userRole);

  useEffect(() => {
    if (step) {
      setStatus(step.status);
      setNotes(step.notes || '');
      setDispatchDate(step.dispatch_date || '');
      setQcFailTarget(null);
      setChecklist({ layout: false, electrical: false, bom: false });
      setDocCount(0);
      setActiveTab('details');
      try {
        const cf = Array.isArray(step.custom_fields) ? step.custom_fields : JSON.parse(step.custom_fields || '[]');
        setCustomFields(Array.isArray(cf) ? cf : []);
      } catch {
        setCustomFields([]);
      }
    }
  }, [step]);

  if (!isOpen || !step) return null;

  const handleSave = () => {
    if (step.requires_upload && status === 'done' && docCount === 0) {
      alert('You must upload at least one document to complete this task.');
      return;
    }
    onSave({ status, notes, qcFailTarget, dispatchDate, checklist, custom_fields: customFields });
  };

  const updateFieldValue = (idx, value) => {
    setCustomFields(prev => prev.map((f, i) => i === idx ? { ...f, value } : f));
  };

  const handleOverlayClick = (e) => {
    if (e.target.className === 'modal-overlay open') onClose();
  };

  const renderFieldInput = (field, idx) => {
    switch (field.type) {
      case 'Text':
        return (
          <input
            type="text"
            className="form-input"
            value={field.value || ''}
            onChange={e => updateFieldValue(idx, e.target.value)}
            placeholder={`Enter ${field.label}...`}
          />
        );
      case 'Number':
        return (
          <input
            type="number"
            className="form-input"
            value={field.value || ''}
            onChange={e => updateFieldValue(idx, e.target.value)}
          />
        );
      case 'Date':
        return (
          <input
            type="date"
            className="form-input"
            value={field.value || ''}
            onChange={e => updateFieldValue(idx, e.target.value)}
          />
        );
      case 'Yes/No':
        return (
          <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
            {['Yes', 'No'].map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => updateFieldValue(idx, opt)}
                style={{
                  padding: '6px 20px',
                  borderRadius: '6px',
                  border: '1px solid',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '600',
                  background: field.value === opt
                    ? (opt === 'Yes' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)')
                    : 'transparent',
                  borderColor: field.value === opt
                    ? (opt === 'Yes' ? '#10b981' : '#ef4444')
                    : '#444',
                  color: field.value === opt
                    ? (opt === 'Yes' ? '#10b981' : '#ef4444')
                    : '#888',
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        );
      case 'Dropdown':
        return (
          <select
            className="form-select"
            value={field.value || ''}
            onChange={e => updateFieldValue(idx, e.target.value)}
          >
            <option value="">-- Select --</option>
            {(field.options || []).map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      default:
        return <input type="text" className="form-input" value={field.value || ''} onChange={e => updateFieldValue(idx, e.target.value)} placeholder={`Enter ${field.label}...`} />;
    }
  };

  return (
    <div className="modal-overlay open" onClick={handleOverlayClick}>
      <div className="modal" style={{ maxWidth: '600px', width: '95%' }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{step.name}</div>
            <div className="modal-sub">{step.dept} — {step.sub}</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Tabs — only show Form Fields tab if there are fields */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #333', padding: '0 24px' }}>
          {(['details', ...(customFields.length > 0 ? ['fields'] : []), 'documents']).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid #3b82f6' : '2px solid transparent',
                color: activeTab === tab ? '#60a5fa' : '#888',
                padding: '10px 16px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: activeTab === tab ? '600' : '400',
                textTransform: 'capitalize',
                marginBottom: '-1px',
              }}
            >
              {tab === 'fields' ? 'Form Fields' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'fields' && (
                <span style={{ marginLeft: 6, background: '#3b82f6', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '10px' }}>
                  {customFields.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="modal-body">

          {/* ── TAB: DETAILS ── */}
          {activeTab === 'details' && (
            <>
              {/* Order Reference Fields */}
              {selectedOrder && step.order_fields && step.order_fields.length > 0 && (
                <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '10px', color: '#3b82f6', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Order Reference</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
                    {step.order_fields.map(key => {
                      const labelMap = { order_number: 'Order #', company_name: 'Company', delivery_date: 'Delivery Date', po_number: 'PO Number', packaging_type: 'Packaging', priority: 'Priority', notes: 'Order Notes' };
                      let val = selectedOrder[key];
                      if (key === 'delivery_date' && val) val = new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                      return (
                        <div key={key} style={{ background: '#111', borderRadius: '6px', padding: '8px 10px' }}>
                          <div style={{ fontSize: '10px', color: '#555', marginBottom: '3px' }}>{labelMap[key] || key}</div>
                          <div style={{ fontSize: '13px', color: '#ddd', fontWeight: '500' }}>{val || '—'}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {step.special === 'sales' && userRole === 'Sales' && (
                <div className="sales-action-box">
                  <div className="action-label">Action Required:</div>
                  <div className="action-text">Initialize the order to generate unique unit IDs and upload primary documents.</div>
                  <button className="action-btn" onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('setView', { detail: 'new-order' })); }}>
                    Go to Order Creation
                  </button>
                </div>
              )}

              <div className="modal-field">
                <label>Status</label>
                <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="pending">Pending</option>
                  <option value="inprogress">In Progress</option>
                  <option value="review">Under Review</option>
                  <option value="done">Done</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>

              {step.special === 'qc' && (
                <div id="qcFailArea">
                  <label style={{ fontSize: 10, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>If QC Fail — return to:</label>
                  <div className="qc-options">
                    <div className={`qc-opt${qcFailTarget === 'production' ? ' selected' : ''}`} onClick={() => setQcFailTarget('production')}>
                      ↩ Production<br /><span style={{ fontSize: 9, opacity: 0.7 }}>Rework</span>
                    </div>
                    <div className={`qc-opt${qcFailTarget === 'design' ? ' selected' : ''}`} onClick={() => setQcFailTarget('design')}>
                      ↩ Design<br /><span style={{ fontSize: 9, opacity: 0.7 }}>Re-check</span>
                    </div>
                  </div>
                </div>
              )}

              {step.special === 'design' && (
                <div className="design-checklist">
                  <div className="design-checklist-title">Simultaneous Release Checklist</div>
                  <label><input type="checkbox" checked={checklist.layout} onChange={(e) => setChecklist({ ...checklist, layout: e.target.checked })} /> Panel Layout (for Fitter)</label>
                  <label><input type="checkbox" checked={checklist.electrical} onChange={(e) => setChecklist({ ...checklist, electrical: e.target.checked })} /> Electrical Design (for Wireman)</label>
                  <label><input type="checkbox" checked={checklist.bom} onChange={(e) => setChecklist({ ...checklist, bom: e.target.checked })} /> BOM Released to Purchase &amp; Stores</label>
                </div>
              )}

              {step.special === 'dispatch' && (
                <div className="modal-field">
                  <label>Confirmed Dispatch Date</label>
                  <input type="date" className="form-input" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} />
                </div>
              )}

              <div className="modal-field">
                <label>Notes / Remarks</label>
                <textarea className="form-textarea" placeholder="Add notes…" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </>
          )}

          {/* ── TAB: FORM FIELDS ── */}
          {activeTab === 'fields' && customFields.length > 0 && (
            <div>
              <div style={{ color: '#888', fontSize: '12px', marginBottom: '16px' }}>
                Fill in the required information for this task.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {customFields.map((field, idx) => (
                  <div key={idx} style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '12px 16px' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <span style={{ color: '#eee', fontSize: '13px', fontWeight: '600' }}>{field.label}</span>
                      <span style={{ marginLeft: '8px', fontSize: '10px', color: '#555', textTransform: 'uppercase', background: '#222', padding: '1px 5px', borderRadius: '3px' }}>{field.type}</span>
                    </div>
                    {renderFieldInput(field, idx)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB: DOCUMENTS ── */}
          {activeTab === 'documents' && (
            <div>
              {step.requires_upload && (
                <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, color: '#fbbf24', fontSize: 13 }}>
                  ⚠️ This task requires at least one document to be marked as Done.
                </div>
              )}
              <DocumentManager
                entityType="Step"
                entityId={step.id}
                initialDocs={[]}
                onDocsUpdate={(docs) => setDocCount(docs.length)}
              />
            </div>
          )}

          {/* Actions */}
          <div className="modal-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #222' }}>
            {canEditStructure ? (
              <button
                className="vbtn"
                style={{ background: 'transparent', border: '1px solid #ef444444', color: '#ef4444' }}
                onClick={() => onDelete(step.id)}
              >
                Delete Task
              </button>
            ) : <div />}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn-cancel" onClick={onClose}>Cancel</button>
              <button className="btn-save" onClick={handleSave}>Update Status</button>
            </div>
          </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .sales-action-box {
          background: rgba(20, 184, 166, 0.1);
          border: 1px solid rgba(20, 184, 166, 0.2);
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
        }
        .action-label { color: var(--teal); font-size: 11px; font-weight: 700; margin-bottom: 4px; text-transform: uppercase; }
        .action-text { color: #ccc; font-size: 13px; margin-bottom: 12px; line-height: 1.4; }
        .action-btn {
          background: var(--teal);
          color: #000;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
        }
        .action-btn:hover { opacity: 0.9; }
      `}} />
    </div>
  );
}
