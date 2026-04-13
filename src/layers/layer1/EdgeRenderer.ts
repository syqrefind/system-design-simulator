import { Graphics, Text, Container } from 'pixi.js';
import type { DiagramEdge, DiagramNode, EdgeType } from '../layer2/types';

// ─── Layer 1: Edge Renderer ───────────────────────────────────────────────────
// Draws edges between nodes with type-specific visual styles.

const EDGE_STYLES: Record<EdgeType, { color: number; width: number; dash: boolean; alpha: number }> = {
  sync:  { color: 0x4facfe, width: 2,   dash: false, alpha: 0.7 },
  async: { color: 0xa78bfa, width: 1.5, dash: true,  alpha: 0.6 },
  event: { color: 0x48bb78, width: 1.5, dash: true,  alpha: 0.5 },
};

export interface RenderedEdge {
  container: Container;
  line: Graphics;
  label?: Text;
}

export function drawEdge(
  edge: DiagramEdge,
  fromNode: DiagramNode,
  toNode: DiagramNode,
): RenderedEdge {
  const style = EDGE_STYLES[edge.type] ?? EDGE_STYLES.sync;
  const container = new Container();
  const line = new Graphics();

  const x1 = fromNode.position.x;
  const y1 = fromNode.position.y;
  const x2 = toNode.position.x;
  const y2 = toNode.position.y;

  // Compute direction vector for offset from node centers
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const RADIUS_OFFSET = 38;

  const ux = dx / dist;
  const uy = dy / dist;

  const sx = x1 + ux * RADIUS_OFFSET;
  const sy = y1 + uy * RADIUS_OFFSET;
  const ex = x2 - ux * RADIUS_OFFSET;
  const ey = y2 - uy * RADIUS_OFFSET;

  if (style.dash) {
    drawDashedLine(line, sx, sy, ex, ey, style.color, style.width, style.alpha);
  } else {
    line.moveTo(sx, sy);
    line.lineTo(ex, ey);
    line.stroke({ color: style.color, width: style.width, alpha: style.alpha });
  }

  // Arrowhead
  drawArrowhead(line, ex, ey, ux, uy, style.color, style.alpha);

  // Bidirectional: second arrowhead
  if (edge.bidirectional) {
    drawArrowhead(line, sx, sy, -ux, -uy, style.color, style.alpha);
  }

  container.addChild(line);

  let label: Text | undefined;
  if (edge.label) {
    const mx = (sx + ex) / 2;
    const my = (sy + ey) / 2;
    label = new Text({
      text: edge.label,
      style: {
        fill: style.color,
        fontSize: 10,
        fontFamily: 'monospace',
      },
    });
    label.alpha = 0.85;
    label.anchor.set(0.5, 0.5);
    label.x = mx - uy * 14;
    label.y = my + ux * 14;
    container.addChild(label);
  }

  return { container, line, label };
}

function drawArrowhead(
  g: Graphics,
  ex: number,
  ey: number,
  ux: number,
  uy: number,
  color: number,
  alpha: number,
): void {
  const arrowLen = 10;
  const arrowAngle = 0.45;

  const ax1 = ex - arrowLen * (ux * Math.cos(arrowAngle) - uy * Math.sin(arrowAngle));
  const ay1 = ey - arrowLen * (uy * Math.cos(arrowAngle) + ux * Math.sin(arrowAngle));
  const ax2 = ex - arrowLen * (ux * Math.cos(-arrowAngle) - uy * Math.sin(-arrowAngle));
  const ay2 = ey - arrowLen * (uy * Math.cos(-arrowAngle) + ux * Math.sin(-arrowAngle));

  g.moveTo(ex, ey);
  g.lineTo(ax1, ay1);
  g.stroke({ color, width: 2, alpha });
  g.moveTo(ex, ey);
  g.lineTo(ax2, ay2);
  g.stroke({ color, width: 2, alpha });
}

function drawDashedLine(
  g: Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: number,
  width: number,
  alpha: number,
  dashLen = 8,
  gapLen = 5,
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / dist;
  const uy = dy / dist;

  let traveled = 0;
  let drawing = true;

  while (traveled < dist) {
    const segLen = drawing ? dashLen : gapLen;
    const next = Math.min(traveled + segLen, dist);

    if (drawing) {
      g.moveTo(x1 + ux * traveled, y1 + uy * traveled);
      g.lineTo(x1 + ux * next, y1 + uy * next);
      g.stroke({ color, width, alpha });
    }

    traveled = next;
    drawing = !drawing;
  }
}

export function highlightEdge(rendered: RenderedEdge, active: boolean, color = 0xffd700): void {
  if (active) {
    rendered.line.tint = color;
    rendered.line.alpha = 1;
  } else {
    rendered.line.tint = 0xffffff;
    rendered.line.alpha = 0.6;
  }
}
