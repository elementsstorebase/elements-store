/**
 * main.js - Funciones globales del sistema
 * Controla:
 * - Actualización de tasas (badge superior)
 * - Sidebar colapsable (hamburguesa)
 * - Persistencia de estado del sidebar (localStorage)
 * - Formateo de montos (funciones globales)
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('🟢 main.js cargado correctamente');

    // ---------- INICIALIZAR ESTADOS ----------
    // Sidebar colapsado (sin modo oscuro)
    const sidebar = document.getElementById('sidebar');
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isCollapsed && sidebar) {
        sidebar.classList.add('w-20');
        sidebar.classList.remove('w-64');
        // Ocultar textos
        document.querySelectorAll('.nav-text').forEach(text => {
            text.style.display = 'none';
            text.style.opacity = '0';
        });
    } else if (sidebar) {
        sidebar.classList.remove('w-20');
        sidebar.classList.add('w-64');
        document.querySelectorAll('.nav-text').forEach(text => {
            text.style.display = 'inline';
            text.style.opacity = '1';
        });
    }

    // ---------- ACTUALIZAR TASAS (CADA 60 SEGUNDOS) ----------
    actualizarTasas();
    setInterval(actualizarTasas, 60000);

    // ---------- EVENTOS GLOBALES ----------
    // Sidebar toggle (hamburguesa)
    const toggleBtn = document.getElementById('sidebar-toggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            const sidebarEl = document.getElementById('sidebar');
            if (!sidebarEl) return;

            const isCurrentlyCollapsed = sidebarEl.classList.contains('w-20');
            const navTexts = document.querySelectorAll('.nav-text');

            if (isCurrentlyCollapsed) {
                // Expandir
                sidebarEl.classList.remove('w-20');
                sidebarEl.classList.add('w-64');
                navTexts.forEach(text => {
                    text.style.display = 'inline';
                    setTimeout(() => { text.style.opacity = '1'; }, 50);
                });
                localStorage.setItem('sidebarCollapsed', 'false');
            } else {
                // Colapsar
                sidebarEl.classList.add('w-20');
                sidebarEl.classList.remove('w-64');
                navTexts.forEach(text => {
                    text.style.opacity = '0';
                    setTimeout(() => { text.style.display = 'none'; }, 150);
                });
                localStorage.setItem('sidebarCollapsed', 'true');
            }
        });
    }

    // ---------- RESALTAR ENLACE ACTIVO ----------
    const currentPath = window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active', 'bg-indigo-50', 'text-indigo-600', 'shadow-sm');
        }
    });
});

// ---------- FUNCIÓN GLOBAL: ACTUALIZAR TASAS ----------
function actualizarTasas() {
    fetch('/api/tasas')
        .then(response => {
            if (!response.ok) throw new Error('Error al obtener tasas');
            return response.json();
        })
        .then(data => {
            if (data.bcv_usd !== undefined && data.bcv_eur !== undefined) {
                const usdEl = document.getElementById('tasa-usd-val');
                const eurEl = document.getElementById('tasa-eur-val');
                const persEl = document.getElementById('tasa-pers-val');

                if (usdEl) usdEl.textContent = data.bcv_usd.toFixed(2);
                if (eurEl) eurEl.textContent = data.bcv_eur.toFixed(2);
                if (persEl) persEl.textContent = data.personalizada.toFixed(2);

                console.log('✅ Tasas actualizadas desde:', data.source || 'BCV');
            } else {
                console.warn('⚠️ No se pudieron obtener tasas, usando valores previos');
            }
        })
        .catch(error => {
            console.error('❌ Error al cargar tasas:', error);
        });
}

// ---------- FUNCIONES DE UTILIDAD PARA FORMATEO DE MONTOS ----------
/**
 * Formatea un número como monto en Bolívares con formato venezolano:
 * - Separador de miles: punto (.)
 * - Separador decimal: coma (,)
 * - Dos decimales
 * Ejemplo: 62500.70 -> "62.500,70"
 */
function formatearMontoVES(monto) {
    if (monto === undefined || monto === null || isNaN(monto)) {
        return '0,00';
    }
    // Redondear a 2 decimales y convertir a string
    let montoStr = monto.toFixed(2);
    let partes = montoStr.split('.');
    let enteros = partes[0];
    let decimales = partes[1];
    // Agregar separadores de miles (puntos)
    let enterosFormateados = enteros.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${enterosFormateados},${decimales}`;
}

/**
 * Formatea un número como monto en USD o EUR con formato internacional:
 * - Dos decimales
 * - Sin separadores de miles
 */
function formatearMontoUSD(monto) {
    if (monto === undefined || monto === null || isNaN(monto)) {
        return '0.00';
    }
    return monto.toFixed(2);
}

// ---------- EXPONER FUNCIONES GLOBALMENTE ----------
window.actualizarTasas = actualizarTasas;
window.formatearMontoVES = formatearMontoVES;
window.formatearMontoUSD = formatearMontoUSD;

// ---------- EVENTO PARA ACTUALIZAR TASAS CUANDO LA PÁGINA VUELVE A SER VISIBLE ----------
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        // La página volvió a ser visible, actualizar tasas
        actualizarTasas();
    }
});