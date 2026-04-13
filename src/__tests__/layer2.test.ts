import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiagramModelManager } from '../layers/layer2/DiagramModel';
import { ShardGroupBuilder, ReplicaSetBuilder, LoadBalancerBuilder, resolveNodePath } from '../layers/layer2/primitives';

// ─── Layer 2: DiagramModel Tests ──────────────────────────────────────────────

describe('DiagramModelManager', () => {
  let mgr: DiagramModelManager;

  beforeEach(() => {
    mgr = new DiagramModelManager('Test Diagram', 'Unit test diagram');
  });

  // ── Node CRUD ──────────────────────────────────────────────────────────────

  describe('Node management', () => {
    it('adds a node and retrieves it', () => {
      const node = mgr.addNode('service', 'My Service', { x: 100, y: 200 });
      expect(node.id).toBeTruthy();
      expect(node.type).toBe('service');
      expect(node.label).toBe('My Service');
      expect(node.position).toEqual({ x: 100, y: 200 });
    });

    it('adds a named node with explicit id', () => {
      mgr.addNamedNode('svc-1', 'gateway', 'Gateway', { x: 0, y: 0 });
      const node = mgr.getNode('svc-1');
      expect(node).toBeDefined();
      expect(node?.id).toBe('svc-1');
    });

    it('returns undefined for unknown node id', () => {
      expect(mgr.getNode('nonexistent')).toBeUndefined();
    });

    it('removes a node by id', () => {
      mgr.addNamedNode('to-remove', 'service', 'Temp', { x: 0, y: 0 });
      expect(mgr.removeNode('to-remove')).toBe(true);
      expect(mgr.getNode('to-remove')).toBeUndefined();
    });

    it('returns false when removing nonexistent node', () => {
      expect(mgr.removeNode('ghost')).toBe(false);
    });

    it('removes connected edges when removing a node', () => {
      mgr.addNamedNode('a', 'service', 'A', { x: 0, y: 0 });
      mgr.addNamedNode('b', 'service', 'B', { x: 100, y: 0 });
      mgr.addEdge('a', 'b', 'sync');
      expect(mgr.edges).toHaveLength(1);
      mgr.removeNode('a');
      expect(mgr.edges).toHaveLength(0);
    });

    it('sets node state and emits event', () => {
      mgr.addNamedNode('svc', 'service', 'SVC', { x: 0, y: 0 });
      const listener = vi.fn();
      mgr.on('node_state_change', listener);

      mgr.setNodeState('svc', 'running');

      const node = mgr.getNode('svc');
      expect(node?.state).toBe('running');
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'node_state_change', nodeId: 'svc' }),
      );
    });

    it('ignores setNodeState for unknown ids', () => {
      // should not throw
      expect(() => mgr.setNodeState('ghost', 'running')).not.toThrow();
    });

    it('updates node position', () => {
      mgr.addNamedNode('n', 'service', 'N', { x: 0, y: 0 });
      mgr.setNodePosition('n', { x: 50, y: 75 });
      expect(mgr.getNode('n')?.position).toEqual({ x: 50, y: 75 });
    });

    it('auto-increments node ids', () => {
      const n1 = mgr.addNode('service', 'A', { x: 0, y: 0 });
      const n2 = mgr.addNode('service', 'B', { x: 0, y: 0 });
      expect(n1.id).not.toBe(n2.id);
    });

    it('nodes array is readonly (snapshot)', () => {
      mgr.addNode('service', 'X', { x: 0, y: 0 });
      const snapshot = mgr.snapshot();
      snapshot.nodes.push({ id: 'injected', type: 'service', label: 'bad', position: { x: 0, y: 0 } });
      expect(mgr.nodes).toHaveLength(1); // original unaffected
    });
  });

  // ── Edge CRUD ──────────────────────────────────────────────────────────────

  describe('Edge management', () => {
    beforeEach(() => {
      mgr.addNamedNode('a', 'service', 'A', { x: 0, y: 0 });
      mgr.addNamedNode('b', 'service', 'B', { x: 0, y: 100 });
    });

    it('adds an edge between two nodes', () => {
      const edge = mgr.addEdge('a', 'b', 'sync', 'HTTP');
      expect(edge.from).toBe('a');
      expect(edge.to).toBe('b');
      expect(edge.type).toBe('sync');
      expect(edge.label).toBe('HTTP');
    });

    it('retrieves an edge by id', () => {
      const edge = mgr.addEdge('a', 'b', 'async');
      expect(mgr.getEdge(edge.id)).toEqual(edge);
    });

    it('finds edge between two nodes', () => {
      mgr.addEdge('a', 'b', 'sync');
      const edge = mgr.getEdgeBetween('a', 'b');
      expect(edge).toBeDefined();
    });

    it('finds bidirectional edge in reverse', () => {
      mgr.addEdge('a', 'b', 'sync', undefined, true);
      expect(mgr.getEdgeBetween('b', 'a')).toBeDefined();
    });

    it('returns undefined for no edge between nodes', () => {
      expect(mgr.getEdgeBetween('a', 'b')).toBeUndefined();
    });

    it('removes an edge', () => {
      const edge = mgr.addEdge('a', 'b', 'sync');
      expect(mgr.removeEdge(edge.id)).toBe(true);
      expect(mgr.getEdge(edge.id)).toBeUndefined();
    });

    it('returns false when removing nonexistent edge', () => {
      expect(mgr.removeEdge('ghost-edge')).toBe(false);
    });

    it('defaults edge type to sync', () => {
      const edge = mgr.addEdge('a', 'b');
      expect(edge.type).toBe('sync');
    });
  });

  // ── Graph Queries ──────────────────────────────────────────────────────────

  describe('Graph queries', () => {
    beforeEach(() => {
      mgr.addNamedNode('a', 'client',  'A', { x: 0, y: 0 });
      mgr.addNamedNode('b', 'service', 'B', { x: 100, y: 0 });
      mgr.addNamedNode('c', 'db',      'C', { x: 200, y: 0 });
      mgr.addEdge('a', 'b', 'sync');
      mgr.addEdge('b', 'c', 'sync');
    });

    it('returns neighbors of a node', () => {
      const neighbors = mgr.getNeighbors('a');
      expect(neighbors.map((n) => n.id)).toContain('b');
      expect(neighbors.map((n) => n.id)).not.toContain('c');
    });

    it('returns outgoing edges', () => {
      const out = mgr.getOutgoingEdges('a');
      expect(out).toHaveLength(1);
      expect(out[0].to).toBe('b');
    });

    it('returns incoming edges', () => {
      const inc = mgr.getIncomingEdges('c');
      expect(inc).toHaveLength(1);
      expect(inc[0].from).toBe('b');
    });

    it('returns empty neighbors for isolated node', () => {
      mgr.addNamedNode('isolated', 'service', 'Isolated', { x: 0, y: 0 });
      expect(mgr.getNeighbors('isolated')).toHaveLength(0);
    });
  });

  // ── Event Bus ──────────────────────────────────────────────────────────────

  describe('Event bus', () => {
    it('subscribes to specific event type', () => {
      const listener = vi.fn();
      mgr.on('failure', listener);
      mgr.emit({ type: 'failure', nodeId: 'x', timestamp: Date.now() });
      expect(listener).toHaveBeenCalledOnce();
    });

    it('wildcard (*) receives all events', () => {
      const listener = vi.fn();
      mgr.on('*', listener);
      mgr.emit({ type: 'request_start', timestamp: Date.now() });
      mgr.emit({ type: 'request_complete', timestamp: Date.now() });
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('unsubscribe stops delivery', () => {
      const listener = vi.fn();
      const off = mgr.on('recovery', listener);
      off();
      mgr.emit({ type: 'recovery', timestamp: Date.now() });
      expect(listener).not.toHaveBeenCalled();
    });

    it('different event types are isolated', () => {
      const listener = vi.fn();
      mgr.on('leader_elected', listener);
      mgr.emit({ type: 'failure', timestamp: Date.now() });
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ── Serialization ──────────────────────────────────────────────────────────

  describe('Serialization', () => {
    it('produces valid JSON', () => {
      mgr.addNode('service', 'SVC', { x: 0, y: 0 });
      expect(() => JSON.parse(mgr.toJSON())).not.toThrow();
    });

    it('snapshot is deep copy', () => {
      mgr.addNamedNode('n1', 'service', 'N1', { x: 0, y: 0 });
      const snap = mgr.snapshot();
      snap.nodes[0].label = 'MUTATED';
      expect(mgr.getNode('n1')?.label).toBe('N1');
    });

    it('restores from JSON', () => {
      mgr.addNamedNode('n1', 'service', 'Restored', { x: 10, y: 20 }, 'running');
      const json = mgr.toJSON();

      const restored = DiagramModelManager.fromJSON(json);
      expect(restored.getNode('n1')?.label).toBe('Restored');
      expect(restored.getNode('n1')?.state).toBe('running');
    });
  });
});

// ─── Layer 2: Primitives Tests ────────────────────────────────────────────────

describe('ShardGroupBuilder', () => {
  it('creates the correct number of shard nodes', () => {
    const mgr = new DiagramModelManager('test', '');
    const group = ShardGroupBuilder.create(mgr, 'users', 'Users', 'user_id', 3, { x: 0, y: 0 });
    expect(group.shards).toHaveLength(3);
    expect(mgr.nodes).toHaveLength(3);
  });

  it('spaces nodes correctly', () => {
    const mgr = new DiagramModelManager('test', '');
    const group = ShardGroupBuilder.create(mgr, 'g', 'G', 'key', 2, { x: 100, y: 200 }, 150);
    expect(group.shards[0].position.x).toBe(100);
    expect(group.shards[1].position.x).toBe(250);
  });

  it('sets sharding metadata on each shard', () => {
    const mgr = new DiagramModelManager('test', '');
    ShardGroupBuilder.create(mgr, 'g', 'G', 'user_id', 2, { x: 0, y: 0 });
    const s0 = mgr.getNode('g-shard-0');
    expect(s0?.metadata?.shardingKey).toBe('user_id');
    expect(s0?.metadata?.totalShards).toBe(2);
  });
});

describe('ReplicaSetBuilder', () => {
  it('creates primary + N-1 replicas', () => {
    const mgr = new DiagramModelManager('test', '');
    const rs = ReplicaSetBuilder.create(mgr, 'rs', 'Posts', 3, { x: 0, y: 0 });
    expect(rs.replicas).toHaveLength(2);
    expect(mgr.nodes).toHaveLength(3);
  });

  it('creates async replication edges', () => {
    const mgr = new DiagramModelManager('test', '');
    ReplicaSetBuilder.create(mgr, 'rs', 'DB', 3, { x: 0, y: 0 });
    const asyncEdges = mgr.edges.filter((e) => e.type === 'async');
    expect(asyncEdges).toHaveLength(2);
  });

  it('marks primary node role', () => {
    const mgr = new DiagramModelManager('test', '');
    const rs = ReplicaSetBuilder.create(mgr, 'rs', 'DB', 2, { x: 0, y: 0 });
    expect(rs.primary.state).toBe('primary');
    expect(rs.primary.metadata?.role).toBe('primary');
  });
});

describe('LoadBalancerBuilder', () => {
  it('creates a load balancer + N upstream nodes', () => {
    const mgr = new DiagramModelManager('test', '');
    const lb = LoadBalancerBuilder.create(mgr, 'api', 'round-robin', 3, 'API', { x: 300, y: 100 });
    expect(lb.upstreams).toHaveLength(3);
    expect(mgr.nodes).toHaveLength(4); // lb + 3 upstreams
  });

  it('creates sync edges from LB to each upstream', () => {
    const mgr = new DiagramModelManager('test', '');
    LoadBalancerBuilder.create(mgr, 'lb', 'least-connections', 2, 'SVC', { x: 0, y: 0 });
    expect(mgr.edges).toHaveLength(2);
    mgr.edges.forEach((e) => {
      expect(e.from).toBe('lb-lb');
      expect(e.type).toBe('sync');
    });
  });
});

describe('resolveNodePath', () => {
  it('returns nodes in path order', () => {
    const mgr = new DiagramModelManager('test', '');
    mgr.addNamedNode('a', 'client',  'A', { x: 0, y: 0 });
    mgr.addNamedNode('b', 'service', 'B', { x: 0, y: 0 });
    mgr.addNamedNode('c', 'db',      'C', { x: 0, y: 0 });

    const nodes = resolveNodePath(mgr, ['a', 'b', 'c']);
    expect(nodes.map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });

  it('throws for unknown node in path', () => {
    const mgr = new DiagramModelManager('test', '');
    mgr.addNamedNode('a', 'service', 'A', { x: 0, y: 0 });
    expect(() => resolveNodePath(mgr, ['a', 'ghost'])).toThrow("Node 'ghost' not found");
  });
});
