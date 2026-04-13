import { DiagramModelManager } from '../../layers/layer2/DiagramModel';

// ─── K8s Pod Lifecycle: Diagram Model ────────────────────────────────────────
// Models pod scheduling and state transitions on a Kubernetes node.

export function buildK8sModel(): DiagramModelManager {
  const mgr = new DiagramModelManager(
    'K8s Pod Lifecycle',
    'Visualizes pod scheduling from pending → running → terminated',
  );

  // ── Control Plane ─────────────────────────────────────────────────────────
  mgr.addNamedNode('api-server',  'gateway',   'API Server',   { x: 140, y: 100 });
  mgr.addNamedNode('scheduler',   'scheduler', 'Scheduler',    { x: 340, y: 100 });
  mgr.addNamedNode('etcd',        'db',        'etcd',         { x: 540, y: 100 });

  // ── Nodes (workers) ───────────────────────────────────────────────────────
  mgr.addNamedNode('node-1',  'server',  'Node 1',    { x: 200, y: 310 });
  mgr.addNamedNode('node-2',  'server',  'Node 2',    { x: 420, y: 310 });
  mgr.addNamedNode('node-3',  'server',  'Node 3',    { x: 640, y: 310 });

  // ── Pods (lifecycle actors) ───────────────────────────────────────────────
  mgr.addNamedNode('pod-a',   'pod', 'Pod A',  { x: 200, y: 460 }, 'pending');
  mgr.addNamedNode('pod-b',   'pod', 'Pod B',  { x: 420, y: 460 }, 'pending');
  mgr.addNamedNode('pod-c',   'pod', 'Pod C',  { x: 640, y: 460 }, 'pending');

  // ── Edges ─────────────────────────────────────────────────────────────────
  mgr.addEdge('api-server', 'scheduler', 'sync',  'pod spec');
  mgr.addEdge('scheduler',  'etcd',      'sync',  'bind');
  mgr.addEdge('scheduler',  'node-1',    'async', 'schedule');
  mgr.addEdge('scheduler',  'node-2',    'async', 'schedule');
  mgr.addEdge('scheduler',  'node-3',    'async', 'schedule');
  mgr.addEdge('node-1',     'pod-a',     'sync',  'kubelet');
  mgr.addEdge('node-2',     'pod-b',     'sync',  'kubelet');
  mgr.addEdge('node-3',     'pod-c',     'sync',  'kubelet');

  return mgr;
}

// ─── Pod scenario configs ─────────────────────────────────────────────────────

export interface PodScenario {
  label: string;
  podId: string;
  nodeId: string;
  schedulerPath: string[];
  failurePod?: boolean;
  description: string;
}

export const POD_SCENARIOS: PodScenario[] = [
  {
    label: 'Pod A — Normal Lifecycle',
    podId: 'pod-a',
    nodeId: 'node-1',
    schedulerPath: ['scheduler', 'node-1', 'pod-a'],
    failurePod: false,
    description: 'Pending → Running → Succeeded → Terminated',
  },
  {
    label: 'Pod B — Normal Lifecycle',
    podId: 'pod-b',
    nodeId: 'node-2',
    schedulerPath: ['scheduler', 'node-2', 'pod-b'],
    failurePod: false,
    description: 'Pending → Running → Succeeded → Terminated',
  },
  {
    label: 'Pod C — OOMKilled / Failure',
    podId: 'pod-c',
    nodeId: 'node-3',
    schedulerPath: ['scheduler', 'node-3', 'pod-c'],
    failurePod: true,
    description: 'Pending → Running → Failed (OOMKilled)',
  },
];
