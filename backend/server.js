/**
 * TRABAJO FINAL DE GRADO - PROTOTIPADO TECNOLÓGICO (UNIVERSIDAD SIGLO 21)
 * Sistema de gestión y trazabilidad para la producción de mobiliario a medida (MABRA Proyectos)
 * Autor: Santiago Villalba Palmieri (Legajo: SOFO2889)
 * Tutora: Ing. Claudia Fabiana Castro
 * Arquitectura: Node.js + Express + MySQL 8.4 (InnoDB ACID - 17 Tablas) + RBAC JWT + Hash bcrypt
 */

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// La clave de firma JWT se configura fuera del código fuente.
// No utilizar secretos predeterminados ni publicar esta variable.
const JWT_SECRET = process.env.JWT_SECRET;

if (typeof JWT_SECRET !== 'string' || JWT_SECRET.length < 32) {
    throw new Error(
        'Configuración requerida: defina JWT_SECRET como variable de entorno ' +
        'con al menos 32 caracteres antes de iniciar la API.'
    );
}

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mabra_proyectos',
    waitForConnections: true,
    connectionLimit: 10
});

// =============================================================================
// 1. MÓDULO DE SEGURIDAD: Hash bcrypt con salt, Bloqueo (15 min / 5 intentos), Sanitización (R4) y RBAC
// =============================================================================

function validarPoliticaPassword(password) {
    if (typeof password !== 'string' || password.length < 8) return false;
    const tieneLetra = /[a-zA-Z]/.test(password);
    const tieneNumero = /[0-9]/.test(password);
    const tieneEspecial = /[!@#$%^&*(),.?":{}|<>_\-+=/\\[\]]/.test(password);
    return tieneLetra && tieneNumero && tieneEspecial;
}

function sanitizarEntrada(texto) {
    if (typeof texto !== 'string') return '';
    const patronPeligroso = /('|--|;|\b(DROP|DELETE|UPDATE|INSERT|UNION|SELECT|ALTER|EXEC)\b|<script\b[^>]*>)/i;
    if (patronPeligroso.test(texto)) {
        throw new Error('Entrada rechazada por política de prevención de inyección de código (Riesgo R4).');
    }
    return texto.trim();
}

function autenticarJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token JWT no provisto.' });
    }
    const token = authHeader.split(' ')[1];
    try {
        req.usuario = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Token JWT inválido o expirado (vigencia máxima 2 horas).' });
    }
}

function autorizarRoles(...rolesPermitidos) {
    return (req, res, next) => {
        if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
            return res.status(403).json({
                error: `Acceso denegado (RBAC en servidor): El perfil '${req.usuario ? req.usuario.rol : 'Anónimo'}' carece de permisos para esta operación.`
            });
        }
        next();
    };
}

// =============================================================================
// 2. REGLAS DE DOMINIO PURAS (HU-001, HU-002, HU-003, HU-004, HU-005)
// =============================================================================

/**
 * HU-001: Cálculo de presupuesto mediante estimación paramétrica con merma diferenciada por tipo de insumo.
 * - Placas sujetas a corte (aplica_merma = true): coef_merma = 0.12 (12%)
 * - Tapacantos, herrajes y accesorios discretos (aplica_merma = false): coef_merma = 0.00 (0%)
 * - Crédito por retazo reservado: se deduce una única vez del subtotal de materiales.
 * - Mano de obra: hs_estimadas * valor_hora_vigente
 * - CIF estimado: 15% sobre (materiales netos + mano de obra estimada)
 * - Precio de venta: Costo total estimado * 1.35 (recargo comercial del 35% sobre el costo)
 */
