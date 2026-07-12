# Routsify Software — paso a producción

## Antes del despliegue

1. Ejecutar `npm ci`.
2. Ejecutar `npm run validate:platform`, `npm run typecheck`, `npm run lint` y `npm run build`.
3. Confirmar que todas las migraciones están aplicadas en `Routsify_Software`.
4. Confirmar RLS y buckets privados.
5. Confirmar variables de Vercel.
6. Publicar una única actualización de `main`.

## Variables obligatorias en Vercel

- `NEXT_PUBLIC_DEMO_MODE=false`
- `ROUTSIFY_ALLOW_PUBLIC_DEMO=false`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ROUTSIFY_SECRETS_ENCRYPTION_KEY` (32+ caracteres; mantener estable para poder descifrar las claves guardadas)
- `ROUTSIFY_DEFAULT_ORGANIZATION_ID`
- `PROPOSAL_TOKEN_SECRET`
- `FORM_WEBHOOK_SECRET`
- `BOOKING_WEBHOOK_SECRET`
- `PAYMENT_WEBHOOK_SECRET`
- `HOLDED_WEBHOOK_SECRET`
- `ROUTSIFY_INTERNAL_API_TOKEN`
- `OUTBOX_WORKER_SECRET`

Las API keys de Holded y OpenAI no se guardan como variables de Vercel: se introducen desde Ajustes y se almacenan cifradas por organización.

## Primera configuración en la aplicación

1. Entrar con un usuario `admin`.
2. Abrir Ajustes.
3. Guardar la API key de Holded.
4. Probar Holded y verificar contactos, presupuestos, proformas, facturas, compras y pagos.
5. Guardar la API key de OpenAI.
6. Probar OpenAI.
7. Crear un expediente de prueba completo y validar el flujo.

## Seguridad de Supabase Auth

La protección contra contraseñas filtradas requiere un plan Supabase Pro o superior. En un proyecto Free no puede activarse. Al actualizar el plan: **Authentication → Providers → Email → Password security → Prevent use of leaked passwords**.

## Smoke test de producción

- `/api/health` responde 200.
- Login y recuperación de contraseña.
- Alta/edición de cliente.
- Expediente con `EXP_CODE`.
- Presupuesto, envío y aceptación.
- Contrato y firma.
- Teya manual y confirmación de pago.
- Proforma Holded.
- Compra esperada y conciliación.
- Factura final tras preflight.
- OCR y revisión.
- Permisos de rol y documento privado.
