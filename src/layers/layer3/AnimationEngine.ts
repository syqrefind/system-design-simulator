import { gsap } from 'gsap';
import type { AnimateRequestOptions, SimulateFailureOptions } from '../layer2/types';
import type { PixiRenderer } from '../layer1/PixiRenderer';
import type { DiagramModelManager } from '../layer2/DiagramModel';

// ─── Layer 3: Animation Engine ────────────────────────────────────────────────
// Orchestrates GSAP + PixiRenderer to produce system-level animations.
// This is where "drawing a diagram" becomes "executing a system".

export class AnimationEngine {
  private activeTimelines: gsap.core.Timeline[] = [];
  private timerTweens: Map<string, gsap.core.Tween> = new Map();

  constructor(
    private renderer: PixiRenderer,
    private model: DiagramModelManager,
  ) {}

  // ─── animateRequest ─────────────────────────────────────────────────────────
  // Sends a particle through a sequence of nodes with configurable latency.

  animateRequest(options: AnimateRequestOptions): Promise<void> {
    const {
      path,
      latency = 800,
      color = 0xffd700,
      onNodeVisit,
      onComplete,
    } = options;

    return new Promise((resolve) => {
      const positions = path.map((id) => {
        const pos = this.renderer.getNodePosition(id);
        if (!pos) throw new Error(`Node '${id}' not found in renderer`);
        return pos;
      });

      const durationPerHop = latency / 1000 / Math.max(path.length - 1, 1);

      this.renderer.animateParticle(
        positions,
        durationPerHop,
        color,
        (hopIndex) => {
          const nodeId = path[hopIndex];
          onNodeVisit?.(nodeId, hopIndex);
          this.renderer.pulseNode(nodeId, color);
          this.model.emit({
            type: 'request_hop',
            nodeId,
            data: { hopIndex, path },
            timestamp: Date.now(),
          });
        },
        () => {
          onComplete?.();
          this.model.emit({ type: 'request_complete', data: { path }, timestamp: Date.now() });
          resolve();
        },
      );

      this.model.emit({ type: 'request_start', data: { path, latency }, timestamp: Date.now() });
    });
  }

  // ─── simulateFailure ────────────────────────────────────────────────────────
  // Marks a node as failed with shake + color change, optionally recovers.

  simulateFailure(options: SimulateFailureOptions): Promise<void> {
    const { nodeId, duration = 2000, onRecover } = options;

    return new Promise((resolve) => {
      // Mark state
      this.model.setNodeState(nodeId, 'down');
      this.renderer.setNodeState(nodeId, 'down');
      this.renderer.shakeNode(nodeId);
      this.renderer.highlightNode(nodeId, true, 0xfc8181);

      this.model.emit({ type: 'failure', nodeId, timestamp: Date.now() });

      gsap.delayedCall(duration / 1000, () => {
        this.model.setNodeState(nodeId, 'running');
        this.renderer.setNodeState(nodeId, 'running');
        this.renderer.highlightNode(nodeId, false);
        this.model.emit({ type: 'recovery', nodeId, timestamp: Date.now() });
        onRecover?.();
        resolve();
      });
    });
  }

  // ─── animateNodeStateTransition ─────────────────────────────────────────────
  // Smoothly transitions a node through a list of states.

  async animateNodeStateTransition(
    nodeId: string,
    states: string[],
    delayBetween = 1200,
    onStateChange?: (state: string) => void,
  ): Promise<void> {
    for (const state of states) {
      this.model.setNodeState(nodeId, state);
      this.renderer.setNodeState(nodeId, state);
      this.renderer.pulseNode(nodeId);
      onStateChange?.(state);
      await delay(delayBetween);
    }
  }

  // ─── Raft Timer Management ──────────────────────────────────────────────────

  startElectionTimer(
    nodeId: string,
    timeoutMs: number,
    color: number,
    onExpire: () => void,
  ): void {
    this.cancelElectionTimer(nodeId);
    const tween = this.renderer.animateTimerBar(nodeId, timeoutMs, color, onExpire);
    this.timerTweens.set(nodeId, tween);
  }

  cancelElectionTimer(nodeId: string): void {
    const tween = this.timerTweens.get(nodeId);
    if (tween) {
      tween.kill();
      this.timerTweens.delete(nodeId);
    }
  }

  resetElectionTimer(
    nodeId: string,
    newTimeoutMs: number,
    color: number,
    onExpire: () => void,
  ): void {
    this.cancelElectionTimer(nodeId);
    this.renderer.resetTimerBar(nodeId);
    this.startElectionTimer(nodeId, newTimeoutMs, color, onExpire);
    this.model.emit({ type: 'timer_reset', nodeId, timestamp: Date.now() });
  }

  // ─── Vote Animation ─────────────────────────────────────────────────────────

  async animateVote(
    fromId: string,
    toId: string,
    granted: boolean,
  ): Promise<void> {
    const color = granted ? 0x48bb78 : 0xfc8181;
    await this.animateRequest({
      path: [fromId, toId],
      latency: 400,
      color,
      label: granted ? 'VoteGranted' : 'VoteDenied',
    });
    this.model.emit({ type: 'vote_cast', nodeId: fromId, data: { toId, granted }, timestamp: Date.now() });
  }

  // ─── Heartbeat ─────────────────────────────────────────────────────────────

  async animateHeartbeat(leaderId: string, followerIds: string[]): Promise<void> {
    const promises = followerIds.map((fId) =>
      this.animateRequest({
        path: [leaderId, fId],
        latency: 300,
        color: 0xffd700,
      }),
    );
    await Promise.all(promises);
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  killAll(): void {
    this.activeTimelines.forEach((tl) => tl.kill());
    this.activeTimelines = [];
    this.timerTweens.forEach((t) => t.kill());
    this.timerTweens.clear();
    gsap.globalTimeline.clear();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => gsap.delayedCall(ms / 1000, resolve));
}
