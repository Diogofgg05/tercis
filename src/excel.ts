import type { Budget, CalculatedItem } from './types';
import { calcItem, grandTotal } from './calc';

// Escape every XML text node, including headers/titles. Raw customer fields
// must never be able to break the SpreadsheetML document.
function xmlText(value: string | number | undefined): string {
  return Array.from(String(value ?? ''))
    .filter(char => {
      const code = char.charCodeAt(0);
      return code >= 32 || code === 9 || code === 10 || code === 13;
    })
    .join('')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function cell(v: string | number | undefined, t: 'String'|'Number' = 'String') {
  return `<Cell><Data ss:Type="${t}">${xmlText(v)}</Data></Cell>`;
}
function hdr(v: string) { return `<Cell ss:StyleID="h"><Data ss:Type="String">${xmlText(v)}</Data></Cell>`; }
function ttl(v: string|number, t: 'String'|'Number'='String') { return `<Cell ss:StyleID="t"><Data ss:Type="${t}">${xmlText(v)}</Data></Cell>`; }
function lbl(v: string) { return `<Cell ss:StyleID="l"><Data ss:Type="String">${xmlText(v)}</Data></Cell>`; }

function safeFilename(value: string): string {
  return Array.from(value)
    .map(char => char.charCodeAt(0) < 32 ? '_' : char)
    .join('')
    .replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_').slice(0, 80);
}
function dateLabel(value: string): string {
  const date = value ? new Date(value + (value.includes('T') ? '' : 'T12:00:00')) : null;
  return date && Number.isFinite(date.getTime()) ? date.toLocaleDateString('pt-PT') : '—';
}

/** Commercial export hides internal cost breakdowns unless explicitly requested. */
export function exportToExcel(budget: Budget, options: { internal?: boolean } = {}): void {
  const showInternal = options.internal === true;
  const items: CalculatedItem[] = (budget.items ?? []).map(calcItem);
  const total = grandTotal(items);
  const taxAmt = budget.include_tax ? total * (budget.tax_rate / 100) : 0;
  const totalFinal = total + taxAmt;
  const dateStr = dateLabel(budget.date);
  const validStr = dateLabel(budget.valid_until);
  const companyName = budget.company?.name ?? '';

  const dataRows = items.map((item, i) => `
    <Row>
      ${cell(i + 1, 'Number')}${cell(item.code)}${cell(item.description)}${cell(item.reference)}
      ${cell(item.brand)}${cell(item.category)}${cell(item.sector)}${cell(item.unit)}
      ${cell(item.quantity,'Number')}
      ${showInternal ? `
        ${cell(parseFloat((item.unit_cost ?? 0).toFixed(4)),'Number')}
        ${cell(parseFloat((item.margin ?? 0).toFixed(2)),'Number')}
        ${cell(parseFloat(item.pvp.toFixed(4)),'Number')}
        ${cell(parseFloat((item.discount ?? 0).toFixed(2)),'Number')}
      ` : ''}
      ${cell(parseFloat(item.finalPrice.toFixed(4)),'Number')}
      ${cell(parseFloat(item.subtotal.toFixed(2)),'Number')}
      ${showInternal ? cell(item.notes||'') : ''}
    </Row>`).join('');

  const catMap = new Map<string, number>();
  items.forEach(i => catMap.set(i.sector ?? 'Outros', (catMap.get(i.sector ?? 'Outros')??0)+i.subtotal));
  const catRows = Array.from(catMap.entries()).map(([cat,v]) => `<Row>${cell(cat)}${cell(parseFloat(v.toFixed(2)),'Number')}</Row>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
  <Style ss:ID="h"><Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="10"/><Interior ss:Color="#1E293B" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style>
  <Style ss:ID="t"><Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="11"/><Interior ss:Color="#1E40AF" ss:Pattern="Solid"/></Style>
  <Style ss:ID="l"><Font ss:Bold="1" ss:Color="#64748B"/></Style>
  <Style ss:ID="ti"><Font ss:Bold="1" ss:Size="16" ss:Color="#1E40AF"/></Style>
</Styles>
<Worksheet ss:Name="Orçamento">
<Table>
  <Column ss:Width="40"/><Column ss:Width="70"/><Column ss:Width="200"/><Column ss:Width="130"/>
  <Column ss:Width="110"/><Column ss:Width="95"/><Column ss:Width="110"/><Column ss:Width="40"/>
  <Column ss:Width="50"/><Column ss:Width="80"/><Column ss:Width="60"/><Column ss:Width="80"/>
  <Column ss:Width="60"/><Column ss:Width="80"/><Column ss:Width="90"/><Column ss:Width="160"/>
  <Row ss:Height="28"><Cell ss:StyleID="ti"><Data ss:Type="String">ORÇAMENTO ${xmlText(budget.ref)}</Data></Cell></Row>
  <Row>${lbl('Designação:')}${cell(budget.name)}</Row>
  <Row>${lbl('Cliente:')}${cell(companyName||'—')}</Row>
  <Row>${lbl('Setor:')}${cell(budget.sector||'—')}</Row>
  <Row>${lbl('Data:')}${cell(dateStr)}</Row>
  <Row>${lbl('Válido até:')}${cell(validStr)}</Row>
  ${budget.client_contact?`<Row>${lbl('Contacto:')}${cell(budget.client_contact)}</Row>`:''}
  ${showInternal && budget.notes?`<Row>${lbl('Observações internas:')}${cell(budget.notes)}</Row>`:''}
  <Row/>
  <Row ss:Height="20">
    ${hdr('#')}${hdr('Código')}${hdr('Descrição')}${hdr('Referência')}${hdr('Marca')}
    ${hdr('Categoria')}${hdr('Setor')}${hdr('Un.')}${hdr('Qtd.')}
    ${showInternal ? `${hdr('Custo Un. (€)')}${hdr('Acréscimo (%)')}${hdr('PVP (€)')}${hdr('Desc. (%)')}` : ''}
    ${hdr('Pr. Final (€)')}${hdr('Subtotal (€)')}${showInternal ? hdr('Notas internas') : ''}
  </Row>
  ${dataRows}
  <Row/>
  <Row><Cell ss:Index="${showInternal ? 14 : 10}">${lbl('Subtotal:')}</Cell>${cell(parseFloat(total.toFixed(2)),'Number')}</Row>
  ${budget.include_tax?`<Row><Cell ss:Index="${showInternal ? 14 : 10}">${lbl(`IVA ${budget.tax_rate}%:`)}</Cell>${cell(parseFloat(taxAmt.toFixed(2)),'Number')}</Row>`:''}
  <Row><Cell ss:Index="${showInternal ? 14 : 10}">${ttl('TOTAL:')}</Cell>${ttl(parseFloat(totalFinal.toFixed(2)),'Number')}</Row>
</Table></Worksheet>
<Worksheet ss:Name="Por Setor">
<Table>
  <Column ss:Width="180"/><Column ss:Width="120"/>
  <Row ss:Height="24"><Cell ss:StyleID="ti"><Data ss:Type="String">RESUMO POR SETOR</Data></Cell></Row>
  <Row>${lbl('Orçamento:')}${cell(budget.ref+' — '+budget.name)}</Row><Row/>
  <Row>${hdr('Setor')}${hdr('Subtotal (€)')}</Row>
  ${catRows}
  <Row/><Row>${ttl('TOTAL')}${ttl(parseFloat(total.toFixed(2)),'Number')}</Row>
</Table></Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFilename(budget.ref)}-${safeFilename(budget.name).slice(0,30)}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
