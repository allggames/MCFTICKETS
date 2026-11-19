# MCF TICKETS

Primera versión de una ticketera multi-evento para Argentina. Incluye cuatro módulos:

- **Administrador**: crear y editar eventos; lotes con sectores, precios y cupos; reportes por evento/lote/sector; búsqueda de emisiones por titular o público y acceso al QR de prueba.
- **Tienda pública**: catálogo de eventos, sectores y formulario de comprador.
- **Públicos / RR. PP.**: registro de ventas informadas y entradas de cortesía.
- **Lector QR**: lectura con cámara y validación de tickets únicos.

> **Estado actual: prototipo interactivo (modo demo).** La interfaz utiliza datos de ejemplo y `localStorage`. No procesa pagos reales, no envía correos, no autentica operadores y **no** sirve para validar entradas reales. La estructura inicial de Supabase está aplicada al proyecto MCF, pero el frontend todavía no consume esos datos.

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
| Administración | `/app.html#/admin` |
| Venta online | `/app.html#/eventos` |
| Públicos | `/app.html#/publicos` |
| Lector | `/app.html#/scanner` |

## Modelo de datos propuesto

La migración está en `supabase/migrations/`. Contiene:

- `profiles`: usuarios internos y roles (`admin`, `promoter`, `scanner`).
- `events`: eventos con estados borrador, publicado y cerrado.
- `ticket_batches`: lotes de cada evento (en espera, activo o cerrado).
- `ticket_types`: sectores, precios en centavos de ARS y capacidad dentro de cada lote.
- `event_staff`: permisos por evento y cupos de cortesías.
- `orders`: origen de emisión, responsable, monto y estado del pago.
- `tickets`: token **hasheado** (no se expone el token a través de SELECT), estado de ingreso y operador.
- `ticket_audit`: auditoría de emisión e ingreso.

**Reglas de seguridad del esquema:** RLS activado en todas las tablas públicas; visitantes anónimos solo pueden leer eventos y sectores publicados; los operadores tienen permisos por rol y evento. La función `issue_staff_ticket` controla permisos y cupos. `redeem_ticket` utiliza una actualización atómica para que un QR solo permita el primer ingreso válido.

### Integración de Supabase

1. [x] Crear el proyecto MCF TICKETS aislado de HOST (`takzwkxidydafgsjiqol`).
2. [x] Aplicar y verificar la migración inicial y la ampliación de lotes: ocho tablas con RLS.
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
          → se emite ticket único y se envía por correo
          → lector autenticado valida token contra Supabase
```

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
- [x] Demo de lotes, sectores, precios, cupos e informes desglosados en el administrador.
- [x] Demo del lector QR con cámara (sujeto a permisos HTTPS) o código manual.
- [ ] Pruebas en Supabase conectado con diferentes roles.
- [ ] Pruebas de compra Mercado Pago sandbox y webhook.
- [ ] Envíos reales de email.
- [ ] Pruebas de escaneo concurrente entre dispositivos y despliegue público.

---

MCF TICKETS — prototipo inicial creado en noviembre de 2026.
