# Routsify Software · checklist de aceptación operativa

Usar esta lista antes de introducir datos reales. Cada prueba debe registrar fecha, usuario, resultado y evidencia.

## 1. Acceso y permisos
- [ ] El administrador inicia sesión y accede a todos los módulos.
- [ ] Ventas no puede gestionar credenciales ni usuarios.
- [ ] Operaciones no puede modificar configuración fiscal.
- [ ] Facturación accede a compras, pagos e informes económicos.
- [ ] Solo lectura no puede crear, editar, aprobar ni eliminar.
- [ ] No se puede degradar al último administrador.
- [ ] Una invitación crea el usuario en la organización correcta.
- [ ] Recuperación de contraseña funciona con el dominio definitivo.

## 2. Captación y CRM
- [ ] Un envío de Fillout crea un lead y un cliente.
- [ ] Repetir el mismo envío no crea duplicados.
- [ ] Un email existente reutiliza el cliente.
- [ ] Una coincidencia solo por teléfono genera alerta de posible duplicado.
- [ ] La campaña, destino, fechas, viajeros y presupuesto se guardan correctamente.
- [ ] Se crea una tarea de cualificación comercial.
- [ ] Una reserva de Booking se vincula al cliente y lead existentes.
- [ ] Una reserva sin lead previo crea el registro mínimo necesario.
- [ ] Un cambio de fecha de Booking queda registrado como evento idempotente.
- [ ] Una cancelación crea una tarea de seguimiento.

## 3. Expediente
- [ ] El lead se convierte en expediente sin perder su origen.
- [ ] El expediente tiene responsable y próxima acción.
- [ ] Los cambios de estado aparecen en el timeline.
- [ ] Las tareas se vinculan al expediente correcto.
- [ ] Los usuarios sin permiso no ven documentos sensibles.
- [ ] El panel Control operativo calcula la salud del expediente.
- [ ] Un expediente incompleto muestra exactamente qué falta.
- [ ] Un viaje próximo con documentación pendiente genera alerta.

## 4. Presupuesto y propuesta
- [ ] Se crea presupuesto con líneas de coste y venta.
- [ ] Los totales, margen y beneficio son correctos.
- [ ] Se crea una nueva versión sin alterar la anterior.
- [ ] La versión enviada coincide con la landing pública.
- [ ] El enlace público caduca y no permite enumeración.
- [ ] Una aceptación válida bloquea la versión.
- [ ] Una segunda aceptación no duplica compras ni eventos.
- [ ] Rechazar o caducar la propuesta actualiza el expediente.

## 5. Viajeros y documentación
- [ ] Se crean todos los viajeros previstos.
- [ ] Los documentos se suben a bucket privado.
- [ ] Las URL firmadas caducan.
- [ ] El acceso queda auditado.
- [ ] OCR nunca confirma datos sin revisión humana.
- [ ] Los documentos vencidos o incompletos generan alerta.
- [ ] La retención elimina archivo, OCR y datos derivados al vencer.

## 6. Contrato y firma
- [ ] El contrato referencia la versión aceptada.
- [ ] No se puede firmar una versión obsoleta.
- [ ] La firma registra nombre, email, fecha y evidencia.
- [ ] Una notificación duplicada no firma dos veces.
- [ ] El expediente avanza a pago pendiente tras la firma.

## 7. Pagos y fiscalidad
- [ ] No se confirma pago sin propuesta aceptada.
- [ ] La referencia de pago es obligatoria y única.
- [ ] Un pago duplicado no crea dos movimientos.
- [ ] Se admiten pagos parciales sin marcar el total como pagado.
- [ ] El pago confirmado genera la proforma prevista.
- [ ] Holded recibe el contacto antes del documento fiscal.
- [ ] Los errores de Holded quedan en cola con reintento.
- [ ] La factura final no se genera antes del cierre y plazo configurado.
- [ ] La fiscalidad permanece en revisión manual hasta aprobación de asesoría.

## 8. Compras y proveedores
- [ ] La aceptación genera una compra esperada por línea aplicable.
- [ ] No se duplican compras al reenviar o aceptar de nuevo.
- [ ] Cada compra conserva expediente, proveedor, servicio y coste esperado.
- [ ] La factura de proveedor se guarda de forma privada.
- [ ] El matching muestra puntuación y razones.
- [ ] Las diferencias de importe requieren aprobación.
- [ ] No se puede cerrar el expediente con compras requeridas pendientes.
- [ ] Antes del viaje se crean tareas para proveedores pendientes.
- [ ] Después del viaje se crean tareas para facturas pendientes.

## 9. Automatizaciones y control
- [ ] El cron horario procesa el outbox.
- [ ] El cron diario ejecuta compras, proveedores, cierre y fiscalidad.
- [ ] El cron mensual revisa retención documental.
- [ ] Un cron sin autorización devuelve 401.
- [ ] Cada ejecución queda registrada en integration_runs.
- [ ] Los fallos agotados pasan a revisión manual.
- [ ] Control operativo muestra tareas vencidas y eventos fallidos.
- [ ] El health check público responde sin exponer secretos.

## 10. Salida a producción
- [ ] Demo desactivada.
- [ ] Administrador real confirmado.
- [ ] SMTP y plantillas probados.
- [ ] Dominio definitivo configurado.
- [ ] Copias de seguridad y restauración probadas.
- [ ] Alertas técnicas configuradas.
- [ ] Se elimina el expediente de demostración.
- [ ] Se completa un expediente ficticio de inicio a cierre.
- [ ] Se completan cinco escenarios de excepción: cambio, cancelación, pago duplicado, documento pendiente y proveedor sin factura.
