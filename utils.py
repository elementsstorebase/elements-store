import requests
from bs4 import BeautifulSoup
import os
import re
import urllib3
from dotenv import load_dotenv
from datetime import date, datetime, timedelta
import time
import pytz  # 🔥 AÑADIDO para zona horaria

# Desactivar advertencias de SSL inseguro
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

load_dotenv()

# ============================================================
# ZONA HORARIA VENEZUELA
# ============================================================
tz_venezuela = pytz.timezone('America/Caracas')  # 🔥 NUEVO

# ============================================================
# CACHÉ DE TASAS EN MEMORIA
# ============================================================
_tasas_cache = {
    'usd': None,
    'eur': None,
    'source': None,
    'timestamp': None
}
_tasa_personalizada_cache = {
    'valor': None,
    'timestamp': None
}

# Tiempos de expiración (en segundos)
TASAS_CACHE_EXPIRATION = 300   # 5 minutos
PERSONALIZADA_CACHE_EXPIRATION = 60  # 1 minuto (por si se cambia manualmente)

def _obtener_tasas_bcv_sin_cache():
    """
    Obtiene las tasas oficiales USD y EUR del BCV mediante scraping.
    Implementa dos niveles: scraping directo (verify=False) y fallback a GitHub.
    Retorna un diccionario con 'usd', 'eur' y 'source'.
    """
    url_oficial = os.getenv('BCV_URL', 'https://www.bcv.org.ve/')
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
    }

    usd_default = float(os.getenv('BCV_USD_BACKUP', 36.50))
    eur_default = float(os.getenv('BCV_EUR_BACKUP', 40.20))
    tasa_usd = usd_default
    tasa_eur = eur_default
    source = 'Default/Cache'

    # INTENTO 1: Scraping directo al BCV (verify=False)
    try:
        response = requests.get(url_oficial, headers=headers, verify=False, timeout=10)
        response.encoding = 'utf-8'
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            div_dolar = soup.find('div', id='dolar')
            div_euro = soup.find('div', id='euro')
            if div_dolar and div_euro:
                strong_dolar = div_dolar.find('strong')
                strong_euro = div_euro.find('strong')
                if strong_dolar and strong_euro:
                    raw_usd = strong_dolar.text.strip()
                    raw_eur = strong_euro.text.strip()
                    tasa_usd = float(raw_usd.replace(',', '.'))
                    tasa_eur = float(raw_eur.replace(',', '.'))
                    source = 'BCV Oficial'
                    print(f"Tasas BCV obtenidas: USD={tasa_usd}, EUR={tasa_eur}")
    except Exception as e:
        print(f"Error scraping directo BCV: {e}")

    # INTENTO 2: Fallback a GitHub (repositorio de tasas)
    if source == 'Default/Cache':
        try:
            fallback_url = os.getenv('BCV_FALLBACK_URL', 'https://raw.githubusercontent.com/fprodriguez/bcv-tasas/main/tasas.json')
            res = requests.get(fallback_url, timeout=5)
            if res.status_code == 200:
                datos = res.json()
                if 'USD' in datos and 'EUR' in datos:
                    tasa_usd = float(datos['USD'])
                    tasa_eur = float(datos['EUR'])
                    source = 'GitHub Fallback'
                    print(f"Tasas desde fallback GitHub: USD={tasa_usd}, EUR={tasa_eur}")
        except Exception as e:
            print(f"Error en fallback GitHub: {e}")

    return {'usd': tasa_usd, 'eur': tasa_eur, 'source': source}

def obtener_tasas_bcv():
    """
    Obtiene las tasas oficiales USD y EUR del BCV con caché en memoria.
    La primera vez hace scraping, luego devuelve el valor cacheado durante 5 minutos.
    """
    global _tasas_cache

    # Si el caché existe y no ha expirado, devolverlo
    if _tasas_cache['timestamp'] is not None:
        edad = (datetime.now(tz_venezuela) - _tasas_cache['timestamp']).total_seconds()  # 🔥 MODIFICADO
        if edad < TASAS_CACHE_EXPIRATION:
            print(f"📦 Tasas desde caché (edad: {edad:.0f}s)")
            return {
                'usd': _tasas_cache['usd'],
                'eur': _tasas_cache['eur'],
                'source': _tasas_cache['source']
            }

    # Obtener tasas frescas
    print("🔄 Obteniendo tasas frescas desde BCV...")
    resultado = _obtener_tasas_bcv_sin_cache()

    # Actualizar caché
    _tasas_cache['usd'] = resultado['usd']
    _tasas_cache['eur'] = resultado['eur']
    _tasas_cache['source'] = resultado['source']
    _tasas_cache['timestamp'] = datetime.now(tz_venezuela)  # 🔥 MODIFICADO

    # Guardar en historial (si no existe para hoy)
    tasa_personalizada = obtener_tasa_personalizada()  # usa caché también
    guardar_historial_tasas(resultado['usd'], resultado['eur'], tasa_personalizada)

    return {
        'usd': resultado['usd'],
        'eur': resultado['eur'],
        'source': resultado['source']
    }

