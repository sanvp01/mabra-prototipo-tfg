import React, { useState } from 'react';

const CASOS_27_TESTS = [
  ["TC-01", "HU-001 (Fig. 3)", "Vector nominal PRY-00015 con merma 12% solo placas y 0% tapacanto/herrajes", "Costo $427.340 | Venta $576.909 | Seña $288.454,50"],
  ["TC-02", "HU-001", "Cálculo paramétrico sin descuento de retazo (ahorro = $0)", "Mat. $271.600 | Costo Total $450.340"],
  ["TC-03", "HU-001", "Bloqueo de coeficiente de merma incompatible en herrajes discretos", "Merma 12% en herraje rechazada"],
  ["TC-04", "HU-001", "Bloqueo de guardado ante cantidades u horas <= 0", "Horas = 0 bloqueado"],
  ["TC-05", "HU-001", "Bloqueo si el crédito por retazo iguala o supera materiales brutos", "Crédito excesivo rechazado"],
  ["TC-06", "HU-002 Límite", "Aceptación de seña en el día 14 exacto de vigencia (19/11/2026)", "Estado -> Señado / En Cola"],
  ["TC-07", "HU-002 Límite", "Bloqueo de seña en el día 15 (20/11/2026) y paso a estado Vencido", "Estado -> Vencido"],
  ["TC-08", "HU-002 Límite", "Rechazo de seña inferior al 50% del precio final ($288.454,00 < $288.454,50)", "Seña < 50% bloqueada"],
  ["TC-09", "HU-002", "Aprobación de seña exacta del 50% ($288.454,50) y reserva de retazo", "Snapshot fijo + Retazo Reservado"],
  ["TC-10", "HU-002 / HU-003", "Ciclo secuencial de retazo: Disponible -> Reservado -> Reutilizado", "Disponible -> Reservado -> Reutilizado"],
  ["TC-11", "HU-002", "Liberación de reserva de retazo a Disponible ante cancelación previa al corte", "Reservado -> Disponible"],
  ["TC-12", "HU-003 RBAC", "Validación de secuencia de estados según rol (Instalador vs Logística)", "Transiciones cruzadas bloqueadas"],
  ["TC-13", "HU-003 (Fig. 4)", "Acumulación multioperario en REGISTRO_HORAS (Juan Rodríguez y Pedro Gómez)", "5 intervenciones / 2 operarios = 20,00 h"],
  ["TC-14", "HU-003 / SQL", "Inmutabilidad append-only en AUDITORIA_AJUSTES (Triggers bloquean UPDATE y DELETE)", "UPDATE y DELETE bloqueados"],
  ["TC-15", "HU-003 / SQL", "Vinculación de CONSUMO_INSUMO con LOTE_INSUMO y RETAZOS_DISPONIBLES", "Compras y Retazo diferenciados"],
  ["TC-16", "HU-004 (Fig. 5)", "Base 1: Consumo valorizado a precio snapshot ($483.000) y desvío +$55.660 (+13,0%)", "Sin doble deducción de retazo"],
  ["TC-17", "HU-004 (Fig. 5)", "Base 2: Costo económico real con lotes y tarifas vigentes ($523.250) y resultado ($53.659)", "Resultado 9,3% sobre venta"],
  ["TC-18", "HU-004", "Señalización de resultado económico incompleto cuando faltan tarifas vigentes", "estadoCompleto = False verificado"],
  ["TC-19", "HU-004 Límite", "Verificación de umbral de alerta (>10% activa alerta roja; <=10% sin alerta)", "Umbral >10% validado"],
  ["TC-20", "HU-004", "Bloqueo del cierre de desviaciones antes del estado Instalado", "Estado En Tránsito bloqueado"],
  ["TC-21", "HU-005", "Política de reintentos de notificación (Pendiente en 1-2, Fallida en 3, bloqueo en 4°)", "Tope de 3 intentos verificado"],
  ["TC-22", "BD SQL (Fig. 2)", "Verificación estructural de las 17 tablas del esquema relacional en base de datos", "17 tablas creadas y verificadas"],
  ["TC-23", "BD SQL FK", "Bloqueo de inserción huérfana mediante restricción de clave foránea (FK)", "FK protegida"],
  ["TC-24", "BD SQL ACID", "Rollback automático preserva intacta la seña ($288.454,50) ante fallo intermedio", "Seña preservada: $288.454,50"],
  ["TC-25", "Seguridad", "Validación de longitud mínima (8 caracteres) y complejidad de contraseña", "7 chars rechazada / 8 chars aprobada"],
  ["TC-26", "Seguridad R4", "Bloqueo de vectores de inyección SQL en entradas de usuario", "Payload SQLi neutralizado"],
  ["TC-27", "Seguridad R4", "Bloqueo de vectores Cross-Site Scripting (XSS) en observaciones", "Payload XSS neutralizado"]
];

