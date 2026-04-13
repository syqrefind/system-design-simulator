// ─── Layer 2: Diagram Model Types ────────────────────────────────────────────
// Core primitives that teach system design topology.

export type NodeType =
  | 'client'
  | 'gateway'
  | 'service'
  | 'db'
  | 'queue'
  | 'cache'
  | 'loadbalancer'
  | 'pod'
  | 'server'
  | 'scheduler';

export type EdgeType = 'sync' | 'async' | 'event';

export type PodPhase = 'pending' | 'running' | 'succeeded' | 'failed' | 'terminated';

export type RaftRole = 'follower' | 'candidate' | 'leader';

export interface Position {
  x: number;
  y: number;
}

// ─── Core Primitives ─────────────────────────────────────────────────────────

export interface DiagramNode {
  id: string;
  type: NodeType;
  position: Position;
  label: string;
  /** Runtime state string (e.g. "running", "leader", "pending") */
  state?: string;
  metadata?: Record<string, unknown>;
}

export interface DiagramEdge {
  id: string;
  from: string;
  to: string;
  type: EdgeType;
  label?: string;
  bidirectional?: boolean;
}

export interface DiagramModel {
  id: string;
  name: string;
  description?: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ─── Extended Topology Primitives ────────────────────────────────────────────

export interface ShardGroup {
  id: string;
  label: string;
  shards: DiagramNode[];
  /** Determines data distribution among shards */
  shardingKey: string;
}

export interface ReplicaSet {
  id: string;
  label: string;
  primary: DiagramNode;
  replicas: DiagramNode[];
  replicationFactor: number;
}

export interface LoadBalancerConfig {
  id: string;
  algorithm: 'round-robin' | 'least-connections' | 'ip-hash';
  upstreams: DiagramNode[];
  healthCheckInterval?: number;
}

// ─── Animation / Simulation Options ──────────────────────────────────────────

export interface AnimateRequestOptions {
  path: string[];
  latency?: number;
  color?: number;
  label?: string;
  onNodeVisit?: (nodeId: string, index: number) => void;
  onComplete?: () => void;
}

export interface SimulateFailureOptions {
  nodeId: string;
  duration?: number;
  propagate?: boolean;
  onRecover?: () => void;
}

export interface LeaderElectionOptions {
  nodes: string[];
  term?: number;
  onLeaderElected?: (leaderId: string) => void;
}

// ─── Simulation Event Bus ─────────────────────────────────────────────────────

export type SimEventType =
  | 'node_state_change'
  | 'edge_active'
  | 'edge_inactive'
  | 'request_start'
  | 'request_hop'
  | 'request_complete'
  | 'failure'
  | 'recovery'
  | 'leader_elected'
  | 'vote_cast'
  | 'timer_reset';

export interface SimEvent {
  type: SimEventType;
  nodeId?: string;
  edgeId?: string;
  data?: unknown;
  timestamp: number;
}

export type SimEventListener = (event: SimEvent) => void;
