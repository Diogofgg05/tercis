export type ImportedCatalogRow = {
  code:string;description:string;unit_cost:number;
  supplier:string;reference:string;brand:string;
  category:string;sector:string;unit:string;
};

// Parse CSV with quotes (including semicolons and embedded newlines) and
// require an explicit column header. No Excel formulas are evaluated.
function csvRows(source:string,separator:string):string[][] {
  const rows:string[][]=[];
  let fields:string[]=[];
  let value='';
  let quote=false;
  for(let i=0;i<source.length;i++){
    const char=source[i];
    if(char==='"'){
      if(quote && source[i+1]==='"'){value+='"';i++;}
      else if(!quote && value==='')quote=true;
      else if(quote)quote=false;
      else throw new Error('Aspas inválidas no ficheiro CSV.');
    }else if(char===separator && !quote){
      fields.push(value);value='';
    }else if((char==='\r'||char==='\n')&&!quote){
      fields.push(value);value='';
      if(fields.some(field=>field.trim()))rows.push(fields);
      fields=[];
      if(char==='\r'&&source[i+1]==='\n')i++;
    }else value+=char;
  }
  if(quote)throw new Error('Há aspas por fechar no ficheiro CSV.');
  fields.push(value);
  if(fields.some(field=>field.trim()))rows.push(fields);
  return rows;
}

const normalized=(value:string)=>value.trim().toLocaleLowerCase('pt-PT')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^a-z0-9]/g,'');
const headerNames:Record<keyof ImportedCatalogRow,string[]>={
  code:['code','codigo','sku'],
  description:['description','descricao','produto','nome'],
  unit_cost:['unitcost','custounitario','custo','precocompra'],
  supplier:['supplier','fornecedor'],
  reference:['reference','referencia'],
  brand:['brand','marca'],
  category:['category','categoria'],
  sector:['sector','setor'],
  unit:['unit','unidade'],
};

export function parseCatalogCsv(raw:string):ImportedCatalogRow[] {
  if(raw.length>512000)throw new Error('O CSV não pode exceder 500 KB.');
  const clean=raw.replace(/^\uFEFF/,'');
  const firstLine=clean.split(/\r?\n/,1)[0]||'';
  const separator=(firstLine.match(/;/g)||[]).length>=(firstLine.match(/,/g)||[]).length?';':',';
  const rows=csvRows(clean,separator);
  if(rows.length<2)throw new Error('O CSV precisa de cabeçalhos e pelo menos um artigo.');
  if(rows.length>101)throw new Error('Importe no máximo 100 artigos por ficheiro.');
  const headers=rows[0].map(normalized);
  const index=(key:keyof ImportedCatalogRow)=>{
    const options=headerNames[key];
    return headers.findIndex(value=>options.includes(value));
  };
  const codeIndex=index('code'),descriptionIndex=index('description'),costIndex=index('unit_cost');
  if(codeIndex<0||descriptionIndex<0||costIndex<0)
    throw new Error('Faltam as colunas obrigatórias: codigo, descricao, custo.');
  const read=(row:string[],key:keyof ImportedCatalogRow)=>{
    const i=index(key);
    return i<0?'':(row[i]||'').trim();
  };
  const seen=new Set<string>();
  return rows.slice(1).map((row,i)=>{
    const code=read(row,'code');
    const description=read(row,'description');
    const price=read(row,'unit_cost').replace(/[\s€]/g,'').replace(',','.');
    const cost=Number(price);
    if(!code||code.length>64||!description||description.length>500||
      !price||!Number.isFinite(cost)||cost<0||cost>9999999999||
      !/^\d+(?:\.\d{1,4})?$/.test(price))
      throw new Error('Linha '+(i+2)+': código, descrição ou custo inválido.');
    if(seen.has(code.toLocaleLowerCase('pt-PT')))
      throw new Error('Linha '+(i+2)+': código duplicado no CSV.');
    seen.add(code.toLocaleLowerCase('pt-PT'));
    return {
      code,description,unit_cost:cost,
      supplier:read(row,'supplier'),reference:read(row,'reference'),
      brand:read(row,'brand'),category:read(row,'category'),
      sector:read(row,'sector'),unit:read(row,'unit')||'un',
    };
  });
}
