# Routsify_Software

MVP inicial de Routsify como aplicación nueva con Next.js, Supabase y Vercel.

## Estado actual

- Proyecto Supabase creado: `Routsify_Software`
- Project ref: `wphiurjzkxbkakiozgvf`
- URL pública Supabase: `https://wphiurjzkxbkakiozgvf.supabase.co`
- Esquema MVP aplicado con RLS, buckets privados y datos ficticios.
- Edge Functions desplegadas: `form-webhook` y `booking-webhook`.
- Interfaz local en modo demo con datos ficticios.

## Pantallas incluidas

- Dashboard operativo
- Clientes con todos los campos base del modelo
- Expedientes con estado, próxima acción y bloqueos
- Compras esperadas
- Tipos de servicio configurables desde backoffice
- Propuesta pública visual y profesional

## Colores y marca

- Color principal: `#379237`
- Fondo: blanco / soft green
- Logo: `public/logo.png`

## Arranque local

```bash
cp .env.example .env.local
npm install
npm run dev
```

Abre `http://localhost:3000`.

## Próximos pasos

1. Conectar repo a Vercel para preview automático.
2. Configurar `WEBHOOK_SECRET` en Supabase antes de conectar Fillout o la API de booking.
3. Crear usuarios reales en Supabase Auth y asociarlos a `profiles` con roles.
4. Cambiar `NEXT_PUBLIC_DEMO_MODE=false` cuando se conecten las pantallas a Supabase con login.

## Integraciones previstas

- Fillout: `/functions/v1/form-webhook`
- Booking API propia: `/functions/v1/booking-webhook`
- Pagos: manual/transferencia al inicio; Teya webhook queda para fase posterior.
- Holded: preparado a nivel de modelo con `integration_outbox`, `holded_contact_id`, `holded_document_id` y estados de sync.
