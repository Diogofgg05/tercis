import { useState } from 'react';
import { Check, ChevronRight, Info, LockKeyhole, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ROLE_PERMISSIONS, STATUS_FLOW, STATUS_LABELS } from '../domain/workflow';
import { StatusBadge } from '../components/StatusBadge';
import type { Permission, UserRole, BudgetStatus } from '../types';

const roles: {id:UserRole;title:string;description:string}[] = [
  {id:'app_admin',title:'Administração da plataforma',description:'Gere todas as empresas e contas. Abre os espaços de trabalho com autenticação de dois fatores e registo das mudanças de empresa.'},
  {id:'company_admin',title:'Administração da empresa',description:'Gere utilizadores, clientes, catálogo, orçamentos e configurações da sua organização.'},
  {id:'admin',title:'Administrador legado',description:'Papel antigo com privilégios amplos. Deve ser migrado para uma função com organização definida.'},
  {id:'collaborator',title:'Colaborador',description:'Cria, edita e submete orçamentos atribuídos, sem os aprovar nem gerir contas por defeito.'},
  {id:'client',title:'Cliente',description:'Consulta os orçamentos autorizados e pode responder às propostas enviadas, sem editar preços ou margens.'},
];
const permissions: {id:Permission;label:string}[] = [
  {id:'manage_platform',label:'Administrar plataforma'},
  {id:'manage_company',label:'Gerir empresa'},
  {id:'manage_users',label:'Gerir utilizadores'},
  {id:'manage_clients',label:'Gerir clientes'},
  {id:'manage_catalog',label:'Gerir catálogo'},
  {id:'manage_settings',label:'Alterar definições'},
  {id:'create_budgets',label:'Criar e editar orçamentos'},
  {id:'submit_budgets',label:'Submeter para aprovação'},
  {id:'approve_budgets',label:'Aprovar/rejeitar'},
  {id:'send_budgets',label:'Enviar ao cliente'},
  {id:'view_reports',label:'Consultar relatórios'},
  {id:'manage_attachments',label:'Gerir anexos'},
];
const lifecycle: BudgetStatus[] = [
  'rascunho','pendente_aprovacao','em_analise_tecnica','aprovado','enviado',
  'aceite','em_execucao','concluido',
];

