import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { renderTrussDiagramSvg } from './renderDiagram';
import { TRUSS_SEGMENT_LENGTHS } from '../trussConfig';
import type { BanquetObject, TrussStructureConfig, TrussStructureKind } from '../types';

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

const TRUSS_STRUCTURE_KINDS: TrussStructureKind[] = [
  'TOWER',
  'GOALPOST',
  'BACKDROP',
  'BOX',
  'LSHAPE',
  'TSHAPE',
  'MULTI_BAY',
];

const TRUSS_STRUCTURE_KIND_SET = new Set<string>(TRUSS_STRUCTURE_KINDS);
const TRUSS_SEGMENT_LENGTH_SET = new Set<number>(TRUSS_SEGMENT_LENGTHS);
const TRUSS_MEMBER_FIELDS = [
  'legs',
  'legsRight',
  'beam',
  'beamRight',
  'bottomBeam',
  'depthMember',
] as const;

const REQUIRED_MEMBERS_BY_KIND: Record<TrussStructureKind, Array<(typeof TRUSS_MEMBER_FIELDS)[number]>> = {
  TOWER: ['legs'],
  GOALPOST: ['legs', 'beam'],
  BACKDROP: ['legs', 'beam', 'depthMember'],
  BOX: ['legs', 'beam', 'bottomBeam'],
  LSHAPE: ['legs', 'beam'],
  TSHAPE: ['legs', 'beam', 'beamRight'],
  MULTI_BAY: ['legs', 'beam'],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateTrussMember(value: unknown, fieldName: string, required = false): string | null {
  if (value === undefined || value === null) {
    return required ? `${fieldName} is required` : null;
  }

  if (!isRecord(value) || !Array.isArray(value.segments)) {
    return `${fieldName}.segments must be an array`;
  }

  if (value.segments.length === 0) {
    return `${fieldName}.segments must contain at least one segment`;
  }

  const invalidSegment = value.segments.find(segment => (
    typeof segment !== 'number' || !TRUSS_SEGMENT_LENGTH_SET.has(segment)
  ));
  if (invalidSegment !== undefined) {
    return `${fieldName}.segments contains invalid segment length: ${String(invalidSegment)}`;
  }

  return null;
}

function validateTrussConfig(value: unknown): { config?: TrussStructureConfig; error?: string } {
  if (!isRecord(value)) return { error: 'config must be an object' };

  if (typeof value.kind !== 'string' || !TRUSS_STRUCTURE_KIND_SET.has(value.kind)) {
    return { error: 'config.kind is invalid' };
  }

  if (typeof value.title !== 'string' || value.title.trim() === '') {
    return { error: 'config.title is required' };
  }

  if (typeof value.quantity !== 'number' || !Number.isFinite(value.quantity) || value.quantity < 1) {
    return { error: 'config.quantity must be a positive number' };
  }

  const kind = value.kind as TrussStructureKind;
  const requiredMembers = new Set(REQUIRED_MEMBERS_BY_KIND[kind]);

  for (const fieldName of TRUSS_MEMBER_FIELDS) {
    const error = validateTrussMember(value[fieldName], `config.${fieldName}`, requiredMembers.has(fieldName));
    if (error) return { error };
  }

  if (value.bayCount !== undefined && (
    typeof value.bayCount !== 'number' || !Number.isFinite(value.bayCount)
  )) {
    return { error: 'config.bayCount must be a number' };
  }

  if (value.beamAttachCm !== undefined && (
    typeof value.beamAttachCm !== 'number' || !Number.isFinite(value.beamAttachCm)
  )) {
    return { error: 'config.beamAttachCm must be a number' };
  }

  return { config: value as unknown as TrussStructureConfig };
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

function findTrussEvent(data: TrussStudioFile, eventId: string): TrussStudioEvent | null {
  return data.events.find(event => event.id === eventId) || null;
}

function findTrussStructure(event: TrussStudioEvent, structureId: string): TrussStudioEntry | null {
  return event.structures.find(structure => structure.id === structureId) || null;
}

function sendBadRequest(res: express.Response, error: string) {
  return res.status(400).json({ error });
}

function sendNotFound(res: express.Response, error = 'Not found') {
  return res.status(404).json({ error });
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

app.post('/api/truss-studio/events', (req, res) => {
  try {
    if (typeof req.body.name !== 'string' || req.body.name.trim() === '') {
      return sendBadRequest(res, 'name is required');
    }

    const data = readTrussStudio();
    const now = new Date().toISOString();
    const event: TrussStudioEvent = {
      id: crypto.randomUUID(),
      name: req.body.name.trim(),
      created_at: now,
      updated_at: now,
      structures: [],
    };

    data.events.push(event);
    writeTrussStudio(data);
    res.status(201).json(event);
  } catch (err) {
    console.error('Create truss event error:', err);
    res.status(500).json({ error: 'Failed to create truss event' });
  }
});

app.patch('/api/truss-studio/events/:eventId', (req, res) => {
  try {
    if (typeof req.body.name !== 'string' || req.body.name.trim() === '') {
      return sendBadRequest(res, 'name is required');
    }

    const data = readTrussStudio();
    const event = findTrussEvent(data, req.params.eventId);
    if (!event) return sendNotFound(res);

    event.name = req.body.name.trim();
    event.updated_at = new Date().toISOString();
    writeTrussStudio(data);
    res.json(event);
  } catch (err) {
    console.error('Rename truss event error:', err);
    res.status(500).json({ error: 'Failed to rename truss event' });
  }
});

app.delete('/api/truss-studio/events/:eventId', (req, res) => {
  try {
    const data = readTrussStudio();
    const index = data.events.findIndex(event => event.id === req.params.eventId);
    if (index === -1) return sendNotFound(res);

    data.events.splice(index, 1);
    writeTrussStudio(data);
    res.json({ deleted: true });
  } catch (err) {
    console.error('Delete truss event error:', err);
    res.status(500).json({ error: 'Failed to delete truss event' });
  }
});

app.post('/api/truss-studio/events/:eventId/structures', (req, res) => {
  try {
    if (req.body.config === undefined) return sendBadRequest(res, 'config is required');

    const validation = validateTrussConfig(req.body.config);
    if (validation.error || !validation.config) return sendBadRequest(res, validation.error || 'Invalid config');

    const data = readTrussStudio();
    const event = findTrussEvent(data, req.params.eventId);
    if (!event) return sendNotFound(res);

    const now = new Date().toISOString();
    const structure: TrussStudioEntry = {
      id: crypto.randomUUID(),
      config: validation.config,
      created_at: now,
      updated_at: now,
    };

    event.structures.push(structure);
    event.updated_at = now;
    writeTrussStudio(data);
    res.status(201).json(structure);
  } catch (err) {
    console.error('Create truss structure error:', err);
    res.status(500).json({ error: 'Failed to create truss structure' });
  }
});

app.put('/api/truss-studio/events/:eventId/structures/:structureId', (req, res) => {
  try {
    if (req.body.config === undefined) return sendBadRequest(res, 'config is required');

    const validation = validateTrussConfig(req.body.config);
    if (validation.error || !validation.config) return sendBadRequest(res, validation.error || 'Invalid config');

    const data = readTrussStudio();
    const event = findTrussEvent(data, req.params.eventId);
    if (!event) return sendNotFound(res);

    const structure = findTrussStructure(event, req.params.structureId);
    if (!structure) return sendNotFound(res);

    const now = new Date().toISOString();
    structure.config = validation.config;
    structure.updated_at = now;
    event.updated_at = now;
    writeTrussStudio(data);
    res.json(structure);
  } catch (err) {
    console.error('Update truss structure error:', err);
    res.status(500).json({ error: 'Failed to update truss structure' });
  }
});

app.delete('/api/truss-studio/events/:eventId/structures/:structureId', (req, res) => {
  try {
    const data = readTrussStudio();
    const event = findTrussEvent(data, req.params.eventId);
    if (!event) return sendNotFound(res);

    const index = event.structures.findIndex(structure => structure.id === req.params.structureId);
    if (index === -1) return sendNotFound(res);

    event.structures.splice(index, 1);
    event.updated_at = new Date().toISOString();
    writeTrussStudio(data);
    res.json({ deleted: true });
  } catch (err) {
    console.error('Delete truss structure error:', err);
    res.status(500).json({ error: 'Failed to delete truss structure' });
  }
});

app.get('/api/truss-studio/events/:eventId/structures/:structureId/diagram.svg', (req, res) => {
  try {
    const data = readTrussStudio();
    const event = findTrussEvent(data, req.params.eventId);
    if (!event) return sendNotFound(res);

    const structure = findTrussStructure(event, req.params.structureId);
    if (!structure) return sendNotFound(res);

    const validation = validateTrussConfig(structure.config);
    if (validation.error || !validation.config) return sendBadRequest(res, validation.error || 'Invalid config');

    res.type('image/svg+xml').send(renderTrussDiagramSvg(validation.config));
  } catch (err) {
    console.error('Render stored truss diagram error:', err);
    res.status(500).json({ error: 'Failed to render truss diagram' });
  }
});

app.post('/api/truss/diagram.svg', (req, res) => {
  try {
    if (req.body.config === undefined) return sendBadRequest(res, 'config is required');

    const validation = validateTrussConfig(req.body.config);
    if (validation.error || !validation.config) return sendBadRequest(res, validation.error || 'Invalid config');

    res.type('image/svg+xml').send(renderTrussDiagramSvg(validation.config));
  } catch (err) {
    console.error('Render ad-hoc truss diagram error:', err);
    res.status(500).json({ error: 'Failed to render truss diagram' });
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
  if (!scene) return sendNotFound(res);
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
    if (!scene) return sendNotFound(res);
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
  if (!fs.existsSync(filePath)) return sendNotFound(res);
  fs.unlinkSync(filePath);
  res.json({ deleted: true });
});

app.post('/api/scenes/:id/objects', (req, res) => {
  try {
    if (!Array.isArray(req.body.objects)) {
      return sendBadRequest(res, 'objects must be an array');
    }

    if (req.body.objects.some((object: unknown) => !isRecord(object))) {
      return sendBadRequest(res, 'objects must contain only objects');
    }

    const scene = readScene(req.params.id);
    if (!scene) return sendNotFound(res);

    if (!isRecord(scene.data)) scene.data = {};
    if (!Array.isArray(scene.data.objects)) scene.data.objects = [];

    const objects = req.body.objects.map((object: Partial<BanquetObject>) => ({
      ...object,
      id: typeof object.id === 'string' && object.id.trim() !== ''
        ? object.id
        : crypto.randomUUID(),
    })) as BanquetObject[];

    scene.data.objects.push(...objects);
    scene.updated_at = new Date().toISOString();
    writeScene(scene);
    res.status(201).json({ objects, updated_at: scene.updated_at });
  } catch (err) {
    console.error('Append scene objects error:', err);
    res.status(500).json({ error: 'Failed to append scene objects' });
  }
});

app.delete('/api/scenes/:id/objects/:objectId', (req, res) => {
  try {
    const scene = readScene(req.params.id);
    if (!scene) return sendNotFound(res);
    if (!isRecord(scene.data) || !Array.isArray(scene.data.objects)) return sendNotFound(res);

    const index = scene.data.objects.findIndex((object: Partial<BanquetObject>) => object.id === req.params.objectId);
    if (index === -1) return sendNotFound(res);

    scene.data.objects.splice(index, 1);
    scene.updated_at = new Date().toISOString();
    writeScene(scene);
    res.json({ deleted: true, updated_at: scene.updated_at });
  } catch (err) {
    console.error('Delete scene object error:', err);
    res.status(500).json({ error: 'Failed to delete scene object' });
  }
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
