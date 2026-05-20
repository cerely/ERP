import { useState, useEffect } from 'react';

export default function LogsView() {
  const [logs, setLogs] = useState([]);
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    }) + ' ' + d.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', borderBottom: '1px solid #333', paddingBottom: '16px' }}>
        <h2 style={{ margin: 0, color: '#fff' }}>System Activity Logs</h2>
        <button className="vbtn" onClick={fetchLogs} style={{ background: '#333' }}>Refresh</button>
      </div>

      <div style={{ background: '#111', borderRadius: '12px', border: '1px solid #333', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#1a1a1a', borderBottom: '1px solid #333' }}>
              <th style={{ padding: '16px', color: '#888', fontWeight: '500' }}>Timestamp</th>
              <th style={{ padding: '16px', color: '#888', fontWeight: '500' }}>User</th>
              <th style={{ padding: '16px', color: '#888', fontWeight: '500' }}>Order #</th>
              <th style={{ padding: '16px', color: '#888', fontWeight: '500' }}>Department</th>
              <th style={{ padding: '16px', color: '#888', fontWeight: '500' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#666' }}>No activity logs found.</td>
              </tr>
            ) : (
              logs.map(log => (
                <tr key={log.id} style={{ borderBottom: '1px solid #222' }}>
                  <td style={{ padding: '16px', color: '#aaa', whiteSpace: 'nowrap' }}>{formatDate(log.timestamp)}</td>
                  <td style={{ padding: '16px', color: '#fff', fontWeight: 'bold' }}>{log.username}</td>
                  <td style={{ padding: '16px' }}>
                    {log.order_number 
                      ? <span style={{ fontFamily: 'monospace', fontSize: '11px', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(245,158,11,0.2)' }}>{log.order_number}</span>
                      : <span style={{ color: '#444' }}>—</span>
                    }
                  </td>
                  <td style={{ padding: '16px', color: 'var(--accent)' }}>{log.dept || '-'}</td>
                  <td style={{ padding: '16px', color: '#ddd' }}>{log.action_text}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
