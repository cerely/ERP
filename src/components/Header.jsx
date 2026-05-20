import { useEffect, useState, useRef } from 'react';
import { LogOut, User, Search } from 'lucide-react';

export default function Header({ onLogout }) {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('en-IN'));
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchRef = useRef(null);
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const token = localStorage.getItem('token');

  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-IN'));
    }, 1000);
    
    // Fetch orders for everyone
    fetchOrders();

    const handleSetView = (e) => {
      if (e.detail && e.detail.orderId !== undefined) {
        setSelectedOrderId(e.detail.orderId || '');
      } else if (e.detail && e.detail.orderId === null) {
        setSelectedOrderId('');
      }
    };
    window.addEventListener('setView', handleSetView);
    
    // Click outside to close dropdown
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    
    return () => {
      clearInterval(id);
      window.removeEventListener('setView', handleSetView);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Sync searchQuery with selectedOrderId when it changes externally
  useEffect(() => {
    if (selectedOrderId && orders.length > 0) {
      const order = orders.find(o => o.id == selectedOrderId);
      if (order) setSearchQuery(order.order_number);
    } else if (!selectedOrderId) {
      setSearchQuery('');
    }
  }, [selectedOrderId, orders]);

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

  const handleSelectOrder = (orderId, orderNum) => {
    setSelectedOrderId(orderId);
    setSearchQuery(orderNum || '');
    setIsDropdownOpen(false);
    
    if (orderId) {
      window.dispatchEvent(new CustomEvent('setView', { 
        detail: { view: 'flow', orderId: parseInt(orderId) } 
      }));
    } else {
      window.dispatchEvent(new CustomEvent('setView', { 
        detail: { view: 'board', orderId: null } 
      }));
    }
  };

  const filteredOrders = orders.filter(o => 
    (o.order_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (o.company_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

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

        <div className="order-selector" ref={searchRef}>
          <Search size={14} className="search-icon" />
          <input 
            type="text"
            className="order-search-input"
            placeholder="Search Order..."
            value={searchQuery}
            onFocus={() => setIsDropdownOpen(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsDropdownOpen(true);
            }}
          />
          {selectedOrderId && (
            <button 
              className="clear-search" 
              onClick={(e) => { e.stopPropagation(); handleSelectOrder('', ''); }}
              title="Clear Selection"
            >
              ×
            </button>
          )}
          
          {isDropdownOpen && (
            <div className="search-dropdown-menu">
              <div 
                className={`search-dropdown-item ${!selectedOrderId ? 'active' : ''}`}
                onClick={() => handleSelectOrder('', '')}
              >
                View All Orders (Board)
              </div>
              {filteredOrders.length > 0 ? filteredOrders.map(order => (
                <div 
                  key={order.id} 
                  className={`search-dropdown-item ${selectedOrderId == order.id ? 'active' : ''}`}
                  onClick={() => handleSelectOrder(order.id, order.order_number)}
                >
                  <div style={{ fontWeight: 600 }}>{order.order_number}</div>
                  {order.company_name && <div style={{ fontSize: '10px', color: '#888' }}>{order.company_name}</div>}
                </div>
              )) : (
                <div className="search-dropdown-item empty">No orders found</div>
              )}
            </div>
          )}
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
        .order-search-input {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          color: #eee;
          padding: 6px 30px 6px 32px;
          font-size: 12px;
          width: 240px;
          outline: none;
          transition: all 0.2s;
        }
        .order-search-input:focus {
          background: rgba(255, 255, 255, 0.1);
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
        }
        .search-icon {
          position: absolute;
          left: 12px;
          color: #888;
          pointer-events: none;
        }
        .clear-search {
          position: absolute;
          right: 12px;
          background: none;
          border: none;
          color: #888;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
          padding: 0;
        }
        .clear-search:hover { color: #fff; }
        
        .search-dropdown-menu {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          width: 100%;
          max-height: 300px;
          overflow-y: auto;
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 8px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.5);
          z-index: 1000;
        }
        .search-dropdown-item {
          padding: 8px 12px;
          cursor: pointer;
          font-size: 12px;
          border-bottom: 1px solid #222;
          transition: background 0.15s;
        }
        .search-dropdown-item:last-child { border-bottom: none; }
        .search-dropdown-item:hover { background: #2a2a2a; }
        .search-dropdown-item.active { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
        .search-dropdown-item.empty { color: #888; text-align: center; font-style: italic; cursor: default; }
        .search-dropdown-item.empty:hover { background: transparent; }
      `}} />
    </div>
  );
}
