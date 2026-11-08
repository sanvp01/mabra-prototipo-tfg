# MABRA Proyectos — Prototipo tecnológico

**Trabajo Final de Grado — Prototipado Tecnológico**  
**Universidad Siglo 21 · Ingeniería en Software**  
**Autor:** Santiago Villalba Palmieri  
**Tutora:** Ing. Claudia Fabiana Castro  
**Lugar y fecha:** Córdoba, noviembre de 2026

---

## 1. Presentación

Este repositorio reúne los artefactos del prototipo MABRA Proyectos, concebido para apoyar la gestión y trazabilidad de la producción de mobiliario a medida. Su alcance se organiza alrededor de las cinco historias de usuario definidas en el Trabajo Final de Grado (HU-001 a HU-005).

El repositorio permite examinar la demostración interactiva, las reglas de dominio, la API REST de demostración, el esquema relacional MySQL y una suite automatizada de pruebas. **No debe interpretarse como una aplicación productiva con todas sus capas integradas:** la persistencia efectiva de la API en MySQL, la conexión del frontend React con dicha API, la autenticación real contra usuarios almacenados y las integraciones externas requieren una etapa posterior de integración y puesta en marcha.

## 2. Alcance funcional representado

1. **HU-001 — Cotización paramétrica.** Aplica 12% de merma a placas de melamina y 0% a tapacantos y herrajes, salvo justificación técnica. Calcula materiales netos, mano de obra, CIF del 15%, recargo comercial del 35% y seña mínima del 50%. El caso testigo PRY-00015 reproduce materiales netos de $251.600, mano de obra de $120.000, CIF de $55.740, costo estimado de $427.340, precio final de $576.909 y seña de $288.454,50.
2. **HU-002 — Vigencia, seña y retazos.** Representa la vigencia de 14 días, el requisito de seña mínima y el ciclo `Disponible → Reservado → Reutilizado`, incluida la liberación de la reserva ante cancelación previa al consumo.
3. **HU-003 — Seguimiento y trazabilidad.** Incluye reglas de transición por rol, estructuras para registro multioperario y auditoría de ajustes. El esquema SQL define triggers que impiden actualizar o eliminar registros de `AUDITORIA_AJUSTES`.
4. **HU-004 — Análisis de costos.** Distingue el costo de consumo valorizado a precios snapshot del costo económico calculado con precios de compra y tarifas vigentes, evitando deducir dos veces el retazo.
5. **HU-005 — Notificaciones.** Modela estados de notificación y reintentos mediante reglas de dominio y tablas SQL. El envío efectivo a WhatsApp Business Platform requiere credenciales y conexión con un proveedor, por lo que no se presenta como integración externa operativa.

Los importes y registros incluidos en el repositorio son datos de demostración/semilla. No corresponden a credenciales ni a información operativa real de clientes.

## 3. Contenido del repositorio

```text
.
├── README.md
├── .gitignore
├── .env.example
├── Demo_Interactiva_MABRA.html
├── Esquema_Base_Datos_MABRA.sql
├── GUION_DEMO_VIDEO_CAE.md
├── package.json
├── vite.config.js
├── index.html
├── backend/
│   ├── server.js
│   └── tests.py
└── frontend/
    └── src/
        ├── App.jsx
        └── main.jsx
```

## 4. Modalidad recomendada para la evaluación: demo interactiva

La demostración autocontenida permite recorrer las pantallas sin instalar dependencias ni configurar una base de datos.

**Windows 10/11**
1. Descargar el repositorio desde GitHub mediante **Code → Download ZIP**.
2. Extraer el archivo.
3. Abrir `Demo_Interactiva_MABRA.html` con Edge, Chrome o Firefox.

**macOS**
1. Descargar y descomprimir el repositorio.
2. Abrir `Demo_Interactiva_MABRA.html` con Safari o Chrome.

La demo contiene vistas de cotización, seguimiento productivo y análisis de costos. Su comportamiento es local y demostrativo; no persiste cambios en MySQL ni se comunica con servicios externos.

## 5. Ejecución de las pruebas automatizadas

