import { useState, useEffect } from 'react';
import { DEPTS } from '../data/planningData';

const FIELD_TYPES = ['Text', 'Number', 'Date', 'Yes/No', 'Dropdown'];

const ORDER_FIELDS = [
  { key: 'order_number',    label: 'Order Number' },
  { key: 'company_name',   label: 'Company Name' },
  { key: 'delivery_date',  label: 'Delivery Date' },
  { key: 'po_number',      label: 'PO Number' },
  { key: 'packaging_type', label: 'Packaging Type' },
  { key: 'priority',       label: 'Priority' },
  { key: 'notes',          label: 'Order Notes' },
];

export default function Masters() {
  const [activeTab, setActiveTab] = useState('companies');
  
  // Companies State
  const [companies, setCompanies] = useState([]);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [companyFormData, setCompanyFormData] = useState({
    name: '',
    locations: [{ address: '', city: '', person_in_charge: '', contact_number: '', email: '' }]
  });

  // Tasks State
  const [tasks, setTasks] = useState([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [taskFormData, setTaskFormData] = useState({
    dept: 'Sales',
    name: '',
    sub: '',
    special: '',
    is_mandatory: true,
    requires_upload: false,
    order_fields: []
  });
  const [taskCustomFields, setTaskCustomFields] = useState([]);
  const [showFieldBuilder, setShowFieldBuilder] = useState(false);
  const [newField, setNewField] = useState({ label: '', type: 'Text', options: '' });

  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const canEditMasters = ['Admin', 'Manager'].includes(user.role);

  useEffect(() => {
    fetchCompanies();
    fetchTasks();
  }, []);

  const fetchCompanies = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/companies', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setCompanies(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/task_masters', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setTasks(await res.json());
    } catch (err) { console.error(err); }
  };

  const handleLocationChange = (index, field, value) => {
    const newLocs = [...companyFormData.locations];
    newLocs[index][field] = value;
    setCompanyFormData({ ...companyFormData, locations: newLocs });
  };

  const addLocation = () => {
    setCompanyFormData({
      ...companyFormData,
      locations: [...companyFormData.locations, { address: '', city: '', person_in_charge: '', contact_number: '', email: '' }]
    });
  };

  const handleCompanySubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:5000/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(companyFormData)
      });
      if (res.ok) {
        setShowCompanyModal(false);
        setCompanyFormData({ name: '', locations: [{ address: '', city: '', person_in_charge: '', contact_number: '', email: '' }] });
        fetchCompanies();
      }
    } catch (err) { console.error(err); }
  };

  const handleTaskSubmit = async (e) => {
    e.preventDefault();
    const isEdit = !!editingTaskId;
    const url = isEdit ? `http://localhost:5000/api/task_masters/${editingTaskId}` : 'http://localhost:5000/api/task_masters';
    const method = isEdit ? 'PUT' : 'POST';

    // Strip values from field definitions before saving to template
    const fieldDefs = taskCustomFields.map(({ id, label, type, options }) => ({ id, label, type, options: options || [] }));

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ...taskFormData, custom_fields: fieldDefs, order_fields: taskFormData.order_fields || [] })
      });
      if (res.ok) {
        setShowTaskModal(false);
        setEditingTaskId(null);
        setTaskFormData({ dept: 'Sales', name: '', sub: '', special: '', is_mandatory: true, requires_upload: false, order_fields: [] });
        setTaskCustomFields([]);
        setShowFieldBuilder(false);
        fetchTasks();
      } else {
        alert('Failed to save task');
      }
    } catch (err) { console.error(err); }
  };

  const handleEditTaskClick = (task) => {
    setEditingTaskId(task.id);
    setTaskFormData({
      dept: task.dept,
      name: task.name,
      sub: task.sub || '',
      special: task.special || '',
      is_mandatory: task.is_mandatory,
      requires_upload: task.requires_upload,
      order_fields: Array.isArray(task.order_fields) ? task.order_fields : (task.order_fields ? JSON.parse(task.order_fields) : [])
    });
    try {
      const cf = Array.isArray(task.custom_fields) ? task.custom_fields : JSON.parse(task.custom_fields || '[]');
      setTaskCustomFields(cf);
    } catch { setTaskCustomFields([]); }
    setShowFieldBuilder(false);
    setShowTaskModal(true);
  };

  const addTaskField = () => {
    if (!newField.label.trim()) { alert('Label is required.'); return; }
    const field = {
      id: Date.now(),
      label: newField.label.trim(),
      type: newField.type,
      options: newField.type === 'Dropdown' ? newField.options.split(',').map(o => o.trim()).filter(Boolean) : [],
    };
    setTaskCustomFields(prev => [...prev, field]);
    setNewField({ label: '', type: 'Text', options: '' });
    setShowFieldBuilder(false);
  };

  const removeTaskField = (id) => setTaskCustomFields(prev => prev.filter(f => f.id !== id));

  const handleDeleteTaskClick = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      const res = await fetch(`http://localhost:5000/api/task_masters/${taskId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchTasks();
      } else {
        alert('Failed to delete task');
      }
    } catch (err) { console.error(err); }
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: '1px solid #333', paddingBottom: '16px' }}>
        <button className={`vbtn ${activeTab === 'companies' ? 'active' : ''}`} onClick={() => setActiveTab('companies')}>Companies</button>
        <button className={`vbtn ${activeTab === 'tasks' ? 'active' : ''}`} onClick={() => setActiveTab('tasks')}>Task Masters</button>
      </div>

      {activeTab === 'companies' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
            <h2 style={{ margin: 0, color: '#fff' }}>Company Masters</h2>
            <button className="vbtn" onClick={() => setShowCompanyModal(true)}>+ Register Company</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {companies.map(comp => (
              <div key={comp.id} style={{ background: '#1a1a1a', padding: '20px', borderRadius: '12px', border: '1px solid #333' }}>
                <h3 style={{ margin: '0 0 16px 0', color: '#fff' }}>{comp.name}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                  {comp.locations.map(loc => (
                    <div key={loc.id} style={{ background: '#111', padding: '16px', borderRadius: '8px', border: '1px solid #222' }}>
                      <div style={{ color: '#3b82f6', fontWeight: 'bold', marginBottom: '8px' }}>{loc.city}</div>
                      <div style={{ fontSize: '13px', color: '#bbb', marginBottom: '4px' }}>{loc.address}</div>
                      <div style={{ fontSize: '12px', color: '#888', marginTop: '12px' }}>
                        <div><strong>Contact:</strong> {loc.person_in_charge || 'N/A'}</div>
                        <div><strong>Phone:</strong> {loc.contact_number || 'N/A'}</div>
                        <div><strong>Email:</strong> {loc.email || 'N/A'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'tasks' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
            <h2 style={{ margin: 0, color: '#fff' }}>Task Masters</h2>
            {canEditMasters && (
              <button className="vbtn" onClick={() => {
                setEditingTaskId(null);
                setTaskFormData({ dept: 'Sales', name: '', sub: '', special: '', is_mandatory: true, requires_upload: false });
                setShowTaskModal(true);
              }}>+ New Task</button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {DEPTS.map(dept => {
              const deptTasks = tasks.filter(t => t.dept === dept.id);
              if (deptTasks.length === 0) return null;
              
              return (
                <div key={dept.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <div style={{ width: '4px', height: '16px', background: dept.color, borderRadius: '2px' }} />
                    <h3 style={{ margin: 0, color: '#fff', fontSize: '15px' }}>{dept.label}</h3>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                    {deptTasks.map(task => (
                      <div key={task.id} style={{ background: '#1a1a1a', padding: '16px', borderRadius: '8px', border: '1px solid #333' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', color: dept.color, fontWeight: 'bold', textTransform: 'uppercase' }}>{task.dept}</span>
                          <span style={{ fontSize: '10px', background: task.is_mandatory ? '#3b82f644' : '#6b728044', color: task.is_mandatory ? '#60a5fa' : '#9ca3af', padding: '2px 6px', borderRadius: '4px' }}>
                            {task.is_mandatory ? 'MANDATORY' : 'OPTIONAL'}
                          </span>
                        </div>
                        <div style={{ color: '#fff', fontWeight: '500', marginBottom: '4px' }}>{task.name}</div>
                        <div style={{ color: '#888', fontSize: '12px', marginBottom: '12px' }}>{task.sub || 'No description'}</div>
                        
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {task.requires_upload && <span style={{ fontSize: '10px', background: '#f59e0b44', color: '#fbbf24', padding: '2px 6px', borderRadius: '4px' }}>Requires Upload</span>}
                            {task.special && <span style={{ fontSize: '10px', background: '#10b98144', color: '#34d399', padding: '2px 6px', borderRadius: '4px' }}>Special: {task.special}</span>}
                          </div>
                          {canEditMasters && (
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button 
                                style={{ background: 'transparent', border: '1px solid #444', color: '#ccc', borderRadius: '4px', cursor: 'pointer', padding: '2px 6px', fontSize: '10px' }}
                                onClick={() => handleEditTaskClick(task)}
                              >Edit</button>
                              <button 
                                style={{ background: 'transparent', border: '1px solid #ef444444', color: '#ef4444', borderRadius: '4px', cursor: 'pointer', padding: '2px 6px', fontSize: '10px' }}
                                onClick={() => handleDeleteTaskClick(task.id)}
                              >Delete</button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Company Modal */}
      {showCompanyModal && (
        <div className="modal-overlay open" onClick={(e) => { if(e.target.className === 'modal-overlay open') setShowCompanyModal(false); }}>
          <div className="modal" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <div className="modal-title">Register Company</div>
              <button className="modal-close" onClick={() => setShowCompanyModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleCompanySubmit}>
                <div className="modal-field">
                  <label>Company Name</label>
                  <input type="text" className="form-input" required value={companyFormData.name} onChange={(e) => setCompanyFormData({ ...companyFormData, name: e.target.value })} />
                </div>
                <div style={{ marginTop: '24px', marginBottom: '16px', borderBottom: '1px solid #333', paddingBottom: '8px', color: '#fff' }}>Locations</div>
                {companyFormData.locations.map((loc, idx) => (
                  <div key={idx} style={{ background: '#111', padding: '16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #222' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div><label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>City *</label><input type="text" className="form-input" required value={loc.city} onChange={e => handleLocationChange(idx, 'city', e.target.value)} /></div>
                      <div><label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Person in Charge</label><input type="text" className="form-input" value={loc.person_in_charge} onChange={e => handleLocationChange(idx, 'person_in_charge', e.target.value)} /></div>
                    </div>
                    <div style={{ marginBottom: '12px' }}><label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Full Address</label><input type="text" className="form-input" value={loc.address} onChange={e => handleLocationChange(idx, 'address', e.target.value)} /></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div><label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Contact Number</label><input type="text" className="form-input" value={loc.contact_number} onChange={e => handleLocationChange(idx, 'contact_number', e.target.value)} /></div>
                      <div><label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Email</label><input type="email" className="form-input" value={loc.email} onChange={e => handleLocationChange(idx, 'email', e.target.value)} /></div>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addLocation} style={{ background: 'transparent', border: '1px dashed #444', color: '#888', width: '100%', padding: '12px', borderRadius: '8px', cursor: 'pointer', marginBottom: '24px' }}>+ Add Another Location</button>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button type="button" className="vbtn" style={{ background: '#333' }} onClick={() => setShowCompanyModal(false)}>Cancel</button>
                  <button type="submit" className="vbtn">Save Company</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {showTaskModal && (
        <div className="modal-overlay open" onClick={(e) => { if(e.target.className === 'modal-overlay open') setShowTaskModal(false); }}>
          <div className="modal" style={{ maxWidth: '520px', width: '95%' }}>
            <div className="modal-header">
              <div className="modal-title">{editingTaskId ? 'Edit Task Master' : 'New Task Master'}</div>
              <button className="modal-close" onClick={() => setShowTaskModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleTaskSubmit}>
                <div className="modal-field">
                  <label>Department</label>
                  <select className="form-select" value={taskFormData.dept} onChange={(e) => setTaskFormData({ ...taskFormData, dept: e.target.value })}>
                    {DEPTS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                  </select>
                </div>
                <div className="modal-field">
                  <label>Task Name</label>
                  <input type="text" className="form-input" required value={taskFormData.name} onChange={(e) => setTaskFormData({ ...taskFormData, name: e.target.value })} />
                </div>
                <div className="modal-field">
                  <label>Description / Subtitle</label>
                  <input type="text" className="form-input" value={taskFormData.sub} onChange={(e) => setTaskFormData({ ...taskFormData, sub: e.target.value })} />
                </div>
                <div className="modal-field" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
                  <input type="checkbox" checked={taskFormData.is_mandatory} onChange={(e) => setTaskFormData({ ...taskFormData, is_mandatory: e.target.checked })} />
                  <label style={{ margin: 0, color: '#fff' }}>Mandatory Task (added to all new orders)</label>
                </div>
                <div className="modal-field" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                  <input type="checkbox" checked={taskFormData.requires_upload} onChange={(e) => setTaskFormData({ ...taskFormData, requires_upload: e.target.checked })} />
                  <label style={{ margin: 0, color: '#fff' }}>Requires Document Upload to complete</label>
                </div>

                {/* Order Fields to Display */}
                <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #333' }}>
                  <label style={{ color: '#fff', fontWeight: '600', display: 'block', marginBottom: '10px' }}>Order Fields to Show</label>
                  <div style={{ color: '#666', fontSize: '11px', marginBottom: '10px' }}>These fields from the order will be shown as read-only reference inside the task modal.</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {ORDER_FIELDS.map(f => {
                      const checked = (taskFormData.order_fields || []).includes(f.key);
                      return (
                        <label key={f.key} style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          background: checked ? 'rgba(59,130,246,0.15)' : '#111',
                          border: `1px solid ${checked ? 'rgba(59,130,246,0.4)' : '#2a2a2a'}`,
                          borderRadius: '6px', padding: '5px 10px', cursor: 'pointer',
                          fontSize: '12px', color: checked ? '#60a5fa' : '#888'
                        }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            style={{ display: 'none' }}
                            onChange={() => {
                              const curr = taskFormData.order_fields || [];
                              const next = checked ? curr.filter(k => k !== f.key) : [...curr, f.key];
                              setTaskFormData(p => ({ ...p, order_fields: next }));
                            }}
                          />
                          {checked ? '✓ ' : ''}{f.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #333' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <label style={{ color: '#fff', fontWeight: '600' }}>Form Fields</label>
                    <button
                      type="button"
                      onClick={() => setShowFieldBuilder(!showFieldBuilder)}
                      style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}
                    >
                      {showFieldBuilder ? 'Cancel' : '+ Add Field'}
                    </button>
                  </div>

                  {showFieldBuilder && (
                    <div style={{ background: '#111', border: '1px solid #333', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                        <div>
                          <label style={{ fontSize: '11px', color: '#999', display: 'block', marginBottom: '4px' }}>Label *</label>
                          <input type="text" className="form-input" value={newField.label} onChange={e => setNewField(p => ({ ...p, label: e.target.value }))} placeholder="e.g. Test Voltage" />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: '#999', display: 'block', marginBottom: '4px' }}>Type</label>
                          <select className="form-select" value={newField.type} onChange={e => setNewField(p => ({ ...p, type: e.target.value }))}>
                            {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                      </div>
                      {newField.type === 'Dropdown' && (
                        <div style={{ marginBottom: '8px' }}>
                          <label style={{ fontSize: '11px', color: '#999', display: 'block', marginBottom: '4px' }}>Options (comma-separated)</label>
                          <input type="text" className="form-input" value={newField.options} onChange={e => setNewField(p => ({ ...p, options: e.target.value }))} placeholder="Option A, Option B" />
                        </div>
                      )}
                      <button type="button" onClick={addTaskField} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                        Add Field
                      </button>
                    </div>
                  )}

                  {taskCustomFields.length === 0 ? (
                    <div style={{ color: '#555', fontSize: '12px', fontStyle: 'italic', padding: '8px 0' }}>No form fields defined. Users will only see Notes when filling this task.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {taskCustomFields.map(f => (
                        <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111', padding: '8px 12px', borderRadius: '6px', border: '1px solid #2a2a2a' }}>
                          <div>
                            <span style={{ color: '#ddd', fontSize: '13px' }}>{f.label}</span>
                            <span style={{ marginLeft: '8px', fontSize: '10px', color: '#555', background: '#1a1a1a', padding: '1px 5px', borderRadius: '3px', textTransform: 'uppercase' }}>{f.type}</span>
                            {f.options?.length > 0 && <span style={{ marginLeft: '6px', fontSize: '10px', color: '#666' }}>({f.options.join(', ')})</span>}
                          </div>
                          <button type="button" onClick={() => removeTaskField(f.id)} style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', fontSize: '14px' }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                  <button type="button" className="vbtn" style={{ background: '#333' }} onClick={() => setShowTaskModal(false)}>Cancel</button>
                  <button type="submit" className="vbtn">{editingTaskId ? 'Update Task' : 'Save Task'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

