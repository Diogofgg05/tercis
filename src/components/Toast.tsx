import { useEffect } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';

export type ToastType='success'|'error'|'info';
interface Props { message:string;type:ToastType;onDismiss:()=>void }
const CFG={
  success:{ icon:CheckCircle2, style:'border-emerald-200 bg-white text-emerald-700' },
  error:{ icon:XCircle, style:'border-rose-200 bg-white text-rose-700' },
  info:{ icon:Info, style:'border-blue-200 bg-white text-blue-700' },
};

export function Toast({message,type,onDismiss}:Props){
  useEffect(()=>{
    const timer=window.setTimeout(onDismiss,type==='error'?7000:4500);
    return ()=>window.clearTimeout(timer);
  },[message,type,onDismiss]);
  const {icon:Icon,style}=CFG[type];
  return <div role={type==='error'?'alert':'status'} aria-live={type==='error'?'assertive':'polite'}
    className={`tercis-toast fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-[210] w-auto sm:w-[390px] max-w-full rounded-[14px] border p-3 shadow-[0_14px_45px_rgba(15,23,42,.16)] flex items-start gap-3 animate-slide-up ${style}`}>
    <span className="grid place-items-center shrink-0 w-9 h-9 rounded-xl bg-slate-50"><Icon size={19}/></span>
    <p className="flex-1 text-[12px] font-medium leading-5 text-slate-800 pt-1.5">{message}</p>
    <button type="button" onClick={onDismiss}
      aria-label="Fechar notificação" title="Fechar notificação"
      className="grid place-items-center w-8 h-8 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100">
      <X size={17}/>
    </button>
  </div>;
}