def obtener_tasa_personalizada():
    """
    Obtiene la tasa personalizada desde la tabla Configuracion, con caché de 1 minuto.
    """
    global _tasa_personalizada_cache

    # Verificar caché
    if _tasa_personalizada_cache['timestamp'] is not None:
        edad = (datetime.now(tz_venezuela) - _tasa_personalizada_cache['timestamp']).total_seconds()  # 🔥 MODIFICADO
        if edad < PERSONALIZADA_CACHE_EXPIRATION:
            print(f"📦 Tasa personalizada desde caché (edad: {edad:.0f}s)")
            return _tasa_personalizada_cache['valor']

    # Obtener de la base de datos
    from models import Configuracion
    config = Configuracion.query.filter_by(clave='tasa_personalizada').first()
    valor = float(config.valor) if config else float(os.getenv('TASA_PERSONALIZADA', 38.50))

    # Actualizar caché
    _tasa_personalizada_cache['valor'] = valor
    _tasa_personalizada_cache['timestamp'] = datetime.now(tz_venezuela)  # 🔥 MODIFICADO

    return valor

def guardar_historial_tasas(usd_bcv, eur_bcv, personalizada):
    """
    Guarda las tasas en la tabla HistorialTasa si no existe registro para la fecha actual.
    """
    from models import db, HistorialTasa
    hoy = datetime.now(tz_venezuela).date()  # 🔥 MODIFICADO
    existente = HistorialTasa.query.filter_by(fecha=hoy).first()
    if not existente:
        nuevo = HistorialTasa(
            fecha=hoy,
            usd_bcv=usd_bcv,
            eur_bcv=eur_bcv,
            personalizada=personalizada
        )
        db.session.add(nuevo)
        db.session.commit()
        print(f"Historial de tasas guardado para {hoy}")
    else:
        # Actualizar si cambian (por si se modifican manualmente)
        if (existente.usd_bcv != usd_bcv or
            existente.eur_bcv != eur_bcv or
            existente.personalizada != personalizada):
            existente.usd_bcv = usd_bcv
            existente.eur_bcv = eur_bcv
            existente.personalizada = personalizada
            db.session.commit()
            print(f"Historial de tasas actualizado para {hoy}")

def calcular_precios_alternativos(precio_usd):
    """
    Dado el precio en USD, calcula los tres precios en VES usando:
    - Tasa USD BCV
    - Tasa EUR BCV (aplicada al monto en USD)
    - Tasa Personalizada
    Retorna un diccionario con los tres valores.
    """
    tasas = obtener_tasas_bcv()
    tasa_personalizada = obtener_tasa_personalizada()
    
    precio_ves_bcv_usd = precio_usd * tasas['usd']
    precio_ves_bcv_eur = precio_usd * tasas['eur']
    precio_ves_personalizada = precio_usd * tasa_personalizada
    
    return {
        'ves_bcv_usd': round(precio_ves_bcv_usd, 2),
        'ves_bcv_eur': round(precio_ves_bcv_eur, 2),
        'ves_personalizada': round(precio_ves_personalizada, 2),
        'tasa_usd': tasas['usd'],
        'tasa_eur': tasas['eur'],
        'tasa_personalizada': tasa_personalizada
    }

