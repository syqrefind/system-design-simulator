import { useEffect, useRef, useState, useCallback } from 'react';
import { PixiRenderer } from '../../layers/layer1/PixiRenderer';
import { AnimationEngine } from '../../layers/layer3/AnimationEngine';
import { RequestFlowSimulation } from '../../layers/layer3/SimulationEngine';
import { buildRequestFlowModel, REQUEST_PATHS } from './simulation';
import { saveDiagram, exportDiagramFile } from '../../serialization';
import type { DiagramModelManager } from '../../layers/layer2/DiagramModel';

// ─── Request Flow Project Page ────────────────────────────────────────────────

export default function RequestFlowProject() {
  // React owns the <canvas> element. PixiJS uses it — never creates its own.
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<PixiRenderer | null>(null);
  const engineRef = useRef<AnimationEngine | null>(null);
  const modelRef = useRef<DiagramModelManager | null>(null);
  const simRef = useRef<RequestFlowSimulation | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [activePathIndex, setActivePathIndex] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [latency, setLatency] = useState(800);
  const [saved, setSaved] = useState(false);

  const appendLog = useCallback((msg: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 40));
  }, []);

  // ── Initialize PixiJS ───────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new PixiRenderer();
    const model = buildRequestFlowModel();
    rendererRef.current = renderer;
    modelRef.current = model;

    let mounted = true;

    renderer.init(canvas)
      .then(() => {
        if (!mounted) return;
        renderer.renderDiagram(model.snapshot());
        engineRef.current = new AnimationEngine(renderer, model);
        appendLog('Request Flow loaded — 10 nodes, 10 edges');

        model.on('request_start', (e) => {
          const { path } = e.data as { path: string[] };
          appendLog(`→ ${path.join(' → ')}`);
        });
        model.on('request_complete', () => appendLog('✓ Request complete'));
        model.on('failure', (e) => appendLog(`✗ Failure: ${e.nodeId}`));
        model.on('recovery', (e) => appendLog(`↑ Recovered: ${e.nodeId}`));
      })
      .catch((err: unknown) => {
        console.error('[RequestFlow] PixiJS init error:', err);
        appendLog('⚠ Renderer init failed — see console');
      });

    return () => {
      mounted = false;
      simRef.current?.stop();
      engineRef.current?.killAll();
      renderer.destroy();
    };
  }, [appendLog]);

  // ── Single Request ──────────────────────────────────────────────────────────
  const runSingleRequest = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine || isRunning) return;

    const config = REQUEST_PATHS[activePathIndex];
    setIsRunning(true);
    try {
      await engine.animateRequest({ path: config.path, latency, color: config.color });
    } finally {
      setIsRunning(false);
    }
  }, [activePathIndex, isRunning, latency]);

  // ── Loop Mode ───────────────────────────────────────────────────────────────
  const toggleLoop = useCallback(() => {
    const engine = engineRef.current;
    const model = modelRef.current;
    if (!engine || !model) return;

    if (simRef.current?.isRunning) {
      simRef.current.stop();
      simRef.current = null;
      setIsRunning(false);
      appendLog('Loop stopped');
      return;
    }

    const sim = new RequestFlowSimulation(engine, model, {
      requestPaths: REQUEST_PATHS.map((r) => r.path),
      interval: 1400,
      latency,
      loop: true,
      onRequest: (path, idx) => appendLog(`[#${idx + 1}] ${path.join(' → ')}`),
    });
    simRef.current = sim;
    setIsRunning(true);
    appendLog('Loop started');
    sim.start();
  }, [latency, appendLog]);

  // ── Failure Injection ───────────────────────────────────────────────────────
  const simulateGatewayFailure = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    appendLog('Injecting failure → API Gateway');
    await engine.simulateFailure({ nodeId: 'gateway', duration: 2000 });
    appendLog('Gateway recovered');
  }, [appendLog]);

  const handleSave = useCallback(() => {
    const model = modelRef.current;
    if (!model) return;
    saveDiagram(model.snapshot());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    appendLog('Diagram saved');
  }, [appendLog]);

  const handleExport = useCallback(() => {
    const model = modelRef.current;
    if (!model) return;
    exportDiagramFile(model.snapshot());
    appendLog('Exported JSON');
  }, [appendLog]);

  return (
    <div className="flex h-full gap-4">
      {/* ── Canvas ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative rounded-xl overflow-hidden border border-notebook-border">
        {/* Canvas fills the relative container via absolute positioning */}
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        />
        <div className="absolute top-3 left-3 text-xs text-notebook-text-muted font-mono pointer-events-none z-10">
          Layer 1 · PixiJS Canvas
        </div>
      </div>

      {/* ── Control Panel ──────────────────────────────────────────────────── */}
      <div className="w-72 flex flex-col gap-3 shrink-0 overflow-y-auto">
        {/* Path selector */}
        <div className="panel">
          <h3 className="panel-title">Request Path</h3>
          <div className="flex flex-col gap-1">
            {REQUEST_PATHS.map((rp, i) => (
              <button
                key={i}
                onClick={() => setActivePathIndex(i)}
                className={`text-left text-xs px-3 py-2 rounded-lg font-mono transition-all ${
                  activePathIndex === i
                    ? 'bg-notebook-accent/20 border border-notebook-accent text-notebook-accent'
                    : 'bg-notebook-surface border border-notebook-border text-notebook-text-muted hover:border-notebook-accent/40'
                }`}
              >
                {rp.label}
              </button>
            ))}
          </div>
        </div>

        {/* Latency */}
        <div className="panel">
          <h3 className="panel-title">Latency: {latency}ms</h3>
          <input
            type="range" min={200} max={2000} step={100} value={latency}
            onChange={(e) => setLatency(Number(e.target.value))}
            className="w-full accent-notebook-accent"
          />
          <div className="flex justify-between text-xs text-notebook-text-muted font-mono mt-1">
            <span>200ms</span><span>2000ms</span>
          </div>
        </div>

        {/* Actions */}
        <div className="panel flex flex-col gap-2">
          <h3 className="panel-title">Actions</h3>
          <button onClick={runSingleRequest} disabled={isRunning} className="btn-primary">
            ▶ Send Request
          </button>
          <button
            onClick={toggleLoop}
            className={simRef.current?.isRunning ? 'btn-danger' : 'btn-secondary'}
          >
            {simRef.current?.isRunning ? '⬛ Stop Loop' : '↻ Start Loop'}
          </button>
          <button onClick={simulateGatewayFailure} className="btn-warning">
            ⚡ Gateway Failure
          </button>
          <div className="flex gap-2">
            <button onClick={handleSave} className="btn-ghost flex-1">
              {saved ? '✓ Saved' : '💾 Save'}
            </button>
            <button onClick={handleExport} className="btn-ghost flex-1">
              ↓ Export
            </button>
          </div>
        </div>

        {/* Event log */}
        <div className="panel flex-1">
          <h3 className="panel-title">Event Log</h3>
          <div className="overflow-y-auto max-h-48 space-y-1">
            {log.map((entry, i) => (
              <div key={i} className="text-xs font-mono text-notebook-text-muted leading-relaxed">
                {entry}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="panel">
          <h3 className="panel-title">Edge Types</h3>
          <div className="space-y-1 text-xs font-mono">
            {[
              { color: 'bg-blue-400',   label: 'sync (solid)' },
              { color: 'bg-purple-400', label: 'async (dashed)' },
              { color: 'bg-green-400',  label: 'event (dashed)' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-8 h-0.5 ${color}`} />
                <span className="text-notebook-text-muted">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