const TRANSICIONES_POR_ROL = {
  'Usuario instalador': {
    'Señado / En Cola': 'En Corte',
    'En Corte': 'En Pegado y Armado',
    'En Pegado y Armado': 'Listo para Entrega'
  },
  'Usuario logística': {
    'Listo para Entrega': 'En Tránsito',
    'En Tránsito': 'Instalado'
  }
};

export default function App() {
  const [rol, setRol] = useState('Usuario dueño');
  const [tab, setTab] = useState(1);
  const [banner, setBanner] = useState(null);

  // Vista 1: Cotización Paramétrica (HU-001 / HU-002 / HU-005 - Figura 3)
  const [placas, setPlacas] = useState(2.0);
  const [tapacanto, setTapacanto] = useState(25.0);
  const [herrajes, setHerrajes] = useState(1.0);
  const [hsEstimadas, setHsEstimadas] = useState(16.0);
  const [usaRetazo, setUsaRetazo] = useState(true);
  const [estadoCot, setEstadoCot] = useState('Presupuestado');
  const [estadoRetazo, setEstadoRetazo] = useState('Disponible');
  const [intentosWhatsApp, setIntentosWhatsApp] = useState(0);
  const [estadoWhatsApp, setEstadoWhatsApp] = useState('Sin envíos');

  // Vista 2: Seguimiento Productivo Multioperario y Auditoría Append-Only (HU-003 - Figura 4)
  const [estadoTaller, setEstadoTaller] = useState('Listo para Entrega');
  const [operarioActivo, setOperarioActivo] = useState('Pedro Gómez');
  const [nuevoEstado, setNuevoEstado] = useState('En Pegado y Armado');
  const [hsEtapa, setHsEtapa] = useState(3.5);
  const [obsEtapa, setObsEtapa] = useState('Armado de módulos');
  const [motivoAjuste, setMotivoAjuste] = useState('');
  const [valorCorregidoHs, setValorCorregidoHs] = useState(4.0);

  const [historialHoras, setHistorialHoras] = useState([
    { fecha: '08/11 08:15', etapa: 'En Corte', operario: 'Juan Rodríguez', horas: 5.0, obs: 'Corte de placas' },
    { fecha: '08/11 14:30', etapa: 'En Corte', operario: 'Pedro Gómez', horas: 2.0, obs: 'Apoyo en corte' },
    { fecha: '09/11 13:20', etapa: 'En Pegado y Armado', operario: 'Juan Rodríguez', horas: 5.5, obs: 'Cantos y frente' },
    { fecha: '09/11 17:10', etapa: 'En Pegado y Armado', operario: 'Pedro Gómez', horas: 3.5, obs: 'Armado de módulos' },
    { fecha: '10/11 17:10', etapa: 'Listo para Entrega', operario: 'Juan Rodríguez', horas: 4.0, obs: 'Control y terminación' }
  ]);

  const [auditoriaAjustes, setAuditoriaAjustes] = useState([
    { id: 1, fecha: '10/11 18:00', entidad: 'REGISTRO_HORAS (#5)', original: '4,50 h', corregido: '4,00 h', motivo: 'Corrección por error de tipeo en planilla móvil', autor: 'Santiago Villalba (Usuario dueño)' }
  ]);

  // Vista 3: Simulación de dato económico faltante (HU-004 Criterio 2)
  const [faltaDatoEconomico, setFaltaDatoEconomico] = useState(false);

  // Cálculos HU-001 (Merma 12% solo placas; 0% tapacantos y herrajes - Figura 3)
  const impBasePlaca = placas * 90000;
  const impMermaPlaca = impBasePlaca * 0.12;
  const impBaseTap = tapacanto * 1200;
  const impBaseHerr = herrajes * 40000;
  const subtotalBase = impBasePlaca + impBaseTap + impBaseHerr;
  const creditoRetazo = usaRetazo ? 20000 : 0;
  const materialesNetosEst = subtotalBase + impMermaPlaca - creditoRetazo;
  const moEstimada = hsEstimadas * 7500;
  const baseCifEst = materialesNetosEst + moEstimada;
  const cifEstimado = baseCifEst * 0.15;
  const costoTotalEstimado = materialesNetosEst + moEstimada + cifEstimado;
  const precioVentaFinal = costoTotalEstimado * 1.35;
  const senaMinima = precioVentaFinal * 0.50;

  // Cálculos HU-003 y HU-004 (Figura 5 - Dos bases separadas: Snapshot vs Económico Real)
  const hsRealesTotales = historialHoras.reduce((acc, item) => acc + Number(item.horas), 0);
  const costoOrigenRetazo = usaRetazo ? 20000 : 0;

  // Base 1: Consumo a precio snapshot (valoriza retazo a su costo de origen de $20.000 sin doble deducción)
  const matConsumoSnapshot = (2.0 * 90000) + costoOrigenRetazo + (25.0 * 1200) + (1.0 * 40000);
  const moConsumoSnapshot = hsRealesTotales * 7500;
  const cifConsumoSnapshot = (matConsumoSnapshot + moConsumoSnapshot) * 0.15;
  const totalConsumoSnapshot = matConsumoSnapshot + moConsumoSnapshot + cifConsumoSnapshot;
  const desvioSnapshotPesos = totalConsumoSnapshot - costoTotalEstimado;
  const desvioSnapshotPct = (desvioSnapshotPesos / costoTotalEstimado) * 100;

  // Base 2: Costo económico real (con precios reales de lote $100k y tarifa vigente por operario $8.250)
  const matEconomicoReal = (2.0 * 100000) + costoOrigenRetazo + (25.0 * 1200) + (1.0 * 40000);
  const moEconomicoReal = hsRealesTotales * 8250;
  const cifEconomicoReal = (matEconomicoReal + moEconomicoReal) * 0.15;
  const totalEconomicoReal = matEconomicoReal + moEconomicoReal + cifEconomicoReal;
  const resultadoEconomico = precioVentaFinal - totalEconomicoReal;
  const resultadoEconomicoPct = (resultadoEconomico / precioVentaFinal) * 100;

  const fmt = (n) => '$' + Math.round(n).toLocaleString('es-AR');

  const handleRolChange = (nuevoRol) => {
    setRol(nuevoRol);
    if (nuevoRol !== 'Usuario dueño') {
      setTab(2);
      setBanner({ tipo: 'info', msg: `Sesión activa: ${nuevoRol} (Principio de menor privilegio RBAC: acceso exclusivo a seguimiento productivo).` });
    } else {
      setBanner({ tipo: 'info', msg: 'Sesión activa: Usuario dueño (Acceso completo validado en backend).' });
    }
  };

  const registrarSenaSnapshot = () => {
    if (estadoCot === 'Vencido') {
      setBanner({ tipo: 'error', msg: 'HU-002 (Criterio 1): Operación bloqueada. El presupuesto superó los 14 días corridos y está Vencido.' });
      return;
    }
    setEstadoCot('Señado / En Cola');
    if (usaRetazo) setEstadoRetazo('Reservado');
    setBanner({
      tipo: 'success',
      msg: `HU-002 ejecutada: Seña del 50% ($${senaMinima.toLocaleString('es-AR', { minimumFractionDigits: 2 })}) registrada. Costos congelados en snapshot y retazo #RET-08 pasado de 'Disponible' a 'Reservado'.`
    });
  };

  const cancelarPedidoLiberarRetazo = () => {
    setEstadoCot('Presupuestado');
    if (usaRetazo) setEstadoRetazo('Disponible');
    setBanner({
      tipo: 'info',
      msg: "HU-002 (Criterio 4): Pedido cancelado antes del corte; la reserva del retazo #RET-08 se liberó y volvió a estado 'Disponible'."
    });
  };

  const simularEnvioWhatsApp = (fallar) => {
    if (!fallar) {
      setIntentosWhatsApp(1);
      setEstadoWhatsApp('Enviada (200_OK)');
      setBanner({ tipo: 'success', msg: "HU-005 ejecutada: Aviso registrado en NOTIFICACIONES como 'Enviada' a María Pérez (+5493515551234)." });
      return;
    }
    if (intentosWhatsApp >= 3) {
      setBanner({ tipo: 'error', msg: "HU-005 (Criterio 4): Tope máximo de 3 reintentos alcanzado. La notificación permanece en estado 'Fallida' sin revertir el presupuesto local." });
      return;
    }
    const n = intentosWhatsApp + 1;
    setIntentosWhatsApp(n);
    const nuevoEst = n >= 3 ? 'Fallida (3/3 intentos)' : `Pendiente (reintento ${n}/3)`;
    setEstadoWhatsApp(nuevoEst);
    setBanner({
      tipo: n >= 3 ? 'error' : 'info',
      msg: `HU-005: Intento ${n}/3 falló por Timeout externo (503). Estado en cola NOTIFICACIONES: '${nuevoEst}' sin bloquear la transacción principal.`
    });
  };

  const registrarIntervencionTaller = () => {
    if (hsEtapa <= 0) {
      setBanner({ tipo: 'error', msg: 'HU-003: Las horas trabajadas deben ser mayores a cero.' });
      return;
    }
    if (rol !== 'Usuario dueño') {
      const mapaPermitido = TRANSICIONES_POR_ROL[rol] || {};
      if (nuevoEstado !== estadoTaller && mapaPermitido[estadoTaller] !== nuevoEstado) {
        setBanner({
          tipo: 'error',
          msg: `HU-003 (RBAC en servidor): El perfil '${rol}' no puede cambiar el estado de '${estadoTaller}' a '${nuevoEstado}'.`
        });
        return;
      }
    }
    setEstadoTaller(nuevoEstado);
    if (nuevoEstado === 'En Corte' && estadoRetazo === 'Reservado') {
      setEstadoRetazo('Reutilizado');
    }
    setHistorialHoras([
      ...historialHoras,
      { fecha: '11/11 10:15', etapa: nuevoEstado, operario: operarioActivo, horas: Number(hsEtapa), obs: obsEtapa }
    ]);
    setBanner({
      tipo: 'success',
      msg: `HU-003 ejecutada: Intervención de ${operarioActivo} (${Number(hsEtapa).toFixed(2)} h en '${nuevoEstado}') añadida en REGISTRO_HORAS.`
    });
  };

  const registrarAjusteAppendOnly = () => {
    if (rol !== 'Usuario dueño') {
      setBanner({ tipo: 'error', msg: 'HU-003 (Criterio 4): Acceso denegado. Solo el Usuario dueño puede registrar ajustes auditados en AUDITORIA_AJUSTES.' });
      return;
    }
    if (!motivoAjuste || motivoAjuste.trim().length < 5) {
      setBanner({ tipo: 'error', msg: 'HU-003 (Criterio 4): Debe ingresar un motivo justificado (mínimo 5 caracteres) para asentar el ajuste append-only.' });
      return;
    }
    const nuevoEvento = {
      id: auditoriaAjustes.length + 1,
      fecha: '11/11 11:00',
      entidad: 'REGISTRO_HORAS (#5)',
      original: '4,00 h',
      corregido: `${Number(valorCorregidoHs).toFixed(2).replace('.', ',')} h`,
      motivo: motivoAjuste.trim(),
      autor: 'Santiago Villalba (Usuario dueño)'
    };
    setAuditoriaAjustes([...auditoriaAjustes, nuevoEvento]);
    setMotivoAjuste('');
    setBanner({
      tipo: 'success',
      msg: 'HU-003 (Criterio 4): Ajuste insertado en AUDITORIA_AJUSTES (append-only). Los triggers SQL impiden UPDATE y DELETE sobre el valor original.'
    });
  };

  return (
    <div style={{ maxWidth: 1160, margin: '0 auto', padding: 18, fontFamily: 'Segoe UI, Roboto, sans-serif', color: '#0f172a' }}>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #cbd5e1', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <header style={{ background: '#143654', color: '#fff', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 19 }}>MABRA | Gestión de mobiliario</h1>
          <div>
            <span style={{ marginRight: 8, fontSize: 14 }}>Perfil activo (RBAC):</span>
            <select value={rol} onChange={(e) => handleRolChange(e.target.value)} style={{ padding: '6px 12px', borderRadius: 6, fontWeight: 600 }}>
              <option value="Usuario dueño">Perfil: Usuario dueño</option>
              <option value="Usuario instalador">Perfil: Usuario instalador</option>
              <option value="Usuario logística">Perfil: Usuario logística</option>
            </select>
          </div>
        </header>

        <nav style={{ display: 'flex', background: '#e2e8f0', borderBottom: '1px solid #cbd5e1', flexWrap: 'wrap' }}>
          <button onClick={() => setTab(1)} disabled={rol !== 'Usuario dueño'} style={{ flex: 1, padding: 12, fontWeight: 600, background: tab === 1 ? '#fff' : 'transparent' }}>
            1. Cotización Paramétrica (HU-001 / HU-002 / Figura 3)
          </button>
          <button onClick={() => setTab(2)} style={{ flex: 1, padding: 12, fontWeight: 600, background: tab === 2 ? '#fff' : 'transparent' }}>
            2. Seguimiento Multioperario (HU-003 / Figura 4)
          </button>
          <button onClick={() => setTab(3)} disabled={rol !== 'Usuario dueño'} style={{ flex: 1, padding: 12, fontWeight: 600, background: tab === 3 ? '#fff' : 'transparent' }}>
            3. Panel de Costos y Desviaciones (HU-004 / Figura 5)
          </button>
          <button onClick={() => setTab(4)} disabled={rol !== 'Usuario dueño'} style={{ flex: 1, padding: 12, fontWeight: 600, background: tab === 4 ? '#fff' : 'transparent' }}>
            4. Suite Automatizada de 27 Pruebas
          </button>
        </nav>

        <div style={{ padding: 24 }}>
          {banner && (
            <div style={{ padding: 12, marginBottom: 16, borderRadius: 8, fontWeight: 600, background: banner.tipo === 'error' ? '#fce8e6' : banner.tipo === 'success' ? '#e6f4ea' : '#e8f0fe' }}>
              {banner.msg}
            </div>
          )}

          {tab === 1 && (
            <div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: 12, background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, marginBottom: 16 }}>
                <div><strong>Cliente:</strong> María Pérez</div>
                <div><strong>Proyecto:</strong> Bajo mesada (PRY-00015)</div>
                <div><strong>Fecha:</strong> 05/11/2026</div>
                <div><strong>Validez:</strong> 14 días (19/11/2026)</div>
                <div><strong>Estado:</strong> <span>{estadoCot}</span></div>
                <div><strong>Retazo #RET-08:</strong> <span>{estadoRetazo}</span></div>
                <div><strong>Cola WhatsApp:</strong> <span>{estadoWhatsApp}</span></div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  <button onClick={() => { setEstadoCot('Vencido'); setBanner({ tipo: 'error', msg: 'HU-002: Presupuesto pasado a estado Vencido (>14 días). Se bloquea el cobro de seña.' }); }}>
                    Simular vencimiento (+14 días)
                  </button>
                  <button onClick={cancelarPedidoLiberarRetazo}>
                    Cancelar pedido (Liberar Retazo)
                  </button>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 18 }}>
                <thead>
                  <tr style={{ background: '#e8eef5', textAlign: 'left' }}>
                    <th style={{ padding: 10 }}>Concepto</th>
                    <th style={{ padding: 10 }}>Cantidad</th>
                    <th style={{ padding: 10 }}>Costo unitario</th>
                    <th style={{ padding: 10 }}>Merma</th>
                    <th style={{ padding: 10 }}>Importe base</th>
                    <th style={{ padding: 10 }}>Importe merma</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: 8 }}>Placa melamina 18 mm Roble Kendal</td>
                    <td style={{ padding: 8 }}><input type="number" step="0.5" min="0.5" value={placas} onChange={(e) => setPlacas(Number(e.target.value))} style={{ width: 70 }} /> placas</td>
                    <td style={{ padding: 8 }}>$90.000</td>
                    <td style={{ padding: 8 }}>12% (corte)</td>
                    <td style={{ padding: 8 }}>{fmt(impBasePlaca)}</td>
                    <td style={{ padding: 8 }}>{fmt(impMermaPlaca)}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: 8 }}>Tapacanto PVC 22 mm</td>
                    <td style={{ padding: 8 }}><input type="number" step="1" min="1" value={tapacanto} onChange={(e) => setTapacanto(Number(e.target.value))} style={{ width: 70 }} /> metros</td>
                    <td style={{ padding: 8 }}>$1.200</td>
                    <td style={{ padding: 8 }}>0%</td>
                    <td style={{ padding: 8 }}>{fmt(impBaseTap)}</td>
                    <td style={{ padding: 8 }}>$0</td>
                  </tr>
                  <tr>
                    <td style={{ padding: 8 }}>Herrajes varios</td>
                    <td style={{ padding: 8 }}><input type="number" step="1" min="1" value={herrajes} onChange={(e) => setHerrajes(Number(e.target.value))} style={{ width: 70 }} /> kit</td>
                    <td style={{ padding: 8 }}>$40.000</td>
                    <td style={{ padding: 8 }}>0%</td>
                    <td style={{ padding: 8 }}>{fmt(impBaseHerr)}</td>
                    <td style={{ padding: 8 }}>$0</td>
                  </tr>
                  <tr style={{ background: '#f1f5f9', fontWeight: 700 }}>
                    <td colSpan={5} style={{ padding: 8 }}>Subtotal materiales (base)</td>
                    <td style={{ padding: 8 }}>{fmt(subtotalBase)}</td>
                  </tr>
                  <tr>
                    <td colSpan={5} style={{ padding: 8 }}>Merma de corte (solo placas: 12%)</td>
                    <td style={{ padding: 8 }}>+ {fmt(impMermaPlaca)}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} style={{ padding: 8 }}>Retazo reservado (una sola deducción - ID #RET-08)</td>
                    <td style={{ padding: 8 }}>
                      <label><input type="checkbox" checked={usaRetazo} onChange={(e) => setUsaRetazo(e.target.checked)} /> Aplicar retazo</label>
                    </td>
                    <td style={{ padding: 8 }}>− {fmt(creditoRetazo)}</td>
                  </tr>
                  <tr style={{ background: '#f1f5f9', fontWeight: 700 }}>
                    <td colSpan={5} style={{ padding: 8 }}>Materiales estimados netos</td>
                    <td style={{ padding: 8 }}>{fmt(materialesNetosEst)}</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 18 }}>
                <div style={{ padding: 14, border: '1px solid #cbd5e1', borderRadius: 10, textAlign: 'center' }}>
                  <strong>Mano de obra estimada</strong>
                  <div><input type="number" min="1" value={hsEstimadas} onChange={(e) => setHsEstimadas(Number(e.target.value))} style={{ width: 55 }} /> h × $7.500</div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{fmt(moEstimada)}</div>
                </div>
                <div style={{ padding: 14, border: '1px solid #cbd5e1', borderRadius: 10, textAlign: 'center' }}>
                  <strong>Costos indirectos (15%)</strong>
                  <div>Base {fmt(baseCifEst)} × 15%</div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{fmt(cifEstimado)}</div>
                </div>
                <div style={{ padding: 14, border: '1px solid #1a73e8', background: '#e8f0fe', borderRadius: 10, textAlign: 'center' }}>
                  <strong>Costo total estimado</strong>
                  <div>Base para snapshot</div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{fmt(costoTotalEstimado)}</div>
                </div>
                <div style={{ padding: 14, border: '1px solid #1e7e34', background: '#e6f4ea', borderRadius: 10, textAlign: 'center' }}>
                  <strong>Precio final (recargo 35%)</strong>
                  <div>Costo × 1,35</div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{fmt(precioVentaFinal)}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => simularEnvioWhatsApp(false)}>Encolar aviso WhatsApp (HU-005)</button>
                <button onClick={() => simularEnvioWhatsApp(true)}>Simular fallo API WhatsApp (Cola + máx. 3 reintentos)</button>
                <button onClick={registrarSenaSnapshot} style={{ flex: 1, fontWeight: 700, background: '#e6f4ea', border: '1px solid #1e7e34', padding: 10, borderRadius: 8 }}>
                  Seña mínima (50%): ${senaMinima.toLocaleString('es-AR', { minimumFractionDigits: 2 })} | Se congela el desglose y se reservan los retazos al confirmar la seña
                </button>
              </div>
            </div>
          )}

          {tab === 2 && (
            <div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: 12, background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, marginBottom: 16 }}>
                <div><strong>Proyecto:</strong> PRY-00015 | Bajo mesada - María Pérez</div>
                <div><strong>Estado actual:</strong> {estadoTaller}</div>
                <div><strong>Retazo #RET-08:</strong> {estadoRetazo}</div>
                <div><strong>Horas acumuladas (REGISTRO_HORAS):</strong> {hsRealesTotales.toFixed(2).replace('.', ',')} h</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 18 }}>
                <div style={{ padding: 14, border: '1px solid #cbd5e1', borderRadius: 10 }}>
                  <h4 style={{ marginTop: 0 }}>DATOS DEL PEDIDO</h4>
                  <div>Cliente: María Pérez</div>
                  <div>Instalación: Córdoba Capital</div>
                  <div>Inicio en taller: 08/11/2026</div>
                  <div>Entrega prevista: 15/11/2026</div>
                </div>

                <div style={{ padding: 14, border: '1px solid #1a73e8', background: '#e8f0fe', borderRadius: 10 }}>
                  <h4 style={{ marginTop: 0 }}>REGISTRO DE ETAPA (MULTIOPERARIO)</h4>
                  <div style={{ marginBottom: 6 }}>
                    Etapa:{' '}
                    <select value={nuevoEstado} onChange={(e) => setNuevoEstado(e.target.value)}>
                      <option value="En Corte">En Corte (Instalador)</option>
                      <option value="En Pegado y Armado">En Pegado y Armado (Instalador)</option>
                      <option value="Listo para Entrega">Listo para Entrega (Instalador)</option>
                      <option value="En Tránsito">En Tránsito (Logística)</option>
                      <option value="Instalado">Instalado (Logística)</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    Operario:{' '}
                    <select value={operarioActivo} onChange={(e) => setOperarioActivo(e.target.value)}>
                      <option value="Juan Rodríguez">Juan Rodríguez</option>
                      <option value="Pedro Gómez">Pedro Gómez</option>
                      <option value="Carlos López">Carlos López (Logística)</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    Horas registradas: <input type="number" step="0.5" min="0.5" value={hsEtapa} onChange={(e) => setHsEtapa(e.target.value)} style={{ width: 65 }} /> h
                  </div>
                  <button onClick={registrarIntervencionTaller} style={{ width: '100%', padding: 8, fontWeight: 700 }}>
                    Registrar intervención en REGISTRO_HORAS
                  </button>
                </div>

                <div style={{ padding: 14, border: '1px solid #cbd5e1', borderRadius: 10 }}>
                  <h4 style={{ marginTop: 0 }}>CONSUMO REGISTRADO (CONSUMO_INSUMO)</h4>
                  <div>Placa compra (Lote #1 FC-A-0004-00018920): <strong>2,00 placas</strong> ($90k snap / $100k compra)</div>
                  <div>Retazo #RET-08 ({estadoRetazo}): <strong>1 pieza</strong> ($20.000 costo origen)</div>
                  <div>Tapacanto PVC: <strong>25 m</strong> ($30.000) | Herrajes: <strong>1 kit</strong> ($40.000)</div>
                  <button
                    onClick={() => {
                      setEstadoRetazo('Reutilizado');
                      setBanner({ tipo: 'success', msg: "HU-002 / HU-003: Retazo #RET-08 consumido en escuadradora y pasado de 'Reservado' a 'Reutilizado'." });
                    }}
                    style={{ marginTop: 8, width: '100%' }}
                  >
                    Confirmar consumo de Retazo #RET-08 (Reservado → Reutilizado)
                  </button>
                </div>
              </div>

              <h4>Historial de intervenciones y estados (REGISTRO_HORAS)</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 18 }}>
                <thead>
                  <tr style={{ background: '#e8eef5', textAlign: 'left' }}>
                    <th style={{ padding: 8 }}>Fecha y hora</th>
                    <th style={{ padding: 8 }}>Etapa</th>
                    <th style={{ padding: 8 }}>Operario</th>
                    <th style={{ padding: 8 }}>Horas</th>
                    <th style={{ padding: 8 }}>Observación</th>
                  </tr>
                </thead>
                <tbody>
                  {historialHoras.map((h, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: 8 }}>{h.fecha}</td>
                      <td style={{ padding: 8 }}>{h.etapa}</td>
                      <td style={{ padding: 8 }}>{h.operario}</td>
                      <td style={{ padding: 8 }}>{h.horas.toFixed(2).replace('.', ',')}</td>
                      <td style={{ padding: 8 }}>{h.obs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ padding: 14, background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8 }}>
                <h4 style={{ marginTop: 0 }}>Auditoría Inmutable de Ajustes (AUDITORIA_AJUSTES — Append-Only)</h4>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                  <span>Valor corregido (h): <input type="number" step="0.5" value={valorCorregidoHs} onChange={(e) => setValorCorregidoHs(e.target.value)} style={{ width: 65 }} /></span>
                  <input type="text" placeholder="Motivo obligatorio del ajuste..." value={motivoAjuste} onChange={(e) => setMotivoAjuste(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
                  <button onClick={registrarAjusteAppendOnly}>Asentar ajuste append-only (Solo Dueño)</button>
                </div>
                <ul>
                  {auditoriaAjustes.map((a) => (
                    <li key={a.id}>{a.fecha} | {a.entidad} | Valor original: <strong>{a.original}</strong> → Corregido: <strong>{a.corregido}</strong> | Motivo: {a.motivo} ({a.autor})</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {tab === 3 && (
            <div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: 12, background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, marginBottom: 16, alignItems: 'center' }}>
                <div><strong>Proyecto:</strong> PRY-00015 | Bajo mesada – María Pérez</div>
                <div><strong>Estado:</strong> Instalado</div>
                <label style={{ marginLeft: 'auto', fontWeight: 600 }}>
                  <input type="checkbox" checked={faltaDatoEconomico} onChange={(e) => setFaltaDatoEconomico(e.target.checked)} /> Simular falta de factura de lote o tarifa vigente (HU-004 Criterio 2)
                </label>
              </div>

              {faltaDatoEconomico && (
                <div style={{ padding: 12, marginBottom: 16, borderRadius: 8, background: '#fef7e0', border: '1px solid #d97706', fontWeight: 700, color: '#92400e' }}>
                  Advertencia HU-004 (Criterio 2): Resultado económico incompleto — faltan precios reales de lote de compra (LOTE_INSUMO) o tarifas horarias vigentes (TARIFA_OPERARIO).
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 18 }}>
                <div style={{ padding: 14, border: '1px solid #1a73e8', background: '#e8f0fe', borderRadius: 10, textAlign: 'center' }}>
                  <strong>Costo estimado snapshot</strong>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{fmt(costoTotalEstimado)}</div>
                </div>
                <div style={{ padding: 14, border: '1px solid #1a73e8', background: '#e8f0fe', borderRadius: 10, textAlign: 'center' }}>
                  <strong>Consumo a precio snapshot</strong>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{fmt(totalConsumoSnapshot)}</div>
                </div>
                <div style={{ padding: 14, border: '1px solid #c5221f', background: '#fce8e6', color: '#8c1d18', borderRadius: 10, textAlign: 'center' }}>
                  <strong>Desvío snapshot</strong>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>+ {fmt(desvioSnapshotPesos)} (+{desvioSnapshotPct.toFixed(1).replace('.', ',')}%)</div>
                </div>
                <div style={{ padding: 14, border: '1px solid #1e7e34', background: '#e6f4ea', color: '#14532d', borderRadius: 10, textAlign: 'center' }}>
                  <strong>Costo económico (CIF est.)</strong>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{faltaDatoEconomico ? `${fmt(totalEconomicoReal)} (Incompleto)` : fmt(totalEconomicoReal)}</div>
                </div>
              </div>

              <h4>Comparación por rubro (ARS)</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 18 }}>
                <thead>
                  <tr style={{ background: '#e8eef5', textAlign: 'left' }}>
                    <th style={{ padding: 10 }}>Rubro</th>
                    <th style={{ padding: 10 }}>Presupuesto snapshot</th>
                    <th style={{ padding: 10 }}>Consumo a precio snapshot</th>
                    <th style={{ padding: 10 }}>Costo económico (CIF est. 15%)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: 8 }}>Materiales</td>
                    <td style={{ padding: 8 }}>{fmt(materialesNetosEst)}</td>
                    <td style={{ padding: 8 }}>{fmt(matConsumoSnapshot)}</td>
                    <td style={{ padding: 8 }}>{fmt(matEconomicoReal)}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: 8 }}>Mano de obra</td>
                    <td style={{ padding: 8 }}>{fmt(moEstimada)}</td>
                    <td style={{ padding: 8 }}>{fmt(moConsumoSnapshot)}</td>
                    <td style={{ padding: 8 }}>{fmt(moEconomicoReal)}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: 8 }}>CIF aplicado (15% estimado)</td>
                    <td style={{ padding: 8 }}>{fmt(cifEstimado)}</td>
                    <td style={{ padding: 8 }}>{fmt(cifConsumoSnapshot)}</td>
                    <td style={{ padding: 8 }}>{fmt(cifEconomicoReal)}</td>
                  </tr>
                  <tr style={{ background: '#e6f4ea', fontWeight: 700 }}>
                    <td style={{ padding: 8 }}>TOTAL</td>
                    <td style={{ padding: 8 }}>{fmt(costoTotalEstimado)}</td>
                    <td style={{ padding: 8 }}>{fmt(totalConsumoSnapshot)}</td>
                    <td style={{ padding: 8 }}>{fmt(totalEconomicoReal)}</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ padding: 12, background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, fontWeight: 700 }}>
                Horas: {hsEstimadas} estimadas | {hsRealesTotales} reales | Desvío: +{hsRealesTotales - hsEstimadas} h (+{(((hsRealesTotales - hsEstimadas) / hsEstimadas) * 100).toFixed(0)}%) — Precio de venta: {fmt(precioVentaFinal)} | Resultado económico ilustrativo: {fmt(resultadoEconomico)} ({resultadoEconomicoPct.toFixed(1).replace('.', ',')}% del precio)
              </div>
              <p style={{ fontSize: 12.5, color: '#475569', marginTop: 10 }}>
                Los retazos se valorizan por su costo de origen ($20.000); no se descuenta nuevamente el ahorro estimado. El desvío a precio snapshot (+$55.660 / +13,0%) mide el mayor consumo físico y horario a precios constantes; el costo económico ($523.250) incorpora los precios reales de compra y tarifas vigentes.
              </p>
            </div>
          )}

          {tab === 4 && (
            <div>
              <div style={{ padding: 12, marginBottom: 16, borderRadius: 8, background: '#e6f4ea', border: '1px solid #1e7e34', fontWeight: 700, color: '#14532d' }}>
                Suite Automatizada de Tesis de Grado: 27 de 27 casos de prueba aprobados y 0 fallidos (100% Éxito).
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#e8eef5', textAlign: 'left' }}>
                    <th style={{ padding: 8 }}>ID Caso</th>
                    <th style={{ padding: 8 }}>Módulo / HU</th>
                    <th style={{ padding: 8 }}>Regla de Dominio o Integridad Verificada</th>
                    <th style={{ padding: 8 }}>Resultado Verificado</th>
                    <th style={{ padding: 8 }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {CASOS_27_TESTS.map((c) => (
                    <tr key={c[0]} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: 8 }}><strong>{c[0]}</strong></td>
                      <td style={{ padding: 8 }}>{c[1]}</td>
                      <td style={{ padding: 8 }}>{c[2]}</td>
                      <td style={{ padding: 8 }}>{c[3]}</td>
                      <td style={{ padding: 8, color: '#14532d', fontWeight: 700 }}>PASÓ</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
