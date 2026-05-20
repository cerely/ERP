CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Viewer' CHECK (role IN ('Admin', 'Manager', 'Sales', 'Design', 'Purchase', 'Stores', 'Production', 'QC', 'Dispatch', 'Accounts', 'Viewer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Migration for existing users
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'Viewer' CHECK (role IN ('Admin', 'Manager', 'Sales', 'Design', 'Purchase', 'Stores', 'Production', 'QC', 'Dispatch', 'Accounts', 'Viewer'));

CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    dept TEXT,
    action_text TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL;
-- Masters System
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS company_locations (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    address TEXT,
    city TEXT NOT NULL,
    person_in_charge TEXT,
    contact_number TEXT,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Order and Document System
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL,
    company_location_id INTEGER REFERENCES company_locations(id),
    order_date DATE,
    delivery_date DATE,
    po_number TEXT,
    packaging_type TEXT,
    notes TEXT,
    priority TEXT DEFAULT 'Medium',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_line_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    line_item_number TEXT NOT NULL,
    material_description TEXT,
    part_number TEXT,
    panel_type_size TEXT,
    delivery_date DATE,
    quantity INTEGER NOT NULL,
    unit TEXT,
    unit_price NUMERIC(15, 2) NOT NULL,
    total_price NUMERIC(15, 2) NOT NULL,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS order_units (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    line_item_id INTEGER REFERENCES order_line_items(id) ON DELETE CASCADE,
    unit_id TEXT UNIQUE NOT NULL,
    short_serial TEXT NOT NULL,
    current_dept TEXT DEFAULT 'Planning',
    status TEXT DEFAULT 'Pending',
    assigned_user INTEGER REFERENCES users(id),
    barcode TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    entity_type TEXT NOT NULL, -- 'Order', 'Unit', 'Step', etc.
    entity_id INTEGER NOT NULL,
    doc_type TEXT NOT NULL, -- 'PO', 'Quotation', 'BOM', 'Drawing', 'QC', 'Dispatch', 'Photo', 'TaskUpload'
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    uploaded_by INTEGER REFERENCES users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_masters (
    id SERIAL PRIMARY KEY,
    dept TEXT NOT NULL,
    name TEXT NOT NULL,
    sub TEXT,
    is_mandatory BOOLEAN DEFAULT true,
    requires_upload BOOLEAN DEFAULT false,
    special TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_steps (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    task_id INTEGER REFERENCES task_masters(id) ON DELETE SET NULL,
    dept TEXT NOT NULL,
    name TEXT NOT NULL,
    sub TEXT,
    status TEXT DEFAULT 'pending',
    notes TEXT,
    updated TEXT,
    special TEXT,
    dispatch_date DATE,
    requires_upload BOOLEAN DEFAULT false,
    step_order INTEGER DEFAULT 0,
    custom_fields JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
