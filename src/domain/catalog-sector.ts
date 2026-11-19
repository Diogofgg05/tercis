export function catalogSector(value:string):string{
 const key=value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 return ({eletricidade:'Eletricidade',iluminacao:'Iluminação',automacao:'Automação'} as Record<string,string>)[key]||value;
}
