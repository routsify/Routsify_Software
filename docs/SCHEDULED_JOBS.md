# Jobs programados de Routsify

Los jobs se ejecutan mediante `POST /api/routsify/jobs/run` con `x-routsify-internal-token`.

| Job | Frecuencia recomendada | Función |
|---|---:|---|
| `holded_sync_pending` | Cada 15 minutos | Procesa la outbox con backoff e idempotencia. |
| `sync_holded_purchases` | Cada hora y manual | Importa compras/pagos, puntúa candidatos y deja revisión humana. |
| `pre_trip_supplier_check` | Diario | Anticipa documentación de proveedor pendiente. |
| `post_trip_supplier_check` | Diario | Reclama facturas tras el viaje. |
| `operational_close_check` | Diario | Ejecuta preflight, encola factura final y cierra después de emisión. |
| `privacy_retention_review` | Mensual | Elimina archivos y datos documentales vencidos. |

## Reglas

- Nunca ejecutar con una frecuencia inferior a cinco minutos.
- No procesar dos veces el mismo `idempotency_key`.
- Los errores 429/5xx aplican backoff.
- Tras agotar reintentos, el evento pasa a `manual_review`.
- Una coincidencia de compra no se aprueba automáticamente.
