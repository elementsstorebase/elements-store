# ============================================================
# routes.py - Elements Store (con correcciones)
# ============================================================

from flask import Blueprint, render_template, request, jsonify, current_app, send_file, session, redirect, url_for, flash
from models import db, Producto, Marca, Categoria, Subcategoria, Talla, Cliente, Venta, DetalleVenta, Credito, Abono, Log, Configuracion, Gasto, CategoriaGasto, ReporteVenta, HistorialTasa, Usuario, Apartado, PagoApartado, CuentaFinanciera, Deuda, ConfiguracionImpresora, now_venezuela
from utils import obtener_tasas_bcv, obtener_tasa_personalizada, calcular_precios_alternativos
from datetime import datetime, timedelta
from PIL import Image, ImageDraw, ImageFont
from werkzeug.security import check_password_hash, generate_password_hash
import json
import os
import sys  # 🔥 CAMBIO: importar sys para verificar plataforma
import io
from functools import wraps
from sqlalchemy.exc import OperationalError
import sqlite3
from sqlalchemy import func, or_
import pytz
import textwrap  # NUEVO: para manejo de líneas largas en tickets

main_bp = Blueprint('main', __name__)
api_bp = Blueprint('api', __name__)

# ============================================================
# 🔥 MIGRACIÓN AUTOMÁTICA: AGREGAR COLUMNAS 'anulado' Y 'fecha_anulacion' A 'ventas'
# ============================================================
def agregar_columnas_venta_si_no_existen():
    """
    Verifica si las columnas 'anulado' y 'fecha_anulacion' existen en la tabla 'ventas'.
    Si no, las agrega con SQL ALTER TABLE (compatible con SQLite y PostgreSQL).
    """
    try:
        if not db.engine.dialect.has_table(db.engine, 'ventas'):
            return
        inspector = db.inspect(db.engine)
        columns = [col['name'] for col in inspector.get_columns('ventas')]
        
        if 'anulado' not in columns:
            print("🔧 Agregando columna 'anulado' a la tabla 'ventas'...")
            if db.engine.dialect.name == 'postgresql':
                db.session.execute("ALTER TABLE ventas ADD COLUMN anulado BOOLEAN DEFAULT FALSE")
            else:
                db.session.execute("ALTER TABLE ventas ADD COLUMN anulado BOOLEAN DEFAULT 0")
            db.session.commit()
            print("✅ Columna 'anulado' agregada.")
        
        if 'fecha_anulacion' not in columns:
            print("🔧 Agregando columna 'fecha_anulacion' a la tabla 'ventas'...")
            if db.engine.dialect.name == 'postgresql':
                db.session.execute("ALTER TABLE ventas ADD COLUMN fecha_anulacion TIMESTAMP")
            else:
                db.session.execute("ALTER TABLE ventas ADD COLUMN fecha_anulacion DATETIME")
            db.session.commit()
            print("✅ Columna 'fecha_anulacion' agregada.")
    except Exception as e:
        print(f"⚠️ Error al agregar columnas a 'ventas': {e}")

# Ejecutar la migración al importar el módulo
try:
    agregar_columnas_venta_si_no_existen()
except:
    pass

# ============================================================
# 🔥 MODIFICADO: FUNCIÓN PARA OBTENER EL PRÓXIMO NÚMERO DE TICKET (SECUENCIA ESTRICTA)
# ============================================================
def obtener_proximo_numero_ticket():
    """
    Retorna el siguiente número de ticket (máximo + 1) sin reutilizar números eliminados.
    Si no hay ventas, retorna 1.
    """
    max_ticket = db.session.query(func.max(Venta.numero_ticket)).scalar()
    if max_ticket is None:
        return 1
    return max_ticket + 1
# ============================================================

# ============================================================
# FUNCIONES DE IMPRESIÓN (definidas al inicio para que estén disponibles)
# ============================================================

def imprimir_ticket(texto, printer_name, copias=1, cortar=True):
    """
    Envía texto a una impresora Windows usando win32print.
    - texto: contenido del ticket (string con saltos de línea)
    - printer_name: nombre exacto de la impresora (ej: "EPSON TM-T20")
    - copias: número de copias
    - cortar: si debe enviar comando de corte al final
    Retorna True si se imprimió correctamente, False en caso contrario.
    """
    # 🔥 CAMBIO: Importar win32print solo en Windows y manejar excepción
    if sys.platform != 'win32':
        print("⚠️ Impresión solo disponible en Windows. Se omite.")
        return False
    try:
        import win32print
        hprinter = win32print.OpenPrinter(printer_name)
        try:
            for i in range(copias):
                job_id = win32print.StartDocPrinter(hprinter, 1, ("Ticket Elements", None, "RAW"))
                win32print.StartPagePrinter(hprinter)
                win32print.WritePrinter(hprinter, texto.encode('cp437', errors='replace'))
                if cortar and i == copias - 1:
                    win32print.WritePrinter(hprinter, b'\x1B\x69')
                win32print.EndPagePrinter(hprinter)
                win32print.EndDocPrinter(hprinter)
        finally:
            win32print.ClosePrinter(hprinter)
        return True
    except Exception as e:
        print(f"Error imprimiendo: {e}")
        return False

def generar_texto_ticket(venta):
    """
    Genera el contenido en texto plano para un ticket de venta,
    basado en los datos de la venta y su configuración.
    Mejorado para soportar papel de 58mm (32 caracteres) y 80mm (42 caracteres).
    🔥 CORRECCIÓN: La fecha se convierte a hora local de Venezuela (UTC-4).
    """
    from models import Configuracion

    # 1. Obtener configuración de la impresora (para saber el ancho)
    config_imp = ConfiguracionImpresora.query.first()
    if config_imp and config_imp.tamano_papel == '58mm':
        MAX_CHARS = 32
    else:
        MAX_CHARS = 42  # para 80mm (por defecto)

    # 2. Funciones auxiliares de formateo y normalización (locales)
    def normalizar_texto(t):
        """Elimina tildes y convierte ñ a n para compatibilidad con impresoras térmicas."""
        if t is None:
            return ''
        import unicodedata
        normalizado = unicodedata.normalize('NFD', t)
        sin_tildes = ''.join(c for c in normalizado if not unicodedata.combining(c))
        sin_tildes = sin_tildes.replace('ñ', 'n').replace('Ñ', 'N')
        return sin_tildes

    def wrap_line(linea, max_chars=MAX_CHARS):
        if len(linea) <= max_chars:
            return linea.ljust(max_chars)
        else:
            return linea[:max_chars-3] + '...'

    def centrar_linea(linea, max_chars=MAX_CHARS):
        if len(linea) >= max_chars:
            return linea[:max_chars]
        espacios = max_chars - len(linea)
        izquierda = espacios // 2
        derecha = espacios - izquierda
        return ' ' * izquierda + linea + ' ' * derecha

    # 3. Obtener configuración del ticket (textos, etc.)
    claves = [
        'ticket_tienda_nombre', 'ticket_rif', 'ticket_telefono_tienda', 'ticket_direccion_tienda',
        'ticket_mostrar_rif', 'ticket_mostrar_telefono', 'ticket_mostrar_direccion_cliente', 'ticket_mostrar_direccion_tienda',
        'ticket_mensaje', 'ticket_url', 'ticket_subtotal_usd', 'ticket_iva_porcentaje'
    ]
    configs = {}
    for clave in claves:
        cfg = Configuracion.query.filter_by(clave=clave).first()
        configs[clave] = cfg.valor if cfg else None

    tienda_nombre = normalizar_texto(configs.get('ticket_tienda_nombre', 'ELEMENTS STORE'))
    rif = normalizar_texto(configs.get('ticket_rif', 'J-12345678-9'))
    telefono_tienda = normalizar_texto(configs.get('ticket_telefono_tienda', '0412-1234567'))
    direccion_tienda = normalizar_texto(configs.get('ticket_direccion_tienda', 'Calle Principal, Local 1, Ciudad'))
    mostrar_rif = configs.get('ticket_mostrar_rif', 'true').lower() == 'true'
    mostrar_telefono = configs.get('ticket_mostrar_telefono', 'true').lower() == 'true'
    mostrar_direccion_cliente = configs.get('ticket_mostrar_direccion_cliente', 'true').lower() == 'true'
    mostrar_direccion_tienda = configs.get('ticket_mostrar_direccion_tienda', 'true').lower() == 'true'
    mensaje = normalizar_texto(configs.get('ticket_mensaje', '¡Gracias por su compra!'))
    url = normalizar_texto(configs.get('ticket_url', 'www.elementsstore.com'))
    mostrar_subtotal_usd = configs.get('ticket_subtotal_usd', 'true').lower() == 'true'
    iva_porcentaje = float(configs.get('ticket_iva_porcentaje', '0') or '0')

    metodo_cobro_map = {
        'usd': 'Precio en Dólares ($)',
        'bcv_usd': 'Tasa BCV USD',
        'bcv_eur': 'Tasa BCV EUR',
        'personalizada': 'Tasa Personalizada',
        'bs_personalizado': 'Bs Personalizado',
        'usd_personalizado': 'Dólar Personalizado'
    }
    metodo_cobro_legible = normalizar_texto(metodo_cobro_map.get(venta.metodo_cobro, venta.metodo_cobro))

    cliente = venta.cliente
    detalles = DetalleVenta.query.filter_by(venta_id=venta.id).all()

    lineas = []
    separador = '=' * MAX_CHARS
    separador_corto = '-' * MAX_CHARS

    lineas.append(separador)
    lineas.append(centrar_linea(tienda_nombre))
    if mostrar_rif:
        lineas.append(wrap_line(f'RIF: {rif}'))
    if mostrar_telefono:
        lineas.append(wrap_line(f'Tel: {telefono_tienda}'))
    if mostrar_direccion_tienda:
        lineas.append(wrap_line(f'Dir: {direccion_tienda}'))
    lineas.append(separador_corto)
    lineas.append(centrar_linea(f'NOTA DE ENTREGA N°: {venta.numero_ticket:05d}'))
    
    # 🔥 CORRECCIÓN: Convertir fecha a hora local de Venezuela
    if venta.fecha.tzinfo is None:
        fecha_utc = pytz.UTC.localize(venta.fecha)
        fecha_local = fecha_utc.astimezone(pytz.timezone('America/Caracas'))
    else:
        fecha_local = venta.fecha.astimezone(pytz.timezone('America/Caracas'))
    fecha_formateada = fecha_local.strftime('%d/%m/%Y, %I:%M:%S %p')
    fecha_formateada = fecha_formateada.replace('AM', 'a. m.').replace('PM', 'p. m.')
    
    lineas.append(wrap_line(f'Fecha: {fecha_formateada}'))
    lineas.append(separador)
    if cliente:
        cliente_nombre = normalizar_texto(f"{cliente.nombre} {cliente.apellido}")
        cedula = normalizar_texto(cliente.cedula)
        lineas.append(wrap_line(f'Cliente: {cliente_nombre}'))
        lineas.append(wrap_line(f'Cédula: {cedula}'))
        if cliente.telefono and mostrar_direccion_cliente:
            telefono = normalizar_texto(cliente.telefono)
            lineas.append(wrap_line(f'Teléfono: {telefono}'))
        if cliente.direccion and mostrar_direccion_cliente:
            direccion = normalizar_texto(cliente.direccion)
            lineas.append(wrap_line(f'Dirección: {direccion}'))
    else:
        lineas.append(wrap_line('Cliente: Consumidor Final'))
    lineas.append(separador_corto)

    # Cabecera de la tabla
    # Para 32 caracteres: "Cant Producto           Total"
    # Para 42 caracteres: "Cant Producto                     Total"
    if MAX_CHARS == 32:
        lineas.append(wrap_line(f"{'Cant':>4} {'Producto':<20} {'Total':>8}"))
    else:
        lineas.append(wrap_line(f"{'Cant':>4} {'Producto':<28} {'Total':>10}"))

    total_usd = 0.0
    for detalle in detalles:
        producto = detalle.producto
        subtotal = detalle.precio_unitario_usd * detalle.cantidad
        total_usd += subtotal
        nombre_producto = normalizar_texto(producto.nombre)
        if detalle.descuento_porcentaje and detalle.descuento_porcentaje > 0:
            nombre_producto += f" ({int(detalle.descuento_porcentaje)}% off)"
        # Truncar nombre según ancho disponible
        if MAX_CHARS == 32:
            if len(nombre_producto) > 20:
                nombre_producto = nombre_producto[:20]
            linea = f"{detalle.cantidad:>4} {nombre_producto:<20} ${subtotal:>7.2f}"
        else:
            if len(nombre_producto) > 28:
                nombre_producto = nombre_producto[:28]
            linea = f"{detalle.cantidad:>4} {nombre_producto:<28} ${subtotal:>9.2f}"
        lineas.append(wrap_line(linea))

    lineas.append(separador_corto)
    if MAX_CHARS == 32:
        lineas.append(wrap_line(f"TOTAL USD: ${total_usd:>9.2f}"))
        if mostrar_subtotal_usd:
            lineas.append(wrap_line(f"Subtotal USD: ${total_usd:>8.2f}"))
        subtotal_ves = venta.subtotal_ves if venta.subtotal_ves else 0
        subtotal_ves_str = normalizar_texto(f"Bs {subtotal_ves:,.2f}".replace(',', '.'))
        lineas.append(wrap_line(f"Subtotal VES: {subtotal_ves_str:>10}"))
        if iva_porcentaje > 0:
            iva_monto = subtotal_ves * (iva_porcentaje / 100)
            lineas.append(wrap_line(f"IVA ({iva_porcentaje:.0f}%): Bs {iva_monto:>8,.2f}".replace(',', '.')))
            total_ves_final = subtotal_ves + iva_monto
            total_ves_str = normalizar_texto(f"Bs {total_ves_final:,.2f}".replace(',', '.'))
            lineas.append(wrap_line(f"TOTAL VES: {total_ves_str:>10}"))
        else:
            lineas.append(wrap_line(f"TOTAL VES: {subtotal_ves_str:>10}"))
        if venta.metodo_cobro not in ['personalizada', 'bs_personalizado']:
            lineas.append(wrap_line(f"Método Cobro: {metodo_cobro_legible}"))
            lineas.append(wrap_line(f"Tasa aplicada: {venta.tasa_aplicada:.2f}"))
        lineas.append(wrap_line(f"Método Pago: {venta.metodo_pago}"))
        if venta.moneda_cobro == 'USD':
            lineas.append(wrap_line(f"Total en USD: ${venta.total_cobro:.2f}"))
        else:
            total_cobro_str = normalizar_texto(f"Bs {venta.total_cobro:,.2f}".replace(',', '.'))
            lineas.append(wrap_line(f"Total en VES: {total_cobro_str}"))
    else:  # 42 caracteres
        lineas.append(wrap_line(f"{'TOTAL USD:':<32} ${total_usd:>9.2f}"))
        if mostrar_subtotal_usd:
            lineas.append(wrap_line(f"{'Subtotal USD:':<32} ${total_usd:>9.2f}"))
        subtotal_ves = venta.subtotal_ves if venta.subtotal_ves else 0
        lineas.append(wrap_line(f"{'Subtotal VES:':<32} Bs {subtotal_ves:>9,.2f}".replace(',', '.')))
        if iva_porcentaje > 0:
            iva_monto = subtotal_ves * (iva_porcentaje / 100)
            lineas.append(wrap_line(f"IVA ({iva_porcentaje:.0f}%): {'':>19} Bs {iva_monto:>9,.2f}".replace(',', '.')))
            total_ves_final = subtotal_ves + iva_monto
            lineas.append(wrap_line(f"{'TOTAL VES:':<32} Bs {total_ves_final:>9,.2f}".replace(',', '.')))
        else:
            lineas.append(wrap_line(f"{'TOTAL VES:':<32} Bs {subtotal_ves:>9,.2f}".replace(',', '.')))
        if venta.metodo_cobro not in ['personalizada', 'bs_personalizado']:
            lineas.append(wrap_line(f"Método Cobro: {metodo_cobro_legible}"))
            lineas.append(wrap_line(f"Tasa aplicada: {venta.tasa_aplicada:.2f}"))
        lineas.append(wrap_line(f"Método Pago: {venta.metodo_pago}"))
        if venta.moneda_cobro == 'USD':
            lineas.append(wrap_line(f"Total en USD: ${venta.total_cobro:.2f}"))
        else:
            lineas.append(wrap_line(f"Total en VES: Bs {venta.total_cobro:,.2f}".replace(',', '.')))

    lineas.append(separador)
    lineas.append(centrar_linea(mensaje))
    lineas.append(centrar_linea(url))
    lineas.append("\n\n\n\n")
    return "\n".join(lineas)


# ============================================================
# NUEVAS FUNCIONES PARA TICKET POS-58 CON TODAS LAS BANDERAS
# (Corregidas: encabezado centrado, sin prefijos, fecha 12h, IVA sumado)
# 🔥 AHORA RECIBE LA FECHA YA CONVERTIDA A LOCAL (desde los puntos de llamada)
# ============================================================

def sanitizar_texto(texto):
    """Limpia caracteres especiales y acentos para evitar símbolos raros en la POS-58."""
    if not texto:
        return ""
    reemplazos = {
        'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
        'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
        'ñ': 'n', 'Ñ': 'N', 'º': '.', 'ª': '.', '°': '.', 'ø': '.'
    }
    texto_str = str(texto)
    for orig, nuev in reemplazos.items():
        texto_str = texto_str.replace(orig, nuev)
    return texto_str


def formatear_linea_justificada(izquierda, derecha, ancho=32):
    """Alinea el texto a la izquierda y el monto a la derecha dentro del ancho especificado."""
    izq = sanitizar_texto(izquierda)
    der = sanitizar_texto(derecha)
    espacios = ancho - len(izq) - len(der)
    if espacios < 1:
        return f"{izq}\n{' ' * (ancho - len(der))}{der}\n"
    return f"{izq}{' ' * espacios}{der}\n"


def generar_ticket_pos58(datos_venta, config_ticket, max_chars=32):
    """
    Genera el buffer de texto formateado para impresoras de 58mm (32 columnas)
    respetando dinámicamente la configuración del módulo 'Ticket Virtual'.
    CORREGIDO:
    - encabezado centrado sin prefijos
    - fecha 12h con AM/PM (ya debe venir en datos_venta['fecha_hora_12h'] convertida a local)
    - IVA sumado al total VES
    - subtotal_usd obtenido de forma segura con float() y default 0.0
    - indicador de oferta/descuento en el nombre del producto
    
    :param datos_venta: dict con la información de la venta (cliente, productos, totales)
    :param config_ticket: dict con los valores del formulario de configuración
    :param max_chars: número máximo de caracteres por línea (32 para 58mm, 42 para 80mm)
    """
    ANCHO = max_chars
    LINEA_DOBLE = "=" * ANCHO + "\n"
    LINEA_SIMPLE = "-" * ANCHO + "\n"
    
    ticket = []

    # --- 1. ENCABEZADO DE LA TIENDA (centrado, sin prefijos) ---
    nombre_tienda = config_ticket.get('nombre_tienda', 'ELEMENTS STORE')
    ticket.append(sanitizar_texto(nombre_tienda).center(ANCHO) + "\n")
    
    if config_ticket.get('mostrar_rif', True) and config_ticket.get('rif'):
        ticket.append(sanitizar_texto(config_ticket.get('rif')).center(ANCHO) + "\n")
        
    if config_ticket.get('mostrar_telefono', True) and config_ticket.get('telefono_tienda'):
        ticket.append(sanitizar_texto(config_ticket.get('telefono_tienda')).center(ANCHO) + "\n")
        
    if config_ticket.get('mostrar_direccion_tienda', True) and config_ticket.get('direccion_tienda'):
        dir_empresa = sanitizar_texto(config_ticket.get('direccion_tienda'))
        for linea in textwrap.wrap(dir_empresa, width=ANCHO):
            ticket.append(linea.center(ANCHO) + "\n")
        
    ticket.append(LINEA_DOBLE)
    
    # --- 2. DATOS DE LA NOTA / VENTA (fecha en 12h con AM/PM) ---
    num_nota = datos_venta.get('num_nota', '00000')
    fecha_hora = datos_venta.get('fecha_hora_12h', datos_venta.get('fecha_hora', ''))
    
    ticket.append(f"NOTA DE ENTREGA No: {num_nota}".center(ANCHO) + "\n")
    ticket.append(f"Fecha: {fecha_hora}".center(ANCHO) + "\n")
    ticket.append(LINEA_DOBLE)

    # --- 3. DATOS DEL CLIENTE (usar datos_venta, que ya vienen del frontend o de BD) ---
    ticket.append(f"Cliente: {sanitizar_texto(datos_venta.get('cliente_nombre', ''))}\n")
    ticket.append(f"Cedula: {sanitizar_texto(datos_venta.get('cliente_cedula', ''))}\n")
    ticket.append(f"Telefono: {sanitizar_texto(datos_venta.get('cliente_telefono', ''))}\n")
    
    if config_ticket.get('mostrar_direccion_cliente', True) and datos_venta.get('cliente_direccion'):
        dir_cliente = sanitizar_texto(f"Direccion: {datos_venta.get('cliente_direccion')}")
        for linea in textwrap.wrap(dir_cliente, width=ANCHO):
            ticket.append(linea + "\n")
        
    ticket.append(LINEA_SIMPLE)

    # --- 4. DETALLE DE PRODUCTOS con indicador de oferta/descuento ---
    ticket.append("Cant/Producto             Total\n")
    ticket.append(LINEA_SIMPLE)

    for item in datos_venta.get('productos', []):
        nombre_prod = sanitizar_texto(item.get('nombre', ''))
        # 🔥 CORRECCIÓN: Agregar indicador de oferta si tiene descuento
        descuento = float(item.get('descuento_porcentaje', 0) or 0)
        if descuento > 0:
            nombre_prod += f" (-{descuento:.0f}%)"
            
        cant = item.get('cantidad', 1)
        precio_unit = item.get('precio_unitario', 0.0)
        total_item = item.get('total', 0.0)

        for l in textwrap.wrap(nombre_prod, width=ANCHO):
            ticket.append(f"{l}\n")

        desglose = f"  {cant}x @ ${precio_unit:,.2f}"
        monto_str = f"${total_item:,.2f}"
        ticket.append(formatear_linea_justificada(desglose, monto_str, ANCHO))

    ticket.append(LINEA_DOBLE)

    # --- 5. TOTALES, IVA Y BANDERAS DINÁMICAS (CORREGIDO: TOTAL VES = SUBTOTAL + IVA) ---
    # 🔥 CORRECCIÓN: Obtener subtotal_usd de forma segura con float() y default 0.0
    subtotal_usd = float(datos_venta.get('subtotal_usd', 0.0) or 0.0)
    total_usd = float(datos_venta.get('total_usd', 0.0) or 0.0)
    subtotal_ves = float(datos_venta.get('subtotal_ves', 0.0) or 0.0)
    tasa_bcv = float(datos_venta.get('tasa_bcv', 0.0) or 0.0)

    # Casilla: "Mostrar Subtotal USD en el ticket"
    if config_ticket.get('mostrar_subtotal_usd', False):
        ticket.append(formatear_linea_justificada("SUBTOTAL USD:", f"${subtotal_usd:,.2f}", ANCHO))

    ticket.append(formatear_linea_justificada("TOTAL USD:", f"${total_usd:,.2f}", ANCHO))
    ticket.append(LINEA_SIMPLE)
    
    if tasa_bcv > 0:
        ticket.append(formatear_linea_justificada("Tasa BCV:", f"Bs {tasa_bcv:,.2f}", ANCHO))
        
    ticket.append(formatear_linea_justificada("SUBTOTAL VES:", f"Bs {subtotal_ves:,.2f}", ANCHO))

    # Cálculo del IVA y TOTAL VES = SUBTOTAL + IVA
    porcentaje_iva = float(config_ticket.get('porcentaje_iva', 0))
    if porcentaje_iva > 0:
        monto_iva_ves = subtotal_ves * (porcentaje_iva / 100)
        total_ves_final = subtotal_ves + monto_iva_ves
        ticket.append(formatear_linea_justificada(f"IVA ({porcentaje_iva:.0f}%):", f"Bs {monto_iva_ves:,.2f}", ANCHO))
    else:
        total_ves_final = subtotal_ves

    ticket.append(formatear_linea_justificada("TOTAL VES:", f"Bs {total_ves_final:,.2f}", ANCHO))
    
    modo_pago = sanitizar_texto(datos_venta.get('modo_pago', 'Pago Movil'))
    ticket.append(formatear_linea_justificada("Metodo Pago:", modo_pago, ANCHO))
    
    ticket.append(LINEA_DOBLE)

    # --- 6. MENSAJE FINAL Y URL ---
    mensaje = config_ticket.get('mensaje_agradecimiento', '¡Gracias por su compra!')
    if mensaje:
        for linea in textwrap.wrap(sanitizar_texto(mensaje), width=ANCHO):
            ticket.append(linea.center(ANCHO) + "\n")
            
    url_web = config_ticket.get('url_web', 'www.elementsstore.com')
    if url_web:
        ticket.append(sanitizar_texto(url_web).center(ANCHO) + "\n")
        
    ticket.append("\n\n\n")  # Espacio para el avance de papel

    return "".join(ticket)


# ============================================================
# FUNCIÓN PARA RUTA PORTABLE DE FUENTES (MODIFICADA PARA EJECUTABLE)
# ============================================================

def get_font_path(font_name):
    """
    Retorna la ruta completa a un archivo de fuente.
    - Si está compilado como .exe, busca en sys._MEIPASS/fonts/
    - Si está en desarrollo, busca en la carpeta fonts/ del proyecto
    """
    if getattr(sys, 'frozen', False):
        # Cuando está compilado como .exe, PyInstaller usa sys._MEIPASS
        base_dir = sys._MEIPASS
    else:
        # En entorno de desarrollo
        base_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_dir, 'fonts', font_name)

# ============================================================
# FUNCIONES PARA CREAR TABLA Y USUARIOS CON SQL DIRECTO
# ============================================================

def obtener_db_path():
    if getattr(sys, 'frozen', False):
        base_dir = os.path.dirname(sys.executable)
    else:
        base_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(base_dir, 'data')
    os.makedirs(data_dir, exist_ok=True)
    return os.path.join(data_dir, 'database.db')

def crear_tabla_usuarios_si_no_existe():
    db_path = obtener_db_path()
    if not os.path.exists(db_path):
        return
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios'")
        if cursor.fetchone() is None:
            print("⚠️ Tabla 'usuarios' no encontrada. Creándola con SQL directo...")
            cursor.execute("""
                CREATE TABLE usuarios (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    email VARCHAR(100) UNIQUE NOT NULL,
                    password_hash VARCHAR(200) NOT NULL,
                    rol VARCHAR(20) DEFAULT 'Estándar',
                    estado VARCHAR(20) DEFAULT 'Activo',
                    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
                    ultimo_login DATETIME
                )
            """)
            conn.commit()
            print("✅ Tabla 'usuarios' creada exitosamente con SQL directo.")
        else:
            cursor.execute("PRAGMA table_info(usuarios)")
            columnas = [col[1] for col in cursor.fetchall()]
            columnas_requeridas = ['rol', 'estado', 'fecha_registro', 'ultimo_login']
            for col in columnas_requeridas:
                if col not in columnas:
                    tipo = 'VARCHAR(20)' if col in ['rol', 'estado'] else 'DATETIME'
                    print(f"🔧 Agregando columna '{col}' a 'usuarios'...")
                    cursor.execute(f"ALTER TABLE usuarios ADD COLUMN {col} {tipo}")
                    conn.commit()
                    print(f"✅ Columna '{col}' agregada.")
        conn.close()
    except Exception as e:
        print(f"⚠️ Error al crear/verificar tabla usuarios: {e}")

def crear_usuarios_master_si_no_existen():
    db_path = obtener_db_path()
    if not os.path.exists(db_path):
        return
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM usuarios WHERE username IN ('master1', 'master2', 'tecnico')")
        count = cursor.fetchone()[0]
        if count == 0:
            password_hash = generate_password_hash('123456')
            usuarios = [
                ('master1', 'master1@elements.com', password_hash, 'Master', 'Activo'),
                ('master2', 'master2@elements.com', password_hash, 'Master', 'Activo'),
                ('tecnico', 'tecnico@elements.com', password_hash, 'Master', 'Activo')
            ]
            for u in usuarios:
                cursor.execute("""
                    INSERT INTO usuarios (username, email, password_hash, rol, estado, fecha_registro)
                    VALUES (?, ?, ?, ?, ?, datetime('now'))
                """, u)
            conn.commit()
            print("✅ Usuarios master creados (master1, master2, tecnico con contraseña 123456).")
        conn.close()
    except Exception as e:
        print(f"⚠️ Error al crear usuarios master: {e}")

def asegurar_tabla_usuarios():
    try:
        crear_tabla_usuarios_si_no_existe()
        crear_usuarios_master_si_no_existen()
        return True
    except Exception as e:
        print(f"❌ Error en asegurar_tabla_usuarios: {e}")
        import traceback
        traceback.print_exc()
        return False

# ============================================================
# DECORADORES DE AUTENTICACIÓN
# ============================================================

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('Por favor, inicie sesión para acceder a esta página.', 'warning')
            return redirect(url_for('main.login'))
        try:
            asegurar_tabla_usuarios()
            usuario = Usuario.query.get(session['user_id'])
            if usuario:
                session['rol'] = usuario.rol
        except Exception as e:
            print(f"❌ Error en login_required: {e}")
            flash('Error al verificar credenciales. Intente nuevamente.', 'danger')
            session.clear()
            return redirect(url_for('main.login'))
        return f(*args, **kwargs)
    return decorated_function

