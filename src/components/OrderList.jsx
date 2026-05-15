import { useState, useEffect } from 'react';
import DocumentManager from './DocumentManager';

export default function OrderList({ initialSelectedId }) {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
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

  if (isLoading) return <div className="loading">Loading orders...</div>;

  return (
    <div className="order-list-container">
      <div className="orders-sidebar">
        <h3 className="sidebar-title">Recent Orders</h3>
        <div className="order-items">
          {orders.map(order => (
            <div 
              key={order.id} 
              className={`order-card ${selectedOrder?.id === order.id ? 'active' : ''}`}
              onClick={() => fetchOrderDetails(order.id)}
            >
              <div className="order-num">{order.order_number}</div>
              <div className="order-meta">
                <span>{order.unit_count} Units</span> • <span>{new Date(order.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="order-details-pane">
        {selectedOrder ? (
          <div className="details-content">
            <div className="details-header">
              <h2>{selectedOrder.order_number}</h2>
              <div className="creator-info">Created by: {selectedOrder.creator_name || 'System'}</div>
            </div>

            <div className="details-grid">
              <div className="detail-box">
                <label>Product Details</label>
                <div className="val">{selectedOrder.product_details}</div>
              </div>
              <div className="detail-box">
                <label>Price & Qty</label>
                <div className="val">{selectedOrder.quantity} units @ ₹{selectedOrder.unit_price}</div>
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

            <div className="units-section">
              <h3>Unit Tracking</h3>
              <div className="units-grid">
                {selectedOrder.units?.map(unit => (
                  <div key={unit.id} className="unit-badge">
                    <span className="u-id">{unit.unit_id}</span>
                    <span className={`u-status ${unit.status.toLowerCase()}`}>{unit.status}</span>
                  </div>
                ))}
              </div>
            </div>

            <DocumentManager 
              entityType="Order" 
              entityId={selectedOrder.id} 
              initialDocs={selectedOrder.documents || []} 
            />
          </div>
        ) : (
          <div className="select-prompt">Select an order from the list to view details and documents.</div>
        )}
      </div>

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
        
        .order-details-pane {
          background: #1a1a1a;
          border-radius: 12px;
          border: 1px solid #333;
          padding: 24px;
          overflow-y: auto;
        }
        .details-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 24px; border-bottom: 1px solid #333; padding-bottom: 16px; }
        .details-header h2 { margin: 0; color: #fff; }
        .creator-info { color: #888; font-size: 13px; }
        
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
        .u-id { font-size: 12px; color: #eee; font-weight: 500; }
        .u-status { font-size: 10px; color: #888; margin-top: 2px; text-transform: uppercase; }
        .u-status.pending { color: #f59e0b; }
        
        .select-prompt { height: 100%; display: flex; align-items: center; justify-content: center; color: #666; }
        .loading { text-align: center; padding: 40px; color: #888; }
      `}} />
    </div>
  );
}
