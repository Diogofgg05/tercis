import type { BudgetStatus } from '../types';
import { STATUS_LABELS as canonicalLabels } from '../domain/workflow';

const tones: Record<BudgetStatus, string> = {
  rascunho: 'bg-slate-100 text-slate-600 border-slate-200',
  pendente_aprovacao: 'bg-amber-50 text-amber-800 border-amber-200',
  em_analise_tecnica: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  aprovado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  enviado: 'bg-sky-50 text-sky-700 border-sky-200',
  rejeitado: 'bg-rose-50 text-rose-700 border-rose-200',
  pedido_alteracoes: 'bg-orange-50 text-orange-800 border-orange-200',
  em_execucao: 'bg-blue-50 text-blue-800 border-blue-200',
  aceite: 'bg-teal-50 text-teal-800 border-teal-200',
  expirado: 'bg-slate-100 text-slate-600 border-slate-200',
  concluido: 'bg-emerald-50 text-emerald-800 border-emerald-200',
};

export const STATUS_LABELS = canonicalLabels;
export const ALL_STATUSES = Object.keys(tones) as BudgetStatus[];

export function StatusBadge({status,size='md'}:{status:BudgetStatus;size?:'sm'|'md'}) {
  return <span className={'inline-flex items-center rounded-full border font-semibold whitespace-nowrap ' +
    (size==='sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]') +
    ' ' + tones[status]}>{STATUS_LABELS[status] || status}</span>;
}
