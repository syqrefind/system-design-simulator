import { DiagramModelManager } from '../../layers/layer2/DiagramModel';
import type { DiagramModel } from '../../layers/layer2/types';

// ─── Request Flow: Diagram Model ──────────────────────────────────────────────
// Classic microservices request flow: client → gateway → services → data stores.

export function buildRequestFlowModel(): DiagramModelManager {
  const mgr = new DiagramModelManager(
    'Request Flow Visualizer',
    'Traces HTTP requests through a distributed microservice topology',
  );

  // ── Nodes ──────────────────────────────────────────────────────────────────
  mgr.addNamedNode('client',      'client',      'Browser',      { x: 100, y: 280 });
  mgr.addNamedNode('gateway',     'gateway',     'API Gateway',  { x: 280, y: 280 });
  mgr.addNamedNode('auth',        'service',     'Auth Svc',     { x: 460, y: 160 });
  mgr.addNamedNode('orders',      'service',     'Orders Svc',   { x: 460, y: 280 });
  mgr.addNamedNode('catalog',     'service',     'Catalog Svc',  { x: 460, y: 400 });
  mgr.addNamedNode('cache',       'cache',       'Redis Cache',  { x: 640, y: 200 });
  mgr.addNamedNode('orders-db',   'db',          'Orders DB',    { x: 640, y: 310 });
  mgr.addNamedNode('catalog-db',  'db',          'Catalog DB',   { x: 640, y: 420 });
  mgr.addNamedNode('queue',       'queue',       'Event Queue',  { x: 460, y: 520 });
  mgr.addNamedNode('worker',      'service',     'Email Worker', { x: 640, y: 520 });

  // ── Edges ──────────────────────────────────────────────────────────────────
  mgr.addEdge('client',   'gateway',    'sync');
  mgr.addEdge('gateway',  'auth',       'sync',  'JWT verify');
  mgr.addEdge('gateway',  'orders',     'sync',  'route');
  mgr.addEdge('gateway',  'catalog',    'sync',  'route');
  mgr.addEdge('auth',     'cache',      'sync',  'session');
  mgr.addEdge('orders',   'orders-db',  'sync',  'write');
  mgr.addEdge('orders',   'queue',      'async', 'publish');
  mgr.addEdge('catalog',  'cache',      'sync',  'lookup');
  mgr.addEdge('catalog',  'catalog-db', 'sync',  'read');
  mgr.addEdge('queue',    'worker',     'event', 'consume');

  return mgr;
}

// ─── Predefined request paths ─────────────────────────────────────────────────

export const REQUEST_PATHS: { label: string; path: string[]; color: number; latency: number }[] = [
  {
    label: 'GET /catalog — Cache Hit',
    path:  ['client', 'gateway', 'catalog', 'cache'],
    color: 0x48bb78,
    latency: 400,
  },
  {
    label: 'GET /catalog — DB Read',
    path:  ['client', 'gateway', 'catalog', 'catalog-db'],
    color: 0x4facfe,
    latency: 700,
  },
  {
    label: 'POST /order — Full Flow',
    path:  ['client', 'gateway', 'auth', 'cache'],
    color: 0xffd700,
    latency: 350,
  },
  {
    label: 'POST /order — Write + Publish',
    path:  ['client', 'gateway', 'orders', 'orders-db'],
    color: 0xed8936,
    latency: 900,
  },
  {
    label: 'Async Event — Email',
    path:  ['orders', 'queue', 'worker'],
    color: 0xa78bfa,
    latency: 600,
  },
];

export function getSnapshotModel(mgr: DiagramModelManager): DiagramModel {
  return mgr.snapshot();
}
