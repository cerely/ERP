import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// Auto-initialize Database
const initDB = async () => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');
    await pool.query(sql);
    console.log('Database initialized successfully (Tables checked/created)');
  } catch (err) {
    console.error('Database initialization failed:', err);
  }
};

initDB();

app.use(cors());
app.use(express.json());

// Multer Configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB total limit
});

// Helper for Order ID Generation
const generateOrderNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `ORD-${year}-`;
  const result = await pool.query(
    "SELECT order_number FROM orders WHERE order_number LIKE $1 ORDER BY id DESC LIMIT 1",
    [`${prefix}%`]
  );
  
  let nextNum = 1;
  if (result.rows.length > 0) {
    const parts = result.rows[0].order_number.split('-');
    if (parts.length === 3) {
      const lastNum = parseInt(parts[2]);
      nextNum = lastNum + 1;
    }
  }
  
  return `${prefix}${nextNum.toString().padStart(4, '0')}`;
};

// Middleware for RBAC
const authorize = (roles = []) => {
  return (req, res, next) => {
    let token = null;
    if (req.headers.authorization) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.query.token) {
      token = req.query.token;
    }
    
    if (!token) return res.status(401).json({ error: 'No token provided' });
    
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) return res.status(401).json({ error: 'Unauthorized' });
      if (roles.length && !roles.includes(decoded.role)) {
        return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
      }
      req.user = decoded;
      next();
    });
  };
};

