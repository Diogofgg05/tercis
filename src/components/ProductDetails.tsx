import { useEffect,useState } from 'react';
import { BookOpen,ExternalLink,FileText,Package,Pencil,Ruler,ShieldCheck } from 'lucide-react';
import { WorkspaceDialog } from './WorkspaceDialog';
import { formatCurrency } from '../calc';
import type { CatalogItem } from '../types';

export function ProductPhoto({item,large=false}:{item:CatalogItem;large?:boolean}){
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[item.image_url]);
 return <div className={large?'product-photo product-photo-large':'product-photo'}>
  {item.image_url&&!failed?<img loading="lazy" src={item.image_url} alt={item.image_caption||item.description} onError={()=>setFailed(true)}/>:<div className="product-photo-fallback"><Package size={large?58:25}/>{large&&<span>Fotografia ainda não disponível</span>}</div>}
 </div>;
}

export function ProductDetails({item,onClose,onEdit}:{item:CatalogItem|null;onClose:()=>void;onEdit?:(item:CatalogItem)=>void}){
 const [tab,setTab]=useState<'overview'|'specs'|'documents'>('overview');
 useEffect(()=>setTab('overview'),[item?.id]);
 return <WorkspaceDialog open={Boolean(item)} onClose={onClose} title={item?.reference||'Informação do componente'} description={item?.brand?`${item.brand} · ${item.category}`:undefined} size="xl" footer={<><button className="tercis-button tercis-button-neutral" onClick={onClose}>Fechar ficha</button>{item&&onEdit&&<button className="tercis-button tercis-button-primary" onClick={()=>onEdit(item)}><Pencil size={16}/> Editar artigo e custo</button>}</>}>
  {item&&<div className="product-details"><div className="product-visual"><ProductPhoto item={item} large/><p>{item.image_caption||'Confirma a configuração e os detalhes na documentação do fabricante.'}</p><div className="product-brand-wordmark">{item.brand}</div></div>
   <section className="product-information"><span className="product-category">{item.category||'Componente'}</span><h3>{item.description}</h3><div className="product-codes"><span>Referência <strong>{item.reference||'—'}</strong></span><span>Código interno <strong>{item.code}</strong></span></div>
    <div className="product-detail-tabs" role="group" aria-label="Informação do componente">{([['overview','Visão geral',Package],['specs','Características',Ruler],['documents','Documentos',FileText]] as const).map(([value,label,Icon])=><button key={value} aria-pressed={tab===value} onClick={()=>setTab(value)}><Icon size={15}/>{label}</button>)}</div>
    {tab==='overview'&&<div className="product-detail-section"><div className="product-info-grid"><div><span>Fabricante</span><strong>{item.brand||'Não indicado'}</strong></div><div><span>Unidade</span><strong>{item.unit||'un'}</strong></div><div><span>Aplicação</span><strong>{item.sector||'Não indicada'}</strong></div><div><span>Fornecedor de compra</span><strong>{item.supplier||'Por associar'}</strong></div></div><div className="product-cost-box"><span>Custo de compra</span><strong>{item.price_pending?'Por confirmar':formatCurrency(item.unit_cost)}</strong><p>{item.price_pending?'Introduz o custo validado da tua empresa antes de usar este componente numa proposta.':'Valor interno da organização, sem margem comercial.'}</p></div></div>}
    {tab==='specs'&&<div className="product-detail-section"><dl className="product-specification-list">{Object.entries(item.specifications||{}).length?Object.entries(item.specifications||{}).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>):<p className="text-sm text-slate-500 leading-7">Consulta a ficha do fabricante para as características completas desta referência.</p>}</dl><p className="product-spec-note"><ShieldCheck size={16}/> Confirma a variante, a compatibilidade e as condições de utilização na documentação oficial.</p></div>}
    {tab==='documents'&&<div className="product-detail-section">{item.source_url&&/^https:\/\//i.test(item.source_url)?<a className="product-document" href={item.source_url} target="_blank" rel="noopener noreferrer"><span><BookOpen size={24}/></span><div><strong>Documentação do fabricante</strong><small>Referência, características e informação técnica</small></div><ExternalLink size={17}/></a>:<p className="text-sm text-slate-500">Ainda não foi associada documentação a este artigo.</p>}</div>}
   </section>
  </div>}
 </WorkspaceDialog>;
}
