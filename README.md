# MCF TICKETS

Primera versión de una ticketera multi-evento para Argentina. Incluye cinco módulos:

- **Panel de eventos**: pestañas **Crear evento** y **Mis eventos** con historial completo, totales generales de tickets vendidos e ingresos brutos registrados. Crear evento incluye nombre, descripción opcional, fecha y hora, lugar, imagen, URL personalizable y tantos lotes/sectores como se necesiten, cada sector con precio y cupo propios. Cada lote se habilita manualmente. El administrador puede **forzar SOLD OUT en un lote individual** sin afectar los demás, aunque queden entradas; es definitivo y bloquea futuras modificaciones de cupo, precio y sectores de ese lote. **Cerrar evento** es una acción distinta, que detiene las ventas online y por RR. PP. de todos los lotes del evento, pero conserva historial y QR emitidos. Informes por evento/lote/sector y búsqueda de emisiones por titular o público, con acceso administrativo al QR de prueba.
- **Tienda pública**: catálogo de eventos, sectores y formulario de comprador; muestra un comprobante sin QR. El QR se enviará por correo cuando exista backend real.
- **Públicos / RR. PP.**: registro de ventas informadas limitado a eventos autorizados, sin ver, copiar ni descargar el QR en la interfaz. Solo se muestran titular, correo destino, tipo y estado de entrega; el emisor se toma del perfil activo. Las invitaciones/cortesías sin cargo están reservadas al administrador salvo autorización adicional individual para un evento.
- **Lector QR**: lectura con cámara y validación de tickets únicos.
- **Usuarios y permisos**: dos roles fijos (administrador y RR. PP.), asignaciones de venta por evento individuales o masivas y permiso separado de emisión de invitaciones/cortesías. El administrador puede conceder o retirar este permiso por RR. PP. y evento; inicia siempre desactivado. También incluye búsqueda, suspensión, prueba de perfiles y rutas restringidas. La configuración del personal del lector QR se hará más adelante.

> **Estado actual: prototipo interactivo (modo demo).** La interfaz utiliza datos de ejemplo y `localStorage`. No procesa pagos reales, no envía correos, no autentica operadores y **no** sirve para validar entradas reales. **El selector de perfiles y el bloqueo visual de rutas NO son controles de seguridad:** cualquier visitante puede elegir un perfil de prueba. No usar información real ni invitar operadores hasta conectar Supabase Auth y aplicar autorización del lado del servidor. La estructura inicial de Supabase está aplicada al proyecto MCF, pero el frontend todavía no consume esos datos.

La emisión de una entrada por RR. PP. y la compra simulada muestran ahora **solo el comprobante y el estado "Correo no enviado"**, sin QR ni token en pantalla. **Esto es una restricción visual de la demo, no una garantía de confidencialidad:** los tickets de prueba siguen en `localStorage` del navegador. Solo un backend con token secreto no entregado a los RR. PP. puede garantizar esta regla.

**Importante sobre enlaces e imágenes:** en la demo, las URL personalizadas de los eventos funcionan en el navegador que creó esos eventos. Como los datos e imágenes se guardan localmente y no en un servidor compartido, **otro comprador que abra ese enlace desde un dispositivo distinto no verá el evento creado**. Para publicar y vender realmente se requiere sincronización con Supabase (eventos, lotes y almacenamiento de imágenes). Los totales mostrados representan *ingresos brutos registrados* o simulados, **no ganancias netas ni dinero conciliado**.

## Ejecutarlo

Requiere Node.js 22 o posterior.

```bash
npm install
npm run dev
```

Abrí `http://localhost:4173/app.html` en desarrollo. Para generar los archivos estáticos:

```bash
npm run build
```

### Publicación en GitHub Pages

El workflow `.github/workflows/deploy.yml` compila Vite y publica la carpeta `dist/` en cada actualización de `main`. Para que también funcione cuando Pages publica `main/(root)`, `index.html` y `assets/` contienen una versión compilada. La fuente editable de Vite es `app.html` y `src/`; la versión compilada debe actualizarse con cada publicación si se usa la modalidad por rama. URL del prototipo: https://allggames.github.io/MCFTICKETS/.

La navegación usa fragmentos de URL, lo que permite servir el frontend desde GitHub Pages sin reglas especiales de redirección:

