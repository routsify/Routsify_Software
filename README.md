# Routsify Software

MVP operativo de Routsify construido con Next.js, TypeScript y Supabase. Holded se mantiene como fuente fiscal/contable y Routsify como fuente de verdad de la operación del viaje.

## Estado

La rama del MVP incorpora autenticación y roles, clientes/leads/bookings con deduplicación, expedientes, presupuesto nativo y versionado, propuesta pública segura, compras esperadas, facturas de proveedor privadas, pagos, fiscalidad en `manual_review`, outbox Holded, jobs, cierre operativo e informes mínimos.

No se deben usar datos reales mientras `NEXT_PUBLIC_DEMO_MODE` o `ROUTSIFY_ALLOW_PUBLIC_DEMO` estén activos.

## Módulos principales

- Inicio
- Clientes
- Expedientes
- Presupuestos
- Compras / Proveedores
- Informes
- Ajustes

Viajeros, documentos, contrato, pago, tareas y comunicaciones se gestionan dentro del expediente.

## Arranque local

```bash
cp .env.example .env.local
npm ci
npm run validate:platform
npm run typecheck
npm run build
npm run dev
```

## Validaciones

- `npm run validate:mvp`: comprueba piezas funcionales y de seguridad obligatorias.
- `npm run validate:migrations`: comprueba versiones únicas y contenido crítico del esquema.
- `npm run validate:platform`: ejecuta ambas validaciones y revisa la configuración de despliegue.
- `npm run typecheck`: valida TypeScript.
- `npm run build`: genera el build de Next.js.

GitHub Actions ejecuta validación, typecheck y build en pull requests y cambios a `main`.

## Despliegue

Vercel/Netlify pueden desplegar automáticamente desde GitHub. La aplicación requiere Supabase real, migraciones aplicadas, usuarios/perfiles por rol, buckets privados y secretos configurados. La integración Holded y los jobs se activan solo después de validarlos en staging.

Documentación:

- `docs/MVP_GAP_AUDIT_AND_PHASES.md`
- `docs/PRODUCTION_CUTOVER.md`
- `docs/SCHEDULED_JOBS.md`

## Endpoints técnicos principales

- `GET /api/health`
- `GET /api/health/internal`
- `POST /api/documentos/upload-url`
- `POST /api/documentos/confirm-upload`
- `POST /api/routsify/outbox/process`
- `POST /api/routsify/jobs/run`
- `POST /api/webhooks/forms`
- `POST /api/webhooks/bookings`
- `POST /api/webhooks/payments`
- `POST /api/webhooks/holded`

## Criterio de salida de demo

1. Aplicar migraciones en staging y luego producción.
2. Crear usuarios y perfiles por rol.
3. Probar RLS con casos positivos y negativos.
4. Probar buckets privados, URLs firmadas, caducidad y auditoría.
5. Probar webhooks duplicados, aceptación duplicada, pago duplicado y reintentos Holded.
6. Mantener fiscalidad en `manual_review` hasta validación de asesoría.
7. Configurar jobs y observar ejecuciones.
8. Establecer `NEXT_PUBLIC_DEMO_MODE=false` y `ROUTSIFY_ALLOW_PUBLIC_DEMO=false`.