def master_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('Por favor, inicie sesión para acceder a esta página.', 'warning')
            return redirect(url_for('main.login'))
        try:
            asegurar_tabla_usuarios()
            usuario = Usuario.query.get(session['user_id'])
            if usuario:
                session['rol'] = usuario.rol
            else:
                flash('Usuario no encontrado. Inicie sesión nuevamente.', 'warning')
                session.clear()
                return redirect(url_for('main.login'))
            if session.get('rol') != 'Master':
                flash('Acceso denegado. Se requieren permisos de Master.', 'danger')
                return redirect(url_for('main.dashboard'))
        except Exception as e:
            print(f"❌ Error en master_required: {e}")
            flash('Error al verificar permisos. Intente nuevamente.', 'danger')
            session.clear()
            return redirect(url_for('main.login'))
        return f(*args, **kwargs)
    return decorated_function

def obtener_usuario_actual():
    user_id = session.get('user_id')
    if user_id:
        return Usuario.query.get(user_id)
    return None

# ============================================================
# FUNCIÓN AUXILIAR: CLASIFICAR PAGO POR MONEDA
# ============================================================

def _clasificar_pago(pago):
    """
    Determina si un pago de apartado es en USD o VES.
    Criterios:
    1. metodo_cobro 'usd' o 'usd_personalizado' -> USD
    2. metodo_cobro 'bcv_usd', 'bcv_eur', 'personalizada', 'bs_personalizado' -> VES
    3. Si metodo_cobro es None o desconocido:
       - Si monto_ves > 0 y monto_usd == 0 -> VES
       - Si monto_usd > 0 y monto_ves == 0 -> USD
       - Si ambos > 0, se consulta el metodo_cobro_inicial del apartado asociado
         - Si es VES -> VES, sino -> USD
       - Si no se puede determinar, se asume USD.
    Retorna 'USD' o 'VES'.
    """
    mc = pago.metodo_cobro
    if mc in ['usd', 'usd_personalizado']:
        return 'USD'
    if mc in ['bcv_usd', 'bcv_eur', 'personalizada', 'bs_personalizado']:
        return 'VES'
    # Inferencia por montos
    if pago.monto_ves > 0 and pago.monto_usd == 0:
        return 'VES'
    if pago.monto_usd > 0 and pago.monto_ves == 0:
        return 'USD'
    if pago.monto_ves > 0 and pago.monto_usd > 0:
        # Ambos tienen valor, consultar el apartado
        apartado = Apartado.query.get(pago.apartado_id)
        if apartado and apartado.metodo_cobro_inicial in ['bcv_usd', 'bcv_eur', 'personalizada', 'bs_personalizado']:
            return 'VES'
        else:
            return 'USD'
    # Si no hay montos, por defecto USD
    return 'USD'

# ============================================================
# 🔥 NUEVA FUNCIÓN AUXILIAR: OBTENER CLIENTE GENÉRICO
# ============================================================
def _obtener_cliente_generico():
    """
    Busca o crea un cliente genérico para reasignar registros huérfanos.
    """
    generic = Cliente.query.filter_by(cedula='00000000').first()
    if not generic:
        generic = Cliente(
            nombre='Eliminado',
            apellido='Sistema',
            cedula='00000000',
            direccion='',
            telefono='',
            limite_credito=0,
            saldo_deudor=0,
            es_fijo=False
        )
        db.session.add(generic)
        db.session.commit()
    return generic

# ============================================================
# PÁGINAS PRINCIPALES (CON PROTECCIÓN)
# ============================================================

@main_bp.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('main.dashboard'))
    return redirect(url_for('main.login'))

@main_bp.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html')

@main_bp.route('/entrada')
@login_required
def entrada():
    return render_template('entrada.html')

@main_bp.route('/inventario')
@login_required
def inventario():
    return render_template('inventario.html')

@main_bp.route('/salida')
@login_required
def salida():
    return render_template('salida.html')

@main_bp.route('/creditos')
@login_required
def creditos():
    return render_template('creditos.html')

@main_bp.route('/logs')
@login_required
def logs():
    return render_template('logs.html')

@main_bp.route('/config')
@login_required
def config():
    return render_template('config.html')

@main_bp.route('/reportes')
@login_required
def reportes():
    hoy = datetime.now().strftime('%Y-%m-%d')
    return render_template('reportes.html', hoy=hoy)

@main_bp.route('/gastos')
@login_required
def gastos():
    return render_template('gastos.html')

@main_bp.route('/opciones')
@login_required
def opciones():
    return render_template('opciones.html')

@main_bp.route('/tickets')
@login_required
def tickets():
    return render_template('tickets.html')

# ============================================================
# NUEVA RUTA PARA CAJAS Y BALANCE GENERAL
# ============================================================

@main_bp.route('/finanzas/balance')
@login_required
def finanzas_balance():
    return render_template('finanzas_balance.html')

# ============================================================
# NUEVAS RUTAS PARA CLIENTES FIJOS
# ============================================================

@main_bp.route('/admin/clientes')
@login_required
def admin_clientes():
    return render_template('clientes.html')

@main_bp.route('/admin/clientes/crear')
@login_required
def admin_cliente_crear():
    return render_template('cliente_crear.html')

@main_bp.route('/admin/clientes/editar/<int:id>')
@login_required
def admin_cliente_editar(id):
    cliente = Cliente.query.get_or_404(id)
    return render_template('cliente_editar.html', cliente=cliente)

# ============================================================
# NUEVAS RUTAS PARA DEUDAS/APARTADOS
# ============================================================

@main_bp.route('/admin/deudas')
@login_required
def admin_deudas():
    return render_template('deudas.html')

@main_bp.route('/admin/deudas/crear')
@login_required
def admin_deuda_crear():
    return render_template('deuda_crear.html')

@main_bp.route('/admin/deudas/<int:id>')
@login_required
def admin_deuda_detalle(id):
    deuda = Apartado.query.get_or_404(id)
    return render_template('deuda_detalle.html', deuda=deuda)

@main_bp.route('/admin/deudas/<int:id>/agregar-abono')
@login_required
def admin_deuda_agregar_abono(id):
    deuda = Apartado.query.get_or_404(id)
    return render_template('deuda_agregar_abono.html', deuda=deuda)

@main_bp.route('/admin/deudas/finalizadas')
@login_required
def admin_deudas_finalizadas():
    return render_template('deudas_finalizadas.html')

# ============================================================
# NUEVAS RUTAS PARA CAJAS (PENDIENTE)
# ============================================================

@main_bp.route('/admin/cajas')
@login_required
def admin_cajas():
    return render_template('cajas.html')

# ============================================================
# 🔥 NUEVA RUTA PARA CONFIGURACIÓN DE IMPRESORA
# ============================================================

@main_bp.route('/config/impresora')
@login_required
def config_impresora():
    return render_template('impresora_config.html')

# ============================================================
# 🔥 RUTA PARA TICKET HTML (IMPRESIÓN DESDE NAVEGADOR) - MODIFICADA
# ============================================================

@main_bp.route('/ventas/ticket/<int:venta_id>')
@login_required
def ticket_nota_entrega(venta_id):
    """
    Renderiza una vista HTML del ticket para impresión desde el navegador.
    """
    venta = Venta.query.get_or_404(venta_id)
    detalles = DetalleVenta.query.filter_by(venta_id=venta_id).all()
    cliente = venta.cliente

    # 🔥 CORRECCIÓN DE ZONA HORARIA (CARACAS -4) - FORZANDO UTC
    if venta.fecha.tzinfo is None:
        # Asumir que la fecha en la BD está en UTC
        fecha_utc = pytz.UTC.localize(venta.fecha)
        fecha_local = fecha_utc.astimezone(pytz.timezone('America/Caracas'))
    else:
        fecha_local = venta.fecha.astimezone(pytz.timezone('America/Caracas'))
    
    # 🔥 Obtener configuración del ticket para mostrar en la vista
    claves_ticket = [
        'ticket_tienda_nombre', 'ticket_rif', 'ticket_telefono_tienda', 'ticket_direccion_tienda',
        'ticket_mostrar_rif', 'ticket_mostrar_telefono', 'ticket_mostrar_direccion_cliente',
        'ticket_mostrar_direccion_tienda', 'ticket_mensaje', 'ticket_url',
        'ticket_subtotal_usd', 'ticket_iva_porcentaje'
    ]
    configs_ticket = {}
    for clave in claves_ticket:
        cfg = Configuracion.query.filter_by(clave=clave).first()
        configs_ticket[clave] = cfg.valor if cfg else None

    config_ticket = {
        'nombre_tienda': configs_ticket.get('ticket_tienda_nombre', 'ELEMENTS STORE'),
        'rif': configs_ticket.get('ticket_rif', ''),
        'telefono_tienda': configs_ticket.get('ticket_telefono_tienda', ''),
        'direccion_tienda': configs_ticket.get('ticket_direccion_tienda', ''),
        'mostrar_rif': configs_ticket.get('ticket_mostrar_rif', 'true').lower() == 'true',
        'mostrar_telefono': configs_ticket.get('ticket_mostrar_telefono', 'true').lower() == 'true',
        'mostrar_direccion_tienda': configs_ticket.get('ticket_mostrar_direccion_tienda', 'true').lower() == 'true',
        'mostrar_direccion_cliente': configs_ticket.get('ticket_mostrar_direccion_cliente', 'true').lower() == 'true',
        'mostrar_subtotal_usd': configs_ticket.get('ticket_subtotal_usd', 'false').lower() == 'true',
        'porcentaje_iva': float(configs_ticket.get('ticket_iva_porcentaje', '0') or '0'),
        'mensaje_agradecimiento': configs_ticket.get('ticket_mensaje', '¡Gracias por su compra!'),
        'url_web': configs_ticket.get('ticket_url', 'www.elementsstore.com')
    }
    
    # ============================================================
    # 🔥 ENMASCARAMIENTO DE TASA PERSONALIZADA
    # ============================================================
    metodo_cobro = venta.metodo_cobro
    if metodo_cobro in ['personalizada', 'bs_personalizado', 'usd_personalizado']:
        metodo_mostrar = 'Tasa BCV USD'
        tasa_mostrar = venta.tasa_bcv_usd  # Tasa oficial del día
    else:
        metodo_mostrar = metodo_cobro
        tasa_mostrar = venta.tasa_aplicada
    
    return render_template('ticket_nota_entrega.html', 
                           venta=venta, 
                           detalles=detalles, 
                           cliente=cliente,
                           fecha_local=fecha_local,               # 🔥 NUEVA VARIABLE
                           config_ticket=config_ticket,
                           metodo_mostrar=metodo_mostrar,
                           tasa_mostrar=tasa_mostrar)

# ============================================================
# AUTENTICACIÓN: LOGIN Y LOGOUT (SIN REGISTRO PÚBLICO)
# ============================================================

@main_bp.route('/login', methods=['GET', 'POST'])
def login():
    try:
        asegurar_tabla_usuarios()
    except Exception as e:
        print(f"⚠️ Error al asegurar tabla en login: {e}")
    
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')

        if not username or not password:
            flash('Por favor, ingrese usuario y contraseña.', 'warning')
            return render_template('login.html')

        try:
            usuario = Usuario.query.filter_by(username=username).first()
        except Exception as e:
            print(f"❌ Error al buscar usuario: {e}")
            flash('Error al consultar la base de datos.', 'danger')
            return render_template('login.html')

        if not usuario:
            flash('Usuario no encontrado.', 'danger')
            return render_template('login.html')

        if not check_password_hash(usuario.password_hash, password):
            flash('Contraseña incorrecta.', 'danger')
            return render_template('login.html')

        if usuario.estado != 'Activo':
            flash('Cuenta inactiva. Contacte al administrador.', 'danger')
            return render_template('login.html')

        session['user_id'] = usuario.id
        session['username'] = usuario.username
        session['rol'] = usuario.rol

        usuario.ultimo_login = now_venezuela()
        db.session.commit()

        flash(f'¡Bienvenido, {usuario.username}!', 'success')
        return redirect(url_for('main.dashboard'))

    return render_template('login.html')

@main_bp.route('/logout')
def logout():
    session.clear()
    flash('Sesión cerrada correctamente.', 'info')
    return redirect(url_for('main.login'))

# ============================================================
# ADMINISTRACIÓN DE USUARIOS (SOLO MASTER)
# ============================================================

@main_bp.route('/admin/usuarios')
@master_required
def admin_usuarios():
    try:
        usuarios = Usuario.query.order_by(Usuario.fecha_registro.desc()).all()
        return render_template('admin_usuarios.html', usuarios=usuarios)
    except Exception as e:
        import traceback
        traceback.print_exc()
        flash(f'Error al cargar usuarios: {str(e)}', 'danger')
        return redirect(url_for('main.dashboard'))

@main_bp.route('/admin/usuarios/crear', methods=['GET', 'POST'])
@master_required
def admin_usuario_crear():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        email = request.form.get('email', '').strip()
        password = request.form.get('password', '')
        rol = request.form.get('rol', 'Estándar')
        estado = request.form.get('estado', 'Activo')

        if not username or not email or not password:
            flash('Todos los campos son obligatorios.', 'warning')
            return render_template('admin_usuario_crear.html')

        if len(password) < 6:
            flash('La contraseña debe tener al menos 6 caracteres.', 'warning')
            return render_template('admin_usuario_crear.html')

        try:
            if Usuario.query.filter_by(username=username).first():
                flash('El nombre de usuario ya está en uso.', 'danger')
                return render_template('admin_usuario_crear.html')

            if Usuario.query.filter_by(email=email).first():
                flash('El correo electrónico ya está registrado.', 'danger')
                return render_template('admin_usuario_crear.html')
        except Exception as e:
            print(f"❌ Error al verificar duplicados: {e}")
            flash('Error al verificar datos. Intente nuevamente.', 'danger')
            return render_template('admin_usuario_crear.html')

        nuevo_usuario = Usuario(
            username=username,
            email=email,
            password_hash=generate_password_hash(password),
            rol=rol,
            estado=estado
        )
        db.session.add(nuevo_usuario)
        db.session.commit()

        flash(f'Usuario {username} creado correctamente.', 'success')
        return redirect(url_for('main.admin_usuarios'))

    return render_template('admin_usuario_crear.html')

@main_bp.route('/admin/usuarios/editar/<int:user_id>', methods=['GET', 'POST'])
@master_required
def admin_usuario_editar(user_id):
    usuario = Usuario.query.get_or_404(user_id)
    if usuario.rol == 'Master' and usuario.id != session['user_id']:
        flash('No puedes editar a otro usuario Master.', 'warning')
        return redirect(url_for('main.admin_usuarios'))

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        email = request.form.get('email', '').strip()
        rol = request.form.get('rol', 'Estándar')
        estado = request.form.get('estado', 'Activo')
        new_password = request.form.get('new_password', '').strip()

        if not username or not email:
            flash('Nombre de usuario y correo son obligatorios.', 'warning')
            return render_template('admin_usuario_editar.html', usuario=usuario)

        try:
            if Usuario.query.filter(Usuario.username == username, Usuario.id != user_id).first():
                flash('El nombre de usuario ya está en uso.', 'danger')
                return render_template('admin_usuario_editar.html', usuario=usuario)

            if Usuario.query.filter(Usuario.email == email, Usuario.id != user_id).first():
                flash('El correo electrónico ya está en uso.', 'danger')
                return render_template('admin_usuario_editar.html', usuario=usuario)
        except Exception as e:
            print(f"❌ Error al verificar duplicados: {e}")
            flash('Error al verificar datos.', 'danger')
            return render_template('admin_usuario_editar.html', usuario=usuario)

        usuario.username = username
        usuario.email = email
        usuario.rol = rol
        usuario.estado = estado

        if new_password:
            if len(new_password) < 6:
                flash('La nueva contraseña debe tener al menos 6 caracteres.', 'warning')
                return render_template('admin_usuario_editar.html', usuario=usuario)
            usuario.password_hash = generate_password_hash(new_password)

        db.session.commit()
        flash(f'Usuario {username} actualizado correctamente.', 'success')
        return redirect(url_for('main.admin_usuarios'))

    return render_template('admin_usuario_editar.html', usuario=usuario)

@main_bp.route('/admin/usuarios/eliminar/<int:user_id>', methods=['POST'])
@master_required
def admin_usuario_eliminar(user_id):
    usuario = Usuario.query.get_or_404(user_id)
    if usuario.id == session['user_id']:
        flash('No puedes eliminar tu propia cuenta.', 'warning')
        return redirect(url_for('main.admin_usuarios'))
    if usuario.rol == 'Master':
        flash('No puedes eliminar a otro usuario Master.', 'warning')
        return redirect(url_for('main.admin_usuarios'))

    db.session.delete(usuario)
    db.session.commit()
    flash(f'Usuario {usuario.username} eliminado correctamente.', 'success')
    return redirect(url_for('main.admin_usuarios'))

# ============================================================
# PERFIL DE USUARIO
# ============================================================

@main_bp.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    usuario = obtener_usuario_actual()
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        email = request.form.get('email', '').strip()
        current_password = request.form.get('current_password', '')
        new_password = request.form.get('new_password', '').strip()
        confirm_password = request.form.get('confirm_password', '').strip()

        if not username or not email:
            flash('Nombre de usuario y correo son obligatorios.', 'warning')
            return render_template('profile.html', usuario=usuario)

        if new_password or confirm_password:
            if not current_password:
                flash('Debe ingresar su contraseña actual para cambiarla.', 'warning')
                return render_template('profile.html', usuario=usuario)
            if not check_password_hash(usuario.password_hash, current_password):
                flash('Contraseña actual incorrecta.', 'danger')
                return render_template('profile.html', usuario=usuario)
            if new_password != confirm_password:
                flash('Las contraseñas no coinciden.', 'warning')
                return render_template('profile.html', usuario=usuario)
            if len(new_password) < 6:
                flash('La nueva contraseña debe tener al menos 6 caracteres.', 'warning')
                return render_template('profile.html', usuario=usuario)
            usuario.password_hash = generate_password_hash(new_password)

        if Usuario.query.filter(Usuario.username == username, Usuario.id != usuario.id).first():
            flash('El nombre de usuario ya está en uso.', 'danger')
            return render_template('profile.html', usuario=usuario)

        if Usuario.query.filter(Usuario.email == email, Usuario.id != usuario.id).first():
            flash('El correo electrónico ya está en uso.', 'danger')
            return render_template('profile.html', usuario=usuario)

        usuario.username = username
        usuario.email = email
        db.session.commit()
        session['username'] = username
        flash('Perfil actualizado correctamente.', 'success')
        return redirect(url_for('main.profile'))

    return render_template('profile.html', usuario=usuario)

# ============================================================
# RUTA DE CARGA (LOADING SCREEN)
# ============================================================

@main_bp.route('/loading')
def loading():
    return render_template('loading.html')

# ============================================================
# API: TASAS (SIN PROTECCIÓN - PÚBLICA)
# ============================================================

@api_bp.route('/tasas', methods=['GET'])
def get_tasas():
    tasas = obtener_tasas_bcv()
    tasa_personalizada = obtener_tasa_personalizada()
    return jsonify({
        'bcv_usd': tasas['usd'],
        'bcv_eur': tasas['eur'],
        'personalizada': tasa_personalizada,
        'source': tasas.get('source', 'desconocido')
    })

# ============================================================
# API: BÚSQUEDA DE PRODUCTOS (PROTEGIDA)
# ============================================================

@api_bp.route('/productos/buscar', methods=['GET'])
@login_required
def buscar_productos():
    query = request.args.get('q', '').strip()
    if len(query) < 2:
        return jsonify([])
    
    productos = Producto.query.filter(Producto.nombre.ilike(f'%{query}%')).limit(10).all()
    result = []
    for p in productos:
        result.append({
            'id': p.id,
            'nombre': p.nombre,
            'categoria_id': p.categoria_id,
            'categoria': p.categoria.nombre if p.categoria else None,
            'subcategoria_id': p.subcategoria_id,
            'subcategoria': p.subcategoria.nombre if p.subcategoria else None,
            'marca_id': p.marca_id,
            'marca': p.marca.nombre if p.marca else None,
            'talla_id': p.talla_id,
            'talla': p.talla_ref.nombre if p.talla_ref else None,
            'precio_usd': p.precio_usd,
            'precio_ves_bcv_usd': p.precio_ves_bcv_usd,
            'precio_ves_bcv_eur': p.precio_ves_bcv_eur,
            'precio_ves_personalizada': p.precio_ves_personalizada,
            'stock': p.stock,
            'control_serial': p.control_serial
        })
    return jsonify(result)

# ============================================================
# API: CATEGORÍAS (PROTEGIDA) - 🔥 MODIFICADO PARA PAGINACIÓN Y BÚSQUEDA
# ============================================================

@api_bp.route('/categorias', methods=['GET'])
@login_required
def get_categorias():
    # Parámetros de paginación y búsqueda (opcionales)
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    search = request.args.get('search', '').strip()
    
    query = Categoria.query
    if search:
        query = query.filter(Categoria.nombre.ilike(f'%{search}%'))
    
    # Si no se solicita paginación explícita (sin parámetros page/per_page), devolver todo (compatibilidad)
    if 'page' in request.args or 'per_page' in request.args:
        paginado = query.paginate(page=page, per_page=per_page, error_out=False)
        items = [{
            'id': c.id,
            'nombre': c.nombre,
            'subcategorias_count': len(c.subcategorias),
            'marcas_count': len(c.marcas)
        } for c in paginado.items]
        return jsonify({
            'items': items,
            'total': paginado.total,
            'page': paginado.page,
            'per_page': paginado.per_page,
            'pages': paginado.pages
        })
    else:
        cats = query.all()
        result = []
        for c in cats:
            result.append({
                'id': c.id,
                'nombre': c.nombre,
                'subcategorias_count': len(c.subcategorias),
                'marcas_count': len(c.marcas)
            })
        return jsonify(result)

@api_bp.route('/categorias/<int:id>', methods=['GET'])
@login_required
def get_categoria(id):
    categoria = Categoria.query.get_or_404(id)
    return jsonify({
        'id': categoria.id,
        'nombre': categoria.nombre
    })

@api_bp.route('/categorias', methods=['POST'])
@login_required
def crear_categoria():
    data = request.get_json()
    nombre = data.get('nombre', '').strip()
    if not nombre:
        return jsonify({'error': 'El nombre es requerido'}), 400
    if Categoria.query.filter_by(nombre=nombre).first():
        return jsonify({'error': 'Ya existe una categoría con ese nombre'}), 400
    categoria = Categoria(nombre=nombre)
    db.session.add(categoria)
    db.session.commit()
    log = Log(accion='CREAR_CATEGORIA', detalle=f'Categoría "{nombre}" creada')
    db.session.add(log)
    db.session.commit()
    return jsonify({'mensaje': 'Categoría creada', 'id': categoria.id}), 201

@api_bp.route('/categorias/<int:id>', methods=['PUT'])
@login_required
def editar_categoria(id):
    categoria = Categoria.query.get_or_404(id)
    data = request.get_json()
    nombre = data.get('nombre', '').strip()
    if not nombre:
        return jsonify({'error': 'El nombre es requerido'}), 400
    if Categoria.query.filter_by(nombre=nombre).first() and nombre != categoria.nombre:
        return jsonify({'error': 'Ya existe una categoría con ese nombre'}), 400
    categoria.nombre = nombre
    db.session.commit()
    log = Log(accion='EDITAR_CATEGORIA', detalle=f'Categoría "{nombre}" editada')
    db.session.add(log)
    db.session.commit()
    return jsonify({'mensaje': 'Categoría actualizada'})

@api_bp.route('/categorias/<int:id>', methods=['DELETE'])
@login_required
def eliminar_categoria(id):
    categoria = Categoria.query.get_or_404(id)
    if categoria.productos:
        return jsonify({'error': 'No se puede eliminar: la categoría tiene productos asociados'}), 400
    nombre = categoria.nombre
    db.session.delete(categoria)
    db.session.commit()
    log = Log(accion='ELIMINAR_CATEGORIA', detalle=f'Categoría "{nombre}" eliminada')
    db.session.add(log)
    db.session.commit()
    return jsonify({'mensaje': 'Categoría eliminada'})

# ============================================================
# API: SUBCATEGORÍAS (PROTEGIDA) - 🔥 MODIFICADO PARA PAGINACIÓN Y BÚSQUEDA
# ============================================================

@api_bp.route('/subcategorias', methods=['GET'])
@login_required
def get_subcategorias():
    cat_id = request.args.get('categoria_id')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    search = request.args.get('search', '').strip()
    
    query = Subcategoria.query
    if cat_id:
        query = query.filter_by(categoria_id=cat_id)
    if search:
        query = query.filter(Subcategoria.nombre.ilike(f'%{search}%'))
    
    # Si no se solicita paginación explícita, devolver todo (compatibilidad)
    if 'page' in request.args or 'per_page' in request.args:
        paginado = query.paginate(page=page, per_page=per_page, error_out=False)
        items = []
        for s in paginado.items:
            items.append({
                'id': s.id,
                'nombre': s.nombre,
                'categoria_id': s.categoria_id,
                'categoria_nombre': s.categoria.nombre if s.categoria else None
            })
        return jsonify({
            'items': items,
            'total': paginado.total,
            'page': paginado.page,
            'per_page': paginado.per_page,
            'pages': paginado.pages
        })
    else:
        if cat_id:
            subs = query.all()
        else:
            subs = query.all()
        result = []
        for s in subs:
            result.append({
                'id': s.id,
                'nombre': s.nombre,
                'categoria_id': s.categoria_id,
                'categoria_nombre': s.categoria.nombre if s.categoria else None
            })
        return jsonify(result)

@api_bp.route('/subcategorias/<int:id>', methods=['GET'])
@login_required
def get_subcategoria(id):
    sub = Subcategoria.query.get_or_404(id)
    return jsonify({
        'id': sub.id,
        'nombre': sub.nombre,
        'categoria_id': sub.categoria_id
    })

@api_bp.route('/subcategorias', methods=['POST'])
@login_required
def crear_subcategoria():
    data = request.get_json()
    nombre = data.get('nombre', '').strip()
    categoria_id = data.get('categoria_id')
    if not nombre or not categoria_id:
        return jsonify({'error': 'Nombre y categoría son requeridos'}), 400
    categoria = Categoria.query.get(categoria_id)
    if not categoria:
        return jsonify({'error': 'Categoría no encontrada'}), 404
    if Subcategoria.query.filter_by(nombre=nombre, categoria_id=categoria_id).first():
        return jsonify({'error': 'Ya existe una subcategoría con ese nombre en esta categoría'}), 400
    sub = Subcategoria(nombre=nombre, categoria_id=categoria_id)
    db.session.add(sub)
    db.session.commit()
    log = Log(accion='CREAR_SUBCATEGORIA', detalle=f'Subcategoría "{nombre}" creada en categoría "{categoria.nombre}"')
    db.session.add(log)
    db.session.commit()
    return jsonify({'mensaje': 'Subcategoría creada', 'id': sub.id}), 201

@api_bp.route('/subcategorias/<int:id>', methods=['PUT'])
@login_required
def editar_subcategoria(id):
    sub = Subcategoria.query.get_or_404(id)
    data = request.get_json()
    nombre = data.get('nombre', '').strip()
    categoria_id = data.get('categoria_id')
    if not nombre:
        return jsonify({'error': 'El nombre es requerido'}), 400
    if categoria_id:
        categoria = Categoria.query.get(categoria_id)
        if not categoria:
            return jsonify({'error': 'Categoría no encontrada'}), 404
        existente = Subcategoria.query.filter_by(nombre=nombre, categoria_id=categoria_id).first()
        if existente and existente.id != id:
            return jsonify({'error': 'Ya existe una subcategoría con ese nombre en esta categoría'}), 400
        sub.categoria_id = categoria_id
    else:
        existente = Subcategoria.query.filter_by(nombre=nombre, categoria_id=sub.categoria_id).first()
        if existente and existente.id != id:
            return jsonify({'error': 'Ya existe una subcategoría con ese nombre en esta categoría'}), 400
    sub.nombre = nombre
    db.session.commit()
    log = Log(accion='EDITAR_SUBCATEGORIA', detalle=f'Subcategoría "{nombre}" editada')
    db.session.add(log)
    db.session.commit()
    return jsonify({'mensaje': 'Subcategoría actualizada'})

@api_bp.route('/subcategorias/<int:id>', methods=['DELETE'])
@login_required
def eliminar_subcategoria(id):
    sub = Subcategoria.query.get_or_404(id)
    if sub.productos:
        return jsonify({'error': 'No se puede eliminar: la subcategoría tiene productos asociados'}), 400
    nombre = sub.nombre
    db.session.delete(sub)
    db.session.commit()
    log = Log(accion='ELIMINAR_SUBCATEGORIA', detalle=f'Subcategoría "{nombre}" eliminada')
    db.session.add(log)
    db.session.commit()
    return jsonify({'mensaje': 'Subcategoría eliminada'})

# ============================================================
# API: MARCAS (PROTEGIDA) - 🔥 MODIFICADO PARA PAGINACIÓN Y BÚSQUEDA
# ============================================================

@api_bp.route('/marcas', methods=['GET'])
@login_required
def get_marcas():
    cat_id = request.args.get('categoria_id')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    search = request.args.get('search', '').strip()
    
    query = Marca.query
    if cat_id:
        query = query.filter_by(categoria_id=cat_id)
    if search:
        query = query.filter(Marca.nombre.ilike(f'%{search}%'))
    
    if 'page' in request.args or 'per_page' in request.args:
        paginado = query.paginate(page=page, per_page=per_page, error_out=False)
        items = []
        for m in paginado.items:
            items.append({
                'id': m.id,
                'nombre': m.nombre,
                'categoria_id': m.categoria_id,
                'categoria_nombre': m.categoria.nombre if m.categoria else None
            })
        return jsonify({
            'items': items,
            'total': paginado.total,
            'page': paginado.page,
            'per_page': paginado.per_page,
            'pages': paginado.pages
        })
    else:
        if cat_id:
            marcas = query.all()
        else:
            marcas = query.all()
        result = []
        for m in marcas:
            result.append({
                'id': m.id,
                'nombre': m.nombre,
                'categoria_id': m.categoria_id,
                'categoria_nombre': m.categoria.nombre if m.categoria else None
            })
        return jsonify(result)

