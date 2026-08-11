from flask import Flask, render_template, jsonify, request, send_file
from models import db, Deuda  # 🔥 Importación explícita de Deuda
from routes import main_bp, api_bp
from utils import inicializar_datos_defecto, obtener_tasas_bcv, guardar_historial_tasas, obtener_tasa_personalizada
import os
import sys
import sqlite3
import time  # 🔥 AÑADIDO para time.tzset()
import pytz  # 🔥 AÑADIDO para manejo de zona horaria
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash

# ---------- CONFIGURACIÓN DE ZONA HORARIA VENEZUELA (UTC-4) ----------
os.environ['TZ'] = 'America/Caracas'
try:
    time.tzset()  # Aplica la zona horaria en sistemas Unix (en Windows se ignora)
    print("✅ Zona horaria configurada: America/Caracas (UTC-4)")
except Exception as e:
    print(f"⚠️ No se pudo establecer TZ con time.tzset(): {e}. Se usará pytz en las funciones.")

# ---------- FUNCIONES PARA RUTAS PORTABLES ----------
def get_base_dir():
    """Retorna la ruta base donde se encuentran los archivos."""
    if getattr(sys, 'frozen', False):
        # Cuando está compilado como .exe, PyInstaller usa sys._MEIPASS
        return sys._MEIPASS
    else:
        # En entorno de desarrollo
        return os.path.dirname(os.path.abspath(__file__))

def get_db_path():
    """Retorna la ruta de la base de datos SQLite (solo para fallback)."""
    base_dir = get_base_dir()
    data_dir = os.path.join(base_dir, 'data')
    os.makedirs(data_dir, exist_ok=True)
    return os.path.join(data_dir, 'database.db')

# ---------- CONFIGURACIÓN DE LA APLICACIÓN ----------
# Obtener la ruta base (compilado o desarrollo)
base_path = get_base_dir()

# Configurar las rutas de plantillas y estáticos
template_folder = os.path.join(base_path, 'templates')
static_folder = os.path.join(base_path, 'static')

app = Flask(
    __name__,
    static_folder=static_folder,
    static_url_path='/static',
    template_folder=template_folder
)

# Configuración dinámicamente adaptada para Supabase (PostgreSQL) y SQLite
db_url = os.getenv('DATABASE_URL') or os.getenv('SUPABASE_DATABASE_URL')
if db_url:
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = db_url
else:
    db_path = get_db_path()
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-key-12345')
app.config['TIMEZONE'] = 'America/Caracas'  # 🔥 AÑADIDO para referencia

db.init_app(app)

# Registrar blueprints
app.register_blueprint(main_bp)
app.register_blueprint(api_bp, url_prefix='/api')

# ============================================
# FUNCIONES DE MIGRACIÓN (CORREGIDAS Y COMPLETAS)
# ============================================

def agregar_columna_si_no_existe(tabla, columna, tipo):
    """Agrega una columna a una tabla si no existe."""
    db_full_path = get_db_path()
    if not os.path.exists(db_full_path):
        return
    try:
        conn = sqlite3.connect(db_full_path)
        cursor = conn.cursor()
        cursor.execute(f"PRAGMA table_info({tabla})")
        columnas = [col[1] for col in cursor.fetchall()]
        if columna not in columnas:
            print(f"🔧 Agregando columna '{columna}' a la tabla '{tabla}'...")
            cursor.execute(f"ALTER TABLE {tabla} ADD COLUMN {columna} {tipo}")
            conn.commit()
            print(f"✅ Columna '{columna}' agregada exitosamente.")
        else:
            print(f"✅ La columna '{columna}' ya existe en la tabla '{tabla}'.")
        conn.close()
    except Exception as e:
        print(f"⚠️ Error al agregar columna: {e}")

