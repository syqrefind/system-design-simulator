# System Design Simulator — Design Document

**Version**: 1.0.0
**Date**: 2026-04-12
**Author**: Personal System Design Notebook

---

## 1. Purpose

A personal, browser-based thinking tool for learning and internalizing distributed systems concepts through interactive simulation. Unlike static diagrams, this simulator *executes* systems — you observe requests traverse nodes, pods transition through lifecycle phases, and Raft elections unfold in real time.

The app is structured as a notebook: each tab is a "Project", self-contained and focused on one system concept.

---

## 2. Architecture Overview

The application is built in three explicit, composable layers:

```
┌─────────────────────────────────────────────────────┐
│  Layer 3: Animation / Simulation Engine              │
│  GSAP timelines, request particles, state machines   │
├─────────────────────────────────────────────────────┤
│  Layer 2: Diagram Model                              │
│  Nodes, Edges, ShardGroup, ReplicaSet, LB            │
├─────────────────────────────────────────────────────┤
│  Layer 1: Rendering (PixiJS)                         │
│  WebGL canvas, node/edge drawing, transitions        │
└─────────────────────────────────────────────────────┘
         React UI (tabs, controls, event log)
```

### Why three layers?

Each layer has a single responsibility. This makes it easy to:
- **Test** Layer 2 in pure JavaScript without a browser
- **Swap** Layer 1 (e.g., replace PixiJS with SVG) without touching simulation logic
- **Extend** Layer 3 with new scenarios (CRDTs, 2PC, etc.) without touching rendering

---

## 3. Layer 1 — Rendering (PixiJS)

**Location**: `src/layers/layer1/`

### Technology
- **PixiJS v8** — WebGL-accelerated 2D canvas with fallback to Canvas 2D
- **Resolution**: auto-scales to `window.devicePixelRatio` for crisp Retina rendering
- **Layers**: three `Container` layers stacked: edges → nodes → particles

### Key classes

| File | Responsibility |
|---|---|
| `PixiRenderer.ts` | Owns the `Application`, manages all display objects, exposes imperative API |
| `NodeRenderer.ts` | Draws individual nodes as circles with icon + label + state indicator |
| `EdgeRenderer.ts` | Draws edges with type-specific styles (solid sync, dashed async/event) |

### Node visual anatomy

```
       ┌─ state dot (color = current state)
       │
    ╭─────╮
    │  ⬡  │ ← icon (type-specific)
    ╰─────╯
    My Service  ← label
```

Node color encodes type. State indicator dot (top-right) encodes runtime state:

| State | Color |
|---|---|
| running | green |
| pending | orange |
| leader | gold |
| candidate | amber |
| follower | blue |
| failed / down | red |
| terminated | gray |

### Edge styles

| Type | Style | Use case |
|---|---|---|
| `sync` | Solid blue | HTTP, RPC, direct calls |
| `async` | Dashed purple | Queue producers, replication |
| `event` | Dashed green | Event bus, pub/sub |

All edges include directional arrowheads; bidirectional edges get two.

---

## 4. Layer 2 — Diagram Model

**Location**: `src/layers/layer2/`

### Core primitives

```typescript
interface DiagramNode {
  id: string;
  type: NodeType;            // 'service' | 'db' | 'queue' | 'pod' | ...
  position: { x: number; y: number };
  label: string;
  state?: string;            // runtime state (e.g. 'running', 'leader')
  metadata?: Record<string, unknown>;
}

interface DiagramEdge {
  id: string;
  from: string;
  to: string;
  type: EdgeType;            // 'sync' | 'async' | 'event'
  label?: string;
  bidirectional?: boolean;
}
```

### Extended topology primitives

| Primitive | Models |
|---|---|
| `ShardGroup` | Horizontal sharding — N shard nodes, same sharding key |
| `ReplicaSet` | Primary + N replicas with async replication edges |
| `LoadBalancerConfig` | LB node → N upstream service nodes |

These primitives compose from basic nodes + edges, teaching you how distributed topologies are structured.

### DiagramModelManager

The `DiagramModelManager` class provides:
- **CRUD** for nodes and edges
- **Graph queries**: `getNeighbors`, `getIncomingEdges`, `getOutgoingEdges`
- **Event bus**: `on(type, listener)` / `emit(event)` — decouples simulation from rendering
- **Serialization**: `toJSON()` / `fromJSON()` / `snapshot()`

---

## 5. Layer 3 — Animation / Simulation Engine

**Location**: `src/layers/layer3/`

### AnimationEngine

High-level animation API that bridges the diagram model with GSAP + PixiRenderer:

