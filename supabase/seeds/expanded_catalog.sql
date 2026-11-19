-- Manufacturer references and original photographs, checked 2026-11-18.
-- Prices remain unconfirmed; metadata updates preserve existing costs and user edits.
WITH target AS (
 SELECT p.id,p.organization_id FROM public.profiles p JOIN public.organizations o ON o.id=p.organization_id
 WHERE o.slug='tercis-legacy' AND p.active IS TRUE AND p.role IN ('admin','company_admin') ORDER BY p.created_at,p.id LIMIT 1
), incoming AS (
 SELECT * FROM jsonb_to_recordset($components$[
  {
    "code": "ABB-S201-C6",
    "description": "Disjuntor S201-C6 · 1 polo · curva C · 6 A",
    "reference": "2CDS251001R0064",
    "brand": "ABB",
    "category": "Disjuntores",
    "sector": "Eletricidade",
    "unit": "un",
    "source_url": "https://library.e.abb.com/public/e1feaf53e4b99c8ac1257e36003719a4/Modular%20DIN%20Comps%20MCB%20RCB%20Meters%20Surge%209AKK106354A1400.pdf",
    "specifications": {
      "Fabricante": "ABB",
      "Referência": "2CDS251001R0064",
      "Aplicação": "Eletricidade",
      "Polos": "1",
      "Curva": "C",
      "Corrente nominal": "6 A"
    },
    "image_url": "/catalog/abb-s201-family.jpg",
    "image_caption": "Imagem da família ABB S201; calibre e marcações podem variar."
  },
  {
    "code": "ABB-S201-C10",
    "description": "Disjuntor S201-C10 · 1 polo · curva C · 10 A",
    "reference": "2CDS251001R0104",
    "brand": "ABB",
    "category": "Disjuntores",
    "sector": "Eletricidade",
    "unit": "un",
    "source_url": "https://library.e.abb.com/public/e1feaf53e4b99c8ac1257e36003719a4/Modular%20DIN%20Comps%20MCB%20RCB%20Meters%20Surge%209AKK106354A1400.pdf",
    "specifications": {
      "Fabricante": "ABB",
      "Referência": "2CDS251001R0104",
      "Aplicação": "Eletricidade",
      "Polos": "1",
      "Curva": "C",
      "Corrente nominal": "10 A"
    },
    "image_url": "/catalog/abb-s201-family.jpg",
    "image_caption": "Imagem da família ABB S201; calibre e marcações podem variar."
  },
  {
    "code": "ABB-S201-C16",
    "description": "Disjuntor S201-C16 · 1 polo · curva C · 16 A",
    "reference": "2CDS251001R0164",
    "brand": "ABB",
    "category": "Disjuntores",
    "sector": "Eletricidade",
    "unit": "un",
    "source_url": "https://library.e.abb.com/public/e1feaf53e4b99c8ac1257e36003719a4/Modular%20DIN%20Comps%20MCB%20RCB%20Meters%20Surge%209AKK106354A1400.pdf",
    "specifications": {
      "Fabricante": "ABB",
      "Referência": "2CDS251001R0164",
      "Aplicação": "Eletricidade",
      "Polos": "1",
      "Curva": "C",
      "Corrente nominal": "16 A"
    },
    "image_url": "/catalog/abb-s201-family.jpg",
    "image_caption": "Imagem da família ABB S201; calibre e marcações podem variar."
  },
  {
    "code": "ABB-S201-C20",
    "description": "Disjuntor S201-C20 · 1 polo · curva C · 20 A",
    "reference": "2CDS251001R0204",
    "brand": "ABB",
    "category": "Disjuntores",
    "sector": "Eletricidade",
    "unit": "un",
    "source_url": "https://library.e.abb.com/public/e1feaf53e4b99c8ac1257e36003719a4/Modular%20DIN%20Comps%20MCB%20RCB%20Meters%20Surge%209AKK106354A1400.pdf",
    "specifications": {
      "Fabricante": "ABB",
      "Referência": "2CDS251001R0204",
      "Aplicação": "Eletricidade",
      "Polos": "1",
      "Curva": "C",
      "Corrente nominal": "20 A"
    },
    "image_url": "/catalog/abb-s201-family.jpg",
    "image_caption": "Imagem da família ABB S201; calibre e marcações podem variar."
  },
  {
    "code": "ABB-S201-C25",
    "description": "Disjuntor S201-C25 · 1 polo · curva C · 25 A",
    "reference": "2CDS251001R0254",
    "brand": "ABB",
    "category": "Disjuntores",
    "sector": "Eletricidade",
    "unit": "un",
    "source_url": "https://library.e.abb.com/public/e1feaf53e4b99c8ac1257e36003719a4/Modular%20DIN%20Comps%20MCB%20RCB%20Meters%20Surge%209AKK106354A1400.pdf",
    "specifications": {
      "Fabricante": "ABB",
      "Referência": "2CDS251001R0254",
      "Aplicação": "Eletricidade",
      "Polos": "1",
      "Curva": "C",
      "Corrente nominal": "25 A"
    },
    "image_url": "/catalog/abb-s201-family.jpg",
    "image_caption": "Imagem da família ABB S201; calibre e marcações podem variar."
  },
  {
    "code": "ABB-S201-C32",
    "description": "Disjuntor S201-C32 · 1 polo · curva C · 32 A",
    "reference": "2CDS251001R0324",
    "brand": "ABB",
    "category": "Disjuntores",
    "sector": "Eletricidade",
    "unit": "un",
    "source_url": "https://library.e.abb.com/public/e1feaf53e4b99c8ac1257e36003719a4/Modular%20DIN%20Comps%20MCB%20RCB%20Meters%20Surge%209AKK106354A1400.pdf",
    "specifications": {
      "Fabricante": "ABB",
      "Referência": "2CDS251001R0324",
      "Aplicação": "Eletricidade",
      "Polos": "1",
      "Curva": "C",
      "Corrente nominal": "32 A"
    },
    "image_url": "/catalog/abb-s201-family.jpg",
    "image_caption": "Imagem da família ABB S201; calibre e marcações podem variar."
  },
  {
    "code": "ABB-S201-C40",
    "description": "Disjuntor S201-C40 · 1 polo · curva C · 40 A",
    "reference": "2CDS251001R0404",
    "brand": "ABB",
    "category": "Disjuntores",
    "sector": "Eletricidade",
    "unit": "un",
    "source_url": "https://library.e.abb.com/public/e1feaf53e4b99c8ac1257e36003719a4/Modular%20DIN%20Comps%20MCB%20RCB%20Meters%20Surge%209AKK106354A1400.pdf",
    "specifications": {
      "Fabricante": "ABB",
      "Referência": "2CDS251001R0404",
      "Aplicação": "Eletricidade",
      "Polos": "1",
      "Curva": "C",
      "Corrente nominal": "40 A"
    },
    "image_url": "/catalog/abb-s201-family.jpg",
    "image_caption": "Imagem da família ABB S201; calibre e marcações podem variar."
  },
  {
    "code": "ABB-S201-C63",
    "description": "Disjuntor S201-C63 · 1 polo · curva C · 63 A",
    "reference": "2CDS251001R0634",
    "brand": "ABB",
    "category": "Disjuntores",
    "sector": "Eletricidade",
    "unit": "un",
    "source_url": "https://library.e.abb.com/public/e1feaf53e4b99c8ac1257e36003719a4/Modular%20DIN%20Comps%20MCB%20RCB%20Meters%20Surge%209AKK106354A1400.pdf",
    "specifications": {
      "Fabricante": "ABB",
      "Referência": "2CDS251001R0634",
      "Aplicação": "Eletricidade",
      "Polos": "1",
      "Curva": "C",
      "Corrente nominal": "63 A"
    },
    "image_url": "/catalog/abb-s201-family.jpg",
    "image_caption": "Imagem da família ABB S201; calibre e marcações podem variar."
  },
  {
    "code": "ABB-S203-C10",
    "description": "Disjuntor S203-C10 · 3 polos · curva C · 10 A",
    "reference": "2CDS253001R0104",
    "brand": "ABB",
    "category": "Disjuntores",
    "sector": "Eletricidade",
    "unit": "un",
    "source_url": "https://library.e.abb.com/public/e1feaf53e4b99c8ac1257e36003719a4/Modular%20DIN%20Comps%20MCB%20RCB%20Meters%20Surge%209AKK106354A1400.pdf",
    "specifications": {
      "Fabricante": "ABB",
      "Referência": "2CDS253001R0104",
      "Aplicação": "Eletricidade",
      "Polos": "3",
      "Curva": "C",
      "Corrente nominal": "10 A"
    },
    "image_url": "/catalog/abb-s203-family.jpg",
    "image_caption": "Imagem da família ABB S203; calibre e marcações podem variar."
  },
  {
    "code": "ABB-S203-C16",
    "description": "Disjuntor S203-C16 · 3 polos · curva C · 16 A",
    "reference": "2CDS253001R0164",
    "brand": "ABB",
    "category": "Disjuntores",
    "sector": "Eletricidade",
    "unit": "un",
    "source_url": "https://library.e.abb.com/public/e1feaf53e4b99c8ac1257e36003719a4/Modular%20DIN%20Comps%20MCB%20RCB%20Meters%20Surge%209AKK106354A1400.pdf",
    "specifications": {
      "Fabricante": "ABB",
      "Referência": "2CDS253001R0164",
      "Aplicação": "Eletricidade",
      "Polos": "3",
      "Curva": "C",
      "Corrente nominal": "16 A"
    },
    "image_url": "/catalog/abb-s203-family.jpg",
    "image_caption": "Imagem da família ABB S203; calibre e marcações podem variar."
  },
  {
    "code": "ABB-S203-C20",
    "description": "Disjuntor S203-C20 · 3 polos · curva C · 20 A",
    "reference": "2CDS253001R0204",
    "brand": "ABB",
    "category": "Disjuntores",
    "sector": "Eletricidade",
    "unit": "un",
    "source_url": "https://library.e.abb.com/public/e1feaf53e4b99c8ac1257e36003719a4/Modular%20DIN%20Comps%20MCB%20RCB%20Meters%20Surge%209AKK106354A1400.pdf",
    "specifications": {
      "Fabricante": "ABB",
      "Referência": "2CDS253001R0204",
      "Aplicação": "Eletricidade",
      "Polos": "3",
      "Curva": "C",
      "Corrente nominal": "20 A"
    },
    "image_url": "/catalog/abb-s203-family.jpg",
    "image_caption": "Imagem da família ABB S203; calibre e marcações podem variar."
  },
  {
    "code": "ABB-S203-C32",
    "description": "Disjuntor S203-C32 · 3 polos · curva C · 32 A",
    "reference": "2CDS253001R0324",
    "brand": "ABB",
    "category": "Disjuntores",
    "sector": "Eletricidade",
    "unit": "un",
    "source_url": "https://library.e.abb.com/public/e1feaf53e4b99c8ac1257e36003719a4/Modular%20DIN%20Comps%20MCB%20RCB%20Meters%20Surge%209AKK106354A1400.pdf",
    "specifications": {
      "Fabricante": "ABB",
      "Referência": "2CDS253001R0324",
      "Aplicação": "Eletricidade",
      "Polos": "3",
      "Curva": "C",
      "Corrente nominal": "32 A"
    },
    "image_url": "/catalog/abb-s203-family.jpg",
    "image_caption": "Imagem da família ABB S203; calibre e marcações podem variar."
  },
  {
    "code": "HAGER-MBN106",
    "description": "Disjuntor MBN106 · 1 polo · curva B · 6 A",
    "reference": "MBN106",
    "brand": "Hager",
    "category": "Disjuntores",
    "sector": "Eletricidade",
    "unit": "un",
    "source_url": "https://assets.hager.com/step-content/P/HA_47920521/Document/de-AT/24AT0001BLP_PARTNERKATALOG2024_WEB.pdf",
    "specifications": {
      "Fabricante": "Hager",
      "Referência": "MBN106",
      "Aplicação": "Eletricidade",
      "Polos": "1",
      "Curva": "B",
      "Corrente nominal": "6 A"
    },
    "image_url": "/catalog/hager-mbn-family.jpg",
    "image_caption": "Imagem da família Hager MBN, versão MBN116; calibre pode variar."
  },
  {
    "code": "HAGER-MBN110",
    "description": "Disjuntor MBN110 · 1 polo · curva B · 10 A",
    "reference": "MBN110",
    "brand": "Hager",
    "category": "Disjuntores",
    "sector": "Eletricidade",
    "unit": "un",
    "source_url": "https://assets.hager.com/step-content/P/HA_47920521/Document/de-AT/24AT0001BLP_PARTNERKATALOG2024_WEB.pdf",
    "specifications": {
      "Fabricante": "Hager",
      "Referência": "MBN110",
      "Aplicação": "Eletricidade",
      "Polos": "1",
      "Curva": "B",
      "Corrente nominal": "10 A"
    },
    "image_url": "/catalog/hager-mbn-family.jpg",
    "image_caption": "Imagem da família Hager MBN, versão MBN116; calibre pode variar."
  },
  {
    "code": "HAGER-MBN113",
    "description": "Disjuntor MBN113 · 1 polo · curva B · 13 A",
    "reference": "MBN113",
    "brand": "Hager",
    "category": "Disjuntores",
    "sector": "Eletricidade",
    "unit": "un",
    "source_url": "https://assets.hager.com/step-content/P/HA_47920521/Document/de-AT/24AT0001BLP_PARTNERKATALOG2024_WEB.pdf",
    "specifications": {
      "Fabricante": "Hager",
      "Referência": "MBN113",
      "Aplicação": "Eletricidade",
      "Polos": "1",
      "Curva": "B",
      "Corrente nominal": "13 A"
    },
    "image_url": "/catalog/hager-mbn-family.jpg",
    "image_caption": "Imagem da família Hager MBN, versão MBN116; calibre pode variar."
  },
  {
    "code": "HAGER-MBN116",
    "description": "Disjuntor MBN116 · 1 polo · curva B · 16 A",
    "reference": "MBN116",
    "brand": "Hager",
    "category": "Disjuntores",
    "sector": "Eletricidade",
    "unit": "un",
    "source_url": "https://assets.hager.com/step-content/P/HA_47920521/Document/de-AT/24AT0001BLP_PARTNERKATALOG2024_WEB.pdf",
    "specifications": {
      "Fabricante": "Hager",
      "Referência": "MBN116",
      "Aplicação": "Eletricidade",
      "Polos": "1",
      "Curva": "B",
      "Corrente nominal": "16 A"
    },
    "image_url": "/catalog/hager-mbn-family.jpg",
    "image_caption": "Imagem da família Hager MBN, versão MBN116; calibre pode variar."
  },
  {
    "code": "HAGER-MBN120",
    "description": "Disjuntor MBN120 · 1 polo · curva B · 20 A",
    "reference": "MBN120",
    "brand": "Hager",
    "category": "Disjuntores",
    "sector": "Eletricidade",
    "unit": "un",
    "source_url": "https://assets.hager.com/step-content/P/HA_47920521/Document/de-AT/24AT0001BLP_PARTNERKATALOG2024_WEB.pdf",
    "specifications": {
      "Fabricante": "Hager",
      "Referência": "MBN120",
      "Aplicação": "Eletricidade",
      "Polos": "1",
      "Curva": "B",
      "Corrente nominal": "20 A"
    },
    "image_url": "/catalog/hager-mbn-family.jpg",
    "image_caption": "Imagem da família Hager MBN, versão MBN116; calibre pode variar."
  },
  {
    "code": "HAGER-MBN125",
    "description": "Disjuntor MBN125 · 1 polo · curva B · 25 A",
    "reference": "MBN125",
    "brand": "Hager",
    "category": "Disjuntores",
    "sector": "Eletricidade",
    "unit": "un",
    "source_url": "https://assets.hager.com/step-content/P/HA_47920521/Document/de-AT/24AT0001BLP_PARTNERKATALOG2024_WEB.pdf",
    "specifications": {
      "Fabricante": "Hager",
      "Referência": "MBN125",
      "Aplicação": "Eletricidade",
      "Polos": "1",
      "Curva": "B",
      "Corrente nominal": "25 A"
    },
    "image_url": "/catalog/hager-mbn-family.jpg",
    "image_caption": "Imagem da família Hager MBN, versão MBN116; calibre pode variar."
  },
  {
    "code": "HAGER-MBN132",
    "description": "Disjuntor MBN132 · 1 polo · curva B · 32 A",
    "reference": "MBN132",
    "brand": "Hager",
    "category": "Disjuntores",
    "sector": "Eletricidade",
    "unit": "un",
    "source_url": "https://assets.hager.com/step-content/P/HA_47920521/Document/de-AT/24AT0001BLP_PARTNERKATALOG2024_WEB.pdf",
    "specifications": {
      "Fabricante": "Hager",
      "Referência": "MBN132",
      "Aplicação": "Eletricidade",
      "Polos": "1",
      "Curva": "B",
      "Corrente nominal": "32 A"
    },
    "image_url": "/catalog/hager-mbn-family.jpg",
    "image_caption": "Imagem da família Hager MBN, versão MBN116; calibre pode variar."
  },
  {
    "code": "HAGER-MBN140",
    "description": "Disjuntor MBN140 · 1 polo · curva B · 40 A",
    "reference": "MBN140",
    "brand": "Hager",
    "category": "Disjuntores",
    "sector": "Eletricidade",
    "unit": "un",
    "source_url": "https://assets.hager.com/step-content/P/HA_47920521/Document/de-AT/24AT0001BLP_PARTNERKATALOG2024_WEB.pdf",
    "specifications": {
      "Fabricante": "Hager",
      "Referência": "MBN140",
      "Aplicação": "Eletricidade",
      "Polos": "1",
      "Curva": "B",
      "Corrente nominal": "40 A"
    },
    "image_url": "/catalog/hager-mbn-family.jpg",
    "image_caption": "Imagem da família Hager MBN, versão MBN116; calibre pode variar."
  },
  {
    "code": "HAGER-CDA240D",
    "description": "Interruptor diferencial · 1P+N · 40 A · 30 mA · tipo A",
    "reference": "CDA240D",
    "brand": "Hager",
    "category": "Proteção diferencial",
    "sector": "Eletricidade",
    "unit": "un",
    "source_url": "https://assets.hager.com/step-content/P/PDS_158717055301HR/Document/std.lang.all/CDA240D_5301_hr-HR.pdf",
    "specifications": {
      "Fabricante": "Hager",
      "Referência": "CDA240D",
      "Aplicação": "Eletricidade",
      "Configuração": "Interruptor diferencial · 1P+N · 40 A · 30 mA · tipo A"
    },
    "image_url": "/catalog/hager-cda240d.jpg",
    "image_caption": "Fotografia Hager CDA240D."
  },
  {
    "code": "HAGER-ESC225",
    "description": "Contactor modular · 25 A · 2 contactos NA · comando 230 V AC",
    "reference": "ESC225",
    "brand": "Hager",
    "category": "Contactores",
    "sector": "Eletricidade",
    "unit": "un",
    "source_url": "https://assets.hager.com/step-content/P/PDS_159055416401EN/Document/std.lang.all/PDS_ESC225_6401_en-GB.pdf",
    "specifications": {
      "Fabricante": "Hager",
      "Referência": "ESC225",
      "Aplicação": "Eletricidade",
      "Configuração": "Contactor modular · 25 A · 2 contactos NA · comando 230 V AC"
    },
    "image_url": "/catalog/hager-esc225.jpg",
    "image_caption": "Fotografia Hager ESC225."
  },
  {
    "code": "NORD-275234356",
    "description": "Variador NORDAC BASE · SK 180E-750-340-B · 0,75 kW · trifásico · IP55",
    "reference": "275234356",
    "brand": "NORD",
    "category": "Variadores de frequência",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://shop.nord.com/DE-de/nordac-base-sk-180e-750-340-b-6755.html",
    "specifications": {
      "Fabricante": "NORD",
      "Referência": "275234356",
      "Aplicação": "Automação",
      "Configuração": "Variador NORDAC BASE · SK 180E-750-340-B · 0,75 kW · trifásico · IP55"
    },
    "image_url": "",
    "image_caption": ""
  },
  {
    "code": "NORD-SK500P",
    "description": "NORDAC PRO SK 500P · família de variadores para armário · configuração a definir",
    "reference": "SK 500P",
    "brand": "NORD",
    "category": "Variadores de frequência",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://www.nord.com/de/produkte/antriebselektronik/frequenzumrichter-zur-schaltschrank-installation/nordac-pro-sk-500p-frequenzumrichter.jsp",
    "specifications": {
      "Fabricante": "NORD",
      "Referência": "SK 500P",
      "Aplicação": "Automação",
      "Configuração": "NORDAC PRO SK 500P · família de variadores para armário · configuração a definir"
    },
    "image_url": "",
    "image_caption": ""
  },
  {
    "code": "SCH-LC1D09BD",
    "description": "Contactor TeSys · 3 polos NA · 9 A AC-3 · bobina 24 V DC",
    "reference": "LC1D09BD",
    "brand": "Schneider Electric",
    "category": "Contactores",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://www.se.com/uk/en/product/LC1D09BD/tesys-d-contactor-3p3-no-ac3-440-v-9-a-24-v-dc-coil/",
    "specifications": {
      "Fabricante": "Schneider Electric",
      "Referência": "LC1D09BD",
      "Aplicação": "Automação",
      "Configuração": "Contactor TeSys · 3 polos NA · 9 A AC-3 · bobina 24 V DC"
    },
    "image_url": "",
    "image_caption": ""
  },
  {
    "code": "SCH-LC1D12BD",
    "description": "Contactor TeSys · 3 polos NA · 12 A AC-3 · bobina 24 V DC",
    "reference": "LC1D12BD",
    "brand": "Schneider Electric",
    "category": "Contactores",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://www.se.com/pt/pt/product/LC1D12BD/contactor-tesys-d-3p3-na-ac3-440-v-12-a-24-v-cc-bobina/",
    "specifications": {
      "Fabricante": "Schneider Electric",
      "Referência": "LC1D12BD",
      "Aplicação": "Automação",
      "Configuração": "Contactor TeSys · 3 polos NA · 12 A AC-3 · bobina 24 V DC"
    },
    "image_url": "",
    "image_caption": ""
  },
  {
    "code": "SIE-6ES7214-1AG40-0XB0",
    "description": "PLC SIMATIC S7-1200 CPU 1214C · DC/DC/DC · 14 DI / 10 DO / 2 AI",
    "reference": "6ES7214-1AG40-0XB0",
    "brand": "Siemens",
    "category": "Autómatos e controlo",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://sieportal.siemens.com/en-se/products-services/detail/6ES72141AG400XB0",
    "specifications": {
      "Fabricante": "Siemens",
      "Referência": "6ES7214-1AG40-0XB0",
      "Aplicação": "Automação",
      "Configuração": "PLC SIMATIC S7-1200 CPU 1214C · DC/DC/DC · 14 DI / 10 DO / 2 AI"
    },
    "image_url": "",
    "image_caption": ""
  },
  {
    "code": "SIE-6EP1332-1SH71",
    "description": "Fonte SIMATIC PM1207 · entrada 120/230 V AC · saída 24 V DC / 2,5 A",
    "reference": "6EP1332-1SH71",
    "brand": "Siemens",
    "category": "Fontes de alimentação",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://support.industry.siemens.com/teddatasheet/?caller=SIOS&format=pdf&language=en&mlfbs=6EP1332-1SH71",
    "specifications": {
      "Fabricante": "Siemens",
      "Referência": "6EP1332-1SH71",
      "Aplicação": "Automação",
      "Configuração": "Fonte SIMATIC PM1207 · entrada 120/230 V AC · saída 24 V DC / 2,5 A"
    },
    "image_url": "",
    "image_caption": ""
  },
  {
    "code": "WAGO-221-412",
    "description": "Conector de alavanca 221-412 · 2 condutores · até 4 mm²",
    "reference": "221-412",
    "brand": "WAGO",
    "category": "Bornes e conectores",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://www.wago.com/global/products/electrical-interconnections/discover-installation-terminal-blocks-and-connectors/221/interconnection-technology-for-device-manufacturers",
    "specifications": {
      "Condutores": "2",
      "Secção máxima": "4 mm²",
      "Tecnologia": "Alavanca CAGE CLAMP"
    },
    "image_url": "/catalog/wago-221-412.jpg",
    "image_caption": "Fotografia WAGO 221-412."
  },
  {
    "code": "WAGO-221-413",
    "description": "Conector de alavanca 221-413 · 3 condutores · até 4 mm²",
    "reference": "221-413",
    "brand": "WAGO",
    "category": "Bornes e conectores",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://www.wago.com/global/products/electrical-interconnections/discover-installation-terminal-blocks-and-connectors/221/interconnection-technology-for-device-manufacturers",
    "specifications": {
      "Condutores": "3",
      "Secção máxima": "4 mm²",
      "Tecnologia": "Alavanca CAGE CLAMP"
    },
    "image_url": "/catalog/wago-221-413.jpg",
    "image_caption": "Fotografia WAGO 221-413."
  },
  {
    "code": "WAGO-221-415",
    "description": "Conector de alavanca 221-415 · 5 condutores · até 4 mm²",
    "reference": "221-415",
    "brand": "WAGO",
    "category": "Bornes e conectores",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://www.wago.com/global/products/electrical-interconnections/discover-installation-terminal-blocks-and-connectors/221/interconnection-technology-for-device-manufacturers",
    "specifications": {
      "Condutores": "5",
      "Secção máxima": "4 mm²",
      "Tecnologia": "Alavanca CAGE CLAMP"
    },
    "image_url": "/catalog/wago-221-415.jpg",
    "image_caption": "Fotografia WAGO 221-415."
  },
  {
    "code": "WAGO-221-612",
    "description": "Conector de alavanca 221-612 · 2 condutores · até 6 mm²",
    "reference": "221-612",
    "brand": "WAGO",
    "category": "Bornes e conectores",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://www.wago.com/us/products/electrical-interconnect/discover-wire-and-splicing-connectors-old/221",
    "specifications": {
      "Condutores": "2",
      "Secção máxima": "6 mm²",
      "Tecnologia": "Alavanca CAGE CLAMP"
    },
    "image_url": "/catalog/wago-221-612.jpg",
    "image_caption": "Fotografia WAGO 221-612."
  },
  {
    "code": "WAGO-221-613",
    "description": "Conector de alavanca 221-613 · 3 condutores · até 6 mm²",
    "reference": "221-613",
    "brand": "WAGO",
    "category": "Bornes e conectores",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://www.wago.com/us/products/electrical-interconnect/discover-wire-and-splicing-connectors-old/221",
    "specifications": {
      "Condutores": "3",
      "Secção máxima": "6 mm²",
      "Tecnologia": "Alavanca CAGE CLAMP"
    },
    "image_url": "/catalog/wago-221-613.jpg",
    "image_caption": "Fotografia WAGO 221-613."
  },
  {
    "code": "PXC-2903147",
    "description": "Fonte TRIO POWER · TRIO-PS-2G/1AC/24DC/3/C2LPS",
    "reference": "2903147",
    "brand": "Phoenix Contact",
    "category": "Fontes de alimentação",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://www.phoenixcontact.com/en-fr/products/power-supply-unit-trio-ps-2g-1ac-24dc-3-c2lps-2903147",
    "specifications": {
      "Modelo": "TRIO-PS-2G/1AC/24DC/3/C2LPS",
      "Saída": "24 V DC / 3 A",
      "Montagem": "Calha DIN"
    },
    "image_url": "",
    "image_caption": ""
  },
  {
    "code": "PXC-2903148",
    "description": "Fonte TRIO POWER · TRIO-PS-2G/1AC/24DC/5",
    "reference": "2903148",
    "brand": "Phoenix Contact",
    "category": "Fontes de alimentação",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://www.phoenixcontact.com/en-de/products/power-supply-unit-trio-ps-2g-1ac-24dc-5-2903148",
    "specifications": {
      "Modelo": "TRIO-PS-2G/1AC/24DC/5",
      "Saída": "24 V DC / 5 A",
      "Montagem": "Calha DIN"
    },
    "image_url": "",
    "image_caption": ""
  },
  {
    "code": "PXC-2903149",
    "description": "Fonte TRIO POWER · TRIO-PS-2G/1AC/24DC/10",
    "reference": "2903149",
    "brand": "Phoenix Contact",
    "category": "Fontes de alimentação",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://www.phoenixcontact.com/en-de/products/power-supply-unit-trio-ps-2g-1ac-24dc-10-2903149",
    "specifications": {
      "Modelo": "TRIO-PS-2G/1AC/24DC/10",
      "Saída": "24 V DC / 10 A",
      "Montagem": "Calha DIN"
    },
    "image_url": "",
    "image_caption": ""
  },
  {
    "code": "PXC-2903144",
    "description": "Fonte TRIO POWER · TRIO-PS-2G/1AC/24DC/5/B+D",
    "reference": "2903144",
    "brand": "Phoenix Contact",
    "category": "Fontes de alimentação",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://www.phoenixcontact.com/assets/2018/interactive_ed/101_519929/epaper/1314679_NL_SG_Power_Supplies_L.pdf",
    "specifications": {
      "Modelo": "TRIO-PS-2G/1AC/24DC/5/B+D",
      "Saída": "24 V DC / 5 A",
      "Montagem": "Calha DIN"
    },
    "image_url": "",
    "image_caption": ""
  },
  {
    "code": "PXC-3044076",
    "description": "Borne de passagem UT 2,5 · ligação por parafuso",
    "reference": "3044076",
    "brand": "Phoenix Contact",
    "category": "Bornes e conectores",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://www.phoenixcontact.com/en-de/products/feed-through-terminal-block-ut-25-3044076",
    "specifications": {
      "Modelo": "UT 2,5",
      "Tecnologia": "Parafuso",
      "Secção nominal": "2,5 mm²"
    },
    "image_url": "",
    "image_caption": ""
  },
  {
    "code": "OMRON-MY2N",
    "description": "Relé MY2N · 2 contactos inversores · bobina a configurar",
    "reference": "MY2N",
    "brand": "Omron",
    "category": "Relés e interfaces",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://www.ia.omron.com/products/family/948/lineup.html",
    "specifications": {
      "Tipo": "MY2N",
      "Contactos inversores": "2",
      "Bobina": "Confirmar variante e tensão no fabricante"
    },
    "image_url": "",
    "image_caption": ""
  },
  {
    "code": "OMRON-MY4N",
    "description": "Relé MY4N · 4 contactos inversores · bobina a configurar",
    "reference": "MY4N",
    "brand": "Omron",
    "category": "Relés e interfaces",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://www.ia.omron.com/products/family/948/lineup.html",
    "specifications": {
      "Tipo": "MY4N",
      "Contactos inversores": "4",
      "Bobina": "Confirmar variante e tensão no fabricante"
    },
    "image_url": "",
    "image_caption": ""
  },
  {
    "code": "OMRON-MY2N-D2",
    "description": "Relé MY2N-D2 · 2 contactos inversores · bobina a configurar",
    "reference": "MY2N-D2",
    "brand": "Omron",
    "category": "Relés e interfaces",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://www.ia.omron.com/products/family/948/lineup.html",
    "specifications": {
      "Tipo": "MY2N-D2",
      "Contactos inversores": "2",
      "Bobina": "Confirmar variante e tensão no fabricante"
    },
    "image_url": "",
    "image_caption": ""
  },
  {
    "code": "OMRON-MY4N-D2",
    "description": "Relé MY4N-D2 · 4 contactos inversores · bobina a configurar",
    "reference": "MY4N-D2",
    "brand": "Omron",
    "category": "Relés e interfaces",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://www.ia.omron.com/products/family/948/lineup.html",
    "specifications": {
      "Tipo": "MY4N-D2",
      "Contactos inversores": "4",
      "Bobina": "Confirmar variante e tensão no fabricante"
    },
    "image_url": "",
    "image_caption": ""
  },
  {
    "code": "OMRON-PYF08A",
    "description": "Base de ligação PYF08A para relés MY2 e MY2N",
    "reference": "PYF08A",
    "brand": "Omron",
    "category": "Relés e interfaces",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://www.ia.omron.com/support/faq/answer/36/faq02198/",
    "specifications": {
      "Compatibilidade": "MY2 / MY2N",
      "Função": "Base para relé"
    },
    "image_url": "",
    "image_caption": ""
  },
  {
    "code": "EATON-276690",
    "description": "Contactor DILM9-10 · bobina 230 V AC / 50 Hz",
    "reference": "276690",
    "brand": "Eaton",
    "category": "Contactores",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://www.eaton.com/content/dam/eaton/support/catalog/eaton-xpole-accessories-ca019015de-de-de.pdf",
    "specifications": {
      "Modelo": "DILM9-10",
      "Bobina": "230 V AC / 50 Hz",
      "Função": "Comando de potência"
    },
    "image_url": "",
    "image_caption": ""
  },
  {
    "code": "EATON-276845",
    "description": "Contactor DILM12-10 · bobina 24 V DC",
    "reference": "276845",
    "brand": "Eaton",
    "category": "Contactores",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://www.eaton.com/content/dam/eaton/support/catalog/eaton-xpole-accessories-ca019015de-de-de.pdf",
    "specifications": {
      "Modelo": "DILM12-10",
      "Bobina": "24 V DC",
      "Função": "Comando de potência"
    },
    "image_url": "",
    "image_caption": ""
  },
  {
    "code": "EATON-277018",
    "description": "Contactor DILM17-10 · bobina RDC24",
    "reference": "277018",
    "brand": "Eaton",
    "category": "Contactores",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://www.eaton.com/content/dam/eaton/support/catalog/eaton-xpole-accessories-ca019015de-de-de.pdf",
    "specifications": {
      "Modelo": "DILM17-10",
      "Bobina": "RDC24",
      "Função": "Comando de potência"
    },
    "image_url": "",
    "image_caption": ""
  },
  {
    "code": "EATON-276554",
    "description": "Contactor DILM7-10 · bobina 24 V AC / 50 Hz",
    "reference": "276554",
    "brand": "Eaton",
    "category": "Contactores",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://www.eaton.com/content/dam/eaton/support/catalog/eaton-catalog-2025.pdf",
    "specifications": {
      "Modelo": "DILM7-10",
      "Bobina": "24 V AC / 50 Hz",
      "Função": "Comando de potência"
    },
    "image_url": "",
    "image_caption": ""
  },
  {
    "code": "EATON-277136",
    "description": "Contactor DILM25-10 · bobina 24 V AC / 50 Hz",
    "reference": "277136",
    "brand": "Eaton",
    "category": "Contactores",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://www.eaton.com/content/dam/eaton/support/catalog/eaton-catalog-2025.pdf",
    "specifications": {
      "Modelo": "DILM25-10",
      "Bobina": "24 V AC / 50 Hz",
      "Função": "Comando de potência"
    },
    "image_url": "",
    "image_caption": ""
  },
  {
    "code": "FINDER-40.31",
    "description": "Relé série 40 · tipo 40.31 · 12 A · bobina a configurar",
    "reference": "40.31",
    "brand": "Finder",
    "category": "Relés e interfaces",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://cdn.findernet.com/app/uploads/S40EN.pdf",
    "specifications": {
      "Contactos": "1 inversor",
      "Corrente nominal": "12 A",
      "Bobina": "Configuração a confirmar"
    },
    "image_url": "/catalog/finder-4031.png",
    "image_caption": "Imagem da família Finder 40.31; tensão e versão da bobina por configurar."
  },
  {
    "code": "FINDER-40.51",
    "description": "Relé série 40 · tipo 40.51 · 12 A · bobina a configurar",
    "reference": "40.51",
    "brand": "Finder",
    "category": "Relés e interfaces",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://cdn.findernet.com/app/uploads/S40EN.pdf",
    "specifications": {
      "Contactos": "1 inversor",
      "Corrente nominal": "12 A",
      "Bobina": "Configuração a confirmar"
    },
    "image_url": "/catalog/finder-4051.png",
    "image_caption": "Imagem da família Finder 40.51; tensão e versão da bobina por configurar."
  },
  {
    "code": "FINDER-40.52",
    "description": "Relé série 40 · tipo 40.52 · 8 A · bobina a configurar",
    "reference": "40.52",
    "brand": "Finder",
    "category": "Relés e interfaces",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://cdn.findernet.com/app/uploads/S40EN.pdf",
    "specifications": {
      "Contactos": "2 inversores",
      "Corrente nominal": "8 A",
      "Bobina": "Configuração a confirmar"
    },
    "image_url": "/catalog/finder-4052.png",
    "image_caption": "Imagem da família Finder 40.52; tensão e versão da bobina por configurar."
  },
  {
    "code": "FINDER-40.61",
    "description": "Relé série 40 · tipo 40.61 · 16 A · bobina a configurar",
    "reference": "40.61",
    "brand": "Finder",
    "category": "Relés e interfaces",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://cdn.findernet.com/app/uploads/S40EN.pdf",
    "specifications": {
      "Contactos": "1 inversor",
      "Corrente nominal": "16 A",
      "Bobina": "Configuração a confirmar"
    },
    "image_url": "/catalog/finder-4061.png",
    "image_caption": "Imagem da família Finder 40.61; tensão e versão da bobina por configurar."
  },
  {
    "code": "FINDER-95.05",
    "description": "Base para relés série 40 · tipo 95.05",
    "reference": "95.05",
    "brand": "Finder",
    "category": "Relés e interfaces",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://cdn.findernet.com/app/uploads/S40PT.pdf",
    "specifications": {
      "Família": "Série 95",
      "Utilização": "Base de ligação para relés compatíveis"
    },
    "image_url": "",
    "image_caption": ""
  },
  {
    "code": "MW-HDR-15-24",
    "description": "Fonte DIN HDR-15-24 · saída 24 V DC",
    "reference": "HDR-15-24",
    "brand": "Mean Well",
    "category": "Fontes de alimentação",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://www.meanwell.com/Upload/PDF/HDR-15/HDR-15-SPEC.PDF",
    "specifications": {
      "Saída": "24 V DC",
      "Montagem": "Calha DIN"
    },
    "image_url": "/catalog/meanwell-hdr15-family.jpg",
    "image_caption": "Imagem da família Mean Well HDR-15; tensão de saída e marcações podem variar."
  },
  {
    "code": "MW-HDR-30-12",
    "description": "Fonte DIN HDR-30-12 · saída 12 V DC / 2 A",
    "reference": "HDR-30-12",
    "brand": "Mean Well",
    "category": "Fontes de alimentação",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://www.meanwell.com/Upload/PDF/HDR-30/HDR-30-SPEC.PDF",
    "specifications": {
      "Saída": "12 V DC",
      "Corrente nominal": "2 A",
      "Montagem": "Calha DIN"
    },
    "image_url": "/catalog/meanwell-hdr30-family.jpg",
    "image_caption": "Imagem da família Mean Well HDR-30; tensão de saída e marcações podem variar."
  },
  {
    "code": "MW-HDR-30-24",
    "description": "Fonte DIN HDR-30-24 · saída 24 V DC / 1,5 A",
    "reference": "HDR-30-24",
    "brand": "Mean Well",
    "category": "Fontes de alimentação",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://www.meanwell.com/Upload/PDF/HDR-30/HDR-30-SPEC.PDF",
    "specifications": {
      "Saída": "24 V DC",
      "Corrente nominal": "1,5 A",
      "Montagem": "Calha DIN"
    },
    "image_url": "/catalog/meanwell-hdr30-family.jpg",
    "image_caption": "Imagem da família Mean Well HDR-30; tensão de saída e marcações podem variar."
  },
  {
    "code": "MW-HDR-60-12",
    "description": "Fonte DIN HDR-60-12 · saída 12 V DC / 4,5 A",
    "reference": "HDR-60-12",
    "brand": "Mean Well",
    "category": "Fontes de alimentação",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://www.meanwell.com/Upload/PDF/HDR-60/HDR-60-SPEC.PDF",
    "specifications": {
      "Saída": "12 V DC",
      "Corrente nominal": "4,5 A",
      "Montagem": "Calha DIN"
    },
    "image_url": "/catalog/meanwell-hdr60-family.jpg",
    "image_caption": "Imagem da família Mean Well HDR-60; tensão de saída e marcações podem variar."
  },
  {
    "code": "MW-HDR-60-24",
    "description": "Fonte DIN HDR-60-24 · saída 24 V DC / 2,5 A",
    "reference": "HDR-60-24",
    "brand": "Mean Well",
    "category": "Fontes de alimentação",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://www.meanwell.com/Upload/PDF/HDR-60/HDR-60-SPEC.PDF",
    "specifications": {
      "Saída": "24 V DC",
      "Corrente nominal": "2,5 A",
      "Montagem": "Calha DIN"
    },
    "image_url": "/catalog/meanwell-hdr60-family.jpg",
    "image_caption": "Imagem da família Mean Well HDR-60; tensão de saída e marcações podem variar."
  },
  {
    "code": "WEID-1020000000",
    "description": "Borne de passagem WDU 2.5 · 2,5 mm²",
    "reference": "1020000000",
    "brand": "Weidmüller",
    "category": "Bornes e conectores",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://assets.dam.weidmueller.com/assets/api/62dcab19-b0d3-4cd4-9e94-610c52664b4b/Original/MB_BUILDING_DE_2025_WEB.pdf",
    "specifications": {
      "Modelo": "WDU 2.5",
      "Secção nominal": "2,5 mm²",
      "Cor": "Cinzento",
      "Ligação": "Parafuso"
    },
    "image_url": "",
    "image_caption": ""
  },
  {
    "code": "WEID-1020080000",
    "description": "Borne de passagem WDU 2.5 BL · 2,5 mm²",
    "reference": "1020080000",
    "brand": "Weidmüller",
    "category": "Bornes e conectores",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://assets.dam.weidmueller.com/assets/api/62dcab19-b0d3-4cd4-9e94-610c52664b4b/Original/MB_BUILDING_DE_2025_WEB.pdf",
    "specifications": {
      "Modelo": "WDU 2.5 BL",
      "Secção nominal": "2,5 mm²",
      "Cor": "Azul",
      "Ligação": "Parafuso"
    },
    "image_url": "",
    "image_caption": ""
  },
  {
    "code": "WEID-1020100000",
    "description": "Borne de passagem WDU 4 · 4 mm²",
    "reference": "1020100000",
    "brand": "Weidmüller",
    "category": "Bornes e conectores",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://assets.dam.weidmueller.com/assets/api/62dcab19-b0d3-4cd4-9e94-610c52664b4b/Original/MB_BUILDING_DE_2025_WEB.pdf",
    "specifications": {
      "Modelo": "WDU 4",
      "Secção nominal": "4 mm²",
      "Cor": "Cinzento",
      "Ligação": "Parafuso"
    },
    "image_url": "",
    "image_caption": ""
  },
  {
    "code": "WEID-1020180000",
    "description": "Borne de passagem WDU 4 BL · 4 mm²",
    "reference": "1020180000",
    "brand": "Weidmüller",
    "category": "Bornes e conectores",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://assets.dam.weidmueller.com/assets/api/62dcab19-b0d3-4cd4-9e94-610c52664b4b/Original/MB_BUILDING_DE_2025_WEB.pdf",
    "specifications": {
      "Modelo": "WDU 4 BL",
      "Secção nominal": "4 mm²",
      "Cor": "Azul",
      "Ligação": "Parafuso"
    },
    "image_url": "",
    "image_caption": ""
  },
  {
    "code": "WEID-1020200000",
    "description": "Borne de passagem WDU 6 · 6 mm²",
    "reference": "1020200000",
    "brand": "Weidmüller",
    "category": "Bornes e conectores",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://assets.dam.weidmueller.com/assets/api/62dcab19-b0d3-4cd4-9e94-610c52664b4b/Original/MB_BUILDING_DE_2025_WEB.pdf",
    "specifications": {
      "Modelo": "WDU 6",
      "Secção nominal": "6 mm²",
      "Cor": "Cinzento",
      "Ligação": "Parafuso"
    },
    "image_url": "",
    "image_caption": ""
  },
  {
    "code": "WEID-1020280000",
    "description": "Borne de passagem WDU 6 BL · 6 mm²",
    "reference": "1020280000",
    "brand": "Weidmüller",
    "category": "Bornes e conectores",
    "sector": "Automação",
    "unit": "un",
    "source_url": "https://assets.dam.weidmueller.com/assets/api/62dcab19-b0d3-4cd4-9e94-610c52664b4b/Original/MB_BUILDING_DE_2025_WEB.pdf",
    "specifications": {
      "Modelo": "WDU 6 BL",
      "Secção nominal": "6 mm²",
      "Cor": "Azul",
      "Ligação": "Parafuso"
    },
    "image_url": "",
    "image_caption": ""
  }
]$components$::jsonb)
 AS x(code text,description text,reference text,brand text,category text,sector text,unit text,source_url text,specifications jsonb,image_url text,image_caption text)
), updated AS (
 UPDATE public.custom_catalog_items c SET
 specifications=CASE WHEN c.specifications='{}'::jsonb THEN x.specifications ELSE c.specifications END,
 image_caption=CASE WHEN c.image_url='' THEN x.image_caption ELSE c.image_caption END,
 image_url=CASE WHEN c.image_url='' THEN x.image_url ELSE c.image_url END
 FROM incoming x,target t WHERE c.organization_id=t.organization_id AND c.active IS TRUE AND c.code=x.code AND c.reference=x.reference
 RETURNING c.code
), inserted AS (
 INSERT INTO public.custom_catalog_items(code,description,reference,brand,category,sector,unit,source_url,specifications,image_url,image_caption,unit_cost,price_pending,organization_id,created_by)
 SELECT x.code,x.description,x.reference,x.brand,x.category,x.sector,x.unit,x.source_url,x.specifications,x.image_url,x.image_caption,0,true,t.organization_id,t.id
 FROM incoming x CROSS JOIN target t
 WHERE NOT EXISTS(SELECT 1 FROM public.custom_catalog_items c WHERE c.organization_id=t.organization_id AND lower(trim(c.code))=lower(trim(x.code)) AND c.active IS TRUE)
 RETURNING code
)
SELECT (SELECT count(*) FROM inserted) AS inserted,(SELECT count(*) FROM updated) AS metadata_updated;
