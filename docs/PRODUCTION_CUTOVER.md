# Routsify Software - checklist de paso a producción

## Estado objetivo

La versión final debe funcionar sin datos demo, con Supabase Auth, base de datos real, RLS, storage privado, propuesta pública con token, webhooks firmados, outbox y variables de entorno reales.

## Política de despliegue

- No se publica manualmente desde el código.
- Vercel y Netlify hacen deploy automático cuando se actualiza GitHub.
- El repositorio solo contiene comandos de build y validación.
- GitHub Actions queda como validación manual opcional, no como deploy.

## Pasos obligatorios antes de publicar

1. Confirmar proyecto Supabase definitivo.
2. Aplicar todas las migraciones del directorio `supabase/migrations`.
3. Crear o validar el usuario administrador en Supabase Auth.
4. Iniciar sesión una vez para ejecutar `ensure_profile_for_current_user` si hace falta.
5. Revisar que el usuario queda asociado a la organización correcta.
6. Configurar variables de entorno en Vercel y/o Netlify.
7. Desactivar modo demo.
8. Ejecutar validación local o GitHub Actions manual.
9. Subir cambios a GitHub para que Vercel/Netlify publiquen automáticamente.
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
- No ejecutar deploy manual desde herramientas externas si Vercel/Netlify ya están conectados a GitHub.
