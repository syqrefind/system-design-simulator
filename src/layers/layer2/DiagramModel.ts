import type {
  DiagramModel,
  DiagramNode,
  DiagramEdge,
  NodeType,
  EdgeType,
  Position,
  SimEvent,
  SimEventListener,
  SimEventType,
} from './types';

// ─── Diagram Model Builder ────────────────────────────────────────────────────
// Mutable model with change tracking and event bus.

export class DiagramModelManager {
  private model: DiagramModel;
  private listeners: Map<SimEventType | '*', Set<SimEventListener>> = new Map();
  private idCounter = 0;

  constructor(name: string, description?: string) {
    this.model = {
      id: crypto.randomUUID(),
      name,
      description,
      nodes: [],
      edges: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  // ─── Factory Methods ───────────────────────────────────────────────────────

  static fromJSON(json: string): DiagramModelManager {
    const data = JSON.parse(json) as DiagramModel;
    const mgr = new DiagramModelManager(data.name, data.description);
    mgr.model = data;
    return mgr;
  }

  // ─── Nodes ────────────────────────────────────────────────────────────────

  addNode(
    type: NodeType,
    label: string,
    position: Position,
    state?: string,
    metadata?: Record<string, unknown>,
  ): DiagramNode {
    const node: DiagramNode = {
      id: `node-${++this.idCounter}`,
      type,
      label,
      position,
      state,
      metadata,
    };
    this.model.nodes.push(node);
    this.touch();
    return node;
  }

  addNamedNode(
    id: string,
    type: NodeType,
    label: string,
    position: Position,
    state?: string,
    metadata?: Record<string, unknown>,
  ): DiagramNode {
    const node: DiagramNode = { id, type, label, position, state, metadata };
    this.model.nodes.push(node);
    this.touch();
    return node;
  }

  getNode(id: string): DiagramNode | undefined {
    return this.model.nodes.find((n) => n.id === id);
  }

  removeNode(id: string): boolean {
    const idx = this.model.nodes.findIndex((n) => n.id === id);
    if (idx === -1) return false;
    this.model.nodes.splice(idx, 1);
    // Remove connected edges
    this.model.edges = this.model.edges.filter((e) => e.from !== id && e.to !== id);
    this.touch();
    return true;
  }

  setNodeState(id: string, state: string): void {
    const node = this.getNode(id);
    if (!node) return;
    node.state = state;
    this.touch();
    this.emit({ type: 'node_state_change', nodeId: id, data: { state }, timestamp: Date.now() });
  }

  setNodePosition(id: string, position: Position): void {
    const node = this.getNode(id);
    if (!node) return;
    node.position = position;
    this.touch();
  }

  // ─── Edges ────────────────────────────────────────────────────────────────

  addEdge(
    from: string,
    to: string,
    type: EdgeType = 'sync',
    label?: string,
    bidirectional = false,
  ): DiagramEdge {
    const edge: DiagramEdge = {
      id: `edge-${from}-${to}`,
      from,
      to,
      type,
      label,
      bidirectional,
    };
    this.model.edges.push(edge);
    this.touch();
    return edge;
  }

  getEdge(id: string): DiagramEdge | undefined {
    return this.model.edges.find((e) => e.id === id);
  }

  getEdgeBetween(fromId: string, toId: string): DiagramEdge | undefined {
    return this.model.edges.find(
      (e) =>
        (e.from === fromId && e.to === toId) ||
        (e.bidirectional && e.from === toId && e.to === fromId),
    );
  }

  removeEdge(id: string): boolean {
    const idx = this.model.edges.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    this.model.edges.splice(idx, 1);
    this.touch();
    return true;
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  getNeighbors(nodeId: string): DiagramNode[] {
    const ids = new Set<string>();
    this.model.edges.forEach((e) => {
      if (e.from === nodeId) ids.add(e.to);
      if (e.bidirectional && e.to === nodeId) ids.add(e.from);
    });
    return this.model.nodes.filter((n) => ids.has(n.id));
  }

  getIncomingEdges(nodeId: string): DiagramEdge[] {
    return this.model.edges.filter(
      (e) => e.to === nodeId || (e.bidirectional && e.from === nodeId),
    );
  }

  getOutgoingEdges(nodeId: string): DiagramEdge[] {
    return this.model.edges.filter(
      (e) => e.from === nodeId || (e.bidirectional && e.to === nodeId),
    );
  }

  // ─── Snapshot ─────────────────────────────────────────────────────────────

  snapshot(): DiagramModel {
    return JSON.parse(JSON.stringify(this.model)) as DiagramModel;
  }

  toJSON(): string {
    return JSON.stringify(this.model, null, 2);
  }

  get id(): string {
    return this.model.id;
  }

  get name(): string {
    return this.model.name;
  }

  get nodes(): readonly DiagramNode[] {
    return this.model.nodes;
  }

  get edges(): readonly DiagramEdge[] {
    return this.model.edges;
  }

  // ─── Event Bus ────────────────────────────────────────────────────────────

  on(type: SimEventType | '*', listener: SimEventListener): () => void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
    return () => this.listeners.get(type)?.delete(listener);
  }

  emit(event: SimEvent): void {
    this.listeners.get(event.type)?.forEach((l) => l(event));
    this.listeners.get('*')?.forEach((l) => l(event));
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  private touch(): void {
    this.model.updatedAt = new Date().toISOString();
  }
}
