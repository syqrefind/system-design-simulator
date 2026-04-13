import { Graphics, Container, Text } from 'pixi.js';
import type { DiagramNode, NodeType } from '../layer2/types';

// ─── Layer 1: Node Renderer ───────────────────────────────────────────────────
// Stateless drawing functions. No simulation logic here.

const NODE_COLORS: Record<NodeType, { fill: number; stroke: number; icon: string }> = {
  client:       { fill: 0x2d3a5e, stroke: 0x4facfe, icon: '◎' },
  gateway:      { fill: 0x1e3a4a, stroke: 0x00f2fe, icon: '⊕' },
  service:      { fill: 0x1a3a2e, stroke: 0x48bb78, icon: '⬡' },
  db:           { fill: 0x3a2e1a, stroke: 0xed8936, icon: '◫' },
  queue:        { fill: 0x2e1a3a, stroke: 0xa78bfa, icon: '≡' },
  cache:        { fill: 0x1a3a3a, stroke: 0x38b2ac, icon: '⚡' },
  loadbalancer: { fill: 0x1e2a3a, stroke: 0x63b3ed, icon: '⊞' },
  pod:          { fill: 0x2a1a3a, stroke: 0x9f7aea, icon: '⬡' },
  server:       { fill: 0x1a2a1a, stroke: 0x68d391, icon: '▣' },
  scheduler:    { fill: 0x3a1a1a, stroke: 0xfc8181, icon: '⊛' },
};

const STATE_OVERLAYS: Record<string, number> = {
  pending:    0xed8936,
  running:    0x48bb78,
  succeeded:  0x4facfe,
  failed:     0xfc8181,
  terminated: 0x718096,
  leader:     0xffd700,
  candidate:  0xf6ad55,
  follower:   0x4facfe,
  primary:    0xffd700,
  replica:    0x63b3ed,
  healthy:    0x48bb78,
  degraded:   0xed8936,
  down:       0xfc8181,
};

export const NODE_RADIUS = 36;

export interface RenderedNode {
  container: Container;
  bg: Graphics;
  label: Text;
  stateIndicator: Graphics;
  iconText: Text;
}

export function drawNode(node: DiagramNode): RenderedNode {
  const theme = NODE_COLORS[node.type] ?? NODE_COLORS.service;
  const container = new Container();

  // ─── Background circle ────────────────────────────────────────────────────
  const bg = new Graphics();
  bg.circle(0, 0, NODE_RADIUS);
  bg.fill({ color: theme.fill });
  bg.stroke({ color: theme.stroke, width: 2.5 });
  container.addChild(bg);

  // ─── Icon ─────────────────────────────────────────────────────────────────
  const iconText = new Text({
    text: theme.icon,
    style: {
      fill: theme.stroke,
      fontSize: 18,
      fontFamily: 'monospace',
    },
  });
  iconText.anchor.set(0.5, 0.6);
  container.addChild(iconText);

  // ─── State indicator dot ──────────────────────────────────────────────────
  const stateColor = node.state ? (STATE_OVERLAYS[node.state] ?? 0x718096) : 0x718096;
  const stateIndicator = new Graphics();
  stateIndicator.circle(NODE_RADIUS - 8, -NODE_RADIUS + 8, 6);
  stateIndicator.fill({ color: stateColor });
  stateIndicator.stroke({ color: 0x0d0d1a, width: 1.5 });
  container.addChild(stateIndicator);

  // ─── Label ────────────────────────────────────────────────────────────────
  const label = new Text({
    text: node.label,
    style: {
      fill: '#e2e8f0',
      fontSize: 11,
      fontFamily: 'monospace',
      align: 'center',
    },
  });
  label.anchor.set(0.5, 0);
  label.y = NODE_RADIUS + 6;
  container.addChild(label);

  container.x = node.position.x;
  container.y = node.position.y;

  return { container, bg, label, stateIndicator, iconText };
}

export function updateNodeState(rendered: RenderedNode, state: string): void {
  const color = STATE_OVERLAYS[state] ?? 0x718096;
  rendered.stateIndicator.clear();
  rendered.stateIndicator.circle(NODE_RADIUS - 8, -NODE_RADIUS + 8, 6);
  rendered.stateIndicator.fill({ color });
  rendered.stateIndicator.stroke({ color: 0x0d0d1a, width: 1.5 });
}

export function updateNodeHighlight(rendered: RenderedNode, highlighted: boolean, color = 0xffd700): void {
  const theme = NODE_COLORS.service;
  rendered.bg.clear();
  rendered.bg.circle(0, 0, NODE_RADIUS);
  rendered.bg.fill({ color: highlighted ? 0x2a2a1a : theme.fill });
  rendered.bg.stroke({ color: highlighted ? color : theme.stroke, width: highlighted ? 3.5 : 2.5 });
  if (highlighted) {
    // Outer glow ring
    rendered.bg.circle(0, 0, NODE_RADIUS + 6);
    rendered.bg.stroke({ color, width: 1, alpha: 0.4 });
  }
}

export function createParticle(color = 0xffd700, radius = 7): Graphics {
  const g = new Graphics();
  g.circle(0, 0, radius);
  g.fill({ color });
  g.circle(0, 0, radius + 4);
  g.fill({ color, alpha: 0.3 });
  return g;
}

export function getStateColor(state: string): number {
  return STATE_OVERLAYS[state] ?? 0x718096;
}
