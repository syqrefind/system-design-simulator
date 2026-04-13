import type { ReactNode } from 'react';
import type { Project } from './Navigation';

interface NotebookLayoutProps {
  project: Project;
  children: ReactNode;
}

// ─── Notebook Page Layout ─────────────────────────────────────────────────────
// Each project lives inside a "notebook page" with a header and canvas area.

export default function NotebookLayout({ project, children }: NotebookLayoutProps) {
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Page header */}
      <div className="flex items-start justify-between px-6 py-4 border-b border-notebook-border shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <span
              className="text-xs font-mono font-bold px-2 py-0.5 rounded"
              style={{
                color: project.color,
                background: project.color + '20',
                border: `1px solid ${project.color}40`,
              }}
            >
              PROJECT {project.badge}
            </span>
            <h1 className="text-lg font-mono font-bold text-notebook-text">
              {project.title}
            </h1>
          </div>
          <p className="text-sm text-notebook-text-muted font-mono mt-1">
            {project.subtitle}
          </p>
        </div>

        {/* Layer indicators */}
        <div className="flex gap-2 text-xs font-mono">
          {[
            { label: 'L1', name: 'PixiJS',  color: '#4facfe' },
            { label: 'L2', name: 'Model',   color: '#48bb78' },
            { label: 'L3', name: 'GSAP',    color: '#ffd700' },
          ].map((layer) => (
            <div
              key={layer.label}
              className="flex items-center gap-1.5 px-2 py-1 rounded border"
              style={{
                borderColor: layer.color + '40',
                background: layer.color + '10',
              }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: layer.color }}
              />
              <span style={{ color: layer.color }}>{layer.label}</span>
              <span className="text-notebook-text-muted">{layer.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 min-h-0 p-4 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
