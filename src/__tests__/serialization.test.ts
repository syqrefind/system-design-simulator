import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  serializeDiagram,
  deserializeDiagram,
  saveDiagram,
  loadDiagram,
  listSavedDiagrams,
  deleteDiagram,
} from '../serialization';
import type { DiagramModel } from '../layers/layer2/types';

// ─── Serialization Tests ──────────────────────────────────────────────────────

function makeDiagram(overrides?: Partial<DiagramModel>): DiagramModel {
  return {
    id: 'test-id-123',
    name: 'Test Diagram',
    description: 'Unit test diagram',
    nodes: [
      { id: 'n1', type: 'service', label: 'Service A', position: { x: 100, y: 200 }, state: 'running' },
      { id: 'n2', type: 'db', label: 'Database', position: { x: 300, y: 200 } },
    ],
    edges: [
      { id: 'edge-n1-n2', from: 'n1', to: 'n2', type: 'sync', label: 'query' },
    ],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ─── JSON Serialize / Deserialize ─────────────────────────────────────────────

describe('serializeDiagram', () => {
  it('returns a valid JSON string', () => {
    const model = makeDiagram();
    const json = serializeDiagram(model);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('preserves all nodes', () => {
    const model = makeDiagram();
    const json = serializeDiagram(model);
    const parsed = JSON.parse(json) as DiagramModel;
    expect(parsed.nodes).toHaveLength(2);
  });

  it('preserves all edges', () => {
    const model = makeDiagram();
    const json = serializeDiagram(model);
    const parsed = JSON.parse(json) as DiagramModel;
    expect(parsed.edges).toHaveLength(1);
  });

  it('preserves node positions exactly', () => {
    const model = makeDiagram();
    const json = serializeDiagram(model);
    const parsed = JSON.parse(json) as DiagramModel;
    expect(parsed.nodes[0].position).toEqual({ x: 100, y: 200 });
  });

  it('preserves optional node state', () => {
    const model = makeDiagram();
    const json = serializeDiagram(model);
    const parsed = JSON.parse(json) as DiagramModel;
    expect(parsed.nodes[0].state).toBe('running');
  });

  it('produces pretty-printed JSON', () => {
    const model = makeDiagram();
    const json = serializeDiagram(model);
    expect(json).toContain('\n');
    expect(json).toContain('  ');
  });
});

describe('deserializeDiagram', () => {
  it('round-trips a diagram correctly', () => {
    const model = makeDiagram();
    const json = serializeDiagram(model);
    const restored = deserializeDiagram(json);
    expect(restored).toEqual(model);
  });

  it('throws on invalid JSON', () => {
    expect(() => deserializeDiagram('not json')).toThrow();
  });

  it('throws when id is missing', () => {
    const model = makeDiagram();
    const data = JSON.parse(serializeDiagram(model)) as Record<string, unknown>;
    delete data['id'];
    expect(() => deserializeDiagram(JSON.stringify(data))).toThrow('missing id');
  });

  it('throws when name is missing', () => {
    const model = makeDiagram();
    const data = JSON.parse(serializeDiagram(model)) as Record<string, unknown>;
    delete data['name'];
    expect(() => deserializeDiagram(JSON.stringify(data))).toThrow('missing name');
  });

  it('throws when nodes is not an array', () => {
    const model = makeDiagram();
    const data = JSON.parse(serializeDiagram(model)) as Record<string, unknown>;
    data['nodes'] = 'not-an-array';
    expect(() => deserializeDiagram(JSON.stringify(data))).toThrow('nodes must be array');
  });

  it('throws when edges is not an array', () => {
    const model = makeDiagram();
    const data = JSON.parse(serializeDiagram(model)) as Record<string, unknown>;
    data['edges'] = 42;
    expect(() => deserializeDiagram(JSON.stringify(data))).toThrow('edges must be array');
  });

  it('throws when data is not an object', () => {
    expect(() => deserializeDiagram('"just a string"')).toThrow('not an object');
  });

  it('throws when data is null', () => {
    expect(() => deserializeDiagram('null')).toThrow('not an object');
  });

  it('preserves optional description field', () => {
    const model = makeDiagram({ description: 'Detailed description' });
    const restored = deserializeDiagram(serializeDiagram(model));
    expect(restored.description).toBe('Detailed description');
  });

  it('handles model with no description', () => {
    const model = makeDiagram();
    delete model.description;
    const restored = deserializeDiagram(serializeDiagram(model));
    expect(restored.description).toBeUndefined();
  });

  it('handles model with metadata', () => {
    const model = makeDiagram({ metadata: { version: 2, author: 'test' } });
    const restored = deserializeDiagram(serializeDiagram(model));
    expect(restored.metadata?.version).toBe(2);
  });
});

// ─── localStorage Persistence ─────────────────────────────────────────────────

describe('localStorage save/load/delete', () => {
  // Mock localStorage
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, val: string) => { store[key] = val; }),
      removeItem: vi.fn((key: string) => { delete store[key]; }),
      clear: () => { store = {}; },
    };
  })();

  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  it('saveDiagram stores JSON in localStorage', () => {
    const model = makeDiagram();
    saveDiagram(model);
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  it('loadDiagram retrieves saved diagram', () => {
    const model = makeDiagram();
    saveDiagram(model);
    const loaded = loadDiagram(model.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.id).toBe(model.id);
    expect(loaded?.name).toBe(model.name);
  });

  it('loadDiagram returns null for unknown id', () => {
    expect(loadDiagram('nonexistent-id')).toBeNull();
  });

  it('listSavedDiagrams returns empty array initially', () => {
    expect(listSavedDiagrams()).toEqual([]);
  });

  it('listSavedDiagrams includes saved diagram metadata', () => {
    const model = makeDiagram();
    saveDiagram(model);
    const list = listSavedDiagrams();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(model.id);
    expect(list[0].name).toBe(model.name);
  });

  it('saving multiple diagrams lists all of them', () => {
    const m1 = makeDiagram({ id: 'id-1', name: 'Diagram 1' });
    const m2 = makeDiagram({ id: 'id-2', name: 'Diagram 2' });
    saveDiagram(m1);
    saveDiagram(m2);
    const list = listSavedDiagrams();
    expect(list).toHaveLength(2);
  });

  it('overwriting a diagram updates the index without duplication', () => {
    const model = makeDiagram();
    saveDiagram(model);
    saveDiagram({ ...model, name: 'Updated Name' });
    expect(listSavedDiagrams()).toHaveLength(1);
    expect(listSavedDiagrams()[0].name).toBe('Updated Name');
  });

  it('deleteDiagram removes the diagram', () => {
    const model = makeDiagram();
    saveDiagram(model);
    deleteDiagram(model.id);
    expect(loadDiagram(model.id)).toBeNull();
  });

  it('deleteDiagram removes from index', () => {
    const model = makeDiagram();
    saveDiagram(model);
    deleteDiagram(model.id);
    expect(listSavedDiagrams()).toHaveLength(0);
  });

  it('loadDiagram returns null for corrupted data', () => {
    localStorageMock.setItem('sds_diagram_bad-id', 'not valid json{{');
    const result = loadDiagram('bad-id');
    expect(result).toBeNull();
  });

  it('listSavedDiagrams returns empty array on corrupted index', () => {
    localStorageMock.setItem('sds_index', 'corrupted');
    expect(listSavedDiagrams()).toEqual([]);
  });

  it('diagram metadata in index has required fields', () => {
    const model = makeDiagram();
    saveDiagram(model);
    const meta = listSavedDiagrams()[0];
    expect(meta.id).toBeTruthy();
    expect(meta.name).toBeTruthy();
    expect(meta.updatedAt).toBeTruthy();
  });
});
