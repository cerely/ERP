import { useEffect, useState } from 'react';
import { LogOut, User, ChevronDown } from 'lucide-react';

export default function Header({ onLogout }) {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('en-IN'));
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const token = localStorage.getItem('token');

  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-IN'));
    }, 1000);
    
    // Fetch orders for everyone
    fetchOrders();
    
    return () => clearInterval(id);
  }, []);

  const fetchOrders = async () => {
    if (!token) return;
    try {
      const res = await fetch('http://localhost:5000/api/orders', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error('Header fetch error:', err);
    }
  };

  const handleOrderChange = (e) => {
    const orderId = e.target.value;
    setSelectedOrderId(orderId);
    if (orderId) {
      window.dispatchEvent(new CustomEvent('setView', { 
        detail: { view: 'orders', orderId: parseInt(orderId) } 
      }));
    }
  };

  return (
    <div className="header">
      <div className="header-left">
        <div className="logo">Vyom ERP Engine</div>
        <div className="header-title">Planning Module — Control Panel Manufacturing</div>
      </div>
      <div className="header-right">
        <div className="user-info" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '16px', color: 'var(--text2)', fontSize: '12px' }}>
          <User size={14} />
          <span>{user.username || 'User'}</span>
          <span className={`role-badge role-${user.role?.toLowerCase()}`}>{user.role || 'Viewer'}</span>
        </div>

        <div className="order-selector">
          <select 
            value={selectedOrderId} 
            onChange={handleOrderChange}
            className="order-dropdown"
          >
            <option value="">Select Order...</option>
            {orders.map(order => (
              <option key={order.id} value={order.id}>
                {order.order_number}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="dropdown-icon" />
        </div>

        <div className="clock" style={{ marginRight: '16px' }}>{time}</div>
        <button onClick={onLogout} className="logout-btn">
          <LogOut size={14} />
          Logout
        </button>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .order-selector {
          position: relative;
          display: flex;
          align-items: center;
          margin-right: 16px;
        }
        .order-dropdown {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          color: #eee;
          padding: 4px 30px 4px 16px;
          font-size: 12px;
          appearance: none;
          cursor: pointer;
          transition: all 0.2s;
          min-width: 140px;
        }
        .order-dropdown:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: #3b82f6;
        }
        .order-dropdown:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
        }
        .dropdown-icon {
          position: absolute;
          right: 12px;
          pointer-events: none;
          color: #888;
        }
        .order-dropdown option {
          background: #1a1a1a;
          color: #eee;
        }
      `}} />
    </div>
  );
}
