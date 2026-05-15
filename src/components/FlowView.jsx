import { DEPTS, STATUS_BADGE_MAP } from '../data/planningData';

function StatusBadge({ status }) {
  const { cls, label } = STATUS_BADGE_MAP[status] || STATUS_BADGE_MAP.pending;
  return <span className={`step-status-badge ${cls}`}>{label}</span>;
}

export default function FlowView({ steps, currentFilter, onOpenModal, onSetView, userRole }) {
  const depts = currentFilter === 'all' ? DEPTS : DEPTS.filter((d) => d.id === currentFilter);

  return (
    <div className="lanes">
      {depts.map((dept) => {
        const deptSteps = steps.filter((s) => s.dept === dept.id);
        const hasBlocked = deptSteps.some((s) => s.status === 'blocked');

        return (
          <div key={dept.id} className={`lane${hasBlocked ? ' active-lane' : ''}`}>
            <div className="lane-label">
              <div style={{ width: 3, height: 20, background: dept.color, borderRadius: 2, marginBottom: 6 }} />
              <div className="lane-name">{dept.label}</div>
              <div className="lane-sub">{dept.sub}</div>
              {dept.id === 'Sales' && userRole === 'Admin' && (
                <button 
                  className="vbtn" 
                  style={{ marginTop: 12, width: '100%', fontSize: 11, background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}
                  onClick={() => onSetView('new-order')}
                >
                  + New Order
                </button>
              )}
            </div>
            <div className="lane-steps">
              {deptSteps.map((step, i) => {
                const canEdit = ['Admin', 'Manager'].includes(userRole) || step.dept === userRole;
                return (
                  <div key={step.id} style={{ display: 'flex', alignItems: 'center' }}>
                    <div 
                      className={`step status-${step.status}${!canEdit ? ' read-only' : ''}${step.dept === 'Sales' && step.status === 'pending' ? ' pulse-sales' : ''}`}
                      onClick={() => canEdit && onOpenModal(step.id)}
                    >
                      <span className={`step-dot dot-${step.status}`} />
                      <div className="step-num">{dept.id.toUpperCase().slice(0, 3)}-{String(i + 1).padStart(2, '0')}</div>
                      <div className="step-name">{step.name}</div>
                      <div className="step-sub">{step.sub}</div>
                      <StatusBadge status={step.status} />
                      {step.notes && <div className="step-note">{step.notes}</div>}
                    </div>
                    {i < deptSteps.length - 1 && <div className="step-arrow">›</div>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      
      <style dangerouslySetInnerHTML={{ __html: `
        .pulse-sales {
          animation: sales-glow 2s infinite ease-in-out;
          border: 1px solid rgba(20, 184, 166, 0.4) !important;
        }
        @keyframes sales-glow {
          0% { box-shadow: 0 0 0 0 rgba(20, 184, 166, 0.2); }
          50% { box-shadow: 0 0 15px 0 rgba(20, 184, 166, 0.4); }
          100% { box-shadow: 0 0 0 0 rgba(20, 184, 166, 0.2); }
        }
      `}} />
    </div>
  );
}