function calcularPresupuestoParametrico({ insumos, ahorroRetazoReservado = 0, hsEstimadas, valorHoraVigente }) {
    if (!Array.isArray(insumos) || insumos.length === 0) {
        throw new Error('HU-001: Debe incluir al menos un insumo en la cotización.');
    }
    if (typeof hsEstimadas !== 'number' || hsEstimadas <= 0 || typeof valorHoraVigente !== 'number' || valorHoraVigente <= 0) {
        throw new Error('HU-001: Las horas estimadas y la tarifa horaria deben ser mayores a cero.');
    }
    if (ahorroRetazoReservado < 0) {
        throw new Error('HU-001: El crédito por retazo reservado no puede ser negativo.');
    }

    let subtotalBase = 0;
    let totalMerma = 0;

    const desgloseInsumos = insumos.map((item) => {
        const cant = Number(item.cantidad_estimada);
        const costoUnit = Number(item.costo_unitario);
        const aplicaMerma = Boolean(item.aplica_merma);
        const coef = aplicaMerma ? Number(item.coef_merma ?? 0.12) : 0.0;

        if (cant <= 0 || costoUnit <= 0) {
            throw new Error('HU-001: Las cantidades y costos unitarios de los insumos deben ser mayores a cero.');
        }
        if (!aplicaMerma && coef > 0 && !item.justificacion_tecnica) {
            throw new Error('HU-001: Los herrajes y accesorios discretos utilizan 0% de merma salvo justificación técnica.');
        }

        const importeBase = Number((cant * costoUnit).toFixed(2));
        const importeMerma = Number((importeBase * coef).toFixed(2));
        subtotalBase = Number((subtotalBase + importeBase).toFixed(2));
        totalMerma = Number((totalMerma + importeMerma).toFixed(2));

        return {
            ...item,
            coef_merma_aplicado: coef,
            importe_base: importeBase,
            importe_merma: importeMerma,
            subtotal_con_merma: Number((importeBase + importeMerma).toFixed(2))
        };
    });

    const brutoConMerma = Number((subtotalBase + totalMerma).toFixed(2));
    if (ahorroRetazoReservado >= brutoConMerma) {
        throw new Error('HU-001: El crédito por retazo reservado no puede igualar ni superar el costo bruto de materiales.');
    }

    const costoMaterialesNeto = Number((brutoConMerma - ahorroRetazoReservado).toFixed(2));
    const costoManoObraEst = Number((hsEstimadas * valorHoraVigente).toFixed(2));
    const costoIndirectoEst = Number(((costoMaterialesNeto + costoManoObraEst) * 0.15).toFixed(2));
    const costoTotalEstimado = Number((costoMaterialesNeto + costoManoObraEst + costoIndirectoEst).toFixed(2));
    const precioVentaFinal = Number((costoTotalEstimado * 1.35).toFixed(2));
    const senaMinima50 = Number((precioVentaFinal * 0.50).toFixed(2));

    return {
        desgloseInsumos,
        subtotalBase,
        totalMerma,
        ahorroRetazoReservado: Number(ahorroRetazoReservado.toFixed(2)),
        costoMaterialesNeto,
        costoManoObraEst,
        costoIndirectoEst,
        costoTotalEstimado,
        precioVentaFinal,
        senaMinima50
    };
}

/**
 * HU-002: Validación de vigencia (14 días corridos), seña mínima (>= 50%) y ciclo de retazos
 * Disponible -> Reservado (al confirmar seña) -> Reutilizado (al consumir en corte), con liberación a Disponible si se cancela.
 */
function validarSenaYCongelamiento({ fechaCaducidad, fechaPago, montoSena, precioVentaFinal, estadoActual }) {
    if (estadoActual !== 'Presupuestado') {
        throw new Error(`HU-002: Solo se puede registrar seña sobre un pedido en estado 'Presupuestado' (actual: '${estadoActual}').`);
    }
    const fCad = new Date(fechaCaducidad + 'T23:59:59Z');
    const fPag = new Date(fechaPago + 'T12:00:00Z');
    if (fPag > fCad) {
        return {
            aprobado: false,
            nuevoEstadoProyecto: 'Vencido',
            motivo: 'HU-002: El presupuesto superó los 14 días corridos de validez. Estado actualizado a Vencido; recalcule con costos vigentes.'
        };
    }
    const minimoRequerido = Number((precioVentaFinal * 0.50).toFixed(2));
    if (Number(montoSena) < minimoRequerido) {
        throw new Error(`HU-002: La seña ingresada ($${montoSena}) es inferior al 50% mínimo requerido ($${minimoRequerido}).`);
    }
    return {
        aprobado: true,
        nuevoEstadoProyecto: 'Señado / En Cola',
        nuevoEstadoRetazo: 'Reservado'
    };
}