// Auth Routes
app.post('/api/auth/signup', authorize(['Admin']), async (req, res) => {
  const { username, email, password, role } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role',
      [username, email, hashedPassword, role || 'Viewer']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/auth/profile', authorize(), async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, email, role FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logs & Users
app.get('/api/logs', authorize(), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.*, u.username, o.order_number 
       FROM activity_logs l 
       JOIN users u ON l.user_id = u.id 
       LEFT JOIN orders o ON l.order_id = o.id
       ORDER BY l.timestamp DESC LIMIT 200`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/logs', authorize(), async (req, res) => {
  const { dept, action_text, order_id } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO activity_logs (user_id, order_id, dept, action_text) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.id, order_id || null, dept, action_text]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/users', authorize(['Admin']), async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Orders & Documents API
app.post('/api/orders', authorize(['Sales']), upload.any(), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { order_date, delivery_date, notes, company_location_id, lineItems, priority, po_number, packaging_type } = req.body;
    let parsedLineItems = [];
    try {
      parsedLineItems = JSON.parse(lineItems);
    } catch (e) {
      // Ignore
    }

    // 1. Create Order
    const order_number = await generateOrderNumber();
    const orderResult = await client.query(
      `INSERT INTO orders (order_number, company_location_id, order_date, delivery_date, notes, priority, po_number, packaging_type, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [order_number, company_location_id || null, order_date || null, delivery_date || null, notes, priority || 'Medium', po_number || null, packaging_type || null, req.user.id]
    );
    const order = orderResult.rows[0];

    // 2. Insert Line Items and Generate Unit IDs sequentially
    let globalUnitCounter = 1;
    let totalUnits = 0;

    for (const li of parsedLineItems) {
      const liResult = await client.query(
        `INSERT INTO order_line_items (order_id, line_item_number, material_description, part_number, panel_type_size, delivery_date, quantity, unit, unit_price, total_price, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [order.id, li.line_item_number, li.material_description, li.part_number, li.panel_type_size, li.delivery_date || null, li.quantity, li.unit, li.unit_price, li.total_price, li.notes]
      );
      const lineItem = liResult.rows[0];
      const qty = parseInt(li.quantity);
      totalUnits += qty;

      for (let i = 0; i < qty; i++) {
        const short_serial = globalUnitCounter.toString().padStart(4, '0');
        const unit_id = `${order_number}-${short_serial}`;
        await client.query(
          `INSERT INTO order_units (order_id, line_item_id, unit_id, short_serial) VALUES ($1, $2, $3, $4)`,
          [order.id, lineItem.id, unit_id, short_serial]
        );
        globalUnitCounter++;
      }
    }

    // 3. Auto-assign mandatory steps
    const tasksResult = await client.query('SELECT * FROM task_masters WHERE is_mandatory = true');
    const tasks = tasksResult.rows;
    for (const task of tasks) {
      // Copy field definitions (without values) from task master to the order step
      let fieldDefs = [];
      try {
        const raw = Array.isArray(task.custom_fields) ? task.custom_fields : JSON.parse(task.custom_fields || '[]');
        fieldDefs = raw.map(f => ({ ...f, value: f.type === 'Yes/No' ? false : '' }));
      } catch { fieldDefs = []; }

      await client.query(
        `INSERT INTO order_steps (order_id, task_id, dept, name, sub, special, requires_upload, custom_fields) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [order.id, task.id, task.dept, task.name, task.sub, task.special, task.requires_upload, JSON.stringify(fieldDefs)]
      );
    }

    // 4. Save Uploaded Documents
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        let docType = 'General';
        const field = file.fieldname.toLowerCase();
        if (field.includes('po')) docType = 'PO';
        else if (field.includes('quotation')) docType = 'Quotation';
        else if (field.includes('approved')) docType = 'Approved';
        
        await client.query(
          `INSERT INTO documents (entity_type, entity_id, doc_type, file_name, file_path, file_size, mime_type, uploaded_by) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          ['Order', order.id, docType, file.originalname, file.path, file.size, file.mimetype, req.user.id]
        );
      }
    }

  await client.query('COMMIT');
    res.status(201).json({ order, message: `Order ${order_number} created with ${totalUnits} units.` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Order creation error:', err);
    res.status(500).json({ error: 'Failed to create order' });
  } finally {
    client.release();
  }
});

// ── BULK IMPORT via Excel ─────────────────────────────────────────────────────
// Accepts a single .xlsx file whose "Import Template" sheet follows the
// column layout generated by the sample template tool.
app.post('/api/orders/import', authorize(['Sales', 'Admin', 'Manager']), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  // 1. Parse the workbook — auto-detect which sheet and which row is the real header
  let rows;
  let detectedSheet = '';
  let detectedHeaders = [];
  try {
    const wb = XLSX.readFile(req.file.path);

    // Prefer "Import Template" sheet, otherwise try first sheet
    const sheetName = wb.SheetNames.includes('Import Template')
      ? 'Import Template'
      : wb.SheetNames[0];
    detectedSheet = sheetName;
    const ws = wb.Sheets[sheetName];

    // Convert to raw 2D array first so we can scan for the real header row
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    // Find the row index that contains 'po_number' — handles group-label rows above real headers
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(raw.length, 10); i++) {
      const rowStr = raw[i].map(c => String(c).toLowerCase().trim());
      if (rowStr.includes('po_number')) {
        headerRowIdx = i;
        break;
      }
    }

    if (headerRowIdx === -1) {
      fs.unlinkSync(req.file.path);
      const firstRowPreview = raw[0] ? raw[0].slice(0, 5).join(', ') : '(empty)';
      return res.status(400).json({
        error: `Column header "po_number" not found in the first 10 rows of sheet "${sheetName}". ` +
               `First row detected: [${firstRowPreview}]. ` +
               `Make sure you are filling the "Import Template" sheet from the downloaded template.`
      });
    }

    // Use that row as headers, parse data rows below it
    const headers = raw[headerRowIdx].map(h => String(h).trim());
    detectedHeaders = headers;
    rows = raw.slice(headerRowIdx + 1).map(rowArr => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = rowArr[i] !== undefined ? rowArr[i] : ''; });
      return obj;
    });
  } catch (err) {
    try { fs.unlinkSync(req.file.path); } catch (_) {}
    return res.status(400).json({ error: `Failed to read Excel file: ${err.message}` });
  }

  // Cleanup the temp upload
  try { fs.unlinkSync(req.file.path); } catch (_) {}

  // Filter to rows that have any content at all
  rows = rows.filter(r => Object.values(r).some(v => String(v).trim() !== ''));

  if (!rows || rows.length === 0) {
    return res.status(400).json({
      error: `The sheet "${detectedSheet}" appears to be empty or has no data rows below the header. ` +
             `Detected headers: [${detectedHeaders.slice(0, 6).join(', ')}...]`
    });
  }

  // 2. Group rows by po_number (one order per unique PO)
  const orderMap = new Map();
  for (const row of rows) {
    const po = String(row['po_number'] || '').trim();
    if (!po) continue; // skip blank rows

    if (!orderMap.has(po)) {
      orderMap.set(po, { header: row, lineItems: [] });
    }
    orderMap.get(po).lineItems.push(row);
  }

  if (orderMap.size === 0) {
    return res.status(400).json({
      error: `No rows with a po_number value found in sheet "${detectedSheet}". ` +
             `Make sure the po_number column is filled in for every data row. ` +
             `Detected columns: [${detectedHeaders.join(', ')}]`
    });
  }

  // 3. Resolve company_name + company_city → company_location_id (cached)
  const locationCache = new Map();
  const resolveLocation = async (name, city) => {
    const key = `${name}|||${city}`.toLowerCase();
    if (locationCache.has(key)) return locationCache.get(key);

    const result = await pool.query(
      `SELECT cl.id FROM company_locations cl
       JOIN companies c ON cl.company_id = c.id
       WHERE LOWER(c.name) = LOWER($1) AND LOWER(cl.city) = LOWER($2)
       LIMIT 1`,
      [name, city]
    );
    const id = result.rows.length > 0 ? result.rows[0].id : null;
    locationCache.set(key, id);
    return id;
  };

  // 4. Create each order in a transaction
  const results = [];
  const errors = [];

  for (const [po_number, { header, lineItems }] of orderMap) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Resolve location
      const companyName = String(header['company_name'] || '').trim();
      const companyCity = String(header['company_city'] || '').trim();
      if (!companyName || !companyCity) {
        errors.push({ po_number, error: 'company_name or company_city is missing.' });
        await client.query('ROLLBACK');
        client.release();
        continue;
      }
      const company_location_id = await resolveLocation(companyName, companyCity);
      if (!company_location_id) {
        errors.push({ po_number, error: `Company "${companyName}" in "${companyCity}" not found in Masters.` });
        await client.query('ROLLBACK');
        client.release();
        continue;
      }

      // Validate priority
      const VALID_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
      const priority = VALID_PRIORITIES.includes(header['priority']) ? header['priority'] : 'Medium';

      // Validate packaging (accept any custom packaging type string entered in the sheet)
      const packaging_type = header['packaging_type'] ? String(header['packaging_type']).trim() : null;

      // Parse dates (handles both JS Date objects from xlsx and YYYY-MM-DD strings)
      const parseDate = (v) => {
        if (!v) return null;
        if (v instanceof Date) return v.toISOString().split('T')[0];
        const s = String(v).trim();
        // Handle Excel serial numbers
        if (/^\d+$/.test(s)) {
          const d = XLSX.SSF.parse_date_code(parseInt(s));
          return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
        }
        return s || null;
      };

      const order_date    = parseDate(header['order_date']);
      const delivery_date = parseDate(header['delivery_date']);

      // Check if order already exists with this po_number
      const existingOrderRes = await client.query(
        'SELECT * FROM orders WHERE po_number = $1 LIMIT 1',
        [po_number]
      );

      let order;
      let globalUnitCounter = 1;
      let lineNum = 10;
      let isAppended = false;

      if (existingOrderRes.rows.length > 0) {
        order = existingOrderRes.rows[0];
        isAppended = true;

        // Find current max unit short_serial to continue the sequence
        const maxSerialRes = await client.query(
          'SELECT COALESCE(MAX(short_serial::integer), 0) as max_serial FROM order_units WHERE order_id = $1',
          [order.id]
        );
        globalUnitCounter = parseInt(maxSerialRes.rows[0].max_serial) + 1;

        // Find current max line item number to continue the line sequence
        const maxLiRes = await client.query(
          "SELECT line_item_number FROM order_line_items WHERE order_id = $1 ORDER BY id DESC LIMIT 1",
          [order.id]
        );
        if (maxLiRes.rows.length > 0) {
          const lastLiNum = parseInt(maxLiRes.rows[0].line_item_number) || 0;
          lineNum = lastLiNum + 10;
        }
      } else {
        // Create order
        const order_number = await generateOrderNumber();
        const orderResult = await client.query(
          `INSERT INTO orders (order_number, company_location_id, order_date, delivery_date, notes, priority, po_number, packaging_type, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
          [order_number, company_location_id, order_date, delivery_date,
           header['order_notes'] || null, priority, po_number, packaging_type, req.user.id]
        );
        order = orderResult.rows[0];
      }

      const order_number = order.order_number;

      // Insert line items & units
      let totalUnits = 0;

      for (const li of lineItems) {
        const li_number = String(li['line_item_number'] || '').trim() ||
                          String(lineNum).padStart(5, '0');
        lineNum += 10;

        // Smart Deduplication: Check if this line item already exists (by number OR by matching description)
        if (isAppended) {
          const checkLi = await client.query(
            `SELECT id FROM order_line_items 
             WHERE order_id = $1 AND (
               line_item_number = $2 OR 
               (LOWER(TRIM(material_description)) = LOWER(TRIM($3)) AND TRIM($3) != '')
             ) LIMIT 1`,
            [order.id, li_number, li['material_description'] || '']
          );
          if (checkLi.rows.length > 0) {
            // Already exists — skip to prevent stacking duplicate lines
            continue;
          }
        }

        const qty = parseInt(li['quantity']) || 1;
        const unit_price = parseFloat(li['unit_price']) || 0;
        const total_price = parseFloat(li['total_price']) || (qty * unit_price);

        const liResult = await client.query(
          `INSERT INTO order_line_items (order_id, line_item_number, material_description, part_number,
            panel_type_size, delivery_date, quantity, unit, unit_price, total_price, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
          [order.id, li_number, li['material_description'] || '', li['part_number'] || '',
           li['panel_type_size'] || '', parseDate(li['line_item_delivery_date']) || delivery_date,
           qty, li['unit'] || 'Nos', unit_price, total_price, li['line_item_notes'] || null]
        );
        const lineItem = liResult.rows[0];
        totalUnits += qty;

        for (let i = 0; i < qty; i++) {
          const short_serial = globalUnitCounter.toString().padStart(4, '0');
          const unit_id = `${order_number}-${short_serial}`;
          await client.query(
            `INSERT INTO order_units (order_id, line_item_id, unit_id, short_serial) VALUES ($1,$2,$3,$4)`,
            [order.id, lineItem.id, unit_id, short_serial]
          );
          globalUnitCounter++;
        }
      }

      // Auto-assign mandatory steps (only for new orders)
      if (!isAppended) {
        const tasksResult = await client.query('SELECT * FROM task_masters WHERE is_mandatory = true');
        for (const task of tasksResult.rows) {
          let fieldDefs = [];
          try {
            const raw = Array.isArray(task.custom_fields) ? task.custom_fields : JSON.parse(task.custom_fields || '[]');
            fieldDefs = raw.map(f => ({ ...f, value: f.type === 'Yes/No' ? false : '' }));
          } catch { fieldDefs = []; }

          await client.query(
            `INSERT INTO order_steps (order_id, task_id, dept, name, sub, special, requires_upload, custom_fields)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [order.id, task.id, task.dept, task.name, task.sub, task.special, task.requires_upload, JSON.stringify(fieldDefs)]
          );
        }
      }

      await client.query('COMMIT');
      results.push({ po_number, order_number, units: totalUnits, is_appended: isAppended });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`Import error for PO ${po_number}:`, err);
      errors.push({ po_number, error: err.message });
    } finally {
      client.release();
    }
  }

  res.status(errors.length === orderMap.size ? 400 : 201).json({
    message: `Import complete. ${results.length} order(s) created, ${errors.length} failed.`,
    created: results,
    errors
  });
});

