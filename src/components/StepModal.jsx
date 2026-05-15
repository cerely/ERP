import { useState, useEffect } from 'react';

export default function StepModal({ step, isOpen, onClose, onSave, userRole }) {
  const [status, setStatus] = useState('pending');
  const [notes, setNotes] = useState('');
  const [qcFailTarget, setQcFailTarget] = useState(null);
  const [dispatchDate, setDispatchDate] = useState('');
  const [checklist, setChecklist] = useState({
    layout: false,
    electrical: false,
    bom: false,
  });

  useEffect(() => {
    if (step) {
      setStatus(step.status);
      setNotes(step.notes || '');
      setDispatchDate(step.dispatchDate || '');
      setQcFailTarget(null);
      setChecklist({ layout: false, electrical: false, bom: false });
    }
  }, [step]);

  if (!isOpen || !step) return null;

  const handleSave = () => {
    onSave({
      status,
      notes,
      qcFailTarget,
      dispatchDate,
      checklist,
    });
  };

  const handleOverlayClick = (e) => {
    if (e.target.className === 'modal-overlay open') onClose();
  };

  return (
    <div className="modal-overlay open" onClick={handleOverlayClick}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">{step.name}</div>
            <div className="modal-sub">{step.dept} — {step.sub}</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {/* Sales Special Action - ADMIN ONLY */}
          {step.special === 'sales' && userRole === 'Admin' && (
            <div className="sales-action-box">
              <div className="action-label">Action Required:</div>
              <div className="action-text">Initialize the order to generate unique unit IDs and upload primary documents.</div>
              <button 
                className="action-btn"
                onClick={() => {
                  onClose();
                  window.dispatchEvent(new CustomEvent('setView', { detail: 'new-order' }));
                }}
              >
                Go to Order Creation
              </button>
            </div>
          )}

          <div className="modal-field">
            <label>Status</label>
            <select
              className="form-select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="pending">Pending</option>
              <option value="inprogress">In Progress</option>
              <option value="review">Under Review</option>
              <option value="done">Done</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>

          {/* QC special fail options */}
          {step.special === 'qc' && (
            <div id="qcFailArea">
              <label style={{ fontSize: 10, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>
                If QC Fail — return to:
              </label>
              <div className="qc-options">
                <div
                  className={`qc-opt${qcFailTarget === 'production' ? ' selected' : ''}`}
                  onClick={() => setQcFailTarget('production')}
                >
                  ↩ Production<br /><span style={{ fontSize: 9, opacity: 0.7 }}>Rework</span>
                </div>
                <div
                  className={`qc-opt${qcFailTarget === 'design' ? ' selected' : ''}`}
                  onClick={() => setQcFailTarget('design')}
                >
                  ↩ Design<br /><span style={{ fontSize: 9, opacity: 0.7 }}>Re-check</span>
                </div>
              </div>
            </div>
          )}

          {/* Design release fields */}
          {step.special === 'design' && (
            <div className="design-checklist">
              <div className="design-checklist-title">Simultaneous Release Checklist</div>
              <label>
                <input
                  type="checkbox"
                  checked={checklist.layout}
                  onChange={(e) => setChecklist({ ...checklist, layout: e.target.checked })}
                /> Panel Layout (for Fitter)
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={checklist.electrical}
                  onChange={(e) => setChecklist({ ...checklist, electrical: e.target.checked })}
                /> Electrical Design (for Wireman)
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={checklist.bom}
                  onChange={(e) => setChecklist({ ...checklist, bom: e.target.checked })}
                /> BOM Released to Purchase &amp; Stores
              </label>
            </div>
          )}

          {/* Dispatch date field */}
          {step.special === 'dispatch' && (
            <div className="modal-field">
              <label>Confirmed Dispatch Date</label>
              <input
                type="date"
                className="form-input"
                value={dispatchDate}
                onChange={(e) => setDispatchDate(e.target.value)}
              />
            </div>
          )}

          <div className="modal-field">
            <label>Notes / Remarks</label>
            <textarea
              className="form-textarea"
              placeholder="Add notes…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="modal-actions">
            <button className="btn-cancel" onClick={onClose}>Cancel</button>
            <button className="btn-save" onClick={handleSave}>Update Status</button>
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
