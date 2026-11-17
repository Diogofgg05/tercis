import { CATALOG } from '../catalog';
import type { CatalogItem } from '../types';
import { supabase } from './supabase';

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
  is_custom: false,
}));

export async function loadOrganizationCatalog(): Promise<{
  items: CatalogItem[]; truncated: boolean;
}> {
  // A single authenticated source of truth for the Catalog screen and editor.
  // RLS controls which organization and which staff may access purchase prices.
  const {data,error,count}=await supabase.from('custom_catalog_items')
    .select('id,code,description,reference,brand,category,sector,unit,unit_cost,supplier',{
      count:'exact',
    })
    .eq('active',true)
    .order('code')
    .range(0,499);
  if(error) throw error;
  return {
    items:(data||[]).map(item=>({
      ...item,unit_cost:item.unit_cost??0,is_custom:true,
    })) as CatalogItem[],
    truncated:typeof count==='number' && count>500,
  };
}
