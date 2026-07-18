# Holded API v2 · configuración de Routsify

Routsify utiliza la API actual de Holded:

- Base URL: `https://api.holded.com`
- Autenticación: `Authorization: Bearer API_KEY`
- Contactos: `/api/v2/contacts`
- Presupuestos: `/api/v2/estimates`
- Proformas: `/api/v2/proformas`
- Facturas: `/api/v2/invoices`
- Compras: `/api/v2/purchases`
- Pagos y cobros: `/api/v2/payments`

La API v1 anterior (`/invoicing/v1/...` y cabecera `key`) está obsoleta y no debe utilizarse con las claves actuales.

## Crear la clave

En Holded:

1. Abrir **Ajustes → API**.
2. Crear una nueva clave de automatización.
3. Activar los permisos de lectura y escritura necesarios.
4. Copiar la clave una sola vez.
5. Guardarla en Routsify desde **Ajustes → Integraciones → Holded**.

## Permisos necesarios

Para que todas las funciones de Routsify trabajen correctamente, la clave debe incluir:

### Contactos

- `contacts:contacts.read`
- `contacts:contacts.write`

### Presupuestos

- `sales:estimates.read`
- `sales:estimates.write`

### Proformas

- `sales:proforms.read`
- `sales:proforms.write`

### Facturas

- `sales:invoices.read`
- `sales:invoices.write`

### Compras

- `accounting:purchases.read`
- `accounting:purchases.write`

### Pagos y cobros

- `accounting:payments.read`
- `accounting:payments.write`

El botón **Probar conexión** comprueba los permisos de lectura sin crear datos. Los permisos de escritura se validan durante las pruebas controladas de contacto, presupuesto, proforma, factura, compra y cobro.

## Diagnóstico

- `401`: clave ausente, inválida, revocada o copiada de forma incompleta.
- `403`: clave válida, pero falta el permiso indicado por Routsify.
- `422`: los datos enviados no cumplen el esquema de Holded.
- `429`: se ha alcanzado un límite; Routsify respeta `Retry-After` y aplica backoff en lecturas.

## Reglas de seguridad

- La clave se almacena cifrada en Supabase Vault.
- Nunca se entrega al navegador.
- Solo se envía a `https://api.holded.com` por HTTPS.
- Las operaciones de creación no se reintentan automáticamente dentro de la misma petición para evitar duplicados si Holded procesó la solicitud antes de un timeout.
- Las lecturas respetan los límites y cabeceras de cuota de Holded.

## Correspondencia de datos

### Cliente

Routsify crea un contacto Holded de tipo `client` y conserva el `holded_contact_id`.

### Proveedor

Antes de crear una compra, Routsify crea o reutiliza el contacto Holded de tipo `supplier` y guarda el identificador en el proveedor maestro.

### Documentos

Los documentos usan el esquema v2:

- `contact_id`
- `description`
- `date`
- `due_date`
- `currency`
- `items[].type = service`
- `items[].price`

### Pagos

Los pagos confirmados de clientes se envían como `collection`. Teya continúa siendo la fuente de verificación manual del cobro; Holded recibe el movimiento después de confirmarlo en Routsify.
