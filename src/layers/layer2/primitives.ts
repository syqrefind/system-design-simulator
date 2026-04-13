import type { DiagramNode, Position, ShardGroup, ReplicaSet, LoadBalancerConfig } from './types';
import { DiagramModelManager } from './DiagramModel';

// ─── Composite Topology Primitives ───────────────────────────────────────────
// Higher-order constructs built from Node + Edge primitives.
// These teach you how distributed system components are structured.

// ─── ShardGroup ───────────────────────────────────────────────────────────────
// Models horizontal data partitioning. Each shard owns a key-range.

export class ShardGroupBuilder {
  static create(
    mgr: DiagramModelManager,
    id: string,
    label: string,
    shardingKey: string,
    count: number,
    origin: Position,
    spacing = 120,
  ): ShardGroup {
    const shards: DiagramNode[] = [];

    for (let i = 0; i < count; i++) {
      const shard = mgr.addNamedNode(
        `${id}-shard-${i}`,
        'db',
        `${label} S${i}`,
        { x: origin.x + i * spacing, y: origin.y },
        'active',
        { shardIndex: i, shardingKey, totalShards: count },
      );
      shards.push(shard);
    }

    return { id, label, shards, shardingKey };
  }
}

// ─── ReplicaSet ───────────────────────────────────────────────────────────────
// Models primary + N replicas with async replication edges.

export class ReplicaSetBuilder {
  static create(
    mgr: DiagramModelManager,
    id: string,
    label: string,
    replicationFactor: number,
    origin: Position,
    spacing = 130,
  ): ReplicaSet {
    const primary = mgr.addNamedNode(
      `${id}-primary`,
      'db',
      `${label} PRIMARY`,
      origin,
      'primary',
      { role: 'primary', replicaSetId: id },
    );

    const replicas: DiagramNode[] = [];
    for (let i = 0; i < replicationFactor - 1; i++) {
      const replica = mgr.addNamedNode(
        `${id}-replica-${i}`,
        'db',
        `${label} R${i}`,
        { x: origin.x + (i + 1) * spacing, y: origin.y },
        'replica',
        { role: 'replica', replicaIndex: i, replicaSetId: id },
      );
      replicas.push(replica);
      mgr.addEdge(primary.id, replica.id, 'async', 'replication');
    }

    return { id, label, primary, replicas, replicationFactor };
  }
}

// ─── LoadBalancer ─────────────────────────────────────────────────────────────
// Models a load balancer fanning out to upstream service nodes.

export class LoadBalancerBuilder {
  static create(
    mgr: DiagramModelManager,
    id: string,
    algorithm: LoadBalancerConfig['algorithm'],
    upstreamCount: number,
    upstreamLabel: string,
    origin: Position,
    spacing = 140,
  ): LoadBalancerConfig {
    const lb = mgr.addNamedNode(
      `${id}-lb`,
      'loadbalancer',
      `LB (${algorithm})`,
      origin,
      'healthy',
      { algorithm },
    );

    const upstreams: DiagramNode[] = [];
    const startX = origin.x - ((upstreamCount - 1) * spacing) / 2;
    for (let i = 0; i < upstreamCount; i++) {
      const svc = mgr.addNamedNode(
        `${id}-upstream-${i}`,
        'service',
        `${upstreamLabel} ${i + 1}`,
        { x: startX + i * spacing, y: origin.y + 140 },
        'running',
        { upstreamIndex: i, lbId: id },
      );
      upstreams.push(svc);
      mgr.addEdge(lb.id, svc.id, 'sync');
    }

    return { id, algorithm, upstreams, healthCheckInterval: 5000 };
  }
}

// ─── Utility: path resolver ───────────────────────────────────────────────────
// Given node IDs in a path, validates all nodes exist in the model.

export function resolveNodePath(
  mgr: DiagramModelManager,
  path: string[],
): DiagramNode[] {
  return path.map((id) => {
    const node = mgr.getNode(id);
    if (!node) throw new Error(`Node '${id}' not found in diagram model`);
    return node;
  });
}
