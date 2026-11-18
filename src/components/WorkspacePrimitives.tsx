import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

/** Shared empty-state presentation for all pages, with a real optional action. */
export function WorkspaceEmptyState({
  icon, title, description, action,
}: {
  icon?:ReactNode;
  title:string;
  description:string;
  action?:ReactNode;
}) {
  return <div className="tercis-workspace-empty" role="status">
    <div className="tercis-workspace-empty-icon">{icon ?? <Inbox size={23}/>}</div>
    <strong>{title}</strong>
    <p>{description}</p>
    {action && <div className="mt-2">{action}</div>}
  </div>;
}

export function WorkspaceFilterBar({
  children, count,
}: { children:ReactNode;count?:ReactNode }) {
  return <div className="tercis-filterbar">
    {children}
    {count != null && <span role="status" className="ml-auto text-[11px] text-slate-500 whitespace-nowrap">{count}</span>}
  </div>;
}

export function WorkspaceSection({
  title, subtitle, action, children,
}: {
  title:string;subtitle?:string;action?:ReactNode;children:ReactNode;
}) {
  return <section className="tercis-card tercis-workspace-panel overflow-hidden">
    <header className="tercis-card-header flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="tercis-card-title">{title}</h2>
        {subtitle && <p className="text-[11px] text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {action}
    </header>
    {children}
  </section>;
}
