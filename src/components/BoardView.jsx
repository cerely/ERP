import { useState, useEffect } from 'react';
import { Filter } from 'lucide-react';
import { DEPTS, STATUS_BADGE_MAP } from '../data/planningData';

function StatusBadge({ status }) {
  const { cls, label } = STATUS_BADGE_MAP[status] || STATUS_BADGE_MAP.pending;
  return <span className={`step-status-badge ${cls}`}>{label}</span>;
}

export default function BoardView({ currentFilter, userRole, onSetView }) {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('incomplete');
  const [sortBy, setSortBy] = useState('updated');

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchBoard();
  }, []);

  const fetchBoard = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/board', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setOrders(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const depts = currentFilter === 'all' ? DEPTS : DEPTS.filter((d) => d.id === currentFilter);

  if (isLoading) return <div className="loading" style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading board...</div>;

  const displayOrders = orders
    .filter(o => {
      if (priorityFilter !== 'all' && (o.priority || 'Medium').toLowerCase() !== priorityFilter) return false;
      if (statusFilter === 'incomplete' && o.status === 'completed') return false;
      if (statusFilter === 'completed' && o.status !== 'completed') return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'updated') {
        const dateA = new Date(a.updated_at || 0);
        const dateB = new Date(b.updated_at || 0);
        return dateB - dateA;
      }
      return 0; // Default is created_at desc from API
    });

  return (
    <div className="board-view-orders">
      <div className="board-filters">
        <div className="filter-group">
          <Filter size={14} className="filter-icon" />
          <span className="filter-label">Sort:</span>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="board-select">
            <option value="updated">Recently Updated</option>
            <option value="created">Recently Created</option>
          </select>
        </div>
        
        <div className="filter-group">
          <span className="filter-label">Status:</span>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="board-select">
            <option value="all">All Orders</option>
            <option value="incomplete">Incomplete Only</option>
            <option value="completed">Completed Only</option>
          </select>
        </div>

        <div className="filter-group">
          <span className="filter-label">Priority:</span>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="board-select">
            <option value="all">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {displayOrders.map((order) => {
        // Find the specific active steps for the entire order
        let displaySteps = order.steps.filter(s => ['inprogress', 'blocked', 'review'].includes(s.status));
        
        // If no steps are currently in progress, find the VERY NEXT pending step in the sequence
        if (displaySteps.length === 0) {
          const firstPending = order.steps.find(s => s.status === 'pending');
          if (firstPending) {
            displaySteps = [firstPending];
          } else {
            return null; // Entire order is done or has no steps
          }
        }

        // Only show departments that contain these specific active steps
        const orderDepts = depts.filter(dept => displaySteps.some(s => s.dept === dept.id));
        if (orderDepts.length === 0) return null;

        return (
          <div key={order.id} className="board-order-row">
            <h3 className="board-order-title">
              {order.order_number} {order.company_name && <span className="board-order-company">— {order.company_name}</span>}
            </h3>
            
            <div className="board-dept-grid">
              {orderDepts.map(dept => {
                // Only list the specific active steps in the card, not all pending tasks
                const deptSteps = displaySteps.filter(s => s.dept === dept.id);
                
                return (
                  <div 
                    key={dept.id} 
                    className="dept-flow-card" 
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('setView', { detail: { view: 'flow', orderId: order.id } }));
                      onSetView('flow');
                    }}
                  >
                    <div className="dept-card-header">
                      <div className="dept-card-title-row">
                        <div className="dept-color-bar" style={{ background: dept.color }}></div>
                        <div className="dept-card-title">{dept.label}</div>
                      </div>
                      
                      <div className="dept-card-ord-row">
                        <div className="ord-badge">{order.order_number}</div>
                        {order.company_name && (
                          <div style={{ fontSize: '11px', color: '#aaa', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                            {order.company_name}
                          </div>
                        )}
                        {order.delivery_date && (
                          <div className="delivery-badge">
                            <span className="icon">🚚</span> {new Date(order.delivery_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="dept-card-tasks">
                      {deptSteps.map(step => (
                        <div key={step.id} className={`board-task status-${step.status}`}>
                          <span className={`step-dot dot-${step.status}`} />
                          <div className="board-task-name" title={step.name}>{step.name}</div>
                          <StatusBadge status={step.status} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      
      {displayOrders.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>No orders match the current filters.</div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .board-view-orders {
          display: flex;
          flex-direction: column;
          gap: 32px;
          padding-bottom: 40px;
        }
        .board-filters {
          display: flex;
          align-items: center;
          gap: 24px;
          background: rgba(25, 25, 25, 0.4);
          padding: 12px 20px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          margin-bottom: -8px;
        }
        .filter-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .filter-icon {
          color: #888;
        }
        .filter-label {
          font-size: 11px;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .board-select {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #e2e8f0;
          font-size: 12px;
          padding: 4px 8px;
          border-radius: 6px;
          outline: none;
          cursor: pointer;
        }
        .board-select option {
          background: #1a1a1a;
          color: #eee;
        }
        .board-select:hover {
          border-color: rgba(255, 255, 255, 0.2);
        }
        .board-order-title {
          margin: 0 0 20px 0;
          font-size: 20px;
          font-weight: 700;
          color: #f8fafc;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding-bottom: 12px;
          letter-spacing: 0.5px;
        }
        .board-order-company {
          color: #94a3b8;
          font-size: 15px;
          font-weight: normal;
        }
        .board-dept-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 24px;
          align-items: start;
        }
        .dept-flow-card {
          background: rgba(25, 25, 25, 0.6);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-top: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          padding: 20px;
          cursor: pointer;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
          transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s ease, border-color 0.3s ease;
        }
        .dept-flow-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 48px rgba(0, 0, 0, 0.4);
          border-color: rgba(255, 255, 255, 0.15);
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
        .dept-card-tasks {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .board-task {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          font-size: 12px;
          transition: all 0.2s;
        }
        .board-task:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.1);
          transform: translateX(4px);
        }
      `}} />
    </div>
  );
}
