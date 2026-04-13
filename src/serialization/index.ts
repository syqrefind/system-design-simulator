import type { DiagramModel } from '../layers/layer2/types';

// ─── Serialization Layer ──────────────────────────────────────────────────────
// Save/load diagram models to/from JSON + localStorage.

const STORAGE_KEY_PREFIX = 'sds_diagram_';
const INDEX_KEY = 'sds_index';

// ─── JSON Serialize / Deserialize ────────────────────────────────────────────

export function serializeDiagram(model: DiagramModel): string {
  return JSON.stringify(model, null, 2);
}

export function deserializeDiagram(json: string): DiagramModel {
  const data = JSON.parse(json) as unknown;
  validateDiagramShape(data);
  return data as DiagramModel;
}

function validateDiagramShape(data: unknown): asserts data is DiagramModel {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid diagram: not an object');
  }
  const d = data as Record<string, unknown>;
  if (typeof d['id'] !== 'string') throw new Error('Invalid diagram: missing id');
  if (typeof d['name'] !== 'string') throw new Error('Invalid diagram: missing name');
  if (!Array.isArray(d['nodes'])) throw new Error('Invalid diagram: nodes must be array');
  if (!Array.isArray(d['edges'])) throw new Error('Invalid diagram: edges must be array');
}

// ─── localStorage Persistence ─────────────────────────────────────────────────

export interface SavedDiagramMeta {
  id: string;
  name: string;
  updatedAt: string;
}

export function saveDiagram(model: DiagramModel): void {
  localStorage.setItem(STORAGE_KEY_PREFIX + model.id, serializeDiagram(model));
  updateIndex(model);
}

export function loadDiagram(id: string): DiagramModel | null {
  const json = localStorage.getItem(STORAGE_KEY_PREFIX + id);
  if (!json) return null;
  try {
    return deserializeDiagram(json);
  } catch {
    return null;
  }
}

export function listSavedDiagrams(): SavedDiagramMeta[] {
  const raw = localStorage.getItem(INDEX_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SavedDiagramMeta[];
  } catch {
    return [];
  }
}

export function deleteDiagram(id: string): void {
  localStorage.removeItem(STORAGE_KEY_PREFIX + id);
  const index = listSavedDiagrams().filter((m) => m.id !== id);
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

function updateIndex(model: DiagramModel): void {
  const index = listSavedDiagrams().filter((m) => m.id !== model.id);
  index.unshift({ id: model.id, name: model.name, updatedAt: model.updatedAt });
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

// ─── File Export / Import ────────────────────────────────────────────────────

export function exportDiagramFile(model: DiagramModel): void {
  const json = serializeDiagram(model);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${model.name.replace(/\s+/g, '_').toLowerCase()}.sds.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importDiagramFile(): Promise<DiagramModel> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.sds.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return reject(new Error('No file selected'));
      try {
        const text = await file.text();
        resolve(deserializeDiagram(text));
      } catch (e) {
        reject(e);
      }
    };
    input.click();
  });
}
