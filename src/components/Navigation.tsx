// ─── Notebook Tab Navigation ──────────────────────────────────────────────────

export type ProjectId = 'request-flow' | 'k8s-lifecycle' | 'raft-election';

export interface Project {
  id: ProjectId;
  title: string;
  subtitle: string;
  badge: string;
  color: string;
}

export const PROJECTS: Project[] = [
  {
    id: 'request-flow',
    title: 'Request Flow',
    subtitle: 'Microservice topology',
    badge: '01',
    color: '#4facfe',
  },
  {
    id: 'k8s-lifecycle',
    title: 'K8s Pod Lifecycle',
    subtitle: 'pending → running → terminated',
    badge: '02',
    color: '#a78bfa',
  },
  {
    id: 'raft-election',
    title: 'Leader Election',
    subtitle: 'Raft consensus protocol',
    badge: '03',
    color: '#ffd700',
  },
];

interface NavigationProps {
  active: ProjectId;
  onChange: (id: ProjectId) => void;
}

export default function Navigation({ active, onChange }: NavigationProps) {
  return (
    <nav className="flex items-stretch gap-0 border-b border-notebook-border bg-notebook-tab">
      {/* App branding */}
      <div className="flex items-center px-5 py-3 border-r border-notebook-border shrink-0">
        <div className="font-mono text-sm">
          <span className="text-notebook-accent font-bold">sys</span>
          <span className="text-notebook-text-muted">.design</span>
        </div>
        <div
          className="ml-2 w-1.5 h-1.5 rounded-full bg-notebook-accent animate-pulse"
          title="Simulator active"
        />
      </div>

      {/* Tabs */}
      {PROJECTS.map((project) => {
        const isActive = active === project.id;
        return (
          <button
            key={project.id}
            onClick={() => onChange(project.id)}
            className={`
              relative flex items-center gap-3 px-5 py-3 font-mono text-sm
              border-r border-notebook-border transition-all duration-150
              ${isActive
                ? 'bg-notebook-tab-active text-notebook-text'
                : 'text-notebook-text-muted hover:bg-notebook-surface hover:text-notebook-text'
              }
            `}
            style={{
              borderBottom: isActive ? `2px solid ${project.color}` : '2px solid transparent',
            }}
          >
            <span
              className="text-xs font-bold"
              style={{ color: isActive ? project.color : '#4a5568' }}
            >
              {project.badge}
            </span>
            <div className="text-left">
              <div className={`leading-tight ${isActive ? 'text-notebook-text' : 'text-notebook-text-muted'}`}>
                {project.title}
              </div>
              <div className="text-xs text-notebook-text-muted leading-tight hidden lg:block">
                {project.subtitle}
              </div>
            </div>
            {isActive && (
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ background: project.color }}
              />
            )}
          </button>
        );
      })}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Meta */}
      <div className="flex items-center px-4 text-xs font-mono text-notebook-text-muted border-l border-notebook-border shrink-0">
        Personal System Design Simulator
      </div>
    </nav>
  );
}
