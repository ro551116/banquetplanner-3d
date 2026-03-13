import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || '3001');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
const SCENES_DIR = path.join(DATA_DIR, 'scenes');

// Ensure data directory exists
fs.mkdirSync(SCENES_DIR, { recursive: true });

interface SceneFile {
  id: string;
  name: string;
  data: any;
  thumbnail?: string;
  created_at: string;
  updated_at: string;
}

function readScene(id: string): SceneFile | null {
  const filePath = path.join(SCENES_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeScene(scene: SceneFile) {
  fs.writeFileSync(path.join(SCENES_DIR, `${scene.id}.json`), JSON.stringify(scene));
}

// --- Middleware ---
app.use(express.json({ limit: '10mb' }));

// --- API Routes ---

// List all scenes
app.get('/api/scenes', (_req, res) => {
  try {
    const files = fs.readdirSync(SCENES_DIR).filter(f => f.endsWith('.json'));
    const scenes = files.map(f => {
      const scene: SceneFile = JSON.parse(fs.readFileSync(path.join(SCENES_DIR, f), 'utf-8'));
      return { id: scene.id, name: scene.name, thumbnail: scene.thumbnail || null, created_at: scene.created_at, updated_at: scene.updated_at };
    });
    scenes.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    res.json(scenes);
  } catch (err) {
    console.error('List scenes error:', err);
    res.status(500).json({ error: 'Failed to list scenes' });
  }
});

// Get one scene
app.get('/api/scenes/:id', (req, res) => {
  const scene = readScene(req.params.id);
  if (!scene) return res.status(404).json({ error: 'Not found' });
  res.json(scene);
});

// Create scene
app.post('/api/scenes', (req, res) => {
  try {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const scene: SceneFile = {
      id,
      name: req.body.name || 'Untitled',
      data: req.body.data || {},
      created_at: now,
      updated_at: now,
    };
    writeScene(scene);
    res.status(201).json({ id: scene.id, name: scene.name, created_at: scene.created_at, updated_at: scene.updated_at });
  } catch (err) {
    console.error('Create scene error:', err);
    res.status(500).json({ error: 'Failed to create scene' });
  }
});

// Update scene (auto-save)
app.put('/api/scenes/:id', (req, res) => {
  try {
    const scene = readScene(req.params.id);
    if (!scene) return res.status(404).json({ error: 'Not found' });
    if (req.body.name !== undefined) scene.name = req.body.name;
    if (req.body.data !== undefined) scene.data = req.body.data;
    if (req.body.thumbnail !== undefined) scene.thumbnail = req.body.thumbnail;
    scene.updated_at = new Date().toISOString();
    writeScene(scene);
    res.json({ id: scene.id, name: scene.name, updated_at: scene.updated_at });
  } catch (err) {
    console.error('Update scene error:', err);
    res.status(500).json({ error: 'Failed to update scene' });
  }
});

// Delete scene
app.delete('/api/scenes/:id', (req, res) => {
  const filePath = path.join(SCENES_DIR, `${req.params.id}.json`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  fs.unlinkSync(filePath);
  res.json({ deleted: true });
});

// --- Static files (production) ---
app.use(express.static(path.join(__dirname, '../dist')));
app.get('{*path}', (_req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// --- Start ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}, data at ${DATA_DIR}`);
});