La suite `backend/tests.py` contiene 27 casos de prueba y utiliza exclusivamente la biblioteca estándar de Python. Para validar el esquema, adapta su definición a SQLite y crea una base temporal en memoria. Por tanto, sus resultados verifican reglas de dominio y restricciones seleccionadas en ese entorno; **no constituyen una prueba de integración contra un servidor MySQL 8.4**.

**Windows (PowerShell o CMD):**

```powershell
python backend\tests.py
```

Si está instalado el lanzador de Python:

```powershell
py backend\tests.py
```

**macOS:**

```bash
python3 backend/tests.py
```

El resultado esperado de la suite incluida es de 27 casos aprobados. La prueba TC-02 comprueba la presencia de diez proyectos semilla en la base temporal; no representa una comparación de diez presupuestos históricos reales (*Shadow Testing*).

## 6. Ejecución del frontend React

El frontend es una interfaz de prototipo independiente de la API. Sus datos se calculan y actualizan localmente en el navegador; actualmente no realiza llamadas al backend ni persiste cambios en MySQL.

**Windows PowerShell:**

1. Abrir PowerShell en la carpeta raíz del repositorio:

   ```powershell
   cd "C:\ruta\al\repositorio"
   ```

2. Instalar las dependencias:

   ```powershell
   npm.cmd install
   ```

3. Iniciar el servidor de desarrollo:

   ```powershell
   npm.cmd run dev
   ```

4. Abrir en Edge, Chrome o Firefox la dirección que muestra Vite, normalmente `http://localhost:5173`.

Si PowerShell informa que la ejecución de `npm.ps1` está deshabilitada, utilizar `npm.cmd` como en los comandos anteriores. Para generar una compilación de producción sin publicarla:

```powershell
npm.cmd run build
```

Para detener el servidor, volver a la ventana de PowerShell donde está ejecutándose y presionar `Ctrl+C`.

## 7. Ejecución de la API REST de demostración

La API Express puede iniciarse localmente para examinar sus endpoints y reglas de dominio. Utiliza datos de demostración en memoria. Aunque el repositorio incluye un esquema MySQL y un pool configurado en el código, las rutas actuales no ejecutan operaciones de lectura o escritura mediante ese pool. La API, por tanto, no persiste las operaciones en MySQL.

### Requisitos

- Node.js 18 o superior.
- npm incluido con Node.js.

### Instalación

Desde la carpeta raíz:

```bash
npm.cmd install
```

### Configurar la clave JWT local

La API no contiene una clave JWT predeterminada. Antes de iniciarla, cada persona debe definir una clave propia de al menos 32 caracteres. **La CAE no necesita conocer la clave del autor ni compartirla:** puede generar una clave local para su ejecución.

**Windows PowerShell** (en la misma ventana donde se iniciará la API):

```powershell
$env:JWT_SECRET = [Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
npm.cmd start
```

**macOS / Linux** (en la misma terminal):

```bash
export JWT_SECRET="$(openssl rand -base64 48)"
npm start
```

La variable se mantiene únicamente en esa sesión de terminal. Si se abre otra, debe definirse nuevamente. El archivo `.env.example` es una referencia de configuración; el proyecto no carga automáticamente archivos `.env`.

Si `JWT_SECRET` no está definida o tiene menos de 32 caracteres, el servidor finaliza el inicio con un mensaje explicativo. No se debe reemplazar esta protección por una clave fija escrita en el código.

La configuración de JWT resuelve la exposición de la clave de firma, pero **no implementa por sí sola autenticación real**. La ruta de inicio de sesión actual es demostrativa: no consulta usuarios de MySQL ni verifica contraseñas con bcrypt. Los valores `password_hash` incluidos en los datos semilla SQL son marcadores de ejemplo y no son credenciales utilizables.

### Comprobación rápida desde otra ventana de PowerShell

Con la API ejecutándose en la primera ventana, abrir una segunda ventana y ejecutar:

