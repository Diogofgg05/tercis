import { CATALOG } from '../catalog';
import type { CatalogItem } from '../types';
import { supabase } from './supabase';
import { catalogSector } from '../domain/catalog-sector';

// The hardcoded catalog is for the OFFLINE DEMO ONLY. These figures are
// illustrative and must never be used as the organization's actual costs.
export const DEMO_REFERENCE_CATALOG: CatalogItem[] = CATALOG.map((item,index)=>({
  id: 'reference:' + index,
  code: item.code || 'REF-' + (index+1),
  description: item.description || '',
  reference: item.reference || '',
  brand: item.brand || '',
  category: item.category || 'Outros',
  sector: item.sector || '',
  unit: item.unit || 'un',
  unit_cost: item.unit_cost || 0,
  supplier: item.supplier || '',
  is_custom: false,
}));

export type CatalogPage = {items: CatalogItem[];total:number;page:number;pageSize:number};

export async function loadOrganizationCatalogPage({
  search='',category='',sector='',brand='',page=0,pageSize=25,
}: {
  search?:string;category?:string;sector?:string;brand?:string;page?:number;pageSize?:number;
} = {}): Promise<CatalogPage> {
  const {data,error}=await supabase.rpc('tercis_catalog_page_v2',{
    p_query:search.trim().slice(0,80),p_category:category,
    p_sector:catalogSector(sector),p_brand:brand,p_page:page,p_page_size:pageSize,
  });
  if(error)throw error;
  if(!data || !Array.isArray(data.items) ||
    typeof data.total!=='number' || !Number.isFinite(data.total))
    throw new Error('Resposta inválida ao pesquisar o catálogo comercial.');
  return {
    items:data.items.map((item:CatalogItem)=>({
      ...item,unit_cost:Number(item.unit_cost??0),is_custom:true,
    })),
    total:data.total,page:data.page,pageSize:data.page_size,
  };
}

export async function loadOrganizationCatalogCategories():Promise<string[]> {
  const {data,error}=await supabase.rpc('tercis_catalog_categories');
  if(error)throw error;
  return Array.isArray(data) ? data.filter((item):item is string=>typeof item==='string') : [];
}
