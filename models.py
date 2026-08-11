from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import pytz  # 🔥 AÑADIDO para zona horaria

db = SQLAlchemy()

# ============================================
# FUNCIÓN PARA OBTENER HORA LOCAL DE VENEZUELA
# ============================================
def now_venezuela():
    """Retorna la fecha/hora actual en la zona horaria de Venezuela (UTC-4)."""
    return datetime.now(pytz.timezone('America/Caracas'))

# ============================================
# MODELOS EXISTENTES (con defaults ajustados)
# ============================================

class Categoria(db.Model):
    __tablename__ = 'categorias'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(50), unique=True, nullable=False)
    subcategorias = db.relationship('Subcategoria', backref='categoria', lazy=True, cascade='all, delete-orphan')
    marcas = db.relationship('Marca', backref='categoria', lazy=True, cascade='all, delete-orphan')
    productos = db.relationship('Producto', backref='categoria', lazy=True)

class Subcategoria(db.Model):
    __tablename__ = 'subcategorias'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(50), nullable=False)
    categoria_id = db.Column(db.Integer, db.ForeignKey('categorias.id', ondelete='CASCADE'), nullable=False)
    __table_args__ = (db.UniqueConstraint('nombre', 'categoria_id', name='uq_subcategoria_categoria'),)
    productos = db.relationship('Producto', backref='subcategoria', lazy=True)
    tallas = db.relationship('Talla', backref='subcategoria', lazy=True, cascade='all, delete-orphan')

class Marca(db.Model):
    __tablename__ = 'marcas'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(50), nullable=False)
    categoria_id = db.Column(db.Integer, db.ForeignKey('categorias.id', ondelete='CASCADE'), nullable=False)
    __table_args__ = (db.UniqueConstraint('nombre', 'categoria_id', name='uq_marca_categoria'),)
    productos = db.relationship('Producto', backref='marca', lazy=True)

class Talla(db.Model):
    __tablename__ = 'tallas'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(10), nullable=False)
    subcategoria_id = db.Column(db.Integer, db.ForeignKey('subcategorias.id', ondelete='CASCADE'), nullable=False)
    __table_args__ = (db.UniqueConstraint('nombre', 'subcategoria_id', name='uq_talla_subcategoria'),)
    productos = db.relationship('Producto', backref='talla_ref', lazy=True)

class Producto(db.Model):
    __tablename__ = 'productos'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    descripcion = db.Column(db.String(255))
    marca_id = db.Column(db.Integer, db.ForeignKey('marcas.id'))
    categoria_id = db.Column(db.Integer, db.ForeignKey('categorias.id'))
    subcategoria_id = db.Column(db.Integer, db.ForeignKey('subcategorias.id'))
    talla_id = db.Column(db.Integer, db.ForeignKey('tallas.id'))
    costo_usd = db.Column(db.Float, default=0.0)
    precio_usd = db.Column(db.Float, nullable=False)
    precio_ves_bcv_usd = db.Column(db.Float, nullable=False)
    precio_ves_bcv_eur = db.Column(db.Float, nullable=False)
    precio_ves_personalizada = db.Column(db.Float, nullable=False)
    stock = db.Column(db.Integer, default=0)
    control_serial = db.Column(db.Boolean, default=False)
    serial_number = db.Column(db.String(50))
    fecha_registro = db.Column(db.DateTime, default=now_venezuela)  # 🔥 MODIFICADO
    
    # Relación con apartados
    apartados = db.relationship('Apartado', backref='producto', lazy=True)

class Cliente(db.Model):
    __tablename__ = 'clientes'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(50), nullable=False)
    apellido = db.Column(db.String(50), nullable=False)
    cedula = db.Column(db.String(20), unique=True, nullable=False)
    direccion = db.Column(db.String(200))
    telefono = db.Column(db.String(20))
    limite_credito = db.Column(db.Float, default=0.0)
    saldo_deudor = db.Column(db.Float, default=0.0)
    es_fijo = db.Column(db.Boolean, default=False)
    activo = db.Column(db.Boolean, default=True, nullable=False)  # ✅ NUEVO CAMPO PARA DESACTIVACIÓN LÓGICA
    ventas = db.relationship('Venta', backref='cliente', lazy=True)
    creditos = db.relationship('Credito', backref='cliente', lazy=True)
    apartados = db.relationship('Apartado', backref='cliente', lazy=True)

