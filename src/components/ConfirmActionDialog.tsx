import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { WorkspaceDialog } from './WorkspaceDialog';

/** Consistent confirmation; actions occur only after explicit user acceptance. */
export function ConfirmActionDialog({
  open,title,description,confirmLabel='Confirmar',onClose,onConfirm,busy=false,danger=false,children,
}:{
  open:boolean;title:string;description:string;confirmLabel?:string;onClose:()=>void;
  onConfirm:()=>void;busy?:boolean;danger?:boolean;children?:ReactNode;
}){
  return <WorkspaceDialog open={open} onClose={onClose} busy={busy} title={title}
    description={description} size="sm"
    footer={<>
      <button type="button" disabled={busy} onClick={onClose}
        className="tercis-button tercis-button-neutral">Cancelar</button>
      <button type="button" disabled={busy} onClick={onConfirm}
        className={danger
          ? 'tercis-button text-white bg-rose-700 hover:bg-rose-800'
          : 'tercis-button tercis-button-primary'}>
        {busy?'A processar…':confirmLabel}
      </button>
    </>}>
    <div className="flex gap-3 items-start pt-4 pb-2">
      <span className="tercis-attachment-icon shrink-0"><AlertTriangle size={20}/></span>
      <div className="text-xs leading-5 text-slate-600">{children || 'Confirme os dados antes de continuar.'}</div>
    </div>
  </WorkspaceDialog>;
}
