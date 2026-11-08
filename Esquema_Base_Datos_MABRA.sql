-- =============================================================================
-- TRABAJO FINAL DE GRADO - PROTOTIPADO TECNOLÓGICO (UNIVERSIDAD SIGLO 21)
-- Sistema de gestión y trazabilidad para la producción de mobiliario a medida
-- Alumno: Santiago Villalba Palmieri (Legajo: SOFO2889)
-- Tutora: Ing. Claudia Fabiana Castro
-- Motor: MySQL 8.4 (InnoDB - Propiedades ACID, 17 Tablas y Triggers Append-Only)
-- =============================================================================

CREATE DATABASE IF NOT EXISTS mabra_proyectos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mabra_proyectos;

-- 1. Tabla ROL
CREATE TABLE ROL (
    id_rol INT AUTO_INCREMENT PRIMARY KEY,
    nombre_rol VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB;

-- 2. Tabla USUARIO
CREATE TABLE USUARIO (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    id_rol INT NOT NULL,
    nombre VARCHAR(80) NOT NULL,
    apellido VARCHAR(80) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    intentos_fallidos TINYINT NOT NULL DEFAULT 0,
    bloqueado_hasta DATETIME DEFAULT NULL,
    activo BOOLEAN NOT NULL DEFAULT 1,
    CONSTRAINT fk_usuario_rol FOREIGN KEY (id_rol) REFERENCES ROL(id_rol)
) ENGINE=InnoDB;

-- 3. Tabla TARIFA_OPERARIO
CREATE TABLE TARIFA_OPERARIO (
    id_tarifa BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    tarifa_hora DECIMAL(12,2) NOT NULL,
    desde DATE NOT NULL,
    hasta DATE DEFAULT NULL,
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tarifa_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario)
) ENGINE=InnoDB;

-- 4. Tabla AUDITORIA_AJUSTES (Append-Only protegido por triggers)
CREATE TABLE AUDITORIA_AJUSTES (
    id_ajuste BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    entidad VARCHAR(80) NOT NULL,
    id_registro BIGINT NOT NULL,
    campo VARCHAR(80) NOT NULL,
    valor_original JSON NOT NULL,
    valor_corregido JSON NOT NULL,
    motivo VARCHAR(500) NOT NULL,
    fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ajuste_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario)
) ENGINE=InnoDB;

-- 5. Tabla CLIENTE
CREATE TABLE CLIENTE (
    id_cliente INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL,
    apellido VARCHAR(80) NOT NULL,
    telefono VARCHAR(40) NOT NULL,
    email VARCHAR(120) NOT NULL,
    direccion VARCHAR(200) NOT NULL
) ENGINE=InnoDB;

-- 6. Tabla ESTADO_PROYECTO
CREATE TABLE ESTADO_PROYECTO (
    id_estado INT AUTO_INCREMENT PRIMARY KEY,
    nombre_estado VARCHAR(50) NOT NULL UNIQUE,
    descripcion VARCHAR(200) NOT NULL
) ENGINE=InnoDB;

-- 7. Tabla PROYECTO
CREATE TABLE PROYECTO (
    id_proyecto INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL UNIQUE,
    id_cliente INT NOT NULL,
    id_estado INT NOT NULL,
    id_usuario INT NOT NULL,
    medidas VARCHAR(500) NOT NULL,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_caducidad DATE NOT NULL,
    fecha_inicio DATE DEFAULT NULL,
    fecha_instalacion DATE DEFAULT NULL,
    hs_estimadas DECIMAL(8,2) NOT NULL,
    hs_reales DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    tarifa_hora_snapshot DECIMAL(12,2) NOT NULL,
    valor_hora_snapshot DECIMAL(12,2) DEFAULT NULL,
    costo_materiales_estimado DECIMAL(12,2) NOT NULL,
    costo_mano_obra_estimado DECIMAL(12,2) NOT NULL,
    costo_indirecto_estimado DECIMAL(12,2) NOT NULL,
    costo_total_estimado DECIMAL(12,2) NOT NULL,
    margen_aplicado DECIMAL(5,4) NOT NULL DEFAULT 0.3500,
    precio_venta_final DECIMAL(12,2) NOT NULL,
    monto_sena DECIMAL(12,2) DEFAULT NULL,
    fecha_sena DATETIME DEFAULT NULL,
    costo_materiales_snapshot DECIMAL(12,2) DEFAULT NULL,
    costo_indirecto_snapshot DECIMAL(12,2) DEFAULT NULL,
    costo_total_snapshot DECIMAL(12,2) DEFAULT NULL,
    costo_consumo_snapshot DECIMAL(12,2) DEFAULT NULL,
    costo_total_real DECIMAL(12,2) DEFAULT NULL,
    CONSTRAINT fk_proyecto_cliente FOREIGN KEY (id_cliente) REFERENCES CLIENTE(id_cliente),
    CONSTRAINT fk_proyecto_estado FOREIGN KEY (id_estado) REFERENCES ESTADO_PROYECTO(id_estado),
    CONSTRAINT fk_proyecto_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario)
) ENGINE=InnoDB;

