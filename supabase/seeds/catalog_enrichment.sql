-- Enrich only matching manufacturer references in Tercis. Preserve edited field values and all purchase costs.
WITH incoming AS (SELECT * FROM jsonb_to_recordset($details$[
  {
    "code": "HAGER-CDA240D",
    "reference": "CDA240D",
    "previous_specifications": {
      "Fabricante": "Hager",
      "Referência": "CDA240D",
      "Aplicação": "Eletricidade",
      "Configuração": "Interruptor diferencial · 1P+N · 40 A · 30 mA · tipo A"
    },
    "specifications": {
      "Fabricante": "Hager",
      "Referência": "CDA240D",
      "Aplicação": "Eletricidade",
      "Configuração": "Interruptor diferencial · 1P+N · 40 A · 30 mA · tipo A",
      "Polos": "1P+N (2 polos)",
      "Corrente nominal": "40 A",
      "Sensibilidade diferencial": "30 mA",
      "Tipo diferencial": "A",
      "Tensão de serviço": "230 V AC",
      "Frequência": "50 Hz",
      "Módulos DIN": "2",
      "Grau de proteção": "IP20",
      "Ligação": "Parafuso"
    },
    "previous_source_url": "https://assets.hager.com/step-content/P/PDS_158717055301HR/Document/std.lang.all/CDA240D_5301_hr-HR.pdf",
    "source_url": "https://assets.hager.com/step-content/P/PDS_158717055301HR/Document/std.lang.all/CDA240D_5301_hr-HR.pdf",
    "image_url": "/catalog/hager-cda240d.jpg",
    "image_caption": "Fotografia Hager CDA240D."
  },
  {
    "code": "HAGER-ESC225",
    "reference": "ESC225",
    "previous_specifications": {
      "Fabricante": "Hager",
      "Referência": "ESC225",
      "Aplicação": "Eletricidade",
      "Configuração": "Contactor modular · 25 A · 2 contactos NA · comando 230 V AC"
    },
    "specifications": {
      "Fabricante": "Hager",
      "Referência": "ESC225",
      "Aplicação": "Eletricidade",
      "Configuração": "Contactor modular · 25 A · 2 contactos NA · comando 230 V AC",
      "Contactos": "2 NA",
      "Corrente AC-1": "25 A",
      "Corrente AC-3": "8,5 A",
      "Comando": "230 V AC / 50 Hz",
      "Módulos DIN": "1",
      "Largura": "17,85 mm",
      "Altura": "83 mm",
      "Profundidade": "60 mm",
      "Temperatura de serviço": "−10 a +50 °C"
    },
    "previous_source_url": "https://assets.hager.com/step-content/P/PDS_159055416401EN/Document/std.lang.all/PDS_ESC225_6401_en-GB.pdf",
    "source_url": "https://assets.hager.com/step-content/P/PDS_159055416401EN/Document/std.lang.all/PDS_ESC225_6401_en-GB.pdf",
    "image_url": "/catalog/hager-esc225.jpg",
    "image_caption": "Fotografia Hager ESC225."
  },
  {
    "code": "NORD-SK500P",
    "reference": "SK 500P",
    "previous_specifications": {
      "Fabricante": "NORD",
      "Referência": "SK 500P",
      "Aplicação": "Automação",
      "Configuração": "NORDAC PRO SK 500P · família de variadores para armário · configuração a definir"
    },
    "specifications": {
      "Fabricante": "NORD",
      "Referência": "SK 500P",
      "Aplicação": "Automação",
      "Configuração": "NORDAC PRO SK 500P · família de variadores para armário · configuração a definir",
      "Montagem": "Armário elétrico",
      "Grau de proteção": "IP20",
      "Potência da família": "0,25–160 kW, conforme configuração",
      "Alimentação da família": "200–240 V monofásica ou 380–480 V trifásica, conforme variante",
      "Parametrização": "USB-C / NORDCON; módulo de operação opcional",
      "Configuração de compra": "Selecionar potência, alimentação e opções antes de encomendar"
    },
    "previous_source_url": "https://www.nord.com/de/produkte/antriebselektronik/frequenzumrichter-zur-schaltschrank-installation/nordac-pro-sk-500p-frequenzumrichter.jsp",
    "source_url": "https://www.nord.com/de/produkte/antriebselektronik/frequenzumrichter-zur-schaltschrank-installation/nordac-pro-sk-500p-frequenzumrichter.jsp",
    "image_url": "/catalog/nordac-pro-family.webp",
    "image_caption": "Imagem de família NORDAC PRO fornecida pelo fabricante; tamanho e opções dependem da configuração."
  },
  {
    "code": "SCH-LC1D09BD",
    "reference": "LC1D09BD",
    "previous_specifications": {
      "Fabricante": "Schneider Electric",
      "Referência": "LC1D09BD",
      "Aplicação": "Automação",
      "Configuração": "Contactor TeSys · 3 polos NA · 9 A AC-3 · bobina 24 V DC"
    },
    "specifications": {
      "Fabricante": "Schneider Electric",
      "Referência": "LC1D09BD",
      "Aplicação": "Automação",
      "Configuração": "Contactor TeSys · 3 polos NA · 9 A AC-3 · bobina 24 V DC",
      "Polos principais": "3 NA",
      "Corrente AC-3": "9 A",
      "Bobina": "24 V DC",
      "Família": "TeSys D"
    },
    "previous_source_url": "https://www.se.com/uk/en/product/LC1D09BD/tesys-d-contactor-3p3-no-ac3-440-v-9-a-24-v-dc-coil/",
    "source_url": "https://www.se.com/uk/en/product/LC1D09BD/tesys-d-contactor-3p3-no-ac3-440-v-9-a-24-v-dc-coil/",
    "image_url": "",
    "image_caption": ""
  },
  {
    "code": "SCH-LC1D12BD",
    "reference": "LC1D12BD",
    "previous_specifications": {
      "Fabricante": "Schneider Electric",
      "Referência": "LC1D12BD",
      "Aplicação": "Automação",
      "Configuração": "Contactor TeSys · 3 polos NA · 12 A AC-3 · bobina 24 V DC"
    },
    "specifications": {
      "Fabricante": "Schneider Electric",
      "Referência": "LC1D12BD",
      "Aplicação": "Automação",
      "Configuração": "Contactor TeSys · 3 polos NA · 12 A AC-3 · bobina 24 V DC",
      "Polos principais": "3 NA",
      "Corrente AC-3": "12 A",
      "Bobina": "24 V DC",
      "Família": "TeSys D"
    },
    "previous_source_url": "https://www.se.com/pt/pt/product/LC1D12BD/contactor-tesys-d-3p3-na-ac3-440-v-12-a-24-v-cc-bobina/",
    "source_url": "https://www.se.com/pt/pt/product/LC1D12BD/contactor-tesys-d-3p3-na-ac3-440-v-12-a-24-v-cc-bobina/",
    "image_url": "",
    "image_caption": ""
  },
  {
    "code": "SIE-6ES7214-1AG40-0XB0",
    "reference": "6ES7214-1AG40-0XB0",
    "previous_specifications": {
      "Fabricante": "Siemens",
      "Referência": "6ES7214-1AG40-0XB0",
      "Aplicação": "Automação",
      "Configuração": "PLC SIMATIC S7-1200 CPU 1214C · DC/DC/DC · 14 DI / 10 DO / 2 AI"
    },
    "specifications": {
      "Fabricante": "Siemens",
      "Referência": "6ES7214-1AG40-0XB0",
      "Aplicação": "Automação",
      "Configuração": "PLC SIMATIC S7-1200 CPU 1214C · DC/DC/DC · 14 DI / 10 DO / 2 AI",
      "Família": "SIMATIC S7-1200",
      "CPU": "1214C",
      "Alimentação / entradas / saídas": "DC / DC / DC",
      "Entradas digitais": "14",
      "Saídas digitais": "10",
      "Entradas analógicas": "2"
    },
    "previous_source_url": "https://sieportal.siemens.com/en-se/products-services/detail/6ES72141AG400XB0",
    "source_url": "https://sieportal.siemens.com/en-se/products-services/detail/6ES72141AG400XB0",
    "image_url": "",
    "image_caption": ""
  },
  {
    "code": "SIE-6EP1332-1SH71",
    "reference": "6EP1332-1SH71",
    "previous_specifications": {
      "Fabricante": "Siemens",
      "Referência": "6EP1332-1SH71",
      "Aplicação": "Automação",
      "Configuração": "Fonte SIMATIC PM1207 · entrada 120/230 V AC · saída 24 V DC / 2,5 A"
    },
    "specifications": {
      "Fabricante": "Siemens",
      "Referência": "6EP1332-1SH71",
      "Aplicação": "Automação",
      "Configuração": "Fonte SIMATIC PM1207 · entrada 120/230 V AC · saída 24 V DC / 2,5 A",
      "Família": "SIMATIC PM1207",
      "Entrada": "120/230 V AC",
      "Saída": "24 V DC",
      "Corrente de saída": "2,5 A"
    },
    "previous_source_url": "https://support.industry.siemens.com/teddatasheet/?caller=SIOS&format=pdf&language=en&mlfbs=6EP1332-1SH71",
    "source_url": "https://support.industry.siemens.com/teddatasheet/?caller=SIOS&format=pdf&language=en&mlfbs=6EP1332-1SH71",
    "image_url": "",
    "image_caption": ""
  },
  {
    "code": "EATON-276690",
    "reference": "276690",
    "previous_specifications": {
      "Modelo": "DILM9-10",
      "Bobina": "230 V AC / 50 Hz",
      "Função": "Comando de potência"
    },
    "specifications": {
      "Modelo": "DILM9-10",
      "Bobina": "230 V AC / 50 Hz",
      "Função": "Comando de potência",
      "Polos principais": "3 NA",
      "Contactos auxiliares": "1 NA",
      "Largura": "45 mm",
      "Altura": "68 mm",
      "Profundidade": "75 mm",
      "Ligação": "Bornes de parafuso",
      "Potência AC-3 a 400 V": "4 kW",
      "EAN": "4015082766900"
    },
    "previous_source_url": "https://www.eaton.com/content/dam/eaton/support/catalog/eaton-xpole-accessories-ca019015de-de-de.pdf",
    "source_url": "https://www.eaton.com/us/en-us/skuPage.276690.html",
    "image_url": "/catalog/eaton-276690.jpg",
    "image_caption": "Imagem fornecida pela Eaton para 276690; marcações da bobina podem variar."
  },
  {
    "code": "EATON-276845",
    "reference": "276845",
    "previous_specifications": {
      "Modelo": "DILM12-10",
      "Bobina": "24 V DC",
      "Função": "Comando de potência"
    },
    "specifications": {
      "Modelo": "DILM12-10",
      "Bobina": "24 V DC",
      "Função": "Comando de potência",
      "Polos principais": "3 NA",
      "Contactos auxiliares": "1 NA",
      "Largura": "45 mm",
      "Altura": "68 mm",
      "Profundidade": "75 mm",
      "Ligação": "Bornes de parafuso",
      "Potência AC-3 a 400 V": "5,5 kW",
      "EAN": "4015082768454"
    },
    "previous_source_url": "https://www.eaton.com/content/dam/eaton/support/catalog/eaton-xpole-accessories-ca019015de-de-de.pdf",
    "source_url": "https://www.eaton.com/us/en-us/skuPage.276845.html",
    "image_url": "/catalog/eaton-276845.jpg",
    "image_caption": "Imagem fornecida pela Eaton para 276845; marcações da bobina podem variar."
  },
  {
    "code": "MW-HDR-15-24",
    "reference": "HDR-15-24",
    "previous_specifications": {
      "Saída": "24 V DC",
      "Montagem": "Calha DIN"
    },
    "specifications": {
      "Saída": "24 V DC",
      "Montagem": "Calha DIN TS-35/7,5 ou TS-35/15",
      "Entrada AC": "85–264 V AC",
      "Largura": "17,5 mm",
      "Arrefecimento": "Convecção natural",
      "Proteções": "Curto-circuito, sobrecarga e sobretensão",
      "Isolamento": "Classe II",
      "Saída ajustável": "Sim; consultar intervalo na ficha técnica"
    },
    "previous_source_url": "https://www.meanwell.com/Upload/PDF/HDR-15/HDR-15-SPEC.PDF",
    "source_url": "https://www.meanwell.com/Upload/PDF/HDR-15/HDR-15-SPEC.PDF",
    "image_url": "/catalog/meanwell-hdr15-family.jpg",
    "image_caption": "Imagem da família Mean Well HDR-15; tensão de saída e marcações podem variar."
  },
  {
    "code": "MW-HDR-30-12",
    "reference": "HDR-30-12",
    "previous_specifications": {
      "Saída": "12 V DC",
      "Corrente nominal": "2 A",
      "Montagem": "Calha DIN"
    },
    "specifications": {
      "Saída": "12 V DC",
      "Corrente nominal": "2 A",
      "Montagem": "Calha DIN TS-35/7,5 ou TS-35/15",
      "Entrada AC": "85–264 V AC",
      "Largura": "35 mm",
      "Arrefecimento": "Convecção natural",
      "Proteções": "Curto-circuito, sobrecarga e sobretensão",
      "Isolamento": "Classe II",
      "Saída ajustável": "Sim; consultar intervalo na ficha técnica"
    },
    "previous_source_url": "https://www.meanwell.com/Upload/PDF/HDR-30/HDR-30-SPEC.PDF",
    "source_url": "https://www.meanwell.com/Upload/PDF/HDR-30/HDR-30-SPEC.PDF",
    "image_url": "/catalog/meanwell-hdr30-family.jpg",
    "image_caption": "Imagem da família Mean Well HDR-30; tensão de saída e marcações podem variar."
  },
  {
    "code": "MW-HDR-30-24",
    "reference": "HDR-30-24",
    "previous_specifications": {
      "Saída": "24 V DC",
      "Corrente nominal": "1,5 A",
      "Montagem": "Calha DIN"
    },
    "specifications": {
      "Saída": "24 V DC",
      "Corrente nominal": "1,5 A",
      "Montagem": "Calha DIN TS-35/7,5 ou TS-35/15",
      "Entrada AC": "85–264 V AC",
      "Largura": "35 mm",
      "Arrefecimento": "Convecção natural",
      "Proteções": "Curto-circuito, sobrecarga e sobretensão",
      "Isolamento": "Classe II",
      "Saída ajustável": "Sim; consultar intervalo na ficha técnica"
    },
    "previous_source_url": "https://www.meanwell.com/Upload/PDF/HDR-30/HDR-30-SPEC.PDF",
    "source_url": "https://www.meanwell.com/Upload/PDF/HDR-30/HDR-30-SPEC.PDF",
    "image_url": "/catalog/meanwell-hdr30-family.jpg",
    "image_caption": "Imagem da família Mean Well HDR-30; tensão de saída e marcações podem variar."
  },
  {
    "code": "MW-HDR-60-12",
    "reference": "HDR-60-12",
    "previous_specifications": {
      "Saída": "12 V DC",
      "Corrente nominal": "4,5 A",
      "Montagem": "Calha DIN"
    },
    "specifications": {
      "Saída": "12 V DC",
      "Corrente nominal": "4,5 A",
      "Montagem": "Calha DIN TS-35/7,5 ou TS-35/15",
      "Entrada AC": "85–264 V AC",
      "Largura": "52,5 mm",
      "Arrefecimento": "Convecção natural",
      "Proteções": "Curto-circuito, sobrecarga e sobretensão",
      "Isolamento": "Classe II",
      "Saída ajustável": "Sim; consultar intervalo na ficha técnica"
    },
    "previous_source_url": "https://www.meanwell.com/Upload/PDF/HDR-60/HDR-60-SPEC.PDF",
    "source_url": "https://www.meanwell.com/Upload/PDF/HDR-60/HDR-60-SPEC.PDF",
    "image_url": "/catalog/meanwell-hdr60-family.jpg",
    "image_caption": "Imagem da família Mean Well HDR-60; tensão de saída e marcações podem variar."
  },
  {
    "code": "MW-HDR-60-24",
    "reference": "HDR-60-24",
    "previous_specifications": {
      "Saída": "24 V DC",
      "Corrente nominal": "2,5 A",
      "Montagem": "Calha DIN"
    },
    "specifications": {
      "Saída": "24 V DC",
      "Corrente nominal": "2,5 A",
      "Montagem": "Calha DIN TS-35/7,5 ou TS-35/15",
      "Entrada AC": "85–264 V AC",
      "Largura": "52,5 mm",
      "Arrefecimento": "Convecção natural",
      "Proteções": "Curto-circuito, sobrecarga e sobretensão",
      "Isolamento": "Classe II",
      "Saída ajustável": "Sim; consultar intervalo na ficha técnica"
    },
    "previous_source_url": "https://www.meanwell.com/Upload/PDF/HDR-60/HDR-60-SPEC.PDF",
    "source_url": "https://www.meanwell.com/Upload/PDF/HDR-60/HDR-60-SPEC.PDF",
    "image_url": "/catalog/meanwell-hdr60-family.jpg",
    "image_caption": "Imagem da família Mean Well HDR-60; tensão de saída e marcações podem variar."
  },
  {
    "code": "WEID-1020000000",
    "reference": "1020000000",
    "previous_specifications": {
      "Modelo": "WDU 2.5",
      "Secção nominal": "2,5 mm²",
      "Cor": "Cinzento",
      "Ligação": "Parafuso"
    },
    "specifications": {
      "Modelo": "WDU 2.5",
      "Secção nominal": "2,5 mm²",
      "Cor": "Bege escuro",
      "Ligação": "Parafuso",
      "Corrente nominal IEC": "24 A",
      "Tensão nominal IEC": "800 V",
      "Número de ligações": "2",
      "Material isolante": "Wemid",
      "Largura": "5,1 mm",
      "Altura": "60 mm",
      "Profundidade": "46,5 mm",
      "EAN": "4008190099633"
    },
    "previous_source_url": "https://assets.dam.weidmueller.com/assets/api/62dcab19-b0d3-4cd4-9e94-610c52664b4b/Original/MB_BUILDING_DE_2025_WEB.pdf",
    "source_url": "https://eshop.weidmueller.com/en/wdu-2-5/p/1020000000",
    "image_url": "/catalog/weidmuller-1020000000.jpg",
    "image_caption": "Imagem oficial Weidmüller WDU 2.5; representação ilustrativa da referência."
  },
  {
    "code": "WEID-1020080000",
    "reference": "1020080000",
    "previous_specifications": {
      "Modelo": "WDU 2.5 BL",
      "Secção nominal": "2,5 mm²",
      "Cor": "Azul",
      "Ligação": "Parafuso"
    },
    "specifications": {
      "Modelo": "WDU 2.5 BL",
      "Secção nominal": "2,5 mm²",
      "Cor": "Azul",
      "Ligação": "Parafuso",
      "Corrente nominal IEC": "24 A",
      "Tensão nominal IEC": "800 V",
      "Número de ligações": "2",
      "Material isolante": "Wemid"
    },
    "previous_source_url": "https://assets.dam.weidmueller.com/assets/api/62dcab19-b0d3-4cd4-9e94-610c52664b4b/Original/MB_BUILDING_DE_2025_WEB.pdf",
    "source_url": "https://eshop.weidmueller.com/en/wdu-2-5-bl/p/1020080000",
    "image_url": "/catalog/weidmuller-1020080000.jpg",
    "image_caption": "Imagem oficial Weidmüller WDU 2.5 BL; representação ilustrativa da referência."
  },
  {
    "code": "WEID-1020100000",
    "reference": "1020100000",
    "previous_specifications": {
      "Modelo": "WDU 4",
      "Secção nominal": "4 mm²",
      "Cor": "Cinzento",
      "Ligação": "Parafuso"
    },
    "specifications": {
      "Modelo": "WDU 4",
      "Secção nominal": "4 mm²",
      "Cor": "Bege escuro",
      "Ligação": "Parafuso",
      "Corrente nominal IEC": "32 A",
      "Tensão nominal IEC": "800 V",
      "Número de ligações": "2",
      "Material isolante": "Wemid"
    },
    "previous_source_url": "https://assets.dam.weidmueller.com/assets/api/62dcab19-b0d3-4cd4-9e94-610c52664b4b/Original/MB_BUILDING_DE_2025_WEB.pdf",
    "source_url": "https://eshop.weidmueller.com/en/wdu-4/p/1020100000",
    "image_url": "/catalog/weidmuller-1020100000.jpg",
    "image_caption": "Imagem oficial Weidmüller WDU 4; representação ilustrativa da referência."
  },
  {
    "code": "WEID-1020180000",
    "reference": "1020180000",
    "previous_specifications": {
      "Modelo": "WDU 4 BL",
      "Secção nominal": "4 mm²",
      "Cor": "Azul",
      "Ligação": "Parafuso"
    },
    "specifications": {
      "Modelo": "WDU 4 BL",
      "Secção nominal": "4 mm²",
      "Cor": "Azul",
      "Ligação": "Parafuso",
      "Corrente nominal IEC": "32 A",
      "Tensão nominal IEC": "800 V",
      "Número de ligações": "2",
      "Material isolante": "Wemid"
    },
    "previous_source_url": "https://assets.dam.weidmueller.com/assets/api/62dcab19-b0d3-4cd4-9e94-610c52664b4b/Original/MB_BUILDING_DE_2025_WEB.pdf",
    "source_url": "https://eshop.weidmueller.com/en/wdu-4-bl/p/1020180000",
    "image_url": "/catalog/weidmuller-1020180000.jpg",
    "image_caption": "Imagem oficial Weidmüller WDU 4 BL; representação ilustrativa da referência."
  },
  {
    "code": "WEID-1020200000",
    "reference": "1020200000",
    "previous_specifications": {
      "Modelo": "WDU 6",
      "Secção nominal": "6 mm²",
      "Cor": "Cinzento",
      "Ligação": "Parafuso"
    },
    "specifications": {
      "Modelo": "WDU 6",
      "Secção nominal": "6 mm²",
      "Cor": "Bege escuro",
      "Ligação": "Parafuso",
      "Corrente nominal IEC": "41 A",
      "Tensão nominal IEC": "800 V",
      "Número de ligações": "2",
      "Material isolante": "Wemid"
    },
    "previous_source_url": "https://assets.dam.weidmueller.com/assets/api/62dcab19-b0d3-4cd4-9e94-610c52664b4b/Original/MB_BUILDING_DE_2025_WEB.pdf",
    "source_url": "https://eshop.weidmueller.com/en/wdu-6/p/1020200000",
    "image_url": "/catalog/weidmuller-1020200000.jpg",
    "image_caption": "Imagem oficial Weidmüller WDU 6; representação ilustrativa da referência."
  },
  {
    "code": "WEID-1020280000",
    "reference": "1020280000",
    "previous_specifications": {
      "Modelo": "WDU 6 BL",
      "Secção nominal": "6 mm²",
      "Cor": "Azul",
      "Ligação": "Parafuso"
    },
    "specifications": {
      "Modelo": "WDU 6 BL",
      "Secção nominal": "6 mm²",
      "Cor": "Azul",
      "Ligação": "Parafuso",
      "Corrente nominal IEC": "41 A",
      "Tensão nominal IEC": "800 V",
      "Número de ligações": "2",
      "Material isolante": "Wemid"
    },
    "previous_source_url": "https://assets.dam.weidmueller.com/assets/api/62dcab19-b0d3-4cd4-9e94-610c52664b4b/Original/MB_BUILDING_DE_2025_WEB.pdf",
    "source_url": "https://eshop.weidmueller.com/en/wdu-6-bl/p/1020280000",
    "image_url": "/catalog/weidmuller-1020280000.jpg",
    "image_caption": "Imagem oficial Weidmüller WDU 6 BL; representação ilustrativa da referência."
  }
]$details$::jsonb)
 AS x(code text,reference text,previous_specifications jsonb,specifications jsonb,previous_source_url text,source_url text,image_url text,image_caption text))
UPDATE public.custom_catalog_items c SET
 specifications=c.specifications || (SELECT coalesce(jsonb_object_agg(s.key,s.value),'{}'::jsonb) FROM jsonb_each(x.specifications) s WHERE NOT c.specifications ? s.key OR c.specifications->s.key IS NOT DISTINCT FROM x.previous_specifications->s.key),
 source_url=CASE WHEN c.source_url=x.previous_source_url THEN x.source_url ELSE c.source_url END,
 image_caption=CASE WHEN c.image_url='' THEN x.image_caption ELSE c.image_caption END,
 image_url=CASE WHEN c.image_url='' THEN x.image_url ELSE c.image_url END
FROM incoming x,public.organizations o WHERE o.slug='tercis-legacy' AND c.organization_id=o.id AND c.active IS TRUE AND c.code=x.code AND c.reference=x.reference
RETURNING c.code;
