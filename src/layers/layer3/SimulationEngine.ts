import type { DiagramModelManager } from '../layer2/DiagramModel';
import type { AnimationEngine } from './AnimationEngine';
import type { RaftRole } from '../layer2/types';

// ─── Layer 3: Simulation Engine ───────────────────────────────────────────────
// High-level simulation controllers that combine model state + animation.
// Each simulation is a self-contained, cancellable loop.

// ─── Request Flow Simulation ──────────────────────────────────────────────────

export interface RequestFlowConfig {
  requestPaths: string[][];
  interval?: number;
  latency?: number;
  loop?: boolean;
  onRequest?: (path: string[], index: number) => void;
  onComplete?: () => void;
}

export class RequestFlowSimulation {
  private running = false;
  private cancelled = false;
  private requestIndex = 0;

  constructor(
    private engine: AnimationEngine,
    _model: DiagramModelManager,
    private config: RequestFlowConfig,
  ) {}

  async start(): Promise<void> {
    this.cancelled = false;
    this.running = true;
    this.requestIndex = 0;

    const { requestPaths, interval = 1500, latency = 800, loop = true } = this.config;

    const runCycle = async () => {
      if (this.cancelled) return;

      const path = requestPaths[this.requestIndex % requestPaths.length];
      this.config.onRequest?.(path, this.requestIndex);

      await this.engine.animateRequest({ path, latency, color: 0xffd700 });

      this.requestIndex++;

      if (!loop && this.requestIndex >= requestPaths.length) {
        this.running = false;
        this.config.onComplete?.();
        return;
      }

      if (!this.cancelled) {
        setTimeout(runCycle, interval);
      }
    };

    await runCycle();
  }

  stop(): void {
    this.cancelled = true;
    this.running = false;
  }

  get isRunning(): boolean {
    return this.running;
  }
}

// ─── K8s Pod Lifecycle Simulation ─────────────────────────────────────────────

export type PodPhase = 'pending' | 'running' | 'succeeded' | 'failed' | 'terminated';

export interface PodLifecycleConfig {
  podId: string;
  schedulerToNodePath: string[];
  stateDelays?: Partial<Record<PodPhase, number>>;
  onPhaseChange?: (phase: PodPhase) => void;
  onComplete?: () => void;
}

const DEFAULT_STATE_DELAYS: Record<PodPhase, number> = {
  pending:    1000,
  running:    2500,
  succeeded:  1000,
  failed:     0,
  terminated: 500,
};

export class PodLifecycleSimulation {
  private cancelled = false;

  constructor(
    private engine: AnimationEngine,
    private model: DiagramModelManager,
    private config: PodLifecycleConfig,
  ) {}

  async start(): Promise<void> {
    this.cancelled = false;
    const { podId, stateDelays, schedulerToNodePath, onPhaseChange, onComplete } = this.config;
    const delays = { ...DEFAULT_STATE_DELAYS, ...stateDelays };

    const transition = async (phase: PodPhase) => {
      if (this.cancelled) return false;
      this.model.setNodeState(podId, phase);
      this.engine['renderer'].setNodeState(podId, phase);
      this.engine['renderer'].pulseNode(podId);
      onPhaseChange?.(phase);
      return true;
    };

    // pending → scheduler animation
    if (!await transition('pending')) return;
    await delay(delays.pending);

    if (this.cancelled) return;

    // Scheduling: animate from scheduler to worker node
    if (schedulerToNodePath.length >= 2) {
      await this.engine.animateRequest({
        path: schedulerToNodePath,
        latency: 600,
        color: 0xa78bfa,
        label: 'schedule',
      });
    }

    if (!await transition('running')) return;
    await delay(delays.running);

    if (!await transition('succeeded')) return;
    await delay(delays.succeeded);

    if (!await transition('terminated')) return;
    await delay(delays.terminated);

    if (!this.cancelled) onComplete?.();
  }

  async startWithFailure(): Promise<void> {
    this.cancelled = false;
    const { podId, stateDelays, onPhaseChange } = this.config;
    const delays = { ...DEFAULT_STATE_DELAYS, ...stateDelays };

    const transition = async (phase: PodPhase) => {
      if (this.cancelled) return false;
      this.model.setNodeState(podId, phase);
      this.engine['renderer'].setNodeState(podId, phase);
      this.engine['renderer'].pulseNode(podId);
      onPhaseChange?.(phase);
      return true;
    };

    if (!await transition('pending')) return;
    await delay(delays.pending);
    if (!await transition('running')) return;
    await delay(800);
    if (!await transition('failed')) return;
    await this.engine.simulateFailure({ nodeId: podId, duration: 1500 });
    if (!await transition('terminated')) return;
  }

  stop(): void {
    this.cancelled = true;
  }
}

// ─── Raft Leader Election Simulation ─────────────────────────────────────────

export interface RaftNodeState {
  id: string;
  role: RaftRole;
  term: number;
  votedFor: string | null;
  votes: number;
  timerMs: number;
}

export interface RaftSimulationConfig {
  nodeIds: string[];
  minTimeout?: number;
  maxTimeout?: number;
  heartbeatInterval?: number;
  onStateChange?: (id: string, role: RaftRole, term: number) => void;
  onLeaderElected?: (leaderId: string, term: number) => void;
}

