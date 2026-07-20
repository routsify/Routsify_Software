# Cobertura E2E autenticada

La suite Playwright autenticada valida en producción:

- login y sesión;
- acceso a todos los módulos operativos;
- ausencia de errores de aplicación y relaciones ambiguas;
- navegación por Clientes, Solicitudes, Expedientes, Presupuestos, Compras, Proveedores, Comunicaciones, Informes, Tareas, Facturación, Contratos, Documentos, Viajeros, Cierre, Integraciones, Seguridad y Ajustes;
- paginación de Clientes con 50, 100, 150 y 200 registros;
- búsqueda global de clientes;
- disponibilidad de la plantilla e interfaz de importación.

Los secretos requeridos son `E2E_EMAIL` y `E2E_PASSWORD`. `E2E_BASE_URL` es opcional y por defecto apunta a producción.
