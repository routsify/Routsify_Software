export const clients = [
  {
    id: "demo-client-1",
    display_name: "Laura Martín",
    client_type: "person",
    first_name: "Laura",
    last_name: "Martín",
    company_name: "",
    email: "laura.martin@example.com",
    email_normalized: "laura.martin@example.com",
    phone: "+34 600 111 222",
    phone_normalized: "34600111222",
    tax_id: "",
    billing_address: "Calle Serrano 1, Madrid",
    country: "ES",
    language: "es",
    source: "fillout",
    holded_contact_id: "",
    notes: "Cliente demo: viaje a Japón a medida",
  },
  {
    id: "demo-client-2",
    display_name: "Carlos y Ana Vega",
    client_type: "person",
    first_name: "Carlos",
    last_name: "Vega",
    company_name: "",
    email: "carlos.vega@example.com",
    email_normalized: "carlos.vega@example.com",
    phone: "+34 611 222 333",
    phone_normalized: "34611222333",
    tax_id: "",
    billing_address: "Barcelona",
    country: "ES",
    language: "es",
    source: "manual",
    holded_contact_id: "",
    notes: "Interesados en luna de miel en Costa Rica",
  }
];

export const serviceTypes = [
  { code: "hotel", name: "Hotel", active: true },
  { code: "flight", name: "Vuelo", active: true },
  { code: "transfer", name: "Traslado", active: true },
  { code: "activity", name: "Actividad", active: true },
  { code: "insurance", name: "Seguro", active: true },
  { code: "guide", name: "Guía", active: true },
  { code: "fee", name: "Fee de agencia", active: true },
];

export const cases = [
  {
    case_code: "EXP-2026-0001",
    client: "Laura Martín",
    title: "Japón a medida - Octubre 2026",
    status: "budget_draft",
    destination: "Japón",
    trip_start: "2026-10-05",
    trip_end: "2026-10-18",
    next_action: "Completar presupuesto y revisar margen",
    blocker: "Faltan costes finales de proveedores",
    accepted_value: 0,
    currency: "EUR",
  },
  {
    case_code: "EXP-2026-0002",
    client: "Carlos y Ana Vega",
    title: "Costa Rica luna de miel",
    status: "proposal_sent",
    destination: "Costa Rica",
    trip_start: "2026-08-11",
    trip_end: "2026-08-24",
    next_action: "Seguimiento propuesta enviada",
    blocker: "",
    accepted_value: 9200,
    currency: "EUR",
  }
];

export const budgetLines = [
  {
    id: "demo-budget-1",
    service_type_code: "hotel",
    description_public: "5 noches en hotel boutique seleccionado en Kioto con desayuno incluido.",
    description_internal: "Hotel boutique Kioto 5 noches",
    supplier_name: "Hotel Aurora Kyoto",
    destination_segment: "Kioto",
    start_date: "2026-10-10",
    end_date: "2026-10-15",
    cost_budget: 2600,
    margin_applied: 0.25,
    sale_price: 3466.67,
    creates_expected_purchase: true,
  },
  {
    id: "demo-budget-2",
    service_type_code: "transfer",
    description_public: "Traslados privados en los puntos clave del itinerario para viajar sin fricción.",
    description_internal: "Traslados privados aeropuertos y estaciones",
    supplier_name: "Japan Private Transfers",
    destination_segment: "Tokio/Kioto",
    start_date: "2026-10-05",
    end_date: "2026-10-18",
    cost_budget: 900,
    margin_applied: 0.25,
    sale_price: 1200,
    creates_expected_purchase: true,
  },
  {
    id: "demo-budget-3",
    service_type_code: "fee",
    description_public: "Diseño del viaje, coordinación operativa y soporte antes y durante el viaje.",
    description_internal: "Fee diseño y soporte",
    supplier_name: "Routsify",
    destination_segment: "General",
    start_date: "",
    end_date: "",
    cost_budget: 0,
    margin_applied: 1,
    sale_price: 950,
    creates_expected_purchase: false,
  }
];

export const expectedPurchases = [
  { case_code: "EXP-2026-0001", supplier: "Hotel Aurora Kyoto", service: "Hotel", status: "expected", amount: 2600 },
  { case_code: "EXP-2026-0001", supplier: "Japan Private Transfers", service: "Traslado", status: "expected", amount: 900 },
  { case_code: "EXP-2026-0002", supplier: "Lodge Arenal", service: "Hotel", status: "requested", amount: 3100 },
];

export const proposal = {
  client: "Laura Martín",
  title: "Japón esencial y ryokan",
  headline: "Un Japón diseñado a medida, con equilibrio entre cultura, calma y experiencias memorables.",
  destination: "Tokio · Kioto · Hakone",
  dates: "5–18 octubre 2026",
  travelers: "2 viajeros",
  total: 7200,
  highlights: ["Hoteles boutique seleccionados", "Ryokan con onsen", "Traslados privados clave", "Experiencias gastronómicas"],
  itinerary: [
    ["Tokio", "Llegada suave, barrios creativos y cena de bienvenida."],
    ["Hakone", "Ryokan, onsen y vistas al Fuji si el clima acompaña."],
    ["Kioto", "Templos, jardines, gastronomía y ceremonia del té."],
  ],
  lines: [
    ["Hotel boutique Kioto", "5 noches con desayuno", 3466.67],
    ["Traslados privados", "Aeropuertos y estaciones clave", 1200],
    ["Diseño y soporte Routsify", "Coordinación antes y durante el viaje", 950],
  ]
};
