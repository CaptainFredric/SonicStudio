// SonicStudio optional local backend.
// Scope: health checks plus basic local project save, load, list, and share.

import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = process.env.DATA_DIR || './data';

app.use(cors());
app.use(express.json({ limit: '100mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Save project endpoint
app.post('/api/projects/save', async (req, res) => {
  try {
    const { name, data, tags, isPublic } = req.body;
    const projectId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const projectData = {
      id: projectId,
      name,
      data,
      tags,
      isPublic,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await ensureDir(DATA_DIR);
    const filePath = path.join(DATA_DIR, `${projectId}.json`);
    await fs.writeFile(filePath, JSON.stringify(projectData, null, 2));

    res.json({
      id: projectId,
      name,
      createdAt: projectData.createdAt,
      updatedAt: projectData.updatedAt,
      url: `/api/projects/${projectId}`,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Load project endpoint
app.get('/api/projects/:id', async (req, res) => {
  try {
    const filePath = path.join(DATA_DIR, `${req.params.id}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    const project = JSON.parse(content);
    res.json(project.data);
  } catch (error) {
    res.status(404).json({ error: 'Project not found' });
  }
});

// List projects endpoint
app.get('/api/projects', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const files = await fs.readdir(DATA_DIR);
    const projects = [];

    for (const file of files.slice(offset, offset + limit)) {
      const content = await fs.readFile(path.join(DATA_DIR, file), 'utf-8');
      const project = JSON.parse(content);
      projects.push({
        id: project.id,
        name: project.name,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        url: `/api/projects/${project.id}`,
      });
    }

    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create share link endpoint
app.post('/api/projects/:id/share', async (req, res) => {
  try {
    const { expiresInDays = 30 } = req.body;
    const token = generateToken();
    
    const shareLink = {
      id: `share_${Date.now()}`,
      projectId: req.params.id,
      token,
      expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString(),
      views: 0,
    };

    // TODO: Store share link in database
    res.json(shareLink);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Analytics endpoint
app.post('/api/analytics/track', async (req, res) => {
  try {
    const { type, timestamp, data } = req.body;
    
    // TODO: Store analytics event in database
    console.log(`[ANALYTICS] ${type}:`, data);
    
    res.json({ recorded: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Render project to audio endpoint
app.post('/api/projects/:id/render', async (req, res) => {
  try {
    const { format = 'wav' } = req.body;
    
    // TODO: Implement audio rendering using server-side Tone.js or libsndfile
    res.setHeader('Content-Type', format === 'mp3' ? 'audio/mpeg' : 'audio/wav');
    res.setHeader('Content-Disposition', `attachment; filename="project.${format}"`);
    
    // Send placeholder response
    res.send(Buffer.alloc(1024));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

async function ensureDir(dir: string) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // Directory exists
  }
}

function generateToken(): string {
  return `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

app.listen(PORT, () => {
  console.log(`SonicStudio Backend running on http://localhost:${PORT}`);
});

export default app;
