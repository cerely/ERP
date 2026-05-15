import { DEPTS, STATUS_BADGE_MAP } from '../data/planningData';

function StatusBadge({ status }) {
  const { cls, label } = STATUS_BADGE_MAP[status] || STATUS_BADGE_MAP.pending;
  return <span className={`step-status-badge ${cls}`}>{label}</span>;
}

export default function TableView({ steps, currentFilter, onOpenModal, userRole }) {
  const filtered = currentFilter === 'all' ? steps : steps.filter((s) => s.dept === currentFilter);

  return (
    <table className="step-table">
      <thead>
        <tr>
          <th>#</th>
          <th>DEPT</th>
          <th>STEP</th>
          <th>STATUS</th>
          <th>NOTES</th>
          <th>UPDATED</th>
        </tr>
      </thead>
      <tbody>
        {filtered.map((step, i) => {
          const dept = DEPTS.find((d) => d.id === step.dept);
          const canEdit = ['Admin', 'Manager'].includes(userRole) || step.dept === userRole;
          return (
            <tr 
              key={step.id} 
              onClick={() => canEdit && onOpenModal(step.id)}
              className={!canEdit ? 'read-only' : ''}
            >
              <td style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{i + 1}</td>
              <td>
                <span style={{ color: dept?.color || 'var(--text2)', fontWeight: 500 }}>{step.dept}</span>
              </td>
              <td>
                <div style={{ fontWeight: 500 }}>{step.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>{step.sub}</div>
              </td>
              <td><StatusBadge status={step.status} /></td>
              <td style={{ color: 'var(--text3)', fontSize: 11 }}>{step.notes || '—'}</td>
              <td style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{step.updated || '—'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
