# Routsify Software - checklist de paso a producción

## Estado objetivo

La versión final debe funcionar sin datos demo, con Supabase Auth, base de datos real, RLS, storage privado, propuesta pública con token, webhooks firmados, outbox y variables de entorno reales.

## Pasos obligatorios antes de publicar

1. Crear o confirmar proyecto Supabase definitivo.
2. Aplicar todas las migraciones del directorio `supabase/migrations`.
3. Crear el primer usuario administrador en Supabase Auth.
4. Iniciar sesión una vez para ejecutar `ensure_profile_for_current_user`.
5. Revisar que el usuario queda asociado a la organización correcta.
6. Configurar variables de entorno en Netlify y Vercel.
7. Desactivar modo demo.
8. Ejecutar validación local o CI.
9. Hacer deploy final.
10. Probar rutas principales con usuario real.

## Variables obligatorias

- NEXT_PUBLIC_DEMO_MODE=false
- ROUTSIFY_ALLOW_PUBLIC_DEMO=false
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- SUPABASE_SERVICE_ROLE_KEY
- PROPOSAL_TOKEN_SECRET
- FORM_WEBHOOK_SECRET
- BOOKING_WEBHOOK_SECRET
- ROUTSIFY_INTERNAL_API_TOKEN

## Rutas visibles finales

- Inicio
- Clientes
- Expedientes
- Presupuestos
- Compras / Proveedores
- Informes
- Ajustes

## No hacer

- No meter datos reales con modo demo activo.
- No publicar sin usuario administrador creado.
- No activar Holded automático sin outbox validado.
- No activar fiscalidad automática sin revisión manual.
