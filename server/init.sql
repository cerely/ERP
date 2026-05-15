-- Migration for existing users
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'Viewer' CHECK (role IN ('Admin', 'Manager', 'Sales', 'Design', 'Purchase', 'Stores', 'Production', 'QC', 'Dispatch', 'Accounts', 'Viewer'));

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Viewer' CHECK (role IN ('Admin', 'Manager', 'Sales', 'Design', 'Purchase', 'Stores', 'Production', 'QC', 'Dispatch', 'Accounts', 'Viewer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    dept TEXT,
    action_text TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Order and Document System
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL,
    product_details TEXT,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(15, 2) NOT NULL,
    delivery_date DATE,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_units (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    unit_id TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'Pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    entity_type TEXT NOT NULL, -- 'Order', 'Unit', etc.
    entity_id INTEGER NOT NULL,
    doc_type TEXT NOT NULL, -- 'PO', 'Quotation', 'BOM', 'Drawing', 'QC', 'Dispatch', 'Photo'
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    uploaded_by INTEGER REFERENCES users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