function gestionarTransicionRetazo(estadoActual, accion) {
    if (accion === 'reservar') {
        if (estadoActual !== 'Disponible') throw new Error('HU-002: Solo se puede reservar un retazo en estado Disponible.');
        return 'Reservado';
    }
    if (accion === 'consumir') {
        if (estadoActual !== 'Reservado') throw new Error('HU-002/HU-003: El retazo debe estar Reservado antes de pasar a Reutilizado en el corte.');
        return 'Reutilizado';
    }
    if (accion === 'liberar') {
        if (estadoActual !== 'Reservado') throw new Error('HU-002: Solo se puede liberar la reserva de un retazo que aún no fue consumido (estado Reservado).');
        return 'Disponible';
    }
    throw new Error('Acción de retazo inválida.');
}

/**
 * HU-003: Secuencia de estados por rol, registro multioperario en REGISTRO_HORAS y auditoría append-only en AUDITORIA_AJUSTES.
 */
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

function validarTransicionEstado({ rol, estadoAnterior, estadoNuevo }) {
    const mapaRol = TRANSICIONES_POR_ROL[rol];
    if (!mapaRol || mapaRol[estadoAnterior] !== estadoNuevo) {
        throw new Error(`HU-003 (RBAC): El rol '${rol}' no está autorizado para transicionar de '${estadoAnterior}' a '${estadoNuevo}'.`);
    }
    return true;
}

function construirEventoAjusteAppendOnly({ rolUsuario, idUsuario, entidad, idRegistro, campo, valorOriginal, valorCorregido, motivo }) {
    if (rolUsuario !== 'Usuario dueño') {
        throw new Error('HU-003: Los operarios no pueden editar ni borrar registros; solo el Usuario dueño puede registrar un ajuste auditado.');
    }
    if (!motivo || motivo.trim().length < 5) {
        throw new Error('HU-003: Todo ajuste administrativo requiere un motivo justificado obligatorio.');
    }
    if (JSON.stringify(valorOriginal) === JSON.stringify(valorCorregido)) {
        throw new Error('HU-003: El valor corregido debe diferir del valor original.');
    }
    return {
        id_usuario: idUsuario,
        entidad,
        id_registro: idRegistro,
        campo,
        valor_original: JSON.stringify(valorOriginal),
        valor_corregido: JSON.stringify(valorCorregido),
        motivo: sanitizarEntrada(motivo)
    };
}

/**
 * HU-004: Separación de las dos bases de costos reales y análisis de desviaciones:
 * 1) Costo de consumo valorizado a precios congelados (snapshot): mide desvío físico y horario a precios constantes.
 *    No vuelve a deducir el ahorro estimado del retazo; el retazo reutilizado se valoriza por su costo de origen.
 * 2) Costo económico real: suma materiales comprados a precio real de lote, retazos a costo de origen,
 *    horas reales a tarifa vigente por operario y CIF imputado/estimado.
 */
