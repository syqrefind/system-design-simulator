import { useState, lazy, Suspense } from 'react';
import Navigation, { type ProjectId, PROJECTS } from './components/Navigation';
import NotebookLayout from './components/NotebookLayout';

const RequestFlowProject  = lazy(() => import('./projects/RequestFlow'));
const K8sPodLifecycle     = lazy(() => import('./projects/K8sPodLifecycle'));
const LeaderElectionProject = lazy(() => import('./projects/LeaderElection'));

function ProjectLoader() {
  return (
    <div className="flex items-center justify-center h-full text-notebook-text-muted font-mono text-sm">
      <div className="text-center">
        <div className="text-notebook-accent animate-pulse text-2xl mb-2">⬡</div>
        <div>Initializing renderer…</div>
      </div>
    </div>
  );
}

export default function App() {
  const [activeProject, setActiveProject] = useState<ProjectId>('request-flow');

  const currentProject = PROJECTS.find((p) => p.id === activeProject)!;

  return (
    <div className="h-screen flex flex-col bg-notebook-bg text-notebook-text overflow-hidden font-mono">
      <Navigation active={activeProject} onChange={setActiveProject} />

      <main className="flex-1 min-h-0">
        <NotebookLayout project={currentProject}>
          <Suspense fallback={<ProjectLoader />}>
            {activeProject === 'request-flow'  && <RequestFlowProject />}
            {activeProject === 'k8s-lifecycle' && <K8sPodLifecycle />}
            {activeProject === 'raft-election' && <LeaderElectionProject />}
          </Suspense>
        </NotebookLayout>
      </main>
    </div>
  );
}
