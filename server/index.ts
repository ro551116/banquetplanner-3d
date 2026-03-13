import express from 'express';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || '3001');

// --- Database ---
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS scenes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL DEFAULT 'Untitled',
      data JSONB NOT NULL DEFAULT '{}',
      thumbnail TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('DB initialized');
}

// --- Middleware ---
app.use(express.json({ limit: '10mb' }));

// --- API Routes ---

// List all scenes
app.get('/api/scenes', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, thumbnail, created_at, updated_at FROM scenes ORDER BY updated_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List scenes error:', err);
    res.status(500).json({ error: 'Failed to list scenes' });
  }
});

// Get one scene
app.get('/api/scenes/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM scenes WHERE id = $1`, [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get scene error:', err);
    res.status(500).json({ error: 'Failed to get scene' });
  }
});

// Create scene
app.post('/api/scenes', async (req, res) => {
  try {
    const { name, data } = req.body;
    const result = await pool.query(
      `INSERT INTO scenes (name, data) VALUES ($1, $2) RETURNING id, name, created_at, updated_at`,
      [name || 'Untitled', data || {}]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create scene error:', err);
    res.status(500).json({ error: 'Failed to create scene' });
  }
});

// Update scene (auto-save)
app.put('/api/scenes/:id', async (req, res) => {
  try {
    const { name, data, thumbnail } = req.body;
    const sets: string[] = [];
    const vals: any[] = [];
    let idx = 1;

    if (name !== undefined) { sets.push(`name = $${idx++}`); vals.push(name); }
    if (data !== undefined) { sets.push(`data = $${idx++}`); vals.push(data); }
    if (thumbnail !== undefined) { sets.push(`thumbnail = $${idx++}`); vals.push(thumbnail); }
    sets.push(`updated_at = NOW()`);

    vals.push(req.params.id);
    const result = await pool.query(
      `UPDATE scenes SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id, name, updated_at`,
      vals
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update scene error:', err);
    res.status(500).json({ error: 'Failed to update scene' });
  }
});

// Delete scene
app.delete('/api/scenes/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM scenes WHERE id = $1 RETURNING id`, [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('Delete scene error:', err);
    res.status(500).json({ error: 'Failed to delete scene' });
  }
});

// --- Static files (production) ---
app.use(express.static(path.join(__dirname, '../dist')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// --- Start ---
initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to init DB:', err);
  process.exit(1);
});
