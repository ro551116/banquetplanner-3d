import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import type { TrussStructureConfig } from '../types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || '3001');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
const SCENES_DIR = path.join(DATA_DIR, 'scenes');
const TRUSS_STUDIO_FILE = path.join(DATA_DIR, 'truss-studio.json');

// Ensure data directory exists
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(SCENES_DIR, { recursive: true });

interface SceneFile {
  id: string;
  name: string;
  data: any;
  thumbnail?: string;
  created_at: string;
  updated_at: string;
}

interface TrussStudioEntry {
  id: string;
  config: TrussStructureConfig;
  created_at: string;
  updated_at: string;
}

interface TrussStudioEvent {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  structures: TrussStudioEntry[];
}

interface TrussStudioFile {
  events: TrussStudioEvent[];
}

function readScene(id: string): SceneFile | null {
  const filePath = path.join(SCENES_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeScene(scene: SceneFile) {
  fs.writeFileSync(path.join(SCENES_DIR, `${scene.id}.json`), JSON.stringify(scene));
}

function readTrussStudio(): TrussStudioFile {
  if (!fs.existsSync(TRUSS_STUDIO_FILE)) return { events: [] };

  const data = JSON.parse(fs.readFileSync(TRUSS_STUDIO_FILE, 'utf-8'));
  if (Array.isArray(data.events)) return { events: data.events };

  if (Array.isArray(data.structures) && data.structures.length > 0) {
    const now = new Date().toISOString();
    const structureTimes = data.structures
      .map((entry: TrussStudioEntry) => ({
        createdAt: new Date(entry.created_at).getTime(),
        updatedAt: new Date(entry.updated_at).getTime(),
      }))
      .filter((time: { createdAt: number; updatedAt: number }) => (
        Number.isFinite(time.createdAt) && Number.isFinite(time.updatedAt)
      ));
    const createdAt = structureTimes.length > 0
      ? new Date(Math.min(...structureTimes.map((time: { createdAt: number }) => time.createdAt))).toISOString()
      : now;
    const updatedAt = structureTimes.length > 0
      ? new Date(Math.max(...structureTimes.map((time: { updatedAt: number }) => time.updatedAt))).toISOString()
      : now;

    return {
      events: [{
        id: crypto.randomUUID(),
        name: '未分類',
        created_at: createdAt,
        updated_at: updatedAt,
        structures: data.structures,
      }],
    };
  }

  return { events: [] };
}

function writeTrussStudio(data: TrussStudioFile) {
  fs.writeFileSync(TRUSS_STUDIO_FILE, JSON.stringify(data));
}

// --- Middleware ---
app.use(express.json({ limit: '10mb' }));

// --- API Routes ---

// Truss studio single resource
app.get('/api/truss-studio', (_req, res) => {
  try {
    res.json(readTrussStudio());
  } catch (err) {
    console.error('Get truss studio error:', err);
    res.status(500).json({ error: 'Failed to load truss studio' });
  }
});

app.put('/api/truss-studio', (req, res) => {
  try {
    const data: TrussStudioFile = {
      events: Array.isArray(req.body.events) ? req.body.events : [],
    };
    writeTrussStudio(data);
    res.json(data);
  } catch (err) {
    console.error('Save truss studio error:', err);
    res.status(500).json({ error: 'Failed to save truss studio' });
  }
});

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
