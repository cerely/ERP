import { DEPTS } from '../data/planningData';

const BOM_STATES = [
  { key: 'Stock Check',       label: '① Stock Check' },
  { key: 'Material Allotted', label: '② Material Allotted' },
  { key: 'Acceptance',        label: '③ Acceptance' },
  { key: 'Accept-Complete',   label: '④ Accept-Complete' },
];

export default function Sidenav({
  steps,
  currentFilter,
  onFilterDept,
  bomState,
  onSetBomState,
  designType,
  onSetDesignType,
  currentView,
  onSetView,
  userRole,
}) {
  return (
    <div className="sidenav">
      <div className="sidenav-section">Order Management</div>
      <button 
        className={`dept-btn${currentView === 'orders' ? ' active' : ''}`}
        onClick={() => onSetView('orders')}
      >
        <span className="dept-dot" style={{ background: '#3b82f6' }} />
        Order List
      </button>
      {['Admin', 'Manager', 'Sales'].includes(userRole) && (
        <button 
          className={`dept-btn${currentView === 'new-order' ? ' active' : ''}`}
          onClick={() => onSetView('new-order')}
        >
          <span className="dept-dot" style={{ background: '#10b981' }} />
          New Order
        </button>
      )}
      
      <button 
        className={`dept-btn${currentView === 'masters' ? ' active' : ''}`}
        onClick={() => onSetView('masters')}
      >
        <span className="dept-dot" style={{ background: '#8b5cf6' }} />
        Masters
      </button>

      <div className="sidenav-section" style={{ marginTop: 12 }}>Departments</div>

      {/* All */}
      <button
        className={`dept-btn${currentFilter === 'all' ? ' active' : ''}`}
        onClick={() => onFilterDept('all')}
      >
        <span className="dept-dot" style={{ background: 'var(--accent)' }} />
        All Departments
      </button>

      {/* Per-dept */}
      {DEPTS.map((dept) => {
        const done = steps.filter((s) => s.dept === dept.id && s.status === 'done').length;
        const total = steps.filter((s) => s.dept === dept.id).length;
        return (
          <button
            key={dept.id}
            className={`dept-btn${currentFilter === dept.id ? ' active' : ''}`}
            onClick={() => {
              onFilterDept(dept.id);
              onSetView('flow');
            }}
          >
            <span className="dept-dot" style={{ background: dept.color }} />
            {dept.label}
            <span className="dept-count">{done}/{total}</span>
          </button>
        );
      })}

      {/* BOM Status */}
      <div className="sidenav-section" style={{ marginTop: 8 }}>BOM Status</div>
      <div style={{ padding: '0 12px 12px' }}>
        {BOM_STATES.map((bs) => {
          const canEditBOM = ['Admin', 'Manager', 'Accounts', 'Production'].includes(userRole);
          return (
            <div
              key={bs.key}
              className={`bom-state${bomState === bs.key ? ' active-state' : ''}${!canEditBOM ? ' read-only' : ''}`}
              onClick={() => canEditBOM && onSetBomState(bs.key)}
            >
              {bs.label}
            </div>
          );
        })}
      </div>

      {/* Design Type */}
      <div className="sidenav-section">Design Type</div>
      <div style={{ padding: '0 12px 12px' }}>
        <div className={designType === 'Standard' ? 'tag-standard' : 'tag-nonstandard'}>
          ◆ {designType === 'Standard' ? 'STANDARD' : 'NON-STANDARD'}
        </div>
        <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
          {['Standard', 'Non-Standard'].map((type) => {
            const canEditDesign = ['Admin', 'Manager', 'Design'].includes(userRole);
            return (
              <button
                key={type}
                className={`vbtn${designType === type ? ' active' : ''}${!canEditDesign ? ' read-only' : ''}`}
                style={{ flex: 1, fontSize: 10 }}
                onClick={() => canEditDesign && onSetDesignType(type)}
              >
                {type === 'Standard' ? 'Standard' : 'Non-Std'}
              </button>
            );
          })}
        </div>
      </div>

      {userRole === 'Admin' && (
        <div style={{ marginTop: 'auto', padding: '12px' }}>
          <div className="sidenav-section">Administration</div>
          <button 
            className={`dept-btn${currentView === 'users' ? ' active' : ''}`}
            onClick={() => onSetView('users')}
            style={{ width: '100%', justifyContent: 'flex-start' }}
          >
            <span className="dept-dot" style={{ background: 'var(--accent)' }} />
            User Directory
          </button>
          <button 
            className={`dept-btn${currentView === 'logs' ? ' active' : ''}`}
            onClick={() => onSetView('logs')}
            style={{ width: '100%', justifyContent: 'flex-start', marginTop: '8px' }}
          >
            <span className="dept-dot" style={{ background: '#f59e0b' }} />
            System Logs
          </button>
        </div>
      )}
    </div>
  );
}
