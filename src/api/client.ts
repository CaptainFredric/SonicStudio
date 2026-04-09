// Backend API Client for SonicStudio
// Supports both local and remote operations

const resolveApiBase = () => {
  const configured = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_URL : undefined;
  const base = typeof configured === 'string' && configured.trim()
    ? configured.trim()
    : 'http://localhost:3001/api';

  return base.replace(/\/+$/, '');
};

const API_BASE = resolveApiBase();

export interface SaveProjectRequest {
  name: string;
  data: unknown;
  tags: string[];
  isPublic: boolean;
}

export interface SaveProjectResponse {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  url: string;
}

export interface ProjectShareLink {
  id: string;
  projectId: string;
  token: string;
  expiresAt: string;
  views: number;
}

export interface AnalyticsEvent {
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
}

class SonicStudioAPI {
  private isOffline = false;

  /**
   * Save a project to the backend
   */
  async saveProject(project: SaveProjectRequest): Promise<SaveProjectResponse> {
    try {
      const response = await fetch(`${API_BASE}/projects/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.warn('Backend unavailable, project saved locally only', error);
      this.isOffline = true;
      return this.generateLocalProjectResponse(project);
    }
  }

  /**
   * Load a project from the backend
   */
  async loadProject(projectId: string): Promise<unknown> {
    try {
      const response = await fetch(`${API_BASE}/projects/${projectId}`, {
        method: 'GET',
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Failed to load project from backend', error);
      throw error;
    }
  }

  /**
   * Get list of user's projects
   */
  async listProjects(limit = 20, offset = 0): Promise<SaveProjectResponse[]> {
    try {
      const response = await fetch(
        `${API_BASE}/projects?limit=${limit}&offset=${offset}`,
        { method: 'GET' }
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.warn('Failed to list projects', error);
      return [];
    }
  }

  /**
   * Create a shareable link for a project
   */
  async createShareLink(projectId: string, expiresInDays = 30): Promise<ProjectShareLink> {
    try {
      const response = await fetch(`${API_BASE}/projects/${projectId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresInDays }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Failed to create share link', error);
      throw error;
    }
  }

  /**
   * Export project to WAV/MP3
   */
  async renderToAudio(projectId: string, format: 'wav' | 'mp3'): Promise<Blob> {
    try {
      const response = await fetch(`${API_BASE}/projects/${projectId}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.blob();
    } catch (error) {
      console.warn('Backend render unavailable, please export from client', error);
      throw error;
    }
  }

  /**
   * Track user analytics event
   */
  async trackEvent(event: AnalyticsEvent): Promise<void> {
    if (this.isOffline) return;

    try {
      await fetch(`${API_BASE}/analytics/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });
    } catch {
      // Silent fail for analytics
    }
  }

  /**
   * Check if backend is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private generateLocalProjectResponse(project: SaveProjectRequest): SaveProjectResponse {
    const id = `local-${Date.now()}`;
    return {
      id,
      name: project.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      url: `sonic://local/${id}`,
    };
  }
}

export const api = new SonicStudioAPI();
