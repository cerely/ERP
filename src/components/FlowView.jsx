import { useState, useEffect, useRef } from 'react';
import { DEPTS, STATUS_BADGE_MAP } from '../data/planningData';

function StatusBadge({ status }) {
  const { cls, label } = STATUS_BADGE_MAP[status] || STATUS_BADGE_MAP.pending;
  return <span className={`step-status-badge ${cls}`}>{label}</span>;
}

export default function FlowView({ steps, currentFilter, onOpenModal, onSetView, userRole, selectedOrderId, selectedOrder, onStepsChanged }) {
  const [taskMasters, setTaskMasters] = useState([]);
  const [draggedStep, setDraggedStep] = useState(null);
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetch('http://localhost:5000/api/task_masters', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(async res => {
      if (res.ok) {
        const data = await res.json();
        setTaskMasters(data);
      }
    })
    .catch(console.error);
  }, [token]);

  const handleAddTask = async (taskId) => {
    if (!taskId || !selectedOrderId) return;
    try {
      const res = await fetch(`http://localhost:5000/api/orders/${selectedOrderId}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ taskId })
      });
      if (res.ok) {
        if (onStepsChanged) onStepsChanged();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDragStart = (e, step) => {
    setDraggedStep(step);
    e.dataTransfer.effectAllowed = 'move';
    // Subtle visual feedback
    setTimeout(() => { e.target.style.opacity = '0.5'; }, 0);
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedStep(null);
  };

  const handleDragOver = (e, deptId) => {
    e.preventDefault();
    if (draggedStep && draggedStep.dept !== deptId) {
      e.dataTransfer.dropEffect = 'none'; // Prevent dropping in another lane
    } else {
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDrop = async (e, targetStep) => {
    e.preventDefault();
    if (!draggedStep || draggedStep.id === targetStep.id || draggedStep.dept !== targetStep.dept) {
      return;
    }

    const deptSteps = steps.filter(s => s.dept === targetStep.dept);
    const oldIndex = deptSteps.findIndex(s => s.id === draggedStep.id);
    const newIndex = deptSteps.findIndex(s => s.id === targetStep.id);
    
    if (oldIndex === -1 || newIndex === -1) return;

    // Create new array with reordered items
    const newOrder = [...deptSteps];
    const [removed] = newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, removed);

    const orderedIds = newOrder.map(s => s.id);

    try {
      const res = await fetch(`http://localhost:5000/api/orders/${selectedOrderId}/steps/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ orderedIds })
      });
      if (res.ok && onStepsChanged) {
        onStepsChanged(); // Refresh steps from server
      }
    } catch (err) {
      console.error('Failed to reorder', err);
    }
  };

  const depts = currentFilter === 'all' ? DEPTS : DEPTS.filter((d) => d.id === currentFilter);

  if (currentFilter === 'all') {
    return (
      <div className="lanes">
        {depts.map((dept) => {
          const deptSteps = steps.filter((s) => s.dept === dept.id);
          const hasBlocked = deptSteps.some((s) => s.status === 'blocked');
          const canEdit = ['Admin', 'Manager'].includes(userRole) || dept.id === userRole;
          
          const availableTasks = taskMasters.filter(t => t.dept === dept.id && !deptSteps.some(s => s.task_id === t.id));

          return (
            <div key={dept.id} className={`lane${hasBlocked ? ' active-lane' : ''}`}>
              <div className="lane-label">
                <div style={{ width: 3, height: 20, background: dept.color, borderRadius: 2, marginBottom: 6 }} />
                <div className="lane-name">{dept.label}</div>
                <div className="lane-sub">{dept.sub}</div>
                {dept.id === 'Sales' && userRole === 'Sales' && (
                  <button 
                    className="vbtn" 
                    style={{ marginTop: 12, width: '100%', fontSize: 11, background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}
                    onClick={() => onSetView('new-order')}
                  >
                    + New Order
                  </button>
                )}
                
                {canEdit && availableTasks.length > 0 && selectedOrderId && (
                  <div style={{ marginTop: 12 }}>
                    <select 
                      className="form-select" 
                      style={{ fontSize: 11, padding: '4px 8px', background: 'rgba(255,255,255,0.05)' }}
                      onChange={(e) => {
                        handleAddTask(e.target.value);
                        e.target.value = "";
                      }}
                    >
                      <option value="">+ Add Task...</option>
                      {availableTasks.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="lane-steps">
                {deptSteps.map((step, i) => {
                  const canEditStep = ['Admin', 'Manager'].includes(userRole) || step.dept === userRole;
                  return (
                    <div 
                      key={step.id} 
                      style={{ display: 'flex', alignItems: 'center' }}
                      draggable={canEditStep}
                      onDragStart={(e) => canEditStep && handleDragStart(e, step)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOver(e, dept.id)}
                      onDrop={(e) => canEditStep && handleDrop(e, step)}
                    >
                      <div 
                        className={`step status-${step.status}${!canEditStep ? ' read-only' : ''}${step.dept === 'Sales' && step.status === 'pending' ? ' pulse-sales' : ''}${draggedStep?.id === step.id ? ' dragging' : ''}`}
                        onClick={() => canEditStep && onOpenModal(step.id)}
                        style={{ cursor: canEditStep ? 'grab' : 'pointer' }}
                      >
                        <span className={`step-dot dot-${step.status}`} />
                        <div className="step-num">{dept.id.toUpperCase().slice(0, 3)}-{String(i + 1).padStart(2, '0')}</div>
                        <div className="step-name">
                          {step.name} 
                          {step.requires_upload && <span title="Requires Upload" style={{ marginLeft: 4 }}>📎</span>}
                        </div>
                        <div className="step-sub">{step.sub}</div>
                        <StatusBadge status={step.status} />
                        {step.notes && <div className="step-note">{step.notes}</div>}
                        {step.special === 'sales' && userRole === 'Sales' && (
                          <button 
                            className="vbtn"
                            style={{ marginTop: 8, fontSize: 10, width: '100%', background: 'rgba(20, 184, 166, 0.2)', color: 'var(--teal)', border: '1px solid rgba(20, 184, 166, 0.4)' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSetView('new-order');
                            }}
                          >
                            Go to Order Creation
                          </button>
                        )}
                      </div>
                      {i < deptSteps.length - 1 && <div className="step-arrow">›</div>}
                    </div>
                  );
                })}
                {deptSteps.length === 0 && (
                  <div style={{ padding: 12, color: '#666', fontSize: 11, fontStyle: 'italic', textAlign: 'center' }}>
                    No tasks assigned to this department.
                  </div>
                )}
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

  return (
    <div className="flow-card-grid">
      {depts.map((dept) => {
        const deptSteps = steps.filter((s) => s.dept === dept.id);
        const hasBlocked = deptSteps.some((s) => s.status === 'blocked');
        const canEdit = ['Admin', 'Manager'].includes(userRole) || dept.id === userRole;
        
        // Find tasks from taskMasters that belong to this dept and are not already added
        const availableTasks = taskMasters.filter(t => t.dept === dept.id && !deptSteps.some(s => s.task_id === t.id));

        return (
          <div key={dept.id} className={`dept-flow-card${hasBlocked ? ' has-blocked' : ''}`}>
            <div className="dept-card-header">
              <div className="dept-card-title-row">
                <div className="dept-color-bar" style={{ background: dept.color }}></div>
                <div>
                  <div className="dept-card-title">{dept.label}</div>
                  <div className="dept-card-sub">{dept.sub}</div>
                </div>
              </div>
              
              {selectedOrder && (
                <div className="dept-card-ord-row">
                  <div className="ord-badge">{selectedOrder.order_number}</div>
                  {selectedOrder.company_name && (
                    <div style={{ fontSize: '11px', color: '#aaa', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                      {selectedOrder.company_name}
                    </div>
                  )}
                  {selectedOrder.delivery_date && (
                    <div className="delivery-badge">
                      <span className="icon">🚚</span> {new Date(selectedOrder.delivery_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  )}
                </div>
              )}
              
              {dept.id === 'Sales' && userRole === 'Sales' && (
                <button 
                  className="vbtn" 
                  style={{ marginTop: 8, width: '100%', fontSize: 11, background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}
                  onClick={() => onSetView('new-order')}
                >
                  + New Order
                </button>
              )}
              
              {/* Optional Tasks Add Button */}
              {canEdit && availableTasks.length > 0 && selectedOrderId && (
                <div style={{ marginTop: 8 }}>
                  <select 
                    className="form-select" 
                    style={{ fontSize: 11, padding: '4px 8px', background: 'rgba(255,255,255,0.05)' }}
                    onChange={(e) => {
                      handleAddTask(e.target.value);
                      e.target.value = "";
                    }}
                  >
                    <option value="">+ Add Task...</option>
                    {availableTasks.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            
            <div className="dept-card-tasks-vertical">
              {deptSteps.map((step, i) => {
                const canEditStep = ['Admin', 'Manager'].includes(userRole) || step.dept === userRole;
                return (
                  <div 
                    key={step.id} 
                    style={{ display: 'flex', alignItems: 'center' }}
                    draggable={canEditStep}
                    onDragStart={(e) => canEditStep && handleDragStart(e, step)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, dept.id)}
                    onDrop={(e) => canEditStep && handleDrop(e, step)}
                  >
                    <div 
                      className={`step status-${step.status}${!canEditStep ? ' read-only' : ''}${step.dept === 'Sales' && step.status === 'pending' ? ' pulse-sales' : ''}${draggedStep?.id === step.id ? ' dragging' : ''}`}
                      onClick={() => canEditStep && onOpenModal(step.id)}
                      style={{ cursor: canEditStep ? 'grab' : 'pointer' }}
                    >
                      <span className={`step-dot dot-${step.status}`} />
                      <div className="step-num">{dept.id.toUpperCase().slice(0, 3)}-{String(i + 1).padStart(2, '0')}</div>
                      <div className="step-name">
                        {step.name} 
                        {step.requires_upload && <span title="Requires Upload" style={{ marginLeft: 4 }}>📎</span>}
                      </div>
                      <div className="step-sub">{step.sub}</div>
                      <StatusBadge status={step.status} />
                      {step.notes && <div className="step-note">{step.notes}</div>}
                      {step.special === 'sales' && userRole === 'Sales' && (
                        <button 
                          className="vbtn"
                          style={{ marginTop: 8, fontSize: 10, width: '100%', background: 'rgba(20, 184, 166, 0.2)', color: 'var(--teal)', border: '1px solid rgba(20, 184, 166, 0.4)' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSetView('new-order');
                          }}
                        >
                          Go to Order Creation
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {deptSteps.length === 0 && (
                <div style={{ padding: 12, color: '#666', fontSize: 11, fontStyle: 'italic', textAlign: 'center' }}>
                  No tasks assigned to this department.
                </div>
              )}
            </div>
          </div>
        );
      })}
      
      <style dangerouslySetInnerHTML={{ __html: `
        .flow-card-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 24px;
          align-items: start;
          padding-bottom: 40px;
        }
        .dept-flow-card {
          background: rgba(25, 25, 25, 0.6);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-top: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
          transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s ease, border-color 0.3s ease;
        }
        .dept-flow-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 48px rgba(0, 0, 0, 0.4);
          border-color: rgba(255, 255, 255, 0.15);
        }
        .dept-flow-card.has-blocked {
          border-color: rgba(239, 68, 68, 0.5);
          box-shadow: 0 0 20px rgba(239, 68, 68, 0.15);
          background: linear-gradient(180deg, rgba(239, 68, 68, 0.03) 0%, rgba(25, 25, 25, 0.6) 100%);
        }
        .dept-card-header {
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px dashed rgba(255, 255, 255, 0.1);
        }
        .dept-card-title-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }
        .dept-color-bar {
          width: 4px;
          height: 32px;
          border-radius: 4px;
        }
        .dept-card-title {
          font-size: 15px;
          font-weight: 700;
          color: #f8fafc;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .dept-card-sub {
          font-size: 11px;
          color: #94a3b8;
          margin-top: 2px;
        }
        .dept-card-ord-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(0, 0, 0, 0.2);
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.03);
        }
        .ord-badge {
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-weight: 600;
          font-size: 13px;
          color: #cbd5e1;
        }
        .delivery-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: #a78bfa;
          background: rgba(167, 139, 250, 0.1);
          padding: 4px 8px;
          border-radius: 6px;
          border: 1px solid rgba(167, 139, 250, 0.2);
          font-weight: 500;
        }
        .delivery-badge .icon {
          font-size: 10px;
        }
        .dept-card-tasks-vertical {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        /* Override standard .step to look better in vertical list */
        .dept-card-tasks-vertical .step {
          width: 100%;
          min-width: 0;
          max-width: none;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          transition: all 0.2s;
        }
        .dept-card-tasks-vertical .step:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.1);
          transform: translateX(4px);
        }
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
