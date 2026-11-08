# Guía Paso a Paso y Guion para el Video Demostrativo / Defensa Oral (CAE)
**Trabajo Final de Grado — Prototipado Tecnológico (Universidad Siglo 21)**  
**Autor:** Santiago Villalba Palmieri (Legajo: SOFO2889)  
**Tutora:** Ing. Claudia Fabiana Castro  

---

## Preparación previa (1 minuto)
1. Abrir **`Demo_Interactiva_MABRA.html`** en el navegador web (pantalla completa o zoom al `100%`).
2. Verificar que en la esquina superior derecha esté seleccionado **`Perfil: Usuario dueño`** y activa la **Pestaña 1 (`1. Cotización Paramétrica`)**.

---

## Bloque 1 (0:00 a 1:15) — Cotización Paramétrica con Merma Diferenciada (`HU-001`) y Ciclo de Retazos (`HU-002`)
* **Acciones en pantalla:**
  1. Señalar el desglose del proyecto **`PRY-00015 (Bajo mesada — Cliente: María Pérez)`**: `2 placas` a `$90.000` (`$180.000` base + `12%` merma de corte = `$21.600`), `25 m de tapacanto` a `$1.200` (`$30.000` con `0%` merma) y `1 kit de herrajes` a `$40.000` (`$40.000` con `0%` merma).
  2. Mostrar el subtotal base (`$250.000`), la suma de merma solo en placas (`+$21.600`) y la deducción única del retazo `#RET-08` (`-$20.000`), dando **`$251.600`** en materiales netos, **`$120.000`** de mano de obra (`16 h × $7.500`), **`$55.740`** de CIF (`15%`), **`$427.340`** de costo total estimado y **`$576.909`** de precio final (recargo del `35%`).
  3. Hacer clic en **"Simular vencimiento (+14 días)"** para mostrar el bloqueo por caducidad, y luego en **"Seña mínima (50%): $288.454,50 | Congelar desglose y reservar retazo"** y **"Cancelar pedido (Liberar Retazo)"** para evidenciar el ciclo `Disponible → Reservado → Reutilizado` (y liberación a `Disponible`).

## Bloque 2 (1:15 a 2:25) — Seguimiento Multioperario (`HU-003`), Lotes de Compra y Auditoría *Append-Only*
* **Acciones en pantalla:**
  1. Cambiar el selector superior a **`Perfil: Usuario instalador`** para demostrar que las pestañas comerciales y financieras quedan bloqueadas (`RBAC`).
  2. Mostrar en la **Pestaña 2** las 5 intervenciones registradas en `REGISTRO_HORAS` por dos operarios distintos (**Juan Rodríguez** y **Pedro Gómez**) que totalizan **`20,00 horas`** (`5,00 + 2,00 + 5,50 + 3,50 + 4,00 h`), el consumo diferenciado entre placas de lote de compra y el retazo `#RET-08` reutilizado a su costo de origen (`$20.000`), y la nota de auditoría inmutable en `AUDITORIA_AJUSTES`.

## Bloque 3 (2:25 a 3:30) — Panel de Costos y Desviaciones en Dos Bases Separadas (`HU-004`)
* **Acciones en pantalla:**
  1. Volver al **`Perfil: Usuario dueño`** y abrir la **Pestaña 3 (`3. Panel de Costos y Desviaciones`)**.
  2. Explicar las dos columnas comparativas frente al presupuesto *snapshot* (`$427.340`):
     * **Base 1 — Consumo a precio *snapshot* (`$483.000`):** Mide el mayor consumo físico y horario del taller a precios constantes (`$270.000` materiales valorizando el retazo por su costo de origen sin doble deducción + `$150.000` por `20 h × $7.500` + `$63.000` CIF), arrojando un desvío operativo de **`+$55.660` (`+13,0%`)** que activa la alerta roja (`> 10%`).
     * **Base 2 — Costo económico real (`$523.250`):** Incorpora el precio real pagado en el lote de compra (`$290.000` materiales) y la tarifa horaria vigente de los operarios (`$165.000` mano de obra + `$68.250` CIF estimado), determinando un resultado económico de **`$53.659` (`9,3%` sobre el precio de venta de `$576.909`)**.

## Bloque 4 (3:30 a 4:00) — Suite Automatizada de 27 Casos de Prueba (`TC-01` a `TC-27`)
* **Acciones en pantalla:**
  1. Abrir la **Pestaña 4 (`4. Suite Automatizada de 27 Pruebas de Tesis`)** y mostrar los 27 casos aprobados (`27/27 PASÓ`, `0` fallos) que validan el módulo de dominio, las 17 tablas SQL, los *triggers append-only* y la seguridad contra inyección de código (`Riesgo R4`).
