import {parseCatalogCsv,parseCatalogTable} from './catalogCsv';

export async function readCatalogImport(file:File){
  if(file.size>512000)throw new Error('O ficheiro não pode exceder 500 KB.');
  if(/\.xlsx$/i.test(file.name)){
    const {readSheet}=await import('read-excel-file/browser');
    // First sheet only, explicitly documented in the import interface.
    // Preserve decimal strings rather than silently losing purchase precision.
    const rows=await readSheet(file,1,{parseNumber:value=>value});
    return parseCatalogTable(rows);
  }
  if(!/\.csv$/i.test(file.name))throw new Error('Escolhe um ficheiro CSV ou Excel (.xlsx).');
  return parseCatalogCsv(await file.text());
}