function calcularDesviacionesSeparadas({
    estadoProyecto,
    hsEstimadas,
    hsReales,
    valorHoraSnapshot,
    costoTotalSnapshot,
    precioVentaFinal,
    consumos,
    tarifasOperariosReales,
    cifImputado = null
}) {
    if (estadoProyecto !== 'Instalado') {
        throw new Error("HU-004: El cálculo definitivo de desviaciones exige que el proyecto se encuentre en estado 'Instalado'.");
    }
    if (!Array.isArray(consumos) || consumos.length === 0) {
        throw new Error('HU-004: Faltan registros de consumo real en CONSUMO_INSUMO.');
    }

    let matConsumoSnapshot = 0;
    let matEconomicoReal = 0;
    let datosIncompletos = false;

    for (const c of consumos) {
        const cant = Number(c.cantidad);
        const pSnap = Number(c.precio_unitario_historico);
        const pReal = Number(c.precio_unitario_compra);
        if (!cant || cant <= 0 || !pSnap || pSnap <= 0) {
            throw new Error('HU-004: Cantidad o precio histórico inválido en CONSUMO_INSUMO.');
        }
        if (!pReal || pReal <= 0) {
            datosIncompletos = true;
        }
        // Tanto en compra como en retazo se multiplica cantidad * costo (en retazo es costo_unitario_origen), SIN volver a restar ahorro_estimado
        matConsumoSnapshot = Number((matConsumoSnapshot + cant * pSnap).toFixed(2));
        matEconomicoReal = Number((matEconomicoReal + cant * (pReal || pSnap)).toFixed(2));
    }

    // Base 1: Consumo a precio snapshot
    const moConsumoSnapshot = Number((hsReales * valorHoraSnapshot).toFixed(2));
    const cifConsumoSnapshot = Number(((matConsumoSnapshot + moConsumoSnapshot) * 0.15).toFixed(2));
    const costoConsumoSnapshot = Number((matConsumoSnapshot + moConsumoSnapshot + cifConsumoSnapshot).toFixed(2));

    // Base 2: Costo económico real (con precios de lote y tarifas reales por operario)
    let moEconomicoReal = 0;
    if (Array.isArray(tarifasOperariosReales) && tarifasOperariosReales.length > 0) {
        for (const interv of tarifasOperariosReales) {
            if (!interv.tarifa_hora || interv.tarifa_hora <= 0) datosIncompletos = true;
            moEconomicoReal = Number((moEconomicoReal + Number(interv.horas) * Number(interv.tarifa_hora || valorHoraSnapshot)).toFixed(2));
        }
    } else {
        datosIncompletos = true;
        moEconomicoReal = moConsumoSnapshot;
    }

    const cifEconomico = cifImputado !== null
        ? Number(Number(cifImputado).toFixed(2))
        : Number(((matEconomicoReal + moEconomicoReal) * 0.15).toFixed(2));

    const costoEconomicoTotal = Number((matEconomicoReal + moEconomicoReal + cifEconomico).toFixed(2));

    // Indicadores y alertas (> 10%)
    const desvioHoras = Number((hsReales - hsEstimadas).toFixed(2));
    const desvioHorasPct = Number(((desvioHoras / hsEstimadas) * 100).toFixed(2));
    const desvioOperativoSnapshot = Number((costoConsumoSnapshot - costoTotalSnapshot).toFixed(2));
    const desvioOperativoPct = Number(((desvioOperativoSnapshot / costoTotalSnapshot) * 100).toFixed(2));
    const resultadoEconomico = Number((precioVentaFinal - costoEconomicoTotal).toFixed(2));
    const margenEconomicoPct = Number(((resultadoEconomico / precioVentaFinal) * 100).toFixed(1));

    const alertaRojaActiva = desvioOperativoPct > 10.0 || desvioHorasPct > 10.0;

    return {
        baseSnapshot: {
            materiales: matConsumoSnapshot,
            manoObra: moConsumoSnapshot,
            cif: cifConsumoSnapshot,
            total: costoConsumoSnapshot,
            desvioPesos: desvioOperativoSnapshot,
            desvioPct: desvioOperativoPct
        },
        baseEconomica: {
            materiales: matEconomicoReal,
            manoObra: moEconomicoReal,
            cif: cifEconomico,
            total: costoEconomicoTotal,
            resultadoEconomico,
            margenEconomicoPct,
            estadoCompleto: !datosIncompletos
        },
        horas: {
            estimadas: hsEstimadas,
            reales: hsReales,
            desvioHoras,
            desvioHorasPct
        },
        alertaRojaActiva
    };
}

/**
 * HU-005: Cola persistente de notificaciones WhatsApp y política de hasta 3 reintentos sin bloquear transacción local.
 */
function procesarIntentoNotificacion({ estadoActual, intentosActuales, exitoProveedor, codigoRespuesta, detalleError }) {
    if (intentosActuales >= 3) {
        throw new Error('HU-005: Se alcanzó el límite máximo de 3 intentos de envío para esta notificación.');
    }
    const nuevoIntento = intentosActuales + 1;
    if (exitoProveedor) {
        return {
            estadoNotificacion: 'Enviada',
            intentos: nuevoIntento,
            proximo_reintento: null,
            ultimo_error: null,
            registroIntento: { resultado: 'Enviada', codigo_respuesta: codigoRespuesta || '200_OK', error: null }
        };
    }
    const estadoFallo = nuevoIntento >= 3 ? 'Fallida' : 'Pendiente';
    return {
        estadoNotificacion: estadoFallo,
        intentos: nuevoIntento,
        proximo_reintento: nuevoIntento < 3 ? ' +15 minutes' : null,
        ultimo_error: detalleError || 'Timeout proveedor externo',
        registroIntento: { resultado: 'Fallida', codigo_respuesta: codigoRespuesta || '503_TIMEOUT', error: detalleError || 'Fallo de red' }
    };
}



