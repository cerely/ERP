import { useState, useEffect } from 'react';
import { Users, Shield, Check, X, Loader2, UserPlus, Mail, Lock, User } from 'lucide-react';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', role: 'Viewer' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  
  const token = localStorage.getItem('token');

  const ROLES = ['Admin', 'Manager', 'Sales', 'Design', 'Purchase', 'Stores', 'Production', 'QC', 'Dispatch', 'Accounts', 'Viewer'];

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setUsers(data);
    } catch (err) {
      console.error('Failed to fetch users', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const res = await fetch('http://localhost:5000/api/auth/signup', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newUser)
      });
      const data = await res.json();
      if (res.ok) {
        setShowAddForm(false);
        setNewUser({ username: '', email: '', password: '', role: 'Viewer' });
        fetchUsers();
      } else {
        setError(data.error || 'Failed to create user');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    setUpdatingId(userId);
    try {
      const res = await fetch(`http://localhost:5000/api/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      }
    } catch (err) {
      console.error('Failed to update role', err);
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) return <div className="loading-state"><Loader2 className="animate-spin" /> Loading User Directory...</div>;

  return (
    <div className="user-mgmt">
      <div className="mgmt-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Users size={20} />
          <h2>User Management Directory</h2>
          <span className="badge-count">{users.length} Total Accounts</span>
        </div>
        <button className="add-user-btn" onClick={() => setShowAddForm(!showAddForm)}>
          <UserPlus size={16} />
          {showAddForm ? 'Cancel' : 'Add New User'}
        </button>
      </div>

      {showAddForm && (
        <div className="add-user-form-container">
          <form onSubmit={handleCreateUser} className="add-user-form">
            <div className="form-grid">
              <div className="input-group">
                <label>Username</label>
                <div className="input-wrapper">
                  <User size={14} className="input-icon" />
                  <input 
                    type="text" 
                    placeholder="johndoe" 
                    value={newUser.username}
                    onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                    required
                  />
                </div>
              </div>
              <div className="input-group">
                <label>Email Address</label>
                <div className="input-wrapper">
                  <Mail size={14} className="input-icon" />
                  <input 
                    type="email" 
                    placeholder="john@example.com" 
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    required
                  />
                </div>
              </div>
              <div className="input-group">
                <label>Password</label>
                <div className="input-wrapper">
                  <Lock size={14} className="input-icon" />
                  <input 
                    type="password" 
                    placeholder="••••••••" 
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    required
                  />
                </div>
              </div>
              <div className="input-group">
                <label>Assign Role</label>
                <select 
                  className="auth-select" 
                  value={newUser.role}
                  onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            {error && <div className="form-error">{error}</div>}
            <button type="submit" className="submit-user-btn" disabled={creating}>
              {creating ? <Loader2 size={16} className="animate-spin" /> : 'Create User Account'}
            </button>
          </form>
        </div>
      )}

      <div className="user-table-container">
        <table className="user-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Current Role</th>
              <th>Action (Assign Role)</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="u-name">{u.username}</td>
                <td className="u-email">{u.email}</td>
                <td>
                  <span className={`role-badge role-${u.role.toLowerCase()}`}>{u.role}</span>
                </td>
                <td>
                  <div className="role-selector">
                    <select 
                      value={u.role} 
                      onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                      disabled={updatingId === u.id}
                      className="auth-select mini-select"
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    {updatingId === u.id && <Loader2 size={14} className="animate-spin" />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
