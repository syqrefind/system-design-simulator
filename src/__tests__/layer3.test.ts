import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiagramModelManager } from '../layers/layer2/DiagramModel';
import { buildRequestFlowModel, REQUEST_PATHS } from '../projects/RequestFlow/simulation';
import { buildK8sModel, POD_SCENARIOS } from '../projects/K8sPodLifecycle/simulation';
import { buildRaftModel, RAFT_NODE_IDS } from '../projects/LeaderElection/simulation';

// ─── Layer 3: Simulation Tests ────────────────────────────────────────────────
// Tests the simulation/model logic in isolation from PixiJS/GSAP.

// ─── Request Flow Model Tests ─────────────────────────────────────────────────

describe('RequestFlow model', () => {
  let mgr: DiagramModelManager;

  beforeEach(() => {
    mgr = buildRequestFlowModel();
  });

  it('has all required nodes', () => {
    const requiredIds = ['client', 'gateway', 'auth', 'orders', 'catalog', 'cache', 'orders-db', 'catalog-db', 'queue', 'worker'];
    requiredIds.forEach((id) => {
      expect(mgr.getNode(id)).toBeDefined();
    });
  });

  it('has correct number of nodes and edges', () => {
    expect(mgr.nodes).toHaveLength(10);
    expect(mgr.edges).toHaveLength(10);
  });

  it('client connects to gateway', () => {
    const edge = mgr.getEdgeBetween('client', 'gateway');
    expect(edge).toBeDefined();
    expect(edge?.type).toBe('sync');
  });

  it('orders → queue edge is async', () => {
    const edge = mgr.getEdgeBetween('orders', 'queue');
    expect(edge).toBeDefined();
    expect(edge?.type).toBe('async');
  });

  it('queue → worker edge is event type', () => {
    const edge = mgr.getEdgeBetween('queue', 'worker');
    expect(edge).toBeDefined();
    expect(edge?.type).toBe('event');
  });

  it('all request paths reference existing nodes', () => {
    REQUEST_PATHS.forEach(({ path }) => {
      path.forEach((nodeId) => {
        expect(mgr.getNode(nodeId)).toBeDefined();
      });
    });
  });

  it('request paths cover diverse node types', () => {
    const visitedTypes = new Set<string>();
    REQUEST_PATHS.forEach(({ path }) => {
      path.forEach((id) => {
        const node = mgr.getNode(id);
        if (node) visitedTypes.add(node.type);
      });
    });
    expect(visitedTypes.size).toBeGreaterThan(3);
  });

  it('emits request_start on state change', () => {
    const listener = vi.fn();
    mgr.on('request_start', listener);
    mgr.emit({ type: 'request_start', data: { path: ['client', 'gateway'] }, timestamp: Date.now() });
    expect(listener).toHaveBeenCalledOnce();
  });

  it('serializes and deserializes correctly', () => {
    const json = mgr.toJSON();
    const restored = DiagramModelManager.fromJSON(json);
    expect(restored.nodes).toHaveLength(mgr.nodes.length);
    expect(restored.edges).toHaveLength(mgr.edges.length);
    expect(restored.getNode('client')?.label).toBe('Browser');
  });
});

// ─── K8s Model Tests ──────────────────────────────────────────────────────────

