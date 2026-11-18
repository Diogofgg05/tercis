import type { Budget, CalculatedItem } from './types';
import { calcItem, grandTotal, roundCurrency, totalWithTax as calculateTotalWithTax } from './calc';

function esc(s: string): string {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  aprovado: 'Aprovado',
  pendente_aprovacao: 'Pendente de aprovação',
  em_analise_tecnica: 'Em análise técnica',
  aceite: 'Aceite',
  pedido_alteracoes: 'Pedido de alterações',
  expirado: 'Expirado',
  rejeitado: 'Rejeitado',
  em_execucao: 'Em Execução',
  concluido: 'Concluído',
};

const STATUS_COLORS: Record<string, string> = {
  rascunho: '#94a3b8',
  enviado: '#3b82f6',
  aprovado: '#22c55e',
  pendente_aprovacao: '#f59e0b',
  em_analise_tecnica: '#3b82f6',
  aceite: '#16a34a',
  pedido_alteracoes: '#f59e0b',
  expirado: '#64748b',
  rejeitado: '#ef4444',
  em_execucao: '#f59e0b',
  concluido: '#06b6d4',
};

/** Client-safe by default. Internal cost reports require an explicit opt-in. */
export function exportToPDF(budget: Budget, options: { internal?: boolean } = {}): void {
  try {
    // Verificação robusta
    if (!budget) {
      throw new Error('Budget não fornecido');
    }

    // Garantir que items existe
    const itemsList = budget.items || [];
    
    // Calcular itens
    const items: CalculatedItem[] = itemsList.map(calcItem);
    const showInternal = options.internal === true;
    const total = grandTotal(items);
    const totalWithTax = calculateTotalWithTax(budget, items);
    const taxAmount = budget.include_tax ? roundCurrency(totalWithTax - total) : 0;
    
    // Formatar datas com verificação
    let dateStr = 'Data não definida';
    let validStr = 'Data não definida';
    
    try {
      if (budget.date) {
        const date = new Date(budget.date);
        if (!isNaN(date.getTime())) {
          dateStr = date.toLocaleDateString('pt-PT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
        }
      }
    } catch (e) {
      console.warn('Erro ao formatar data de emissão:', e);
    }
    
    try {
      if (budget.valid_until) {
        const valid = new Date(budget.valid_until);
        if (!isNaN(valid.getTime())) {
          validStr = valid.toLocaleDateString('pt-PT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
        }
      }
    } catch (e) {
      console.warn('Erro ao formatar data de validade:', e);
    }

    // Typed commercial fields are preferable to unvalidated legacy aliases.
    // Never treat an assigned_to UUID as an object containing personal data.
    const companyName = budget.company?.name || '—';
    const assigneeName = budget.assignee?.full_name || 'Não atribuído';

    // The standard PDF is meant for clients. Never leak cost, markup, discounts
    // or internal notes through a commercial quote by default.
    const rows = items.length > 0 ? items.map((item, i) => `
      <tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}">
        <td class="code">${esc(item.code || '')}</td>
        <td>
          <div class="desc">${esc(item.description || '')}</div>
          ${showInternal && item.notes ? `<div class="notes">${esc(item.notes)}</div>` : ''}
        </td>
        <td class="sm">${esc(item.reference || '—')}</td>
        <td class="sm">${esc(item.brand || '—')}</td>
        <td class="r">${item.quantity ?? 0}</td>
        ${showInternal ? `
          <td class="r">${(item.unit_cost ?? 0).toFixed(2)} €</td>
          <td class="r">${(item.margin ?? 0).toFixed(1)}%</td>
          <td class="r">${(item.pvp ?? 0).toFixed(2)} €</td>
          <td class="r">${(item.discount ?? 0).toFixed(1)}%</td>
        ` : ''}
        <td class="r">${(item.finalPrice ?? 0).toFixed(2)} €</td>
        <td class="r bold">${(item.totalPrice ?? 0).toFixed(2)} €</td>
      </tr>`).join('') : '';

    const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(budget.ref || 'Orçamento')}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    @page {
      margin: 15mm 10mm;
      size: A4 portrait;
    }
    
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
      font-size: 9px;
      color: #1e293b;
      background: #ffffff;
      padding: 0;
      line-height: 1.4;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .container {
      max-width: 100%;
      margin: 0 auto;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 2px solid #1e293b;
    }

    .brand h1 {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.5px;
      margin: 0;
    }

    .brand .subtitle {
      font-size: 8px;
      color: #94a3b8;
      margin-top: 3px;
      font-weight: 400;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    .meta {
      text-align: right;
      flex-shrink: 0;
    }

    .meta .ref {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.3px;
    }

    .meta .dates {
      font-size: 8px;
      color: #64748b;
      margin-top: 3px;
    }

    .meta .dates strong {
      color: #0f172a;
      font-weight: 600;
    }

    .status-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 7px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 5px;
      background: ${STATUS_COLORS[budget.status] || '#94a3b8'}15;
      color: ${STATUS_COLORS[budget.status] || '#94a3b8'};
      border: 1px solid ${STATUS_COLORS[budget.status] || '#94a3b8'}30;
    }

    .meta .sector {
      margin-top: 3px;
      font-size: 7px;
      color: #94a3b8;
    }

    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr;
      gap: 12px;
      margin-bottom: 18px;
      padding: 12px 0;
      border-bottom: 1px solid #e2e8f0;
    }

    .info-item .label {
      font-size: 6.5px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #94a3b8;
      display: block;
      margin-bottom: 2px;
      font-weight: 600;
    }

    .info-item .value {
      font-size: 10px;
      font-weight: 600;
      color: #0f172a;
      display: block;
    }

    .info-item .value.small {
      font-size: 9px;
    }

    .notes-section {
      background: #f8fafc;
      border-left: 3px solid #94a3b8;
      padding: 8px 12px;
      margin-bottom: 16px;
      font-size: 8.5px;
      color: #475569;
      border-radius: 0 4px 4px 0;
    }

    .notes-section .notes-label {
      font-size: 6.5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #94a3b8;
      font-weight: 600;
      display: block;
      margin-bottom: 2px;
    }

    .table-wrapper {
      overflow-x: auto;
      margin-bottom: 18px;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8px;
    }

    thead {
      background: #0f172a;
      border-bottom: 2px solid #1e293b;
    }

    thead th {
      color: #ffffff;
      padding: 6px 8px;
      text-align: left;
      font-size: 6.5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
      white-space: nowrap;
    }

    thead th.r {
      text-align: right;
    }

    tbody td {
      padding: 5px 8px;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
      vertical-align: middle;
    }

    .row-even td {
      background: #ffffff;
    }

    .row-odd td {
      background: #f8fafc;
    }

    td.code {
      font-family: 'Courier New', monospace;
      font-weight: 600;
      color: #1e293b;
      font-size: 7.5px;
    }

    td .desc {
      font-weight: 500;
      color: #0f172a;
    }

    td .notes {
      font-size: 6.5px;
      color: #94a3b8;
      margin-top: 1px;
      font-style: italic;
    }

    td.sm {
      color: #94a3b8;
      font-size: 7px;
    }

    td.r {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    td.bold {
      font-weight: 700;
      color: #0f172a;
    }

    .totals {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 18px;
      padding-top: 12px;
      border-top: 2px solid #e2e8f0;
    }

    .totals-table {
      width: 240px;
      border-collapse: collapse;
    }

    .totals-table td {
      padding: 4px 0;
      font-size: 9px;
    }

    .totals-table .label {
      color: #64748b;
      font-weight: 500;
    }

    .totals-table .value {
      text-align: right;
      font-weight: 600;
      color: #0f172a;
    }

    .totals-table .subtotal td {
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
    }

    .totals-table .tax td {
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
    }

    .totals-table .total td {
      padding-top: 8px;
      font-size: 11px;
      font-weight: 700;
      color: #0f172a;
    }

    .totals-table .total .value {
      font-size: 12px;
      font-weight: 800;
      color: #0f172a;
    }

    .footer {
      text-align: center;
      font-size: 7px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
      margin-top: 6px;
      line-height: 1.6;
    }

    .footer .legal {
      margin-top: 3px;
      font-size: 6.5px;
      color: #cbd5e1;
    }

    @media print {
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
      }
      
      body {
        padding: 0;
      }

      .container {
        padding: 0;
      }

      .header {
        margin-bottom: 15px;
        padding-bottom: 12px;
      }

      .info-grid {
        gap: 10px;
        margin-bottom: 14px;
        padding: 10px 0;
      }

      .table-wrapper {
        margin-bottom: 14px;
      }

      .totals {
        margin-bottom: 14px;
        padding-top: 10px;
      }

      .footer {
        padding-top: 8px;
        margin-top: 4px;
      }

      .row-even td,
      .row-odd td {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      thead {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .status-badge {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .notes-section {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }

    @media print and (orientation: landscape) {
      @page {
        size: A4 landscape;
        margin: 12mm 8mm;
      }
      
      body {
        font-size: 8.5px;
      }

      .brand h1 {
        font-size: 18px;
      }

      .meta .ref {
        font-size: 14px;
      }

      .info-grid {
        grid-template-columns: 1fr 1fr 1fr 1fr;
        gap: 10px;
      }

      table {
        font-size: 7.5px;
      }

      thead th {
        font-size: 6px;
        padding: 5px 6px;
      }

      tbody td {
        padding: 4px 6px;
      }

      .totals-table {
        width: 200px;
      }
    }

    @media screen and (max-width: 768px) {
      body {
        padding: 16px;
      }
      
      .header {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
      }
      
      .meta {
        text-align: left;
      }
      
      .info-grid {
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }

      .totals-table {
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">
        <h1>${showInternal ? 'ORÇAMENTO INTERNO' : 'ORÇAMENTO'}</h1>
        <div class="subtitle">Sistema de Gestão de Orçamentos</div>
      </div>
      <div class="meta">
        <div class="ref">${esc(budget.ref || 'N/A')}</div>
        <div class="dates">
          ${dateStr} &nbsp;·&nbsp; Válido até ${validStr}
        </div>
        <span class="status-badge">${esc(STATUS_LABELS[budget.status] ?? budget.status ?? 'Rascunho')}</span>
        ${budget.sector ? `<div class="sector">${esc(budget.sector)}</div>` : ''}
      </div>
    </div>

    <div class="info-grid">
      <div class="info-item">
        <span class="label">Designação</span>
        <span class="value">${esc(budget.name || '—')}</span>
      </div>
      <div class="info-item">
        <span class="label">Cliente</span>
        <span class="value">${esc(companyName)}</span>
      </div>
      <div class="info-item">
        <span class="label">Contacto</span>
        <span class="value small">${esc(budget.client_contact || budget.client_email || '—')}</span>
      </div>
      <div class="info-item">
        <span class="label">Responsável</span>
        <span class="value small">${esc(assigneeName)}</span>
      </div>
    </div>

    ${showInternal && budget.notes ? `
      <div class="notes-section">
        <span class="notes-label">Observações</span>
        ${esc(budget.notes)}
      </div>
    ` : ''}

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Descrição</th>
            <th>Referência</th>
            <th>Marca</th>
            <th class="r">Qtd</th>
            ${showInternal ? `<th class="r">Custo Un.</th><th class="r">Acréscimo</th><th class="r">PVP</th><th class="r">Desc.</th>` : ''}
            <th class="r">Preço Un.</th>
            <th class="r">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="${showInternal ? 11 : 7}" style="text-align:center;padding:20px;color:#94a3b8;">Nenhum item adicionado</td></tr>`}
        </tbody>
      </table>
    </div>

    <div class="totals">
      <table class="totals-table">
        <tr class="subtotal">
          <td class="label">Subtotal</td>
          <td class="value">${(total || 0).toFixed(2)} €</td>
        </tr>
        ${budget.include_tax ? `
          <tr class="tax">
            <td class="label">IVA (${budget.tax_rate || 0}%)</td>
            <td class="value">${(taxAmount || 0).toFixed(2)} €</td>
          </tr>
        ` : ''}
        <tr class="total">
          <td class="label">TOTAL ${budget.include_tax ? 'COM IVA' : ''}</td>
          <td class="value">${(totalWithTax || 0).toFixed(2)} €</td>
        </tr>
      </table>
    </div>

    <div class="footer">
      <div>Gerado em ${new Date().toLocaleString('pt-PT')}</div>
      <div class="legal">Válido até ${esc(validStr)} · Não constitui fatura · Sujeito a confirmação</div>
    </div>
  </div>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) {
      throw new Error('Não foi possível abrir a janela para exportação');
    }
    
    win.document.write(html);
    win.document.close();
    win.focus();
    
    setTimeout(() => {
      win.print();
    }, 600);
    
  } catch (error) {
    console.error('Erro detalhado ao gerar PDF:', error);
    throw error;
  }
}