import { useEffect, useRef, useState, useCallback } from 'react';
import { PixiRenderer } from '../../layers/layer1/PixiRenderer';
import { AnimationEngine } from '../../layers/layer3/AnimationEngine';
import { RaftSimulation } from '../../layers/layer3/SimulationEngine';
import { buildRaftModel, RAFT_NODE_IDS, RAFT_EXPLAINERS } from './simulation';
import { saveDiagram } from '../../serialization';
import type { DiagramModelManager } from '../../layers/layer2/DiagramModel';
import type { RaftRole } from '../../layers/layer2/types';

// ─── Leader Election (Raft) Project Page ──────────────────────────────────────

const ROLE_COLORS: Record<RaftRole, string> = {
  follower:  'text-blue-400',
  candidate: 'text-orange-400',
  leader:    'text-yellow-400',
};

const ROLE_BG: Record<RaftRole, string> = {
  follower:  'bg-blue-950/40 border-blue-800/50',
  candidate: 'bg-orange-950/40 border-orange-800/50',
  leader:    'bg-yellow-950/40 border-yellow-800/50',
};

export default function LeaderElectionProject() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<PixiRenderer | null>(null);
  const engineRef = useRef<AnimationEngine | null>(null);
  const modelRef = useRef<DiagramModelManager | null>(null);
  const simRef = useRef<RaftSimulation | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [nodeRoles, setNodeRoles] = useState<Record<string, RaftRole>>(() =>
    Object.fromEntries(RAFT_NODE_IDS.map((id) => [id, 'follower' as RaftRole])),
  );
  const [nodeTerms, setNodeTerms] = useState<Record<string, number>>(() =>
    Object.fromEntries(RAFT_NODE_IDS.map((id) => [id, 0])),
  );
  const [leader, setLeader] = useState<string | null>(null);
  const [currentTerm, setCurrentTerm] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [minTimeout, setMinTimeout] = useState(2000);
  const [maxTimeout, setMaxTimeout] = useState(4000);
  const [heartbeatInterval, setHeartbeatInterval] = useState(1500);
  const [saved, setSaved] = useState(false);

  const appendLog = useCallback((msg: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 40));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new PixiRenderer();
    const model = buildRaftModel();
    rendererRef.current = renderer;
    modelRef.current = model;

    let mounted = true;

    renderer.init(canvas)
      .then(() => {
        if (!mounted) return;
        renderer.renderDiagram(model.snapshot());
        engineRef.current = new AnimationEngine(renderer, model);
        appendLog('Raft cluster ready — 5 follower nodes, fully connected');

        model.on('leader_elected', (e) => {
          appendLog(`★ Leader: ${e.nodeId} (term ${(e.data as { term: number }).term})`);
        });
        model.on('vote_cast', (e) => {
          const d = e.data as { toId: string; granted: boolean };
          appendLog(`Vote ${e.nodeId}→${d.toId} [${d.granted ? 'GRANTED' : 'DENIED'}]`);
        });
        model.on('timer_reset', (e) => appendLog(`Timer reset: ${e.nodeId}`));
      })
      .catch((err: unknown) => {
        console.error('[Raft] PixiJS init error:', err);
        appendLog('⚠ Renderer init failed');
      });

    return () => {
      mounted = false;
      simRef.current?.stop();
      engineRef.current?.killAll();
      renderer.destroy();
    };
  }, [appendLog]);

  const startSimulation = useCallback(() => {
    const engine = engineRef.current;
    const model = modelRef.current;
    if (!engine || !model || isRunning) return;

    const sim = new RaftSimulation(engine, model, {
      nodeIds: RAFT_NODE_IDS,
      minTimeout,
      maxTimeout,
      heartbeatInterval,
      onStateChange: (id, role, term) => {
        setNodeRoles((prev) => ({ ...prev, [id]: role }));
        setNodeTerms((prev) => ({ ...prev, [id]: term }));
        setCurrentTerm((prev) => Math.max(prev, term));
        if (role === 'leader') {
          setLeader(id);
          appendLog(`★ ${id} → LEADER (term ${term})`);
        } else if (role === 'candidate') {
          appendLog(`⚡ ${id} → CANDIDATE (term ${term})`);
        }
      },
      onLeaderElected: (leaderId, term) => {
        setLeader(leaderId);
        setCurrentTerm(term);
      },
    });

    simRef.current = sim;
    setIsRunning(true);
    appendLog(`Election started — timeout ${minTimeout}–${maxTimeout}ms, HB ${heartbeatInterval}ms`);
    sim.start();
  }, [isRunning, minTimeout, maxTimeout, heartbeatInterval, appendLog]);

  const stopSimulation = useCallback(() => {
    simRef.current?.stop();
    engineRef.current?.killAll();
    setIsRunning(false);
    appendLog('Simulation stopped');
  }, [appendLog]);

  const resetSimulation = useCallback(() => {
    simRef.current?.reset();
    simRef.current = null;
    setIsRunning(false);
    setLeader(null);
    setCurrentTerm(0);
    setNodeRoles(Object.fromEntries(RAFT_NODE_IDS.map((id) => [id, 'follower' as RaftRole])));
    setNodeTerms(Object.fromEntries(RAFT_NODE_IDS.map((id) => [id, 0])));
    appendLog('Reset — all nodes: follower, term 0');
  }, [appendLog]);

  const handleSave = useCallback(() => {
    const model = modelRef.current;
    if (!model) return;
    saveDiagram(model.snapshot());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    appendLog('Diagram saved');
  }, [appendLog]);

  return (
    <div className="flex h-full gap-4">
      {/* ── Canvas ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative rounded-xl overflow-hidden border border-notebook-border">
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        />
        <div className="absolute top-3 left-3 text-xs text-notebook-text-muted font-mono pointer-events-none z-10">
          Raft Cluster — Term {currentTerm}
        </div>
        {leader && (
          <div className="absolute top-3 right-3 text-xs font-mono text-yellow-400 bg-yellow-950/60 border border-yellow-800/60 rounded px-2 py-1 z-10">
            ★ Leader: {leader}
          </div>
        )}
      </div>

      {/* ── Control Panel ──────────────────────────────────────────────────── */}
      <div className="w-72 flex flex-col gap-3 shrink-0 overflow-y-auto">

        {/* Node state grid */}
        <div className="panel">
          <h3 className="panel-title">Node States</h3>
          <div className="flex flex-col gap-1">
            {RAFT_NODE_IDS.map((id) => {
              const role = nodeRoles[id];
              const term = nodeTerms[id];
              return (
                <div
                  key={id}
                  className={`flex items-center justify-between px-2 py-1.5 rounded-lg border text-xs font-mono transition-all ${ROLE_BG[role]}`}
                >
                  <span className="text-notebook-text-muted">{id}</span>
                  <div>
                    <span className={`font-bold uppercase ${ROLE_COLORS[role]}`}>
                      {id === leader && '★ '}{role}
                    </span>
                    <span className="text-notebook-text-muted ml-2">t{term}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Timer config */}
        <div className="panel">
          <h3 className="panel-title">Configuration</h3>
          <div className="space-y-2 text-xs font-mono">
            {[
              { label: `Min timeout: ${minTimeout}ms`, value: minTimeout, min: 500, max: 5000, set: setMinTimeout },
              { label: `Max timeout: ${maxTimeout}ms`, value: maxTimeout, min: 1000, max: 8000, set: setMaxTimeout },
              { label: `Heartbeat: ${heartbeatInterval}ms`, value: heartbeatInterval, min: 300, max: 3000, set: setHeartbeatInterval },
            ].map(({ label, value, min, max, set }) => (
              <div key={label}>
                <label className="text-notebook-text-muted">{label}</label>
                <input
                  type="range" min={min} max={max} step={100} value={value}
                  onChange={(e) => set(Number(e.target.value))}
                  className="w-full accent-notebook-accent"
                  disabled={isRunning}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="panel flex flex-col gap-2">
          <h3 className="panel-title">Controls</h3>
          {!isRunning ? (
            <button onClick={startSimulation} className="btn-primary">▶ Start Election</button>
          ) : (
            <button onClick={stopSimulation} className="btn-danger">⬛ Stop</button>
          )}
          <button onClick={resetSimulation} disabled={isRunning} className="btn-warning">
            ↺ Reset Cluster
          </button>
          <button onClick={handleSave} className="btn-ghost">
            {saved ? '✓ Saved' : '💾 Save Diagram'}
          </button>
        </div>

        {/* Explainer */}
        <div className="panel">
          <h3 className="panel-title">How Raft Works</h3>
          <div className="space-y-2">
            {RAFT_EXPLAINERS.map((ex) => (
              <div key={ex.phase} className="text-xs font-mono">
                <span style={{ color: ex.color }} className="font-bold">{ex.phase}: </span>
                <span className="text-notebook-text-muted">{ex.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Log */}
        <div className="panel flex-1">
          <h3 className="panel-title">Event Log</h3>
          <div className="overflow-y-auto max-h-40 space-y-1">
            {log.map((entry, i) => (
              <div key={i} className="text-xs font-mono text-notebook-text-muted leading-relaxed">
                {entry}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