| Área | URL local |
| --- | --- |
| Panel de eventos | `/app.html#/admin` |
| Venta online | `/app.html#/eventos` |
| Públicos | `/app.html#/publicos` |
| Lector | `/app.html#/scanner` |
| Usuarios y permisos | `/app.html#/permisos` |

### Permisos de prueba

- **Administrador**: ve todos los módulos, incluida la gestión de usuarios y la tienda.
- **RR. PP.**: solo ve el panel de públicos y, dentro de él, exclusivamente los eventos publicados que le hayan asignado. Si no tiene eventos, no puede emitir entradas.
- **Invitaciones/cortesías**: por defecto solo el administrador puede generar QR sin cargo. En el panel de permisos puede otorgar este permiso a un RR. PP. para un evento concreto, siempre que ya esté habilitado para vender ese evento. Al quitar su acceso al evento, también pierde el permiso de invitaciones.
- **Visitante**: solo ve la tienda pública.
- El administrador puede preparar personas pendientes, activar/suspender perfiles y habilitar/deshabilitar RR. PP. **por evento**. Es posible buscar y aplicar permisos de venta en bloque (con confirmación), por ejemplo habilitar 10 RR. PP. para un evento y 50 para otro. Las invitaciones se autorizan de manera individual. Se guarda únicamente en el navegador.
- El lector QR continúa como prototipo, accesible desde la vista de administrador, pero la gestión de usuarios de puerta y sus permisos se desarrollará por separado.
- Para que esto sea **real y seguro** faltan: autenticación de cada usuario; alta/aprobación desde el servidor; permisos de módulo guardados con RLS; verificación de rol y evento en cada RPC/Edge Function; e invitaciones por correo. El cambio de permisos de módulo en Supabase no está aplicado todavía.

## Modelo de datos propuesto

La migración está en `supabase/migrations/`. Contiene:

- `profiles`: estructura de usuarios internos y roles (`admin`, `promoter`, `scanner`); el último queda reservado para la futura etapa del lector QR.
- `events`: eventos con estados borrador, publicado y cerrado.
- `ticket_batches`: lotes de cada evento (en espera, activo o cerrado en el esquema inicial). Solo el administrador abre/cierra ventas; no se habilita automáticamente el siguiente lote ni siquiera cuando se agota el actual. El esquema permite como máximo uno activo por evento. **El SOLD OUT definitivo por lote implementado en la interfaz todavía debe agregarse a las migraciones y a las reglas del servidor.**
- `ticket_batch_status_audit`: historial de aperturas y cierres de lote, autor, estado anterior/nuevo y fecha.
- `ticket_types`: sectores, precios en centavos de ARS y capacidad independiente dentro de cada lote, ajustable por el administrador.
- `ticket_capacity_adjustments`: auditoría de cada cambio de cupo, con cantidad anterior/nueva, diferencia, motivo, autor y fecha.
- `event_staff`: permisos por evento y cupos de cortesías.
- `orders`: origen de emisión, responsable, monto y estado del pago.
- `tickets`: token **hasheado** (no se expone el token a través de SELECT), estado de ingreso y operador.
- `ticket_audit`: auditoría de emisión e ingreso.

**Reglas de seguridad del esquema:** RLS activado en todas las tablas públicas; visitantes anónimos solo pueden leer eventos y sectores publicados; los operadores tienen permisos por rol y evento. La función `issue_staff_ticket` controla permisos y cupos. `redeem_ticket` utiliza una actualización atómica para que un QR solo permita el primer ingreso válido.

### Integración de Supabase

1. [x] Crear el proyecto MCF TICKETS aislado de HOST (`takzwkxidydafgsjiqol`).
2. [x] Aplicar las migraciones iniciales, de lotes y de auditoría de cupos y estados: diez tablas con RLS.
3. [ ] Registrar los usuarios internos y otorgar el primer administrador por SQL con su `auth.users.id` verificado.
4. [ ] Conectar el frontend usando únicamente `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. Nunca exponer una secret key en el navegador.
5. [ ] Implementar autenticación real, enlazar los paneles a las tablas y pasar las operaciones sensibles a funciones protegidas del servidor.
6. [ ] Ejecutar pruebas multiusuario: público sin permisos, cuotas agotadas, QR repetido, escaneo cruzado entre eventos y dos escáneres simultáneos.

**La migración todavía no cubre todo el proceso de reservas y pagos online:** antes de activar cobros reales hacen falta bloqueo de cupos concurrente para compras, vencimiento de reservas, conciliación de reembolsos, reenvío de tickets y gestión de contracargos.

### Mercado Pago y correo (pendiente)

Arquitectura prevista:

```text
Comprador → checkout propio → Edge Function crea preferencia Mercado Pago
          → Mercado Pago confirma pago por Webhook firmado
          → servidor consulta pago y verifica monto/evento
          → el servidor emite un token único y envía el QR por correo al titular
          → lector autenticado valida token contra Supabase