def inicializar_datos_defecto():
    """
    Crea marcas, categorías, subcategorías, tallas, categorías de gasto y configuración inicial si no existen.
    Además, guarda el historial de tasas del día actual.
    """
    from models import db, Marca, Categoria, Subcategoria, Talla, Configuracion, CategoriaGasto

    # Categorías por defecto
    categorias = ['Ropa', 'Calzado', 'Accesorios', 'Vestidos']
    cat_objects = {}
    for c in categorias:
        obj = Categoria.query.filter_by(nombre=c).first()
        if not obj:
            obj = Categoria(nombre=c)
            db.session.add(obj)
        cat_objects[c] = obj

    # Marcas por defecto (asociadas a una categoría)
    marcas_data = {
        'Nike': 'Calzado',
        'Adidas': 'Calzado',
        'Zara': 'Ropa',
        'H&M': 'Ropa',
        'Puma': 'Calzado',
        'Otros': 'Accesorios'
    }
    for nombre_marca, categoria_nombre in marcas_data.items():
        if not Marca.query.filter_by(nombre=nombre_marca).first():
            categoria = cat_objects.get(categoria_nombre)
            if categoria:
                db.session.add(Marca(nombre=nombre_marca, categoria_id=categoria.id))

    # Subcategorías por categoría
    subcategorias = {
        'Ropa': ['Camisas', 'Franelas', 'Chemises', 'Suéteres', 'Abrigos', 'Chaquetas'],
        'Calzado': ['Tacones', 'Chancletas', 'Botas', 'Zapatos', 'Sandalias'],
        'Accesorios': ['Bolsos', 'Cinturones', 'Gorras', 'Bufandas'],
        'Vestidos': ['Vestidos cortos', 'Vestidos largos', 'Vestidos de fiesta']
    }
    subcat_objects = {}
    for cat_nom, subs in subcategorias.items():
        cat = cat_objects.get(cat_nom)
        if cat:
            for sub in subs:
                if not Subcategoria.query.filter_by(nombre=sub, categoria_id=cat.id).first():
                    sub_obj = Subcategoria(nombre=sub, categoria_id=cat.id)
                    db.session.add(sub_obj)
                    subcat_objects[f"{cat_nom}-{sub}"] = sub_obj

    # Tallas por defecto (asociadas a subcategorías)
    tallas_por_subcategoria = {
        'Ropa-Camisas': ['S', 'M', 'L', 'XL', 'XXL'],
        'Ropa-Franelas': ['S', 'M', 'L', 'XL'],
        'Ropa-Chemises': ['S', 'M', 'L', 'XL'],
        'Ropa-Suéteres': ['S', 'M', 'L', 'XL'],
        'Ropa-Abrigos': ['S', 'M', 'L', 'XL'],
        'Ropa-Chaquetas': ['S', 'M', 'L', 'XL'],
        'Calzado-Tacones': ['35', '36', '37', '38', '39', '40', '41'],
        'Calzado-Chancletas': ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45'],
        'Calzado-Botas': ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45'],
        'Calzado-Zapatos': ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45'],
        'Calzado-Sandalias': ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45'],
        'Accesorios-Bolsos': ['Único'],
        'Accesorios-Cinturones': ['S', 'M', 'L', 'XL'],
        'Accesorios-Gorras': ['Único'],
        'Accesorios-Bufandas': ['Único'],
        'Vestidos-Vestidos cortos': ['S', 'M', 'L', 'XL'],
        'Vestidos-Vestidos largos': ['S', 'M', 'L', 'XL'],
        'Vestidos-Vestidos de fiesta': ['S', 'M', 'L', 'XL']
    }
    
    for key, tallas in tallas_por_subcategoria.items():
        subcat = subcat_objects.get(key)
        if subcat:
            for talla_nombre in tallas:
                if not Talla.query.filter_by(nombre=talla_nombre, subcategoria_id=subcat.id).first():
                    db.session.add(Talla(nombre=talla_nombre, subcategoria_id=subcat.id))

    # Configuración: tasa personalizada
    if not Configuracion.query.filter_by(clave='tasa_personalizada').first():
        db.session.add(Configuracion(clave='tasa_personalizada', valor=os.getenv('TASA_PERSONALIZADA', '38.50')))

    # Categorías de gastos por defecto
    categorias_gasto = ['Alquiler', 'Sueldos', 'Servicios', 'Compras', 'Mantenimiento', 'Otros']
    for c in categorias_gasto:
        if not CategoriaGasto.query.filter_by(nombre=c).first():
            db.session.add(CategoriaGasto(nombre=c))

    db.session.commit()

    # Guardar tasas del día en el historial (después de haber creado la tabla)
    try:
        from models import HistorialTasa
        hoy = datetime.now(tz_venezuela).date()  # 🔥 MODIFICADO (aunque ya se llama desde obtener_tasas_bcv, se mantiene por si acaso)
        if not HistorialTasa.query.filter_by(fecha=hoy).first():
            tasas = obtener_tasas_bcv()
            personalizada = obtener_tasa_personalizada()
            guardar_historial_tasas(tasas['usd'], tasas['eur'], personalizada)
    except Exception as e:
        print(f"Error al guardar historial inicial: {e}")