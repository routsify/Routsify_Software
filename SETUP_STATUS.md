# Routsify Software — Setup Status

MVP operativo de Routsify construido como app nueva con Next.js, TypeScript, Supabase y Vercel.

## Estado actual

- Proyecto Supabase creado: `Routsify_Software`
- Project ref: `wphiurjzkxbkakiozgvf`
- Región Supabase: `eu-central-1`
- Base de datos inicial aplicada con RLS
- Buckets privados creados: `invoices`, `travel-documents`, `proposal-assets`
- Edge Functions iniciales desplegadas: `form-webhook`, `booking-webhook`

## Variables de entorno públicas

```bash
NEXT_PUBLIC_SUPABASE_URL=https://wphiurjzkxbkakiozgvf.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_TJTif_9FwmW1nsH8uRrvnw_rrBYK6zM
NEXT_PUBLIC_APP_NAME=Routsify Software
NEXT_PUBLIC_BRAND_COLOR=#379237
```

## Pendiente

1. Subir scaffold completo Next.js.
2. Conectar Vercel en entorno preview.
3. Crear autenticación interna y bootstrap de usuario admin.
4. Construir pantallas: dashboard, clientes, expedientes, propuestas, compras esperadas y ajustes.
5. Conectar Fillout y API propia de booking mediante webhooks.