@api_bp.route('/marcas/<int:id>', methods=['GET'])
@login_required
def get_marca(id):
    marca = Marca.query.get_or_404(id)
    return jsonify({
        'id': marca.id,
        'nombre': marca.nombre,
        'categoria_id': marca.categoria_id
    })

@api_bp.route('/marcas', methods=['POST'])
@login_required
def crear_marca():
    data = request.get_json()
    nombre = data.get('nombre', '').strip()
    categoria_id = data.get('categoria_id')
    if not nombre or not categoria_id:
        return jsonify({'error': 'Nombre y categoría son requeridos'}), 400
    categoria = Categoria.query.get(categoria_id)
    if not categoria:
        return jsonify({'error': 'Categoría no encontrada'}), 404
    if Marca.query.filter_by(nombre=nombre, categoria_id=categoria_id).first():
        return jsonify({'error': 'Ya existe una marca con ese nombre en esta categoría'}), 400
    marca = Marca(nombre=nombre, categoria_id=categoria_id)
    db.session.add(marca)
    db.session.commit()
    log = Log(accion='CREAR_MARCA', detalle=f'Marca "{nombre}" creada en categoría "{categoria.nombre}"')
    db.session.add(log)
    db.session.commit()
    return jsonify({'mensaje': 'Marca creada', 'id': marca.id}), 201

@api_bp.route('/marcas/<int:id>', methods=['PUT'])
@login_required
def editar_marca(id):
    marca = Marca.query.get_or_404(id)
    data = request.get_json()
    nombre = data.get('nombre', '').strip()
    categoria_id = data.get('categoria_id')
    if not nombre:
        return jsonify({'error': 'El nombre es requerido'}), 400
    if categoria_id:
        categoria = Categoria.query.get(categoria_id)
        if not categoria:
            return jsonify({'error': 'Categoría no encontrada'}), 404
        existente = Marca.query.filter_by(nombre=nombre, categoria_id=categoria_id).first()
        if existente and existente.id != id:
            return jsonify({'error': 'Ya existe una marca con ese nombre en esta categoría'}), 400
        marca.categoria_id = categoria_id
    else:
        existente = Marca.query.filter_by(nombre=nombre, categoria_id=marca.categoria_id).first()
        if existente and existente.id != id:
            return jsonify({'error': 'Ya existe una marca con ese nombre en esta categoría'}), 400
    marca.nombre = nombre
    db.session.commit()
    log = Log(accion='EDITAR_MARCA', detalle=f'Marca "{nombre}" editada')
    db.session.add(log)
    db.session.commit()
    return jsonify({'mensaje': 'Marca actualizada'})

@api_bp.route('/marcas/<int:id>', methods=['DELETE'])
@login_required
def eliminar_marca(id):
    marca = Marca.query.get_or_404(id)
    if marca.productos:
        return jsonify({'error': 'No se puede eliminar: la marca tiene productos asociados'}), 400
    nombre = marca.nombre
    db.session.delete(marca)
    db.session.commit()
    log = Log(accion='ELIMINAR_MARCA', detalle=f'Marca "{nombre}" eliminada')
    db.session.add(log)
    db.session.commit()
    return jsonify({'mensaje': 'Marca eliminada'})

# ============================================================
# API: TALLAS (PROTEGIDA) - 🔥 MODIFICADO PARA PAGINACIÓN Y BÚSQUEDA
# ============================================================

@api_bp.route('/tallas', methods=['GET'])
@login_required
def get_tallas():
    subcat_id = request.args.get('subcategoria_id')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    search = request.args.get('search', '').strip()
    
    query = Talla.query
    if subcat_id:
        query = query.filter_by(subcategoria_id=subcat_id)
    if search:
        query = query.filter(Talla.nombre.ilike(f'%{search}%'))
    
    if 'page' in request.args or 'per_page' in request.args:
        paginado = query.paginate(page=page, per_page=per_page, error_out=False)
        items = []
        for t in paginado.items:
            items.append({
                'id': t.id,
                'nombre': t.nombre,
                'subcategoria_id': t.subcategoria_id,
                'subcategoria_nombre': t.subcategoria.nombre if t.subcategoria else None
            })
        return jsonify({
            'items': items,
            'total': paginado.total,
            'page': paginado.page,
            'per_page': paginado.per_page,
            'pages': paginado.pages
        })
    else:
        if subcat_id:
            tallas = query.all()
        else:
            tallas = query.all()
        result = []
        for t in tallas:
            result.append({
                'id': t.id,
                'nombre': t.nombre,
                'subcategoria_id': t.subcategoria_id,
                'subcategoria_nombre': t.subcategoria.nombre if t.subcategoria else None
            })
        return jsonify(result)

@api_bp.route('/tallas/<int:id>', methods=['GET'])
@login_required
def get_talla(id):
    talla = Talla.query.get_or_404(id)
    return jsonify({
        'id': talla.id,
        'nombre': talla.nombre,
        'subcategoria_id': talla.subcategoria_id
    })

@api_bp.route('/tallas', methods=['POST'])
@login_required
def crear_talla():
    data = request.get_json()
    nombre = data.get('nombre', '').strip()
    subcategoria_id = data.get('subcategoria_id')
    if not nombre or not subcategoria_id:
        return jsonify({'error': 'Nombre y subcategoría son requeridos'}), 400
    subcategoria = Subcategoria.query.get(subcategoria_id)
    if not subcategoria:
        return jsonify({'error': 'Subcategoría no encontrada'}), 404
    if Talla.query.filter_by(nombre=nombre, subcategoria_id=subcategoria_id).first():
        return jsonify({'error': 'Ya existe una talla con ese nombre en esta subcategoría'}), 400
    talla = Talla(nombre=nombre, subcategoria_id=subcategoria_id)
    db.session.add(talla)
    db.session.commit()
    log = Log(accion='CREAR_TALLA', detalle=f'Talla "{nombre}" creada en subcategoría "{subcategoria.nombre}"')
    db.session.add(log)
    db.session.commit()
    return jsonify({'mensaje': 'Talla creada', 'id': talla.id}), 201

@api_bp.route('/tallas/<int:id>', methods=['PUT'])
@login_required
def editar_talla(id):
    talla = Talla.query.get_or_404(id)
    data = request.get_json()
    nombre = data.get('nombre', '').strip()
    subcategoria_id = data.get('subcategoria_id')
    if not nombre:
        return jsonify({'error': 'El nombre es requerido'}), 400
    if subcategoria_id:
        subcategoria = Subcategoria.query.get(subcategoria_id)
        if not subcategoria:
            return jsonify({'error': 'Subcategoría no encontrada'}), 404
        existente = Talla.query.filter_by(nombre=nombre, subcategoria_id=subcategoria_id).first()
        if existente and existente.id != id:
            return jsonify({'error': 'Ya existe una talla con ese nombre en esta subcategoría'}), 400
        talla.subcategoria_id = subcategoria_id
    else:
        existente = Talla.query.filter_by(nombre=nombre, subcategoria_id=talla.subcategoria_id).first()
        if existente and existente.id != id:
            return jsonify({'error': 'Ya existe una talla con ese nombre en esta subcategoría'}), 400
    talla.nombre = nombre
    db.session.commit()
    log = Log(accion='EDITAR_TALLA', detalle=f'Talla "{nombre}" editada')
    db.session.add(log)
    db.session.commit()
    return jsonify({'mensaje': 'Talla actualizada'})

@api_bp.route('/tallas/<int:id>', methods=['DELETE'])
@login_required
def eliminar_talla(id):
    talla = Talla.query.get_or_404(id)
    if talla.productos:
        return jsonify({'error': 'No se puede eliminar: la talla tiene productos asociados'}), 400
    nombre = talla.nombre
    db.session.delete(talla)
    db.session.commit()
    log = Log(accion='ELIMINAR_TALLA', detalle=f'Talla "{nombre}" eliminada')
    db.session.add(log)
    db.session.commit()
    return jsonify({'mensaje': 'Talla eliminada'})

# ============================================================
# API: PRODUCTOS (PROTEGIDA)
# ============================================================

@api_bp.route('/productos', methods=['GET'])
@login_required
def get_productos():
    nombre = request.args.get('nombre', '')
    categoria = request.args.get('categoria')
    subcategoria = request.args.get('subcategoria')
    talla_id = request.args.get('talla')
    marca = request.args.get('marca')
    solo_stock = request.args.get('solo_stock', 'false').lower() == 'true'

    query = Producto.query
    if nombre:
        query = query.filter(Producto.nombre.ilike(f'%{nombre}%'))
    if categoria:
        query = query.filter(Producto.categoria_id == categoria)
    if subcategoria:
        query = query.filter(Producto.subcategoria_id == subcategoria)
    if talla_id:
        query = query.filter(Producto.talla_id == talla_id)
    if marca:
        query = query.filter(Producto.marca_id == marca)
    if solo_stock:
        query = query.filter(Producto.stock > 0)

    productos = query.all()
    result = []
    for p in productos:
        result.append({
            'id': p.id,
            'nombre': p.nombre,
            'descripcion': p.descripcion,
            'marca': p.marca.nombre if p.marca else None,
            'categoria': p.categoria.nombre if p.categoria else None,
            'subcategoria': p.subcategoria.nombre if p.subcategoria else None,
            'talla': p.talla_ref.nombre if p.talla_ref else None,
            'talla_id': p.talla_id,
            'costo_usd': p.costo_usd,
            'precio_usd': p.precio_usd,
            'precio_ves_bcv_usd': p.precio_ves_bcv_usd,
            'precio_ves_bcv_eur': p.precio_ves_bcv_eur,
            'precio_ves_personalizada': p.precio_ves_personalizada,
            'stock': p.stock,
            'control_serial': p.control_serial,
            'serial_number': p.serial_number,
            'fecha_registro': p.fecha_registro.strftime('%Y-%m-%d %H:%M')
        })
    return jsonify(result)

@api_bp.route('/productos/<int:id>', methods=['GET'])
@login_required
def get_producto(id):
    producto = Producto.query.get_or_404(id)
    return jsonify({
        'id': producto.id,
        'nombre': producto.nombre,
        'descripcion': producto.descripcion,
        'marca_id': producto.marca_id,
        'categoria_id': producto.categoria_id,
        'subcategoria_id': producto.subcategoria_id,
        'talla_id': producto.talla_id,
        'costo_usd': producto.costo_usd,
        'precio_usd': producto.precio_usd,
        'precio_ves_bcv_usd': producto.precio_ves_bcv_usd,
        'precio_ves_bcv_eur': producto.precio_ves_bcv_eur,
        'precio_ves_personalizada': producto.precio_ves_personalizada,
        'stock': producto.stock,
        'control_serial': producto.control_serial,
        'serial_number': producto.serial_number,
        'fecha_registro': producto.fecha_registro.strftime('%Y-%m-%d %H:%M')
    })

@api_bp.route('/productos', methods=['POST'])
@login_required
def crear_producto():
    data = request.get_json()
    required = ['nombre', 'precio_usd', 'stock']
    for field in required:
        if field not in data:
            return jsonify({'error': f'Falta campo {field}'}), 400

    nombre = data['nombre'].strip()
    descripcion = data.get('descripcion', '')
    marca_id = data.get('marca_id')
    categoria_id = data.get('categoria_id')
    subcategoria_id = data.get('subcategoria_id')
    talla_id = data.get('talla_id')
    costo_usd = data.get('costo_usd', 0.0)
    precio_usd = float(data['precio_usd'])
    stock = int(data['stock'])
    control_serial = data.get('control_serial', False)
    serial_number = data.get('serial_number', '')

    if not nombre:
        return jsonify({'error': 'El nombre es requerido'}), 400
    if not categoria_id:
        return jsonify({'error': 'La categoría es requerida'}), 400
    if not subcategoria_id:
        return jsonify({'error': 'La subcategoría es requerida'}), 400
    if not marca_id:
        return jsonify({'error': 'La marca es requerida'}), 400
    if not talla_id:
        return jsonify({'error': 'La talla es requerida'}), 400
    if precio_usd <= 0:
        return jsonify({'error': 'El precio debe ser mayor a 0'}), 400
    if stock <= 0:
        return jsonify({'error': 'La cantidad debe ser mayor a 0'}), 400

    filtros = {
        'nombre': nombre,
        'marca_id': marca_id,
        'categoria_id': categoria_id,
        'subcategoria_id': subcategoria_id,
        'talla_id': talla_id
    }
    if control_serial and serial_number:
        filtros['control_serial'] = True
        filtros['serial_number'] = serial_number
    else:
        filtros['control_serial'] = False

    producto_existente = Producto.query.filter_by(**filtros).first()

    if producto_existente:
        # Actualizar stock
        producto_existente.stock += stock
        
        # Actualizar precio
        if producto_existente.precio_usd != precio_usd:
            producto_existente.precio_usd = precio_usd
            precios = calcular_precios_alternativos(precio_usd)
            producto_existente.precio_ves_bcv_usd = precios['ves_bcv_usd']
            producto_existente.precio_ves_bcv_eur = precios['ves_bcv_eur']
            producto_existente.precio_ves_personalizada = precios['ves_personalizada']
        
        # Actualizar costo
        if 'costo_usd' in data:
            nuevo_costo = float(data['costo_usd'])
            if producto_existente.costo_usd != nuevo_costo:
                producto_existente.costo_usd = nuevo_costo
                log = Log(
                    accion='ACTUALIZAR_COSTO',
                    detalle=f'Producto "{nombre}" - Costo actualizado a ${nuevo_costo:.2f} (stock: {producto_existente.stock})'
                )
                db.session.add(log)

        db.session.commit()
        log = Log(
            accion='ENTRADA_ACTUALIZADA',
            detalle=f'Producto "{nombre}" actualizado - Nuevo stock: {producto_existente.stock} (se añadieron {stock})'
        )
        db.session.add(log)
        db.session.commit()

        return jsonify({
            'mensaje': f'✅ Stock actualizado. Nuevo stock total: {producto_existente.stock}',
            'id': producto_existente.id,
            'stock': producto_existente.stock,
            'actualizado': True
        }), 200

    else:
        precios = calcular_precios_alternativos(precio_usd)
        producto = Producto(
            nombre=nombre,
            descripcion=descripcion,
            marca_id=marca_id,
            categoria_id=categoria_id,
            subcategoria_id=subcategoria_id,
            talla_id=talla_id,
            costo_usd=costo_usd,
            precio_usd=precio_usd,
            precio_ves_bcv_usd=precios['ves_bcv_usd'],
            precio_ves_bcv_eur=precios['ves_bcv_eur'],
            precio_ves_personalizada=precios['ves_personalizada'],
            stock=stock,
            control_serial=control_serial,
            serial_number=serial_number if control_serial else ''
        )
        db.session.add(producto)
        db.session.commit()
        log = Log(accion='ENTRADA', detalle=f'Producto "{nombre}" agregado (stock {producto.stock}, costo ${costo_usd:.2f})')
        db.session.add(log)
        db.session.commit()

        return jsonify({
            'mensaje': '✅ Producto registrado exitosamente',
            'id': producto.id,
            'actualizado': False
        }), 201

@api_bp.route('/productos/<int:id>', methods=['PUT'])
@login_required
def actualizar_producto(id):
    producto = Producto.query.get_or_404(id)
    data = request.get_json()
    if 'stock' in data:
        producto.stock = int(data['stock'])
    if 'precio_usd' in data:
        producto.precio_usd = float(data['precio_usd'])
        precios = calcular_precios_alternativos(producto.precio_usd)
        producto.precio_ves_bcv_usd = precios['ves_bcv_usd']
        producto.precio_ves_bcv_eur = precios['ves_bcv_eur']
        producto.precio_ves_personalizada = precios['ves_personalizada']
    if 'nombre' in data:
        producto.nombre = data['nombre']
    if 'marca_id' in data:
        producto.marca_id = data['marca_id']
    if 'categoria_id' in data:
        producto.categoria_id = data['categoria_id']
    if 'subcategoria_id' in data:
        producto.subcategoria_id = data['subcategoria_id']
    if 'talla_id' in data:
        producto.talla_id = data['talla_id']
    if 'costo_usd' in data:
        producto.costo_usd = float(data['costo_usd'])
    if 'control_serial' in data:
        producto.control_serial = data['control_serial']
    if 'serial_number' in data:
        producto.serial_number = data['serial_number']
    db.session.commit()
    return jsonify({'mensaje': 'Producto actualizado'})

@api_bp.route('/productos/<int:id>', methods=['DELETE'])
@login_required
def eliminar_producto(id):
    producto = Producto.query.get_or_404(id)
    db.session.delete(producto)
    db.session.commit()
    return jsonify({'mensaje': 'Producto eliminado'})

# ============================================================
# API: CLIENTES (PROTEGIDA) - MODIFICADO PARA FILTRAR ACTIVOS E INACTIVOS
# ============================================================

@api_bp.route('/clientes', methods=['GET'])
@login_required
def get_clientes():
    """
    Lista clientes según el estado 'activo'.
    - Si se pasa 'activo=true' o no se pasa el parámetro, devuelve solo activos.
    - Si se pasa 'activo=false', devuelve solo inactivos.
    """
    es_fijo = request.args.get('es_fijo')
    activo_param = request.args.get('activo', 'true').lower()
    
    # Determinar filtro de activo
    if activo_param == 'true':
        query = Cliente.query.filter_by(activo=True)
    elif activo_param == 'false':
        query = Cliente.query.filter_by(activo=False)
    else:
        # Por defecto, mostrar activos
        query = Cliente.query.filter_by(activo=True)
    
    if es_fijo is not None:
        query = query.filter_by(es_fijo=es_fijo.lower() == 'true')
    
    clientes = query.all()
    return jsonify([{
        'id': c.id,
        'nombre': c.nombre,
        'apellido': c.apellido,
        'cedula': c.cedula,
        'direccion': c.direccion,
        'telefono': c.telefono,
        'limite_credito': c.limite_credito,
        'saldo_deudor': c.saldo_deudor,
        'es_fijo': c.es_fijo,
        'activo': c.activo
    } for c in clientes])

# ============================================================
# ⭐ FUNCIÓN CREAR CLIENTE (MODIFICADA – EVITA DUPLICADOS)
# ============================================================

@api_bp.route('/clientes', methods=['POST'])
@login_required
def crear_cliente():
    data = request.get_json()
    cedula = data.get('cedula', '').strip()
    nombre = data.get('nombre', '').strip()
    apellido = data.get('apellido', '').strip()
    direccion = data.get('direccion', '')
    telefono = data.get('telefono', '')
    es_fijo = data.get('es_fijo', False)
    limite_credito = float(data.get('limite_credito', 0))
    
    # Validar campos obligatorios
    if not nombre or not apellido or not cedula:
        return jsonify({'error': 'Nombre, apellido y cédula son obligatorios'}), 400
    
    # Buscar si ya existe un cliente con esa cédula
    cliente_existente = Cliente.query.filter_by(cedula=cedula).first()
    
    if cliente_existente:
        # Si ya existe, actualizar a fijo (si no lo era)
        if not cliente_existente.es_fijo:
            cliente_existente.es_fijo = True
            db.session.commit()
            return jsonify({
                'mensaje': f'✅ El cliente {nombre} {apellido} ya existía y ahora es un cliente fijo.',
                'id': cliente_existente.id,
                'actualizado': True
            }), 200
        else:
            return jsonify({
                'mensaje': f'ℹ️ El cliente {nombre} {apellido} ya es un cliente fijo.',
                'id': cliente_existente.id,
                'actualizado': False
            }), 200
    else:
        # Crear nuevo cliente (por defecto activo=True, es_fijo=es_fijo)
        cliente = Cliente(
            nombre=nombre,
            apellido=apellido,
            cedula=cedula,
            direccion=direccion,
            telefono=telefono,
            limite_credito=limite_credito,
            saldo_deudor=0.0,
            es_fijo=es_fijo,
            activo=True  # 🔥 NUEVO: siempre activo al crear
        )
        db.session.add(cliente)
        db.session.commit()
        log = Log(accion='CLIENTE_CREADO', detalle=f'Cliente fijo "{nombre} {apellido}" registrado')
        db.session.add(log)
        db.session.commit()
        return jsonify({
            'mensaje': '✅ Cliente fijo registrado exitosamente',
            'id': cliente.id,
            'actualizado': False
        }), 201

@api_bp.route('/clientes/<int:id>', methods=['PUT'])
@login_required
def actualizar_cliente(id):
    cliente = Cliente.query.get_or_404(id)
    data = request.get_json()
    if 'nombre' in data:
        cliente.nombre = data['nombre']
    if 'apellido' in data:
        cliente.apellido = data['apellido']
    if 'cedula' in data:
        cliente.cedula = data['cedula']
    if 'direccion' in data:
        cliente.direccion = data['direccion']
    if 'telefono' in data:
        cliente.telefono = data['telefono']
    if 'limite_credito' in data:
        cliente.limite_credito = float(data['limite_credito'])
    if 'es_fijo' in data:
        cliente.es_fijo = data['es_fijo']
    if 'activo' in data:  # 🔥 Permitir reactivar/desactivar desde edición (opcional)
        cliente.activo = data['activo']
    db.session.commit()
    return jsonify({'mensaje': 'Cliente actualizado'})