def verificar_y_migrar_usuarios():
    """Verifica que la tabla usuarios tenga todas las columnas necesarias."""
    from sqlalchemy import inspect
    inspector = inspect(db.engine)
    if 'usuarios' not in inspector.get_table_names():
        print("ℹ️ Tabla 'usuarios' no existe. Se creará automáticamente.")
        db.create_all()
        return
    # Verificar columnas específicas
    columnas_requeridas = {
        'estado': 'VARCHAR(20)',
        'rol': 'VARCHAR(20)',
        'fecha_registro': 'DATETIME',
        'ultimo_login': 'DATETIME'
    }
    for col, tipo in columnas_requeridas.items():
        agregar_columna_si_no_existe('usuarios', col, tipo)

def verificar_y_migrar_ventas_clientes():
    """Agrega las columnas faltantes a ventas y clientes."""
    # Ventas: es_apartado y apartado_id
    agregar_columna_si_no_existe('ventas', 'es_apartado', 'BOOLEAN DEFAULT 0')
    agregar_columna_si_no_existe('ventas', 'apartado_id', 'INTEGER')
    
    # Clientes: es_fijo
    agregar_columna_si_no_existe('clientes', 'es_fijo', 'BOOLEAN DEFAULT 0')

def crear_tablas_apartados():
    """Crea las tablas apartados y pagos_apartados si no existen."""
    db_full_path = get_db_path()
    if not os.path.exists(db_full_path):
        return
    try:
        conn = sqlite3.connect(db_full_path)
        cursor = conn.cursor()
        
        # Tabla apartados
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS apartados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id INTEGER NOT NULL,
            producto_id INTEGER NOT NULL,
            cantidad INTEGER NOT NULL,
            precio_unitario_usd FLOAT NOT NULL,
            precio_unitario_ves FLOAT NOT NULL,
            tasa_aplicada FLOAT NOT NULL,
            metodo_cobro_inicial VARCHAR(30) NOT NULL,
            metodo_pago_inicial VARCHAR(50) NOT NULL,
            abono_inicial_porcentaje FLOAT NOT NULL,
            abono_inicial_monto FLOAT NOT NULL,
            saldo_restante FLOAT NOT NULL,
            fecha_apartado DATETIME DEFAULT CURRENT_TIMESTAMP,
            fecha_limite_pago DATE NOT NULL,
            periodo_tipo VARCHAR(20) NOT NULL,
            descontar_stock_al_apartar BOOLEAN DEFAULT 1,
            estado VARCHAR(20) DEFAULT 'activo',
            fecha_finalizacion DATETIME,
            ticket_generado BOOLEAN DEFAULT 0,
            FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
            FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
        )
        ''')
        print("✅ Tabla 'apartados' verificada/creada.")
        
        # Tabla pagos_apartados
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS pagos_apartados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            apartado_id INTEGER NOT NULL,
            monto_usd FLOAT NOT NULL,
            monto_ves FLOAT NOT NULL,
            tasa_aplicada FLOAT NOT NULL,
            metodo_cobro VARCHAR(30) NOT NULL,
            metodo_pago VARCHAR(50) NOT NULL,
            fecha_abono DATETIME DEFAULT CURRENT_TIMESTAMP,
            observaciones VARCHAR(255),
            FOREIGN KEY (apartado_id) REFERENCES apartados(id) ON DELETE CASCADE
        )
        ''')
        print("✅ Tabla 'pagos_apartados' verificada/creada.")
        
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"⚠️ Error al crear tablas de apartados: {e}")

