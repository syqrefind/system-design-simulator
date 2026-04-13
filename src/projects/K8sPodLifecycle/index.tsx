import { useEffect, useRef, useState, useCallback } from 'react';
import { PixiRenderer } from '../../layers/layer1/PixiRenderer';
import { AnimationEngine } from '../../layers/layer3/AnimationEngine';
import { PodLifecycleSimulation } from '../../layers/layer3/SimulationEngine';
import type { PodPhase } from '../../layers/layer3/SimulationEngine';
import { buildK8sModel, POD_SCENARIOS } from './simulation';
import { saveDiagram, exportDiagramFile } from '../../serialization';
import type { DiagramModelManager } from '../../layers/layer2/DiagramModel';

// ─── K8s Pod Lifecycle Project Page ──────────────────────────────────────────

const PHASE_COLORS: Record<PodPhase, string> = {
  pending:    'text-yellow-400',
  running:    'text-green-400',
  succeeded:  'text-blue-400',
  failed:     'text-red-400',
  terminated: 'text-gray-400',
};

const PHASE_DESC: Record<PodPhase, string> = {
  pending:    'Scheduler binding pod to node',
  running:    'Container started; probes passing',
  succeeded:  'All containers exited 0',
  failed:     'Container crashed / OOMKilled',
  terminated: 'Pod removed, etcd cleaned up',
};

