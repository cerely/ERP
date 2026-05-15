import { useState } from 'react';

export default function OrderCreationFlow({ onOrderCreated }) {
  const [formData, setFormData] = useState({
    product_details: '',
    quantity: 1,
    unit_price: '',
    delivery_date: '',
    notes: ''
  });
  const [files, setFiles] = useState({
    po: null,
    quotation: null,
    approved_docs: null
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const token = localStorage.getItem('token');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e, type) => {
    setFiles(prev => ({ ...prev, [type]: e.target.files[0] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.product_details || !formData.quantity || !formData.unit_price) {
      alert('Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    const data = new FormData();
    Object.keys(formData).forEach(key => data.append(key, formData[key]));
    if (files.po) data.append('po', files.po);
    if (files.quotation) data.append('quotation', files.quotation);
    if (files.approved_docs) data.append('approved', files.approved_docs);

    try {
      const res = await fetch('http://localhost:5000/api/orders', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: data
      });

      if (res.ok) {
        const result = await res.json();
        alert(result.message);
        if (onOrderCreated) onOrderCreated(result.order);
        // Reset form
        setFormData({ product_details: '', quantity: 1, unit_price: '', delivery_date: '', notes: '' });
        setFiles({ po: null, quotation: null, approved_docs: null });
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create order');
      }
    } catch (err) {
      console.error('Submit error:', err);
      alert('Network error during order creation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="order-creation-container">
      <div className="form-card">
        <h2 className="form-title">Create New Order</h2>
        <p className="form-subtitle">Fill in the details to generate an Internal Order Number and Unit IDs.</p>

        <form onSubmit={handleSubmit} className="order-form">
          <div className="form-grid">
            <div className="form-group full-width">
              <label>Product Details *</label>
              <textarea 
                name="product_details" 
                value={formData.product_details} 
                onChange={handleInputChange} 
                placeholder="Description of the product..."
                required
              />
            </div>

            <div className="form-group">
              <label>Quantity *</label>
              <input 
                type="number" 
                name="quantity" 
                value={formData.quantity} 
                onChange={handleInputChange} 
                min="1" 
                required
              />
            </div>

            <div className="form-group">
              <label>Unit Price *</label>
              <input 
                type="number" 
                name="unit_price" 
                value={formData.unit_price} 
                onChange={handleInputChange} 
                step="0.01" 
                placeholder="0.00"
                required
              />
            </div>

            <div className="form-group">
              <label>Delivery Date</label>
              <input 
                type="date" 
                name="delivery_date" 
                value={formData.delivery_date} 
                onChange={handleInputChange} 
              />
            </div>

            <div className="form-group full-width">
              <label>Notes</label>
              <textarea 
                name="notes" 
                value={formData.notes} 
                onChange={handleInputChange} 
                placeholder="Additional instructions..."
              />
            </div>
          </div>

          <div className="file-upload-section">
            <h3 className="section-title">Required Documents</h3>
            <div className="file-grid">
              <div className="file-input-wrapper">
                <label>Customer PO Copy</label>
                <input type="file" onChange={(e) => handleFileChange(e, 'po')} />
                {files.po && <span className="file-name-hint">{files.po.name}</span>}
              </div>
              <div className="file-input-wrapper">
                <label>Quotation</label>
                <input type="file" onChange={(e) => handleFileChange(e, 'quotation')} />
                {files.quotation && <span className="file-name-hint">{files.quotation.name}</span>}
              </div>
              <div className="file-input-wrapper">
                <label>Approved Documents</label>
                <input type="file" onChange={(e) => handleFileChange(e, 'approved_docs')} />
                {files.approved_docs && <span className="file-name-hint">{files.approved_docs.name}</span>}
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="submit-btn" disabled={isSubmitting}>
              {isSubmitting ? 'Creating Order...' : 'Initialize Order'}
            </button>
          </div>
        </form>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .order-creation-container {
          padding: 24px;
          max-width: 900px;
          margin: 0 auto;
        }
        .form-card {
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        .form-title { margin: 0 0 8px 0; color: #fff; font-size: 24px; }
        .form-subtitle { color: #888; font-size: 14px; margin-bottom: 32px; }
        
        .order-form { display: flex; flex-direction: column; gap: 24px; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .full-width { grid-column: span 2; }
        
        .form-group { display: flex; flex-direction: column; gap: 8px; }
        .form-group label { color: #bbb; font-size: 13px; font-weight: 500; }
        .form-group input, .form-group textarea {
          background: #0f0f0f;
          border: 1px solid #333;
          border-radius: 8px;
          padding: 12px;
          color: #eee;
          font-size: 14px;
          transition: border-color 0.2s;
        }
        .form-group input:focus, .form-group textarea:focus {
          border-color: #3b82f6;
          outline: none;
        }
        .form-group textarea { min-height: 80px; resize: vertical; }
        
        .file-upload-section {
          margin-top: 16px;
          padding-top: 24px;
          border-top: 1px solid #333;
        }
        .section-title { font-size: 16px; color: #fff; margin-bottom: 16px; }
        .file-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
        
        .file-input-wrapper { display: flex; flex-direction: column; gap: 8px; }
        .file-input-wrapper label { color: #bbb; font-size: 12px; }
        .file-input-wrapper input[type="file"] {
          font-size: 12px;
          color: #888;
        }
        .file-name-hint { font-size: 11px; color: #3b82f6; }
        
        .form-actions { margin-top: 16px; display: flex; justify-content: flex-end; }
        .submit-btn {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 14px 28px;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.1s, background 0.2s;
        }
        .submit-btn:hover { background: #2563eb; transform: translateY(-1px); }
        .submit-btn:active { transform: translateY(0); }
        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      `}} />
    </div>
  );
}
