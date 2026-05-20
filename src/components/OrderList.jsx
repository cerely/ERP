import { useState, useEffect } from 'react';
import DocumentManager from './DocumentManager';

export default function OrderList({ initialSelectedId }) {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [displayField, setDisplayField] = useState('created_at');
  const [isLoading, setIsLoading] = useState(true);
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    if (initialSelectedId && orders.length > 0) {
      fetchOrderDetails(initialSelectedId);
    }
  }, [initialSelectedId, orders]);

  const fetchOrders = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/orders', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOrderDetails = async (id) => {
    try {
      const res = await fetch(`http://localhost:5000/api/orders/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedOrder(data);
      }
    } catch (err) {
      console.error('Fetch details error:', err);
    }
  };

  const getOrderProgress = (units) => {
    if (!units || units.length === 0) return 0;
    const weights = {
      'Pending': 0,
      'In Production': 25,
      'Testing': 50,
      'QC Passed': 75,
      'Dispatched': 100
    };
    let totalProgress = 0;
    units.forEach(u => {
      totalProgress += weights[u.status] || 0;
    });
    return Math.round(totalProgress / units.length);
  };

  const updateUnitStatus = async (unitId, newStatus) => {
    try {
      const res = await fetch(`http://localhost:5000/api/units/${unitId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        const updatedUnit = await res.json();
        setSelectedOrder(prev => ({
          ...prev,
          units: prev.units.map(u => u.id === unitId ? { ...u, status: newStatus } : u)
        }));
        setSelectedUnit(prev => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      console.error('Failed to update unit status', err);
    }
  };

  if (isLoading) return <div className="loading">Loading orders...</div>;

  return (
    <div className="order-list-container">
      <div className="orders-sidebar">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="sidebar-title" style={{ margin: 0 }}>Recent Orders</h3>
          <select 
            value={displayField} 
            onChange={(e) => setDisplayField(e.target.value)}
            className="form-select"
            style={{ padding: '2px 8px', fontSize: '11px', width: 'auto', background: '#222' }}
          >
            <option value="created_at">Created Date</option>
            <option value="order_date">Order Date</option>
            <option value="delivery_date">Delivery Date</option>
            <option value="po_number">PO Number</option>
          </select>
        </div>
        <div className="order-items">
          {orders.map(order => (
            <div 
              key={order.id} 
              className={`order-card ${selectedOrder?.id === order.id ? 'active' : ''}`}
              onClick={() => fetchOrderDetails(order.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div className="order-num" style={{ margin: 0 }}>{order.order_number}</div>
                {order.priority && (
                  <span className={`priority-badge ${order.priority.toLowerCase()}`}>
                    {order.priority}
                  </span>
                )}
              </div>
              <div className="order-meta">
                <span>{order.unit_count} Units</span> • 
                <span>
                  {displayField === 'created_at' ? new Date(order.created_at).toLocaleDateString() :
                   displayField === 'order_date' ? (order.order_date ? new Date(order.order_date).toLocaleDateString() : 'No Order Date') :
                   displayField === 'delivery_date' ? (order.delivery_date ? new Date(order.delivery_date).toLocaleDateString() : 'No Delivery Date') :
                   displayField === 'po_number' ? (order.po_number || 'No PO Number') : ''}
                </span>
              </div>
              {order.company_name && (
                <div className="order-company">
                  🏢 {order.company_name} - {order.company_city}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="order-details-pane">
        {selectedOrder ? (
          <div className="details-content">
            <div className="details-header">
              <div>
                <h2>{selectedOrder.order_number}</h2>
                {selectedOrder.company_name && (
                  <div className="order-company-lg">
                    🏢 {selectedOrder.company_name} ({selectedOrder.company_city})
                  </div>
                )}
              </div>
              <div className="creator-info">Created by: {selectedOrder.creator_name || 'System'}</div>
            </div>

            <div className="order-progress-container">
              <div className="progress-labels">
                <span>Order Progress</span>
                <span>{getOrderProgress(selectedOrder.units)}%</span>
              </div>
              <div className="progress-bar-bg">
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${getOrderProgress(selectedOrder.units)}%` }}
                />
              </div>
            </div>

            <div className="details-grid">
              <div className="detail-box">
                <label>Priority</label>
                <div className="val">
                  <span className={`priority-badge ${selectedOrder.priority?.toLowerCase() || 'medium'}`}>
                    {selectedOrder.priority || 'Medium'}
                  </span>
                </div>
              </div>
              <div className="detail-box">
                <label>Order Date</label>
                <div className="val">{selectedOrder.order_date ? new Date(selectedOrder.order_date).toLocaleDateString() : 'N/A'}</div>
              </div>
              <div className="detail-box">
                <label>Delivery Date</label>
                <div className="val">{selectedOrder.delivery_date ? new Date(selectedOrder.delivery_date).toLocaleDateString() : 'TBD'}</div>
              </div>
              <div className="detail-box">
                <label>Notes</label>
                <div className="val">{selectedOrder.notes || 'No notes'}</div>
              </div>
            </div>

            <div className="line-items-section" style={{ marginTop: '24px' }}>
              <h3>Line Items & Units</h3>
              {selectedOrder.line_items?.map(li => {
                const liUnits = selectedOrder.units?.filter(u => u.line_item_id === li.id) || [];
                return (
                  <div key={li.id} style={{ background: '#222', borderRadius: '8px', padding: '16px', marginBottom: '16px', border: '1px solid #333' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid #444', paddingBottom: '8px' }}>
                      <div>
                        <strong>Line {li.line_item_number}</strong>: {li.material_description} {li.part_number ? `(${li.part_number})` : ''}
                      </div>
                      <div style={{ color: '#888', fontSize: '13px' }}>
                        {li.quantity} {li.unit || 'Nos'} @ ₹{li.unit_price}
                      </div>
                    </div>
                    
                    <div className="units-grid">
                      {liUnits.map(unit => (
                        <div 
                          key={unit.id} 
                          className="unit-badge interactive"
                          onClick={() => setSelectedUnit(unit)}
                        >
                          <span className="u-id">{unit.short_serial}</span>
                          <span className={`u-status ${unit.status.toLowerCase().replace(/\s+/g, '-')}`}>{unit.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <DocumentManager 
              entityType="Order" 
              entityId={selectedOrder.id} 
              initialDocs={selectedOrder.documents?.filter(d => d.entity_type === 'Order') || []} 
            />
          </div>
        ) : (
          <div className="select-prompt">Select an order from the list to view details and documents.</div>
        )}
      </div>

      {selectedUnit && (
        <div className="modal-overlay open" onClick={(e) => { if(e.target.className === 'modal-overlay open') setSelectedUnit(null); }}>
          <div className="modal">
            <div className="modal-header">
              <div>
                <div className="modal-title">Unit Tracking</div>
                <div className="modal-sub">{selectedUnit.unit_id}</div>
              </div>
              <button className="modal-close" onClick={() => setSelectedUnit(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="modal-field">
                <label>Unit Status</label>
                <select 
                  className="form-select"
                  value={selectedUnit.status}
                  onChange={(e) => updateUnitStatus(selectedUnit.id, e.target.value)}
                >
                  <option value="Pending">Pending</option>
                  <option value="Design">Design</option>
                  <option value="Material Waiting">Material Waiting</option>
                  <option value="Production">Production</option>
                  <option value="QC Testing">QC Testing</option>
                  <option value="QC Failed">QC Failed</option>
                  <option value="QC Passed">QC Passed</option>
                  <option value="Rework">Rework</option>
                  <option value="Ready for Dispatch">Ready for Dispatch</option>
                  <option value="Dispatched">Dispatched</option>
                  <option value="Delivered">Delivered</option>
                </select>
              </div>

              <div style={{ marginTop: 24 }}>
                <DocumentManager 
                  entityType="Unit" 
                  entityId={selectedUnit.id} 
                  initialDocs={selectedOrder.documents?.filter(d => d.entity_type === 'Unit' && d.entity_id === selectedUnit.id) || []} 
                  onUploadSuccess={() => fetchOrderDetails(selectedOrder.id)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .order-list-container {
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: 24px;
          height: calc(100vh - 200px);
        }
        .orders-sidebar {
          background: #1a1a1a;
          border-radius: 12px;
          border: 1px solid #333;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .sidebar-title { padding: 16px; border-bottom: 1px solid #333; margin: 0; font-size: 16px; }
        .order-items { overflow-y: auto; flex: 1; }
        .order-card {
          padding: 16px;
          border-bottom: 1px solid #222;
          cursor: pointer;
          transition: background 0.2s;
        }
        .order-card:hover { background: #222; }
        .order-card.active { background: #2a2a2a; border-left: 3px solid #3b82f6; }
        .order-num { color: #fff; font-weight: 600; font-size: 14px; margin-bottom: 4px; }
        .order-meta { color: #666; font-size: 12px; }
        .order-company { color: #9ca3af; font-size: 11px; margin-top: 6px; }
        .order-company-lg { color: #9ca3af; font-size: 14px; margin-top: 4px; }
        
        .order-details-pane {
          background: #1a1a1a;
          border-radius: 12px;
          border: 1px solid #333;
          padding: 24px;
          overflow-y: auto;
        }
        .details-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 16px; border-bottom: 1px solid #333; padding-bottom: 16px; }
        .details-header h2 { margin: 0; color: #fff; }
        .creator-info { color: #888; font-size: 13px; }
        
        .order-progress-container { margin-bottom: 24px; }
        .progress-labels { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px; color: #bbb; text-transform: uppercase; font-weight: 600; }
        .progress-bar-bg { background: #333; border-radius: 6px; height: 8px; overflow: hidden; width: 100%; }
        .progress-bar-fill { background: var(--teal, #14b8a6); height: 100%; transition: width 0.4s ease-out; }
        
        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 32px; }
        .detail-box label { color: #666; font-size: 12px; text-transform: uppercase; display: block; margin-bottom: 4px; }
        .detail-box .val { color: #ddd; font-size: 15px; }
        
        .units-section { margin-bottom: 32px; }
        .units-section h3 { font-size: 16px; color: #fff; margin-bottom: 12px; }
        .units-grid { display: flex; flex-wrap: wrap; gap: 8px; }
        .unit-badge {
          background: #0f0f0f;
          border: 1px solid #333;
          border-radius: 6px;
          padding: 6px 10px;
          display: flex;
          flex-direction: column;
          min-width: 140px;
        }
        .unit-badge.interactive { cursor: pointer; transition: background 0.2s, border-color 0.2s; }
        .unit-badge.interactive:hover { background: #1a1a1a; border-color: #3b82f6; }
        .u-id { font-size: 12px; color: #eee; font-weight: 500; }
        .u-status { font-size: 10px; color: #888; margin-top: 2px; text-transform: uppercase; }
        .u-status.pending { color: #f59e0b; }
        
        .select-prompt { height: 100%; display: flex; align-items: center; justify-content: center; color: #666; }
        .loading { text-align: center; padding: 40px; color: #888; }
        
        .priority-badge {
          font-size: 10px;
          text-transform: uppercase;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .priority-badge.low { background: rgba(156, 163, 175, 0.2); color: #9ca3af; border: 1px solid rgba(156, 163, 175, 0.4); }
        .priority-badge.medium { background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4); }
        .priority-badge.high { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); }
        .priority-badge.urgent { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); }
      `}} />
    </div>
  );
}
