import { Application, Container, Graphics } from 'pixi.js';
import { gsap } from 'gsap';
import type { DiagramModel, Position } from '../layer2/types';
import {
  drawNode,
  updateNodeState,
  updateNodeHighlight,
  createParticle,
  type RenderedNode,
} from './NodeRenderer';
import { drawEdge, type RenderedEdge } from './EdgeRenderer';

// ─── Layer 1: PixiJS Renderer ─────────────────────────────────────────────────
// Central rendering manager. Owns the PixiJS Application and all display objects.
// Pass an HTMLCanvasElement owned by React so there is no imperative DOM mutation.

export class PixiRenderer {
  private app: Application;
  private edgeLayer: Container;
  private nodeLayer: Container;
  private particleLayer: Container;
  private nodeMap: Map<string, RenderedNode> = new Map();
  private edgeMap: Map<string, RenderedEdge> = new Map();
  private initialized = false;
  private destroyed = false;   // set immediately on destroy(), guards in-flight init

  constructor() {
    this.app = new Application();
    this.edgeLayer = new Container();
    this.nodeLayer = new Container();
    this.particleLayer = new Container();
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  async init(canvas: HTMLCanvasElement): Promise<void> {
    if (this.destroyed) return;

    // getBoundingClientRect() reads the actual CSS-layout dimensions — reliable
    // even when the parent uses percentage or flex sizing.
    const rect = canvas.getBoundingClientRect();
    const w = rect.width  > 0 ? rect.width  : 900;
    const h = rect.height > 0 ? rect.height : 550;

    await this.app.init({
      canvas,
      width: w,
      height: h,
      background: '#0d0d1a',   // opaque dark — no transparent-canvas surprises
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    // Re-check after the await — destroy() may have been called while PixiJS
    // was doing its async WebGL setup.
    if (this.destroyed) {
      this.app.destroy(false, { children: true });
      return;
    }

    this.app.stage.addChild(this.edgeLayer);
    this.app.stage.addChild(this.nodeLayer);
    this.app.stage.addChild(this.particleLayer);
    this.initialized = true;
  }

  destroy(): void {
    this.destroyed = true;
    if (!this.initialized) return;
    // Pass false so PixiJS does not remove the <canvas> from the DOM —
    // React owns that element and will clean it up on unmount.
    this.app.destroy(false, { children: true });
    this.initialized = false;
  }

  resize(width: number, height: number): void {
    if (!this.initialized) return;
    this.app.renderer.resize(width, height);
  }

  // ─── Diagram Rendering ────────────────────────────────────────────────────

  renderDiagram(model: DiagramModel): void {
    this.clear();

    const nodeById = new Map(model.nodes.map((n) => [n.id, n]));

    model.edges.forEach((edge) => {
      const from = nodeById.get(edge.from);
      const to   = nodeById.get(edge.to);
      if (!from || !to) return;
      const rendered = drawEdge(edge, from, to);
      this.edgeMap.set(edge.id, rendered);
      this.edgeLayer.addChild(rendered.container);
    });

    model.nodes.forEach((node) => {
      const rendered = drawNode(node);
      this.nodeMap.set(node.id, rendered);
      this.nodeLayer.addChild(rendered.container);
    });
  }

  clear(): void {
    gsap.killTweensOf(this.particleLayer.children);
    this.edgeLayer.removeChildren();
    this.nodeLayer.removeChildren();
    this.particleLayer.removeChildren();
    this.nodeMap.clear();
    this.edgeMap.clear();
  }

  // ─── Node State Updates ───────────────────────────────────────────────────

  setNodeState(nodeId: string, state: string): void {
    const rendered = this.nodeMap.get(nodeId);
    if (!rendered) return;
    updateNodeState(rendered, state);
    gsap.fromTo(rendered.bg, { alpha: 0.3 }, { alpha: 1, duration: 0.4, ease: 'power2.out' });
  }

  highlightNode(nodeId: string, highlight: boolean, color = 0xffd700): void {
    const rendered = this.nodeMap.get(nodeId);
    if (!rendered) return;
    updateNodeHighlight(rendered, highlight, color);

    if (highlight) {
      gsap.to(rendered.container.scale, {
        x: 1.12, y: 1.12,
        duration: 0.35, ease: 'back.out(1.7)',
        yoyo: true, repeat: -1, repeatDelay: 1.5,
      });
    } else {
      gsap.killTweensOf(rendered.container.scale);
      gsap.to(rendered.container.scale, { x: 1, y: 1, duration: 0.2 });
    }
  }

  pulseNode(nodeId: string, color = 0x4facfe): void {
    const rendered = this.nodeMap.get(nodeId);
    if (!rendered) return;

    const pulse = new Graphics();
    pulse.circle(0, 0, 40);
    pulse.stroke({ color, width: 2, alpha: 0.8 });
    pulse.x = rendered.container.x;
    pulse.y = rendered.container.y;
    this.particleLayer.addChild(pulse);

    const pulseRef = pulse;
    gsap.to(pulse.scale, { x: 2.5, y: 2.5, duration: 0.8, ease: 'power2.out' });
    gsap.to(pulse, {
      alpha: 0, duration: 0.8, ease: 'power2.out',
      onComplete: () => { this.particleLayer.removeChild(pulseRef); },
    });
  }

  shakeNode(nodeId: string): void {
    const rendered = this.nodeMap.get(nodeId);
    if (!rendered) return;
    const origX = rendered.container.x;
    gsap.to(rendered.container, {
      x: origX + 8, duration: 0.05,
      yoyo: true, repeat: 7, ease: 'none',
      onComplete: () => { rendered.container.x = origX; },
    });
  }

  // ─── Request Particle Animation ───────────────────────────────────────────

  animateParticle(
    positions: Position[],
    durationPerHop: number,
    color: number,
    onHop?: (index: number) => void,
    onComplete?: () => void,
  ): void {
    if (positions.length < 2) return;

    const particle = createParticle(color);
    particle.x = positions[0].x;
    particle.y = positions[0].y;
    this.particleLayer.addChild(particle);

    const tl = gsap.timeline({
      onComplete: () => {
        gsap.to(particle, {
          alpha: 0, duration: 0.2,
          onComplete: () => { this.particleLayer.removeChild(particle); onComplete?.(); },
        });
      },
    });

    for (let i = 1; i < positions.length; i++) {
      const hopIndex = i;
      tl.to(particle, {
        x: positions[i].x, y: positions[i].y,
        duration: durationPerHop, ease: 'power1.inOut',
        onStart: () => onHop?.(hopIndex),
      });
    }
  }

  // ─── Timer Bar Animation (Raft) ────────────────────────────────────────────

  animateTimerBar(
    nodeId: string,
    durationMs: number,
    color: number,
    onExpire?: () => void,
  ): gsap.core.Tween {
    const rendered = this.nodeMap.get(nodeId);
    if (!rendered) return gsap.to({}, {});

    const bar = new Graphics();
    bar.rect(-34, 40, 68, 5);
    bar.fill({ color });
    bar.x = rendered.container.x;
    bar.y = rendered.container.y;
    this.particleLayer.addChild(bar);

    const barRef = bar;
    const tween = gsap.to(bar.scale, {
      x: 0,
      duration: durationMs / 1000,
      ease: 'none',
      onComplete: () => {
        this.particleLayer.removeChild(barRef);
        onExpire?.();
      },
    });

    return tween;
  }

  resetTimerBar(nodeId: string): void {
    this.pulseNode(nodeId, 0x4facfe);
  }

  // ─── Utility ──────────────────────────────────────────────────────────────

  getNodePosition(nodeId: string): Position | undefined {
    const rendered = this.nodeMap.get(nodeId);
    if (!rendered) return undefined;
    return { x: rendered.container.x, y: rendered.container.y };
  }

  hasNode(nodeId: string): boolean {
    return this.nodeMap.has(nodeId);
  }

  get stage(): Container {
    return this.app.stage;
  }
}