class Venta(db.Model):
    __tablename__ = 'ventas'
    id = db.Column(db.Integer, primary_key=True)
    cliente_id = db.Column(db.Integer, db.ForeignKey('clientes.id'))
    fecha = db.Column(db.DateTime, default=now_venezuela)  # 🔥 MODIFICADO
    numero_ticket = db.Column(db.Integer, unique=True, nullable=False)
    total_usd = db.Column(db.Float, nullable=False)
    total_ves = db.Column(db.Float, nullable=False)
    total_eur = db.Column(db.Float, nullable=False)
    tasa_bcv_usd = db.Column(db.Float)
    tasa_bcv_eur = db.Column(db.Float)
    tasa_personalizada = db.Column(db.Float)
    metodo_pago = db.Column(db.String(50))
    metodo_cobro = db.Column(db.String(30))
    tasa_aplicada = db.Column(db.Float)
    moneda_cobro = db.Column(db.String(5))
    total_cobro = db.Column(db.Float)
    subtotal_usd = db.Column(db.Float)
    subtotal_ves = db.Column(db.Float)
    ticket_imagen = db.Column(db.String(200))
    es_apartado = db.Column(db.Boolean, default=False)
    apartado_id = db.Column(db.Integer, db.ForeignKey('apartados.id'), nullable=True)
    detalles = db.relationship('DetalleVenta', backref='venta', lazy=True, cascade='all, delete-orphan')

class DetalleVenta(db.Model):
    __tablename__ = 'detalle_ventas'
    id = db.Column(db.Integer, primary_key=True)
    venta_id = db.Column(db.Integer, db.ForeignKey('ventas.id', ondelete='CASCADE'))
    producto_id = db.Column(db.Integer, db.ForeignKey('productos.id'))
    cantidad = db.Column(db.Integer, nullable=False)
    precio_unitario_usd = db.Column(db.Float)
    precio_unitario_ves = db.Column(db.Float)
    descuento_porcentaje = db.Column(db.Float, nullable=True)
    precio_original_usd = db.Column(db.Float, nullable=True)
    producto = db.relationship('Producto', lazy=True)

class Credito(db.Model):
    __tablename__ = 'creditos'
    id = db.Column(db.Integer, primary_key=True)
    cliente_id = db.Column(db.Integer, db.ForeignKey('clientes.id'))
    monto = db.Column(db.Float, nullable=False)
    fecha = db.Column(db.DateTime, default=now_venezuela)  # 🔥 MODIFICADO
    saldo_restante = db.Column(db.Float, nullable=False)
    abonos = db.relationship('Abono', backref='credito', lazy=True, cascade='all, delete-orphan')

class Abono(db.Model):
    __tablename__ = 'abonos'
    id = db.Column(db.Integer, primary_key=True)
    credito_id = db.Column(db.Integer, db.ForeignKey('creditos.id', ondelete='CASCADE'))
    monto = db.Column(db.Float, nullable=False)
    fecha = db.Column(db.DateTime, default=now_venezuela)  # 🔥 MODIFICADO
    tasa_cambio = db.Column(db.Float)

# ============================================
# MODELOS PARA APARTADOS Y ABONOS
# ============================================

