# Routsify Software

Plataforma operativa de Routsify construida con Next.js, TypeScript y Supabase. Routsify mantiene la verdad de la operación del viaje; Holded conserva la verdad fiscal y contable.

## Flujo principal

- **Hoy**: prioridades, tareas y estado operativo.
- **Solicitudes**: revisión de leads de Fillout, resultado comercial y archivo reversible.
- **Expedientes**: viaje, viajeros, documentos, contrato, pagos, tareas y cronología.
- **Presupuestos**: escenarios, líneas, versiones, aceptación y enlaces públicos firmados.
- **Compras**: costes previstos, facturas privadas, conciliación y coste real.
- **Clientes y proveedores**: fichas 360, importación y relaciones operativas.
- **Comunicaciones**: seguimientos, plantillas, email y WhatsApp.
- **Control, informes y automatizaciones**: supervisión y decisiones.
- **Ajustes**: organización, usuarios, políticas e integraciones.

Los antiguos accesos independientes de contratos, documentos, facturación, tareas, viajeros, integraciones y seguridad se conservan como redirecciones compatibles, pero no duplican navegación ni pantallas.

## Arranque local

Requiere Node.js 24.

```bash
cp .env.example .env.local
npm ci
npm run validate:platform
npm run typecheck
npm run build
npm run dev -- --hostname 127.0.0.1
```

La aplicación nunca activa el modo demo de forma implícita. No uses datos reales con `NEXT_PUBLIC_DEMO_MODE=true` o `ROUTSIFY_ALLOW_PUBLIC_DEMO=true`.

Para Supabase se recomienda `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en navegador y `SUPABASE_SECRET_KEY` en servidor. Las claves heredadas continúan admitidas durante la transición.

## Base de datos

- `supabase/migrations/` reproduce el historial autoritativo del proyecto remoto en orden cronológico.
- `supabase/config.toml` permite trabajar con la CLI de Supabase.
- `lib/database.types.ts` contiene los tipos generados del esquema vivo.
- `supabase/seed.sql` se reserva exclusivamente para datos sintéticos.

Las migraciones deben añadirse; no se editan las ya aplicadas. Ejecuta `npm run validate:migrations` antes de publicar.

## Calidad

```bash
npm run lint
npm run typecheck
npm run validate:platform
npm run quality:dead-code
npm run build
npm run test:e2e
```

`validate:platform` comprueba los contratos funcionales, la seguridad, Holded v2, Booking, los controles de UI y las 106 migraciones ordenadas. El validador de UI rechaza botones sin tipo o acción, formularios desconectados y elementos no semánticos clicables. Knip bloquea archivos o dependencias sin uso.

Las pruebas E2E ejecutan Chromium de escritorio y móvil contra un despliegue de Vercel. Las credenciales y el bypass de automatización se configuran como secretos de GitHub, nunca en el repositorio.

La certificación operativa exhaustiva se ejecuta de forma serializada únicamente después de un despliegue de Production autorizado y utiliza datos marcados como sintéticos.

## Despliegue

Vercel es el único destino de despliegue. GitHub Actions usa Node.js 24 y ejecuta instalación reproducible con `npm ci`, validaciones, TypeScript y build. Antes de promover a producción:

1. Confirmar que las migraciones remotas y locales coinciden.
2. Verificar variables de entorno en Preview y Production.
3. Probar autenticación y permisos por rol.
4. Verificar URLs firmadas, buckets privados, caducidad y auditoría.
5. Probar idempotencia de webhooks, aceptación, pagos y reintentos Holded.
6. Mantener fiscalidad en `manual_review` hasta la validación de asesoría.
7. Revisar logs, errores y smoke tests del despliegue.

Documentación operativa adicional:

- `docs/PRODUCTION_CUTOVER.md`
- `docs/SCHEDULED_JOBS.md`
- `docs/THIRD_PARTY_INTEGRATIONS.md`
- `docs/ROUTSIFY_BOOKING_API.md`

## Endpoints de salud

- `GET /api/health`: salud pública sin información sensible.
- `GET /api/health/internal`: diagnóstico protegido.
