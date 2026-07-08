# Routsify_Software

MVP inicial de Routsify como aplicación nueva con Next.js, TypeScript, Supabase y Vercel.

## Estado actual

- Aplicación desplegada en Vercel.
- Integración GitHub a Vercel activa: cada commit a `main` despliega producción.
- Interfaz estable en modo demo con datos ficticios.
- Supabase está preparado a nivel de código, migraciones y Edge Functions, pero las variables reales se activarán más adelante.
- Hasta activar Supabase real, mantener `NEXT_PUBLIC_DEMO_MODE=true`.

## Flujo MVP cubierto

1. Cliente
2. Expediente
3. Presupuesto nativo con margen por línea
4. Propuesta pública visual
5. Compras esperadas por proveedor
6. Subida manual de factura proveedor
7. Revisión de cierre operativo
8. Preparación para integración conservadora con Holded

## Pantallas incluidas

- Dashboard operativo
- Clientes con campos base del modelo y alta rápida demo
- Expedientes con estado, próxima acción, bloqueos y alta operativa demo
- Propuestas internas con presupuesto nativo y margen por línea
- Propuesta pública visual y profesional
- Compras esperadas, subida manual de factura y checklist de conciliación
- Tipos de servicio configurables desde backoffice
- Login preparado para Supabase Auth, protegido para no romper en modo demo

## Colores y marca

- Color principal: `#379237`
- Fondo: blanco / soft green
- Marca temporal por componente. El logo definitivo debe subirse como `public/logo.png` o SVG cuando se incorpore el asset binario al repo.

## Arranque local

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Variables de entorno

Mantener demo mientras se completa el esqueleto funcional:

```bash
NEXT_PUBLIC_APP_NAME=Routsify Software
NEXT_PUBLIC_BRAND_COLOR=#379237
NEXT_PUBLIC_DEMO_MODE=true
```

Cuando se active Supabase real se añadirán las variables públicas de Supabase y las claves privadas de webhooks/integraciones en Vercel.

## Integraciones previstas

- Fillout: `form-webhook`
- Booking API propia: `booking-webhook`
- Pagos: manual/transferencia al inicio; Teya webhook queda para fase posterior.
- Holded: preparado a nivel de modelo con `integration_outbox`, `holded_contact_id`, `holded_document_id` y estados de sync.

## Criterio para salir de modo demo

1. Confirmar proyecto Supabase real y variables públicas válidas.
2. Aplicar migraciones en el proyecto correcto.
3. Crear usuarios internos en Supabase Auth.
4. Validar RLS y perfiles por rol.
5. Configurar buckets privados para documentos/facturas.
6. Probar login, lectura y escritura con usuario no administrador.