-- 8. Tabla CATALOGO_INSUMOS
CREATE TABLE CATALOGO_INSUMOS (
    id_insumo INT AUTO_INCREMENT PRIMARY KEY,
    descripcion VARCHAR(150) NOT NULL,
    unidad_medida VARCHAR(30) NOT NULL,
    costo_unitario DECIMAL(12,2) NOT NULL,
    coef_merma DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
    aplica_merma BOOLEAN NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- 9. Tabla PROYECTO_INSUMO
CREATE TABLE PROYECTO_INSUMO (
    id_proyecto_insumo INT AUTO_INCREMENT PRIMARY KEY,
    id_proyecto INT NOT NULL,
    id_insumo INT NOT NULL,
    cantidad_estimada DECIMAL(10,3) NOT NULL,
    costo_unitario_snapshot DECIMAL(12,2) DEFAULT NULL,
    coef_merma_aplicado DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
    aplica_merma BOOLEAN NOT NULL DEFAULT 0,
    CONSTRAINT fk_pi_proyecto FOREIGN KEY (id_proyecto) REFERENCES PROYECTO(id_proyecto),
    CONSTRAINT fk_pi_insumo FOREIGN KEY (id_insumo) REFERENCES CATALOGO_INSUMOS(id_insumo)
) ENGINE=InnoDB;

-- 10. Tabla LOTE_INSUMO
CREATE TABLE LOTE_INSUMO (
    id_lote INT AUTO_INCREMENT PRIMARY KEY,
    id_insumo INT NOT NULL,
    proveedor VARCHAR(120) NOT NULL,
    comprobante VARCHAR(120) NOT NULL,
    fecha_compra DATE NOT NULL,
    cantidad_comprada DECIMAL(10,3) NOT NULL,
    cantidad_disponible DECIMAL(10,3) NOT NULL,
    costo_unitario_real DECIMAL(12,2) NOT NULL,
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_lote_insumo FOREIGN KEY (id_insumo) REFERENCES CATALOGO_INSUMOS(id_insumo)
) ENGINE=InnoDB;

-- 11. Tabla RETAZOS_DISPONIBLES
CREATE TABLE RETAZOS_DISPONIBLES (
    id_retazo INT AUTO_INCREMENT PRIMARY KEY,
    id_insumo INT NOT NULL,
    id_proyecto_origen INT NOT NULL,
    id_proyecto_destino INT DEFAULT NULL,
    largo DECIMAL(8,2) NOT NULL,
    ancho DECIMAL(8,2) NOT NULL,
    espesor DECIMAL(6,2) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'Disponible',
    ahorro_estimado DECIMAL(12,2) NOT NULL,
    costo_unitario_origen DECIMAL(12,2) NOT NULL,
    unidad_valorizacion VARCHAR(30) NOT NULL DEFAULT 'pieza',
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_retazo_insumo FOREIGN KEY (id_insumo) REFERENCES CATALOGO_INSUMOS(id_insumo),
    CONSTRAINT fk_retazo_origen FOREIGN KEY (id_proyecto_origen) REFERENCES PROYECTO(id_proyecto),
    CONSTRAINT fk_retazo_destino FOREIGN KEY (id_proyecto_destino) REFERENCES PROYECTO(id_proyecto)
) ENGINE=InnoDB;

-- 12. Tabla CONSUMO_INSUMO
CREATE TABLE CONSUMO_INSUMO (
    id_consumo BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_proyecto INT NOT NULL,
    id_insumo INT NOT NULL,
    id_usuario INT NOT NULL,
    id_lote INT DEFAULT NULL,
    id_retazo INT DEFAULT NULL,
    cantidad DECIMAL(10,3) NOT NULL,
    precio_unitario_historico DECIMAL(12,2) NOT NULL,
    precio_unitario_compra DECIMAL(12,2) NOT NULL,
    origen_material VARCHAR(20) NOT NULL,
    observacion VARCHAR(300) DEFAULT NULL,
    fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_consumo_proyecto FOREIGN KEY (id_proyecto) REFERENCES PROYECTO(id_proyecto),
    CONSTRAINT fk_consumo_insumo FOREIGN KEY (id_insumo) REFERENCES CATALOGO_INSUMOS(id_insumo),
    CONSTRAINT fk_consumo_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario),
    CONSTRAINT fk_consumo_lote FOREIGN KEY (id_lote) REFERENCES LOTE_INSUMO(id_lote),
    CONSTRAINT fk_consumo_retazo FOREIGN KEY (id_retazo) REFERENCES RETAZOS_DISPONIBLES(id_retazo)
) ENGINE=InnoDB;

