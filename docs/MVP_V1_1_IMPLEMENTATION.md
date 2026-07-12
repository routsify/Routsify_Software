# Routsify MVP revisado v1.1 — implantación

## Arquitectura

Routsify opera clientes, expedientes, presupuestos, viajeros, contratos, pagos y control de proveedores. Holded recibe o devuelve los objetos fiscales y financieros. Las integraciones se ejecutan por eventos de negocio mediante una outbox idempotente.

## Credenciales

- Holded y OpenAI se configuran desde Ajustes.
- Solo `admin` y `direction` pueden crear, sustituir, probar o eliminar claves.
- El servidor cifra con AES-256-GCM usando AAD por organización y tipo de secreto.
- La tabla `organization_secrets` no concede acceso a `anon` ni `authenticated`.
- Los valores nunca aparecen en respuestas, logs ni auditoría.

## Holded

### Salida

- `contact.sync`
- `estimate.sync`
- `proforma.sync`
- `invoice.sync`
- `purchase.sync`
- `payment.sync`

Cada evento guarda `idempotency_key`, entidad local, entidad Holded, estado, intentos, error y fecha de sincronización.

### Entrada

El job `sync_holded_purchases` lee compras y pagos. Las compras se comparan contra cada compra esperada mediante:

- `EXP_CODE`;
- `budget_line_id` estable;
- proveedor y `holded_contact_id`;
- importe y tolerancia;
- fecha;
- texto del servicio.

Una puntuación fuerte puede marcar la compra como `matched`, pero nunca como `approved`. La aprobación humana actualiza el coste real y recalcula rentabilidad. Los pagos importados solo se vinculan cuando existe una coincidencia conservadora; los demás quedan en revisión manual.

## Política fiscal

- Proveedor de pago actual: enlace Teya introducido manualmente.
- El pago se confirma manualmente con referencia única.
- Requisitos: propuesta aceptada, total válido y contrato firmado.
- Al confirmar pago: contacto, proforma total y pago se encolan para Holded.
- Factura final: fin del viaje +5 días, pago completo, contrato firmado, presupuesto bloqueado, compras completas y sin errores de integración.
- Cierre: requiere factura final emitida.

## Documentos y OCR

- Formatos: PDF, JPG, JPEG, PNG y WEBP.
- Tamaño máximo: 10 MB.
- OCR: OpenAI Responses API con salida estructurada.
- Confianza alta: prellenado para aprobación rápida.
- Confianza media: campo destacado para revisión.
- Confianza baja: no se valida automáticamente.
- Acceso a documentos sensibles y OCR: `admin` y `sales`.
- Retención: 1825 días.
- Al vencer: eliminación del objeto de Storage, purga de valores OCR y limpieza de datos documentales del viajero, con auditoría.

## Inmutabilidad

- La versión aceptada conserva fórmula, reglas, términos, total, coste previsto, beneficio y narrativa.
- Las líneas económicas aceptadas no pueden añadirse, eliminarse o modificar sus campos comerciales.
- El coste real puede actualizarse únicamente mediante compra aprobada o excepción auditada.

## Jobs

- `holded_sync_pending`
- `sync_holded_purchases`
- `pre_trip_supplier_check`
- `post_trip_supplier_check`
- `operational_close_check`
- `privacy_retention_review`

## Pruebas obligatorias

- deduplicación Fillout y Booking;
- aceptación y pago duplicados;
- reintento Holded;
- bloqueo de versión aceptada;
- compra esperada por línea externa;
- match fuerte y dudoso;
- aprobación y recálculo de coste real;
- cierre bloqueado por proveedor;
- OCR con confianza alta, media y baja;
- permisos negativos de documentos;
- purga de retención.