class Apartado(db.Model):
    __tablename__ = 'apartados'
    id = db.Column(db.Integer, primary_key=True)
    cliente_id = db.Column(db.Integer, db.ForeignKey('clientes.id', ondelete='CASCADE'), nullable=False)
    producto_id = db.Column(db.Integer, db.ForeignKey('productos.id', ondelete='CASCADE'), nullable=False)
    cantidad = db.Column(db.Integer, nullable=False)
    precio_unitario_usd = db.Column(db.Float, nullable=False)
    precio_unitario_ves = db.Column(db.Float, nullable=False)
    tasa_aplicada = db.Column(db.Float, nullable=False)
    metodo_cobro_inicial = db.Column(db.String(30), nullable=False)
    metodo_pago_inicial = db.Column(db.String(50), nullable=False)
    abono_inicial_porcentaje = db.Column(db.Float, nullable=False)
    abono_inicial_monto = db.Column(db.Float, nullable=False)
    saldo_restante = db.Column(db.Float, nullable=False)
    total_usd = db.Column(db.Float, nullable=False, default=0.0)
    fecha_apartado = db.Column(db.DateTime, default=now_venezuela)  # 🔥 MODIFICADO
    fecha_limite_pago = db.Column(db.Date, nullable=False)
    periodo_tipo = db.Column(db.String(20), nullable=False)
    descontar_stock_al_apartar = db.Column(db.Boolean, default=True)
    estado = db.Column(db.String(20), default='activo')
    fecha_finalizacion = db.Column(db.DateTime, nullable=True)
    ticket_generado = db.Column(db.Boolean, default=False)
    pagos = db.relationship('PagoApartado', backref='apartado', lazy=True, cascade='all, delete-orphan')
    __table_args__ = (
        db.Index('idx_apartado_estado', 'estado'),
        db.Index('idx_apartado_cliente_estado', 'cliente_id', 'estado'),
        db.Index('idx_apartado_fecha_limite', 'fecha_limite_pago'),
    )

class PagoApartado(db.Model):
    __tablename__ = 'pagos_apartados'
    id = db.Column(db.Integer, primary_key=True)
    apartado_id = db.Column(db.Integer, db.ForeignKey('apartados.id', ondelete='CASCADE'), nullable=False)
    monto_usd = db.Column(db.Float, nullable=False)
    monto_ves = db.Column(db.Float, nullable=False)
    tasa_aplicada = db.Column(db.Float, nullable=False)
    metodo_cobro = db.Column(db.String(30), nullable=False)
    metodo_pago = db.Column(db.String(50), nullable=False)
    fecha_abono = db.Column(db.DateTime, default=now_venezuela)  # 🔥 MODIFICADO
    observaciones = db.Column(db.String(255), nullable=True)
    __table_args__ = (
        db.Index('idx_pago_apartado', 'apartado_id'),
        db.Index('idx_pago_fecha', 'fecha_abono'),
    )

class Log(db.Model):
    __tablename__ = 'logs'
    id = db.Column(db.Integer, primary_key=True)
    fecha = db.Column(db.DateTime, default=now_venezuela)  # 🔥 MODIFICADO
    accion = db.Column(db.String(50), nullable=False)
    detalle = db.Column(db.String(255))
    usuario = db.Column(db.String(50), default='admin')

class Configuracion(db.Model):
    __tablename__ = 'configuracion'
    id = db.Column(db.Integer, primary_key=True)
    clave = db.Column(db.String(50), unique=True, nullable=False)
    valor = db.Column(db.String(255), nullable=False)

class CategoriaGasto(db.Model):
    __tablename__ = 'categorias_gasto'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(50), unique=True, nullable=False)
    gastos = db.relationship('Gasto', backref='categoria', lazy=True)

class Gasto(db.Model):
    __tablename__ = 'gastos'
    id = db.Column(db.Integer, primary_key=True)
    fecha = db.Column(db.DateTime, default=now_venezuela)  # 🔥 MODIFICADO
    categoria_id = db.Column(db.Integer, db.ForeignKey('categorias_gasto.id'))
    concepto = db.Column(db.String(200), nullable=False)
    moneda = db.Column(db.String(3))
    monto_usd = db.Column(db.Float, nullable=False)
    monto_ves = db.Column(db.Float)
    tasa_aplicada = db.Column(db.Float)
    comprobante = db.Column(db.String(200))

class ReporteVenta(db.Model):
    __tablename__ = 'reportes_venta'
    id = db.Column(db.Integer, primary_key=True)
    fecha = db.Column(db.DateTime, default=now_venezuela)  # 🔥 MODIFICADO
    total_ventas_usd = db.Column(db.Float, default=0.0)
    total_ventas_ves = db.Column(db.Float, default=0.0)
    total_gastos_usd = db.Column(db.Float, default=0.0)
    total_gastos_ves = db.Column(db.Float, default=0.0)
    ganancia_neta_usd = db.Column(db.Float, default=0.0)
    ganancia_neta_ves = db.Column(db.Float, default=0.0)

