/**
 * reportes_abonos.js
 * Lógica para la pestaña de Abonos en Reportes
 * Versión simplificada: solo tarjetas de resumen y tabla de clientes pagados.
 */

document.addEventListener('DOMContentLoaded', function() {
    // ============================================================
    // REFERENCIAS A ELEMENTOS DE LA PESTAÑA DE ABONOS
    // ============================================================
    // Tarjetas de resumen
    const totalAbonosUsd = document.getElementById('total-abonos-usd');
    const totalAbonosVes = document.getElementById('total-abonos-ves');
    const refAbonosVesUsd = document.getElementById('ref-abonos-ves-usd');
    const refAbonosVesEur = document.getElementById('ref-abonos-ves-eur');
    const refAbonosUsdVes = document.getElementById('ref-abonos-usd-ves');
    const refAbonosUsdEur = document.getElementById('ref-abonos-usd-eur');

    const abonosGastosUsd = document.getElementById('abonos-gastos-usd');
    const abonosGastosVes = document.getElementById('abonos-gastos-ves');
    const refAbonosGastosVesUsd = document.getElementById('ref-abonos-gastos-ves-usd');
    const refAbonosGastosVesEur = document.getElementById('ref-abonos-gastos-ves-eur');
    const refAbonosGastosUsdVes = document.getElementById('ref-abonos-gastos-usd-ves');
    const refAbonosGastosUsdEur = document.getElementById('ref-abonos-gastos-usd-eur');

    const abonosGananciaNetaUsd = document.getElementById('abonos-ganancia-neta-usd');
    const abonosGananciaNetaVes = document.getElementById('abonos-ganancia-neta-ves');
    const refAbonosGananciaUsdVes = document.getElementById('ref-abonos-ganancia-usd-ves');
    const refAbonosGananciaUsdEur = document.getElementById('ref-abonos-ganancia-usd-eur');

    // Tabla de clientes pagados
    const tablaClientesPagados = document.getElementById('tabla-clientes-pagados');

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
    // RENDERIZAR DATOS DE ABONOS (SOLO TARJETAS Y TABLA)
    // ============================================================
    function renderizarAbonos(data) {
        // ----- 1. Actualizar tarjetas de resumen (fijas en ambas monedas) -----
        if (totalAbonosUsd) {
            totalAbonosUsd.textContent = `$${formatearMonto(data.total_abonos_usd || 0)}`;
        }
        if (totalAbonosVes) {
            totalAbonosVes.textContent = `Bs ${formatearMonto(data.total_abonos_ves || 0)}`;
        }
        if (refAbonosVesUsd) {
            refAbonosVesUsd.textContent = `Ref USD: $${formatearMonto(data.referencia_abonos_ves_usd || 0)}`;
        }
        if (refAbonosVesEur) {
            refAbonosVesEur.textContent = `Ref EUR: €${formatearMonto(data.referencia_abonos_ves_eur || 0)}`;
        }
        if (refAbonosUsdVes) {
            refAbonosUsdVes.textContent = `Ref VES: Bs ${formatearMonto(data.referencia_abonos_usd_ves || 0)}`;
        }
        if (refAbonosUsdEur) {
            refAbonosUsdEur.textContent = `Ref EUR: €${formatearMonto(data.referencia_abonos_usd_eur || 0)}`;
        }

        // Gastos
        if (abonosGastosUsd) {
            abonosGastosUsd.textContent = `$${formatearMonto(data.total_gastos_usd || 0)}`;
        }
        if (abonosGastosVes) {
            abonosGastosVes.textContent = `Bs ${formatearMonto(data.total_gastos_ves || 0)}`;
        }
        if (refAbonosGastosVesUsd) {
            refAbonosGastosVesUsd.textContent = `Ref USD: $${formatearMonto(data.referencia_gastos_ves_usd || 0)}`;
        }
        if (refAbonosGastosVesEur) {
            refAbonosGastosVesEur.textContent = `Ref EUR: €${formatearMonto(data.referencia_gastos_ves_eur || 0)}`;
        }
        if (refAbonosGastosUsdVes) {
            refAbonosGastosUsdVes.textContent = `Ref VES: Bs ${formatearMonto(data.referencia_gastos_usd_ves || 0)}`;
        }
        if (refAbonosGastosUsdEur) {
            refAbonosGastosUsdEur.textContent = `Ref EUR: €${formatearMonto(data.referencia_gastos_usd_eur || 0)}`;
        }

        // Ganancia neta
        const gananciaUsd = data.ganancia_neta_usd || 0;
        const gananciaVes = data.ganancia_neta_ves || 0;
        if (abonosGananciaNetaUsd) {
            abonosGananciaNetaUsd.textContent = `$${formatearMonto(gananciaUsd)}`;
        }
        if (abonosGananciaNetaVes) {
            abonosGananciaNetaVes.textContent = `Bs ${formatearMonto(gananciaVes)}`;
        }
        if (refAbonosGananciaUsdVes) {
            refAbonosGananciaUsdVes.textContent = `Ref VES: Bs ${formatearMonto(data.referencia_ganancia_usd_ves || 0)}`;
        }
        if (refAbonosGananciaUsdEur) {
            refAbonosGananciaUsdEur.textContent = `Ref EUR: €${formatearMonto(data.referencia_ganancia_usd_eur || 0)}`;
        }

        // ----- 2. Tabla de clientes pagados -----
        actualizarListaClientesPagados(data.clientes_pagados || []);
    }

    // ============================================================
    // LISTA DE CLIENTES PAGADOS (MUESTRA AMBAS MONEDAS)
    // ============================================================
    function actualizarListaClientesPagados(clientes) {
        if (!tablaClientesPagados) return;
        tablaClientesPagados.innerHTML = '';

        if (!clientes || clientes.length === 0) {
            tablaClientesPagados.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-gray-400">No hay clientes que hayan pagado en este período</td></tr>';
            return;
        }

        clientes.forEach(c => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-gray-100 hover:bg-gray-50 transition-colors';
            tr.innerHTML = `
                <td class="py-2 px-3 font-medium">${c.cliente}</td>
                <td class="py-2 px-3">${c.cedula}</td>
                <td class="py-2 px-3">${c.producto}</td>
                <td class="py-2 px-3 text-center">${c.cantidad}</td>
                <td class="py-2 px-3 text-right font-medium">$${formatearMonto(c.total_usd)}</td>
                <td class="py-2 px-3 text-right">Bs ${formatearMonto(c.total_ves)}</td>
                <td class="py-2 px-3">${c.metodo_cobro || '-'}</td>
                <td class="py-2 px-3">${c.metodo_pago || '-'}</td>
                <td class="py-2 px-3 text-center text-sm">${c.fecha_finalizacion}</td>
            `;
            tablaClientesPagados.appendChild(tr);
        });
    }

    // ============================================================
    // FUNCIÓN PRINCIPAL PARA CARGAR DATOS DE ABONOS
    // ============================================================
    function cargarReportesAbonos() {
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

        fetch(`/api/reportes/abonos?${params}`)
            .then(r => {
                if (!r.ok) throw new Error('Error al cargar reportes de abonos');
                return r.json();
            })
            .then(data => {
                renderizarAbonos(data);
            })
            .catch(err => {
                console.error('Error cargando reportes de abonos:', err);
                mostrarErrorAbonos();
            });
    }

    function mostrarErrorAbonos() {
        const elementos = [
            'total-abonos-usd', 'total-abonos-ves',
            'abonos-gastos-usd', 'abonos-gastos-ves',
            'abonos-ganancia-neta-usd', 'abonos-ganancia-neta-ves'
        ];
        elementos.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = 'Error';
        });
        if (tablaClientesPagados) {
            tablaClientesPagados.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-red-400">Error al cargar datos</td></tr>';
        }
    }

    // ============================================================
    // INICIALIZACIÓN Y EXPOSICIÓN GLOBAL
    // ============================================================
    window.cargarReportesAbonos = cargarReportesAbonos;

    console.log('📊 reportes_abonos.js cargado (modo simplificado: solo tarjetas y tabla).');
});