```typescript
// Send a request particle through a node path
await engine.animateRequest({
  path: ['client', 'gateway', 'orders', 'orders-db'],
  latency: 800,   // total animation duration in ms
  color: 0xffd700,
  onNodeVisit: (nodeId, index) => { /* pulse, log, etc. */ }
});

// Mark a node as failed with visual feedback
await engine.simulateFailure({ nodeId: 'gateway', duration: 2000 });

// Animate node through multiple states
await engine.animateNodeStateTransition('pod-a', ['pending', 'running', 'terminated'], 1200);

// Raft timer management
engine.startElectionTimer('raft-0', 2500, 0x4facfe, onExpire);
engine.resetElectionTimer('raft-0', 2000, 0x4facfe, onExpire);
await engine.animateVote('raft-1', 'raft-0', true);        // VoteGranted
await engine.animateHeartbeat('raft-0', ['raft-1', 'raft-2']); // AppendEntries
```

### SimulationEngine

Self-contained, cancellable simulation controllers:

```typescript
// RequestFlowSimulation — cycles request paths in a loop
const sim = new RequestFlowSimulation(engine, model, { requestPaths, interval, loop: true });
sim.start();
sim.stop();

// PodLifecycleSimulation — drives a pod through K8s phases
const sim = new PodLifecycleSimulation(engine, model, { podId: 'pod-a', ... });
await sim.start();           // normal lifecycle
await sim.startWithFailure(); // OOMKilled path

// RaftSimulation — full Raft election protocol
const sim = new RaftSimulation(engine, model, { nodeIds, minTimeout, maxTimeout, ... });
sim.start();   // launches election timers on all nodes
sim.reset();   // resets all nodes to follower, term 0
```

---

## 6. Projects

### Project 01 — Request Flow Visualizer

**Concept taught**: HTTP request routing through a microservice topology

**Topology**:
```
Browser → API Gateway → Auth Svc → Redis Cache
                      → Orders Svc → Orders DB → Event Queue → Email Worker
                      → Catalog Svc → Redis Cache
                                    → Catalog DB
```

**Key interactions**:
- Select from 5 predefined request paths (cache hit, DB read, write+publish, async event)
- Adjustable latency slider (200–2000ms)
- Loop mode: continuously cycles through all paths
- Gateway failure injection (node goes down → recovers after 2s)
- Save/export diagram JSON

**Design insights demonstrated**:
- Sync vs async call patterns
- Cache-aside pattern (catalog → Redis first, DB on miss)
- Event-driven decoupling (orders → queue → worker)

---

### Project 02 — K8s Pod Lifecycle

**Concept taught**: Kubernetes scheduling and pod state machine

**Topology**:
```
API Server → Scheduler → etcd
                       → Node 1 → Pod A
                       → Node 2 → Pod B
                       → Node 3 → Pod C
```

**Pod state machine**:
```
         ┌──────────────────────┐
Pending → Running → Succeeded → Terminated
              │
              └──→ Failed (OOMKilled)
```

**Key interactions**:
- Run individual pod scenarios
- Run all 3 pods in parallel
- Pod C demonstrates OOMKilled failure path
- State indicator dot changes color per phase
- Scheduling animation shows Scheduler → Node → Pod path

**Design insights demonstrated**:
- Pod scheduling via control plane
- State machine with terminal states (succeeded, failed, terminated)
- Difference between succeeded (graceful) vs failed (crash)

---

### Project 03 — Leader Election (Raft)

**Concept taught**: Distributed consensus via the Raft protocol

**Topology**: 5-node fully-connected cluster in circular arrangement

**Election protocol implemented**:
1. All nodes start as followers with randomized timers (150–300ms by default, configurable)
2. First timer to expire → node becomes candidate, increments term, votes for self
3. Broadcasts `RequestVote` to all peers (animated as particles)
4. Each peer grants vote if it hasn't voted in this term
5. On majority → becomes leader, highlighted in gold
6. Leader sends periodic `AppendEntries` heartbeats (animated) to all followers
7. Heartbeats reset follower timers, preventing new elections

**Key interactions**:
- Start/stop simulation
- Configurable election timeout range (affects who wins)
- Configurable heartbeat interval
- Reset: all nodes back to follower, term 0
- Real-time role display with term counter per node

**Design insights demonstrated**:
- Randomized timeouts prevent split-vote livelock
- Majority quorum (n/2 + 1) for safety
- Heartbeats as lease renewal
- Leader = single writer, followers = read replicas

---

## 7. Serialization

**Location**: `src/serialization/index.ts`

### JSON format