-- 13. Tabla REGISTRO_HORAS
CREATE TABLE REGISTRO_HORAS (
    id_registro BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_proyecto INT NOT NULL,
    id_usuario INT NOT NULL,
    etapa VARCHAR(50) NOT NULL,
    horas DECIMAL(8,2) NOT NULL,
    observacion VARCHAR(500) DEFAULT NULL,
    fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rh_proyecto FOREIGN KEY (id_proyecto) REFERENCES PROYECTO(id_proyecto),
    CONSTRAINT fk_rh_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario)
) ENGINE=InnoDB;

-- 14. Tabla AUDITORIAS_ESTADOS
CREATE TABLE AUDITORIAS_ESTADOS (
    id_auditoria BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_proyecto INT NOT NULL,
    id_usuario INT NOT NULL,
    fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado_anterior VARCHAR(50) NOT NULL,
    estado_nuevo VARCHAR(50) NOT NULL,
    hs_reportadas_etapa DECIMAL(8,2) NOT NULL,
    observacion_ajuste VARCHAR(500) DEFAULT NULL,
    CONSTRAINT fk_aud_proyecto FOREIGN KEY (id_proyecto) REFERENCES PROYECTO(id_proyecto),
    CONSTRAINT fk_aud_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario)
) ENGINE=InnoDB;

-- 15. Tabla COSTO_INDIRECTO_PROYECTO
CREATE TABLE COSTO_INDIRECTO_PROYECTO (
    id_cif BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_proyecto INT NOT NULL,
    concepto VARCHAR(160) NOT NULL,
    importe DECIMAL(12,2) NOT NULL,
    fecha DATE NOT NULL,
    base_asignacion VARCHAR(100) NOT NULL,
    comprobante VARCHAR(120) DEFAULT NULL,
    observacion VARCHAR(300) DEFAULT NULL,
    CONSTRAINT fk_cif_proyecto FOREIGN KEY (id_proyecto) REFERENCES PROYECTO(id_proyecto)
) ENGINE=InnoDB;

-- 16. Tabla NOTIFICACIONES
CREATE TABLE NOTIFICACIONES (
    id_notificacion BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_proyecto INT NOT NULL,
    canal VARCHAR(30) NOT NULL DEFAULT 'WhatsApp',
    tipo VARCHAR(40) NOT NULL,
    destinatario VARCHAR(40) NOT NULL,
    payload JSON NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'Pendiente',
    intentos INT NOT NULL DEFAULT 0,
    proximo_reintento DATETIME DEFAULT NULL,
    ultimo_error VARCHAR(300) DEFAULT NULL,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_envio DATETIME DEFAULT NULL,
    CONSTRAINT fk_notif_proyecto FOREIGN KEY (id_proyecto) REFERENCES PROYECTO(id_proyecto)
) ENGINE=InnoDB;

-- 17. Tabla NOTIFICACION_INTENTOS
CREATE TABLE NOTIFICACION_INTENTOS (
    id_intento BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_notificacion BIGINT NOT NULL,
    fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resultado VARCHAR(20) NOT NULL,
    codigo_respuesta VARCHAR(40) DEFAULT NULL,
    error VARCHAR(300) DEFAULT NULL,
    CONSTRAINT fk_intento_notif FOREIGN KEY (id_notificacion) REFERENCES NOTIFICACIONES(id_notificacion)
) ENGINE=InnoDB;