class HistorialTasa(db.Model):
    __tablename__ = 'historial_tasas'
    id = db.Column(db.Integer, primary_key=True)
    fecha = db.Column(db.Date, nullable=False, unique=True)
    usd_bcv = db.Column(db.Float, nullable=False)
    eur_bcv = db.Column(db.Float, nullable=False)
    personalizada = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime, default=now_venezuela)  # 🔥 MODIFICADO

# ============================================
# MODELO PARA CAJAS Y BALANCE GENERAL
# ============================================

class CuentaFinanciera(db.Model):
    __tablename__ = 'cuentas_financieras'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False, unique=True)
    tipo = db.Column(db.String(20), nullable=False)
    moneda = db.Column(db.String(3), nullable=False)
    monto = db.Column(db.Numeric(12, 2), default=0.00)
    es_automatico = db.Column(db.Boolean, default=False)
    fecha_actualizacion = db.Column(db.DateTime, default=now_venezuela, onupdate=now_venezuela)  # 🔥 MODIFICADO

    def __repr__(self):
        return f'<CuentaFinanciera {self.nombre} - {self.moneda} {self.monto}>'

# ============================================
# MODELO PARA GESTIÓN DE DEUDAS
# ============================================

class Deuda(db.Model):
    __tablename__ = 'deudas'
    id = db.Column(db.Integer, primary_key=True)
    descripcion = db.Column(db.String(255), nullable=False)
    moneda = db.Column(db.String(3), nullable=False)
    monto = db.Column(db.Numeric(12, 2), nullable=False)
    fecha_creacion = db.Column(db.DateTime, default=now_venezuela)  # 🔥 MODIFICADO
    fecha_finalizacion = db.Column(db.DateTime, nullable=True)
    estado = db.Column(db.String(20), default='pendiente')
    observaciones = db.Column(db.String(500), nullable=True)

    def __repr__(self):
        return f'<Deuda {self.descripcion} - {self.moneda} {self.monto} - {self.estado}>'

# ============================================
# 🔥 NUEVO MODELO: CONFIGURACIÓN DE IMPRESORA
# ============================================

class ConfiguracionImpresora(db.Model):
    __tablename__ = 'configuracion_impresora'
    id = db.Column(db.Integer, primary_key=True)
    nombre_impresora = db.Column(db.String(100), nullable=False, default='Impresa Térmica')
    tipo = db.Column(db.String(30), nullable=False, default='termica')  # 'termica', 'fiscal', 'laser', 'matricial'
    puerto = db.Column(db.String(50), nullable=False, default='USB')
    velocidad = db.Column(db.Integer, default=9600)
    tamano_papel = db.Column(db.String(20), default='80mm')  # '80mm', '58mm', 'A4', etc.
    caracteres_por_linea = db.Column(db.Integer, default=42)
    margen_izquierdo = db.Column(db.Integer, default=0)
    margen_derecho = db.Column(db.Integer, default=0)
    fuente = db.Column(db.String(50), default='DejaVuSans.ttf')
    tamaño_fuente = db.Column(db.Integer, default=10)
    alineacion = db.Column(db.String(20), default='centrado')  # 'izquierda', 'centrado', 'derecha'
    cabecera_extra = db.Column(db.String(200), nullable=True)
    pie_extra = db.Column(db.String(200), nullable=True)
    copias = db.Column(db.Integer, default=1)
    cortar_auto = db.Column(db.Boolean, default=True)
    abrir_cajon = db.Column(db.Boolean, default=False)
    fecha_actualizacion = db.Column(db.DateTime, default=now_venezuela, onupdate=now_venezuela)

    def __repr__(self):
        return f'<ConfiguracionImpresora {self.nombre_impresora} - {self.tipo}>'

# ============================================
# MODELO: USUARIO (modificado)
# ============================================

class Usuario(db.Model):
    __tablename__ = 'usuarios'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    rol = db.Column(db.String(20), default='Estándar')
    estado = db.Column(db.String(20), default='Activo')
    fecha_registro = db.Column(db.DateTime, default=now_venezuela)  # 🔥 MODIFICADO
    ultimo_login = db.Column(db.DateTime, nullable=True)

    def __repr__(self):
        return f'<Usuario {self.username} - {self.rol} - {self.estado}>'