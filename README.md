# Routsify Software

Sistema operativo interno para una agencia de viajes a medida. Routsify es la fuente de verdad operativa; Holded conserva la realidad fiscal, financiera y contable.

## MVP revisado v1.1

La aplicación incluye:

- autenticación Supabase, aislamiento por organización y roles;
- clientes, Fillout y Routsify Booking con deduplicación;
- expedientes con estado, siguiente acción, bloqueo, prioridad, responsable y timeline;
- presupuesto nativo, fórmulas versionadas y reglas de margen;
- propuestas privadas, versiones, aceptación y bloqueo económico;
- compras esperadas, facturas de proveedor, conciliación Holded y coste real aprobado;
- contratos versionados, evidencias de firma y enlaces de pago Teya manuales;
- confirmación manual de pagos, proforma total al cobro y factura final tras viaje +5 días;
- sincronización Holded de contactos, presupuestos, proformas, facturas, compras y pagos;
- OCR con OpenAI, confianza por campo y revisión humana;
- documentos privados, retención de cinco años, purga y auditoría;
- jobs, outbox idempotente, reporting operativo y preflight de cierre.

No se deben usar datos reales mientras `NEXT_PUBLIC_DEMO_MODE` o `ROUTSIFY_ALLOW_PUBLIC_DEMO` estén activos.

## Configuración de API keys

Las claves de Holded y OpenAI se introducen desde **Ajustes → Claves de integraciones**. Se cifran en el servidor con AES-256-GCM y nunca se devuelven al navegador ni se almacenan en texto plano. En producción se recomienda fijar `ROUTSIFY_SECRETS_ENCRYPTION_KEY` para que una rotación de la clave de servicio de Supabase no afecte a las credenciales guardadas.

La prueba de Holded verifica los seis módulos requeridos. Si un endpoint o permiso no está disponible en la cuenta, el sistema devuelve el módulo concreto que necesita revisión y no crea duplicados.

## Política fiscal configurada

1. El pago se confirma manualmente desde el presupuesto aceptado y con contrato firmado.
2. Se crea una única proforma en Holded por el total aceptado del viaje.
3. Las compras de proveedores se importan y concilian con revisión humana.
4. La factura final solo se encola cuando han transcurrido cinco días desde el fin del viaje y todas las compras obligatorias están `approved`, `not_required` o `cancelled`.
5. El expediente solo se cierra después de que la factura final esté emitida.

## Desarrollo

```bash
cp .env.example .env.local
npm ci
npm run validate:platform
npm run typecheck
npm run lint
npm run build
npm run dev
```

## Validaciones

- `npm run validate:mvp`: contrato estático de funcionalidades y seguridad.
- `npm test`: pruebas automatizadas del MVP v1.1.
- `npm run validate:platform`: validación del MVP, pruebas y configuración de despliegue.
- `npm run typecheck`: TypeScript.
- `npm run lint`: ESLint.
- `npm run build`: build de producción de Next.js.

GitHub Actions ejecuta validación, typecheck y build en pull requests y cambios a `main`.

## Endpoints principales

- `GET /api/health`
- `GET /api/health/internal`
- `PATCH /api/routsify/settings/secrets`
- `POST /api/routsify/settings/integrations/holded/test`
- `POST /api/routsify/settings/integrations/openai/test`
- `POST /api/documentos/upload-url`
- `POST /api/documentos/confirm-upload`
- `POST /api/routsify/documents/:documentId/ocr`
- `POST /api/routsify/expected-purchases/:purchaseId/find-candidates`
- `POST /api/payments/manual`
- `POST /api/routsify/outbox/process`
- `POST /api/routsify/jobs/run`
- `POST /api/webhooks/forms`
- `POST /api/webhooks/bookings`
- `POST /api/webhooks/payments`
- `POST /api/webhooks/holded`

## Documentación

- `docs/MVP_V1_1_IMPLEMENTATION.md`
- `docs/PRODUCTION_CUTOVER.md`
- `docs/SCHEDULED_JOBS.md`