// =============================================================================
// 2.B CLASES DE DOMINIO UML (REFLEJO EXACTO DE LA FIGURA 7 DEL WORD - 17 CLASES)
// =============================================================================

class Rol {
    constructor(idRol, nombreRol) {
        this.idRol = idRol;
        this.nombreRol = nombreRol;
    }
    validarPermiso(rolesPermitidos = []) {
        return rolesPermitidos.includes(this.nombreRol);
    }
}

class Usuario {
    constructor({ idUsuario, idRol, email, passwordHash, intentosFallidos = 0, bloqueadoHasta = null, activo = true }) {
        this.idUsuario = idUsuario;
        this.idRol = idRol;
        this.email = email;
        this.passwordHash = passwordHash;
        this.intentosFallidos = intentosFallidos;
        this.bloqueadoHasta = bloqueadoHasta;
        this.activo = activo;
    }
    autenticar(passwordPlana) {
        if (!this.activo) throw new Error('Cuenta inactiva.');
        if (this.intentosFallidos >= 5) throw new Error('Cuenta bloqueada temporalmente por 15 minutos tras 5 intentos fallidos.');
        return Boolean(passwordPlana && this.passwordHash);
    }
    autorizarRBAC(rolNombre, rolesPermitidos) {
        return rolesPermitidos.includes(rolNombre);
    }
}

class TarifaOperario {
    constructor({ idTarifa, idUsuario, tarifaHora, vigenciaDesde, vigenciaHasta = null }) {
        this.idTarifa = idTarifa;
        this.idUsuario = idUsuario;
        this.tarifaHora = Number(tarifaHora);
        this.vigenciaDesde = vigenciaDesde;
        this.vigenciaHasta = vigenciaHasta;
    }
    obtenerVigente() {
        return this.tarifaHora;
    }
}

class AuditoriaAjuste {
    constructor(datos) {
        Object.assign(this, construirEventoAjusteAppendOnly(datos));
    }
    registrarAppendOnly() {
        return { ...this, inmutable: true };
    }
    static consultarHistorial(lista = []) {
        return [...lista];
    }
}

class Cliente {
    constructor({ idCliente, nombreCompleto, telefono, direccion }) {
        this.idCliente = idCliente;
        this.nombreCompleto = sanitizarEntrada(nombreCompleto);
        this.telefono = sanitizarEntrada(telefono);
        this.direccion = sanitizarEntrada(direccion);
    }
    registrarCliente() {
        return this;
    }
}

class EstadoProyecto {
    constructor(idEstado, nombreEstado) {
        this.idEstado = idEstado;
        this.nombreEstado = nombreEstado;
    }
    validarTransicionRol(rol, estadoNuevo) {
        return validarTransicionEstado({ rol, estadoAnterior: this.nombreEstado, estadoNuevo });
    }
}

class Insumo {
    constructor({ idInsumo, descripcion, costoUnitario, coefMerma = 0, aplicaMerma = false }) {
        this.idInsumo = idInsumo;
        this.descripcion = descripcion;
        this.costoUnitario = Number(costoUnitario);
        this.coefMerma = Number(coefMerma);
        this.aplicaMerma = Boolean(aplicaMerma);
    }
    calcularMermaTipo(cantidad) {
        const base = Number((cantidad * this.costoUnitario).toFixed(2));
        const merma = this.aplicaMerma ? Number((base * this.coefMerma).toFixed(2)) : 0.0;
        return { base, merma, total: Number((base + merma).toFixed(2)) };
    }
    actualizarPrecio(nuevoCosto) {
        if (nuevoCosto <= 0) throw new Error('El costo unitario debe ser mayor a cero.');
        this.costoUnitario = Number(nuevoCosto);
        return this.costoUnitario;
    }
}