export default function K8sPodLifecycleProject() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<PixiRenderer | null>(null);
  const engineRef = useRef<AnimationEngine | null>(null);
  const modelRef = useRef<DiagramModelManager | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [podPhases, setPodPhases] = useState<Record<string, PodPhase>>({
    'pod-a': 'pending', 'pod-b': 'pending', 'pod-c': 'pending',
  });
  const [log, setLog] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const appendLog = useCallback((msg: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 30));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new PixiRenderer();
    const model = buildK8sModel();
    rendererRef.current = renderer;
    modelRef.current = model;

    let mounted = true;

    renderer.init(canvas)
      .then(() => {
        if (!mounted) return;
        renderer.renderDiagram(model.snapshot());
        engineRef.current = new AnimationEngine(renderer, model);
        appendLog('K8s cluster loaded — control plane + 3 nodes + 3 pods');
      })
      .catch((err: unknown) => {
        console.error('[K8s] PixiJS init error:', err);
        appendLog('⚠ Renderer init failed');
      });

    return () => {
      mounted = false;
      engineRef.current?.killAll();
      renderer.destroy();
    };
  }, [appendLog]);

  const runScenario = useCallback(async () => {
    const engine = engineRef.current;
    const model = modelRef.current;
    if (!engine || !model || isRunning) return;

    const scenario = POD_SCENARIOS[scenarioIdx];
    setIsRunning(true);
    appendLog(`Starting: ${scenario.label}`);

    const sim = new PodLifecycleSimulation(engine, model, {
      podId: scenario.podId,
      schedulerToNodePath: scenario.schedulerPath,
      onPhaseChange: (phase) => {
        setPodPhases((prev) => ({ ...prev, [scenario.podId]: phase }));
        appendLog(`${scenario.podId} → ${phase.toUpperCase()}`);
      },
      onComplete: () => {
        appendLog(`${scenario.label} complete`);
        setIsRunning(false);
      },
    });

    if (scenario.failurePod) {
      await sim.startWithFailure();
      setIsRunning(false);
    } else {
      await sim.start();
      setIsRunning(false);
    }
  }, [scenarioIdx, isRunning, appendLog]);

  const runAllPods = useCallback(async () => {
    const engine = engineRef.current;
    const model = modelRef.current;
    if (!engine || !model || isRunning) return;

    setIsRunning(true);
    appendLog('Running all 3 pod scenarios in parallel…');

    const promises = POD_SCENARIOS.map((scenario) => {
      const sim = new PodLifecycleSimulation(engine, model, {
        podId: scenario.podId,
        schedulerToNodePath: scenario.schedulerPath,
        onPhaseChange: (phase) => {
          setPodPhases((prev) => ({ ...prev, [scenario.podId]: phase }));
        },
      });
      return scenario.failurePod ? sim.startWithFailure() : sim.start();
    });

    await Promise.all(promises);
    appendLog('All pods finished');
    setIsRunning(false);
  }, [isRunning, appendLog]);

  const handleReset = useCallback(() => {
    const model = modelRef.current;
    const renderer = rendererRef.current;
    if (!model || !renderer) return;

    engineRef.current?.killAll();
    ['pod-a', 'pod-b', 'pod-c'].forEach((id) => {
      model.setNodeState(id, 'pending');
      renderer.setNodeState(id, 'pending');
    });
    setPodPhases({ 'pod-a': 'pending', 'pod-b': 'pending', 'pod-c': 'pending' });
    setIsRunning(false);
    appendLog('Reset — all pods back to Pending');
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
          K8s Cluster
        </div>
      </div>

      {/* ── Control Panel ──────────────────────────────────────────────────── */}
      <div className="w-72 flex flex-col gap-3 shrink-0 overflow-y-auto">
        {/* Scenario picker */}
        <div className="panel">
          <h3 className="panel-title">Scenario</h3>
          {POD_SCENARIOS.map((s, i) => (
            <button
              key={i}
              onClick={() => setScenarioIdx(i)}
              className={`w-full text-left text-xs px-3 py-2 rounded-lg font-mono transition-all mb-1 ${
                scenarioIdx === i
                  ? 'bg-notebook-accent/20 border border-notebook-accent text-notebook-accent'
                  : 'bg-notebook-surface border border-notebook-border text-notebook-text-muted hover:border-notebook-accent/40'
              }`}
            >
              <div>{s.label}</div>
              <div className="text-notebook-text-muted text-xs mt-0.5">{s.description}</div>
            </button>
          ))}
        </div>

        {/* Pod state display */}
        <div className="panel">
          <h3 className="panel-title">Pod States</h3>
          {Object.entries(podPhases).map(([podId, phase]) => (
            <div key={podId} className="py-1.5 border-b border-notebook-border last:border-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-notebook-text-muted">{podId}</span>
                <span className={`text-xs font-mono font-bold uppercase ${PHASE_COLORS[phase]}`}>
                  {phase}
                </span>
              </div>
              <div className="text-xs text-notebook-text-muted mt-0.5" style={{ fontSize: '10px' }}>
                {PHASE_DESC[phase]}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="panel flex flex-col gap-2">
          <h3 className="panel-title">Actions</h3>
          <button onClick={runScenario} disabled={isRunning} className="btn-primary">
            ▶ Run Scenario
          </button>
          <button onClick={runAllPods} disabled={isRunning} className="btn-secondary">
            ▶▶ Run All Pods
          </button>
          <button onClick={handleReset} className="btn-warning">
            ↺ Reset Pods
          </button>
          <button onClick={handleSave} className="btn-ghost">
            {saved ? '✓ Saved' : '💾 Save'}
          </button>
          <button
            onClick={() => exportDiagramFile(modelRef.current!.snapshot())}
            className="btn-ghost"
          >
            ↓ Export JSON
          </button>
        </div>

        {/* Lifecycle diagram */}
        <div className="panel">
          <h3 className="panel-title">Lifecycle States</h3>
          <div className="flex flex-col gap-0.5 text-xs font-mono">
            {(['pending', 'running', 'succeeded', 'terminated'] as PodPhase[]).map((phase, i, arr) => (
              <div key={phase}>
                <span className={PHASE_COLORS[phase]}>{phase.toUpperCase()}</span>
                {i < arr.length - 1 && <div className="text-notebook-text-muted ml-2 text-xs">↓</div>}
              </div>
            ))}
            <div className="mt-2 pt-2 border-t border-notebook-border">
              <span className={PHASE_COLORS['failed']}>FAILED</span>
              <span className="text-notebook-text-muted"> (OOMKilled)</span>
            </div>
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
