import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Layers, X } from 'lucide-react';

const openDialogs:HTMLDivElement[]=[];
let bodyOverflow='';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  busy?: boolean;
}
const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' };

/** Consistent, accessible modal with focus containment and scroll locking. */
export function WorkspaceDialog({
  open, onClose, title, description, children, footer, size = 'md', busy = false,
}: Props) {
  const headingId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const busyRef=useRef(busy);busyRef.current=busy;
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const formerFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if(openDialogs.length===0)bodyOverflow=document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = dialogRef.current;
    if(dialog)openDialogs.push(dialog);
    (dialog?.querySelector<HTMLElement>('[data-autofocus]') ?? dialog)?.focus();

    function keyDown(event: KeyboardEvent) {
      if(openDialogs[openDialogs.length-1]!==dialog||document.querySelector('.call-overlay'))return;
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!busyRef.current) closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      )).filter(el => el.getClientRects().length > 0);
      if (!focusables.length) { event.preventDefault(); dialog.focus(); return; }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }
    document.addEventListener('keydown', keyDown);
    return () => {
      document.removeEventListener('keydown', keyDown);
      if(dialog){const index=openDialogs.indexOf(dialog);if(index>=0)openDialogs.splice(index,1);}
      if(openDialogs.length===0)document.body.style.overflow = bodyOverflow;
      if(formerFocus?.isConnected)formerFocus.focus();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="tercis-modal-overlay" onMouseDown={event => {
      if (!busy && event.target === event.currentTarget) closeRef.current();
    }}>
      <div ref={dialogRef} role="dialog" aria-modal="true"
        aria-labelledby={headingId} aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`tercis-modal-panel ${sizes[size]}`}>
        <div className="tercis-modal-header">
          <span className="tercis-dialog-mark" aria-hidden="true"><Layers size={21}/></span>
          <div className="min-w-0 flex-1">
            <span className="tercis-dialog-eyebrow">TERCIS / ESPAÇO DE TRABALHO</span>
            <h2 id={headingId} className="text-[17px] font-bold tracking-tight text-slate-900">{title}</h2>
            {description && <p id={descriptionId} className="text-xs text-slate-500 mt-1 leading-5">{description}</p>}
          </div>
          <button type="button" onClick={() => closeRef.current()} disabled={busy}
            aria-label="Fechar janela" className="tercis-modal-close"><X size={19}/></button>
        </div>
        <div className="tercis-modal-body">{children}</div>
        {footer && <div className="tercis-modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