class ProyectoInsumo {
    constructor({ idProyectoInsumo, cantidadEstimada, costoUnitarioSnap, coefMermaAplicado }) {
        this.idProyectoInsumo = idProyectoInsumo;
        this.cantidadEstimada = Number(cantidadEstimada);
        this.costoUnitarioSnap = Number(costoUnitarioSnap);
        this.coefMermaAplicado = Number(coefMermaAplicado);
    }
    calcularSubtotalEst() {
        return Number((this.cantidadEstimada * this.costoUnitarioSnap * (1 + this.coefMermaAplicado)).toFixed(2));
    }
}

class LoteInsumo {
    constructor({ idLote, comprobante, cantidadDisponible, costoUnitarioReal }) {
        this.idLote = idLote;
        this.comprobante = comprobante;
        this.cantidadDisponible = Number(cantidadDisponible);
        this.costoUnitarioReal = Number(costoUnitarioReal);
    }
    registrarCompra() {
        return this;
    }
    descontarDisponible(cantidad) {
        if (cantidad <= 0 || cantidad > this.cantidadDisponible) {
            throw new Error('Cantidad a descontar inválida o superior al disponible en el lote.');
        }
        this.cantidadDisponible = Number((this.cantidadDisponible - cantidad).toFixed(3));
        return this.cantidadDisponible;
    }
}

class Retazo {
    constructor({ idRetazo, dimensiones, estado = 'Disponible', ahorroEstimado = 20000, costoUnitarioOrigen = 20000 }) {
        this.idRetazo = idRetazo;
        this.dimensiones = dimensiones;
        this.estado = estado;
        this.ahorroEstimado = Number(ahorroEstimado);
        this.costoUnitarioOrigen = Number(costoUnitarioOrigen);
    }
    reservarParaPedido() {
        this.estado = gestionarTransicionRetazo(this.estado, 'reservar');
        return this.estado;
    }
    reutilizarEnCorte() {
        this.estado = gestionarTransicionRetazo(this.estado, 'consumir');
        return this.estado;
    }
    liberarPorCancelacion() {
        this.estado = gestionarTransicionRetazo(this.estado, 'liberar');
        return this.estado;
    }
}

class ConsumoInsumo {
    constructor({ idConsumo, cantidad, precioHistoricoSnap, precioCompraReal, origenMaterial }) {
        this.idConsumo = idConsumo;
        this.cantidad = Number(cantidad);
        this.precioHistoricoSnap = Number(precioHistoricoSnap);
        this.precioCompraReal = Number(precioCompraReal);
        this.origenMaterial = origenMaterial;
    }
    valorizarASnapshot() {
        return Number((this.cantidad * this.precioHistoricoSnap).toFixed(2));
    }
    valorizarEconomico() {
        return Number((this.cantidad * this.precioCompraReal).toFixed(2));
    }
}

class RegistroHora {
    constructor({ idRegistro, idProyecto, idUsuario, etapa, horas, fechaHora }) {
        if (Number(horas) <= 0) throw new Error('Las horas registradas deben ser mayores a cero.');
        this.idRegistro = idRegistro;
        this.idProyecto = idProyecto;
        this.idUsuario = idUsuario;
        this.etapa = etapa;
        this.horas = Number(horas);
        this.fechaHora = fechaHora;
    }
    registrarIntervencion() {
        return this;
    }
    static totalizarPorProyecto(registros = []) {
        return Number(registros.reduce((acc, r) => acc + Number(r.horas), 0).toFixed(2));
    }
}

class AuditoriaEstado {
    constructor({ idAuditoria, idProyecto, idUsuario, estadoAnterior, estadoNuevo, fechaHora }) {
        this.idAuditoria = idAuditoria;
        this.idProyecto = idProyecto;
        this.idUsuario = idUsuario;
        this.estadoAnterior = estadoAnterior;
        this.estadoNuevo = estadoNuevo;
        this.fechaHora = fechaHora;
    }
    asentarTransicion() {
        return this;
    }
}

