import { DEPTS } from '../data/planningData';

export default function RightPanel({ selectedStep, activityLog, selectedOrder }) {
  const dept = selectedStep ? DEPTS.find((d) => d.id === selectedStep.dept) : null;

  return (
    <div className="right-panel">
      <div className="panel-section">
        <div className="panel-sec-title">Selected Step</div>
        <div id="detailArea">
          {selectedStep ? (
            <div className="detail-card">
              <h4>{selectedStep.name}</h4>
              <div className="detail-row">
                <span className="detail-key">Department</span>
                <span className="detail-val" style={{ color: dept?.color || 'inherit' }}>
                  {selectedStep.dept}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-key">Status</span>
                <span className="detail-val">{selectedStep.status.toUpperCase()}</span>
              </div>
              <div className="detail-row">
                <span className="detail-key">Last updated</span>
                <span className="detail-val">{selectedStep.updated || '—'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-key">Notes</span>
                <span className="detail-val">{selectedStep.notes || '—'}</span>
              </div>
            </div>
          ) : (
            <div className="empty-detail">Click any step in the flow to update its status.</div>
          )}
        </div>
      </div>

      {selectedOrder ? (
        <div className="panel-section">
          <div className="panel-sec-title">Order Overview</div>
          <div className="detail-card">
            <h4 style={{ marginBottom: 4 }}>{selectedOrder.order_number}</h4>
            {selectedOrder.company_name && (
              <div style={{ color: '#aaa', fontSize: 11, marginBottom: 12 }}>
                {selectedOrder.company_name}
              </div>
            )}
            
            <div className="detail-row">
              <span className="detail-key">Priority</span>
              <span className={`detail-val priority-badge ${selectedOrder.priority?.toLowerCase() || 'medium'}`} style={{ fontSize: 10 }}>
                {selectedOrder.priority || 'Medium'}
              </span>
            </div>
            {selectedOrder.po_number && (
              <div className="detail-row">
                <span className="detail-key">PO Number</span>
                <span className="detail-val" style={{ color: '#fff' }}>{selectedOrder.po_number}</span>
              </div>
            )}
            <div className="detail-row">
              <span className="detail-key">Order Date</span>
              <span className="detail-val">{selectedOrder.order_date ? new Date(selectedOrder.order_date).toLocaleDateString() : 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-key">Delivery</span>
              <span className="detail-val" style={{ color: '#fbbf24' }}>{selectedOrder.delivery_date ? new Date(selectedOrder.delivery_date).toLocaleDateString() : 'TBD'}</span>
            </div>
            {selectedOrder.packaging_type && (
              <div className="detail-row">
                <span className="detail-key">Packaging</span>
                <span className="detail-val" style={{ color: '#a78bfa' }}>
                  {selectedOrder.packaging_type === 'Wooden Packaging' ? '🪵' : '🫧'} {selectedOrder.packaging_type}
                </span>
              </div>
            )}
            
            <div style={{ marginTop: 16, borderTop: '1px solid #333', paddingTop: 12 }}>
              <span className="detail-key" style={{ display: 'block', marginBottom: 8 }}>Line Items & Serials</span>
              {selectedOrder.line_items?.map(li => {
                const liUnits = selectedOrder.units?.filter(u => u.line_item_id === li.id) || [];
                return (
                  <div key={li.id} style={{ background: '#111', padding: '8px', borderRadius: '6px', marginBottom: '8px', border: '1px solid #222' }}>
                    <div style={{ fontSize: 11, color: '#eee', fontWeight: 'bold' }}>{li.material_description}</div>
                    {li.panel_type_size && <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>Type/Size: {li.panel_type_size}</div>}
                    <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>
                      Qty: {li.quantity} {li.unit || 'Nos'} 
                      {li.part_number && ` | Part: ${li.part_number}`}
                    </div>
                    {liUnits.length > 0 && (
                      <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {liUnits.map(u => (
                          <span key={u.id} style={{ fontSize: 9, background: '#333', padding: '2px 6px', borderRadius: '4px', color: '#ccc' }}>
                            {u.unit_id}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            <div style={{ marginTop: 8, borderTop: '1px solid #333', paddingTop: 12 }}>
              <span className="detail-key" style={{ display: 'block', marginBottom: 8 }}>Approved Documents</span>
              {selectedOrder.documents?.filter(d => d.doc_type !== 'TaskUpload').length > 0 ? (
                selectedOrder.documents.filter(d => d.doc_type !== 'TaskUpload').map(doc => (
                  <div key={doc.id} style={{ fontSize: 11, color: '#3b82f6', marginBottom: 4 }}>
                    <a href={`http://localhost:5000/uploads/${doc.file_path.split(/[\/\\]/).pop()}?token=${localStorage.getItem('token')}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                      📄 {doc.file_name} ({doc.doc_type})
                    </a>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 10, color: '#666' }}>No general documents uploaded.</div>
              )}
            </div>

          </div>
        </div>
      ) : (
        <div className="panel-section">
          <div className="panel-sec-title">Visibility</div>
          <div style={{ lineHeight: 1.8 }}>
            <div className="vis-tag">
              <span className="vis-dot" style={{ background: 'var(--blue)' }}></span>Sales sees Production plan
            </div>
            <div className="vis-tag">
              <span className="vis-dot" style={{ background: 'var(--blue)' }}></span>QC sees arrival schedule
            </div>
            <div className="vis-tag">
              <span className="vis-dot" style={{ background: 'var(--blue)' }}></span>Dispatch sees QC clearance
            </div>
            <div className="vis-tag">
              <span className="vis-dot" style={{ background: 'var(--teal)' }}></span>Design releases BOM → Purchase &amp; Stores
            </div>
            <div className="vis-tag">
              <span className="vis-dot" style={{ background: 'var(--green)' }}></span>Stores shortfall → Purchase
            </div>
          </div>
        </div>
      )}

      <div className="panel-section" style={{ flex: 1 }}>
        <div className="panel-sec-title">Activity Log</div>
        <div id="activityLog" style={{ maxHeight: 320, overflowY: 'auto' }}>
          {activityLog.slice(0, 50).map((e, i) => (
            <div key={i} className="log-entry">
              <div className="log-time">{e.time}</div>
              <div className="log-text">
                <span className="log-dept">[{e.dept}]</span> <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{e.username}</span>: {e.text}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