export function AccessView() {
  const {profile,demoMode} = useAuth();
  const [selectedRole,setSelectedRole] = useState<UserRole>(profile?.platform_admin?'app_admin':profile?.role ?? 'company_admin');
  const [selectedStatus,setSelectedStatus] = useState<BudgetStatus>('rascunho');
  const activeRole=roles.find(role=>role.id===selectedRole) ?? roles[1];
  return <div className="tercis-page space-y-5">
    <header className="tercis-head">
      <div><div className="tercis-eyebrow">Tercis / Segurança</div>
        <h1 className="tercis-title">Perfis e permissões</h1>
        <p className="tercis-subtitle">Quem pode consultar, criar, aprovar e gerir informação.</p>
      </div>
      <div className="tercis-badge bg-blue-50 text-blue-700 border border-blue-100 inline-flex items-center gap-2"><ShieldCheck size={14}/> Política de base</div>
    </header>

    <div className="tercis-note flex gap-3 items-start">
      <Info size={17} className="shrink-0 mt-0.5"/>
      <div><strong>Regra fundamental:</strong> os controlos desta página mostram a política prevista na aplicação.
        A autorização real depende também das políticas RLS do PostgreSQL.
        Os dados comerciais passam a estar associados a uma organização proprietária, distinta da empresa cliente. A migração exige validação num Supabase de testes antes da entrada em produção.
        {demoMode && ' Nesta sessão os dados são de demonstração.'}
      </div>
    </div>

    <section aria-label="Escolher papel para consultar permissões">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div><h2 className="tercis-card-title">Papéis de utilizador</h2>
          <p className="text-[11px] text-slate-500 mt-1">Selecione um papel para consultar as capacidades e o fluxo de trabalho.</p></div>
      </div>
      <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {roles.map(role=><button type="button" key={role.id}
          onClick={()=>setSelectedRole(role.id)} aria-pressed={selectedRole===role.id}
          className={'tercis-card tercis-workspace-interactive p-4 text-left flex flex-col gap-2 min-h-[145px] '+(selectedRole===role.id?'ring-2 ring-blue-300 bg-blue-50/40':'')}>
          <div className="flex items-center justify-between gap-2">
            <strong className="text-xs text-slate-900">{role.title}</strong>
            {profile?.role===role.id && <span className="tercis-badge bg-blue-50 text-blue-700">O teu papel</span>}
          </div>
          <p className="text-[12px] leading-5 text-slate-600 flex-1">{role.description}</p>
          <span className="text-[11px] text-blue-700 font-semibold inline-flex items-center gap-1">
            {ROLE_PERMISSIONS[role.id].length} capacidades <ChevronRight size={14}/>
          </span>
        </button>)}
      </div>
      <div className="md:hidden tercis-card p-3">
        <label htmlFor="access-role" className="tercis-form-label">Papel a consultar</label>
        <select id="access-role" className="tercis-input mt-2" value={selectedRole}
          onChange={event=>setSelectedRole(event.target.value as UserRole)}>
          {roles.map(role=><option key={role.id} value={role.id}>{role.title}</option>)}
        </select>
        <p className="text-xs text-slate-600 mt-3 leading-5">{activeRole.description}</p>
      </div>
    </section>

    <section className="tercis-card overflow-hidden">
      <div className="tercis-card-header"><h2 className="tercis-card-title">Matriz de permissões de base</h2>
        <p className="text-xs text-slate-500 mt-1">Permissões individuais podem ser adicionais; contas inativas não têm acesso.</p>
      </div>
      <div className="md:hidden p-4">
        <p className="text-xs text-slate-600 mb-3">Papel selecionado: <strong>{activeRole.title}</strong></p>
        <div className="grid gap-2">
          {permissions.map(permission=>{
            const granted=ROLE_PERMISSIONS[selectedRole].includes(permission.id);
            return <div key={permission.id} className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-100 px-3 py-3">
              <span className={'w-7 h-7 shrink-0 rounded-lg grid place-items-center '+(granted?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-400')}>
                {granted?<Check size={15}/>:<X size={15}/>}
              </span>
              <span className="text-[12px] text-slate-700 flex-1">{permission.label}</span>
              <span className={'text-[10px] font-semibold '+(granted?'text-emerald-700':'text-slate-500')}>
                {granted?'Permitido':'Não permitido'}
              </span>
            </div>;
          })}
        </div>
      </div>
      <div className="hidden md:block overflow-x-auto">
        <table className="tercis-table min-w-[860px]">
          <thead><tr><th scope="col" className="min-w-[230px]">Funcionalidade</th>
            {roles.map(role=><th scope="col" key={role.id}
              className={'text-center '+(role.id===selectedRole?'bg-blue-50 text-blue-700':'')}>
              {role.id==='admin'?'Admin legado':role.title}
            </th>)}</tr></thead>
          <tbody>{permissions.map(perm=><tr key={perm.id}>
            <th scope="row" className="font-medium text-slate-700 text-left">{perm.label}</th>
            {roles.map(role=><td key={role.id} className={'text-center '+(role.id===selectedRole?'bg-blue-50/40':'')}>
              {ROLE_PERMISSIONS[role.id].includes(perm.id)
                ? <Check size={17} className="text-emerald-600 mx-auto" aria-label="Permitido"/>
                : <span className="text-slate-300" aria-label="Não permitido">—</span>}
            </td>)}
          </tr>)}</tbody>
        </table>
      </div>
    </section>

    <section className="tercis-card overflow-hidden">
      <div className="tercis-card-header"><h2 className="tercis-card-title">Ciclo de vida dos orçamentos</h2>
        <p className="text-xs text-slate-500 mt-1">Os estados mudam por transições válidas, não por atribuição livre.</p></div>
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Consultar estado do orçamento">
          {lifecycle.map(status=><button type="button" key={status}
            aria-pressed={status===selectedStatus} onClick={()=>setSelectedStatus(status)}
            className={'rounded-xl px-2 py-1.5 border transition-colors '+(status===selectedStatus?'border-blue-300 bg-blue-50':'border-slate-200 hover:border-blue-200 bg-white')}>
            <StatusBadge status={status} size="sm"/>
          </button>)}
        </div>
        <div className="rounded-xl bg-[#f5f9ff] border border-blue-100 p-3.5 mb-4">
          <p className="text-[11px] font-semibold text-blue-800">Próximas transições previstas</p>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <StatusBadge status={selectedStatus} size="sm"/>
            <ChevronRight size={15} className="text-slate-400"/>
            {STATUS_FLOW[selectedStatus].length
              ? STATUS_FLOW[selectedStatus].map(next=><StatusBadge key={next} status={next} size="sm"/>)
              : <span className="text-[11px] text-slate-600">Estado final</span>}
          </div>
          <p className="text-[10px] text-slate-500 mt-2">A transição efetiva depende da autorização do utilizador e das regras do servidor.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-3">
          {(Object.keys(STATUS_FLOW) as BudgetStatus[]).map(status=><div key={status}
            className="flex gap-3 items-start justify-between border-t border-slate-100 pt-3">
            <span className="text-xs font-semibold text-slate-800">{STATUS_LABELS[status]}</span>
            <span className="text-[11px] leading-5 text-slate-500 text-right max-w-[65%]">
              {(STATUS_FLOW[status].length ? STATUS_FLOW[status].map(next=>STATUS_LABELS[next]).join(' · ') : 'Estado final')}
            </span>
          </div>)}
        </div>
      </div>
    </section>

    <div className="tercis-note flex gap-2 items-start"><LockKeyhole size={16} className="shrink-0 mt-0.5"/>
      <span>Apenas administradores autorizados podem aprovar contas novas. Clientes só respondem a propostas enviadas e a equipa interna não deve alterar estados sem um evento validado.</span>
    </div>
  </div>;
}
