import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

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
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });
    
    const token = authHeader.split(' ')[1];
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
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
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
      'SELECT l.*, u.username FROM activity_logs l JOIN users u ON l.user_id = u.id ORDER BY l.timestamp DESC LIMIT 100'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/logs', authorize(), async (req, res) => {
  const { dept, action_text } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO activity_logs (user_id, dept, action_text) VALUES ($1, $2, $3) RETURNING *',
      [req.user.id, dept, action_text]
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
app.post('/api/orders', authorize(['Admin']), upload.any(), async (req, res) => {
  console.log('Order creation request received:', req.body);
  console.log('Files received:', req.files?.map(f => f.originalname));
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { product_details, quantity, unit_price, delivery_date, notes } = req.body;
    const order_number = await generateOrderNumber();
    
    // 1. Create Order
    const orderResult = await client.query(
      `INSERT INTO orders (order_number, product_details, quantity, unit_price, delivery_date, notes, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [order_number, product_details, quantity, unit_price, delivery_date || null, notes, req.user.id]
    );
    const order = orderResult.rows[0];

    // 2. Generate Unit IDs
    const qty = parseInt(quantity);
    for (let i = 1; i <= qty; i++) {
      const unit_id = `${order_number}-U${i.toString().padStart(2, '0')}`;
      await client.query(
        `INSERT INTO order_units (order_id, unit_id) VALUES ($1, $2)`,
        [order.id, unit_id]
      );
    }

    // 3. Save Uploaded Documents
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
    res.status(201).json({ order, message: `Order ${order_number} created with ${qty} units.` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Order creation error:', err);
    res.status(500).json({ error: 'Failed to create order' });
  } finally {
    client.release();
  }
});

app.get('/api/orders', authorize(), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*, u.username as creator_name, 
       (SELECT count(*) FROM order_units WHERE order_id = o.id) as unit_count 
       FROM orders o JOIN users u ON o.created_by = u.id ORDER BY o.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/orders/:id', authorize(), async (req, res) => {
  try {
    const order = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (order.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    
    const units = await pool.query('SELECT * FROM order_units WHERE order_id = $1', [req.params.id]);
    const docs = await pool.query('SELECT * FROM documents WHERE entity_type = $1 AND entity_id = $2', ['Order', req.params.id]);
    
    res.json({ ...order.rows[0], units: units.rows, documents: docs.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/documents/upload', authorize(), upload.array('files', 20), async (req, res) => {
  const { entity_type, entity_id, doc_type } = req.body;
  try {
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
