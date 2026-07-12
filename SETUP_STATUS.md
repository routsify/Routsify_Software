# Routsify Software — estado de implantación

## Infraestructura

- Supabase: `Routsify_Software` (`wphiurjzkxbkakiozgvf`, `eu-central-1`).
- Vercel: proyecto `routsify-software` conectado a `main`.
- Base de datos: esquema MVP v1.1, RLS, almacenamiento privado y auditoría.
- Integraciones: Fillout, Routsify Booking, Holded, OpenAI OCR y pago Teya manual.

## Política operativa

- Proforma total al confirmar el pago.
- Factura final después del viaje +5 días y con proveedores completos.
- Documentos sensibles accesibles a `admin` y `sales`.
- Retención documental: cinco años.
- Claves Holded/OpenAI cifradas y configurables desde Ajustes.

## Validación antes de cada publicación

```bash
npm ci
npm run validate:platform
npm run typecheck
npm run lint
npm run build
```

## Configuración externa pendiente de negocio

- Introducir y probar API key de Holded desde Ajustes.
- Introducir y probar API key de OpenAI desde Ajustes.
- Activar protección de contraseñas filtradas cuando Supabase se actualice a Pro o superior.