# ============================================================
# 🔥 CORRECCIÓN: ELIMINAR CLIENTE (DESACTIVACIÓN LÓGICA)
# ============================================================
@api_bp.route('/clientes/<int:id>', methods=['DELETE'])
@login_required
def eliminar_cliente(id):
    cliente = Cliente.query.get_or_404(id)
    
    # ============================================================
    # 1. VALIDACIÓN: APARTADOS ACTIVOS CON SALDO PENDIENTE
    # ============================================================
    apartados_activos = Apartado.query.filter_by(cliente_id=id, estado='activo').all()
    apartados_con_saldo = [a for a in apartados_activos if a.saldo_restante > 0]
    
    if apartados_con_saldo:
        detalles = []
        for a in apartados_con_saldo:
            detalles.append(f"#{a.id} (${a.saldo_restante:.2f} pendiente)")
        return jsonify({
            'error': f'No se puede desactivar el cliente porque tiene apartados activos con saldo pendiente: {", ".join(detalles)}. '
                     'Primero debe finalizar o cancelar estos apartados.'
        }), 400
    
    # ============================================================
    # 2. DESACTIVACIÓN LÓGICA (sin reasignación)
    # ============================================================
    try:
        cliente.activo = False
        db.session.commit()
        
        # Registrar log
        log = Log(accion='CLIENTE_DESACTIVADO', detalle=f'Cliente {cliente.nombre} {cliente.apellido} (ID {cliente.id}) desactivado.')
        db.session.add(log)
        db.session.commit()
        
        return jsonify({'mensaje': 'Cliente desactivado correctamente (no se borraron datos históricos).'})
    except Exception as e:
        db.session.rollback()
        print(f"❌ Error al desactivar cliente {id}: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Error al desactivar el cliente: {str(e)}'}), 500

# ============================================================
# 🔥 NUEVO ENDPOINT: DESACTIVAR CLIENTE (PUT explícito)
# ============================================================
@api_bp.route('/clientes/<int:id>/desactivar', methods=['PUT'])
@login_required
def desactivar_cliente(id):
    """Desactiva un cliente (activo=False) si no tiene apartados con saldo pendiente."""
    cliente = Cliente.query.get_or_404(id)
    
    # Validar que no tenga apartados activos con saldo
    apartados_activos = Apartado.query.filter_by(cliente_id=id, estado='activo').all()
    apartados_con_saldo = [a for a in apartados_activos if a.saldo_restante > 0]
    if apartados_con_saldo:
        detalles = [f"#{a.id} (${a.saldo_restante:.2f} pendiente)" for a in apartados_con_saldo]
        return jsonify({
            'error': f'No se puede desactivar el cliente porque tiene apartados activos con saldo pendiente: {", ".join(detalles)}.'
        }), 400

    # Desactivar
    cliente.activo = False
    db.session.commit()
    
    log = Log(accion='CLIENTE_DESACTIVADO', 
              detalle=f'Cliente {cliente.nombre} {cliente.apellido} (ID {cliente.id}) desactivado vía /desactivar.')
    db.session.add(log)
    db.session.commit()
    
    return jsonify({'mensaje': 'Cliente desactivado correctamente.'}), 200

# ============================================================
# 🔥 NUEVO ENDPOINT: REACTIVAR CLIENTE (PUT)
# ============================================================
@api_bp.route('/clientes/<int:id>/reactivar', methods=['PUT'])
@login_required
def reactivar_cliente(id):
    """Reactivar un cliente (activo=True). No tiene restricciones adicionales."""
    cliente = Cliente.query.get_or_404(id)
    cliente.activo = True
    db.session.commit()
    
    log = Log(accion='CLIENTE_REACTIVADO', 
              detalle=f'Cliente {cliente.nombre} {cliente.apellido} (ID {cliente.id}) reactivado.')
    db.session.add(log)
    db.session.commit()
    
    return jsonify({'mensaje': 'Cliente reactivado correctamente.'}), 200

# ============================================================
# API: VENTAS (PROTEGIDA) - CORREGIDO: TOTAL VES = SUBTOTAL + IVA
# 🔥 MODIFICADO: uso de obtener_proximo_numero_ticket() (secuencia estricta)
# 🔥 MODIFICADO: lógica mejorada para asignar cliente basado en datos del formulario
# ============================================================

@api_bp.route('/ventas', methods=['POST'])
@login_required
def registrar_venta():
    data = request.get_json()
    cliente_id = data.get('cliente_id')
    items = data.get('items', [])
    metodo_pago = data.get('metodo_pago', 'Efectivo')
    metodo_cobro = data.get('metodo_cobro', 'usd')
    es_apartado = data.get('es_apartado', False)
    apartado_id = data.get('apartado_id')

    if not items:
        return jsonify({'error': 'El carrito está vacío'}), 400

    # ============================================================
    # 🔥 NUEVA LÓGICA: Usar los datos del formulario para obtener/crear el cliente
    # ============================================================
    cliente_nombre_form = data.get('cliente_nombre', '').strip()
    cliente_apellido_form = data.get('cliente_apellido', '').strip()
    cliente_cedula_form = data.get('cliente_cedula', '').strip()
    cliente_telefono_form = data.get('cliente_telefono', '').strip()
    cliente_direccion_form = data.get('cliente_direccion', '').strip()

    # Si se enviaron nombre y cédula, buscar o crear cliente por cédula
    if cliente_nombre_form and cliente_cedula_form:
        # Buscar cliente existente por cédula
        cliente = Cliente.query.filter_by(cedula=cliente_cedula_form).first()
        if cliente:
            # Actualizar datos del cliente con la información del formulario
            if cliente.nombre != cliente_nombre_form or cliente.apellido != cliente_apellido_form:
                cliente.nombre = cliente_nombre_form
                cliente.apellido = cliente_apellido_form
            if cliente_telefono_form and cliente.telefono != cliente_telefono_form:
                cliente.telefono = cliente_telefono_form
            if cliente_direccion_form and cliente.direccion != cliente_direccion_form:
                cliente.direccion = cliente_direccion_form
            db.session.commit()
        else:
            # Crear cliente genérico (no fijo) con los datos del formulario
            cliente = Cliente(
                nombre=cliente_nombre_form,
                apellido=cliente_apellido_form or '',
                cedula=cliente_cedula_form,
                direccion=cliente_direccion_form,
                telefono=cliente_telefono_form,
                limite_credito=0,
                saldo_deudor=0,
                es_fijo=False,
                activo=True
            )
            db.session.add(cliente)
            db.session.commit()
        # Sobrescribir cliente_id con el ID encontrado/creado
        cliente_id = cliente.id
    else:
        # Si no se enviaron datos del cliente, usar el cliente_id recibido (puede ser None)
        # Si cliente_id es None, se asigna un cliente genérico o se deja NULL
        if cliente_id is None:
            # Intentar obtener cliente genérico o crear uno
            cliente = Cliente.query.filter_by(cedula='00000000').first()
            if not cliente:
                cliente = Cliente(
                    nombre='Consumidor',
                    apellido='Final',
                    cedula='00000000',
                    direccion='',
                    telefono='',
                    limite_credito=0,
                    saldo_deudor=0,
                    es_fijo=False,
                    activo=True
                )
                db.session.add(cliente)
                db.session.commit()
            cliente_id = cliente.id
        else:
            # Verificar que el cliente existe
            cliente = Cliente.query.get(cliente_id)
            if not cliente:
                return jsonify({'error': 'Cliente no encontrado'}), 404

    # 🔥 NUEVO: Obtener el próximo número de ticket (secuencia estricta)
    nuevo_ticket = obtener_proximo_numero_ticket()
    
    # Opcional: actualizar Configuracion para compatibilidad
    config = Configuracion.query.filter_by(clave='ultimo_ticket').first()
    if config:
        config.valor = str(nuevo_ticket)
    else:
        config = Configuracion(clave='ultimo_ticket', valor=str(nuevo_ticket))
        db.session.add(config)
    db.session.commit()

    tasas = obtener_tasas_bcv()
    tasa_personalizada = obtener_tasa_personalizada()
    tasa_usd = tasas['usd']
    tasa_eur = tasas['eur']

    # Calcular subtotal original en USD sin ajustes
    subtotal_usd = 0.0
    items_data = []
    for item in items:
        producto = Producto.query.get(item['producto_id'])
        if not producto:
            return jsonify({'error': f'Producto {item["producto_id"]} no existe'}), 400
        if producto.stock < item['cantidad']:
            return jsonify({'error': f'Stock insuficiente para {producto.nombre}'}), 400

        descuento_porcentaje = item.get('descuento_porcentaje', 0)
        if descuento_porcentaje is None:
            descuento_porcentaje = 0
        descuento_porcentaje = float(descuento_porcentaje)

        precio_base_usd = producto.precio_usd
        precio_final_usd = precio_base_usd * (1 - descuento_porcentaje / 100)
        precio_final_usd = round(precio_final_usd, 2)

        subtotal_usd += precio_final_usd * item['cantidad']

        items_data.append({
            'producto': producto,
            'cantidad': item['cantidad'],
            'descuento_porcentaje': descuento_porcentaje,
            'precio_base_usd': precio_base_usd,
            'precio_final_usd': precio_final_usd
        })

    # --- DETERMINAR MONEDA, TASA Y TOTAL COBRO ---
    if metodo_cobro == 'usd':
        tasa_aplicada = 1.0
        moneda_cobro = 'USD'
        total_cobro = subtotal_usd
        subtotal_ves = subtotal_usd * tasa_usd
        factor_ajuste = 1.0
    elif metodo_cobro == 'bcv_usd':
        tasa_aplicada = tasa_usd
        moneda_cobro = 'VES'
        total_cobro = subtotal_usd * tasa_usd
        subtotal_ves = total_cobro
        factor_ajuste = 1.0
    elif metodo_cobro == 'bcv_eur':
        tasa_aplicada = tasa_eur
        moneda_cobro = 'VES'
        total_cobro = subtotal_usd * tasa_eur
        subtotal_ves = total_cobro
        factor_ajuste = 1.0
    elif metodo_cobro == 'personalizada':
        tasa_aplicada = tasa_personalizada
        moneda_cobro = 'VES'
        total_cobro = subtotal_usd * tasa_personalizada
        subtotal_ves = total_cobro
        factor_ajuste = 1.0
    elif metodo_cobro == 'bs_personalizado':
        total_cobro = data.get('total_cobro', subtotal_usd * tasa_personalizada)
        tasa_aplicada = total_cobro / subtotal_usd if subtotal_usd > 0 else tasa_personalizada
        moneda_cobro = 'VES'
        subtotal_ves = total_cobro
        factor_ajuste = total_cobro / subtotal_usd if subtotal_usd > 0 else 1.0
    elif metodo_cobro == 'usd_personalizado':
        total_cobro = data.get('total_cobro', subtotal_usd)
        factor_ajuste = total_cobro / subtotal_usd if subtotal_usd > 0 else 1.0
        tasa_aplicada = 1.0
        moneda_cobro = 'USD'
        subtotal_ves = total_cobro * tasa_usd
    else:
        tasa_aplicada = 1.0
        moneda_cobro = 'USD'
        total_cobro = subtotal_usd
        subtotal_ves = subtotal_usd * tasa_usd
        factor_ajuste = 1.0

    # ============================================================
    # 🔥 CORRECCIÓN IVA: Obtener porcentaje y calcular total con IVA
    # ============================================================
    iva_porcentaje_cfg = Configuracion.query.filter_by(clave='ticket_iva_porcentaje').first()
    iva_porcentaje = float(iva_porcentaje_cfg.valor if iva_porcentaje_cfg else 0)

    if iva_porcentaje > 0:
        monto_iva_ves = subtotal_ves * (iva_porcentaje / 100)
        total_ves_final = subtotal_ves + monto_iva_ves
    else:
        total_ves_final = subtotal_ves

    # Si el método de cobro es en VES, el total_cobro debe ser total_ves_final
    if moneda_cobro == 'VES':
        total_cobro = total_ves_final

    # Crear la venta
    venta = Venta(
        cliente_id=cliente_id,
        numero_ticket=nuevo_ticket,
        total_usd=subtotal_usd,
        total_ves=total_ves_final,  # ← AHORA CON IVA INCLUIDO
        total_eur=subtotal_usd * tasa_eur,
        tasa_bcv_usd=tasa_usd,
        tasa_bcv_eur=tasa_eur,
        tasa_personalizada=tasa_personalizada,
        metodo_pago=metodo_pago,
        metodo_cobro=metodo_cobro,
        tasa_aplicada=tasa_aplicada,
        moneda_cobro=moneda_cobro,
        total_cobro=total_cobro,   # ← AHORA CON IVA INCLUIDO si es VES
        subtotal_usd=subtotal_usd,
        subtotal_ves=subtotal_ves,  # ← BASE IMPONIBLE SIN IVA
        es_apartado=es_apartado,
        apartado_id=apartado_id,
        anulado=False  # 🔥 NUEVO: por defecto no anulada
    )
    db.session.add(venta)
    db.session.flush()

    # Guardar detalles con precios ajustados
    for item_data in items_data:
        producto = item_data['producto']
        cantidad = item_data['cantidad']
        descuento = item_data['descuento_porcentaje']
        precio_base = item_data['precio_base_usd']
        precio_final = item_data['precio_final_usd']

        precio_unitario_usd_ajustado = precio_final * factor_ajuste
        precio_unitario_usd_ajustado = round(precio_unitario_usd_ajustado, 2)

        if moneda_cobro == 'VES':
            if metodo_cobro in ['personalizada', 'bs_personalizado']:
                proporcion = precio_final / subtotal_usd if subtotal_usd > 0 else 0
                precio_ves_unitario = total_cobro * proporcion
                precio_ves_unitario = round(precio_ves_unitario, 2)
            else:
                precio_ves_unitario = precio_unitario_usd_ajustado * tasa_aplicada
                precio_ves_unitario = round(precio_ves_unitario, 2)
            precio_unitario_usd_ajustado = round(precio_ves_unitario / tasa_usd, 2) if tasa_usd > 0 else precio_unitario_usd_ajustado
        else:
            precio_ves_unitario = precio_unitario_usd_ajustado * tasa_usd
            precio_ves_unitario = round(precio_ves_unitario, 2)

        producto.stock -= cantidad
        db.session.add(producto)

        detalle = DetalleVenta(
            venta_id=venta.id,
            producto_id=producto.id,
            cantidad=cantidad,
            precio_unitario_usd=precio_unitario_usd_ajustado,
            precio_unitario_ves=precio_ves_unitario,
            descuento_porcentaje=descuento,
            precio_original_usd=precio_base
        )
        db.session.add(detalle)

    # Recalcular totales USD basados en los precios ajustados de los detalles
    total_usd_ajustado = sum(d.precio_unitario_usd * d.cantidad for d in venta.detalles)
    venta.total_usd = round(total_usd_ajustado, 2)
    venta.subtotal_usd = round(total_usd_ajustado, 2)

    db.session.commit()

    log = Log(accion='VENTA', detalle=f'Venta #{venta.id} - Ticket {nuevo_ticket} - Total {moneda_cobro} {total_cobro:.2f}')
    db.session.add(log)
    db.session.commit()

    ticket_path = f'tickets/ticket_{venta.id}.png'
    venta.ticket_imagen = ticket_path
    db.session.commit()

    # ============================================================
    # 🔥 IMPRESIÓN AUTOMÁTICA CON NUEVO GENERADOR POS-58 (FECHA LOCAL)
    # ============================================================
    try:
        config_imp = ConfiguracionImpresora.query.first()
        max_chars = 32 if (config_imp and config_imp.tamano_papel == '58mm') else 42

        # Obtener configuración del ticket virtual
        claves_ticket = [
            'ticket_tienda_nombre', 'ticket_rif', 'ticket_telefono_tienda', 'ticket_direccion_tienda',
            'ticket_mostrar_rif', 'ticket_mostrar_telefono', 'ticket_mostrar_direccion_cliente',
            'ticket_mostrar_direccion_tienda', 'ticket_mensaje', 'ticket_url',
            'ticket_subtotal_usd', 'ticket_iva_porcentaje'
        ]
        configs_ticket = {}
        for clave in claves_ticket:
            cfg = Configuracion.query.filter_by(clave=clave).first()
            configs_ticket[clave] = cfg.valor if cfg else None

        config_ticket = {
            'nombre_tienda': configs_ticket.get('ticket_tienda_nombre', 'ELEMENTS STORE'),
            'rif': configs_ticket.get('ticket_rif', ''),
            'telefono_tienda': configs_ticket.get('ticket_telefono_tienda', ''),
            'direccion_tienda': configs_ticket.get('ticket_direccion_tienda', ''),
            'mostrar_rif': configs_ticket.get('ticket_mostrar_rif', 'true').lower() == 'true',
            'mostrar_telefono': configs_ticket.get('ticket_mostrar_telefono', 'true').lower() == 'true',
            'mostrar_direccion_tienda': configs_ticket.get('ticket_mostrar_direccion_tienda', 'true').lower() == 'true',
            'mostrar_direccion_cliente': configs_ticket.get('ticket_mostrar_direccion_cliente', 'true').lower() == 'true',
            'mostrar_subtotal_usd': configs_ticket.get('ticket_subtotal_usd', 'false').lower() == 'true',
            'porcentaje_iva': float(configs_ticket.get('ticket_iva_porcentaje', '0') or '0'),
            'mensaje_agradecimiento': configs_ticket.get('ticket_mensaje', '¡Gracias por su compra!'),
            'url_web': configs_ticket.get('ticket_url', 'www.elementsstore.com')
        }

        # ============================================================
        # 🔥 OBTENER DATOS DEL CLIENTE DESDE EL JSON (prioridad) O DE LA BD
        # ============================================================
        cliente = venta.cliente
        cliente_nombre = data.get('cliente_nombre', '').strip()
        cliente_cedula = data.get('cliente_cedula', '').strip()
        cliente_telefono = data.get('cliente_telefono', '').strip()
        cliente_direccion = data.get('cliente_direccion', '').strip()

        if not cliente_nombre:
            cliente_nombre = f"{cliente.nombre} {cliente.apellido}" if cliente else "Consumidor Final"
        if not cliente_cedula:
            cliente_cedula = cliente.cedula if cliente else ""
        if not cliente_telefono:
            cliente_telefono = cliente.telefono if cliente else ""
        if not cliente_direccion:
            cliente_direccion = cliente.direccion if cliente else ""

        detalles = DetalleVenta.query.filter_by(venta_id=venta.id).all()

        # 🔥 CONVERTIR FECHA A LOCAL
        if venta.fecha.tzinfo is None:
            fecha_utc = pytz.UTC.localize(venta.fecha)
            fecha_local = fecha_utc.astimezone(pytz.timezone('America/Caracas'))
        else:
            fecha_local = venta.fecha.astimezone(pytz.timezone('America/Caracas'))
        fecha_12h = fecha_local.strftime('%d/%m/%Y %I:%M %p')

        datos_venta = {
            'num_nota': f"{venta.numero_ticket:05d}",
            'fecha_hora_12h': fecha_12h,
            'fecha_hora': venta.fecha.strftime('%d/%m/%Y %H:%M'),
            'cliente_nombre': sanitizar_texto(cliente_nombre),
            'cliente_cedula': sanitizar_texto(cliente_cedula),
            'cliente_telefono': sanitizar_texto(cliente_telefono),
            'cliente_direccion': sanitizar_texto(cliente_direccion),
            'productos': [],
            'subtotal_usd': venta.subtotal_usd or 0.0,
            'total_usd': venta.total_usd or 0.0,
            'subtotal_ves': venta.subtotal_ves or 0.0,
            'tasa_bcv': venta.tasa_bcv_usd or 0.0,
            'modo_pago': venta.metodo_pago or 'Efectivo'
        }
        for det in detalles:
            producto = det.producto
            datos_venta['productos'].append({
                'nombre': producto.nombre if producto else "Producto eliminado",
                'cantidad': det.cantidad,
                'precio_unitario': det.precio_unitario_usd,
                'total': det.precio_unitario_usd * det.cantidad,
                'descuento_porcentaje': det.descuento_porcentaje or 0
            })

        texto_ticket = generar_ticket_pos58(datos_venta, config_ticket, max_chars)

        if config_imp and config_imp.nombre_impresora:
            imprimir_ticket(texto_ticket, config_imp.nombre_impresora, copias=config_imp.copias or 1, cortar=config_imp.cortar_auto)
            print(f"✅ Ticket POS-58 impreso para venta #{venta.id}")
    except Exception as e:
        print(f"⚠️ Error al imprimir ticket automático (POS-58): {e}")

    return jsonify({
        'mensaje': 'Venta registrada',
        'venta_id': venta.id,
        'numero_ticket': nuevo_ticket,
        'total_usd': venta.total_usd,
        'total_ves': venta.total_ves,
        'total_eur': venta.total_eur,
        'metodo_cobro': metodo_cobro,
        'moneda_cobro': moneda_cobro,
        'total_cobro': total_cobro,
        'ticket': ticket_path
    }), 201

# ============================================================
# API: LISTAR VENTAS (PROTEGIDA) - 🔥 CORRECCIÓN ZONA HORARIA Y FILTRO ANULADAS
# ============================================================

@api_bp.route('/ventas', methods=['GET'])
@login_required
def listar_ventas():
    numero_ticket = request.args.get('numero_ticket')
    fecha_desde = request.args.get('fecha_desde')
    fecha_hasta = request.args.get('fecha_hasta')
    incluir_anulados = request.args.get('incluir_anulados', 'false').lower() == 'true'

    query = Venta.query
    # 🔥 FILTRO: por defecto excluir anuladas
    if not incluir_anulados:
        query = query.filter(Venta.anulado == False)

    if numero_ticket:
        try:
            num = int(numero_ticket)
            query = query.filter(Venta.numero_ticket == num)
        except ValueError:
            return jsonify({'error': 'Número de ticket inválido'}), 400

    if fecha_desde:
        try:
            desde = datetime.strptime(fecha_desde, '%Y-%m-%d')
            query = query.filter(Venta.fecha >= desde)
        except ValueError:
            return jsonify({'error': 'Formato de fecha desde inválido (YYYY-MM-DD)'}), 400

    if fecha_hasta:
        try:
            hasta = datetime.strptime(fecha_hasta, '%Y-%m-%d') + timedelta(days=1)
            query = query.filter(Venta.fecha < hasta)
        except ValueError:
            return jsonify({'error': 'Formato de fecha hasta inválido (YYYY-MM-DD)'}), 400

    ventas = query.order_by(Venta.fecha.desc()).all()

    result = []
    for v in ventas:
        cliente = v.cliente
        # 🔥 CORRECCIÓN: Convertir fecha a hora local de Venezuela (forzando UTC)
        if v.fecha.tzinfo is None:
            fecha_utc = pytz.UTC.localize(v.fecha)
            fecha_local = fecha_utc.astimezone(pytz.timezone('America/Caracas'))
        else:
            fecha_local = v.fecha.astimezone(pytz.timezone('America/Caracas'))
        result.append({
            'id': v.id,
            'numero_ticket': v.numero_ticket,
            'fecha': fecha_local.strftime('%Y-%m-%d %H:%M:%S'),
            'cliente': f"{cliente.nombre} {cliente.apellido}" if cliente else "Consumidor Final",
            'cedula': cliente.cedula if cliente else "",
            'total_usd': v.total_usd,
            'total_ves': v.total_ves,
            'metodo_pago': v.metodo_pago,
            'metodo_cobro': v.metodo_cobro,
            'moneda_cobro': v.moneda_cobro,
            'total_cobro': v.total_cobro,
            'ticket_imagen': v.ticket_imagen,
            'es_apartado': v.es_apartado,
            'anulado': v.anulado  # 🔥 NUEVO
        })
    return jsonify(result)

# ============================================================
# API: DETALLE VENTA (PROTEGIDA) - 🔥 CORRECCIÓN ZONA HORARIA
# ============================================================

@api_bp.route('/ventas/<int:venta_id>', methods=['GET'])
@login_required
def detalle_venta(venta_id):
    venta = Venta.query.get_or_404(venta_id)
    detalles = DetalleVenta.query.filter_by(venta_id=venta_id).all()

    cliente = venta.cliente
    items = []
    for detalle in detalles:
        producto = detalle.producto
        items.append({
            'producto_nombre': producto.nombre if producto else "Producto eliminado",
            'cantidad': detalle.cantidad,
            'precio_unitario_usd': detalle.precio_unitario_usd,
            'precio_unitario_ves': detalle.precio_unitario_ves,
            'descuento_porcentaje': detalle.descuento_porcentaje or 0,
            'precio_original_usd': detalle.precio_original_usd or detalle.precio_unitario_usd,
            'subtotal_usd': detalle.precio_unitario_usd * detalle.cantidad,
            'subtotal_ves': detalle.precio_unitario_ves * detalle.cantidad
        })

    # 🔥 CORRECCIÓN: Convertir fecha a hora local de Venezuela (forzando UTC)
    if venta.fecha.tzinfo is None:
        fecha_utc = pytz.UTC.localize(venta.fecha)
        fecha_local = fecha_utc.astimezone(pytz.timezone('America/Caracas'))
    else:
        fecha_local = venta.fecha.astimezone(pytz.timezone('America/Caracas'))

    return jsonify({
        'id': venta.id,
        'numero_ticket': venta.numero_ticket,
        'fecha': fecha_local.strftime('%Y-%m-%d %H:%M:%S'),
        'cliente': f"{cliente.nombre} {cliente.apellido}" if cliente else "Consumidor Final",
        'cedula': cliente.cedula if cliente else "",
        'telefono': cliente.telefono if cliente else "",
        'direccion': cliente.direccion if cliente else "",
        'metodo_pago': venta.metodo_pago,
        'metodo_cobro': venta.metodo_cobro,
        'moneda_cobro': venta.moneda_cobro,
        'tasa_aplicada': venta.tasa_aplicada,
        'subtotal_usd': venta.subtotal_usd,
        'subtotal_ves': venta.subtotal_ves,
        'total_usd': venta.total_usd,
        'total_ves': venta.total_ves,
        'total_cobro': venta.total_cobro,
        'ticket_imagen': venta.ticket_imagen,
        'es_apartado': venta.es_apartado,
        'anulado': venta.anulado,  # 🔥 NUEVO
        'items': items
    })

# ============================================================
# 🔥 NUEVO ENDPOINT: ANULAR VENTA (con reintegro de stock)
# ============================================================
@api_bp.route('/ventas/<int:venta_id>/anular', methods=['POST'])
@login_required
def anular_venta(venta_id):
    """Anula una venta: marca como anulada, reintegra stock y registra log."""
    venta = Venta.query.get_or_404(venta_id)
    
    if venta.anulado:
        return jsonify({'error': 'La venta ya está anulada'}), 400
    
    # Reintegrar stock de cada producto (solo si no es apartado, porque el apartado ya gestiona su stock)
    detalles = DetalleVenta.query.filter_by(venta_id=venta_id).all()
    for detalle in detalles:
        producto = Producto.query.get(detalle.producto_id)
        if producto and not venta.es_apartado:
            producto.stock += detalle.cantidad
            db.session.add(producto)
    
    # Marcar como anulada
    venta.anulado = True
    venta.fecha_anulacion = now_venezuela()
    
    # Registrar log
    log = Log(
        accion='ANULAR_VENTA',
        detalle=f'Venta #{venta_id} (Ticket {venta.numero_ticket}) anulada. Stock reintegrado.'
    )
    db.session.add(log)
    
    db.session.commit()
    
    return jsonify({
        'mensaje': f'Venta #{venta_id} anulada correctamente. Stock reintegrado.'
    }), 200

# ============================================================
# 🔥 NUEVO: ELIMINAR VENTA (DELETE) - se mantiene como estaba
# ============================================================
@api_bp.route('/ventas/<int:venta_id>', methods=['DELETE'])
@login_required
def eliminar_venta(venta_id):
    """Elimina una venta y sus detalles, reintegrando el stock al inventario.
       Si la venta proviene de un apartado, no se reintegra stock adicional.
       La acción es irreversible y se registra en logs.
    """
    venta = Venta.query.get_or_404(venta_id)
    
    # Obtener los detalles de la venta
    detalles = DetalleVenta.query.filter_by(venta_id=venta_id).all()
    
    # Reintegrar stock de cada producto (solo si no es apartado, porque el apartado ya gestiona su stock)
    for detalle in detalles:
        producto = Producto.query.get(detalle.producto_id)
        if producto and not venta.es_apartado:
            producto.stock += detalle.cantidad
            db.session.add(producto)
    
    # Eliminar los detalles de la venta
    for detalle in detalles:
        db.session.delete(detalle)
    
    # Eliminar la venta
    db.session.delete(venta)
    
    # Registrar log
    log = Log(
        accion='ELIMINAR_VENTA',
        detalle=f'Venta #{venta_id} (Ticket {venta.numero_ticket}) eliminada. Stock reintegrado (si aplica).'
    )
    db.session.add(log)
    
    db.session.commit()
    
    return jsonify({
        'mensaje': f'Venta #{venta_id} eliminada correctamente. Stock reintegrado.'
    }), 200

# ============================================================
# API: HISTORIAL DE VENTAS DE PRODUCTO (PROTEGIDA)
# ============================================================

@api_bp.route('/productos/<int:producto_id>/ventas', methods=['GET'])
@login_required
def historial_ventas_producto(producto_id):
    producto = Producto.query.get_or_404(producto_id)
    detalles = DetalleVenta.query.filter_by(producto_id=producto_id).order_by(DetalleVenta.venta_id.desc()).all()

    result = []
    for detalle in detalles:
        venta = detalle.venta
        if not venta:
            continue
        cliente = venta.cliente
        cliente_nombre = f"{cliente.nombre} {cliente.apellido}" if cliente else "Cliente eliminado"
        cliente_cedula = cliente.cedula if cliente else "N/A"

        result.append({
            'venta_id': venta.id,
            'fecha': venta.fecha.strftime('%Y-%m-%d %H:%M'),
            'cliente': cliente_nombre,
            'cedula': cliente_cedula,
            'cantidad': detalle.cantidad,
            'precio_unitario_usd': detalle.precio_unitario_usd,
            'precio_unitario_ves': detalle.precio_unitario_ves,
            'metodo_pago': venta.metodo_pago,
            'metodo_cobro': venta.metodo_cobro,
            'tasa_aplicada': venta.tasa_aplicada,
            'moneda_cobro': venta.moneda_cobro,
            'total_cobro': venta.total_cobro,
            'subtotal_usd': venta.subtotal_usd,
            'subtotal_ves': venta.subtotal_ves,
            'total_venta_usd': venta.total_usd,
            'total_venta_ves': venta.total_ves,
            'descuento_porcentaje': detalle.descuento_porcentaje if detalle.descuento_porcentaje is not None else 0,
            'precio_original_usd': detalle.precio_original_usd if detalle.precio_original_usd is not None else detalle.precio_unitario_usd,
            'es_apartado': venta.es_apartado,
            'anulado': venta.anulado  # 🔥 NUEVO
        })

    return jsonify(result)

# ============================================================
# API: CONFIGURACIÓN DEL TICKET (PROTEGIDA)
# ============================================================

@api_bp.route('/config/ticket', methods=['GET'])
@login_required
def get_config_ticket():
    claves = [
        'ticket_tienda_nombre', 'ticket_rif', 'ticket_telefono_tienda', 'ticket_direccion_tienda',
        'ticket_mostrar_rif', 'ticket_mostrar_telefono', 'ticket_mostrar_direccion_cliente', 'ticket_mostrar_direccion_tienda',
        'ticket_mensaje', 'ticket_url', 'ticket_subtotal_usd', 'ticket_iva_porcentaje'
    ]
    configs = Configuracion.query.filter(Configuracion.clave.in_(claves)).all()
    
    result = {
        'ticket_tienda_nombre': 'ELEMENTS STORE',
        'ticket_rif': 'J-12345678-9',
        'ticket_telefono_tienda': '0412-1234567',
        'ticket_direccion_tienda': 'Calle Principal, Local 1, Ciudad',
        'ticket_mostrar_rif': 'true',
        'ticket_mostrar_telefono': 'true',
        'ticket_mostrar_direccion_cliente': 'true',
        'ticket_mostrar_direccion_tienda': 'true',
        'ticket_mensaje': '¡Gracias por su compra!',
        'ticket_url': 'www.elementsstore.com',
        'ticket_subtotal_usd': 'true',
        'ticket_iva_porcentaje': '0'
    }
    
    for c in configs:
        result[c.clave] = c.valor
    
    return jsonify(result)

@api_bp.route('/config/ticket', methods=['POST'])
@login_required
def set_config_ticket():
    data = request.get_json()
    allowed_keys = [
        'ticket_tienda_nombre', 'ticket_rif', 'ticket_telefono_tienda', 'ticket_direccion_tienda',
        'ticket_mostrar_rif', 'ticket_mostrar_telefono', 'ticket_mostrar_direccion_cliente', 'ticket_mostrar_direccion_tienda',
        'ticket_mensaje', 'ticket_url', 'ticket_subtotal_usd', 'ticket_iva_porcentaje'
    ]
    
    for clave, valor in data.items():
        if clave in allowed_keys:
            config = Configuracion.query.filter_by(clave=clave).first()
            if config:
                config.valor = str(valor)
            else:
                config = Configuracion(clave=clave, valor=str(valor))
                db.session.add(config)
    
    db.session.commit()
    return jsonify({'mensaje': 'Configuración guardada correctamente'})

# ============================================================
# API: GENERAR TICKET IMAGEN (PROTEGIDA) - 🔥 CORRECCIÓN ZONA HORARIA
# ============================================================

@api_bp.route('/generar-ticket/<int:venta_id>', methods=['GET'])
@login_required
def generar_ticket_imagen(venta_id):
    venta = Venta.query.get_or_404(venta_id)
    detalles = DetalleVenta.query.filter_by(venta_id=venta_id).all()
    
    if not detalles:
        return jsonify({'error': 'No hay detalles para esta venta'}), 404
    
    cliente = venta.cliente
    
    claves = [
        'ticket_tienda_nombre', 'ticket_rif', 'ticket_telefono_tienda', 'ticket_direccion_tienda',
        'ticket_mostrar_rif', 'ticket_mostrar_telefono', 'ticket_mostrar_direccion_cliente', 'ticket_mostrar_direccion_tienda',
        'ticket_mensaje', 'ticket_url', 'ticket_subtotal_usd', 'ticket_iva_porcentaje'
    ]
    configs = {}
    for clave in claves:
        cfg = Configuracion.query.filter_by(clave=clave).first()
        configs[clave] = cfg.valor if cfg else None
    
    tienda_nombre = configs.get('ticket_tienda_nombre', 'ELEMENTS STORE')
    rif = configs.get('ticket_rif', 'J-12345678-9')
    telefono_tienda = configs.get('ticket_telefono_tienda', '0412-1234567')
    direccion_tienda = configs.get('ticket_direccion_tienda', 'Calle Principal, Local 1, Ciudad')
    mostrar_rif = configs.get('ticket_mostrar_rif', 'true').lower() == 'true'
    mostrar_telefono = configs.get('ticket_mostrar_telefono', 'true').lower() == 'true'
    mostrar_direccion_cliente = configs.get('ticket_mostrar_direccion_cliente', 'true').lower() == 'true'
    mostrar_direccion_tienda = configs.get('ticket_mostrar_direccion_tienda', 'true').lower() == 'true'
    mensaje = configs.get('ticket_mensaje', '¡Gracias por su compra!')
    url = configs.get('ticket_url', 'www.elementsstore.com')
    mostrar_subtotal_usd = configs.get('ticket_subtotal_usd', 'true').lower() == 'true'
    iva_porcentaje = float(configs.get('ticket_iva_porcentaje', '0') or '0')
    
    metodo_cobro_map = {
        'usd': 'Precio en Dólares ($)',
        'bcv_usd': 'Tasa BCV USD',
        'bcv_eur': 'Tasa BCV EUR',
        'personalizada': 'Tasa Personalizada',
        'bs_personalizado': 'Bs Personalizado',
        'usd_personalizado': 'Dólar Personalizado'
    }
    metodo_cobro_legible = metodo_cobro_map.get(venta.metodo_cobro, venta.metodo_cobro)
    
    # 🔥 CORRECCIÓN: Obtener fecha local (forzando UTC)
    if venta.fecha.tzinfo is None:
        fecha_utc = pytz.UTC.localize(venta.fecha)
        fecha_local = fecha_utc.astimezone(pytz.timezone('America/Caracas'))
    else:
        fecha_local = venta.fecha.astimezone(pytz.timezone('America/Caracas'))
    fecha_formateada = fecha_local.strftime('%d/%m/%Y, %I:%M:%S %p')
    fecha_formateada = fecha_formateada.replace('AM', 'a. m.').replace('PM', 'p. m.')
    
    base_width = 540
    base_padding = 30
    base_margin_right = 45
    scale = 2
    
    width = base_width * scale
    padding = base_padding * scale
    margin_right = base_margin_right * scale
    
    base_height = 160 + len(detalles) * 28 + 240
    if iva_porcentaje > 0:
        base_height += 20
    if mostrar_direccion_tienda:
        base_height += 15
    if mostrar_rif:
        base_height += 15
    if mostrar_telefono:
        base_height += 15
    base_height = max(base_height, 540)
    height = base_height * scale
    
    image = Image.new('RGB', (width, height), color='white')
    draw = ImageDraw.Draw(image)
    
    # ============ CARGA DE FUENTES CON FALLBACK EXTREMO ============
    font_loaded = False
    font_small = None
    font = None
    font_bold = None
    
    # 1. Intentar fuentes personalizadas (carpeta fonts/)
    try:
        font_small = ImageFont.truetype(get_font_path("DejaVuSans.ttf"), 10 * scale)
        font = ImageFont.truetype(get_font_path("DejaVuSans.ttf"), 11 * scale)
        font_bold = ImageFont.truetype(get_font_path("DejaVuSans-Bold.ttf"), 13 * scale)
        font_loaded = True
        print("✅ Fuentes personalizadas cargadas correctamente.")
    except Exception as e:
        print(f"⚠️ Error cargando fuentes personalizadas: {e}")
    
    # 2. Si falla, intentar fuentes del sistema (Windows)
    if not font_loaded:
        try:
            font_small = ImageFont.truetype("arial.ttf", 10 * scale)
            font = ImageFont.truetype("arial.ttf", 11 * scale)
            font_bold = ImageFont.truetype("arialbd.ttf", 13 * scale)
            font_loaded = True
            print("✅ Fuentes del sistema (Windows) cargadas.")
        except Exception as e:
            print(f"⚠️ Error cargando fuentes del sistema Windows: {e}")
    
    # 3. Si falla, intentar fuentes del sistema (Linux)
    if not font_loaded:
        try:
            font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 10 * scale)
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 11 * scale)
            font_bold = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 13 * scale)
            font_loaded = True
            print("✅ Fuentes del sistema (Linux) cargadas.")
        except Exception as e:
            print(f"⚠️ Error cargando fuentes del sistema Linux: {e}")
    
    # 4. Fallback final: fuente por defecto de PIL (SIEMPRE funciona)
    if not font_loaded:
        font_small = ImageFont.load_default()
        font = ImageFont.load_default()
        font_bold = ImageFont.load_default()
        print("ℹ️ Usando fuente por defecto de PIL (el ticket se verá básico).")
    
    y = padding
    draw.rectangle([(4*scale, 4*scale), (width-4*scale, height-4*scale)], outline='black', width=2*scale)
    
    draw.text((width//2, y), tienda_nombre, fill='black', font=font_bold, anchor='mt')
    y += 20 * scale
    if mostrar_rif:
        draw.text((width//2, y), f"RIF: {rif}", fill='black', font=font_small, anchor='mt')
        y += 15 * scale
    if mostrar_telefono:
        draw.text((width//2, y), f"Tel: {telefono_tienda}", fill='black', font=font_small, anchor='mt')
        y += 15 * scale
    if mostrar_direccion_tienda:
        draw.text((width//2, y), f"Dir: {direccion_tienda}", fill='black', font=font_small, anchor='mt')
        y += 15 * scale
    
    draw.text((width//2, y), f"NOTA DE ENTREGA N°: {venta.numero_ticket:05d}", fill='black', font=font_bold, anchor='mt')
    y += 20 * scale
    draw.text((width//2, y), f"Fecha: {fecha_formateada}", fill='black', font=font_small, anchor='mt')
    y += 18 * scale
    draw.line([(padding, y), (width-padding, y)], fill='black', width=1*scale)
    y += 10 * scale
    
    draw.text((padding, y), f"Cliente: {cliente.nombre} {cliente.apellido}", fill='black', font=font)
    y += 16 * scale
    draw.text((padding, y), f"Cédula: {cliente.cedula}", fill='black', font=font)
    y += 16 * scale
    if cliente.telefono and mostrar_direccion_cliente:
        draw.text((padding, y), f"Teléfono: {cliente.telefono}", fill='black', font=font)
        y += 16 * scale
    if cliente.direccion and mostrar_direccion_cliente:
        draw.text((padding, y), f"Dirección: {cliente.direccion}", fill='black', font=font)
        y += 16 * scale
    y += 4 * scale
    draw.line([(padding, y), (width-padding, y)], fill='black', width=1*scale)
    y += 10 * scale
    
    col_producto = padding
    col_cant = padding + 180 * scale
    col_precio = padding + 260 * scale
    col_total = width - margin_right - 20 * scale
    
    draw.text((col_producto, y), "Producto", fill='black', font=font_bold)
    draw.text((col_cant, y), "Cant", fill='black', font=font_bold, anchor='mt')
    draw.text((col_precio, y), "Precio", fill='black', font=font_bold, anchor='mt')
    draw.text((col_total, y), "Total", fill='black', font=font_bold, anchor='mt')
    y += 18 * scale
    
    total_usd = 0
    for idx, detalle in enumerate(detalles):
        producto = detalle.producto
        subtotal = detalle.precio_unitario_usd * detalle.cantidad
        total_usd += subtotal
        nombre_producto = producto.nombre[:30] if len(producto.nombre) > 30 else producto.nombre
        if detalle.descuento_porcentaje and detalle.descuento_porcentaje > 0:
            nombre_producto += f" ({int(detalle.descuento_porcentaje)}% off)"
        draw.text((col_producto, y), nombre_producto, fill='black', font=font)
        draw.text((col_cant + 10*scale, y), str(detalle.cantidad), fill='black', font=font, anchor='mt')
        draw.text((col_precio, y), f"${detalle.precio_unitario_usd:.2f}", fill='black', font=font, anchor='mt')
        draw.text((col_total, y), f"${subtotal:.2f}", fill='black', font=font, anchor='mt')
        y += 22 * scale
        if idx < len(detalles) - 1:
            draw.line([(padding+10*scale, y-14*scale), (width-padding-10*scale, y-14*scale)], fill='gray', width=1*scale)
    
    y += 4 * scale
    draw.line([(padding, y), (width-padding, y)], fill='black', width=2*scale)
    y += 12 * scale
    
    draw.text((padding, y), "TOTAL USD:", fill='black', font=font_bold)
    draw.text((col_total, y), f"${total_usd:.2f}", fill='black', font=font_bold, anchor='mt')
    y += 20 * scale
    
    if mostrar_subtotal_usd:
        draw.text((padding, y), "Subtotal USD:", fill='black', font=font)
        draw.text((col_total, y), f"${total_usd:.2f}", fill='black', font=font, anchor='mt')
        y += 16 * scale
    
    subtotal_ves = venta.subtotal_ves if venta.subtotal_ves else 0
    draw.text((padding, y), "Subtotal VES:", fill='black', font=font)
    draw.text((col_total, y), f"Bs {subtotal_ves:,.2f}".replace(',', '.'), fill='black', font=font, anchor='mt')
    y += 16 * scale
    
    if iva_porcentaje > 0:
        iva_monto = subtotal_ves * (iva_porcentaje / 100)
        draw.text((padding, y), f"IVA ({iva_porcentaje:.0f}%):", fill='black', font=font)
        draw.text((col_total, y), f"Bs {iva_monto:,.2f}".replace(',', '.'), fill='black', font=font, anchor='mt')
        y += 16 * scale
        total_ves_final = subtotal_ves + iva_monto
        draw.text((padding, y), "TOTAL VES:", fill='black', font=font_bold)
        draw.text((col_total, y), f"Bs {total_ves_final:,.2f}".replace(',', '.'), fill='black', font=font_bold, anchor='mt')
    else:
        total_ves_final = subtotal_ves
        draw.text((padding, y), "TOTAL VES:", fill='black', font=font_bold)
        draw.text((col_total, y), f"Bs {total_ves_final:,.2f}".replace(',', '.'), fill='black', font=font_bold, anchor='mt')
    
    y += 20 * scale
    
    if venta.metodo_cobro not in ['personalizada', 'bs_personalizado']:
        draw.text((padding, y), f"Método Cobro: {metodo_cobro_legible}", fill='black', font=font_small)
        y += 14 * scale
        draw.text((padding, y), f"Tasa aplicada: {venta.tasa_aplicada:.2f}", fill='black', font=font_small)
        y += 14 * scale
    
    draw.text((padding, y), f"Método Pago: {venta.metodo_pago}", fill='black', font=font_small)
    y += 20 * scale
    
    if venta.moneda_cobro == 'USD':
        draw.text((padding, y), f"Total en USD: ${venta.total_cobro:.2f}", fill='black', font=font_bold)
    else:
        draw.text((padding, y), f"Total en VES: Bs {venta.total_cobro:,.2f}".replace(',', '.'), fill='black', font=font_bold)
    
    y += 26 * scale
    draw.line([(padding, y), (width-padding, y)], fill='black', width=1*scale)
    y += 12 * scale
    
    draw.text((width//2, y), mensaje, fill='black', font=font_bold, anchor='mt')
    y += 18 * scale
    draw.text((width//2, y), url, fill='black', font=font_small, anchor='mt')
    
    new_width = width // scale
    new_height = height // scale
    image = image.resize((new_width, new_height), Image.LANCZOS)
    
    img_io = io.BytesIO()
    image.save(img_io, 'PNG', quality=95, optimize=True)
    img_io.seek(0)
    
    return send_file(img_io, mimetype='image/png', as_attachment=True, download_name=f'ticket_{venta.numero_ticket:05d}.png')

# ============================================================
# API: CRÉDITOS Y ABONOS (PROTEGIDA)
# ============================================================

@api_bp.route('/creditos', methods=['POST'])
@login_required
def otorgar_credito():
    data = request.get_json()
    cliente_id = data['cliente_id']
    monto = float(data['monto'])
    cliente = Cliente.query.get(cliente_id)
    if not cliente:
        return jsonify({'error': 'Cliente no encontrado'}), 404

    credito = Credito(
        cliente_id=cliente_id,
        monto=monto,
        saldo_restante=monto
    )
    db.session.add(credito)
    cliente.saldo_deudor += monto
    db.session.commit()
    return jsonify({'mensaje': 'Crédito otorgado', 'id': credito.id}), 201

@api_bp.route('/abonos', methods=['POST'])
@login_required
def registrar_abono():
    data = request.get_json()
    credito_id = data['credito_id']
    monto = float(data['monto'])
    tasa_cambio = float(data.get('tasa_cambio', 1.0))
    credito = Credito.query.get(credito_id)
    if not credito:
        return jsonify({'error': 'Crédito no encontrado'}), 404

    abono = Abono(
        credito_id=credito_id,
        monto=monto,
        tasa_cambio=tasa_cambio
    )
    db.session.add(abono)
    credito.saldo_restante -= monto
    cliente = Cliente.query.get(credito.cliente_id)
    if cliente:
        cliente.saldo_deudor -= monto
    db.session.commit()
    return jsonify({'mensaje': 'Abono registrado'}), 201

# ============================================================
# API: LOGS (PROTEGIDA)
# ============================================================

@api_bp.route('/logs', methods=['GET'])
@login_required
def get_logs():
    logs = Log.query.order_by(Log.fecha.desc()).limit(100).all()
    return jsonify([{
        'fecha': l.fecha.strftime('%Y-%m-%d %H:%M'),
        'accion': l.accion,
        'detalle': l.detalle,
        'usuario': l.usuario
    } for l in logs])

# ============================================================
# API: CONFIGURACIÓN (PROTEGIDA)
# ============================================================

@api_bp.route('/config', methods=['GET'])
@login_required
def get_config():
    configs = Configuracion.query.all()
    return jsonify({c.clave: c.valor for c in configs})

@api_bp.route('/config', methods=['POST'])
@login_required
def set_config():
    data = request.get_json()
    clave = data.get('clave')
    valor = data.get('valor')
    if not clave:
        return jsonify({'error': 'Clave requerida'}), 400
    config = Configuracion.query.filter_by(clave=clave).first()
    if config:
        config.valor = valor
    else:
        config = Configuracion(clave=clave, valor=valor)
        db.session.add(config)
    db.session.commit()
    return jsonify({'mensaje': 'Configuración actualizada'})

# ============================================================
# API: GASTOS (PROTEGIDA)
# ============================================================

@api_bp.route('/categorias-gasto', methods=['GET'])
@login_required
def get_categorias_gasto():
    categorias = CategoriaGasto.query.all()
    return jsonify([{'id': c.id, 'nombre': c.nombre} for c in categorias])

@api_bp.route('/categorias-gasto', methods=['POST'])
@login_required
def crear_categoria_gasto():
    data = request.get_json()
    if not data.get('nombre'):
        return jsonify({'error': 'El nombre es requerido'}), 400
    cat = CategoriaGasto(nombre=data['nombre'])
    db.session.add(cat)
    db.session.commit()
    return jsonify({'mensaje': 'Categoría creada', 'id': cat.id}), 201

@api_bp.route('/gastos', methods=['GET'])
@login_required
def get_gastos():
    fecha_desde = request.args.get('fecha_desde')
    fecha_hasta = request.args.get('fecha_hasta')
    query = Gasto.query
    if fecha_desde:
        query = query.filter(Gasto.fecha >= datetime.strptime(fecha_desde, '%Y-%m-%d'))
    if fecha_hasta:
        query = query.filter(Gasto.fecha <= datetime.strptime(fecha_hasta, '%Y-%m-%d'))
    gastos = query.order_by(Gasto.fecha.desc()).all()
    return jsonify([{
        'id': g.id,
        'fecha': g.fecha.strftime('%Y-%m-%d %H:%M'),
        'categoria': g.categoria.nombre if g.categoria else 'Sin categoría',
        'concepto': g.concepto,
        'monto_usd': g.monto_usd,
        'monto_ves': g.monto_ves,
        'tasa_aplicada': g.tasa_aplicada,
        'comprobante': g.comprobante,
        'moneda': g.moneda
    } for g in gastos])

@api_bp.route('/gastos/<int:id>', methods=['GET'])
@login_required
def obtener_gasto(id):
    gasto = Gasto.query.get_or_404(id)
    return jsonify({
        'id': gasto.id,
        'categoria_id': gasto.categoria_id,
        'concepto': gasto.concepto,
        'monto_usd': gasto.monto_usd,
        'monto_ves': gasto.monto_ves,
        'tasa_aplicada': gasto.tasa_aplicada,
        'moneda': gasto.moneda
    })

@api_bp.route('/gastos', methods=['POST'])
@login_required
def crear_gasto():
    data = request.get_json()
    required = ['categoria_id', 'concepto', 'moneda', 'monto']
    for field in required:
        if field not in data:
            return jsonify({'error': f'Falta campo {field}'}), 400

    categoria_id = int(data['categoria_id'])
    concepto = data['concepto']
    moneda = data['moneda']
    monto = float(data['monto'])

    if monto <= 0:
        return jsonify({'error': 'El monto debe ser mayor a 0'}), 400

    tasa_usd = float(data.get('tasa_usd', 0))
    if tasa_usd == 0:
        try:
            tasas = obtener_tasas_bcv()
            tasa_usd = tasas.get('usd', 1.0)
        except:
            tasa_usd = 1.0
    if tasa_usd == 0:
        tasa_usd = 1.0

    if moneda == 'USD':
        monto_usd = monto
        monto_ves = round(monto * tasa_usd, 2)
    else:
        monto_ves = monto
        monto_usd = round(monto / tasa_usd, 2)

    gasto = Gasto(
        categoria_id=categoria_id,
        concepto=concepto,
        moneda=moneda,
        monto_usd=monto_usd,
        monto_ves=monto_ves,
        tasa_aplicada=tasa_usd,
        comprobante=data.get('comprobante', '')
    )
    db.session.add(gasto)
    db.session.commit()
    log = Log(accion='GASTO', detalle=f'Gasto registrado: {gasto.concepto} - {moneda} {monto}')
    db.session.add(log)
    db.session.commit()
    return jsonify({'mensaje': f'Gasto registrado en {moneda}'}), 201

@api_bp.route('/gastos/<int:id>', methods=['PUT'])
@login_required
def actualizar_gasto(id):
    gasto = Gasto.query.get_or_404(id)
    data = request.get_json()
    
    if 'categoria_id' in data:
        gasto.categoria_id = int(data['categoria_id'])
    if 'concepto' in data:
        gasto.concepto = data['concepto']
    if 'moneda' in data and 'monto' in data:
        moneda = data['moneda']
        monto = float(data['monto'])
        
        tasa_usd = float(data.get('tasa_usd', 0))
        if tasa_usd == 0:
            try:
                tasas = obtener_tasas_bcv()
                tasa_usd = tasas.get('usd', 1.0)
            except:
                tasa_usd = 1.0
        if tasa_usd == 0:
            tasa_usd = 1.0
        
        if moneda == 'USD':
            gasto.monto_usd = monto
            gasto.monto_ves = round(monto * tasa_usd, 2)
        else:
            gasto.monto_ves = monto
            gasto.monto_usd = round(monto / tasa_usd, 2)
        
        gasto.tasa_aplicada = tasa_usd
        gasto.moneda = moneda
    
    db.session.commit()
    log = Log(accion='ACTUALIZAR_GASTO', detalle=f'Gasto "{gasto.concepto}" actualizado')
    db.session.add(log)
    db.session.commit()
    return jsonify({'mensaje': 'Gasto actualizado correctamente'})

@api_bp.route('/gastos/<int:id>', methods=['DELETE'])
@login_required
def eliminar_gasto(id):
    gasto = Gasto.query.get_or_404(id)
    concepto = gasto.concepto
    db.session.delete(gasto)
    db.session.commit()
    log = Log(accion='ELIMINAR_GASTO', detalle=f'Gasto "{concepto}" eliminado')
    db.session.add(log)
    db.session.commit()
    return jsonify({'mensaje': 'Gasto eliminado correctamente'})

# ============================================================
# API: REPORTES (PROTEGIDA) - MODIFICADA CON TOP PRODUCTOS EN USD/VES
# ============================================================

@api_bp.route('/reportes/resumen', methods=['GET'])
@login_required
def resumen_reportes():
    fecha_desde = request.args.get('fecha_desde')
    fecha_hasta = request.args.get('fecha_hasta')

    # ============================================================
    # 🔧 1. OBTENER VENTAS NORMALES (excluyendo apartados y anuladas)
    # ============================================================
    ventas_query = Venta.query.filter(Venta.es_apartado == False, Venta.anulado == False)
    gastos_query = Gasto.query
    desde = None
    hasta = None
    if fecha_desde:
        desde = datetime.strptime(fecha_desde, '%Y-%m-%d')
        ventas_query = ventas_query.filter(Venta.fecha >= desde)
        gastos_query = gastos_query.filter(Gasto.fecha >= desde)
    if fecha_hasta:
        hasta = datetime.strptime(fecha_hasta, '%Y-%m-%d') + timedelta(days=1)
        ventas_query = ventas_query.filter(Venta.fecha < hasta)
        gastos_query = gastos_query.filter(Gasto.fecha < hasta)
    else:
        hasta = datetime.now() + timedelta(days=1)

    ventas = ventas_query.all()
    gastos = gastos_query.all()

    if ventas:
        tasa_usd = ventas[0].tasa_bcv_usd or 1.0
        tasa_eur = ventas[0].tasa_bcv_eur or 1.0
    else:
        tasas = obtener_tasas_bcv()
        tasa_usd = tasas['usd'] or 1.0
        tasa_eur = tasas['eur'] or 1.0

    # ============================================================
    # 🔧 2. TOTALES POR MONEDA (ventas normales)
    # ============================================================
    total_ventas_usd = sum(v.total_usd for v in ventas if v.moneda_cobro == 'USD')
    total_ventas_ves = sum(v.total_ves for v in ventas if v.moneda_cobro == 'VES')

    # Referencias para totales en VES
    referencia_ventas_ves_usd = total_ventas_ves / tasa_usd if tasa_usd > 0 else 0
    referencia_ventas_ves_eur = total_ventas_ves / tasa_eur if tasa_eur > 0 else 0

    # Referencias para totales en USD
    referencia_ventas_usd_ves = total_ventas_usd * tasa_usd
    referencia_ventas_usd_eur = total_ventas_usd * tasa_eur

    # ============================================================
    # 🔧 3. GASTOS (sin cambios)
    # ============================================================
    total_gastos_usd = 0.0
    total_gastos_ves = 0.0

    for g in gastos:
        if g.moneda:
            if g.moneda == 'USD':
                total_gastos_usd += g.monto_usd
            elif g.moneda == 'VES':
                total_gastos_ves += g.monto_ves if g.monto_ves else g.monto_usd * tasa_usd
        else:
            monto_usd_rounded = round(g.monto_usd, 2)
            monto_ves_rounded = round(g.monto_ves, 2) if g.monto_ves else 0.0
            es_usd_entero = abs(monto_usd_rounded - round(monto_usd_rounded)) < 0.01
            es_ves_entero = abs(monto_ves_rounded - round(monto_ves_rounded)) < 0.01

            if es_usd_entero and not es_ves_entero:
                moneda = 'USD'
            elif es_ves_entero and not es_usd_entero:
                moneda = 'VES'
            else:
                diff_usd_ves = abs(g.monto_usd * tasa_usd - g.monto_ves)
                diff_ves_usd = abs(g.monto_ves / tasa_usd - g.monto_usd)
                moneda = 'USD' if diff_usd_ves < diff_ves_usd else 'VES'

            if moneda == 'USD':
                total_gastos_usd += g.monto_usd
            else:
                total_gastos_ves += g.monto_ves if g.monto_ves else g.monto_usd * tasa_usd

    referencia_gastos_ves_usd = total_gastos_ves / tasa_usd if tasa_usd > 0 else 0
    referencia_gastos_ves_eur = total_gastos_ves / tasa_eur if tasa_eur > 0 else 0
    referencia_gastos_usd_ves = total_gastos_usd * tasa_usd
    referencia_gastos_usd_eur = total_gastos_usd * tasa_eur

    ganancia_neta_usd = total_ventas_usd - total_gastos_usd
    ganancia_neta_ves = total_ventas_ves - total_gastos_ves

    referencia_ganancia_usd_ves = ganancia_neta_usd * tasa_usd
    referencia_ganancia_usd_eur = ganancia_neta_usd * tasa_eur
    referencia_ganancia_ves_usd = ganancia_neta_ves / tasa_usd if tasa_usd > 0 else 0
    referencia_ganancia_ves_eur = ganancia_neta_ves / tasa_eur if tasa_eur > 0 else 0

    # ============================================================
    # 🔧 4. COSTO TOTAL DE INVENTARIO
    # ============================================================
    productos = Producto.query.all()
    costo_total_inventario = 0.0
    for p in productos:
        costo = p.costo_usd if p.costo_usd is not None else 0.0
        stock = p.stock if p.stock is not None else 0
        costo_total_inventario += costo * stock
    costo_total_inventario = round(costo_total_inventario, 2)

    # ============================================================
    # 🔧 5. MÉTODOS DE PAGO (ventas normales) - NUEVO FORMATO
    # ============================================================
    metodos = []
    for v in ventas:
        moneda_real = v.moneda_cobro
        if moneda_real == 'USD':
            monto = v.total_cobro
        else:
            monto = v.total_ves  # total_ves ya es el monto en VES
        metodos.append({
            'metodo': v.metodo_pago or 'Otro',
            'moneda': moneda_real,
            'monto': monto
        })

    # ============================================================
    # 🔧 6. TOP PRODUCTOS MÁS VENDIDOS (separados por moneda)
    # ============================================================
    # (func y or_ ya importados arriba)

    # Top productos en USD (ventas normales con moneda_cobro='USD' y no anuladas)
    top_productos_usd_query = db.session.query(
        Producto.nombre,
        func.sum(DetalleVenta.cantidad).label('vendido'),
        func.sum(DetalleVenta.precio_unitario_usd * DetalleVenta.cantidad).label('total')
    ).join(DetalleVenta, DetalleVenta.producto_id == Producto.id)\
     .join(Venta, Venta.id == DetalleVenta.venta_id)\
     .filter(Venta.es_apartado == False)\
     .filter(Venta.anulado == False)\
     .filter(Venta.moneda_cobro == 'USD')\
     .filter(Venta.fecha >= (desde if fecha_desde else datetime(2000,1,1)))\
     .filter(Venta.fecha < (hasta if fecha_hasta else datetime(2100,1,1)))\
     .group_by(Producto.id)\
     .order_by(func.sum(DetalleVenta.precio_unitario_usd * DetalleVenta.cantidad).desc())\
     .limit(5)

    top_productos_usd = []
    for row in top_productos_usd_query.all():
        top_productos_usd.append({
            'nombre': row.nombre,
            'vendido': int(row.vendido),
            'total': round(row.total, 2)
        })

    # Top productos en VES (ventas normales con moneda_cobro='VES' y no anuladas)
    top_productos_ves_query = db.session.query(
        Producto.nombre,
        func.sum(DetalleVenta.cantidad).label('vendido'),
        func.sum(DetalleVenta.precio_unitario_ves * DetalleVenta.cantidad).label('total')
    ).join(DetalleVenta, DetalleVenta.producto_id == Producto.id)\
     .join(Venta, Venta.id == DetalleVenta.venta_id)\
     .filter(Venta.es_apartado == False)\
     .filter(Venta.anulado == False)\
     .filter(Venta.moneda_cobro == 'VES')\
     .filter(Venta.fecha >= (desde if fecha_desde else datetime(2000,1,1)))\
     .filter(Venta.fecha < (hasta if fecha_hasta else datetime(2100,1,1)))\
     .group_by(Producto.id)\
     .order_by(func.sum(DetalleVenta.precio_unitario_ves * DetalleVenta.cantidad).desc())\
     .limit(5)

    top_productos_ves = []
    for row in top_productos_ves_query.all():
        top_productos_ves.append({
            'nombre': row.nombre,
            'vendido': int(row.vendido),
            'total': round(row.total, 2)
        })

    # ============================================================
    # 🔧 7. VENTAS POR DÍA (separadas por moneda)
    # ============================================================
    ventas_por_dia_usd = {}
    ventas_por_dia_ves = {}
    for v in ventas:
        dia = v.fecha.strftime('%Y-%m-%d')
        if v.moneda_cobro == 'USD':
            ventas_por_dia_usd[dia] = ventas_por_dia_usd.get(dia, 0) + v.total_usd
        elif v.moneda_cobro == 'VES':
            ventas_por_dia_ves[dia] = ventas_por_dia_ves.get(dia, 0) + v.total_ves

    ventas_por_dia_usd_list = [{'fecha': d, 'total': round(m, 2)} for d, m in ventas_por_dia_usd.items()]
    ventas_por_dia_ves_list = [{'fecha': d, 'total': round(m, 2)} for d, m in ventas_por_dia_ves.items()]

    # ============================================================
    # 🔧 8. RESPUESTA
    # ============================================================
    return jsonify({
        # Totales
        'total_ventas_usd': round(total_ventas_usd, 2),
        'total_ventas_ves': round(total_ventas_ves, 2),
        'total_gastos_usd': round(total_gastos_usd, 2),
        'total_gastos_ves': round(total_gastos_ves, 2),
        'ganancia_neta_usd': round(ganancia_neta_usd, 2),
        'ganancia_neta_ves': round(ganancia_neta_ves, 2),
        'costo_total_inventario': costo_total_inventario,
        # Referencias
        'referencia_ventas_usd_ves': round(referencia_ventas_usd_ves, 2),
        'referencia_ventas_usd_eur': round(referencia_ventas_usd_eur, 2),
        'referencia_ventas_ves_usd': round(referencia_ventas_ves_usd, 2),
        'referencia_ventas_ves_eur': round(referencia_ventas_ves_eur, 2),
        'referencia_gastos_usd_ves': round(referencia_gastos_usd_ves, 2),
        'referencia_gastos_usd_eur': round(referencia_gastos_usd_eur, 2),
        'referencia_gastos_ves_usd': round(referencia_gastos_ves_usd, 2),
        'referencia_gastos_ves_eur': round(referencia_gastos_ves_eur, 2),
        'referencia_ganancia_usd_ves': round(referencia_ganancia_usd_ves, 2),
        'referencia_ganancia_usd_eur': round(referencia_ganancia_usd_eur, 2),
        'referencia_ganancia_ves_usd': round(referencia_ganancia_ves_usd, 2),
        'referencia_ganancia_ves_eur': round(referencia_ganancia_ves_eur, 2),
        # Gráficas
        'ventas_por_dia_usd': ventas_por_dia_usd_list,
        'ventas_por_dia_ves': ventas_por_dia_ves_list,
        'top_productos_usd': top_productos_usd,
        'top_productos_ves': top_productos_ves,
        'metodos_pago': metodos,
        'tasas': {
            'usd': tasa_usd,
            'eur': tasa_eur
        }
    })

# ============================================================
# API: DETALLE DE INVENTARIO PARA DESGLOSE (NUEVO)
# ============================================================

@api_bp.route('/reportes/inventario-detalle', methods=['GET'])
@login_required
def inventario_detalle():
    """Devuelve la lista de productos con costo, stock y subtotal para el desglose del costo total de inventario."""
    productos = Producto.query.all()
    detalles = []
    for p in productos:
        costo = p.costo_usd if p.costo_usd is not None else 0.0
        stock = p.stock if p.stock is not None else 0
        detalles.append({
            'nombre': p.nombre,
            'costo_usd': costo,
            'stock': stock,
            'subtotal': round(costo * stock, 2)
        })
    return jsonify(detalles)

# ============================================================
# API: DASHBOARD METRICS (PROTEGIDA)
# ============================================================

@api_bp.route('/dashboard/metricas', methods=['GET'])
@login_required
def dashboard_metricas():
    hoy = datetime.now().date()
    inicio_dia = datetime(hoy.year, hoy.month, hoy.day, 0, 0, 0)
    fin_dia = inicio_dia + timedelta(days=1)
    
    inicio_semana = hoy - timedelta(days=hoy.weekday())
    inicio_semana = datetime(inicio_semana.year, inicio_semana.month, inicio_semana.day, 0, 0, 0)
    fin_semana = inicio_semana + timedelta(days=7)
    
    inicio_mes = datetime(hoy.year, hoy.month, 1, 0, 0, 0)
    fin_mes = (inicio_mes + timedelta(days=32)).replace(day=1)

    def total_ventas_periodo(inicio, fin):
        ventas = Venta.query.filter(Venta.fecha >= inicio, Venta.fecha < fin, Venta.anulado == False).all()
        total_usd = sum(v.total_usd for v in ventas if v.moneda_cobro == 'USD')
        total_ves = sum(v.total_ves for v in ventas if v.moneda_cobro == 'VES')
        return {'usd': total_usd, 'ves': total_ves}

    metrics = {
        'diario': total_ventas_periodo(inicio_dia, fin_dia),
        'semanal': total_ventas_periodo(inicio_semana, fin_semana),
        'mensual': total_ventas_periodo(inicio_mes, fin_mes)
    }

    stock_critico = Producto.query.filter(Producto.stock <= 0).count()
    tasas = obtener_tasas_bcv()

    return jsonify({
        'diario': {'usd': round(metrics['diario']['usd'], 2), 'ves': round(metrics['diario']['ves'], 2)},
        'semanal': {'usd': round(metrics['semanal']['usd'], 2), 'ves': round(metrics['semanal']['ves'], 2)},
        'mensual': {'usd': round(metrics['mensual']['usd'], 2), 'ves': round(metrics['mensual']['ves'], 2)},
        'stock_critico': stock_critico,
        'tasa_usd': tasas['usd'],
        'tasa_eur': tasas['eur']
    })

# ============================================================
# API: HISTORIAL DE TASAS (PROTEGIDA)
# ============================================================

@api_bp.route('/historial/tasas', methods=['GET'])
@login_required
def historial_tasas():
    fecha_desde = request.args.get('fecha_desde')
    fecha_hasta = request.args.get('fecha_hasta')
    
    if not fecha_desde or not fecha_hasta:
        return jsonify([])
    
    try:
        desde = datetime.strptime(fecha_desde, '%Y-%m-%d').date()
        hasta = datetime.strptime(fecha_hasta, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Formato de fecha inválido'}), 400
    
    historial = HistorialTasa.query.filter(
        HistorialTasa.fecha >= desde,
        HistorialTasa.fecha <= hasta
    ).order_by(HistorialTasa.fecha.asc()).all()
    
    if not historial:
        return jsonify([])
    
    result = []
    for item in historial:
        result.append({
            'fecha': item.fecha.strftime('%Y-%m-%d'),
            'usd_bcv': item.usd_bcv,
            'eur_bcv': item.eur_bcv,
            'personalizada': item.personalizada
        })
    
    return jsonify(result)

# ============================================================
# 🔥 NUEVO: API PARA CAJAS Y BALANCE GENERAL (MODIFICADO PARA INCLUIR DEUDAS AUTOMÁTICAS)
# ============================================================

@api_bp.route('/finanzas/saldos', methods=['GET'])
@login_required
def obtener_saldos_financieros():
    """
    Devuelve:
    - Lista de todas las cuentas financieras (manuales y automáticas)
    - Totales de Activos (USD y VES) y Pasivos (USD y VES)
    - Inventario total (USD) calculado desde Producto
    - Cuentas por cobrar total (USD y VES) calculado desde Cliente.saldo_deudor
    - Deudas pendientes (USD y VES) calculado desde Deuda (estado='pendiente')
    """
    # 1. Obtener cuentas manuales de la BD
    cuentas_db = CuentaFinanciera.query.filter_by(es_automatico=False).all()
    lista_cuentas = []
    for c in cuentas_db:
        lista_cuentas.append({
            'id': c.id,
            'nombre': c.nombre,
            'tipo': c.tipo,
            'moneda': c.moneda,
            'monto': float(c.monto),
            'es_automatico': c.es_automatico
        })
    
    # 2. Calcular inventario total (activo automático en USD)
    productos = Producto.query.all()
    inventario_usd = sum(p.costo_usd * p.stock if p.costo_usd else 0 for p in productos)
    inventario_usd = round(inventario_usd, 2)
    
    # 3. Calcular cuentas por cobrar (clientes con saldo_deudor > 0)
    clientes = Cliente.query.filter(Cliente.saldo_deudor > 0).all()
    cuentas_por_cobrar_usd = sum(c.saldo_deudor for c in clientes)
    cuentas_por_cobrar_usd = round(cuentas_por_cobrar_usd, 2)
    
    # 4. 🔥 NUEVO: Calcular deudas pendientes (estado='pendiente')
    deudas_pendientes_usd = db.session.query(func.sum(Deuda.monto)).filter(
        Deuda.estado == 'pendiente',
        Deuda.moneda == 'USD'
    ).scalar() or 0.0
    deudas_pendientes_ves = db.session.query(func.sum(Deuda.monto)).filter(
        Deuda.estado == 'pendiente',
        Deuda.moneda == 'VES'
    ).scalar() or 0.0
    deudas_pendientes_usd = round(float(deudas_pendientes_usd), 2)
    deudas_pendientes_ves = round(float(deudas_pendientes_ves), 2)
    
    # 5. Añadir cuentas automáticas a la lista (o actualizar las existentes)
    # Buscar si ya existen las cuentas "Deudas USD" y "Deudas Bs" en la lista
    # y reemplazar su monto, o añadirlas si no existen.
    def actualizar_o_agregar_cuenta(nombre, tipo, moneda, monto, es_automatico=True):
        for cuenta in lista_cuentas:
            if cuenta['nombre'] == nombre and cuenta['tipo'] == tipo and cuenta['moneda'] == moneda:
                # Actualizar monto y marcar como automático (si no lo está)
                cuenta['monto'] = monto
                cuenta['es_automatico'] = True
                return
        # Si no existe, agregar nueva entrada (sin id)
        lista_cuentas.append({
            'id': None,
            'nombre': nombre,
            'tipo': tipo,
            'moneda': moneda,
            'monto': monto,
            'es_automatico': es_automatico
        })
    
    # Actualizar o agregar cuentas de deudas
    actualizar_o_agregar_cuenta('Deudas USD', 'pasivo', 'USD', deudas_pendientes_usd)
    actualizar_o_agregar_cuenta('Deudas Bs', 'pasivo', 'VES', deudas_pendientes_ves)
    
    # Añadir inventario como cuenta automática (solo si > 0)
    if inventario_usd > 0:
        actualizar_o_agregar_cuenta('Inventario (USD)', 'activo', 'USD', inventario_usd)
    
    # Añadir cuentas por cobrar como cuenta automática (solo si > 0)
    if cuentas_por_cobrar_usd > 0:
        actualizar_o_agregar_cuenta('Cuentas por Cobrar (USD)', 'activo', 'USD', cuentas_por_cobrar_usd)
    
    # 6. Calcular totales
    total_activo_usd = sum(c['monto'] for c in lista_cuentas if c['tipo'] == 'activo' and c['moneda'] == 'USD')
    total_activo_ves = sum(c['monto'] for c in lista_cuentas if c['tipo'] == 'activo' and c['moneda'] == 'VES')
    total_pasivo_usd = sum(c['monto'] for c in lista_cuentas if c['tipo'] == 'pasivo' and c['moneda'] == 'USD')
    total_pasivo_ves = sum(c['monto'] for c in lista_cuentas if c['tipo'] == 'pasivo' and c['moneda'] == 'VES')
    
    balance_usd = round(total_activo_usd - total_pasivo_usd, 2)
    balance_ves = round(total_activo_ves - total_pasivo_ves, 2)
    
    return jsonify({
        'cuentas': lista_cuentas,
        'totales': {
            'activo_usd': total_activo_usd,
            'activo_ves': total_activo_ves,
            'pasivo_usd': total_pasivo_usd,
            'pasivo_ves': total_pasivo_ves,
            'balance_usd': balance_usd,
            'balance_ves': balance_ves
        },
        'inventario_usd': inventario_usd,
        'cuentas_por_cobrar_usd': cuentas_por_cobrar_usd,
        'deudas_pendientes_usd': deudas_pendientes_usd,
        'deudas_pendientes_ves': deudas_pendientes_ves
    })

@api_bp.route('/finanzas/saldos/<int:cuenta_id>', methods=['PUT'])
@login_required
def actualizar_saldo_cuenta(cuenta_id):
    data = request.get_json()
    nuevo_monto = data.get('monto')
    if nuevo_monto is None:
        return jsonify({'error': 'Monto requerido'}), 400
    
    cuenta = CuentaFinanciera.query.get_or_404(cuenta_id)
    # Si es automática, no permitir edición (aunque por nombre también podríamos bloquear)
    if cuenta.es_automatico:
        return jsonify({'error': 'No se puede modificar una cuenta automática'}), 400
    
    cuenta.monto = round(float(nuevo_monto), 2)
    cuenta.fecha_actualizacion = now_venezuela()
    db.session.commit()
    
    return jsonify({'mensaje': 'Saldo actualizado', 'nuevo_monto': float(cuenta.monto)})


# ============================================================
# 🔥 NUEVO: ENDPOINTS PARA CREAR Y ELIMINAR CUENTAS FINANCIERAS MANUALES
# ============================================================

@api_bp.route('/finanzas/cuentas', methods=['POST'])
@login_required
def crear_cuenta_financiera():
    """Crea una nueva cuenta manual (activo o pasivo)."""
    data = request.get_json()
    nombre = data.get('nombre', '').strip()
    tipo = data.get('tipo')          # 'activo' o 'pasivo'
    moneda = data.get('moneda')      # 'USD' o 'VES'
    monto = float(data.get('monto', 0))

    if not nombre:
        return jsonify({'error': 'El nombre de la cuenta es obligatorio'}), 400
    if tipo not in ['activo', 'pasivo']:
        return jsonify({'error': 'Tipo inválido. Debe ser activo o pasivo'}), 400
    if moneda not in ['USD', 'VES']:
        return jsonify({'error': 'Moneda inválida. Debe ser USD o VES'}), 400
    if monto < 0:
        return jsonify({'error': 'El monto no puede ser negativo'}), 400

    # Validar nombre único
    existe = CuentaFinanciera.query.filter_by(nombre=nombre).first()
    if existe:
        return jsonify({'error': f'Ya existe una cuenta con el nombre "{nombre}"'}), 400

    nueva = CuentaFinanciera(
        nombre=nombre,
        tipo=tipo,
        moneda=moneda,
        monto=monto,
        es_automatico=False
    )
    db.session.add(nueva)
    db.session.commit()

    log = Log(accion='CUENTA_FINANCIERA_CREADA', detalle=f'Cuenta "{nombre}" creada ({tipo} - {moneda})')
    db.session.add(log)
    db.session.commit()

    return jsonify({
        'mensaje': 'Cuenta creada exitosamente',
        'id': nueva.id
    }), 201


@api_bp.route('/finanzas/cuentas/<int:cuenta_id>', methods=['DELETE'])
@login_required
def eliminar_cuenta_financiera(cuenta_id):
    """Elimina una cuenta manual (no automática)."""
    cuenta = CuentaFinanciera.query.get_or_404(cuenta_id)
    if cuenta.es_automatico:
        return jsonify({'error': 'No se puede eliminar una cuenta automática'}), 400

    nombre = cuenta.nombre
    db.session.delete(cuenta)
    db.session.commit()

    log = Log(accion='CUENTA_FINANCIERA_ELIMINADA', detalle=f'Cuenta "{nombre}" eliminada')
    db.session.add(log)
    db.session.commit()

    return jsonify({'mensaje': 'Cuenta eliminada correctamente'}), 200


# ============================================================
# 🔥 NUEVO: ENDPOINTS PARA GESTIÓN DE DEUDAS
# ============================================================

@api_bp.route('/deudas', methods=['GET'])
@login_required
def listar_deudas():
    """Lista deudas con filtros por estado y rango de fechas."""
    estado = request.args.get('estado', 'pendiente')  # 'pendiente' o 'finalizada'
    fecha_desde = request.args.get('fecha_desde')
    fecha_hasta = request.args.get('fecha_hasta')
    
    query = Deuda.query.filter_by(estado=estado)
    
    if fecha_desde:
        try:
            desde = datetime.strptime(fecha_desde, '%Y-%m-%d')
            query = query.filter(Deuda.fecha_creacion >= desde)
        except ValueError:
            return jsonify({'error': 'Formato de fecha desde inválido (YYYY-MM-DD)'}), 400
    
    if fecha_hasta:
        try:
            hasta = datetime.strptime(fecha_hasta, '%Y-%m-%d') + timedelta(days=1)
            query = query.filter(Deuda.fecha_creacion < hasta)
        except ValueError:
            return jsonify({'error': 'Formato de fecha hasta inválido (YYYY-MM-DD)'}), 400
    
    deudas = query.order_by(Deuda.fecha_creacion.desc()).all()
    
    result = []
    for d in deudas:
        result.append({
            'id': d.id,
            'descripcion': d.descripcion,
            'moneda': d.moneda,
            'monto': float(d.monto),
            'fecha_creacion': d.fecha_creacion.strftime('%Y-%m-%d %H:%M'),
            'fecha_finalizacion': d.fecha_finalizacion.strftime('%Y-%m-%d %H:%M') if d.fecha_finalizacion else None,
            'estado': d.estado,
            'observaciones': d.observaciones or ''
        })
    
    return jsonify(result)

@api_bp.route('/deudas', methods=['POST'])
@login_required
def crear_deuda():
    """Crea una nueva deuda."""
    data = request.get_json()
    
    descripcion = data.get('descripcion', '').strip()
    moneda = data.get('moneda')
    monto = data.get('monto')
    observaciones = data.get('observaciones', '').strip()
    
    if not descripcion:
        return jsonify({'error': 'La descripción es obligatoria'}), 400
    if moneda not in ['USD', 'VES']:
        return jsonify({'error': 'Moneda inválida. Debe ser USD o VES'}), 400
    try:
        monto = float(monto)
        if monto <= 0:
            return jsonify({'error': 'El monto debe ser mayor a 0'}), 400
    except (TypeError, ValueError):
        return jsonify({'error': 'Monto inválido'}), 400
    
    nueva_deuda = Deuda(
        descripcion=descripcion,
        moneda=moneda,
        monto=monto,
        observaciones=observaciones,
        estado='pendiente'
    )
    db.session.add(nueva_deuda)
    db.session.commit()
    
    log = Log(accion='DEUDA_CREADA', detalle=f'Deuda "{descripcion}" por {moneda} {monto:.2f}')
    db.session.add(log)
    db.session.commit()
    
    return jsonify({
        'mensaje': 'Deuda creada exitosamente',
        'id': nueva_deuda.id
    }), 201

@api_bp.route('/deudas/<int:id>/finalizar', methods=['PUT'])
@login_required
def finalizar_deuda(id):
    """Cambia el estado de una deuda a 'finalizada'."""
    deuda = Deuda.query.get_or_404(id)
    if deuda.estado != 'pendiente':
        return jsonify({'error': 'La deuda ya está finalizada'}), 400
    
    deuda.estado = 'finalizada'
    deuda.fecha_finalizacion = now_venezuela()
    db.session.commit()
    
    log = Log(accion='DEUDA_FINALIZADA', detalle=f'Deuda "{deuda.descripcion}" finalizada')
    db.session.add(log)
    db.session.commit()
    
    return jsonify({'mensaje': 'Deuda finalizada correctamente'}), 200

@api_bp.route('/deudas/<int:id>', methods=['DELETE'])
@login_required
def eliminar_deuda(id):
    """Elimina una deuda (solo si está pendiente o finalizada)."""
    deuda = Deuda.query.get_or_404(id)
    descripcion = deuda.descripcion
    db.session.delete(deuda)
    db.session.commit()
    
    log = Log(accion='DEUDA_ELIMINADA', detalle=f'Deuda "{descripcion}" eliminada')
    db.session.add(log)
    db.session.commit()
    
    return jsonify({'mensaje': 'Deuda eliminada correctamente'}), 200

# ============================================================
# NUEVAS API: DEUDAS/APARTADOS
# ============================================================

@api_bp.route('/apartados', methods=['POST'])
@login_required
def crear_apartado():
    """Crea un nuevo apartado (deuda)."""
    data = request.get_json()
    
    # Validar campos obligatorios
    required = ['cliente_id', 'producto_id', 'cantidad', 'abono_inicial_porcentaje', 
                'metodo_cobro_inicial', 'metodo_pago_inicial', 'periodo_tipo', 'fecha_limite_pago']
    for field in required:
        if field not in data:
            return jsonify({'error': f'Falta campo {field}'}), 400
    
    cliente_id = int(data['cliente_id'])
    producto_id = int(data['producto_id'])
    cantidad = int(data['cantidad'])
    abono_inicial_porcentaje = float(data['abono_inicial_porcentaje'])
    metodo_cobro_inicial = data['metodo_cobro_inicial']
    metodo_pago_inicial = data['metodo_pago_inicial']
    periodo_tipo = data['periodo_tipo']
    fecha_limite_pago = datetime.strptime(data['fecha_limite_pago'], '%Y-%m-%d').date()
    descontar_stock_al_apartar = data.get('descontar_stock_al_apartar', True)
    
    # Obtener producto y cliente
    producto = Producto.query.get(producto_id)
    if not producto:
        return jsonify({'error': 'Producto no encontrado'}), 404
    if producto.stock < cantidad:
        return jsonify({'error': f'Stock insuficiente. Disponible: {producto.stock}'}), 400
    
    cliente = Cliente.query.get(cliente_id)
    if not cliente:
        return jsonify({'error': 'Cliente no encontrado'}), 404
    if not cliente.es_fijo:
        return jsonify({'error': 'El cliente no es un cliente fijo'}), 400
    
    # Obtener tasas del día
    tasas = obtener_tasas_bcv()
    tasa_usd = tasas['usd']
    tasa_eur = tasas['eur']
    
    # ============================================================
    # 🔥 CORRECCIÓN 1: Calcular total transaccional en USD
    # ============================================================
    # Precio fijo en USD (para referencia)
    precio_unitario_usd = producto.precio_usd
    total_usd_fijo = round(precio_unitario_usd * cantidad, 2)
    
    # Tasa aplicada (enviada desde el frontend)
    tasa_aplicada = data.get('tasa_aplicada', tasa_usd)
    
    # Si el método de cobro es Bs Personalizado, el total en VES viene en total_cobro
    total_cobro = data.get('total_cobro', None)
    if metodo_cobro_inicial == 'bs_personalizado' and total_cobro:
        # El total en USD transaccional es el total en VES dividido entre la tasa BCV USD
        total_usd_transaccion = round(total_cobro / tasa_usd, 2)
    else:
        # Para otros métodos, el total transaccional en USD es el fijo ajustado por la tasa
        total_usd_transaccion = round(total_usd_fijo * (tasa_aplicada / tasa_usd), 2)
    
    # Si es método en USD (usd o usd_personalizado), el total transaccional es el fijo o el personalizado
    if metodo_cobro_inicial in ['usd', 'usd_personalizado']:
        if metodo_cobro_inicial == 'usd_personalizado' and total_cobro:
            total_usd_transaccion = round(total_cobro, 2)
        else:
            total_usd_transaccion = total_usd_fijo
    
    # ============================================================
    # 🔥 CORRECCIÓN 2: Usar el abono inicial en USD enviado desde el frontend
    # ============================================================
    abono_inicial_monto = data.get('abono_inicial_monto_usd', 0)
    if abono_inicial_monto <= 0:
        # Fallback: calcular con el precio fijo en USD (por si no viene del frontend)
        abono_inicial_monto = round(total_usd_fijo * (abono_inicial_porcentaje / 100), 2)
    
    # Saldo restante en USD (basado en el total transaccional)
    saldo_restante = round(total_usd_transaccion - abono_inicial_monto, 2)
    
    # Precio unitario en VES (referencial, calculado con la tasa aplicada)
    precio_unitario_ves = round(precio_unitario_usd * tasa_aplicada, 2)
    
    # Crear el apartado - guardamos total_usd como el transaccional
    apartado = Apartado(
        cliente_id=cliente_id,
        producto_id=producto_id,
        cantidad=cantidad,
        precio_unitario_usd=precio_unitario_usd,  # Precio fijo en USD
        precio_unitario_ves=precio_unitario_ves,
        tasa_aplicada=tasa_aplicada,
        metodo_cobro_inicial=metodo_cobro_inicial,
        metodo_pago_inicial=metodo_pago_inicial,
        abono_inicial_porcentaje=abono_inicial_porcentaje,
        abono_inicial_monto=abono_inicial_monto,
        saldo_restante=saldo_restante,
        total_usd=total_usd_transaccion,  # 🔥 Guardamos el total transaccional
        fecha_limite_pago=fecha_limite_pago,
        periodo_tipo=periodo_tipo,
        descontar_stock_al_apartar=descontar_stock_al_apartar,
        estado='activo'
    )
    db.session.add(apartado)
    db.session.flush()
    
    # Si se descuenta stock al apartar, restar del producto
    if descontar_stock_al_apartar:
        producto.stock -= cantidad
        db.session.add(producto)
    
    # 🔥 CORRECCIÓN CRÍTICA: Registrar el primer pago (abono inicial) con monto_ves basado en tasa_usd (BCV USD) para reflejar el valor real en bolívares
    pago_inicial = PagoApartado(
        apartado_id=apartado.id,
        monto_usd=abono_inicial_monto,
        monto_ves=round(abono_inicial_monto * tasa_usd, 2),
        tasa_aplicada=tasa_aplicada,
        metodo_cobro=metodo_cobro_inicial,
        metodo_pago=metodo_pago_inicial,
        observaciones='Abono inicial'
    )
    db.session.add(pago_inicial)
    
    # Log
    log = Log(accion='APARTADO_CREADO', 
              detalle=f'Apartado #{apartado.id} - Cliente: {cliente.nombre} {cliente.apellido} - Producto: {producto.nombre} - Saldo: ${saldo_restante:.2f}')
    db.session.add(log)
    
    db.session.commit()
    
    return jsonify({
        'mensaje': 'Apartado creado exitosamente',
        'apartado_id': apartado.id,
        'saldo_restante': saldo_restante,
        'abono_inicial': abono_inicial_monto
    }), 201

@api_bp.route('/apartados', methods=['GET'])
@login_required
def listar_apartados():
    """Lista los apartados con filtros mejorados."""
    estado = request.args.get('estado', 'activo')
    cliente_id = request.args.get('cliente_id')
    cliente_buscar = request.args.get('cliente', '').strip()
    fecha_limite = request.args.get('fecha_limite')
    
    query = Apartado.query.filter_by(estado=estado)
    
    # Filtro por cliente (ID o búsqueda por nombre/cédula)
    if cliente_id:
        query = query.filter_by(cliente_id=cliente_id)
    elif cliente_buscar:
        # Buscar clientes que coincidan con el texto
        clientes_ids = db.session.query(Cliente.id).filter(
            db.or_(
                Cliente.nombre.ilike(f'%{cliente_buscar}%'),
                Cliente.apellido.ilike(f'%{cliente_buscar}%'),
                Cliente.cedula.ilike(f'%{cliente_buscar}%')
            )
        ).subquery()
        query = query.filter(Apartado.cliente_id.in_(clientes_ids))
    
    # Filtro por fecha límite (fecha igual o anterior)
    if fecha_limite:
        try:
            fecha_limite_obj = datetime.strptime(fecha_limite, '%Y-%m-%d').date()
            query = query.filter(Apartado.fecha_limite_pago <= fecha_limite_obj)
        except ValueError:
            pass  # Ignorar si el formato no es válido
    
    apartados = query.order_by(Apartado.fecha_apartado.desc()).all()
    
    result = []
    for a in apartados:
        cliente = a.cliente
        producto = a.producto
        
        # 🔥 Obtener el pago inicial para calcular monto en VES real
        pago_inicial = PagoApartado.query.filter_by(
            apartado_id=a.id,
            observaciones='Abono inicial'
        ).first()
        abono_inicial_monto_ves = pago_inicial.monto_ves if pago_inicial else 0.0
        
        result.append({
            'id': a.id,
            'cliente': f"{cliente.nombre} {cliente.apellido}",
            'cliente_cedula': cliente.cedula,
            'producto': producto.nombre,
            'cantidad': a.cantidad,
            'precio_unitario_usd': a.precio_unitario_usd,
            'total_usd': round(a.total_usd, 2),
            'abono_inicial_monto': a.abono_inicial_monto,
            'abono_inicial_monto_ves': round(abono_inicial_monto_ves, 2),  # 🔥 NUEVO
            'saldo_restante': a.saldo_restante,
            'fecha_apartado': a.fecha_apartado.strftime('%Y-%m-%d %H:%M'),
            'fecha_limite_pago': a.fecha_limite_pago.strftime('%Y-%m-%d'),
            'estado': a.estado,
            'metodo_cobro_inicial': a.metodo_cobro_inicial,
            'tasa_aplicada': a.tasa_aplicada  # 🔥 NUEVO
        })
    
    return jsonify(result)

@api_bp.route('/apartados/<int:id>', methods=['GET'])
@login_required
def detalle_apartado(id):
    """Devuelve el detalle de un apartado con su historial de pagos."""
    apartado = Apartado.query.get_or_404(id)
    # 🔥 CORRECCIÓN: Excluir el pago inicial de la lista de pagos adicionales
    pagos = PagoApartado.query.filter_by(apartado_id=id)\
        .filter(PagoApartado.observaciones != 'Abono inicial')\
        .order_by(PagoApartado.fecha_abono.asc()).all()
    
    cliente = apartado.cliente
    producto = apartado.producto
    
    return jsonify({
        'id': apartado.id,
        'cliente': {
            'id': cliente.id,
            'nombre': cliente.nombre,
            'apellido': cliente.apellido,
            'cedula': cliente.cedula,
            'telefono': cliente.telefono,
            'direccion': cliente.direccion
        },
        'producto': {
            'id': producto.id,
            'nombre': producto.nombre,
            'categoria': producto.categoria.nombre if producto.categoria else None,
            'marca': producto.marca.nombre if producto.marca else None,
            'talla': producto.talla_ref.nombre if producto.talla_ref else None,
            'precio_usd': producto.precio_usd
        },
        'cantidad': apartado.cantidad,
        'precio_unitario_usd': apartado.precio_unitario_usd,
        'precio_unitario_ves': apartado.precio_unitario_ves,
        'tasa_aplicada': apartado.tasa_aplicada,
        'metodo_cobro_inicial': apartado.metodo_cobro_inicial,
        'metodo_pago_inicial': apartado.metodo_pago_inicial,
        'abono_inicial_porcentaje': apartado.abono_inicial_porcentaje,
        'abono_inicial_monto': apartado.abono_inicial_monto,
        'saldo_restante': apartado.saldo_restante,
        'total_usd': round(apartado.total_usd, 2),
        'fecha_apartado': apartado.fecha_apartado.strftime('%Y-%m-%d %H:%M'),
        'fecha_limite_pago': apartado.fecha_limite_pago.strftime('%Y-%m-%d'),
        'periodo_tipo': apartado.periodo_tipo,
        'descontar_stock_al_apartar': apartado.descontar_stock_al_apartar,
        'estado': apartado.estado,
        'fecha_finalizacion': apartado.fecha_finalizacion.strftime('%Y-%m-%d %H:%M') if apartado.fecha_finalizacion else None,
        'ticket_generado': apartado.ticket_generado,
        'pagos': [{
            'id': p.id,
            'monto_usd': p.monto_usd,
            'monto_ves': p.monto_ves,
            'tasa_aplicada': p.tasa_aplicada,
            'metodo_cobro': p.metodo_cobro,
            'metodo_pago': p.metodo_pago,
            'fecha_abono': p.fecha_abono.strftime('%Y-%m-%d %H:%M'),
            'observaciones': p.observaciones
        } for p in pagos]
    })

# ============================================================
# 🔥 CORRECCIÓN: ENDPOINT PARA AGREGAR PAGO (CON REDONDEO Y MARGEN)
# ============================================================
@api_bp.route('/apartados/<int:id>/pago', methods=['POST'])
@login_required
def agregar_pago_apartado(id):
    """Agrega un nuevo pago a un apartado."""
    apartado = Apartado.query.get_or_404(id)
    
    if apartado.estado != 'activo':
        return jsonify({'error': 'El apartado no está activo'}), 400
    
    data = request.get_json()
    required = ['monto_usd', 'metodo_cobro', 'metodo_pago']
    for field in required:
        if field not in data:
            return jsonify({'error': f'Falta campo {field}'}), 400
    
    try:
        monto_usd = round(float(data['monto_usd']), 2)
    except (ValueError, TypeError):
        return jsonify({'error': 'Monto inválido'}), 400
    
    metodo_cobro = data['metodo_cobro']
    metodo_pago = data['metodo_pago']
    observaciones = data.get('observaciones', '')
    
    if monto_usd <= 0:
        return jsonify({'error': 'El monto debe ser mayor a 0'}), 400
    
    # 🔥 MARGEN DE 0.01 PARA EVITAR ERRORES DE REDONDEO
    if monto_usd > apartado.saldo_restante + 0.01:
        return jsonify({'error': f'El monto excede el saldo restante (${apartado.saldo_restante:.2f})'}), 400
    
    # Obtener tasa del día para el abono
    tasas = obtener_tasas_bcv()
    tasa_usd = tasas['usd']
    tasa_aplicada = tasa_usd
    
    # Calcular monto en VES
    monto_ves = round(monto_usd * tasa_aplicada, 2)
    
    # Registrar el pago (asegurar que observaciones no sea 'Abono inicial' para no confundir)
    pago = PagoApartado(
        apartado_id=apartado.id,
        monto_usd=monto_usd,
        monto_ves=monto_ves,
        tasa_aplicada=tasa_aplicada,
        metodo_cobro=metodo_cobro,
        metodo_pago=metodo_pago,
        observaciones=observaciones or 'Abono adicional'
    )
    db.session.add(pago)
    
    # Actualizar saldo restante
    apartado.saldo_restante = round(apartado.saldo_restante - monto_usd, 2)
    
    # Log
    log = Log(accion='PAGO_APARTADO',
              detalle=f'Pago de ${monto_usd:.2f} al apartado #{apartado.id} - Saldo restante: ${apartado.saldo_restante:.2f}')
    db.session.add(log)
    
    db.session.commit()
    
    return jsonify({
        'mensaje': 'Pago registrado',
        'saldo_restante': apartado.saldo_restante,
        'apartado_estado': apartado.estado
    }), 201

# ============================================================
# 🔥 ENDPOINT FINALIZAR APARTADO (CORREGIDO: TOTAL VES = SUBTOTAL + IVA)
# 🔥 MODIFICADO: uso de obtener_proximo_numero_ticket() (secuencia estricta)
# ============================================================
@api_bp.route('/apartados/<int:id>/finalizar', methods=['POST'])
@login_required
def finalizar_apartado(id):
    """Finaliza un apartado (genera venta y ticket)."""
    apartado = Apartado.query.get_or_404(id)
    
    if apartado.estado != 'activo':
        return jsonify({'error': 'El apartado no está activo'}), 400
    
    if apartado.saldo_restante > 0:
        return jsonify({'error': f'El apartado tiene saldo pendiente (${apartado.saldo_restante:.2f})'}), 400
    
    # Si no se descontó stock al apartar, descontarlo ahora
    if not apartado.descontar_stock_al_apartar:
        producto = apartado.producto
        if producto.stock < apartado.cantidad:
            return jsonify({'error': f'Stock insuficiente para el producto {producto.nombre}'}), 400
        producto.stock -= apartado.cantidad
        db.session.add(producto)
    
    # Crear la venta
    ultimo_pago = PagoApartado.query.filter_by(apartado_id=id).order_by(PagoApartado.fecha_abono.desc()).first()
    if ultimo_pago:
        metodo_cobro = ultimo_pago.metodo_cobro
        metodo_pago = ultimo_pago.metodo_pago
    else:
        metodo_cobro = apartado.metodo_cobro_inicial
        metodo_pago = apartado.metodo_pago_inicial
    
    # 🔥 NUEVO: Obtener el próximo número de ticket (secuencia estricta)
    nuevo_ticket = obtener_proximo_numero_ticket()
    
    # Opcional: actualizar Configuracion para compatibilidad
    config = Configuracion.query.filter_by(clave='ultimo_ticket').first()
    if config:
        config.valor = str(nuevo_ticket)
    else:
        config = Configuracion(clave='ultimo_ticket', valor=str(nuevo_ticket))
        db.session.add(config)
    db.session.commit()
    
    tasas = obtener_tasas_bcv()
    tasa_usd = tasas['usd']
    tasa_eur = tasas['eur']
    tasa_personalizada = obtener_tasa_personalizada()
    
    producto = apartado.producto
    precio_final_usd = apartado.precio_unitario_usd
    subtotal_usd = precio_final_usd * apartado.cantidad
    
    if metodo_cobro in ['usd', 'usd_personalizado']:
        moneda_cobro = 'USD'
        total_cobro = subtotal_usd
        tasa_aplicada = 1.0
        subtotal_ves = subtotal_usd * tasa_usd
    else:
        moneda_cobro = 'VES'
        if metodo_cobro == 'bs_personalizado':
            total_cobro = subtotal_usd * tasa_usd
            tasa_aplicada = tasa_usd
        else:
            total_cobro = subtotal_usd * tasa_usd
            tasa_aplicada = tasa_usd
        subtotal_ves = total_cobro
    
    # ============================================================
    # 🔥 CORRECCIÓN IVA: Obtener porcentaje y calcular total con IVA
    # ============================================================
    iva_porcentaje_cfg = Configuracion.query.filter_by(clave='ticket_iva_porcentaje').first()
    iva_porcentaje = float(iva_porcentaje_cfg.valor if iva_porcentaje_cfg else 0)

    if iva_porcentaje > 0:
        monto_iva_ves = subtotal_ves * (iva_porcentaje / 100)
        total_ves_final = subtotal_ves + monto_iva_ves
    else:
        total_ves_final = subtotal_ves

    if moneda_cobro == 'VES':
        total_cobro = total_ves_final

    venta = Venta(
        cliente_id=apartado.cliente_id,
        numero_ticket=nuevo_ticket,
        total_usd=subtotal_usd,
        total_ves=total_ves_final,   # ← CON IVA
        total_eur=subtotal_usd * tasa_eur,
        tasa_bcv_usd=tasa_usd,
        tasa_bcv_eur=tasa_eur,
        tasa_personalizada=tasa_personalizada,
        metodo_pago=metodo_pago,
        metodo_cobro=metodo_cobro,
        tasa_aplicada=tasa_aplicada,
        moneda_cobro=moneda_cobro,
        total_cobro=total_cobro,     # ← CON IVA si es VES
        subtotal_usd=subtotal_usd,
        subtotal_ves=subtotal_ves,   # ← BASE IMPONIBLE
        es_apartado=True,
        apartado_id=apartado.id,
        anulado=False  # 🔥 NUEVO
    )
    db.session.add(venta)
    db.session.flush()
    
    precio_unitario_ves = round(precio_final_usd * tasa_usd, 2)
    if moneda_cobro == 'VES':
        precio_unitario_usd = round(precio_unitario_ves / tasa_usd, 2) if tasa_usd > 0 else precio_final_usd
    else:
        precio_unitario_usd = precio_final_usd
    
    detalle = DetalleVenta(
        venta_id=venta.id,
        producto_id=producto.id,
        cantidad=apartado.cantidad,
        precio_unitario_usd=precio_unitario_usd,
        precio_unitario_ves=precio_unitario_ves,
        descuento_porcentaje=0,
        precio_original_usd=precio_final_usd
    )
    db.session.add(detalle)
    
    total_usd_ajustado = sum(d.precio_unitario_usd * d.cantidad for d in venta.detalles)
    venta.total_usd = round(total_usd_ajustado, 2)
    venta.subtotal_usd = round(total_usd_ajustado, 2)
    
    apartado.estado = 'pagado'
    apartado.fecha_finalizacion = now_venezuela()
    apartado.ticket_generado = True
    
    log = Log(accion='APARTADO_FINALIZADO',
              detalle=f'Apartado #{apartado.id} finalizado - Venta #{venta.id} - Ticket {nuevo_ticket}')
    db.session.add(log)
    db.session.commit()
    
    ticket_path = f'tickets/ticket_{venta.id}.png'
    venta.ticket_imagen = ticket_path
    db.session.commit()
    
    # ============================================================
    # 🔥 IMPRESIÓN AUTOMÁTICA CON NUEVO GENERADOR POS-58 (FECHA LOCAL)
    # ============================================================
    try:
        config_imp = ConfiguracionImpresora.query.first()
        max_chars = 32 if (config_imp and config_imp.tamano_papel == '58mm') else 42

        claves_ticket = [
            'ticket_tienda_nombre', 'ticket_rif', 'ticket_telefono_tienda', 'ticket_direccion_tienda',
            'ticket_mostrar_rif', 'ticket_mostrar_telefono', 'ticket_mostrar_direccion_cliente',
            'ticket_mostrar_direccion_tienda', 'ticket_mensaje', 'ticket_url',
            'ticket_subtotal_usd', 'ticket_iva_porcentaje'
        ]
        configs_ticket = {}
        for clave in claves_ticket:
            cfg = Configuracion.query.filter_by(clave=clave).first()
            configs_ticket[clave] = cfg.valor if cfg else None

        config_ticket = {
            'nombre_tienda': configs_ticket.get('ticket_tienda_nombre', 'ELEMENTS STORE'),
            'rif': configs_ticket.get('ticket_rif', ''),
            'telefono_tienda': configs_ticket.get('ticket_telefono_tienda', ''),
            'direccion_tienda': configs_ticket.get('ticket_direccion_tienda', ''),
            'mostrar_rif': configs_ticket.get('ticket_mostrar_rif', 'true').lower() == 'true',
            'mostrar_telefono': configs_ticket.get('ticket_mostrar_telefono', 'true').lower() == 'true',
            'mostrar_direccion_tienda': configs_ticket.get('ticket_mostrar_direccion_tienda', 'true').lower() == 'true',
            'mostrar_direccion_cliente': configs_ticket.get('ticket_mostrar_direccion_cliente', 'true').lower() == 'true',
            'mostrar_subtotal_usd': configs_ticket.get('ticket_subtotal_usd', 'false').lower() == 'true',
            'porcentaje_iva': float(configs_ticket.get('ticket_iva_porcentaje', '0') or '0'),
            'mensaje_agradecimiento': configs_ticket.get('ticket_mensaje', '¡Gracias por su compra!'),
            'url_web': configs_ticket.get('ticket_url', 'www.elementsstore.com')
        }

        # ============================================================
        # 🔥 OBTENER DATOS DEL CLIENTE DESDE EL JSON (prioridad) O DE LA BD
        # ============================================================
        cliente = venta.cliente
        # Para apartados, los datos del cliente ya están en la BD; pero por si acaso:
        cliente_nombre = data.get('cliente_nombre', '').strip()
        cliente_cedula = data.get('cliente_cedula', '').strip()
        cliente_telefono = data.get('cliente_telefono', '').strip()
        cliente_direccion = data.get('cliente_direccion', '').strip()

        if not cliente_nombre:
            cliente_nombre = f"{cliente.nombre} {cliente.apellido}" if cliente else "Consumidor Final"
        if not cliente_cedula:
            cliente_cedula = cliente.cedula if cliente else ""
        if not cliente_telefono:
            cliente_telefono = cliente.telefono if cliente else ""
        if not cliente_direccion:
            cliente_direccion = cliente.direccion if cliente else ""

        detalles = DetalleVenta.query.filter_by(venta_id=venta.id).all()

        # 🔥 CONVERTIR FECHA A LOCAL
        if venta.fecha.tzinfo is None:
            fecha_utc = pytz.UTC.localize(venta.fecha)
            fecha_local = fecha_utc.astimezone(pytz.timezone('America/Caracas'))
        else:
            fecha_local = venta.fecha.astimezone(pytz.timezone('America/Caracas'))
        fecha_12h = fecha_local.strftime('%d/%m/%Y %I:%M %p')

        datos_venta = {
            'num_nota': f"{venta.numero_ticket:05d}",
            'fecha_hora_12h': fecha_12h,
            'fecha_hora': venta.fecha.strftime('%d/%m/%Y %H:%M'),
            'cliente_nombre': sanitizar_texto(cliente_nombre),
            'cliente_cedula': sanitizar_texto(cliente_cedula),
            'cliente_telefono': sanitizar_texto(cliente_telefono),
            'cliente_direccion': sanitizar_texto(cliente_direccion),
            'productos': [],
            'subtotal_usd': venta.subtotal_usd or 0.0,
            'total_usd': venta.total_usd or 0.0,
            'subtotal_ves': venta.subtotal_ves or 0.0,
            'tasa_bcv': venta.tasa_bcv_usd or 0.0,
            'modo_pago': venta.metodo_pago or 'Efectivo'
        }
        for det in detalles:
            producto = det.producto
            datos_venta['productos'].append({
                'nombre': producto.nombre if producto else "Producto eliminado",
                'cantidad': det.cantidad,
                'precio_unitario': det.precio_unitario_usd,
                'total': det.precio_unitario_usd * det.cantidad,
                'descuento_porcentaje': det.descuento_porcentaje or 0
            })

        texto_ticket = generar_ticket_pos58(datos_venta, config_ticket, max_chars)

        if config_imp and config_imp.nombre_impresora:
            imprimir_ticket(texto_ticket, config_imp.nombre_impresora, copias=config_imp.copias or 1, cortar=config_imp.cortar_auto)
            print(f"✅ Ticket POS-58 impreso para apartado #{id} -> venta #{venta.id}")
    except Exception as e:
        print(f"⚠️ Error al imprimir ticket de apartado (POS-58): {e}")

    return jsonify({
        'mensaje': 'Apartado finalizado exitosamente',
        'venta_id': venta.id,
        'numero_ticket': nuevo_ticket,
        'ticket_url': f'/generar-ticket/{venta.id}'
    }), 200

@api_bp.route('/apartados/<int:id>/reintegrar', methods=['POST'])
@login_required
def reintegrar_apartado(id):
    """Reintegra un apartado (devuelve stock si se descontó y cambia estado)."""
    apartado = Apartado.query.get_or_404(id)
    
    if apartado.estado != 'activo':
        return jsonify({'error': 'El apartado no está activo'}), 400
    
    # Si se descontó stock al apartar, devolverlo
    if apartado.descontar_stock_al_apartar:
        producto = apartado.producto
        producto.stock += apartado.cantidad
        db.session.add(producto)
    
    # Cambiar estado
    apartado.estado = 'reintegrado'
    apartado.fecha_finalizacion = now_venezuela()
    
    # Log
    log = Log(accion='APARTADO_REINTEGRADO',
              detalle=f'Apartado #{apartado.id} reintegrado - Producto: {apartado.producto.nombre}')
    db.session.add(log)
    
    db.session.commit()
    
    return jsonify({
        'mensaje': 'Apartado reintegrado exitosamente'
    }), 200

# ============================================================
# NUEVAS API: REPORTES DE ABONOS Y GLOBALES (CORREGIDAS CON CLASIFICACIÓN ROBUSTA)
# ============================================================

@api_bp.route('/reportes/abonos', methods=['GET'])
@login_required
def reportes_abonos():
    """Datos para la pestaña de Abonos de Apartados.
       Devuelve TODOS los pagos (abonos) sin filtrar por estado del apartado,
       ya que el abono es un ingreso real y debe contabilizarse siempre.
    """
    fecha_desde = request.args.get('fecha_desde')
    fecha_hasta = request.args.get('fecha_hasta')
    
    # Parsear fechas
    desde = None
    hasta = None
    if fecha_desde:
        desde = datetime.strptime(fecha_desde, '%Y-%m-%d')
    if fecha_hasta:
        hasta = datetime.strptime(fecha_hasta, '%Y-%m-%d') + timedelta(days=1)
    
    # ============================================================
    # 🔥 CORRECCIÓN: Obtener TODOS los pagos (sin filtrar por estado)
    # ============================================================
    query_pagos = PagoApartado.query
    if desde:
        query_pagos = query_pagos.filter(PagoApartado.fecha_abono >= desde)
    if hasta:
        query_pagos = query_pagos.filter(PagoApartado.fecha_abono < hasta)
    
    pagos = query_pagos.all()
    
    # ============================================================
    # 2. Separar abonos por día por moneda de cobro (usando clasificación robusta)
    # ============================================================
    abonos_por_dia_usd = {}
    abonos_por_dia_ves = {}
    total_abonos_usd = 0.0
    total_abonos_ves = 0.0
    
    for p in pagos:
        dia = p.fecha_abono.strftime('%Y-%m-%d')
        moneda = _clasificar_pago(p)
        if moneda == 'USD':
            total_abonos_usd += p.monto_usd
            abonos_por_dia_usd[dia] = abonos_por_dia_usd.get(dia, 0) + p.monto_usd
        else:
            total_abonos_ves += p.monto_ves
            abonos_por_dia_ves[dia] = abonos_por_dia_ves.get(dia, 0) + p.monto_ves
    
    abonos_por_dia_usd_list = [{'fecha': d, 'total': round(m, 2)} for d, m in abonos_por_dia_usd.items()]
    abonos_por_dia_ves_list = [{'fecha': d, 'total': round(m, 2)} for d, m in abonos_por_dia_ves.items()]
    
    # ============================================================
    # 3. Top productos apartados (sumando todos los pagos, sin filtro de estado)
    #    Se mantiene la consulta SQL con ajuste para incluir nulos en VES
    #    🔥 MODIFICADO: Ahora incluye la cantidad (vendido)
    # ============================================================
    # Top productos apartados en USD
    top_apartados_usd_query = db.session.query(
        Producto.nombre,
        func.sum(PagoApartado.monto_usd).label('total'),
        func.count(Apartado.id.distinct()).label('vendido')  # número de apartados distintos por producto
    ).join(Apartado, Apartado.id == PagoApartado.apartado_id)\
     .join(Producto, Producto.id == Apartado.producto_id)\
     .filter(PagoApartado.fecha_abono >= (desde if fecha_desde else datetime(2000,1,1)))\
     .filter(PagoApartado.fecha_abono < (hasta if fecha_hasta else datetime(2100,1,1)))\
     .filter(PagoApartado.metodo_cobro.in_(['usd', 'usd_personalizado']))\
     .group_by(Producto.id)\
     .order_by(func.sum(PagoApartado.monto_usd).desc())\
     .limit(5).all()

    top_apartados_usd_list = []
    for row in top_apartados_usd_query:
        top_apartados_usd_list.append({
            'nombre': row.nombre,
            'total': round(row.total, 2),
            'vendido': int(row.vendido)
        })

    # Top productos apartados en VES
    top_apartados_ves_query = db.session.query(
        Producto.nombre,
        func.sum(PagoApartado.monto_ves).label('total'),
        func.count(Apartado.id.distinct()).label('vendido')
    ).join(Apartado, Apartado.id == PagoApartado.apartado_id)\
     .join(Producto, Producto.id == Apartado.producto_id)\
     .filter(PagoApartado.fecha_abono >= (desde if fecha_desde else datetime(2000,1,1)))\
     .filter(PagoApartado.fecha_abono < (hasta if fecha_hasta else datetime(2100,1,1)))\
     .filter(
         or_(
             PagoApartado.metodo_cobro.notin_(['usd', 'usd_personalizado']),
             PagoApartado.metodo_cobro == None
         )
     )\
     .group_by(Producto.id)\
     .order_by(func.sum(PagoApartado.monto_ves).desc())\
     .limit(5).all()

    top_apartados_ves_list = []
    for row in top_apartados_ves_query:
        top_apartados_ves_list.append({
            'nombre': row.nombre,
            'total': round(row.total, 2),
            'vendido': int(row.vendido)
        })
    
    # Obtener tasas
    tasas = obtener_tasas_bcv()
    tasa_usd = tasas['usd']
    tasa_eur = tasas['eur']
    
    # Referencias para totales en VES
    ref_abonos_ves_usd = total_abonos_ves / tasa_usd if tasa_usd > 0 else 0
    ref_abonos_ves_eur = total_abonos_ves / tasa_eur if tasa_eur > 0 else 0

    # Referencias para totales en USD
    ref_abonos_usd_ves = total_abonos_usd * tasa_usd
    ref_abonos_usd_eur = total_abonos_usd * tasa_eur
    
    # ============================================================
    # 🔥 CORRECCIÓN: GASTOS CLASIFICADOS POR MONEDA REAL (igual que en resumen_reportes)
    # ============================================================
    gastos_query = Gasto.query
    if desde:
        gastos_query = gastos_query.filter(Gasto.fecha >= desde)
    if hasta:
        gastos_query = gastos_query.filter(Gasto.fecha < hasta)
    gastos = gastos_query.all()
    
    total_gastos_usd = 0.0
    total_gastos_ves = 0.0
    
    for g in gastos:
        if g.moneda:
            if g.moneda == 'USD':
                total_gastos_usd += g.monto_usd
            elif g.moneda == 'VES':
                total_gastos_ves += g.monto_ves if g.monto_ves else g.monto_usd * tasa_usd
        else:
            # Inferir si no tiene moneda definida
            monto_usd_rounded = round(g.monto_usd, 2)
            monto_ves_rounded = round(g.monto_ves, 2) if g.monto_ves else 0.0
            es_usd_entero = abs(monto_usd_rounded - round(monto_usd_rounded)) < 0.01
            es_ves_entero = abs(monto_ves_rounded - round(monto_ves_rounded)) < 0.01

            if es_usd_entero and not es_ves_entero:
                moneda = 'USD'
            elif es_ves_entero and not es_usd_entero:
                moneda = 'VES'
            else:
                diff_usd_ves = abs(g.monto_usd * tasa_usd - g.monto_ves)
                diff_ves_usd = abs(g.monto_ves / tasa_usd - g.monto_usd)
                moneda = 'USD' if diff_usd_ves < diff_ves_usd else 'VES'

            if moneda == 'USD':
                total_gastos_usd += g.monto_usd
            else:
                total_gastos_ves += g.monto_ves if g.monto_ves else g.monto_usd * tasa_usd

    ref_gastos_usd_ves = total_gastos_usd * tasa_usd
    ref_gastos_usd_eur = total_gastos_usd * tasa_eur
    ref_gastos_ves_usd = total_gastos_ves / tasa_usd if tasa_usd > 0 else 0
    ref_gastos_ves_eur = total_gastos_ves / tasa_eur if tasa_eur > 0 else 0
    
    # 🔥 CORRECCIÓN: Ganancia neta = solo abonos, sin restar gastos (pestaña exclusiva de abonos)
    ganancia_neta_usd = total_abonos_usd
    ganancia_neta_ves = total_abonos_ves

    ref_ganancia_usd_ves = ganancia_neta_usd * tasa_usd
    ref_ganancia_usd_eur = ganancia_neta_usd * tasa_eur
    ref_ganancia_ves_usd = ganancia_neta_ves / tasa_usd if tasa_usd > 0 else 0
    ref_ganancia_ves_eur = ganancia_neta_ves / tasa_eur if tasa_eur > 0 else 0
    
    # Clientes que han pagado (finalizados) con filtro de fechas
    clientes_pagados_query = Apartado.query.filter(
        Apartado.estado == 'pagado'
    )
    if desde:
        clientes_pagados_query = clientes_pagados_query.filter(Apartado.fecha_finalizacion >= desde)
    if hasta:
        clientes_pagados_query = clientes_pagados_query.filter(Apartado.fecha_finalizacion < hasta)
    
    clientes_pagados = clientes_pagados_query.all()
    clientes_list = []
    for a in clientes_pagados:
        cliente = a.cliente
        clientes_list.append({
            'cliente': f"{cliente.nombre} {cliente.apellido}",
            'cedula': cliente.cedula,
            'producto': a.producto.nombre,
            'cantidad': a.cantidad,
            'total_usd': round(a.total_usd, 2),
            'total_ves': round(a.cantidad * a.precio_unitario_ves, 2),
            'metodo_cobro': a.metodo_cobro_inicial,
            'metodo_pago': a.metodo_pago_inicial,
            'fecha_finalizacion': a.fecha_finalizacion.strftime('%Y-%m-%d %H:%M')
        })
    
    # Resumen diario/semanal/mensual (simplificado con clasificación robusta)
    hoy = datetime.now().date()
    inicio_dia = datetime(hoy.year, hoy.month, hoy.day, 0, 0, 0)
    inicio_semana = hoy - timedelta(days=hoy.weekday())
    inicio_semana = datetime(inicio_semana.year, inicio_semana.month, inicio_semana.day, 0, 0, 0)
    inicio_mes = datetime(hoy.year, hoy.month, 1, 0, 0, 0)
    
    def total_abonos_periodo(inicio, fin):
        pagos_periodo = PagoApartado.query.filter(PagoApartado.fecha_abono >= inicio, PagoApartado.fecha_abono < fin).all()
        usd = 0
        ves = 0
        for p in pagos_periodo:
            if _clasificar_pago(p) == 'USD':
                usd += p.monto_usd
            else:
                ves += p.monto_ves
        return {'usd': usd, 'ves': ves}
    
    resumen = {
        'diario': total_abonos_periodo(inicio_dia, inicio_dia + timedelta(days=1)),
        'semanal': total_abonos_periodo(inicio_semana, inicio_semana + timedelta(days=7)),
        'mensual': total_abonos_periodo(inicio_mes, inicio_mes + timedelta(days=32))
    }
    
    return jsonify({
        # Tarjetas de resumen (siempre ambas monedas)
        'total_abonos_usd': round(total_abonos_usd, 2),
        'total_abonos_ves': round(total_abonos_ves, 2),
        'referencia_abonos_usd_ves': round(ref_abonos_usd_ves, 2),
        'referencia_abonos_usd_eur': round(ref_abonos_usd_eur, 2),
        'referencia_abonos_ves_usd': round(ref_abonos_ves_usd, 2),
        'referencia_abonos_ves_eur': round(ref_abonos_ves_eur, 2),
        'total_gastos_usd': round(total_gastos_usd, 2),
        'total_gastos_ves': round(total_gastos_ves, 2),
        'referencia_gastos_usd_ves': round(ref_gastos_usd_ves, 2),
        'referencia_gastos_usd_eur': round(ref_gastos_usd_eur, 2),
        'referencia_gastos_ves_usd': round(ref_gastos_ves_usd, 2),
        'referencia_gastos_ves_eur': round(ref_gastos_ves_eur, 2),
        'ganancia_neta_usd': round(ganancia_neta_usd, 2),
        'ganancia_neta_ves': round(ganancia_neta_ves, 2),
        'referencia_ganancia_usd_ves': round(ref_ganancia_usd_ves, 2),
        'referencia_ganancia_usd_eur': round(ref_ganancia_usd_eur, 2),
        'referencia_ganancia_ves_usd': round(ref_ganancia_ves_usd, 2),
        'referencia_ganancia_ves_eur': round(ref_ganancia_ves_eur, 2),
        # Gráficas separadas por moneda
        'abonos_por_dia_usd': abonos_por_dia_usd_list,
        'abonos_por_dia_ves': abonos_por_dia_ves_list,
        'top_apartados_usd': top_apartados_usd_list,
        'top_apartados_ves': top_apartados_ves_list,
        # Tabla de clientes pagados (siempre ambas)
        'clientes_pagados': clientes_list,
        # Resumen diario/semanal/mensual
        'resumen': {
            'diario': {'usd': round(resumen['diario']['usd'], 2), 'ves': round(resumen['diario']['ves'], 2)},
            'semanal': {'usd': round(resumen['semanal']['usd'], 2), 'ves': round(resumen['semanal']['ves'], 2)},
            'mensual': {'usd': round(resumen['mensual']['usd'], 2), 'ves': round(resumen['mensual']['ves'], 2)}
        },
        'tasas': {
            'usd': tasa_usd,
            'eur': tasa_eur
        }
    })

@api_bp.route('/reportes/globales', methods=['GET'])
@login_required
def reportes_globales():
    """Datos combinados: Ventas normales + Abonos de apartados pagados."""
    fecha_desde = request.args.get('fecha_desde')
    fecha_hasta = request.args.get('fecha_hasta')
    
    # Parsear fechas
    desde = None
    hasta = None
    if fecha_desde:
        desde = datetime.strptime(fecha_desde, '%Y-%m-%d')
    if fecha_hasta:
        hasta = datetime.strptime(fecha_hasta, '%Y-%m-%d') + timedelta(days=1)
    
    # ============================================================
    # 🔧 1. VENTAS NORMALES (excluyendo apartados y anuladas)
    # ============================================================
    ventas_query = Venta.query.filter(Venta.es_apartado == False, Venta.anulado == False)
    if desde:
        ventas_query = ventas_query.filter(Venta.fecha >= desde)
    if hasta:
        ventas_query = ventas_query.filter(Venta.fecha < hasta)
    ventas = ventas_query.all()
    
    # ============================================================
    # 🔧 2. PAGOS DE APARTADOS (todos los pagos, sin filtrar por estado)
    # ============================================================
    pagos_apartados_query = PagoApartado.query
    if desde:
        pagos_apartados_query = pagos_apartados_query.filter(PagoApartado.fecha_abono >= desde)
    if hasta:
        pagos_apartados_query = pagos_apartados_query.filter(PagoApartado.fecha_abono < hasta)
    pagos_apartados = pagos_apartados_query.all()
    
    # ============================================================
    # 🔧 3. GASTOS
    # ============================================================
    gastos_query = Gasto.query
    if desde:
        gastos_query = gastos_query.filter(Gasto.fecha >= desde)
    if hasta:
        gastos_query = gastos_query.filter(Gasto.fecha < hasta)
    gastos = gastos_query.all()
    
    # Obtener tasa de referencia (para conversiones)
    if ventas:
        tasa_usd = ventas[0].tasa_bcv_usd or 1.0
        tasa_eur = ventas[0].tasa_bcv_eur or 1.0
    else:
        tasas = obtener_tasas_bcv()
        tasa_usd = tasas['usd'] or 1.0
        tasa_eur = tasas['eur'] or 1.0
    
    # ============================================================
    # 🔧 4. CALCULAR TOTALES COMBINADOS (usando clasificación robusta para abonos)
    # ============================================================
    total_ventas_usd = sum(v.total_usd for v in ventas if v.moneda_cobro == 'USD')
    total_ventas_ves = sum(v.total_ves for v in ventas if v.moneda_cobro == 'VES')
    
    # Abonos en USD y VES (todos los pagos, clasificados robustamente)
    abonos_usd = 0.0
    abonos_ves = 0.0
    for p in pagos_apartados:
        if _clasificar_pago(p) == 'USD':
            abonos_usd += p.monto_usd
        else:
            abonos_ves += p.monto_ves
    
    total_ventas_usd_global = total_ventas_usd + abonos_usd
    total_ventas_ves_global = total_ventas_ves + abonos_ves
    
    # ============================================================
    # 🔥 CORRECCIÓN CRÍTICA: GASTOS CLASIFICADOS POR MONEDA REAL
    # (misma lógica que resumen_reportes para evitar duplicados)
    # ============================================================
    total_gastos_usd = 0.0
    total_gastos_ves = 0.0
    
    for g in gastos:
        if g.moneda:
            if g.moneda == 'USD':
                total_gastos_usd += g.monto_usd
            elif g.moneda == 'VES':
                total_gastos_ves += g.monto_ves if g.monto_ves else g.monto_usd * tasa_usd
        else:
            # Inferir si no tiene moneda definida
            monto_usd_rounded = round(g.monto_usd, 2)
            monto_ves_rounded = round(g.monto_ves, 2) if g.monto_ves else 0.0
            es_usd_entero = abs(monto_usd_rounded - round(monto_usd_rounded)) < 0.01
            es_ves_entero = abs(monto_ves_rounded - round(monto_ves_rounded)) < 0.01

            if es_usd_entero and not es_ves_entero:
                moneda = 'USD'
            elif es_ves_entero and not es_usd_entero:
                moneda = 'VES'
            else:
                diff_usd_ves = abs(g.monto_usd * tasa_usd - g.monto_ves)
                diff_ves_usd = abs(g.monto_ves / tasa_usd - g.monto_usd)
                moneda = 'USD' if diff_usd_ves < diff_ves_usd else 'VES'

            if moneda == 'USD':
                total_gastos_usd += g.monto_usd
            else:
                total_gastos_ves += g.monto_ves if g.monto_ves else g.monto_usd * tasa_usd
    
    ganancia_neta_usd = total_ventas_usd_global - total_gastos_usd
    ganancia_neta_ves = total_ventas_ves_global - total_gastos_ves
    
    # ============================================================
    # 🔧 5. REFERENCIAS DE CONVERSIÓN
    # ============================================================
    ref_ventas_usd_ves = total_ventas_usd_global * tasa_usd
    ref_ventas_usd_eur = total_ventas_usd_global * tasa_eur
    ref_ventas_ves_usd = total_ventas_ves_global / tasa_usd if tasa_usd > 0 else 0
    ref_ventas_ves_eur = total_ventas_ves_global / tasa_eur if tasa_eur > 0 else 0
    
    ref_gastos_usd_ves = total_gastos_usd * tasa_usd
    ref_gastos_usd_eur = total_gastos_usd * tasa_eur
    ref_gastos_ves_usd = total_gastos_ves / tasa_usd if tasa_usd > 0 else 0
    ref_gastos_ves_eur = total_gastos_ves / tasa_eur if tasa_eur > 0 else 0
    
    ref_ganancia_usd_ves = ganancia_neta_usd * tasa_usd
    ref_ganancia_usd_eur = ganancia_neta_usd * tasa_eur
    ref_ganancia_ves_usd = ganancia_neta_ves / tasa_usd if tasa_usd > 0 else 0
    ref_ganancia_ves_eur = ganancia_neta_ves / tasa_eur if tasa_eur > 0 else 0
    
    # ============================================================
    # 🔧 6. VENTAS POR DÍA (combinadas, con clasificación robusta para abonos)
    # ============================================================
    ventas_por_dia_usd = {}
    ventas_por_dia_ves = {}
    
    # Ventas normales (no anuladas)
    for v in ventas:
        dia = v.fecha.strftime('%Y-%m-%d')
        if v.moneda_cobro == 'USD':
            ventas_por_dia_usd[dia] = ventas_por_dia_usd.get(dia, 0) + v.total_usd
        elif v.moneda_cobro == 'VES':
            ventas_por_dia_ves[dia] = ventas_por_dia_ves.get(dia, 0) + v.total_ves
    
    # Abonos de apartados (todos)
    for p in pagos_apartados:
        dia = p.fecha_abono.strftime('%Y-%m-%d')
        if _clasificar_pago(p) == 'USD':
            ventas_por_dia_usd[dia] = ventas_por_dia_usd.get(dia, 0) + p.monto_usd
        else:
            ventas_por_dia_ves[dia] = ventas_por_dia_ves.get(dia, 0) + p.monto_ves
    
    ventas_por_dia_usd_list = [{'fecha': d, 'total': round(m, 2)} for d, m in ventas_por_dia_usd.items()]
    ventas_por_dia_ves_list = [{'fecha': d, 'total': round(m, 2)} for d, m in ventas_por_dia_ves.items()]
    
    # ============================================================
    # 🔧 7. TOP PRODUCTOS GLOBALES (combinados) - AHORA INCLUYE CANTIDAD
    # ============================================================
    from collections import defaultdict
    
    # Diccionarios para totales y cantidades combinadas
    global_usd_totals = defaultdict(float)
    global_usd_counts = defaultdict(int)
    global_ves_totals = defaultdict(float)
    global_ves_counts = defaultdict(int)
    
    # Ventas USD (no anuladas)
    ventas_usd_detalle = db.session.query(
        Producto.nombre,
        func.sum(DetalleVenta.cantidad).label('cantidad'),
        func.sum(DetalleVenta.precio_unitario_usd * DetalleVenta.cantidad).label('total')
    ).join(DetalleVenta, DetalleVenta.producto_id == Producto.id)\
     .join(Venta, Venta.id == DetalleVenta.venta_id)\
     .filter(Venta.es_apartado == False)\
     .filter(Venta.anulado == False)\
     .filter(Venta.moneda_cobro == 'USD')\
     .filter(Venta.fecha >= (desde if fecha_desde else datetime(2000,1,1)))\
     .filter(Venta.fecha < (hasta if fecha_hasta else datetime(2100,1,1)))\
     .group_by(Producto.id)\
     .order_by(func.sum(DetalleVenta.precio_unitario_usd * DetalleVenta.cantidad).desc()).all()
    
    for row in ventas_usd_detalle:
        global_usd_totals[row.nombre] += row.total
        global_usd_counts[row.nombre] += int(row.cantidad)
    
    # Abonos USD
    abonos_usd_detalle = db.session.query(
        Producto.nombre,
        func.count(Apartado.id.distinct()).label('cantidad'),
        func.sum(PagoApartado.monto_usd).label('total')
    ).join(Apartado, Apartado.id == PagoApartado.apartado_id)\
     .join(Producto, Producto.id == Apartado.producto_id)\
     .filter(PagoApartado.fecha_abono >= (desde if fecha_desde else datetime(2000,1,1)))\
     .filter(PagoApartado.fecha_abono < (hasta if fecha_hasta else datetime(2100,1,1)))\
     .filter(PagoApartado.metodo_cobro.in_(['usd', 'usd_personalizado']))\
     .group_by(Producto.id).all()
    
    for row in abonos_usd_detalle:
        global_usd_totals[row.nombre] += row.total
        global_usd_counts[row.nombre] += int(row.cantidad)
    
    # Ventas VES (no anuladas)
    ventas_ves_detalle = db.session.query(
        Producto.nombre,
        func.sum(DetalleVenta.cantidad).label('cantidad'),
        func.sum(DetalleVenta.precio_unitario_ves * DetalleVenta.cantidad).label('total')
    ).join(DetalleVenta, DetalleVenta.producto_id == Producto.id)\
     .join(Venta, Venta.id == DetalleVenta.venta_id)\
     .filter(Venta.es_apartado == False)\
     .filter(Venta.anulado == False)\
     .filter(Venta.moneda_cobro == 'VES')\
     .filter(Venta.fecha >= (desde if fecha_desde else datetime(2000,1,1)))\
     .filter(Venta.fecha < (hasta if fecha_hasta else datetime(2100,1,1)))\
     .group_by(Producto.id).all()
    
    for row in ventas_ves_detalle:
        global_ves_totals[row.nombre] += row.total
        global_ves_counts[row.nombre] += int(row.cantidad)
    
    # Abonos VES
    abonos_ves_detalle = db.session.query(
        Producto.nombre,
        func.count(Apartado.id.distinct()).label('cantidad'),
        func.sum(PagoApartado.monto_ves).label('total')
    ).join(Apartado, Apartado.id == PagoApartado.apartado_id)\
     .join(Producto, Producto.id == Apartado.producto_id)\
     .filter(PagoApartado.fecha_abono >= (desde if fecha_desde else datetime(2000,1,1)))\
     .filter(PagoApartado.fecha_abono < (hasta if fecha_hasta else datetime(2100,1,1)))\
     .filter(
         or_(
             PagoApartado.metodo_cobro.notin_(['usd', 'usd_personalizado']),
             PagoApartado.metodo_cobro == None
         )
     )\
     .group_by(Producto.id).all()
    
    for row in abonos_ves_detalle:
        global_ves_totals[row.nombre] += row.total
        global_ves_counts[row.nombre] += int(row.cantidad)
    
    # Construir listas finales
    top_global_usd_list = []
    for nombre in global_usd_totals:
        top_global_usd_list.append({
            'nombre': nombre,
            'total': round(global_usd_totals[nombre], 2),
            'vendido': global_usd_counts[nombre]
        })
    top_global_usd_list.sort(key=lambda x: x['total'], reverse=True)
    top_global_usd_list = top_global_usd_list[:5]
    
    top_global_ves_list = []
    for nombre in global_ves_totals:
        top_global_ves_list.append({
            'nombre': nombre,
            'total': round(global_ves_totals[nombre], 2),
            'vendido': global_ves_counts[nombre]
        })
    top_global_ves_list.sort(key=lambda x: x['total'], reverse=True)
    top_global_ves_list = top_global_ves_list[:5]
    
    # ============================================================
    # 🔧 8. MÉTODOS DE PAGO COMBINADOS (nuevo formato)
    # ============================================================
    metodos = []
    
    for v in ventas:
        moneda_real = v.moneda_cobro
        if moneda_real == 'USD':
            monto = v.total_cobro
        else:
            monto = v.total_ves
        metodos.append({
            'metodo': v.metodo_pago or 'Otro',
            'moneda': moneda_real,
            'monto': monto
        })
    
    for p in pagos_apartados:
        moneda_real = _clasificar_pago(p)
        if moneda_real == 'USD':
            monto = p.monto_usd
        else:
            monto = p.monto_ves
        metodos.append({
            'metodo': p.metodo_pago or 'Otro',
            'moneda': moneda_real,
            'monto': monto
        })
    
    # ============================================================
    # 🔧 9. COSTO TOTAL DE INVENTARIO
    # ============================================================
    productos = Producto.query.all()
    costo_total_inventario = 0.0
    for p in productos:
        costo = p.costo_usd if p.costo_usd is not None else 0.0
        stock = p.stock if p.stock is not None else 0
        costo_total_inventario += costo * stock
    costo_total_inventario = round(costo_total_inventario, 2)
    
    # ============================================================
    # 🔧 10. RESPUESTA
    # ============================================================
    return jsonify({
        'total_ventas_usd': round(total_ventas_usd_global, 2),
        'total_ventas_ves': round(total_ventas_ves_global, 2),
        'referencia_ventas_usd_ves': round(ref_ventas_usd_ves, 2),
        'referencia_ventas_usd_eur': round(ref_ventas_usd_eur, 2),
        'referencia_ventas_ves_usd': round(ref_ventas_ves_usd, 2),
        'referencia_ventas_ves_eur': round(ref_ventas_ves_eur, 2),
        'total_gastos_usd': round(total_gastos_usd, 2),
        'total_gastos_ves': round(total_gastos_ves, 2),
        'referencia_gastos_usd_ves': round(ref_gastos_usd_ves, 2),
        'referencia_gastos_usd_eur': round(ref_gastos_usd_eur, 2),
        'referencia_gastos_ves_usd': round(ref_gastos_ves_usd, 2),
        'referencia_gastos_ves_eur': round(ref_gastos_ves_eur, 2),
        'ganancia_neta_usd': round(ganancia_neta_usd, 2),
        'ganancia_neta_ves': round(ganancia_neta_ves, 2),
        'referencia_ganancia_usd_ves': round(ref_ganancia_usd_ves, 2),
        'referencia_ganancia_usd_eur': round(ref_ganancia_usd_eur, 2),
        'referencia_ganancia_ves_usd': round(ref_ganancia_ves_usd, 2),
        'referencia_ganancia_ves_eur': round(ref_ganancia_ves_eur, 2),
        'costo_total_inventario': costo_total_inventario,
        'ventas_por_dia_usd': ventas_por_dia_usd_list,
        'ventas_por_dia_ves': ventas_por_dia_ves_list,
        'top_global_usd': top_global_usd_list,
        'top_global_ves': top_global_ves_list,
        'metodos_pago': metodos,
        'tasas': {
            'usd': tasa_usd,
            'eur': tasa_eur
        }
    })


# ============================================================
# NUEVO ENDPOINT: DETALLE DE VENTAS (PRODUCTO, CLIENTE, CANTIDAD, MONTOS)
# 🔧 MODIFICADO: Ahora incluye precio_unitario_usd y precio_unitario_ves en la respuesta
# para que el frontend pueda calcular el total siempre de forma explícita.
# ============================================================
@api_bp.route('/reportes/detalle-ventas', methods=['GET'])
@login_required
def detalle_ventas():
    """Devuelve un desglose de todas las ventas (normales + apartados finalizados) 
       con producto, cliente, cantidad, precios unitarios y montos totales.
    """
    fecha_desde = request.args.get('fecha_desde')
    fecha_hasta = request.args.get('fecha_hasta')
    moneda_filtro = request.args.get('moneda')  # 'USD' o 'VES'
    
    desde = None
    hasta = None
    if fecha_desde:
        desde = datetime.strptime(fecha_desde, '%Y-%m-%d')
    if fecha_hasta:
        hasta = datetime.strptime(fecha_hasta, '%Y-%m-%d') + timedelta(days=1)
    
    query = db.session.query(
        Producto.nombre.label('producto'),
        Cliente.nombre.label('cliente_nombre'),
        Cliente.apellido.label('cliente_apellido'),
        DetalleVenta.cantidad,
        DetalleVenta.precio_unitario_usd,
        DetalleVenta.precio_unitario_ves,
        Venta.moneda_cobro
    ).join(Venta, Venta.id == DetalleVenta.venta_id)\
     .join(Producto, Producto.id == DetalleVenta.producto_id)\
     .outerjoin(Cliente, Cliente.id == Venta.cliente_id)\
     .filter(Venta.es_apartado == False)\
     .filter(Venta.anulado == False)  # 🔥 Excluir anuladas
    
    if desde:
        query = query.filter(Venta.fecha >= desde)
    if hasta:
        query = query.filter(Venta.fecha < hasta)
    
    if moneda_filtro in ['USD', 'VES']:
        query = query.filter(Venta.moneda_cobro == moneda_filtro)
    
    detalles = query.order_by(Venta.fecha.desc()).all()
    
    result = []
    for d in detalles:
        cliente_nombre = f"{d.cliente_nombre} {d.cliente_apellido}" if d.cliente_nombre else "Consumidor Final"
        monto_usd = d.precio_unitario_usd * d.cantidad
        monto_ves = d.precio_unitario_ves * d.cantidad
        result.append({
            'producto': d.producto,
            'cliente': cliente_nombre,
            'cantidad': d.cantidad,
            'precio_unitario_usd': round(d.precio_unitario_usd, 2),
            'precio_unitario_ves': round(d.precio_unitario_ves, 2),
            'monto_usd': round(monto_usd, 2),
            'monto_ves': round(monto_ves, 2)
        })
    
    return jsonify(result)

# ============================================================
# 🔥 ENDPOINTS DE IMPRESORA (AÑADIDOS COMPLETOS)
# ============================================================

@api_bp.route('/impresora/config', methods=['GET'])
@login_required
def obtener_config_impresora():
    """Obtiene la configuración actual de la impresora."""
    config = ConfiguracionImpresora.query.first()
    if not config:
        config = ConfiguracionImpresora()
        db.session.add(config)
        db.session.commit()
    
    return jsonify({
        'id': config.id,
        'nombre_impresora': config.nombre_impresora,
        'tipo': config.tipo,
        'puerto': config.puerto,
        'velocidad': config.velocidad,
        'tamano_papel': config.tamano_papel,
        'caracteres_por_linea': config.caracteres_por_linea,
        'margen_izquierdo': config.margen_izquierdo,
        'margen_derecho': config.margen_derecho,
        'fuente': config.fuente,
        'tamaño_fuente': config.tamaño_fuente,
        'alineacion': config.alineacion,
        'cabecera_extra': config.cabecera_extra,
        'pie_extra': config.pie_extra,
        'copias': config.copias,
        'cortar_auto': config.cortar_auto,
        'abrir_cajon': config.abrir_cajon
    })

@api_bp.route('/impresora/config', methods=['POST'])
@login_required
def guardar_config_impresora():
    """Guarda la configuración de la impresora."""
    data = request.get_json()
    
    config = ConfiguracionImpresora.query.first()
    if not config:
        config = ConfiguracionImpresora()
        db.session.add(config)
    
    config.nombre_impresora = data.get('nombre_impresora', config.nombre_impresora)
    config.tipo = data.get('tipo', config.tipo)
    config.puerto = data.get('puerto', config.puerto)
    config.velocidad = data.get('velocidad', config.velocidad)
    config.tamano_papel = data.get('tamano_papel', config.tamano_papel)
    config.caracteres_por_linea = data.get('caracteres_por_linea', config.caracteres_por_linea)
    config.margen_izquierdo = data.get('margen_izquierdo', config.margen_izquierdo)
    config.margen_derecho = data.get('margen_derecho', config.margen_derecho)
    config.fuente = data.get('fuente', config.fuente)
    config.tamaño_fuente = data.get('tamaño_fuente', config.tamaño_fuente)
    config.alineacion = data.get('alineacion', config.alineacion)
    config.cabecera_extra = data.get('cabecera_extra', config.cabecera_extra)
    config.pie_extra = data.get('pie_extra', config.pie_extra)
    config.copias = data.get('copias', config.copias)
    config.cortar_auto = data.get('cortar_auto', config.cortar_auto)
    config.abrir_cajon = data.get('abrir_cajon', config.abrir_cajon)
    config.fecha_actualizacion = now_venezuela()
    
    db.session.commit()
    
    log = Log(accion='CONFIG_IMPRESORA_GUARDADA', detalle='Configuración de impresora actualizada')
    db.session.add(log)
    db.session.commit()
    
    return jsonify({'mensaje': 'Configuración guardada correctamente'}), 200

@api_bp.route('/impresora/test', methods=['POST'])
@login_required
def probar_impresora():
    """Envía un ticket de prueba a la impresora configurada."""
    config = ConfiguracionImpresora.query.first()
    if not config or not config.nombre_impresora:
        return jsonify({'error': 'No hay impresora configurada. Por favor, configure una impresora.'}), 400

    printer_name = config.nombre_impresora

    # Verificar que win32print esté disponible
    try:
        import win32print
    except ImportError:
        return jsonify({'error': 'La biblioteca pywin32 no está instalada. No se puede imprimir.'}), 500

    # Generar contenido de prueba
    lineas = []
    lineas.append("=" * 40)
    lineas.append("  ELEMENTS STORE - PRUEBA")
    lineas.append("=" * 40)
    lineas.append(f"Fecha: {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    lineas.append(f"Impresora: {printer_name}")
    lineas.append("-" * 40)
    lineas.append("¡Impresión funcionando correctamente!")
    lineas.append("")
    lineas.append("Elementos configurados:")
    lineas.append(f"  Tipo: {config.tipo}")
    lineas.append(f"  Tamaño papel: {config.tamano_papel}")
    lineas.append(f"  Copias: {config.copias}")
    lineas.append("=" * 40)
    lineas.append("")
    lineas.append("Gracias por usar Elements Store")
    lineas.append("")
    lineas.append("\n\n\n\n")  # Espacio para corte

    contenido = "\n".join(lineas)

    # Enviar a imprimir
    try:
        exito = imprimir_ticket(contenido, printer_name, copias=config.copias or 1, cortar=config.cortar_auto)
        if exito:
            return jsonify({'mensaje': 'Prueba de impresión enviada correctamente', 'exito': True}), 200
        else:
            return jsonify({'error': 'Error al enviar la impresión. Verifique que la impresora esté conectada y encendida.'}), 500
    except Exception as e:
        return jsonify({'error': f'Error al imprimir: {str(e)}'}), 500

# ============================================================
# 🔥 ENDPOINT PARA LISTAR IMPRESORAS DEL SISTEMA (CORREGIDO)
# ============================================================

@api_bp.route('/impresora/listar', methods=['GET'])
@login_required
def listar_impresoras():
    """
    Devuelve la lista de impresoras instaladas en el sistema (solo Windows).
    En otros SO, devuelve un mensaje indicando que no está disponible.
    """
    impresoras = []
    sistema = 'desconocido'
    
    try:
        import platform
        sistema = platform.system()
        
        if sistema == 'Windows':
            try:
                import win32print
                import win32api
                # 🔥 CORRECCIÓN: Usar solo PRINTER_ENUM_LOCAL para evitar error RPC
                printers = win32print.EnumPrinters(win32print.PRINTER_ENUM_LOCAL)
                for p in printers:
                    nombre = p[2]
                    descripcion = p[1] if len(p) > 1 else nombre
                    impresoras.append({
                        'nombre': nombre,
                        'descripcion': descripcion
                    })
                # Obtener la impresora predeterminada (si existe)
                try:
                    default = win32print.GetDefaultPrinter()
                    for imp in impresoras:
                        if imp['nombre'] == default:
                            imp['predeterminada'] = True
                except:
                    pass
                return jsonify({
                    'sistema': 'Windows',
                    'impresoras': impresoras,
                    'mensaje': f'Se encontraron {len(impresoras)} impresoras locales.'
                })
            except ImportError:
                return jsonify({
                    'sistema': 'Windows',
                    'impresoras': [],
                    'mensaje': 'La biblioteca pywin32 no está instalada. Por favor, instálela con: pip install pywin32'
                }), 500
            except Exception as e:
                error_msg = str(e)
                if '1722' in error_msg or 'RPC' in error_msg:
                    mensaje = 'El servicio "Print Spooler" no está disponible. Por favor, verifique que el servicio esté en ejecución (services.msc) o ejecute "net start spooler" como administrador.'
                else:
                    mensaje = f'Error al listar impresoras: {error_msg}'
                return jsonify({
                    'sistema': 'Windows',
                    'impresoras': [],
                    'mensaje': mensaje
                }), 500
        else:
            return jsonify({
                'sistema': sistema,
                'impresoras': [],
                'mensaje': f'Detección automática no disponible en {sistema}. Configure manualmente.'
            })
    except Exception as e:
        return jsonify({
            'sistema': sistema,
            'impresoras': [],
            'mensaje': f'Error al listar impresoras: {str(e)}'
        }), 500

# ============================================================
# 🔥 ENDPOINT PARA RESPALDO DE BASE DE DATOS
# ============================================================

@api_bp.route('/backup/download', methods=['GET'])
@login_required
def download_backup():
    db_path = obtener_db_path()
    if not os.path.exists(db_path):
        return jsonify({'error': 'Base de datos no encontrada'}), 404
    return send_file(db_path, as_attachment=True, download_name='elements_store_backup.sqlite')


# ============================================================
# 🔥 NUEVO: FUNCIONES Y ENDPOINT PARA SUBIR RESPALDO CON FUSIÓN (MERGE)
# ============================================================

def validar_base_datos(conn):
    """
    Verifica que la conexión corresponda a una base de datos SQLite válida.
    """
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        return len(tables) > 0
    except Exception:
        return False


def obtener_tablas_y_estructura(conn):
    """
    Obtiene la lista de tablas y sus columnas (con tipo y PK) de la base de datos.
    Retorna un dict: { tabla: [ { 'name': col, 'type': tipo, 'pk': es_pk } ] }
    """
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tablas = [row[0] for row in cursor.fetchall()]
    
    estructura = {}
    for tabla in tablas:
        cursor.execute(f"PRAGMA table_info({tabla})")
        columnas = cursor.fetchall()
        estructura[tabla] = [
            {'name': col[1], 'type': col[2], 'pk': col[5] == 1}
            for col in columnas
        ]
    return estructura


def fusionar_base_datos(backup_path, db_path):
    """
    Realiza la fusión (merge) de los datos del backup en la base de datos actual.
    - Lee todas las tablas del backup.
    - Para cada tabla, inserta los registros que no existen en la base de datos actual.
    - Retorna un dict con el resumen de inserciones por tabla y total.
    """
    resumen = {}
    total_insertados = 0
    
    # Conectar a la base de datos actual
    conn_actual = sqlite3.connect(db_path)
    conn_actual.row_factory = sqlite3.Row
    cursor_actual = conn_actual.cursor()
    
    # Conectar al backup
    conn_backup = sqlite3.connect(backup_path)
    conn_backup.row_factory = sqlite3.Row
    cursor_backup = conn_backup.cursor()
    
    try:
        # Obtener estructura de ambas bases
        estructura_backup = obtener_tablas_y_estructura(conn_backup)
        estructura_actual = obtener_tablas_y_estructura(conn_actual)
        
        # Lista de tablas a excluir (si es necesario)
        # Excluimos tablas del sistema y la tabla de configuración de impresora
        tablas_excluidas = ['sqlite_sequence', 'sqlite_stat1']
        
        for tabla, columnas_backup in estructura_backup.items():
            if tabla in tablas_excluidas:
                continue
                
            # Verificar si la tabla existe en la base actual
            if tabla not in estructura_actual:
                # Si la tabla no existe, crearla con la misma estructura
                columnas_def = []
                for col in columnas_backup:
                    pk = "PRIMARY KEY" if col['pk'] else ""
                    columnas_def.append(f"{col['name']} {col['type']} {pk}".strip())
                create_sql = f"CREATE TABLE {tabla} ({', '.join(columnas_def)})"
                cursor_actual.execute(create_sql)
                conn_actual.commit()
                
            # Obtener columnas de la tabla en el backup
            col_names = [col['name'] for col in columnas_backup]
            col_names_str = ', '.join(col_names)
            placeholders = ', '.join(['?' for _ in col_names])
            
            # Obtener clave primaria (para evitar duplicados)
            pk_column = next((col['name'] for col in columnas_backup if col['pk']), None)
            
            # Leer todos los registros del backup
            cursor_backup.execute(f"SELECT * FROM {tabla}")
            registros = cursor_backup.fetchall()
            
            insertados = 0
            for row in registros:
                valores = [row[col] for col in col_names]
                
                # Verificar si el registro ya existe (por clave primaria)
                if pk_column:
                    pk_valor = row[pk_column]
                    if pk_valor is not None:
                        cursor_actual.execute(f"SELECT 1 FROM {tabla} WHERE {pk_column} = ?", (pk_valor,))
                        existe = cursor_actual.fetchone()
                        if existe:
                            continue
                
                # Insertar el registro
                insert_sql = f"INSERT INTO {tabla} ({col_names_str}) VALUES ({placeholders})"
                try:
                    cursor_actual.execute(insert_sql, valores)
                    insertados += 1
                    total_insertados += 1
                except sqlite3.IntegrityError:
                    # Si falla por conflicto, ignorar (ya existe o viola alguna restricción)
                    continue
            
            resumen[tabla] = insertados
            
        # Guardar cambios
        conn_actual.commit()
        
    except Exception as e:
        conn_actual.rollback()
        raise e
    finally:
        conn_backup.close()
        conn_actual.close()
    
    return resumen, total_insertados


@api_bp.route('/backup/upload', methods=['POST'])
@master_required
def upload_backup():
    """
    Recibe un archivo de respaldo (.sqlite o .db) y lo fusiona con la base de datos actual.
    - Solo usuarios Master pueden subir respaldos.
    - Verifica que el archivo sea una base SQLite válida.
    - Realiza la fusión (merge) insertando solo los registros que no existen.
    - Retorna un resumen de las inserciones realizadas.
    """
    # Verificar que se envió un archivo
    if 'backup' not in request.files:
        return jsonify({'error': 'No se envió ningún archivo'}), 400
    
    file = request.files['backup']
    if file.filename == '':
        return jsonify({'error': 'No se seleccionó ningún archivo'}), 400
    
    # Validar extensión
    allowed_extensions = {'.sqlite', '.db', '.sqlite3'}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_extensions:
        return jsonify({'error': f'Formato de archivo no permitido. Use: {", ".join(allowed_extensions)}'}), 400
    
    # Guardar archivo temporalmente
    import tempfile
    temp_dir = tempfile.gettempdir()
    temp_path = os.path.join(temp_dir, f'backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}{ext}')
    
    try:
        file.save(temp_path)
        
        # Verificar que sea una base SQLite válida
        try:
            conn_test = sqlite3.connect(temp_path)
            if not validar_base_datos(conn_test):
                conn_test.close()
                os.remove(temp_path)
                return jsonify({'error': 'El archivo no es una base de datos SQLite válida'}), 400
            conn_test.close()
        except Exception as e:
            os.remove(temp_path)
            return jsonify({'error': f'Error al validar el archivo: {str(e)}'}), 400
        
        # Realizar la fusión
        db_path = obtener_db_path()
        
        # Crear una copia de seguridad de la base actual antes de la fusión (por seguridad)
        backup_path = db_path + '.pre_merge_backup'
        try:
            import shutil
            shutil.copy2(db_path, backup_path)
        except Exception as e:
            print(f"⚠️ No se pudo crear backup pre-merge: {e}")
        
        try:
            resumen, total = fusionar_base_datos(temp_path, db_path)
        except Exception as e:
            # Si falla la fusión, restaurar la copia de seguridad
            try:
                import shutil
                shutil.copy2(backup_path, db_path)
            except:
                pass
            os.remove(temp_path)
            return jsonify({'error': f'Error durante la fusión de datos: {str(e)}'}), 500
        
        # Eliminar archivo temporal
        os.remove(temp_path)
        
        # Registrar en logs
        log = Log(
            accion='RESTAURACION_FUSION',
            detalle=f'Respaldo fusionado correctamente. {total} registros insertados. Resumen: {resumen}'
        )
        db.session.add(log)
        db.session.commit()
        
        return jsonify({
            'mensaje': 'Respaldo fusionado correctamente',
            'resumen': resumen,
            'total_insertados': total
        }), 200
        
    except Exception as e:
        # Limpiar archivo temporal en caso de error
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except:
                pass
        return jsonify({'error': f'Error al procesar el respaldo: {str(e)}'}), 500


# ============================================================
# 🔥 FUNCIÓN AUXILIAR PARA INICIALIZAR CUENTAS FINANCIERAS (OPCIONAL)
# ============================================================

def inicializar_cuentas_financieras():
    """
    Crea las cuentas base para el módulo de Cajas y Balance General.
    Esta función puede ejecutarse desde la consola o al iniciar la app.
    """
    cuentas_base = [
        {'nombre': 'Efectivo USD', 'tipo': 'activo', 'moneda': 'USD', 'monto': 0.0},
        {'nombre': 'Efectivo VES', 'tipo': 'activo', 'moneda': 'VES', 'monto': 0.0},
        {'nombre': 'Bancos Bs', 'tipo': 'activo', 'moneda': 'VES', 'monto': 0.0},
        {'nombre': 'Binance (USD)', 'tipo': 'activo', 'moneda': 'USD', 'monto': 0.0},
        {'nombre': 'Alquiler', 'tipo': 'pasivo', 'moneda': 'USD', 'monto': 0.0},
        {'nombre': 'Sueldos', 'tipo': 'pasivo', 'moneda': 'USD', 'monto': 0.0},
        {'nombre': 'Deudas USD', 'tipo': 'pasivo', 'moneda': 'USD', 'monto': 0.0},
        {'nombre': 'Deudas Bs', 'tipo': 'pasivo', 'moneda': 'VES', 'monto': 0.0},
    ]
    for datos in cuentas_base:
        existe = CuentaFinanciera.query.filter_by(nombre=datos['nombre']).first()
        if not existe:
            cuenta = CuentaFinanciera(
                nombre=datos['nombre'],
                tipo=datos['tipo'],
                moneda=datos['moneda'],
                monto=datos['monto'],
                es_automatico=False
            )
            db.session.add(cuenta)
    db.session.commit()
    print("✅ Cuentas financieras base inicializadas.")

# ============================================================
# Si deseas que las cuentas se creen automáticamente al arrancar,
# descomenta la siguiente línea (y asegúrate de que se ejecute
# después de crear las tablas):
# inicializar_cuentas_financieras()
# ============================================================