-- =============================================================================
-- TRIGGERS APPEND-ONLY EN MYSQL 8.4 PARA PROTEGER AUDITORIA_AJUSTES (TABLA 11)
-- =============================================================================
DELIMITER $$
CREATE TRIGGER trg_auditoria_ajustes_no_update
BEFORE UPDATE ON AUDITORIA_AJUSTES
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'AUDITORIA_AJUSTES es append-only: prohibido ejecutar UPDATE sobre registros de auditoria.';
END$$

CREATE TRIGGER trg_auditoria_ajustes_no_delete
BEFORE DELETE ON AUDITORIA_AJUSTES
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'AUDITORIA_AJUSTES es append-only: prohibido ejecutar DELETE sobre registros de auditoria.';
END$$
DELIMITER ;

-- =============================================================================
-- DATOS SEMILLA DE VERIFICACIÓN (CASO TESTIGO PRY-00015 Y HISTÓRICOS)
-- =============================================================================

INSERT INTO ROL (id_rol, nombre_rol) VALUES
(1, 'Usuario dueño'),
(2, 'Usuario instalador'),
(3, 'Usuario logística');

INSERT INTO USUARIO (id_usuario, id_rol, nombre, apellido, email, password_hash, intentos_fallidos, bloqueado_hasta, activo) VALUES
(1, 1, 'Santiago', 'Villalba', 'dueno@mabra.com.ar', '$2b$10$MabraHashDuenoSeguridad2026..........................', 0, NULL, 1),
(2, 2, 'Juan', 'Rodríguez', 'instalador1@mabra.com.ar', '$2b$10$MabraHashInstalador1Seguridad2026....................', 0, NULL, 1),
(3, 2, 'Pedro', 'Gómez', 'instalador2@mabra.com.ar', '$2b$10$MabraHashInstalador2Seguridad2026....................', 0, NULL, 1),
(4, 3, 'Carlos', 'López', 'logistica@mabra.com.ar', '$2b$10$MabraHashLogisticaSeguridad2026......................', 0, NULL, 1);

INSERT INTO TARIFA_OPERARIO (id_tarifa, id_usuario, tarifa_hora, desde, hasta) VALUES
(1, 2, 8250.00, '2026-10-01', NULL),
(2, 3, 8250.00, '2026-10-01', NULL);

INSERT INTO ESTADO_PROYECTO (id_estado, nombre_estado, descripcion) VALUES
(1, 'Presupuestado', 'Cotización emitida con validez de 14 días corridos'),
(2, 'Vencido', 'Presupuesto cuya fecha de caducidad superó los 14 días sin seña'),
(3, 'Señado / En Cola', 'Seña mínima del 50% registrada y costos congelados en snapshot'),
(4, 'En Corte', 'Dimensionado de placas de melamina en sierra escuadradora'),
(5, 'En Pegado y Armado', 'Aplicación de tapacantos y ensamble de módulos en banco'),
(6, 'Listo para Entrega', 'Mueble terminado en taller y pendiente de retiro logístico'),
(7, 'En Tránsito', 'Orden cargada en vehículo utilitario rumbo al domicilio'),
(8, 'Instalado', 'Mueble colocado en domicilio y habilitado para análisis de desviaciones');

INSERT INTO CLIENTE (id_cliente, nombre, apellido, telefono, email, direccion) VALUES
(1, 'María', 'Pérez', '+5493515551234', 'maria.perez@email.com', 'Av. Colón 1450, Córdoba Capital'),
(2, 'Roberto', 'Sánchez', '+5493515554321', 'roberto.sanchez@email.com', 'Bv. San Juan 820, Córdoba Capital');

INSERT INTO CATALOGO_INSUMOS (id_insumo, descripcion, unidad_medida, costo_unitario, coef_merma, aplica_merma, activo) VALUES
(1, 'Placa melamina 18 mm Roble Kendal', 'placa', 90000.00, 0.1200, 1, 1),
(2, 'Tapacanto PVC 22 mm Roble Kendal', 'metro', 1200.00, 0.0000, 0, 1),
(3, 'Herrajes varios (correderas telescópicas y bisagras)', 'kit', 40000.00, 0.0000, 0, 1);