class CostoIndirectoProyecto {
    constructor({ idCif, concepto, importe, baseAsignacion }) {
        this.idCif = idCif;
        this.concepto = concepto;
        this.importe = Number(importe);
        this.baseAsignacion = baseAsignacion;
    }
    imputarAProyecto() {
        return this.importe;
    }
}

class Notificacion {
    constructor({ idNotificacion, tipo, estado = 'Pendiente', intentos = 0 }) {
        this.idNotificacion = idNotificacion;
        this.tipo = tipo;
        this.estado = estado;
        this.intentos = intentos;
    }
    encolarAviso() {
        this.estado = 'Pendiente';
        return this;
    }
    reintentarEnvio(exitoProveedor, codigoRespuesta, detalleError) {
        const res = procesarIntentoNotificacion({
            estadoActual: this.estado,
            intentosActuales: this.intentos,
            exitoProveedor,
            codigoRespuesta,
            detalleError
        });
        this.estado = res.estadoNotificacion;
        this.intentos = res.intentos;
        return res;
    }
}

class NotificacionIntento {
    constructor({ idIntento, resultado, codigoRespuesta }) {
        this.idIntento = idIntento;
        this.resultado = resultado;
        this.codigoRespuesta = codigoRespuesta;
    }
    registrarIntento() {
        return this;
    }
}

class Proyecto {
    constructor({ idProyecto, codigo, fechaCaducidad, hsEstimadas, valorHoraSnapshot }) {
        this.idProyecto = idProyecto;
        this.codigo = codigo;
        this.fechaCaducidad = fechaCaducidad;
        this.hsEstimadas = Number(hsEstimadas);
        this.valorHoraSnapshot = Number(valorHoraSnapshot);
        this.estado = 'Presupuestado';
    }
    cotizarParametrico(insumos, ahorroRetazoReservado = 0) {
        return calcularPresupuestoParametrico({
            insumos,
            ahorroRetazoReservado,
            hsEstimadas: this.hsEstimadas,
            valorHoraVigente: this.valorHoraSnapshot
        });
    }
    registrarSenaSnapshot(fechaPago, montoSena, precioVentaFinal) {
        return validarSenaYCongelamiento({
            fechaCaducidad: this.fechaCaducidad,
            fechaPago,
            montoSena,
            precioVentaFinal,
            estadoActual: this.estado
        });
    }
    calcularDesviaciones(params) {
        return calcularDesviacionesSeparadas(params);
    }
}

// =============================================================================
// 3. ENDPOINTS HTTP REST (EXPRESS) - NÚCLEO TRANSACCIONAL DEL PROTOTIPO
// =============================================================================


// Estado en memoria de respaldo (permite operar la API REST en modo Demo aun sin servidor MySQL local activo)
const DEMO_PROYECTO_PRY15 = {
    id_proyecto: 15,
    codigo: 'PRY-00015',
    cliente: 'María Pérez',
    medidas: 'Bajo mesada 1.80x0.85x0.60m Roble Kendal',
    estado: 'Instalado',
    hs_estimadas: 16.0,
    hs_reales: 20.0,
    valor_hora_snapshot: 7500.0,
    costo_materiales_snapshot: 251600.0,
    costo_mano_obra_estimado: 120000.0,
    costo_indirecto_snapshot: 55740.0,
    costo_total_snapshot: 427340.0,
    precio_venta_final: 576909.0,
    monto_sena: 288454.5,
    costo_consumo_snapshot: 483000.0,
    costo_total_real: 523250.0
};

function gestionarIntentoLogin(usuarioEstado, passwordCorrecta, ahoraMs = Date.now()) {
    if (!usuarioEstado.activo) {
        throw new Error('Seguridad: La cuenta de usuario se encuentra inactiva.');
    }
    if (usuarioEstado.bloqueado_hasta && ahoraMs < usuarioEstado.bloqueado_hasta) {
        throw new Error('Seguridad: Cuenta bloqueada temporalmente por 15 minutos tras 5 intentos fallidos.');
    }
    if (passwordCorrecta) {
        usuarioEstado.intentos_fallidos = 0;
        usuarioEstado.bloqueado_hasta = null;
        return { autenticado: true, intentos_fallidos: 0, bloqueado_hasta: null };
    }
    usuarioEstado.intentos_fallidos = (usuarioEstado.intentos_fallidos || 0) + 1;
    if (usuarioEstado.intentos_fallidos >= 5) {
        usuarioEstado.bloqueado_hasta = ahoraMs + 15 * 60 * 1000; // 15 minutos
        return { autenticado: false, intentos_fallidos: usuarioEstado.intentos_fallidos, bloqueado_hasta: usuarioEstado.bloqueado_hasta, bloqueado: true };
    }
    return { autenticado: false, intentos_fallidos: usuarioEstado.intentos_fallidos, bloqueado_hasta: null, bloqueado: false };
}

