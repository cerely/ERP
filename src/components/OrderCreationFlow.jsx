import { useState, useEffect } from 'react';

export default function OrderCreationFlow({ onOrderCreated }) {
  const [formData, setFormData] = useState({
    company_location_id: '',
    order_date: '',
    delivery_date: '',
    notes: '',
    priority: 'Medium',
    po_number: '',
    packaging_type: '',
    lineItems: [{
      line_item_number: '00010',
      material_description: '',
      part_number: '',
      panel_type_size: '',
      delivery_date: '',
      quantity: 1,
      unit: 'Nos',
      unit_price: '',
      total_price: '',
      notes: ''
    }]
  });
  const [companies, setCompanies] = useState([]);
  const [files, setFiles] = useState({
    po: null,
    quotation: null,
    approved_docs: []
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetch('http://localhost:5000/api/companies', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => setCompanies(data))
    .catch(err => console.error(err));
  }, [token]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLineItemChange = (index, field, value) => {
    setFormData(prev => {
      const newLineItems = [...prev.lineItems];
      newLineItems[index][field] = value;
      
      // Auto-calculate total price
      if (field === 'quantity' || field === 'unit_price') {
        const q = parseFloat(newLineItems[index].quantity) || 0;
        const p = parseFloat(newLineItems[index].unit_price) || 0;
        newLineItems[index].total_price = (q * p).toFixed(2);
      }
      
      return { ...prev, lineItems: newLineItems };
    });
  };

  const addLineItem = () => {
    setFormData(prev => {
      const lastNumber = prev.lineItems.length > 0 
        ? parseInt(prev.lineItems[prev.lineItems.length - 1].line_item_number)
        : 0;
      const nextNumber = String(lastNumber + 10).padStart(5, '0');
      
      return {
        ...prev,
        lineItems: [
          ...prev.lineItems,
          {
            line_item_number: nextNumber,
            material_description: '',
            part_number: '',
            panel_type_size: '',
            delivery_date: '',
            quantity: 1,
            unit: 'Nos',
            unit_price: '',
            total_price: '',
            notes: ''
          }
        ]
      };
    });
  };

  const removeLineItem = (index) => {
    setFormData(prev => ({
      ...prev,
      lineItems: prev.lineItems.filter((_, i) => i !== index)
    }));
  };

  const handleFileChange = (e, type) => {
    if (type === 'approved_docs') {
      const selectedFiles = Array.from(e.target.files);
      setFiles(prev => {
        const existing = prev.approved_docs || [];
        const newFiles = [...existing, ...selectedFiles];
        if (newFiles.length > 20) {
          alert('Maximum 20 files allowed');
          return prev;
        }
        return { ...prev, [type]: newFiles };
      });
      e.target.value = '';
    } else {
      setFiles(prev => ({ ...prev, [type]: e.target.files[0] }));
    }
  };

  const removeFile = (indexToRemove) => {
    setFiles(prev => ({
      ...prev,
      approved_docs: prev.approved_docs.filter((_, idx) => idx !== indexToRemove)
    }));
  };

  const removeSingleFile = (type) => {
    setFiles(prev => ({ ...prev, [type]: null }));
    // Also reset the actual file input element by clearing its value
    const input = document.getElementById(`file-input-${type}`);
    if (input) input.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.company_location_id || formData.lineItems.length === 0) {
      alert('Please select a company and add at least one line item.');
      return;
    }

    setIsSubmitting(true);
    const data = new FormData();
    data.append('company_location_id', formData.company_location_id);
    data.append('order_date', formData.order_date);
    data.append('delivery_date', formData.delivery_date);
    data.append('notes', formData.notes);
    data.append('priority', formData.priority);
    data.append('po_number', formData.po_number);
    data.append('lineItems', JSON.stringify(formData.lineItems));

    if (files.po) data.append('po', files.po);
    if (files.quotation) data.append('quotation', files.quotation);
    if (files.approved_docs && files.approved_docs.length > 0) {
      files.approved_docs.forEach(file => data.append('approved', file));
    }

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
        setFormData({
          company_location_id: '',
          order_date: '',
          delivery_date: '',
          notes: '',
          priority: 'Medium',
          po_number: '',
          lineItems: [{
            line_item_number: '00010',
            material_description: '',
            part_number: '',
            panel_type_size: '',
            delivery_date: '',
            quantity: 1,
            unit: 'Nos',
            unit_price: '',
            total_price: '',
            notes: ''
          }]
        });
        setFiles({ po: null, quotation: null, approved_docs: [] });
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
              <label>Select Company & Location</label>
              <select 
                name="company_location_id" 
                value={formData.company_location_id} 
                onChange={handleInputChange}
                className="form-select"
              >
                <option value="">-- None --</option>
                {companies.map(comp => (
                  <optgroup key={comp.id} label={comp.name}>
                    {comp.locations?.map(loc => (
                      <option key={loc.id} value={loc.id}>
                        {comp.name} - {loc.city}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Order Date</label>
              <input 
                type="date" 
                name="order_date" 
                value={formData.order_date} 
                onChange={handleInputChange} 
              />
            </div>

            <div className="form-group">
              <label>Overall Delivery Date</label>
              <input 
                type="date" 
                name="delivery_date" 
                value={formData.delivery_date} 
                onChange={handleInputChange} 
              />
            </div>

            <div className="form-group">
              <label>Priority</label>
              <select 
                name="priority" 
                value={formData.priority} 
                onChange={handleInputChange}
                className="form-input"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>

            <div className="form-group">
              <label>Customer PO Number</label>
              <input 
                type="text" 
                name="po_number" 
                value={formData.po_number} 
                onChange={handleInputChange} 
                placeholder="e.g. PO-2026-908"
              />
            </div>

            <div className="form-group">
              <label>Dispatch / Packaging</label>
              <select 
                name="packaging_type" 
                value={formData.packaging_type} 
                onChange={handleInputChange}
                className="form-input"
              >
                <option value="">-- Select Packaging Type --</option>
                <option value="Wooden Packaging">Wooden Packaging</option>
                <option value="Foam Packaging">Foam Packaging</option>
              </select>
            </div>

            <div className="form-group full-width">
              <label>Overall Order Notes</label>
              <textarea 
                name="notes" 
                value={formData.notes} 
                onChange={handleInputChange} 
                placeholder="Additional instructions..."
              />
            </div>
          </div>

          <div className="line-items-section" style={{ marginTop: '32px', marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 className="section-title" style={{ margin: 0 }}>Line Items</h3>
              <button type="button" className="vbtn" style={{ background: '#3b82f6', fontSize: '12px', padding: '6px 12px' }} onClick={addLineItem}>
                + Add Line Item
              </button>
            </div>
            
            {formData.lineItems.map((li, idx) => (
              <div key={idx} style={{ background: '#111', padding: '20px', borderRadius: '12px', border: '1px solid #333', marginBottom: '16px', position: 'relative' }}>
                {formData.lineItems.length > 1 && (
                  <button type="button" onClick={() => removeLineItem(idx)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px' }}>✕</button>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Line Item #</label>
                    <input type="text" className="form-input" value={li.line_item_number} onChange={e => handleLineItemChange(idx, 'line_item_number', e.target.value)} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Material Description *</label>
                    <input type="text" className="form-input" value={li.material_description} onChange={e => handleLineItemChange(idx, 'material_description', e.target.value)} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Part Number</label>
                    <input type="text" className="form-input" value={li.part_number} onChange={e => handleLineItemChange(idx, 'part_number', e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Panel Type / Size</label>
                    <input type="text" className="form-input" value={li.panel_type_size} onChange={e => handleLineItemChange(idx, 'panel_type_size', e.target.value)} placeholder="e.g. VFD Panel 800x600" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '100px 100px 150px 150px 150px', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Quantity *</label>
                    <input type="number" className="form-input" min="1" value={li.quantity} onChange={e => handleLineItemChange(idx, 'quantity', e.target.value)} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Unit</label>
                    <input type="text" className="form-input" value={li.unit} onChange={e => handleLineItemChange(idx, 'unit', e.target.value)} placeholder="Nos" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Unit Price *</label>
                    <input type="number" step="0.01" className="form-input" value={li.unit_price} onChange={e => handleLineItemChange(idx, 'unit_price', e.target.value)} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Total Price</label>
                    <input type="number" step="0.01" className="form-input" value={li.total_price} onChange={e => handleLineItemChange(idx, 'total_price', e.target.value)} readOnly style={{ background: '#222' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Delivery Date</label>
                    <input type="date" className="form-input" value={li.delivery_date} onChange={e => handleLineItemChange(idx, 'delivery_date', e.target.value)} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Item Notes</label>
                  <input type="text" className="form-input" value={li.notes} onChange={e => handleLineItemChange(idx, 'notes', e.target.value)} />
                </div>
              </div>
            ))}
          </div>



          <div className="file-upload-section">
            <h3 className="section-title">Required Documents</h3>
            <div style={{ fontSize: '11px', color: '#666', marginBottom: '16px' }}>
              ⚠️ Only <strong style={{ color: '#aaa' }}>one</strong> PO copy and one Quotation allowed. To replace after submission, delete the existing file first.
            </div>
            <div className="file-grid">

              {/* Customer PO Copy — single file only */}
              <div className="file-input-wrapper">
                <label>Customer PO Copy</label>
                {files.po ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', padding: '8px 10px' }}>
                    <span style={{ fontSize: '11px', color: '#10b981' }}>✔</span>
                    <span className="file-name-hint" style={{ flex: 1, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{files.po.name}</span>
                    <label style={{ fontSize: '10px', color: '#60a5fa', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      Replace
                      <input id="file-input-po" type="file" hidden onChange={(e) => handleFileChange(e, 'po')} />
                    </label>
                    <button type="button" onClick={() => removeSingleFile('po')} className="remove-file-btn" title="Remove">✕</button>
                  </div>
                ) : (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', border: '1px dashed #444', borderRadius: '6px', padding: '10px', cursor: 'pointer', color: '#888', fontSize: '12px' }}>
                    📎 Choose file…
                    <input id="file-input-po" type="file" hidden onChange={(e) => handleFileChange(e, 'po')} />
                  </label>
                )}
              </div>

              {/* Quotation — single file only */}
              <div className="file-input-wrapper">
                <label>Quotation</label>
                {files.quotation ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', padding: '8px 10px' }}>
                    <span style={{ fontSize: '11px', color: '#10b981' }}>✔</span>
                    <span className="file-name-hint" style={{ flex: 1, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{files.quotation.name}</span>
                    <label style={{ fontSize: '10px', color: '#60a5fa', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      Replace
                      <input id="file-input-quotation" type="file" hidden onChange={(e) => handleFileChange(e, 'quotation')} />
                    </label>
                    <button type="button" onClick={() => removeSingleFile('quotation')} className="remove-file-btn" title="Remove">✕</button>
                  </div>
                ) : (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', border: '1px dashed #444', borderRadius: '6px', padding: '10px', cursor: 'pointer', color: '#888', fontSize: '12px' }}>
                    📎 Choose file…
                    <input id="file-input-quotation" type="file" hidden onChange={(e) => handleFileChange(e, 'quotation')} />
                  </label>
                )}
              </div>

              <div className="file-input-wrapper" style={{ alignItems: 'flex-start' }}>
                <label>Approved Documents (Up to 20)</label>
                <input type="file" multiple onChange={(e) => handleFileChange(e, 'approved_docs')} />
                {files.approved_docs && files.approved_docs.length > 0 && (
                  <div className="selected-files-list">
                    {files.approved_docs.map((file, idx) => (
                      <div key={idx} className="selected-file-item">
                        <span className="file-name-hint">{file.name}</span>
                        <button type="button" onClick={() => removeFile(idx)} className="remove-file-btn">✕</button>
                      </div>
                    ))}
                  </div>
                )}
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
        .file-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
        
        .file-input-wrapper { 
          display: flex; flex-direction: column; gap: 12px;
          background: #111; border: 1px dashed #444; border-radius: 12px; padding: 20px;
          align-items: center; justify-content: center; text-align: center;
          transition: border-color 0.2s, background 0.2s;
        }
        .file-input-wrapper:hover { border-color: #3b82f6; background: #151515; }
        .file-input-wrapper label { color: #bbb; font-size: 13px; font-weight: 600; }
        .file-input-wrapper input[type="file"] {
          font-size: 12px; color: #888; max-width: 100%;
        }
        .file-name-hint { font-size: 12px; color: #3b82f6; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;}
        
        .selected-files-list {
          display: flex; flex-direction: column; gap: 4px; width: 100%;
          max-height: 120px; overflow-y: auto; padding-right: 4px; margin-top: 8px;
        }
        .selected-file-item {
          display: flex; justify-content: space-between; align-items: center;
          background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 4px;
        }
        .remove-file-btn {
          background: transparent; border: none; color: #ef4444; cursor: pointer; font-size: 12px; padding: 2px 6px;
        }
        .remove-file-btn:hover { color: #f87171; }
        
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