```json
{
  "id": "uuid",
  "name": "Request Flow Visualizer",
  "description": "...",
  "nodes": [
    { "id": "client", "type": "client", "position": { "x": 100, "y": 280 }, "label": "Browser" }
  ],
  "edges": [
    { "id": "edge-client-gateway", "from": "client", "to": "gateway", "type": "sync" }
  ],
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

### Persistence options

| Method | API | Notes |
|---|---|---|
| localStorage | `saveDiagram` / `loadDiagram` / `listSavedDiagrams` | Keyed by diagram ID, index tracked separately |
| File export | `exportDiagramFile` | Downloads `.sds.json` file |
| File import | `importDiagramFile` | File picker → validate → load |

---

## 8. Testing Strategy

**Framework**: Vitest + jsdom
**Coverage**: Layer 2 (model), Layer 3 (simulation logic), Serialization

### What is tested

| Layer | Tests | Approach |
|---|---|---|
| Layer 2 | Node/edge CRUD, graph queries, event bus, serialization | Pure JS — no mocks needed |
| Layer 3 (model) | Simulation model construction, state transitions, path validity | Pure JS — verifies model correctness |
| Serialization | Round-trip, validation errors, localStorage persistence | localStorage mocked via vi.fn() |

### What is NOT tested

- PixiJS rendering (requires WebGL — integration/e2e territory)
- GSAP animations (require real timers — mocked at module level)
- React components (visual rendering — covered by visual inspection)

### Test commands

```bash
npm test           # run all tests once
npm run test:watch # watch mode
npm run test:ui    # Vitest UI in browser
```

---

## 9. Tech Stack

| Concern | Technology | Why |
|---|---|---|
| Rendering | PixiJS v8 | WebGL performance, mature 2D API |
| Animation | GSAP v3 | Industry standard, precise timeline control |
| UI | React 18 + TypeScript | Component model for controls, Suspense for lazy loading |
| Styling | Tailwind CSS v3 | Utility-first, consistent dark theme |
| Build | Vite 5 | Fast HMR, ESM native |
| Testing | Vitest 2 | Vite-native, same config, fast |
| Fonts | JetBrains Mono | Monospace aesthetic for technical notebook feel |

---

## 10. Extending the Simulator

### Adding a new project

1. Create `src/projects/MyProject/simulation.ts` — define the `DiagramModelManager` and scenarios
2. Create `src/projects/MyProject/index.tsx` — React page with canvas + controls
3. Add to `PROJECTS` array in `src/components/Navigation.tsx`
4. Add lazy import + conditional render in `src/App.tsx`

### Adding new node types

1. Add to `NodeType` union in `src/layers/layer2/types.ts`
2. Add color theme entry in `NodeRenderer.ts` `NODE_COLORS`
3. No other changes needed — the renderer picks it up automatically

### Adding new simulation scenarios (Layer 3)

Implement a class with `start()` / `stop()` interface:

```typescript
class TwoPhaseCommitSimulation {
  constructor(private engine: AnimationEngine, private model: DiagramModelManager) {}

  async start(): Promise<void> {
    // Phase 1: Prepare
    await this.engine.animateRequest({ path: ['coordinator', 'p1', 'p2', 'p3'], ... });
    // Phase 2: Commit
    await this.engine.animateRequest({ path: ['p1', 'coordinator'], ... });
  }
}
```

Planned future scenarios:
- Two-Phase Commit (2PC) — coordinator failure mid-protocol
- CRDT convergence — concurrent writes, eventual consistency
- Circuit Breaker — failure cascade + recovery
- Consistent Hashing — ring visualization with node add/remove

---

## 11. File Structure

```
system-design-simulator/
├── src/
│   ├── layers/
│   │   ├── layer1/        # PixiJS rendering
│   │   │   ├── PixiRenderer.ts
│   │   │   ├── NodeRenderer.ts
│   │   │   └── EdgeRenderer.ts
│   │   ├── layer2/        # Diagram model
│   │   │   ├── types.ts
│   │   │   ├── DiagramModel.ts
│   │   │   └── primitives.ts
│   │   └── layer3/        # Animation + simulation
│   │       ├── AnimationEngine.ts
│   │       └── SimulationEngine.ts
│   ├── projects/
│   │   ├── RequestFlow/
│   │   ├── K8sPodLifecycle/
│   │   └── LeaderElection/
│   ├── components/
│   │   ├── Navigation.tsx
│   │   └── NotebookLayout.tsx
│   ├── serialization/
│   │   └── index.ts
│   ├── __tests__/
│   │   ├── setup.ts
│   │   ├── layer2.test.ts
│   │   ├── layer3.test.ts
│   │   └── serialization.test.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── DESIGN_DOCUMENT.md
├── package.json
├── vite.config.ts
└── tsconfig.json
```
