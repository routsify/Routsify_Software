# Configuración de integraciones de Routsify

Esta guía utiliza la pantalla **Ajustes → Integraciones**. Las credenciales se guardan cifradas en Supabase Vault por organización. No deben enviarse por chat, correo, tickets ni guardarse en GitHub.

## 1. Hostinger Mail por SMTP

Routsify usa directamente el buzón de Hostinger; no necesita Resend.

### Preparación en Hostinger

1. En hPanel, abre **Emails** y crea o elige el buzón remitente.
2. Verifica que el dominio tenga MX, SPF y DKIM correctos.
3. Confirma que puedes iniciar sesión en Webmail con ese buzón.
4. Ten preparada la dirección completa y su contraseña.

### Configuración en Routsify

En **Ajustes → Integraciones**:

- Activar email: sí.
- Servidor SMTP: `smtp.hostinger.com`.
- Puerto: `465`.
- Nombre remitente: `Routsify`.
- Email remitente: el buzón completo de Hostinger.
- Reply-To: el buzón donde quieras recibir respuestas.
- `Hostinger Mail · usuario SMTP`: la dirección completa del buzón.
- `Hostinger Mail · contraseña SMTP`: la contraseña del buzón.

Guarda primero la configuración general y ambas credenciales. Después pulsa **Probar conexión** en la tarjeta de contraseña SMTP.

La implementación actual utiliza SSL directo en el puerto 465. Hostinger también ofrece 587 con STARTTLS, pero Routsify no lo activa todavía para evitar degradaciones accidentales de seguridad.

### Primera prueba

1. Crea una comunicación de prueba dirigida a un correo controlado.
2. Pulsa **Enviar email** desde Comunicaciones.
3. Verifica recepción, carpeta de spam, remitente y Reply-To.
4. Comprueba que la comunicación cambia a enviada y la tarea queda completada.

## 2. WhatsApp Business Cloud API de Meta

### Datos necesarios de Meta

Desde Meta Developers y WhatsApp Manager obtiene:

- Versión de Graph API que estés utilizando.
- Phone Number ID.
- WhatsApp Business Account ID (WABA ID).
- Token permanente de un usuario del sistema.
- App Secret de la aplicación.
- Un verify token elegido por ti.

El token debe tener al menos el permiso `whatsapp_business_messaging`; para consultar y administrar activos suele utilizarse también `whatsapp_business_management`.

### Configuración en Routsify

En **Ajustes → Integraciones**:

- Activar WhatsApp: sí.
- Versión Graph API: la indicada en tu configuración de Meta, con formato `vXX.0`.
- Phone Number ID: solo el identificador numérico, no el teléfono visible.
- WhatsApp Business Account ID: identificador numérico del WABA.
- `Meta WhatsApp · access token`: token permanente del usuario del sistema.
- `Meta WhatsApp · verify token`: una cadena secreta elegida por ti.
- `Meta WhatsApp · app secret`: App Secret de Meta Developers.

Guarda primero la configuración y después las tres credenciales. Pulsa **Probar conexión** en la tarjeta del access token.

### Webhook en Meta

Configura el callback:

`https://routsify-software.vercel.app/api/webhooks/whatsapp`

- Verify token: exactamente el guardado en Routsify.
- Suscripción: campo `messages`.

El endpoint valida el reto GET de Meta y verifica la firma `x-hub-signature-256` de cada POST con el App Secret.

### Primera prueba

1. Utiliza un destinatario autorizado para pruebas.
2. Para probar texto libre, inicia primero una conversación desde el teléfono destinatario hacia el número de empresa, de forma que exista una ventana de atención activa.
3. Genera una comunicación de WhatsApp en Routsify.
4. Pulsa **Enviar WhatsApp**.
5. Comprueba en Routsify los cambios de enviado, entregado, leído y respondido.

La versión actual envía texto libre. Los mensajes iniciados por la empresa fuera de la ventana permitida por Meta requieren plantillas de WhatsApp aprobadas; ese será un bloque adicional antes de automatizar campañas o recordatorios fuera de conversación.

## 3. Fillout

### Configuración en Routsify

1. En **Ajustes → Integraciones**, completa:
   - ID del formulario Fillout.
   - URL pública del formulario.
   - Nombre del origen.
2. En la tarjeta `API Key de Fillout`, pega y guarda la clave REST de la cuenta que puede consultar el formulario.
3. Copia la URL mostrada:

`https://routsify-software.vercel.app/api/webhooks/forms`

### Configuración en Fillout

En el formulario:

1. Abre **Integrate → Webhook**.
2. Introduce la URL anterior.
3. Activa la vista avanzada.
4. Añade el header:
   - Nombre: `Authorization`
   - Valor: `Bearer TU_API_KEY_DE_FILLOUT`
5. Ejecuta el test de Fillout y termina la configuración.

Routsify prueba primero el endpoint global y cambia automáticamente a `eu-api.fillout.com` cuando Fillout indica que el formulario está alojado en la región europea.