# ============================================================
# 🔥 NUEVA: Función para crear tabla cuentas_financieras si no existe
# ============================================================
def verificar_y_crear_tabla_cuentas_financieras():
    """Crea la tabla cuentas_financieras si no existe."""
    db_full_path = get_db_path()
    if not os.path.exists(db_full_path):
        return
    try:
        conn = sqlite3.connect(db_full_path)
        cursor = conn.cursor()
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS cuentas_financieras (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre VARCHAR(100) NOT NULL UNIQUE,
            tipo VARCHAR(20) NOT NULL,
            moneda VARCHAR(3) NOT NULL,
            monto NUMERIC(12, 2) DEFAULT 0.00,
            es_automatico BOOLEAN DEFAULT 0,
            fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        conn.commit()
        conn.close()
        print("✅ Tabla 'cuentas_financieras' verificada/creada.")
    except Exception as e:
        print(f"⚠️ Error al crear tabla cuentas_financieras: {e}")

# ============================================================
# 🔥 NUEVA: Función para crear tabla deudas si no existe
# ============================================================
def verificar_y_crear_tabla_deudas():
    """Crea la tabla deudas si no existe (modelo Deuda)."""
    db_full_path = get_db_path()
    if not os.path.exists(db_full_path):
        return
    try:
        conn = sqlite3.connect(db_full_path)
        cursor = conn.cursor()
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS deudas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            descripcion VARCHAR(255) NOT NULL,
            moneda VARCHAR(3) NOT NULL,
            monto NUMERIC(12, 2) NOT NULL,
            fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
            fecha_finalizacion DATETIME,
            estado VARCHAR(20) DEFAULT 'pendiente',
            observaciones VARCHAR(500)
        )
        ''')
        conn.commit()
        conn.close()
        print("✅ Tabla 'deudas' verificada/creada.")
    except Exception as e:
        print(f"⚠️ Error al crear tabla deudas: {e}")

# ============================================================
# 🔥 NUEVA: Función para crear tabla configuración de impresora
# ============================================================
def verificar_y_crear_tabla_impresora():
    """Crea la tabla configuracion_impresora si no existe."""
    db_full_path = get_db_path()
    if not os.path.exists(db_full_path):
        return
    try:
        conn = sqlite3.connect(db_full_path)
        cursor = conn.cursor()
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS configuracion_impresora (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre_impresora VARCHAR(100) NOT NULL DEFAULT 'Impresa Térmica',
            tipo VARCHAR(30) NOT NULL DEFAULT 'termica',
            puerto VARCHAR(50) NOT NULL DEFAULT 'USB',
            velocidad INTEGER DEFAULT 9600,
            tamano_papel VARCHAR(20) DEFAULT '80mm',
            caracteres_por_linea INTEGER DEFAULT 42,
            margen_izquierdo INTEGER DEFAULT 0,
            margen_derecho INTEGER DEFAULT 0,
            fuente VARCHAR(50) DEFAULT 'DejaVuSans.ttf',
            tamaño_fuente INTEGER DEFAULT 10,
            alineacion VARCHAR(20) DEFAULT 'centrado',
            cabecera_extra VARCHAR(200),
            pie_extra VARCHAR(200),
            copias INTEGER DEFAULT 1,
            cortar_auto BOOLEAN DEFAULT 1,
            abrir_cajon BOOLEAN DEFAULT 0,
            fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        conn.commit()
        conn.close()
        print("✅ Tabla 'configuracion_impresora' verificada/creada.")
        
        # Si no hay registro, insertar uno por defecto
        try:
            conn = sqlite3.connect(db_full_path)
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM configuracion_impresora")
            count = cursor.fetchone()[0]
            if count == 0:
                cursor.execute('''
                INSERT INTO configuracion_impresora 
                (nombre_impresora, tipo, puerto, velocidad, tamano_papel, caracteres_por_linea)
                VALUES ('Impresa Térmica', 'termica', 'USB', 9600, '80mm', 42)
                ''')
                conn.commit()
                print("✅ Registro por defecto de configuración de impresora insertado.")
            conn.close()
        except Exception as e:
            print(f"⚠️ Error al insertar configuración por defecto: {e}")
    except Exception as e:
        print(f"⚠️ Error al crear tabla configuracion_impresora: {e}")

# ---------- FUNCIÓN PARA CREAR USUARIOS MASTER (CORREGIDA) ----------
def crear_usuarios_master():
    """Crea los usuarios master por defecto si no existen (verifica por username y email)."""
    from models import Usuario
    usuarios_master = [
        {'username': 'master1', 'email': 'master1@elements.com'},
        {'username': 'master2', 'email': 'master2@elements.com'},
        {'username': 'tecnico', 'email': 'tecnico@elements.com'}
    ]
    for user_data in usuarios_master:
        # Buscar por username o email para evitar duplicados
        existente = Usuario.query.filter(
            (Usuario.username == user_data['username']) | (Usuario.email == user_data['email'])
        ).first()
        if not existente:
            try:
                nuevo_usuario = Usuario(
                    username=user_data['username'],
                    email=user_data['email'],
                    password_hash=generate_password_hash('123456'),
                    rol='Master',
                    estado='Activo'
                )
                db.session.add(nuevo_usuario)
                db.session.commit()
                print(f"✅ Usuario master creado: {user_data['username']} (contraseña: 123456)")
            except Exception as e:
                db.session.rollback()
                print(f"⚠️ Error al crear usuario {user_data['username']}: {e}")
        else:
            # Si existe, asegurar que sea Master y esté Activo
            if existente.rol != 'Master' or existente.estado != 'Activo':
                existente.rol = 'Master'
                existente.estado = 'Activo'
                try:
                    db.session.commit()
                    print(f"🔄 Usuario {existente.username} actualizado a Master/Activo")
                except Exception as e:
                    db.session.rollback()
                    print(f"⚠️ Error al actualizar usuario {existente.username}: {e}")
            else:
                print(f"ℹ️ Usuario {existente.username} ya es Master y está Activo.")
    print("📋 Verificación de usuarios master completada.")

# ============================================================
# 🔥 NUEVA FUNCIÓN: INICIALIZAR CUENTAS FINANCIERAS BASE
# ============================================================
def inicializar_cuentas_financieras():
    """Crea las cuentas base para el módulo de Cajas y Balance General si no existen."""
    from models import CuentaFinanciera
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
    try:
        db.session.commit()
        print("✅ Cuentas financieras base inicializadas.")
    except Exception as e:
        db.session.rollback()
        print(f"⚠️ Error al inicializar cuentas financieras: {e}")

# ---------- INICIALIZACIÓN ----------
with app.app_context():
    # 1. Crear todas las tablas (incluyendo Usuario si es nuevo)
    db.create_all()
    print("✅ Base de datos verificada/creada con SQLAlchemy.")
    
    # Solo ejecutar migraciones específicas de SQLite si se usa SQLite localmente
    if app.config['SQLALCHEMY_DATABASE_URI'].startswith('sqlite'):
        # 2. Verificar y migrar tabla usuarios (para añadir columnas faltantes)
        verificar_y_migrar_usuarios()
        
        # 3. Verificar y migrar ventas/clientes (nuevas columnas)
        verificar_y_migrar_ventas_clientes()
        
        # 4. Crear tablas de apartados si no existen
        crear_tablas_apartados()
        
        # 5. Crear tabla cuentas_financieras si no existe
        verificar_y_crear_tabla_cuentas_financieras()
        
        # 🔥 6. Crear tabla deudas si no existe (nuevo modelo)
        verificar_y_crear_tabla_deudas()
        
        # 🔥 7. Crear tabla configuración de impresora (nuevo módulo)
        verificar_y_crear_tabla_impresora()
        
        # 10. Agregar columna 'moneda' a gastos si no existe
        agregar_columna_si_no_existe('gastos', 'moneda', 'VARCHAR(3)')
    
    # 8. Inicializar datos por defecto
    inicializar_datos_defecto()
    
    # 9. Guardar tasas
    try:
        tasas = obtener_tasas_bcv()
        personalizada = obtener_tasa_personalizada()
        guardar_historial_tasas(tasas['usd'], tasas['eur'], personalizada)
    except Exception as e:
        print(f"Error guardando historial: {e}")
    
    # 11. Crear usuarios master (con manejo de errores)
    try:
        crear_usuarios_master()
    except Exception as e:
        print(f"Error al crear usuarios master: {e}")
        db.session.rollback()
    
    # 12. Inicializar cuentas financieras base (después de asegurar sesión limpia)
    try:
        inicializar_cuentas_financieras()
    except Exception as e:
        print(f"Error al inicializar cuentas financieras: {e}")
        db.session.rollback()

# ============================================
# RUTA PRINCIPAL
# ============================================

if __name__ == '__main__':
    debug_mode = False if getattr(sys, 'frozen', False) else True
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=debug_mode, host='0.0.0.0', port=port)