```

**Flujo para RR. PP. e invitaciones:** el público autorizado registra el evento, sector, titular y correo. El backend valida su rol y asignación al evento, crea la entrada y envía el QR **directamente al correo del titular**, sin incluir el token ni la imagen QR en la respuesta de la API al RR. PP. El público solo recibe una referencia, correo destino y estado (`pendiente`, `enviado`, `error`). El administrador puede consultar el QR y reintentar entregas fallidas. El token no debe estar en el almacenamiento local del RR. PP. ni en respuestas accesibles mediante RLS.

**Pendiente para activar el correo real:** seleccionar y configurar un proveedor (p. ej., Resend), verificar el dominio emisor y guardar sus credenciales en secretos de Supabase Edge Functions. El envío se ejecutará solo en el servidor, con autorización e idempotencia para no crear tickets duplicados al reintentar. Para venta online deberá verificarse previamente la confirmación de pago de Mercado Pago.

Las credenciales privadas (`MP_ACCESS_TOKEN`, firma de webhook y credencial de correo) deben configurarse como secretos de Edge Functions. El navegador solo recibirá una clave publicable. **No emitir entradas válidas a partir del retorno del comprador**, sino únicamente tras confirmar el pago desde el servidor.

## Decisiones antes de producción

- El repositorio GitHub actual es **público**: nunca subir claves secretas, datos personales ni tokens de pago. El backend protegido se ejecutará en Supabase.
- Proyecto Supabase propio para no mezclar datos con HOST.
- Proveedor de envío de correos (por ejemplo, Resend) y dominio verificado.
- Configuración de la cuenta Mercado Pago receptora de pagos y reglas de reembolso.
- Definir permisos finos para RR. PP., cupos de cortesías y conciliación de ventas manuales.
- Política de privacidad, protección de datos de compradores y pruebas de carga/seguridad.

## Estado de las pruebas

- [x] Compilación de React/TypeScript/Vite.
- [x] Demo de creación de eventos, compra simulada, emisión manual y QR.
- [x] Comprobantes sin QR para compradores y RR. PP., correos destino y estado explícito "No enviado". El QR sigue visible solo en el panel administrativo de demostración.
- [ ] Envío real por email y autorización servidor para impedir acceso de RR. PP. al token o imagen QR.
- [x] Demo de lotes, sectores, precios, cupos e informes desglosados en el administrador.
- [x] Creación de eventos y lotes con un sector inicial personalizable y sectores adicionales opcionales, cada uno con su precio y cupo.
- [x] Demo de ampliación de entradas por sector/lote e historial; no altera los QR previamente emitidos.
- [x] Demo de apertura y cierre manual de lotes, confirmación, historial y ausencia de cambios automáticos cuando se agota el cupo.
- [x] Demo de SOLD OUT definitivo **por lote**, bloqueo de ampliaciones después de SOLD OUT y **cierre del evento completo** como operación separada.
- [x] Panel de eventos con Crear evento, Mis eventos e historial; fecha, lugar, descripción, imagen y URL individual; resumen general e individual de tickets vendidos e ingresos registrados.
- [ ] Persistir en Supabase los nuevos datos, publicar los eventos y sus imágenes entre dispositivos, y aplicar SOLD OUT/cierre global en el servidor.
- [x] Demo de roles fijos administrador/RR. PP., usuarios pendientes, asignación por evento, cambios masivos y permiso de invitaciones por RR. PP./evento (desactivado por defecto), con bloqueo visual por ruta y selector de perfiles.
- [ ] Permisos reales en Supabase, vinculación con Auth, invitaciones y comprobación de roles/eventos en el servidor.
- [x] Demo del lector QR con cámara (sujeto a permisos HTTPS) o código manual.
- [ ] Pruebas en Supabase conectado con diferentes roles.
- [ ] Pruebas de compra Mercado Pago sandbox y webhook.
- [ ] Envíos reales de email.
- [ ] Pruebas de escaneo concurrente entre dispositivos y despliegue público.

---

MCF TICKETS — prototipo inicial creado en noviembre de 2026.
