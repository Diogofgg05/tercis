import type { ReactNode } from 'react';

export function FormSection({
  title, description, children,
}: { title: string; description?: string; children: ReactNode }) {
  return <section className="tercis-form-section">
    <div className="mb-3">
      <h3 className="text-[13px] font-bold tracking-tight text-slate-900">{title}</h3>
      {description && <p className="text-[11px] leading-5 text-slate-500 mt-1">{description}</p>}
    </div>
    {children}
  </section>;
}

export function FormGrid({children}: {children: ReactNode}) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-4">{children}</div>;
}

export function FormField({
  label, hint, required, wide, children,
}: {label: string; hint?: string; required?: boolean; wide?: boolean; children: ReactNode}) {
  return <label className={`tercis-form-field ${wide ? 'sm:col-span-2' : ''}`}>
    <span className="tercis-form-label">{label}{required && <span className="ml-1 text-blue-700" aria-hidden="true">*</span>}</span>
    {children}
    {hint && <span className="tercis-form-hint">{hint}</span>}
  </label>;
}