describe('K8s model', () => {
  let mgr: DiagramModelManager;

  beforeEach(() => {
    mgr = buildK8sModel();
  });

  it('has all control plane nodes', () => {
    expect(mgr.getNode('api-server')).toBeDefined();
    expect(mgr.getNode('scheduler')).toBeDefined();
    expect(mgr.getNode('etcd')).toBeDefined();
  });

  it('has 3 worker nodes', () => {
    const workers = mgr.nodes.filter((n) => n.type === 'server');
    expect(workers).toHaveLength(3);
  });

  it('has 3 pods in pending state', () => {
    const pods = mgr.nodes.filter((n) => n.type === 'pod');
    expect(pods).toHaveLength(3);
    pods.forEach((pod) => {
      expect(pod.state).toBe('pending');
    });
  });

  it('scheduler connects to each worker node', () => {
    ['node-1', 'node-2', 'node-3'].forEach((nodeId) => {
      const edge = mgr.getEdgeBetween('scheduler', nodeId);
      expect(edge).toBeDefined();
    });
  });

  it('each worker connects to its pod', () => {
    const pairs = [['node-1', 'pod-a'], ['node-2', 'pod-b'], ['node-3', 'pod-c']];
    pairs.forEach(([node, pod]) => {
      const edge = mgr.getEdgeBetween(node, pod);
      expect(edge).toBeDefined();
    });
  });

  it('pod transitions through states', () => {
    const listener = vi.fn();
    mgr.on('node_state_change', listener);

    mgr.setNodeState('pod-a', 'running');
    mgr.setNodeState('pod-a', 'succeeded');
    mgr.setNodeState('pod-a', 'terminated');

    expect(listener).toHaveBeenCalledTimes(3);
    expect(mgr.getNode('pod-a')?.state).toBe('terminated');
  });

  it('failure scenario pod transitions to failed', () => {
    mgr.setNodeState('pod-c', 'running');
    mgr.setNodeState('pod-c', 'failed');
    expect(mgr.getNode('pod-c')?.state).toBe('failed');
  });

  it('all pod scenario paths resolve to valid nodes', () => {
    POD_SCENARIOS.forEach((scenario) => {
      scenario.schedulerPath.forEach((id) => {
        expect(mgr.getNode(id)).toBeDefined();
      });
    });
  });
});

// ─── Raft Model Tests ─────────────────────────────────────────────────────────

describe('Raft model', () => {
  let mgr: DiagramModelManager;

  beforeEach(() => {
    mgr = buildRaftModel();
  });

  it('has exactly 5 nodes', () => {
    expect(mgr.nodes).toHaveLength(5);
  });

  it('all nodes start as followers', () => {
    mgr.nodes.forEach((n) => {
      expect(n.state).toBe('follower');
    });
  });

  it('nodes are fully connected (10 edges for 5 nodes)', () => {
    // C(5,2) = 10 bidirectional edges
    expect(mgr.edges).toHaveLength(10);
  });

  it('all edges are bidirectional', () => {
    mgr.edges.forEach((e) => {
      expect(e.bidirectional).toBe(true);
    });
  });

  it('all edges are async type', () => {
    mgr.edges.forEach((e) => {
      expect(e.type).toBe('async');
    });
  });

  it('each node can reach every other node', () => {
    RAFT_NODE_IDS.forEach((id) => {
      const neighbors = mgr.getNeighbors(id);
      expect(neighbors).toHaveLength(RAFT_NODE_IDS.length - 1);
    });
  });

  it('node positions are distributed around a circle', () => {
    const positions = mgr.nodes.map((n) => n.position);
    const cx = 420;
    const cy = 310;
    const radius = 190;

    positions.forEach(({ x, y }) => {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      // Allow ±2px rounding tolerance
      expect(dist).toBeCloseTo(radius, -1);
    });
  });

  it('state transition: follower → candidate → leader', () => {
    const events: string[] = [];
    mgr.on('node_state_change', (e) => events.push((e.data as { state: string }).state));

    mgr.setNodeState('raft-0', 'candidate');
    mgr.setNodeState('raft-0', 'leader');

    expect(events).toEqual(['candidate', 'leader']);
    expect(mgr.getNode('raft-0')?.state).toBe('leader');
  });

  it('leader_elected event fires correctly', () => {
    const listener = vi.fn();
    mgr.on('leader_elected', listener);
    mgr.emit({ type: 'leader_elected', nodeId: 'raft-2', data: { term: 3 }, timestamp: Date.now() });
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'leader_elected', nodeId: 'raft-2' }),
    );
  });

  it('vote_cast event has correct shape', () => {
    const listener = vi.fn();
    mgr.on('vote_cast', listener);
    mgr.emit({
      type: 'vote_cast',
      nodeId: 'raft-1',
      data: { toId: 'raft-0', granted: true },
      timestamp: Date.now(),
    });
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: 'raft-1', data: { toId: 'raft-0', granted: true } }),
    );
  });

  it('only one leader at a time is valid', () => {
    mgr.setNodeState('raft-0', 'leader');
    mgr.setNodeState('raft-1', 'follower');
    mgr.setNodeState('raft-2', 'follower');

    const leaders = mgr.nodes.filter((n) => n.state === 'leader');
    expect(leaders).toHaveLength(1);
  });
});