```powershell
$login = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/auth/login" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"email":"evaluacion@mabra.test","rol":"Usuario dueño","password":"Valid123!"}'

$headers = @{ Authorization = "Bearer $($login.token)" }

Invoke-RestMethod `
  -Uri "http://localhost:3000/api/proyectos/15" `
  -Method Get

$cotizacion = @{
  insumos = @(
    @{ cantidad_estimada = 2; costo_unitario = 90000; aplica_merma = $true },
    @{ cantidad_estimada = 25; costo_unitario = 1200; aplica_merma = $false },
    @{ cantidad_estimada = 1; costo_unitario = 40000; aplica_merma = $false }
  )
  ahorroRetazoReservado = 20000
  hsEstimadas = 16
  valorHoraVigente = 7500
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://localhost:3000/api/cotizaciones" `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $cotizacion
```

La respuesta de la cotización nominal debe informar un costo total estimado de `427340` y un precio de venta final de `576909`. El valor de `password` del ejemplo solo cumple la política demostrativa; no es una credencial real.

### Endpoints disponibles

La API expone rutas bajo `/api`, entre ellas:

- `POST /api/auth/login`
- `GET /api/proyectos/:id`
- `POST /api/cotizaciones`
- `POST /api/proyectos/:id/sena`
- `POST /api/retazos/:id/transicion`
- `POST /api/proyectos/:id/estado`
- `POST /api/auditoria/ajustes`
- `POST /api/proyectos/:id/desviaciones`
- `POST /api/notificaciones/intento`

Las rutas protegidas requieren un token Bearer emitido por el endpoint demostrativo de inicio de sesión y aplican las verificaciones de rol codificadas. Los datos de respuesta no se guardan en MySQL.

## 8. Esquema MySQL

`Esquema_Base_Datos_MABRA.sql` define el modelo relacional para MySQL 8.4, con 17 tablas, claves foráneas, datos semilla y triggers de protección append-only para `AUDITORIA_AJUSTES`.

El script puede inspeccionarse o importarse en una instancia local de MySQL 8.4. La importación del esquema es independiente de la API: **no conecta automáticamente el backend a esa base de datos**.

Ejemplo desde terminal, con MySQL instalado y credenciales locales configuradas:

```bash
mysql -u root -p < Esquema_Base_Datos_MABRA.sql
```

## 9. Tecnologías y estado de integración

| Componente | Tecnología | Estado que representa este repositorio |
|---|---|---|
| Demo interactiva | HTML, CSS y JavaScript | Ejecutable localmente en navegador |
| Frontend | React 18 y Vite 5 | Interfaz de prototipo; sin llamadas a la API en el código actual |
| Backend | Node.js y Express | API REST demostrativa con reglas de dominio y respuestas en memoria |
| Seguridad | JWT y middleware RBAC | Firma/verificación JWT y controles de rol; login demostrativo, sin verificación bcrypt real |
| Base de datos | MySQL 8.4 / InnoDB | Esquema SQL de 17 tablas; no conectado funcionalmente a las rutas actuales |
| Pruebas | Python y SQLite en memoria | 27 pruebas automatizadas de reglas y restricciones seleccionadas |

## 10. Trabajo futuro previo a una puesta en producción

Para evolucionar el prototipo a una solución operativa será necesario, entre otras tareas, conectar las rutas con MySQL mediante consultas parametrizadas y transacciones, integrar el frontend con la API, implementar autenticación contra usuarios persistidos con verificación bcrypt, completar pruebas de integración y extremo a extremo, configurar secretos y controles de despliegue, realizar una prueba piloto en el taller y habilitar la integración comercial con WhatsApp. El despliegue en AWS también requiere configurar y validar la infraestructura real.

## 11. Documentación y demostración ante la CAE

- `GUION_DEMO_VIDEO_CAE.md`: secuencia sugerida para recorrer la demostración.
- `Demo_Interactiva_MABRA.html`: demo ejecutable localmente.
- `Esquema_Base_Datos_MABRA.sql`: modelo relacional.
- El documento académico de Entrega 4 y el video de 3 a 5 minutos deben compartirse mediante el enlace de repositorio o carpeta pública indicado en la entrega institucional.

---

**Nota de alcance:** este repositorio documenta un prototipo académico y sus artefactos verificables. Las modalidades de demo, pruebas automatizadas, API de demostración y esquema SQL tienen alcances diferentes; no se afirma que constituyan una solución productiva integrada.