app.get('/api/orders', authorize(), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*, u.username as creator_name, 
       (SELECT count(*) FROM order_units WHERE order_id = o.id) as unit_count,
       c.name as company_name, l.city as company_city
       FROM orders o 
       JOIN users u ON o.created_by = u.id 
       LEFT JOIN company_locations l ON o.company_location_id = l.id
       LEFT JOIN companies c ON l.company_id = c.id
       ORDER BY o.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/board', authorize(), async (req, res) => {
  try {
    const ordersResult = await pool.query(
      `SELECT o.id, o.order_number, o.delivery_date, o.priority, c.name as company_name,
              COALESCE(
                (SELECT MAX(s.created_at) FROM order_steps s WHERE s.order_id = o.id),
                o.created_at
              ) as updated_at,
              CASE 
                WHEN (SELECT COUNT(*) FROM order_steps s WHERE s.order_id = o.id) = 0 THEN 'no_steps'
                WHEN (SELECT COUNT(*) FROM order_steps s WHERE s.order_id = o.id AND s.status != 'done') = 0 THEN 'completed'
                ELSE 'incomplete'
              END as status
       FROM orders o
       LEFT JOIN company_locations l ON o.company_location_id = l.id
       LEFT JOIN companies c ON l.company_id = c.id
       ORDER BY o.created_at DESC`
    );
    const stepsResult = await pool.query(
      `SELECT id, order_id, dept, name, status, requires_upload, notes
       FROM order_steps
       ORDER BY step_order ASC, id ASC`
    );
    const orders = ordersResult.rows.map(o => ({
      ...o,
      steps: stepsResult.rows.filter(s => s.order_id === o.id)
    }));
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/orders/:id', authorize(), async (req, res) => {
  try {
    const order = await pool.query(`
      SELECT o.*, c.name as company_name, l.city as company_city, l.address as company_address, l.person_in_charge, l.contact_number, l.email as company_email
      FROM orders o
      LEFT JOIN company_locations l ON o.company_location_id = l.id
      LEFT JOIN companies c ON l.company_id = c.id
      WHERE o.id = $1
    `, [req.params.id]);
    if (order.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    
    const lineItems = await pool.query('SELECT * FROM order_line_items WHERE order_id = $1 ORDER BY id ASC', [req.params.id]);
    const units = await pool.query('SELECT * FROM order_units WHERE order_id = $1 ORDER BY id ASC', [req.params.id]);
    const docs = await pool.query(
      `SELECT * FROM documents 
       WHERE (entity_type = 'Order' AND entity_id = $1) 
          OR (entity_type = 'Unit' AND entity_id IN (SELECT id FROM order_units WHERE order_id = $1))`, 
      [req.params.id]
    );
    
    res.json({ ...order.rows[0], line_items: lineItems.rows, units: units.rows, documents: docs.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/orders/:id/steps', authorize(), async (req, res) => {
  try {
    // Join with task_masters to get the field definitions template
    const result = await pool.query(`
      SELECT s.*, tm.custom_fields as tm_custom_fields, tm.order_fields as tm_order_fields
      FROM order_steps s
      LEFT JOIN task_masters tm ON s.task_id = tm.id
      WHERE s.order_id = $1
      ORDER BY s.step_order ASC, s.id ASC
    `, [req.params.id]);

    // For each step, if its own custom_fields is empty, seed from task master definitions
    const steps = result.rows.map(step => {
      let cf = [];
      try { cf = Array.isArray(step.custom_fields) ? step.custom_fields : JSON.parse(step.custom_fields || '[]'); } catch { cf = []; }
      
      if (cf.length === 0 && step.tm_custom_fields) {
        try {
          const tmCf = Array.isArray(step.tm_custom_fields) ? step.tm_custom_fields : JSON.parse(step.tm_custom_fields);
          cf = tmCf.map(f => ({ ...f, value: f.type === 'Yes/No' ? false : '' }));
        } catch { cf = []; }
      }
      
      // Pass order_fields config from task master to step
      let orderFields = [];
      try { orderFields = Array.isArray(step.tm_order_fields) ? step.tm_order_fields : JSON.parse(step.tm_order_fields || '[]'); } catch { orderFields = []; }

      const { tm_custom_fields, tm_order_fields, ...rest } = step;
      return { ...rest, custom_fields: cf, order_fields: orderFields };
    });

    res.json(steps);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch order steps' });
  }
});

app.post('/api/orders/:id/steps', authorize(), async (req, res) => {
  const { taskId } = req.body;
  try {
    const taskResult = await pool.query('SELECT * FROM task_masters WHERE id = $1', [taskId]);
    if (taskResult.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    const task = taskResult.rows[0];

    // Copy field definitions (without values) from task master
    let fieldDefs = [];
    try {
      const raw = Array.isArray(task.custom_fields) ? task.custom_fields : JSON.parse(task.custom_fields || '[]');
      fieldDefs = raw.map(f => ({ ...f, value: f.type === 'Yes/No' ? false : '' }));
    } catch { fieldDefs = []; }

    const result = await pool.query(
      `INSERT INTO order_steps (order_id, task_id, dept, name, sub, special, requires_upload, custom_fields, step_order) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, (SELECT COALESCE(MAX(step_order), 0) + 1 FROM order_steps WHERE order_id = $1 AND dept = $3)) RETURNING *`,
      [req.params.id, task.id, task.dept, task.name, task.sub, task.special, task.requires_upload, JSON.stringify(fieldDefs)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add step to order' });
  }
});

app.put('/api/orders/:orderId/steps/reorder', authorize(), async (req, res) => {
  const { orderedIds } = req.body; // Array of step IDs in the new order
  if (!orderedIds || !Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds array required' });
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < orderedIds.length; i++) {
      await client.query(
        'UPDATE order_steps SET step_order = $1 WHERE id = $2 AND order_id = $3',
        [i, orderedIds[i], req.params.orderId]
      );
    }
    await client.query('COMMIT');
    res.json({ message: 'Steps reordered successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to reorder steps' });
  } finally {
    client.release();
  }
});

app.put('/api/orders/:orderId/steps/:stepId', authorize(), async (req, res) => {
  const { status, notes, dispatchDate, custom_fields } = req.body;
  const updated = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  try {
    let cfJson = null;
    if (custom_fields) {
      cfJson = JSON.stringify(custom_fields);
    }

    const result = await pool.query(
      'UPDATE order_steps SET status = $1, notes = $2, dispatch_date = $3, updated = $4, custom_fields = COALESCE($5, custom_fields) WHERE id = $6 AND order_id = $7 RETURNING *',
      [status, notes, dispatchDate || null, updated, cfJson, req.params.stepId, req.params.orderId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Step not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update step' });
  }
});

app.delete('/api/orders/:orderId/steps/:stepId', authorize(['Admin', 'Manager']), async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM order_steps WHERE id = $1 AND order_id = $2 RETURNING *',
      [req.params.stepId, req.params.orderId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Step not found' });
    
    // Also log this deletion
    await pool.query(
      'INSERT INTO activity_logs (user_id, dept, action_text) VALUES ($1, $2, $3)',
      [req.user.id, result.rows[0].dept, `Deleted task step: ${result.rows[0].name}`]
    );
    
    res.json({ message: 'Step deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete step' });
  }
});

app.put('/api/units/:id/status', authorize(), async (req, res) => {
  const { status } = req.body;
  try {
    const result = await pool.query(
      'UPDATE order_units SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Unit not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update unit status' });
  }
});

// Masters API
app.get('/api/companies', authorize(), async (req, res) => {
  try {
    const companies = await pool.query('SELECT * FROM companies ORDER BY name ASC');
    const locations = await pool.query('SELECT * FROM company_locations');
    
    const result = companies.rows.map(comp => ({
      ...comp,
      locations: locations.rows.filter(l => l.company_id === comp.id)
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

app.post('/api/companies', authorize(['Admin', 'Manager', 'Sales']), async (req, res) => {
  const { name, locations } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const compRes = await client.query('INSERT INTO companies (name) VALUES ($1) RETURNING *', [name]);
    const company = compRes.rows[0];
    const savedLocations = [];
    
    if (locations && locations.length > 0) {
      for (const loc of locations) {
        const locRes = await client.query(
          `INSERT INTO company_locations (company_id, address, city, person_in_charge, contact_number, email) 
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [company.id, loc.address, loc.city, loc.person_in_charge, loc.contact_number, loc.email]
        );
        savedLocations.push(locRes.rows[0]);
      }
    }
    await client.query('COMMIT');
    res.status(201).json({ ...company, locations: savedLocations });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to create company' });
  } finally {
    client.release();
  }
});

app.post('/api/documents/upload', authorize(), upload.array('files', 20), async (req, res) => {
  const { entity_type, entity_id, doc_type } = req.body;
  try {
    if (doc_type === 'PO' || doc_type === 'Quotation') {
      if (req.files.length > 1) {
        return res.status(400).json({ error: `${doc_type} can only be a single file.` });
      }
      const existing = await pool.query(
        'SELECT id FROM documents WHERE entity_type = $1 AND entity_id = $2 AND doc_type = $3 LIMIT 1',
        [entity_type, entity_id, doc_type]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: `A ${doc_type} already exists. Delete it first.` });
      }
    }

    const savedDocs = [];
    for (const file of req.files) {
      const result = await pool.query(
        `INSERT INTO documents (entity_type, entity_id, doc_type, file_name, file_path, file_size, mime_type, uploaded_by) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [entity_type, entity_id, doc_type || 'General', file.originalname, file.path, file.size, file.mimetype, req.user.id]
      );
      savedDocs.push(result.rows[0]);
    }
    res.status(201).json(savedDocs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload documents' });
  }
});

app.get('/api/documents/:entityType/:entityId', authorize(), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM documents WHERE entity_type = $1 AND entity_id = $2 ORDER BY uploaded_at DESC',
      [req.params.entityType, req.params.entityId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

app.delete('/api/documents/:id', authorize(), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Document not found' });
    
    const doc = result.rows[0];
    
    // Optional: Only allow the uploader, Admin, or Manager to delete
    if (doc.uploaded_by !== req.user.id && req.user.role !== 'Admin' && req.user.role !== 'Manager') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Delete the file from the filesystem if it exists
    if (fs.existsSync(doc.file_path)) {
      fs.unlinkSync(doc.file_path);
    }
    
    await pool.query('DELETE FROM documents WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

app.get('/api/task_masters', authorize(), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM task_masters ORDER BY dept, id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch task masters' });
  }
});

app.post('/api/task_masters', authorize(['Admin', 'Manager']), async (req, res) => {
  const { dept, name, sub, special, is_mandatory, requires_upload, custom_fields, order_fields } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO task_masters (dept, name, sub, special, is_mandatory, requires_upload, custom_fields, order_fields) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [dept, name, sub, special || null, is_mandatory !== false, requires_upload === true, JSON.stringify(custom_fields || []), JSON.stringify(order_fields || [])]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create task master' });
  }
});

app.put('/api/task_masters/:id', authorize(['Admin', 'Manager']), async (req, res) => {
  const { dept, name, sub, special, is_mandatory, requires_upload, custom_fields, order_fields } = req.body;
  try {
    const result = await pool.query(
      `UPDATE task_masters SET dept = $1, name = $2, sub = $3, special = $4, is_mandatory = $5, requires_upload = $6, custom_fields = $7, order_fields = $8
       WHERE id = $9 RETURNING *`,
      [dept, name, sub, special || null, is_mandatory !== false, requires_upload === true, JSON.stringify(custom_fields || []), JSON.stringify(order_fields || []), req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update task master' });
  }
});

app.delete('/api/task_masters/:id', authorize(['Admin', 'Manager']), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM task_masters WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete task master' });
  }
});

// ── Template Download ─────────────────────────────────────────────────────────
app.get('/api/template/download', authorize(), (req, res) => {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Field Reference ─────────────────────────────────────────────
  const ref = [
    ['SECTION', 'FIELD', 'EXAMPLE / ALLOWED VALUES', 'REQUIRED?', 'NOTES'],
    ['── ORDER HEADER ──','','','',''],
    ['Company & Location','company_name','Acme Corp','YES','Must match Masters. Case-insensitive.'],
    ['Company & Location','company_city','Mumbai','YES','Must match Masters location city.'],
    ['Dates','order_date','2026-05-19','YES','Format: YYYY-MM-DD'],
    ['Dates','delivery_date','2026-07-31','YES','Overall delivery date. YYYY-MM-DD'],
    ['PO Details','po_number','PO-2026-1234','YES','Groups rows into one order. Same PO = same order.'],
    ['PO Details','priority','Medium','YES','Low | Medium | High | Urgent'],
    ['PO Details','packaging_type','Wooden Packaging','NO','Wooden Packaging | Foam Packaging'],
    ['PO Details','order_notes','Handle with care.','NO','Overall order notes'],
    ['── LINE ITEMS ──','','','','One row per line item; repeat po_number to group into one order'],
    ['Line Item','line_item_number','00010','YES','00010, 00020, 00030 etc.'],
    ['Line Item','material_description','VFD Control Panel 22kW','YES','Full description'],
    ['Line Item','part_number','VFD-22K-STD','NO','Internal / customer part number'],
    ['Line Item','panel_type_size','VFD Panel 800x600','NO','Physical type/size'],
    ['Line Item','quantity','3','YES','Positive integer'],
    ['Line Item','unit','Nos','YES','e.g. Nos, Sets, Pcs'],
    ['Line Item','unit_price','45000','YES','Numeric only, no Rs.'],
    ['Line Item','total_price','135000','AUTO','quantity x unit_price (leave blank — auto-calculated)'],
    ['Line Item','line_item_delivery_date','2026-06-30','NO','YYYY-MM-DD; defaults to delivery_date'],
    ['Line Item','line_item_notes','FAT required before dispatch','NO','Item-level notes'],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(ref);
  ws1['!cols'] = [{ wch: 22 }, { wch: 28 }, { wch: 42 }, { wch: 12 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Field Reference');

  // ── Sheet 2: Import Template — 2000 blank rows ready for bulk paste ──────
  const COLS = [
    'company_name','company_city','order_date','delivery_date',
    'po_number','priority','packaging_type','order_notes',
    'line_item_number','material_description','part_number','panel_type_size',
    'quantity','unit','unit_price','total_price',
    'line_item_delivery_date','line_item_notes'
  ];

  // Visual group-label row so users understand which columns are order-level vs item-level
  const groupRow = [
    '<-- ORDER LEVEL: repeat these 8 columns on every row of the same PO -->',
    '','','','','','','',
    '<-- LINE ITEM LEVEL: one row = one item in the order -->',
    '','','','','','','','',''
  ];

  const exampleRows = [
    // ORDER 1 — PO-2026-1001 — 3 line items (same PO groups them into 1 order)
    ['Acme Corp','Mumbai','2026-05-20','2026-07-31','PO-2026-1001','High','Wooden Packaging','Rush order — deliver before monsoon','00010','VFD Control Panel 22kW','VFD-22K-STD','VFD Panel 800x600',3,'Nos',45000,135000,'2026-06-30','FAT required before dispatch'],
    ['Acme Corp','Mumbai','2026-05-20','2026-07-31','PO-2026-1001','High','Wooden Packaging','','00020','Motor Control Centre 8 Way','MCC-400A-8W','MCC Panel 1800x800',2,'Nos',72000,144000,'2026-07-15',''],
    ['Acme Corp','Mumbai','2026-05-20','2026-07-31','PO-2026-1001','High','Wooden Packaging','','00030','Power Factor Correction Panel','PFCP-100K','PFCP 600x500',1,'Nos',38000,38000,'2026-07-20','Include capacitor bank'],
    // ORDER 2 — PO-2026-1002 — 1 line item
    ['Beta Industries','Pune','2026-05-22','2026-08-15','PO-2026-1002','Medium','Foam Packaging','','00010','PLC Automation Panel','PLC-S7-300','600x400',1,'Nos',90000,90000,'2026-08-15','Include Siemens S7-300'],
    // ORDER 3 — PO-2026-1003 — 2 line items
    ['Gamma Systems','Chennai','2026-05-25','2026-09-01','PO-2026-1003','Low','Wooden Packaging','Standard delivery','00010','Distribution Board 8 Way','DB-8W-63A','DB 400x300',5,'Nos',12000,60000,'2026-09-01',''],
    ['Gamma Systems','Chennai','2026-05-25','2026-09-01','PO-2026-1003','Low','Wooden Packaging','','00020','Surge Protection Device','SPD-40KA','',5,'Nos',4500,22500,'2026-09-01',''],
  ];

  // Pre-allocate 2000 blank rows so the sheet is bulk-paste ready
  const blankRows = Array.from({ length: 2000 }, () => COLS.map(() => ''));

  const tmpl = [groupRow, COLS, ...exampleRows, ...blankRows];
  const ws2 = XLSX.utils.aoa_to_sheet(tmpl);
  ws2['!cols'] = [20,15,13,15,20,10,18,38,18,32,18,22,10,8,12,12,24,38].map(w => ({ wch: w }));
  // Freeze top 2 rows — headers stay visible scrolling through thousands of rows
  ws2['!freeze'] = { xSplit: 0, ySplit: 2, topLeftCell: 'A3', activePane: 'bottomLeft' };
  XLSX.utils.book_append_sheet(wb, ws2, 'Import Template');

  // ── Sheet 3: How It Works — explicit multi-order walkthrough ─────────────
  const howto = [
    ['HOW THIS SHEET WORKS — MULTI-ORDER BULK IMPORT', '', ''],
    ['', '', ''],
    ['KEY RULE:', 'Each ROW = one Line Item.', ''],
    ['', 'Rows with the SAME po_number are grouped into ONE order.', ''],
    ['', 'A DIFFERENT po_number = a NEW separate order.', ''],
    ['', 'No limit on rows. Import hundreds or thousands of orders at once.', ''],
    ['', '', ''],
    ['EXAMPLE — 3 orders, 6 rows:', '', ''],
    ['', '', ''],
    ['Row', 'po_number', 'RESULT'],
    ['1', 'PO-2026-1001 (item 1)', 'Part of ORDER 1'],
    ['2', 'PO-2026-1001 (item 2)', 'Part of ORDER 1'],
    ['3', 'PO-2026-1001 (item 3)', 'Part of ORDER 1  <-- 3 rows = 1 order with 3 line items'],
    ['4', 'PO-2026-1002 (item 1)', 'ORDER 2  <-- different PO = new order'],
    ['5', 'PO-2026-1003 (item 1)', 'Part of ORDER 3'],
    ['6', 'PO-2026-1003 (item 2)', 'Part of ORDER 3  <-- 2 rows = 1 order with 2 line items'],
    ['', '', ''],
    ['RESULT:', '3 orders created. ORDER 1 has 3 line items, ORDER 2 has 1, ORDER 3 has 2.', ''],
    ['', '', ''],
    ['SCALE:', 'The Import Template sheet has 2000 blank rows pre-loaded.', ''],
    ['', 'Excel supports ~1,048,576 rows — you can paste as many as you need.', ''],
    ['', 'Each order processes in its own DB transaction.', ''],
    ['', 'If one PO fails (e.g. company not found), the others still succeed.', ''],
    ['', 'The upload result screen shows a per-PO success/error breakdown.', ''],
    ['', '', ''],
    ['TIPS:', '', ''],
    ['', '1. Keep rows for the same order together (sort by po_number) — not required but cleaner.', ''],
    ['', '2. company_name + company_city must match Masters exactly (case-insensitive).', ''],
    ['', '3. Dates: type as YYYY-MM-DD. Format the column as Text in Excel first to avoid auto-conversion.', ''],
    ['', '4. Leave total_price blank — always recalculated as quantity x unit_price on the server.', ''],
    ['', '5. Documents (PO copy, Quotation) cannot be included here. Attach them after import.', ''],
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(howto);
  ws3['!cols'] = [{ wch: 12 }, { wch: 78 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'How It Works');

  // ── Sheet 4: Validation Rules ─────────────────────────────────────────────
  const rules = [
    ['FIELD','TYPE','REQUIRED','ALLOWED VALUES / FORMAT','IF WRONG'],
    ['company_name','Text','YES','Exact name in Masters (case-insensitive)','Order fails — company not found'],
    ['company_city','Text','YES','Exact city in Masters (case-insensitive)','Order fails — location not found'],
    ['order_date','Date','YES','YYYY-MM-DD','Rejected if invalid'],
    ['delivery_date','Date','YES','YYYY-MM-DD','Rejected if invalid'],
    ['po_number','Text','YES','Any alphanumeric string','Row skipped if blank'],
    ['priority','Enum','YES','Low | Medium | High | Urgent','Defaults to Medium'],
    ['packaging_type','Enum','NO','Wooden Packaging | Foam Packaging','Left blank if invalid'],
    ['quantity','Integer','YES','Positive whole number','Defaults to 1'],
    ['unit','Text','YES','Nos, Sets, Pcs ...','Defaults to Nos'],
    ['unit_price','Decimal','YES','Numeric, no Rs.','Defaults to 0'],
    ['total_price','Decimal','AUTO','quantity x unit_price','Always recalculated server-side'],
  ];
  const ws4 = XLSX.utils.aoa_to_sheet(rules);
  ws4['!cols'] = [{ wch: 26 }, { wch: 10 }, { wch: 12 }, { wch: 48 }, { wch: 42 }];
  XLSX.utils.book_append_sheet(wb, ws4, 'Validation Rules');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="order_import_template.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// Static files
app.use('/uploads', authorize(), express.static(path.join(__dirname, 'uploads')));

// Error handling
app.use((err, req, res, next) => {
  console.error('SERVER ERROR:', err);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
