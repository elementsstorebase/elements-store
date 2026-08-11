/**
 * reportes_globales.js
 * Lógica para la pestaña de Ventas Globales (Ventas + Apartados finalizados)
 * Versión simplificada: solo tarjetas de resumen (valores siempre visibles).
 */

document.addEventListener('DOMContentLoaded', function() {
    // ============================================================
    // REFERENCIAS A ELEMENTOS DE LA PESTAÑA GLOBAL
    // ============================================================
    const globalTotalVentasUsd = document.getElementById('global-total-ventas-usd');
    const globalTotalVentasVes = document.getElementById('global-total-ventas-ves');
    const globalTotalGastosUsd = document.getElementById('global-total-gastos-usd');
    const globalTotalGastosVes = document.getElementById('global-total-gastos-ves');
    const globalGananciaNetaUsd = document.getElementById('global-ganancia-neta-usd');
    const globalGananciaNetaVes = document.getElementById('global-ganancia-neta-ves');

    const refGlobalVentasUsdVes = document.getElementById('ref-global-ventas-usd-ves');
    const refGlobalVentasUsdEur = document.getElementById('ref-global-ventas-usd-eur');
    const refGlobalVentasVesUsd = document.getElementById('ref-global-ventas-ves-usd');
    const refGlobalVentasVesEur = document.getElementById('ref-global-ventas-ves-eur');

    const refGlobalGastosUsdVes = document.getElementById('ref-global-gastos-usd-ves');
    const refGlobalGastosUsdEur = document.getElementById('ref-global-gastos-usd-eur');
    const refGlobalGastosVesUsd = document.getElementById('ref-global-gastos-ves-usd');
    const refGlobalGastosVesEur = document.getElementById('ref-global-gastos-ves-eur');

    const refGlobalGananciaUsdVes = document.getElementById('ref-global-ganancia-usd-ves');
    const refGlobalGananciaUsdEur = document.getElementById('ref-global-ganancia-usd-eur');

    // ============================================================
    // FUNCIÓN DE FORMATEO
    // ============================================================
    function formatearMonto(monto) {
        if (monto === undefined || monto === null || isNaN(monto)) return '0,00';
        let montoStr = monto.toFixed(2);
        let partes = montoStr.split('.');
        let enteros = partes[0];
        let decimales = partes[1];
        let enterosFormateados = enteros.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return `${enterosFormateados},${decimales}`;
    }

    // ============================================================
    // ACTUALIZAR TARJETAS GLOBALES FIJAS (VALORES SIEMPRE VISIBLES)
    // ============================================================
    function actualizarTarjetasGlobalesFijas(data) {
        // Ventas globales
        if (globalTotalVentasUsd) {
            globalTotalVentasUsd.textContent = `$${formatearMonto(data.total_ventas_usd || 0)}`;
        }
        if (globalTotalVentasVes) {
            globalTotalVentasVes.textContent = `Bs ${formatearMonto(data.total_ventas_ves || 0)}`;
        }
        if (refGlobalVentasUsdVes) {
            refGlobalVentasUsdVes.textContent = `Ref VES: Bs ${formatearMonto(data.referencia_ventas_usd_ves || 0)}`;
        }
        if (refGlobalVentasUsdEur) {
            refGlobalVentasUsdEur.textContent = `Ref EUR: €${formatearMonto(data.referencia_ventas_usd_eur || 0)}`;
        }
        if (refGlobalVentasVesUsd) {
            refGlobalVentasVesUsd.textContent = `Ref USD: $${formatearMonto(data.referencia_ventas_ves_usd || 0)}`;
        }
        if (refGlobalVentasVesEur) {
            refGlobalVentasVesEur.textContent = `Ref EUR: €${formatearMonto(data.referencia_ventas_ves_eur || 0)}`;
        }

        // Gastos globales
        if (globalTotalGastosUsd) {
            globalTotalGastosUsd.textContent = `$${formatearMonto(data.total_gastos_usd || 0)}`;
        }
        if (globalTotalGastosVes) {
            globalTotalGastosVes.textContent = `Bs ${formatearMonto(data.total_gastos_ves || 0)}`;
        }
        if (refGlobalGastosUsdVes) {
            refGlobalGastosUsdVes.textContent = `Ref VES: Bs ${formatearMonto(data.referencia_gastos_usd_ves || 0)}`;
        }
        if (refGlobalGastosUsdEur) {
            refGlobalGastosUsdEur.textContent = `Ref EUR: €${formatearMonto(data.referencia_gastos_usd_eur || 0)}`;
        }
        if (refGlobalGastosVesUsd) {
            refGlobalGastosVesUsd.textContent = `Ref USD: $${formatearMonto(data.referencia_gastos_ves_usd || 0)}`;
        }
        if (refGlobalGastosVesEur) {
            refGlobalGastosVesEur.textContent = `Ref EUR: €${formatearMonto(data.referencia_gastos_ves_eur || 0)}`;
        }

        // Ganancia neta global
        if (globalGananciaNetaUsd) {
            globalGananciaNetaUsd.textContent = `$${formatearMonto(data.ganancia_neta_usd || 0)}`;
        }
        if (globalGananciaNetaVes) {
            globalGananciaNetaVes.textContent = `Bs ${formatearMonto(data.ganancia_neta_ves || 0)}`;
        }
        if (refGlobalGananciaUsdVes) {
            refGlobalGananciaUsdVes.textContent = `Ref VES: Bs ${formatearMonto(data.referencia_ganancia_usd_ves || 0)}`;
        }
        if (refGlobalGananciaUsdEur) {
            refGlobalGananciaUsdEur.textContent = `Ref EUR: €${formatearMonto(data.referencia_ganancia_usd_eur || 0)}`;
        }
    }

    // ============================================================
    // FUNCIÓN PRINCIPAL PARA CARGAR DATOS GLOBALES
    // ============================================================
    function cargarReportesGlobales() {
        const fechaDesde = document.getElementById('fecha-desde');
        const fechaHasta = document.getElementById('fecha-hasta');

        if (!fechaDesde || !fechaHasta) {
            console.warn('Fechas no disponibles, usando valores por defecto');
            const hoy = new Date();
            const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
            const desde = inicioMes.toISOString().split('T')[0];
            const hasta = hoy.toISOString().split('T')[0];
            cargarDesdeBackend(desde, hasta);
            return;
        }

        cargarDesdeBackend(fechaDesde.value, fechaHasta.value);
    }

    function cargarDesdeBackend(fechaDesde, fechaHasta) {
        const params = new URLSearchParams({
            fecha_desde: fechaDesde || '',
            fecha_hasta: fechaHasta || ''
        });

        fetch(`/api/reportes/globales?${params}`)
            .then(r => {
                if (!r.ok) throw new Error('Error al cargar datos globales');
                return r.json();
            })
            .then(data => {
                actualizarTarjetasGlobalesFijas(data);
            })
            .catch(err => {
                console.error('Error cargando datos globales:', err);
                mostrarErrorGlobal();
            });
    }

    function mostrarErrorGlobal() {
        const elementos = [
            'global-total-ventas-usd', 'global-total-ventas-ves',
            'global-total-gastos-usd', 'global-total-gastos-ves',
            'global-ganancia-neta-usd', 'global-ganancia-neta-ves'
        ];
        elementos.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = 'Error';
        });
    }

    // ============================================================
    // EXPOSICIÓN GLOBAL
    // ============================================================
    window.cargarReportesGlobales = cargarReportesGlobales;

    console.log('📊 reportes_globales.js cargado (modo simplificado: solo tarjetas).');
});