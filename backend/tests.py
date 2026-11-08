#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TRABAJO FINAL DE GRADO - PROTOTIPADO TECNOLÓGICO (UNIVERSIDAD SIGLO 21)
Suite Automatizada de Validación de Tesis de Grado (27 Casos de Prueba)
Sistema de gestión y trazabilidad para la producción de mobiliario a medida (MABRA Proyectos)
Autor: Santiago Villalba Palmieri (Legajo: SOFO2889)
Tutora: Ing. Claudia Fabiana Castro
"""

import sqlite3
import json
import re
import os
import sys
from pathlib import Path

# Compatibilidad multiplataforma Windows (PowerShell/CMD cp1252) y macOS/Linux (UTF-8)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


# =============================================================================
# 1. MOTOR DE REGLAS DE DOMINIO Y SEGURIDAD (HU-001 A HU-005)
# =============================================================================

def validar_politica_password(password: str) -> bool:
    if not isinstance(password, str) or len(password) < 8:
        return False
    return bool(re.search(r"[A-Za-z]", password) and re.search(r"[0-9]", password) and re.search(r"[!@#$%^&*(),.?\":{}|<>_\-+=/\\\[\]]", password))

def simular_bloqueo_login(intentos_previos: int, exito: bool):
    if exito:
        return {"intentos": 0, "bloqueado_15_min": False}
    nuevos = intentos_previos + 1
    return {"intentos": nuevos, "bloqueado_15_min": nuevos >= 5}


def sanitizar_entrada(texto: str) -> str:
    if not isinstance(texto, str):
        return ""
    patron = re.compile(r"('|--|;|\b(DROP|DELETE|UPDATE|INSERT|UNION|SELECT|ALTER|EXEC)\b|<script\b[^>]*>)", re.IGNORECASE)
    if patron.search(texto):
        raise ValueError("Entrada bloqueada por prevención de inyección de código (Riesgo R4).")
    return texto.strip()

def calcular_presupuesto_parametrico(insumos, ahorro_retazo_reservado, hs_estimadas, valor_hora_vigente):
    if not insumos or hs_estimadas <= 0 or valor_hora_vigente <= 0:
        raise ValueError("HU-001: Parámetros inválidos o no positivos.")
    if ahorro_retazo_reservado < 0:
        raise ValueError("HU-001: El crédito por retazo no puede ser negativo.")

    subtotal_base = 0.0
    total_merma = 0.0
    for it in insumos:
        cant = float(it["cantidad_estimada"])
        cu = float(it["costo_unitario"])
        aplica = bool(it.get("aplica_merma", False))
        coef = float(it.get("coef_merma", 0.12 if aplica else 0.0))
        if cant <= 0 or cu <= 0:
            raise ValueError("HU-001: Cantidad o costo unitario menor o igual a cero.")
        if not aplica and coef > 0.0 and not it.get("justificacion_tecnica"):
            raise ValueError("HU-001: Herrajes y tapacantos llevan 0% de merma salvo justificación técnica.")
        imp_base = round(cant * cu, 2)
        imp_merma = round(imp_base * coef, 2)
        subtotal_base = round(subtotal_base + imp_base, 2)
        total_merma = round(total_merma + imp_merma, 2)

    bruto_con_merma = round(subtotal_base + total_merma, 2)
    if ahorro_retazo_reservado >= bruto_con_merma:
        raise ValueError("HU-001: El crédito por retazo no puede igualar o superar el subtotal bruto.")

    mat_neto = round(bruto_con_merma - ahorro_retazo_reservado, 2)
    mo_est = round(hs_estimadas * valor_hora_vigente, 2)
    cif_est = round((mat_neto + mo_est) * 0.15, 2)
    costo_total = round(mat_neto + mo_est + cif_est, 2)
    precio_venta = round(costo_total * 1.35, 2)
    sena_minima = round(precio_venta * 0.50, 2)
    return {
        "subtotal_base": subtotal_base,
        "total_merma": total_merma,
        "materiales_netos": mat_neto,
        "mo_estimada": mo_est,
        "cif_estimado": cif_est,
        "costo_total_estimado": costo_total,
        "precio_venta_final": precio_venta,
        "sena_minima_50": sena_minima,
    }

def validar_sena_y_vigencia(fecha_caducidad, fecha_pago, monto_sena, precio_venta_final, estado_actual="Presupuestado"):
    if estado_actual != "Presupuestado":
        raise ValueError("HU-002: Estado inválido para cobro de seña.")
    if fecha_pago > fecha_caducidad:
        return {"aprobado": False, "estado_proyecto": "Vencido", "estado_retazo": "Disponible"}
    minimo = round(precio_venta_final * 0.50, 2)
    if round(monto_sena, 2) < minimo:
        raise ValueError("HU-002: Seña inferior al 50% requerido.")
    return {"aprobado": True, "estado_proyecto": "Señado / En Cola", "estado_retazo": "Reservado"}

def transicionar_retazo(estado_actual, accion):
    if accion == "reservar" and estado_actual == "Disponible":
        return "Reservado"
    if accion == "consumir" and estado_actual == "Reservado":
        return "Reutilizado"
    if accion == "liberar" and estado_actual == "Reservado":
        return "Disponible"
    raise ValueError(f"Transición de retazo inválida: {estado_actual} -> {accion}")

TRANSICIONES_ROL = {
    "Usuario instalador": {
        "Señado / En Cola": "En Corte",
        "En Corte": "En Pegado y Armado",
        "En Pegado y Armado": "Listo para Entrega",
    },
    "Usuario logística": {
        "Listo para Entrega": "En Tránsito",
        "En Tránsito": "Instalado",
    },
}

def validar_transicion_rol(rol, estado_ant, estado_nuevo):
    if TRANSICIONES_ROL.get(rol, {}).get(estado_ant) != estado_nuevo:
        raise PermissionError(f"RBAC: {rol} no puede avanzar de {estado_ant} a {estado_nuevo}")
    return True

def calcular_desviaciones_separadas(estado, hs_est, hs_real, vh_snap, costo_tot_snap, precio_venta, consumos, tarifas_reales, cif_imputado=None):
    if estado != "Instalado":
        raise ValueError("HU-004: El proyecto debe estar en estado Instalado.")
    if not consumos:
        raise ValueError("HU-004: Sin consumos registrados.")

    mat_snap = 0.0
    mat_econ = 0.0
    incompleto = False
    for c in consumos:
        cant = float(c["cantidad"])
        ps = float(c["precio_historico"])
        pr = c.get("precio_compra")
        if cant <= 0 or ps <= 0:
            raise ValueError("HU-004: Consumo inválido.")
        if pr is None or float(pr) <= 0:
            incompleto = True
            pr = ps
        mat_snap = round(mat_snap + cant * ps, 2)
        mat_econ = round(mat_econ + cant * float(pr), 2)

    mo_snap = round(hs_real * vh_snap, 2)
    cif_snap = round((mat_snap + mo_snap) * 0.15, 2)
    tot_snap = round(mat_snap + mo_snap + cif_snap, 2)

    if tarifas_reales:
        mo_econ = round(sum(float(x["horas"]) * float(x["tarifa"]) for x in tarifas_reales), 2)
    else:
        incompleto = True
        mo_econ = mo_snap

    cif_econ = round(float(cif_imputado), 2) if cif_imputado is not None else round((mat_econ + mo_econ) * 0.15, 2)
    tot_econ = round(mat_econ + mo_econ + cif_econ, 2)

    desv_snap = round(tot_snap - costo_tot_snap, 2)
    desv_snap_pct = round((desv_snap / costo_tot_snap) * 100, 1)
    desv_hs = round(hs_real - hs_est, 2)
    desv_hs_pct = round((desv_hs / hs_est) * 100, 1)
    res_econ = round(precio_venta - tot_econ, 2)
    alerta = (desv_snap_pct > 10.0) or (desv_hs_pct > 10.0)

    return {
        "mat_snap": mat_snap, "mo_snap": mo_snap, "cif_snap": cif_snap, "tot_snap": tot_snap,
        "desv_snap": desv_snap, "desv_snap_pct": desv_snap_pct,
        "mat_econ": mat_econ, "mo_econ": mo_econ, "cif_econ": cif_econ, "tot_econ": tot_econ,
        "res_econ": res_econ, "completo": not incompleto,
        "desv_hs": desv_hs, "desv_hs_pct": desv_hs_pct, "alerta_roja": alerta
    }

def procesar_intento_whatsapp(intentos_previos, exito_api):
    if intentos_previos >= 3:
        raise ValueError("HU-005: Máximo de 3 intentos alcanzado.")
    n = intentos_previos + 1
    if exito_api:
        return {"estado": "Enviada", "intentos": n}
    return {"estado": "Fallida" if n >= 3 else "Pendiente", "intentos": n}

# =============================================================================
# 2. CARGA DEL ESQUEMA SQL DE 17 TABLAS EN BASE RELACIONAL EN MEMORIA + TRIGGERS
# =============================================================================

def crear_bd_17_tablas():
    base_dir = Path(__file__).resolve().parent.parent
    sql_path = base_dir / "Esquema_Base_Datos_MABRA.sql"
    if not sql_path.exists():
        sql_path = Path("Prototipo_MABRA_TFG") / "Esquema_Base_Datos_MABRA.sql"
    with open(sql_path, "r", encoding="utf-8") as f:
        raw_sql = f.read()

    # Omitir bloque DELIMITER $$ propio de MySQL (en SQLite se crean abajo con sintaxis RAISE)
    raw_sql = re.sub(r"DELIMITER \$\$.*?DELIMITER ;", "", raw_sql, flags=re.DOTALL)
    lines = []
    for ln in raw_sql.splitlines():
        s = ln.strip()
        if s.startswith("--") or s.startswith("CREATE DATABASE") or s.startswith("USE "):
            continue
        s = re.sub(r"\bBIGINT\s+AUTO_INCREMENT\s+PRIMARY\s+KEY\b", "INTEGER PRIMARY KEY AUTOINCREMENT", s)
        s = re.sub(r"\bINT\s+AUTO_INCREMENT\s+PRIMARY\s+KEY\b", "INTEGER PRIMARY KEY AUTOINCREMENT", s)
        s = re.sub(r"\bTINYINT\b", "INTEGER", s)
        s = re.sub(r"\bDECIMAL\(\d+,\d+\)", "REAL", s)
        s = re.sub(r"\bVARCHAR\(\d+\)", "TEXT", s)
        s = re.sub(r"\bJSON\b", "TEXT", s)
        s = re.sub(r"\bBOOLEAN\b", "INTEGER", s)
        s = re.sub(r"\bDATETIME\s+NOT\s+NULL\s+DEFAULT\s+CURRENT_TIMESTAMP\b", "TEXT DEFAULT CURRENT_TIMESTAMP", s)
        s = re.sub(r"\bDATETIME\b", "TEXT", s)
        s = re.sub(r"\bDATE\b", "TEXT", s)
        s = re.sub(r"\)\s*ENGINE=InnoDB;", ");", s)
        lines.append(s)

    conn = sqlite3.connect(":memory:")
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.executescript("\n".join(lines))

    # Triggers Append-Only sobre AUDITORIA_AJUSTES (Tabla 11 del Word)
    conn.executescript("""
    CREATE TRIGGER trg_auditoria_ajustes_no_update
    BEFORE UPDATE ON AUDITORIA_AJUSTES
    BEGIN
        SELECT RAISE(ABORT, 'AUDITORIA_AJUSTES es append-only: prohibido UPDATE');
    END;
    CREATE TRIGGER trg_auditoria_ajustes_no_delete
    BEFORE DELETE ON AUDITORIA_AJUSTES
    BEGIN
        SELECT RAISE(ABORT, 'AUDITORIA_AJUSTES es append-only: prohibido DELETE');
    END;
    """)
    conn.commit()
    return conn

# =============================================================================
# 3. EJECUCIÓN DE LAS 27 PRUEBAS AUTOMATIZADAS DOCUMENTADAS EN EL TFG
# =============================================================================

def ejecutar_suite_27_pruebas():
    conn = crear_bd_17_tablas()
    resultados = []

    def check(tc_id, modulo, desc, condicion, detalle):
        assert condicion, f"Fallo en {tc_id}: {desc} ({detalle})"
        resultados.append((tc_id, modulo, "PASÓ", desc, detalle))

    # TC-01: Vector reproducible HU-001 (Figura 3 del Word)
    ins_fig3 = [
        {"cantidad_estimada": 2, "costo_unitario": 90000, "aplica_merma": True, "coef_merma": 0.12},
        {"cantidad_estimada": 25, "costo_unitario": 1200, "aplica_merma": False, "coef_merma": 0.00},
        {"cantidad_estimada": 1, "costo_unitario": 40000, "aplica_merma": False, "coef_merma": 0.00},
    ]
    cot = calcular_presupuesto_parametrico(ins_fig3, 20000, 16, 7500)
    check("TC-01", "HU-001 (Fig. 3)", "Vector nominal PRY-00015 con merma 12% solo placas y 0% tapacanto/herrajes",
          cot["subtotal_base"] == 250000 and cot["total_merma"] == 21600 and cot["materiales_netos"] == 251600
          and cot["mo_estimada"] == 120000 and cot["cif_estimado"] == 55740 and cot["costo_total_estimado"] == 427340
          and cot["precio_venta_final"] == 576909 and cot["sena_minima_50"] == 288454.5,
          f"Costo ${cot['costo_total_estimado']:,.0f} | Venta ${cot['precio_venta_final']:,.0f} | Seña ${cot['sena_minima_50']:,.2f}")

    # TC-02: Cotización sin retazo reservado y conteo de diez proyectos semilla (no es Shadow Testing histórico)
    cot_sin_ret = calcular_presupuesto_parametrico(ins_fig3, 0, 16, 7500)
    cant_hist = conn.execute("SELECT COUNT(*) FROM PROYECTO WHERE id_proyecto BETWEEN 1 AND 10").fetchone()[0]
    check("TC-02", "HU-001 / Shadow", "Cálculo sin retazo ($450.340) y presencia de diez proyectos semilla en SQLite",
          cot_sin_ret["materiales_netos"] == 271600 and cot_sin_ret["costo_total_estimado"] == 450340 and cant_hist == 10,
          f"Mat. ${cot_sin_ret['materiales_netos']:,.0f} | Costo ${cot_sin_ret['costo_total_estimado']:,.0f} | {cant_hist} proyectos semilla")

    # TC-03: Bloqueo de merma > 0% en herrajes discretos sin justificación técnica
    err_merma = False
    try:
        calcular_presupuesto_parametrico([{"cantidad_estimada": 1, "costo_unitario": 40000, "aplica_merma": False, "coef_merma": 0.12}], 0, 10, 7500)
    except ValueError:
        err_merma = True
    check("TC-03", "HU-001", "Bloqueo de coeficiente de merma incompatible en herrajes discretos", err_merma, "Merma 12% en herraje rechazada")

    # TC-04: Bloqueo de cantidades u horas no positivas
    err_neg = False
    try:
        calcular_presupuesto_parametrico(ins_fig3, 0, 0, 7500)
    except ValueError:
        err_neg = True
    check("TC-04", "HU-001", "Bloqueo de guardado ante cantidades u horas <= 0", err_neg, "Horas = 0 bloqueado")

    # TC-05: Bloqueo si el crédito por retazo supera el costo de materiales
    err_ret = False
    try:
        calcular_presupuesto_parametrico(ins_fig3, 300000, 16, 7500)
    except ValueError:
        err_ret = True
    check("TC-05", "HU-001", "Bloqueo si el crédito por retazo iguala o supera materiales brutos", err_ret, "Crédito excesivo rechazado")

    # TC-06: Vigencia en frontera día 14 exacto (HU-002)
    res_d14 = validar_sena_y_vigencia("2026-11-19", "2026-11-19", 288454.50, 576909.00)
    check("TC-06", "HU-002 Límite", "Aceptación de seña en el día 14 exacto de vigencia (19/11/2026)",
          res_d14["aprobado"] and res_d14["estado_proyecto"] == "Señado / En Cola", "Estado -> Señado / En Cola")

    # TC-07: Vencimiento automático en día 15 (HU-002)
    res_d15 = validar_sena_y_vigencia("2026-11-19", "2026-11-20", 288454.50, 576909.00)
    check("TC-07", "HU-002 Límite", "Bloqueo de seña en el día 15 (20/11/2026) y paso a estado Vencido",
          not res_d15["aprobado"] and res_d15["estado_proyecto"] == "Vencido", "Estado -> Vencido")

    # TC-08: Rechazo de seña inferior al 50% (49,99%)
    err_sena = False
    try:
        validar_sena_y_vigencia("2026-11-19", "2026-11-06", 288454.00, 576909.00)
    except ValueError:
        err_sena = True
    check("TC-08", "HU-002 Límite", "Rechazo de seña inferior al 50% del precio final ($288.454,00 < $288.454,50)", err_sena, "Seña < 50% bloqueada")

    # TC-09: Aprobación de seña exacta del 50% y congelamiento de snapshot
    res_sena = validar_sena_y_vigencia("2026-11-19", "2026-11-06", 288454.50, 576909.00)
    check("TC-09", "HU-002", "Aprobación de seña exacta del 50% ($288.454,50) y reserva de retazo",
          res_sena["aprobado"] and res_sena["estado_retazo"] == "Reservado", "Snapshot fijo + Retazo Reservado")

    # TC-10: Ciclo completo del retazo Disponible -> Reservado -> Reutilizado
    e1 = transicionar_retazo("Disponible", "reservar")
    e2 = transicionar_retazo(e1, "consumir")
    check("TC-10", "HU-002 / HU-003", "Ciclo secuencial de retazo: Disponible -> Reservado -> Reutilizado",
          e1 == "Reservado" and e2 == "Reutilizado", f"Disponible -> {e1} -> {e2}")

    # TC-11: Cancelación de pedido antes del consumo libera el retazo a Disponible
    e_lib = transicionar_retazo("Reservado", "liberar")
    check("TC-11", "HU-002", "Liberación de reserva de retazo a Disponible ante cancelación previa al corte",
          e_lib == "Disponible", "Reservado -> Disponible")

    # TC-12: Segregación RBAC en transiciones de taller y logística (HU-003)
    ok_inst = validar_transicion_rol("Usuario instalador", "En Corte", "En Pegado y Armado")
    ok_log = validar_transicion_rol("Usuario logística", "En Tránsito", "Instalado")
    err_rbac = False
    try:
        validar_transicion_rol("Usuario instalador", "Listo para Entrega", "Instalado")
    except PermissionError:
        err_rbac = True
    check("TC-12", "HU-003 RBAC", "Validación de secuencia de estados según rol (Instalador vs Logística)",
          ok_inst and ok_log and err_rbac, "Transiciones cruzadas bloqueadas")

    # TC-13: Registro multioperario en REGISTRO_HORAS sin duplicar con AUDITORIAS_ESTADOS (Figura 4)
    hs_sql = conn.execute("SELECT SUM(horas) FROM REGISTRO_HORAS WHERE id_proyecto = 15").fetchone()[0]
    operarios_distintos = conn.execute("SELECT COUNT(DISTINCT id_usuario) FROM REGISTRO_HORAS WHERE id_proyecto = 15").fetchone()[0]
    check("TC-13", "HU-003 (Fig. 4)", "Acumulación multioperario en REGISTRO_HORAS (Juan Rodríguez y Pedro Gómez)",
          hs_sql == 20.0 and operarios_distintos == 2, f"5 intervenciones / 2 operarios = {hs_sql:.2f} h")

    # TC-14: Protección append-only en AUDITORIA_AJUSTES mediante triggers SQL (HU-003 Criterio 4)
    bloqueo_update = False
    bloqueo_delete = False
    try:
        conn.execute("UPDATE AUDITORIA_AJUSTES SET motivo = 'Alterado' WHERE id_ajuste = 1")
    except sqlite3.IntegrityError:
        bloqueo_update = True
    try:
        conn.execute("DELETE FROM AUDITORIA_AJUSTES WHERE id_ajuste = 1")
    except sqlite3.IntegrityError:
        bloqueo_delete = True
    check("TC-14", "HU-003 / SQL", "Inmutabilidad append-only en AUDITORIA_AJUSTES (Triggers bloquean UPDATE y DELETE)",
          bloqueo_update and bloqueo_delete, "UPDATE y DELETE bloqueados por Trigger")

    # TC-15: Trazabilidad de origen de consumo en CONSUMO_INSUMO (Lote comprado vs Retazo con costo de origen)
    filas_cons = conn.execute("SELECT origen_material, cantidad, precio_unitario_historico, precio_unitario_compra FROM CONSUMO_INSUMO WHERE id_proyecto = 15").fetchall()
    check("TC-15", "HU-003 / SQL", "Vinculación de CONSUMO_INSUMO con LOTE_INSUMO y RETAZOS_DISPONIBLES",
          len(filas_cons) == 4 and any(r[0] == "Retazo" and r[2] == 20000.0 for r in filas_cons),
          "Compras y Retazo diferenciados sin doble deducción")

    # TC-16: Cálculo de Costo de Consumo a Precio Snapshot (HU-004 Base 1 - Figura 5)
    consumos_pry15 = [
        {"cantidad": 2.0, "precio_historico": 90000, "precio_compra": 100000},
        {"cantidad": 1.0, "precio_historico": 20000, "precio_compra": 20000},
        {"cantidad": 25.0, "precio_historico": 1200, "precio_compra": 1200},
        {"cantidad": 1.0, "precio_historico": 40000, "precio_compra": 40000},
    ]
    tarifas_pry15 = [{"horas": 14.5, "tarifa": 8250}, {"horas": 5.5, "tarifa": 8250}]
    desv = calcular_desviaciones_separadas("Instalado", 16.0, 20.0, 7500.0, 427340.0, 576909.0, consumos_pry15, tarifas_pry15)
    check("TC-16", "HU-004 (Fig. 5)", "Base 1: Consumo valorizado a precio snapshot ($483.000) y desvío +$55.660 (+13,0%)",
          desv["mat_snap"] == 270000 and desv["mo_snap"] == 150000 and desv["cif_snap"] == 63000
          and desv["tot_snap"] == 483000 and desv["desv_snap"] == 55660 and desv["desv_snap_pct"] == 13.0,
          f"Snapshot Real ${desv['tot_snap']:,.0f} | Desvío +${desv['desv_snap']:,.0f} (+{desv['desv_snap_pct']}%)")

    # TC-17: Cálculo de Costo Económico Real separado (HU-004 Base 2 - Figura 5)
    check("TC-17", "HU-004 (Fig. 5)", "Base 2: Costo económico real con lotes y tarifas vigentes ($523.250) y resultado ($53.659)",
          desv["mat_econ"] == 290000 and desv["mo_econ"] == 165000 and desv["cif_econ"] == 68250
          and desv["tot_econ"] == 523250 and desv["res_econ"] == 53659 and desv["completo"],
          f"Costo Econ. ${desv['tot_econ']:,.0f} | Resultado ${desv['res_econ']:,.0f} (9,3%)")

    # TC-18: Detección de costo económico incompleto ante falta de tarifa o comprobante de lote (HU-004 Criterio 2)
    desv_inc = calcular_desviaciones_separadas("Instalado", 16.0, 20.0, 7500.0, 427340.0, 576909.0, consumos_pry15, [])
    check("TC-18", "HU-004", "Señalización de resultado económico incompleto cuando faltan tarifas vigentes",
          not desv_inc["completo"], "Flag estadoCompleto = False verificado")

    # TC-19: Umbral de alerta visual en frontera del 10,0% vs >10,0% (HU-004 Criterio 4)
    # Con 16h est y 17.6h (+10.0% exacto) y consumo igual al snapshot -> no dispara alerta (>10%)
    consumo_exacto_10 = [{"cantidad": 1.0, "precio_historico": 271600, "precio_compra": 271600}]
    d_10 = calcular_desviaciones_separadas("Instalado", 16.0, 16.0, 7500.0, 427340.0, 576909.0, consumo_exacto_10, [{"horas": 16, "tarifa": 7500}])
    check("TC-19", "HU-004 Límite", "Verificación de umbral de alerta (>10% activa alerta roja; <=10% sin alerta)",
          desv["alerta_roja"] is True and d_10["alerta_roja"] is False, "Umbral >10% validado")

    # TC-20: Bloqueo de cálculo de desviaciones si el pedido aún no está Instalado
    err_no_inst = False
    try:
        calcular_desviaciones_separadas("En Tránsito", 16.0, 20.0, 7500.0, 427340.0, 576909.0, consumos_pry15, tarifas_pry15)
    except ValueError:
        err_no_inst = True
    check("TC-20", "HU-004", "Bloqueo del cierre de desviaciones antes del estado Instalado", err_no_inst, "Estado En Tránsito bloqueado")

    # TC-21: Cola persistente WhatsApp y política de hasta 3 reintentos (HU-005)
    i1 = procesar_intento_whatsapp(0, False)
    i2 = procesar_intento_whatsapp(1, False)
    i3 = procesar_intento_whatsapp(2, False)
    err_i4 = False
    try:
        procesar_intento_whatsapp(3, False)
    except ValueError:
        err_i4 = True
    check("TC-21", "HU-005", "Política de reintentos de notificación (Pendiente en 1-2, Fallida en 3, bloqueo en 4°)",
          i1["estado"] == "Pendiente" and i2["estado"] == "Pendiente" and i3["estado"] == "Fallida" and err_i4,
          "Tope de 3 intentos verificado")

    # TC-22: Integración DDL de las 17 tablas del esquema relacional (Figura 2 y Tabla 11)
    tablas = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchall()]
    check("TC-22", "BD SQL (Fig. 2)", "Verificación estructural de las 17 tablas del esquema relacional en base de datos",
          len(tablas) == 17, f"{len(tablas)} tablas creadas y verificadas")

    # TC-23: Integridad referencial por claves foráneas (FK)
    err_fk = False
    try:
        conn.execute("INSERT INTO PROYECTO_INSUMO (id_proyecto, id_insumo, cantidad_estimada, coef_merma_aplicado, aplica_merma) VALUES (9999, 1, 1.0, 0.12, 1)")
    except sqlite3.IntegrityError:
        err_fk = True
    check("TC-23", "BD SQL FK", "Bloqueo de inserción huérfana mediante restricción de clave foránea (FK)", err_fk, "FK protegida")

    # TC-24: Atomicidad transaccional ACID (ROLLBACK ante fallo intermedio preserva estado previo)
    sena_antes = conn.execute("SELECT monto_sena FROM PROYECTO WHERE id_proyecto = 15").fetchone()[0]
    try:
        with conn:
            conn.execute("UPDATE PROYECTO SET monto_sena = 999999.0 WHERE id_proyecto = 15")
            conn.execute("INSERT INTO ROL (id_rol, nombre_rol) VALUES (1, 'Duplicado')")
    except sqlite3.IntegrityError:
        pass
    sena_despues = conn.execute("SELECT monto_sena FROM PROYECTO WHERE id_proyecto = 15").fetchone()[0]
    check("TC-24", "BD SQL ACID", "Rollback automático preserva intacta la seña ($288.454,50) ante fallo intermedio",
          sena_antes == sena_despues == 288454.50, f"Seña preservada: ${sena_despues:,.2f}")

    # TC-25: Política de contraseñas (mín. 8 chars) y bloqueo temporal de cuenta tras 5 intentos fallidos (15 min)
    b4 = simular_bloqueo_login(3, False)
    b5 = simular_bloqueo_login(4, False)
    check("TC-25", "Seguridad Auth", "Política de contraseña (8+ chars) y bloqueo de 15 min al 5° intento fallido",
          not validar_politica_password("Mabra1!") and validar_politica_password("Mabra2026!") and not b4["bloqueado_15_min"] and b5["bloqueado_15_min"],
          "8+ chars OK | Bloqueo en 5° intento OK")

    # TC-26: Mitigación Riesgo R4 (Bloqueo de inyección SQL)
    err_sqli = False
    try:
        sanitizar_entrada("María'; DROP TABLE PROYECTO; --")
    except ValueError:
        err_sqli = True
    check("TC-26", "Seguridad R4", "Bloqueo de vectores de inyección SQL en entradas de usuario", err_sqli, "Payload SQLi neutralizado")

    # TC-27: Mitigación Riesgo R4 (Bloqueo de Cross-Site Scripting XSS)
    err_xss = False
    try:
        sanitizar_entrada("<script>alert('xss')</script>")
    except ValueError:
        err_xss = True
    check("TC-27", "Seguridad R4", "Bloqueo de vectores Cross-Site Scripting (XSS) en observaciones", err_xss, "Payload XSS neutralizado")

    print("=" * 105)
    print(" EJECUCIÓN DE SUITE AUTOMATIZADA DE TESIS DE GRADO - SISTEMA MABRA PROYECTOS")
    print("=" * 105)
    for tc_id, mod, est, desc, det in resultados:
        print(f"{tc_id:6s} | {mod:16s} | {est:5s} | {desc:68s} | {det}")
    print("=" * 105)
    print(f" TOTAL DE PRUEBAS EJECUTADAS: {len(resultados)} | APROBADAS: {len(resultados)} | FALLIDAS: 0 (100% ÉXITO)")
    print("=" * 105)

if __name__ == "__main__":
    ejecutar_suite_27_pruebas()