INSERT INTO LOTE_INSUMO (id_lote, id_insumo, proveedor, comprobante, fecha_compra, cantidad_comprada, cantidad_disponible, costo_unitario_real) VALUES
(1, 1, 'Distribuidora Placas Córdoba SA', 'FC-A-0004-00018920', '2026-11-06', 10.000, 7.500, 96000.00),
(2, 2, 'Herrajes y Cantos Centro SRL', 'FC-A-0002-00045110', '2026-11-06', 200.000, 175.000, 1200.00),
(3, 3, 'Herrajes y Cantos Centro SRL', 'FC-A-0002-00045110', '2026-11-06', 10.000, 9.000, 40000.00);

-- Proyecto origen histórico (#1) y Caso Testigo PRY-00015 (#15) coherente con Figuras 3, 4 y 5 del Word
INSERT INTO PROYECTO (
    id_proyecto, codigo, id_cliente, id_estado, id_usuario, medidas,
    fecha_creacion, fecha_caducidad, fecha_inicio, fecha_instalacion,
    hs_estimadas, hs_reales, tarifa_hora_snapshot, valor_hora_snapshot,
    costo_materiales_estimado, costo_mano_obra_estimado, costo_indirecto_estimado, costo_total_estimado,
    margen_aplicado, precio_venta_final, monto_sena, fecha_sena,
    costo_materiales_snapshot, costo_indirecto_snapshot, costo_total_snapshot,
    costo_consumo_snapshot, costo_total_real
) VALUES
(1, 'PRY-00001', 2, 8, 1, 'Alacena 1.40m Roble Kendal', '2026-10-01 09:00:00', '2026-10-15', '2026-10-03', '2026-10-10', 10.00, 10.00, 7500.00, 7500.00, 140800.00, 75000.00, 32370.00, 248170.00, 0.3500, 335029.50, 167514.75, '2026-10-02 11:00:00', 140800.00, 32370.00, 248170.00, 248170.00, 248170.00),
(2, 'PRY-00002', 1, 8, 1, 'Placard 2.00x2.20m Blanco', '2026-10-02 10:00:00', '2026-10-16', '2026-10-04', '2026-10-12', 20.00, 21.00, 7500.00, 7500.00, 342400.00, 150000.00, 73860.00, 566260.00, 0.3500, 764451.00, 382225.50, '2026-10-03 10:00:00', 342400.00, 73860.00, 566260.00, 574885.00, 598000.00),
(3, 'PRY-00003', 2, 8, 1, 'Vanitory colgante 0.80m', '2026-10-04 11:00:00', '2026-10-18', '2026-10-06', '2026-10-11', 8.00, 8.00, 7500.00, 7500.00, 118800.00, 60000.00, 26820.00, 205620.00, 0.3500, 277587.00, 138793.50, '2026-10-05 12:00:00', 118800.00, 26820.00, 205620.00, 205620.00, 212000.00),
(4, 'PRY-00004', 1, 8, 1, 'Escritorio gerencial L 1.60m', '2026-10-06 09:30:00', '2026-10-20', '2026-10-08', '2026-10-15', 12.00, 13.00, 7500.00, 7500.00, 195600.00, 90000.00, 42840.00, 328440.00, 0.3500, 443394.00, 221697.00, '2026-10-07 15:00:00', 195600.00, 42840.00, 328440.00, 337065.00, 349000.00),
(5, 'PRY-00005', 2, 8, 1, 'Vestidor abierto 2.40x2.40m', '2026-10-08 10:00:00', '2026-10-22', '2026-10-10', '2026-10-19', 24.00, 25.00, 7500.00, 7500.00, 443200.00, 180000.00, 93480.00, 716680.00, 0.3500, 967518.00, 483759.00, '2026-10-09 11:30:00', 443200.00, 93480.00, 716680.00, 725305.00, 755000.00),
(6, 'PRY-00006', 1, 8, 1, 'Isla de cocina 1.50x0.90m', '2026-10-10 14:00:00', '2026-10-24', '2026-10-12', '2026-10-18', 14.00, 14.00, 7500.00, 7500.00, 231600.00, 105000.00, 50490.00, 387090.00, 0.3500, 522571.50, 261285.75, '2026-10-11 10:00:00', 231600.00, 50490.00, 387090.00, 387090.00, 401000.00),
(7, 'PRY-00007', 2, 8, 1, 'Rack TV flotante 2.10m', '2026-10-12 09:00:00', '2026-10-26', '2026-10-14', '2026-10-20', 11.00, 12.00, 7500.00, 7500.00, 178400.00, 82500.00, 39135.00, 300035.00, 0.3500, 405047.25, 202523.63, '2026-10-13 16:00:00', 178400.00, 39135.00, 300035.00, 308660.00, 319000.00),
(8, 'PRY-00008', 1, 8, 1, 'Biblioteca modular 1.20x2.00m', '2026-10-15 11:00:00', '2026-10-29', '2026-10-17', '2026-10-23', 10.00, 10.00, 7500.00, 7500.00, 162000.00, 75000.00, 35550.00, 272550.00, 0.3500, 367942.50, 183971.25, '2026-10-16 12:00:00', 162000.00, 35550.00, 272550.00, 272550.00, 281000.00),
(9, 'PRY-00009', 2, 8, 1, 'Bajo mesada esquina 2.20m', '2026-10-18 10:30:00', '2026-11-01', '2026-10-20', '2026-10-28', 18.00, 19.00, 7500.00, 7500.00, 298800.00, 135000.00, 65070.00, 498870.00, 0.3500, 673474.50, 336737.25, '2026-10-19 14:00:00', 298800.00, 65070.00, 498870.00, 507495.00, 526000.00),
(10, 'PRY-00010', 1, 8, 1, 'Mueble lavadero 1.10m', '2026-10-20 09:00:00', '2026-11-03', '2026-10-22', '2026-10-27', 9.00, 9.00, 7500.00, 7500.00, 134400.00, 67500.00, 30285.00, 232185.00, 0.3500, 313449.75, 156724.88, '2026-10-21 11:00:00', 134400.00, 30285.00, 232185.00, 232185.00, 239000.00),
(15, 'PRY-00015', 1, 8, 1, 'Bajo mesada 1.80x0.85x0.60m Roble Kendal',
 '2026-11-05 10:00:00', '2026-11-19', '2026-11-08', '2026-11-11',
 16.00, 20.00, 7500.00, 7500.00,
 251600.00, 120000.00, 55740.00, 427340.00,
 0.3500, 576909.00, 288454.50, '2026-11-06 14:30:00',
 251600.00, 55740.00, 427340.00,
 483000.00, 523250.00);

INSERT INTO PROYECTO_INSUMO (id_proyecto_insumo, id_proyecto, id_insumo, cantidad_estimada, costo_unitario_snapshot, coef_merma_aplicado, aplica_merma) VALUES
(1, 15, 1, 2.000, 90000.00, 0.1200, 1),
(2, 15, 2, 25.000, 1200.00, 0.0000, 0),
(3, 15, 3, 1.000, 40000.00, 0.0000, 0);

INSERT INTO RETAZOS_DISPONIBLES (id_retazo, id_insumo, id_proyecto_origen, id_proyecto_destino, largo, ancho, espesor, estado, ahorro_estimado, costo_unitario_origen, unidad_valorizacion) VALUES
(8, 1, 1, 15, 120.00, 70.00, 18.00, 'Reutilizado', 20000.00, 20000.00, 'pieza');

-- Consumos reales de PRY-00015 (Figura 4 y Figura 5):
-- 2.50 placas compradas ($225.000 a snapshot / $240.000 a compra real),
-- 1 pieza retazo reutilizada ($20.000 costo de origen en ambas bases, sin doble deducción),
-- 25 m tapacanto ($30.000), 1 kit herrajes ($40.000 -> 0.50 kit redirigido o ajuste de lote: total materiales snapshot $270.000 y compra real $290.000)
INSERT INTO CONSUMO_INSUMO (id_consumo, id_proyecto, id_insumo, id_usuario, id_lote, id_retazo, cantidad, precio_unitario_historico, precio_unitario_compra, origen_material, observacion) VALUES
(1, 15, 1, 2, 1, NULL, 2.000, 90000.00, 100000.00, 'Compra', 'Placas principales lote compra'),
(2, 15, 1, 2, NULL, 8, 1.000, 20000.00, 20000.00, 'Retazo', 'Retazo #RET-08 reutilizado a su costo de origen'),
(3, 15, 2, 2, 2, NULL, 25.000, 1200.00, 1200.00, 'Compra', 'Tapacanto PVC 22 mm'),
(4, 15, 3, 3, 3, NULL, 1.000, 40000.00, 40000.00, 'Compra', 'Kit de herrajes completo');

-- Registro multioperario de horas reales (Figura 4: 5.00 + 2.00 + 5.50 + 3.50 + 4.00 = 20.00 h)
INSERT INTO REGISTRO_HORAS (id_registro, id_proyecto, id_usuario, etapa, horas, observacion, fecha_hora) VALUES
(1, 15, 2, 'En Corte', 5.00, 'Corte de placas', '2026-11-08 08:15:00'),
(2, 15, 3, 'En Corte', 2.00, 'Apoyo en corte', '2026-11-08 14:30:00'),
(3, 15, 2, 'En Pegado y Armado', 5.50, 'Cantos y frente', '2026-11-09 13:20:00'),
(4, 15, 3, 'En Pegado y Armado', 3.50, 'Armado de módulos', '2026-11-09 17:10:00'),
(5, 15, 2, 'Listo para Entrega', 4.00, 'Control y terminación', '2026-11-10 17:10:00');

INSERT INTO AUDITORIAS_ESTADOS (id_auditoria, id_proyecto, id_usuario, fecha_hora, estado_anterior, estado_nuevo, hs_reportadas_etapa, observacion_ajuste) VALUES
(1, 15, 2, '2026-11-08 08:15:00', 'Señado / En Cola', 'En Corte', 7.00, 'Inicio de corte en escuadradora'),
(2, 15, 2, '2026-11-09 13:20:00', 'En Corte', 'En Pegado y Armado', 9.00, 'Pegado de cantos y ensamble'),
(3, 15, 2, '2026-11-10 17:10:00', 'En Pegado y Armado', 'Listo para Entrega', 4.00, 'Control final en taller'),
(4, 15, 4, '2026-11-11 09:30:00', 'Listo para Entrega', 'En Tránsito', 0.00, 'Carga en utilitario'),
(5, 15, 4, '2026-11-11 13:00:00', 'En Tránsito', 'Instalado', 0.00, 'Instalación final en domicilio');

INSERT INTO COSTO_INDIRECTO_PROYECTO (id_cif, id_proyecto, concepto, importe, fecha, base_asignacion, comprobante, observacion) VALUES
(1, 15, 'Prorrateo CIF estimado 15% sobre materiales y MO real', 68250.00, '2026-11-11', '15% sobre costos directos reales', 'CIF-EST-015', 'Alícuota estándar 15%');

INSERT INTO AUDITORIA_AJUSTES (id_ajuste, id_usuario, entidad, id_registro, campo, valor_original, valor_corregido, motivo, fecha_hora) VALUES
(1, 1, 'REGISTRO_HORAS', 5, 'horas', '{"horas": 4.50}', '{"horas": 4.00}', 'Corrección por error de tipeo en planilla móvil', '2026-11-10 18:00:00');

INSERT INTO NOTIFICACIONES (id_notificacion, id_proyecto, canal, tipo, destinatario, payload, estado, intentos, proximo_reintento, ultimo_error, fecha_envio) VALUES
(1, 15, 'WhatsApp', 'Cotización', '+5493515551234', '{"codigo":"PRY-00015","precio_final":576909,"sena_minima":288454.5}', 'Enviada', 1, NULL, NULL, '2026-11-05 10:01:00'),
(2, 15, 'WhatsApp', 'Despacho', '+5493515551234', '{"codigo":"PRY-00015","estado":"Listo para Entrega"}', 'Enviada', 2, NULL, NULL, '2026-11-10 17:15:00');

INSERT INTO NOTIFICACION_INTENTOS (id_intento, id_notificacion, fecha_hora, resultado, codigo_respuesta, error) VALUES
(1, 1, '2026-11-05 10:01:00', 'Enviada', '200_OK', NULL),
(2, 2, '2026-11-10 17:11:00', 'Fallida', '503_TIMEOUT', 'Timeout proveedor externo Meta Cloud API'),
(3, 2, '2026-11-10 17:15:00', 'Enviada', '200_OK', NULL);
