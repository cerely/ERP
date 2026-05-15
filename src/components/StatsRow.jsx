export default function StatsRow({ steps, currentFilter }) {
  const filtered = currentFilter === 'all' ? steps : steps.filter((s) => s.dept === currentFilter);
  const done = filtered.filter((s) => s.status === 'done').length;
  const ip = filtered.filter((s) => s.status === 'inprogress').length;
  const blocked = filtered.filter((s) => s.status === 'blocked').length;
  const total = filtered.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const dispStep = steps.find((s) => s.id === 's2');
  const dispDate = dispStep?.dispatchDate || '—';

  return (
    <div className="stats-row">
      <div className="stat-card">
        <div className="stat-label">Order Status</div>
        <div className="stat-value" style={{ color: 'var(--blue)', fontSize: 14, marginTop: 2 }}>
          IN PROGRESS
        </div>
        <div className="stat-sub">ORD-2026-001</div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Steps Done</div>
        <div className="stat-value" style={{ color: 'var(--green)' }}>{done}</div>
        <div className="stat-sub">of {total} steps</div>
        <div className="prog-bar">
          <div className="prog-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-label">In Progress</div>
        <div className="stat-value" style={{ color: 'var(--blue)' }}>{ip}</div>
        <div className="stat-sub">active steps</div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Blocked</div>
        <div className="stat-value" style={{ color: 'var(--red)' }}>{blocked}</div>
        <div className="stat-sub">need attention</div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Dispatch Date</div>
        <div className="stat-value" style={{ color: 'var(--accent)', fontSize: 14, marginTop: 2 }}>
          {dispDate}
        </div>
        <div className="stat-sub">confirmed by Planning</div>
      </div>
    </div>
  );
}
