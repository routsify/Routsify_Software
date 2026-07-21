# Routsify Software - checklist de paso a producción

## Estado objetivo

La versión final debe funcionar sin datos demo, con Supabase Auth, base de datos real, RLS, storage privado, propuesta pública con token, webhooks firmados, outbox y variables de entorno reales.

## Política de despliegue

- Vercel es el único destino de despliegue.
- La rama `main` publica producción mediante la integración GitHub → Vercel.
- Cada cambio debe superar CI, CodeQL, Knip, build y smoke E2E antes de considerarse operativo.
- La certificación completa de venta solo se ejecuta de forma explícita con el marcador `[certify-production]` o mediante `workflow_dispatch`.
- El workflow escucha únicamente `deployment_status` de Production para no duplicar pruebas por cada `push`.
- Si Vercel devuelve `build-rate-limit`, espera a que expire su ventana móvil y realiza un solo nuevo disparo Git; no encadenes commits ni deploys manuales.

## Pasos obligatorios antes de publicar

1. Confirmar proyecto Supabase definitivo.
2. Aplicar todas las migraciones del directorio `supabase/migrations`.
3. Crear o validar el usuario administrador en Supabase Auth.
4. Iniciar sesión una vez para ejecutar `ensure_profile_for_current_user` si hace falta.
5. Revisar que el usuario queda asociado a la organización correcta.
6. Configurar variables de entorno en Vercel para Preview y Production.
7. Desactivar modo demo.
8. Ejecutar `npm run validate:platform`, `npm run typecheck` y `npm run build`.
9. Fusionar mediante pull request para que Vercel publique automáticamente.
10. Confirmar `GET /api/health`, logs sin errores y Playwright Smoke en verde.
11. Antes del lanzamiento, ejecutar una certificación operativa controlada y revisar que el outbox quede sin fallos.

## Variables obligatorias

- `NEXT_PUBLIC_DEMO_MODE=false`
- `ROUTSIFY_ALLOW_PUBLIC_DEMO=false`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (preferida) o `SUPABASE_SERVICE_ROLE_KEY` durante la transición
- `ROUTSIFY_DEFAULT_ORGANIZATION_ID`
- `PROPOSAL_TOKEN_SECRET`
- `ROUTSIFY_INTERNAL_API_TOKEN`
- `CRON_SECRET`
- Secretos de webhook aplicables: `FORM_WEBHOOK_SECRET`, `BOOKING_WEBHOOK_SECRET`, `PAYMENT_WEBHOOK_SECRET` y `HOLDED_WEBHOOK_SECRET`

## Rutas visibles finales

- Hoy
- Control
- Clientes
- Solicitudes
- Expedientes
- Propuestas
- Compras
- Proveedores
- Comunicaciones
- Automatizaciones
- Informes
- Ajustes

## No hacer

- No meter datos reales con modo demo activo.
- No publicar sin usuario administrador creado.
- No activar Holded automático sin outbox validado.
- No considerar firmado un contrato sin versión bloqueada y evidencia de firma.
- Adjuntar los PDFs reales desde `Ajustes → Documentación legal`, comprobar que el contrato de viaje correcto figure como vigente y no usar URLs externas como documento contractual.
- No ejecutar cargos reales durante una certificación: los cobros de prueba se registran como referencias manuales inequívocas.
- No ejecutar deploy manual si Vercel ya está conectado a GitHub.
