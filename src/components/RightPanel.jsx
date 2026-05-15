import { DEPTS } from '../data/planningData';

export default function RightPanel({ selectedStep, activityLog }) {
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