### Campos recomendados

Routsify reconoce, entre otros:

- `submission_id` o `submissionId`
- `name` o `full_name`
- `email`
- `phone`
- `destination` o `destino`
- `travel_start` / `travel_end`
- `travelers`
- `budget` o `presupuesto`
- `campaign` o `utm_campaign`

Tras una entrega válida debe crear o relacionar el cliente, registrar el lead, completar el recordatorio pendiente y crear la tarea para revisar el formulario. No crea un expediente automáticamente.

## 4. Routsify Booking

El sistema de Booking debe enviar POST a:

`https://routsify-software.vercel.app/api/webhooks/bookings`

### Firma obligatoria

1. Crea un secreto y guárdalo en `Routsify Booking · secreto HMAC`.
2. En cada petición calcula:

`HMAC_SHA256(secreto, timestamp_unix + "." + cuerpo_json_exacto)`

3. Envía los headers:
   - `x-routsify-signature: sha256=FIRMA_HEX`
   - `x-routsify-timestamp: TIMESTAMP_UNIX`
   - `x-routsify-event-id: ID_UNICO_DEL_EVENTO`

La firma se calcula con el cuerpo exacto que se transmite, sin volver a serializarlo después.

### Campos mínimos

- `external_booking_id` o `booking_id`
- `event_type`
- `event_timestamp`
- `name` o `invitee_name`
- `email`
- `phone`
- `starts_at`
- `ends_at`
- `status`

Para cancelaciones, utiliza un `event_type` o `status` que contenga `cancel`/`cancelled`. Routsify mantiene la idempotencia mediante el identificador y timestamp del evento.

## 5. Holded

### Preparación

1. Genera una API key desde tu cuenta de Holded con acceso al módulo de facturación.
2. No uses una clave compartida en documentos o automatizaciones externas.
3. Guarda la clave en **Ajustes → Integraciones → Holded**.
4. Pulsa **Probar conexión**.

La prueba consulta con límite 1 los módulos:

- Contactos.
- Presupuestos (`estimate`).
- Proformas (`proform`).
- Facturas (`invoice`).
- Compras (`purchase`).
- Pagos.

### Prueba controlada

1. Crea un cliente de prueba en Routsify.
2. Ejecuta una sincronización de contacto y verifica el ID de Holded.
3. Crea un presupuesto de importe pequeño y comprueba el `estimate`.
4. Registra un pago manual en un expediente de prueba y comprueba la proforma.
5. Verifica que repetir el proceso no crea duplicados.
6. Prueba una factura de proveedor y su conciliación sin aprobarla automáticamente.

Holded sigue siendo el sistema maestro fiscal y contable; Routsify mantiene la verdad operativa del expediente.

## 6. OpenAI OCR

### Preparación

1. Crea un proyecto específico para Routsify en la plataforma de OpenAI.
2. Configura un presupuesto y límites de uso del proyecto.
3. Crea una API key del proyecto.
4. Guarda la clave en **Ajustes → Integraciones → OpenAI OCR**.
5. Pulsa **Probar conexión**.

### Prueba controlada

1. Utiliza un documento ficticio o expresamente autorizado.
2. Sube el documento al expediente de prueba.
3. Ejecuta OCR.
4. Revisa manualmente todos los campos antes de confirmarlos.
5. Comprueba que una imagen borrosa o un campo dudoso no se confirma automáticamente.

El uso de la API de OpenAI puede generar coste. Los documentos de identidad no deben utilizarse en pruebas innecesarias y deben respetar la política de retención del sistema.

## 7. Teya manual

No se configura una API ni un webhook por ahora.

Flujo operativo:

1. Genera el enlace de pago en Teya manualmente.
2. Guarda o comparte el enlace desde el expediente.
3. Cuando Teya confirme el cobro, registra en Routsify:
   - referencia única;
   - importe;
   - moneda;
   - fecha;
   - método;
   - evidencia disponible.
4. Routsify comprueba que el presupuesto esté aceptado y el contrato firmado antes de confirmar el pago.

Nunca se debe marcar un pago como confirmado únicamente porque el cliente diga que lo ha realizado; debe verificarse en Teya.

## 8. Orden de activación recomendado

1. Hostinger SMTP.
2. WhatsApp con número y destinatarios de prueba.
3. Fillout con un envío ficticio.
4. Booking con eventos firmados de prueba.
5. Holded con cliente y documentos de prueba.
6. OpenAI OCR con documento ficticio.
7. Un expediente piloto completo.

## 9. Criterios de aceptación

Cada integración se considera validada cuando:

- la prueba de conexión es correcta;
- no se expone la credencial al navegador ni a logs;
- el mismo evento repetido no crea duplicados;
- los errores quedan visibles y reintentables;
- el historial del cliente o expediente conserva el resultado;
- una persona puede revisar las acciones económicas, documentales o fiscales antes de confirmarlas.