export class RaftSimulation {
  private nodes: Map<string, RaftNodeState> = new Map();
  private cancelled = false;
  private leaderId: string | null = null;
  private heartbeatHandle: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private engine: AnimationEngine,
    private model: DiagramModelManager,
    private config: RaftSimulationConfig,
  ) {
    this.initNodes();
  }

  private initNodes(): void {
    const { nodeIds, minTimeout = 1500, maxTimeout = 3000 } = this.config;
    nodeIds.forEach((id) => {
      this.nodes.set(id, {
        id,
        role: 'follower',
        term: 0,
        votedFor: null,
        votes: 0,
        timerMs: minTimeout + Math.random() * (maxTimeout - minTimeout),
      });
      this.model.setNodeState(id, 'follower');
    });
  }

  start(): void {
    this.cancelled = false;
    this.nodes.forEach((node) => this.startFollowerTimer(node));
  }

  private startFollowerTimer(node: RaftNodeState): void {
    if (this.cancelled) return;
    const { minTimeout = 1500, maxTimeout = 3000 } = this.config;
    node.timerMs = minTimeout + Math.random() * (maxTimeout - minTimeout);

    this.engine.startElectionTimer(node.id, node.timerMs, 0x4facfe, () => {
      if (!this.cancelled && node.role === 'follower' && !this.leaderId) {
        this.startElection(node);
      }
    });
  }

  private async startElection(candidate: RaftNodeState): Promise<void> {
    if (this.cancelled) return;

    candidate.role = 'candidate';
    candidate.term += 1;
    candidate.votedFor = candidate.id;
    candidate.votes = 1;

    const term = candidate.term;
    this.model.setNodeState(candidate.id, 'candidate');
    this.engine['renderer'].setNodeState(candidate.id, 'candidate');
    this.engine['renderer'].highlightNode(candidate.id, true, 0xf6ad55);
    this.config.onStateChange?.(candidate.id, 'candidate', term);

    this.model.emit({
      type: 'node_state_change',
      nodeId: candidate.id,
      data: { role: 'candidate', term },
      timestamp: Date.now(),
    });

    // Request votes from all other nodes
    const others = Array.from(this.nodes.values()).filter((n) => n.id !== candidate.id);
    const votePromises = others.map(async (voter) => {
      if (this.cancelled) return false;

      await this.engine.animateVote(candidate.id, voter.id, false); // RequestVote
      await delay(150);

      // Grant vote if not already voted in this term
      const granted = voter.term < term;
      if (granted) {
        voter.term = term;
        voter.votedFor = candidate.id;
        voter.role = 'follower';
        this.engine.cancelElectionTimer(voter.id);
        this.model.setNodeState(voter.id, 'follower');
      }

      await this.engine.animateVote(voter.id, candidate.id, granted);

      return granted;
    });

    const results = await Promise.all(votePromises);
    if (this.cancelled) return;

    const grantedCount = results.filter(Boolean).length + 1; // +1 for self
    const majority = Math.floor(this.nodes.size / 2) + 1;

    if (grantedCount >= majority && candidate.role === 'candidate') {
      this.becomeLeader(candidate, term);
    } else {
      // Election failed — revert to follower
      candidate.role = 'follower';
      candidate.votes = 0;
      this.model.setNodeState(candidate.id, 'follower');
      this.engine['renderer'].setNodeState(candidate.id, 'follower');
      this.engine['renderer'].highlightNode(candidate.id, false);
      this.config.onStateChange?.(candidate.id, 'follower', term);
      this.startFollowerTimer(candidate);
    }
  }

  private async becomeLeader(node: RaftNodeState, term: number): Promise<void> {
    if (this.cancelled) return;

    node.role = 'leader';
    this.leaderId = node.id;

    this.model.setNodeState(node.id, 'leader');
    this.engine['renderer'].setNodeState(node.id, 'leader');
    this.engine['renderer'].highlightNode(node.id, true, 0xffd700);
    this.config.onStateChange?.(node.id, 'leader', term);
    this.config.onLeaderElected?.(node.id, term);

    this.model.emit({
      type: 'leader_elected',
      nodeId: node.id,
      data: { term },
      timestamp: Date.now(),
    });

    // Start heartbeat loop
    const heartbeatFn = async () => {
      if (this.cancelled || node.role !== 'leader') return;
      const followers = Array.from(this.nodes.values()).filter((n) => n.id !== node.id);
      await this.engine.animateHeartbeat(node.id, followers.map((f) => f.id));
      if (!this.cancelled) {
        this.heartbeatHandle = setTimeout(heartbeatFn, this.config.heartbeatInterval ?? 1500);
      }
    };

    this.heartbeatHandle = setTimeout(heartbeatFn, this.config.heartbeatInterval ?? 1500);
  }

  reset(): void {
    this.stop();
    this.leaderId = null;
    this.nodes.forEach((node) => {
      node.role = 'follower';
      node.term = 0;
      node.votedFor = null;
      node.votes = 0;
      this.model.setNodeState(node.id, 'follower');
    });
    this.engine.killAll();
  }

  stop(): void {
    this.cancelled = true;
    if (this.heartbeatHandle) clearTimeout(this.heartbeatHandle);
    this.nodes.forEach((_, id) => this.engine.cancelElectionTimer(id));
  }

  getLeader(): string | null {
    return this.leaderId;
  }

  getNodeStates(): Map<string, RaftNodeState> {
    return new Map(this.nodes);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
