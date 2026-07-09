# Routsify_Software

MVP de Routsify como aplicación nueva con Next.js, TypeScript y Supabase preparado. El despliegue operativo actual se revisa en Netlify; Vercel queda como destino alternativo/histórico.

## Estado actual

- Demo navegable con datos ficticios.
- No usar datos reales hasta completar Supabase real, roles, RLS, storage, pruebas negativas y revisión fiscal.
- Módulos visibles definitivos: Inicio, Clientes, Expedientes, Presupuestos, Compras / Proveedores, Informes y Ajustes.
- Viajeros, documentos, contrato, firma, pago, fiscalidad, tareas y comunicaciones viven dentro de Cliente o Expediente.

## Hardening incorporado

- Middleware para rutas internas y APIs privadas.
- Webhooks con firma HMAC, timestamp e idempotencia por evento externo.
- Upload de documentos con guard de acceso, validación de archivo y organización derivada del contexto.
- Propuesta pública validada antes de renderizar.
- Migración de hardening con campos críticos, auditoría de acceso documental, perfil de usuario y RLS más granular.
- Dependencias sin `latest` para despliegues más reproducibles.

## Arranque local

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Criterio para salir de demo

1. Aplicar migraciones en Supabase real.
2. Crear usuarios internos y perfiles por rol.
3. Validar RLS y acceso por rol.
4. Configurar buckets privados y auditoría de documentos.
5. Probar token público, webhooks duplicados, subida no autorizada y pago duplicado.
6. Activar Holded solo con outbox worker idempotente y revisión fiscal manual.
