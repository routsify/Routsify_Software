# Routsify Booking API

Routsify Software se conecta con la agenda alojada en `call.routsify.com` para:

- generar enlaces personalizados de reserva;
- enviarlos por email o WhatsApp desde la ficha del cliente;
- consultar disponibilidad;
- crear una llamada;
- reprogramarla;
- cancelarla;
- conservar la reserva, la tarea y el historial en Routsify Software.

## Datos de conexión

Base API:

```text
https://call.routsify.com/wp-json/routsify/v1
```

La API Key se guarda cifrada en Supabase Vault bajo `booking_api_key`.

Modos admitidos:

```http
X-Routsify-API-Key: TU_CLAVE
```

```http
Authorization: Bearer TU_CLAVE
```

El modo recomendado y predeterminado es `X-Routsify-API-Key`.

## Configuración en Routsify Software

En **Ajustes → Integraciones → Routsify Booking API**:

- Activar Booking API: sí.
- Base API: `https://call.routsify.com/wp-json/routsify/v1`.
- URL pública de reserva: `https://call.routsify.com`.
- Autenticación: `X-Routsify-API-Key` o `Authorization Bearer`.
- Ruta disponibilidad: `/availability`.
- Ruta reservas: `/bookings`.
- Ruta reserva individual: `/bookings/{id}`.
- Zona horaria: `Europe/Madrid`.
- Duración predeterminada: 10 minutos (la API puede devolver otra y prevalece para cada hueco).

Después, en la tarjeta **Routsify Booking · API Key**:

1. Pegar la API Key.
2. Guardarla.
3. Pulsar **Probar conexión**.

La prueba consulta el namespace configurado y, cuando WordPress devuelve su índice, muestra el número de rutas publicadas. Si los nombres reales de las rutas difieren de `/availability` o `/bookings`, deben copiarse en los tres campos configurables; no es necesario modificar código.

## Uso desde Cliente 360

En la ficha de cada cliente aparece el panel **Routsify Booking**.

### Enlace personalizado

Se puede:

- copiar el enlace;
- enviarlo por Hostinger Mail;
- enviarlo por Meta WhatsApp Cloud API.

El enlace incorpora, cuando están disponibles, `client_id`, nombre, email y teléfono como parámetros para que la página de reserva pueda precompletar la información.

### Reserva directa

El usuario selecciona:

- fecha y hora;
- duración;
- notas internas.

Routsify envía la reserva a la API, guarda el identificador externo, crea o actualiza la tarea de llamada y registra el evento en la timeline del cliente.

### Disponibilidad

El botón **Consultar disponibilidad** solicita los próximos 14 días. El adaptador reconoce respuestas que incluyan colecciones como `slots`, `availability`, `items`, `results` o `data`.

### Reprogramación y cancelación

Las llamadas con identificador externo permiten:

- reprogramar mediante `PATCH` a la ruta individual;
- cancelar mediante `DELETE`;
- si el servidor no admite `DELETE` y responde 404/405, Routsify utiliza `PATCH` con `status: cancelled`.

## Payload enviado al crear una reserva

El adaptador incluye nombres compatibles habituales para facilitar la interoperabilidad:

```json
{
  "name": "Nombre del cliente",
  "full_name": "Nombre del cliente",
  "email": "cliente@example.com",
  "phone": "+34...",
  "starts_at": "2026-07-20T10:00:00.000Z",
  "start": "2026-07-20T10:00:00.000Z",
  "ends_at": "2026-07-20T10:30:00.000Z",
  "end": "2026-07-20T10:30:00.000Z",
  "timezone": "Europe/Madrid",
  "notes": "Contexto interno",
  "source": "routsify_software",
  "client_id": "UUID DEL CLIENTE",
  "external_reference": "client:UUID DEL CLIENTE"
}
```

La respuesta debe devolver un identificador en alguno de estos campos:

- `external_booking_id`;
- `booking_id`;
- `appointment_id`;
- `id`;
- `uuid`.

También se reconocen opcionalmente:

- `booking_url`, `manage_url`, `reschedule_url` o `url`;
- `meeting_url`, `video_url`, `join_url` o `location_url`.

## Webhook entrante

La integración de salida por API Key es independiente del webhook entrante existente:

```text
https://routsify-software.vercel.app/api/webhooks/bookings
```

El webhook sigue utilizando HMAC SHA-256 con `booking_webhook_secret`. Sirve para recibir cambios realizados directamente en `call.routsify.com`, mientras que `booking_api_key` permite que Routsify Software realice acciones sobre Booking.

## Seguridad

- La API Key nunca se envía al navegador.
- No se registra en logs ni timelines.
- Todas las operaciones internas verifican sesión, organización y permiso `clients.manage`.
- La URL base debe utilizar HTTPS.
- Las reservas locales se filtran siempre por organización.
- Las acciones quedan auditadas en la timeline del cliente.