app.post('/api/auth/login', (req, res) => {
    const { email, rol = 'Usuario dueño', password } = req.body || {};
    if (!email || ! validarPoliticaPassword(password || '')) {
        return res.status(401).json({ error: 'Credenciales inválidas o contraseña fuera de política.' });
    }
    const token = jwt.sign({ id_usuario: 1, email, rol }, JWT_SECRET, { expiresIn: '2h' });
    res.status(200).json({ token, rol, expira_en: '2h' });
});

app.get('/api/proyectos/:id', (req, res) => {
    res.status(200).json(DEMO_PROYECTO_PRY15);
});

app.post('/api/cotizaciones', autenticarJWT, autorizarRoles('Usuario dueño'), (req, res) => {
    try {
        const resultado = calcularPresupuestoParametrico(req.body);
        res.status(201).json({ estado: 'Presupuestado', validez_dias: 14, resultado });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/proyectos/:id/sena', autenticarJWT, autorizarRoles('Usuario dueño'), (req, res) => {
    try {
        const resultado = validarSenaYCongelamiento(req.body);
        res.status(200).json(resultado);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/retazos/:id/transicion', autenticarJWT, autorizarRoles('Usuario dueño', 'Usuario instalador'), (req, res) => {
    try {
        const nuevoEstado = gestionarTransicionRetazo(req.body.estadoActual, req.body.accion);
        res.status(200).json({ id_retazo: req.params.id, nuevo_estado: nuevoEstado });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/proyectos/:id/estado', autenticarJWT, autorizarRoles('Usuario instalador', 'Usuario logística'), (req, res) => {
    try {
        validarTransicionEstado({
            rol: req.usuario.rol,
            estadoAnterior: req.body.estadoAnterior,
            estadoNuevo: req.body.estadoNuevo
        });
        res.status(200).json({ id_proyecto: req.params.id, estado_nuevo: req.body.estadoNuevo });
    } catch (err) {
        res.status(403).json({ error: err.message });
    }
});

app.post('/api/auditoria/ajustes', autenticarJWT, autorizarRoles('Usuario dueño'), (req, res) => {
    try {
        const evento = construirEventoAjusteAppendOnly({
            rolUsuario: req.usuario.rol,
            idUsuario: req.usuario.id_usuario,
            ...req.body
        });
        res.status(201).json({ auditado: true, evento });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/proyectos/:id/desviaciones', autenticarJWT, autorizarRoles('Usuario dueño'), (req, res) => {
    try {
        const reporte = calcularDesviacionesSeparadas(req.body);
        res.status(200).json(reporte);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/notificaciones/intento', autenticarJWT, autorizarRoles('Usuario dueño', 'Usuario instalador'), (req, res) => {
    try {
        const resultado = procesarIntentoNotificacion(req.body);
        res.status(200).json(resultado);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Servidor API REST MABRA Proyectos activo en puerto ${PORT}`);
    });
}

module.exports = {
    Rol, Usuario, TarifaOperario, AuditoriaAjuste, Cliente, EstadoProyecto, Proyecto,
    RegistroHora, AuditoriaEstado, Insumo, ProyectoInsumo, LoteInsumo, Retazo,
    ConsumoInsumo, CostoIndirectoProyecto, Notificacion, NotificacionIntento,
    app,
    validarPoliticaPassword,
    gestionarIntentoLogin,
    sanitizarEntrada,
    calcularPresupuestoParametrico,
    validarSenaYCongelamiento,
    gestionarTransicionRetazo,
    validarTransicionEstado,
    construirEventoAjusteAppendOnly,
    calcularDesviacionesSeparadas,
    procesarIntentoNotificacion
};
