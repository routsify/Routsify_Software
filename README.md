# Routsify_Software

MVP de Routsify como aplicación nueva con Next.js, TypeScript y Supabase preparado. El despliegue operativo actual se revisa en Netlify; Vercel queda como destino alternativo/histórico.

## Estado actual

- Demo navegable con datos ficticios.
- Login real aparcado hasta activar Supabase Auth, perfiles y RLS.
- No usar datos reales hasta completar Supabase real, roles, RLS, storage, pruebas negativas y revisión fiscal.
- Módulos visibles definitivos: Inicio, Clientes, Expedientes, Presupuestos, Compras / Proveedores, Informes y Ajustes.
- Viajeros, documentos, contrato, firma, pago, fiscalidad, tareas y comunicaciones viven dentro de Cliente o Expediente.

## Hardening incorporado

- Middleware para rutas internas y APIs privadas.
- Health público mínimo y health interno protegido en `/api/health/internal`.
- Webhooks con firma HMAC, timestamp e idempotencia por evento externo.
- Upload de documentos con guard de acceso, validación de archivo y organización derivada del contexto.
- Confirmación post-upload documental con metadatos, retención y auditoría preparada.
- Propuesta pública validada antes de renderizar y preparada para resolver versión real desde Supabase.
- Outbox worker preparado para procesar eventos con estados `processing`, `done`, `failed` y `manual_review`.
- Migraciones de hardening con campos económicos, auditoría de acceso documental, settings persistentes, perfil de usuario y RLS más granular.
- Dependencias sin `latest`; CI genera lockfile temporal y ejecuta `npm ci` hasta commitear un lockfile completo.

## Arranque local

```bash
cp .env.example .env.local
npm install
npm run validate:deploy
npm run typecheck
npm run build
npm run dev
```

## Endpoints técnicos preparados

- `GET /api/health`: salud pública mínima.
- `GET /api/health/internal`: salud interna protegida.
- `POST /api/documentos/upload-url`: URL firmada de subida.
- `POST /api/documentos/confirm-upload`: registro documental post-subida.
- `POST /api/routsify/outbox/process`: worker outbox protegido.
- `POST /api/webhooks/forms`: webhook Fillout con HMAC.
- `POST /api/webhooks/bookings`: webhook Booking con HMAC.

## Criterio para salir de demo

1. Aplicar migraciones `0001` a `0005` en Supabase real.
2. Crear usuarios internos y perfiles por rol.
3. Validar RLS y acceso por rol con pruebas negativas.
4. Configurar buckets privados y auditoría de documentos.
5. Probar token público, webhooks duplicados, subida no autorizada, confirm-upload y pago duplicado.
6. Activar Holded solo con outbox worker idempotente y revisión fiscal manual.
7. Cambiar `ROUTSIFY_ALLOW_PUBLIC_DEMO=false` y `NEXT_PUBLIC_DEMO_MODE=false` solo cuando Supabase Auth esté validado.
