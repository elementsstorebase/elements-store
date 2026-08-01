document.addEventListener('DOMContentLoaded', function() {
    const fechaDesde = document.getElementById('fecha-desde');
    const fechaHasta = document.getElementById('fecha-hasta');

    // ---------- VARIABLES DE ESTADO ----------
    let tipoActual = 'ventas';
    const datosCache = { ventas: null, abonos: null, globales: null };

    const monedas = {
        ventas: { dia: 'USD', top: 'USD', detalle: 'USD' },
        abonos: { dia: 'USD', top: 'USD', detalle: 'USD' },
        globales: { dia: 'USD', top: 'USD', detalle: 'USD' }
    };

    let ventasPorDiaChartInstance = null;
    let metodosPagoChartInstance = null;
    let topProductosChartInstance = null;

    function formatearMonto(monto) {
        if (monto === undefined || monto === null || isNaN(monto)) return '0,00';
        let montoStr = monto.toFixed(2);
        let partes = montoStr.split('.');
        let enteros = partes[0];
        let decimales = partes[1];
        let enterosFormateados = enteros.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return `${enterosFormateados},${decimales}`;
    }

    function obtenerTasas(data) {
        if (data && data.tasas) {
            return { tasaUsd: data.tasas.usd || 1, tasaEur: data.tasas.eur || 1 };
        }
        return { tasaUsd: 1, tasaEur: 1 };
    }

    function actualizarSelectoresMoneda(tipo) {
        const moneda = monedas[tipo];
        if (!moneda) return;

        const contenedores = {
            ventas: {
                dia: '#moneda-ventas-dia',
                top: '#moneda-top-productos',
                detalle: '#moneda-detalle-productos'
            },
            abonos: {
                dia: '#moneda-abonos-dia',
                top: '#moneda-top-apartados',
                detalle: '#moneda-detalle-productos'
            },
            globales: {
                dia: '#moneda-global-dia',
                top: '#moneda-global-top',
                detalle: '#moneda-global-detalle'
            }
        };

        const contenedor = contenedores[tipo];
        if (!contenedor) return;

        const actualizarBotones = (selector, monedaValor) => {
            const container = document.querySelector(selector);
            if (container) {
                container.querySelectorAll('.btn-moneda').forEach(btn => {
                    btn.classList.remove('active', 'bg-indigo-100', 'border-indigo-500', 'text-indigo-700');
                    btn.classList.add('border-gray-300');
                    if (btn.dataset.moneda === monedaValor) {
                        btn.classList.add('active', 'bg-indigo-100', 'border-indigo-500', 'text-indigo-700');
                        btn.classList.remove('border-gray-300');
                    }
                });
            }
        };

        actualizarBotones(contenedor.dia, moneda.dia);
        actualizarBotones(contenedor.top, moneda.top);
        actualizarBotones(contenedor.detalle, moneda.detalle);
    }

    document.querySelectorAll('.btn-moneda').forEach(btn => {
        btn.addEventListener('click', function() {
            const moneda = this.dataset.moneda;
            const target = this.dataset.target;
            if (!moneda || !target) return;

            let key = target;
            if (key.includes('dia')) key = 'dia';
            else if (key.includes('top')) key = 'top';
            else if (key.includes('detalle')) key = 'detalle';

            if (monedas[tipoActual]) {
                monedas[tipoActual][key] = moneda;
            }

            actualizarSelectoresMoneda(tipoActual);
            renderizarDatos(tipoActual);
        });
    });

    function cambiarPestana(tipo) {
        tipoActual = tipo;
        if (!datosCache[tipo]) {
            cargarDatos(tipo);
        } else {
            renderizarDatos(tipo);
        }
        actualizarSelectoresMoneda(tipo);
    }

    function cargarDatos(tipo) {
        const params = new URLSearchParams({
            fecha_desde: fechaDesde.value,
            fecha_hasta: fechaHasta.value
        });

        let endpoint = '';
        switch (tipo) {
            case 'ventas': endpoint = '/api/reportes/resumen'; break;
            case 'abonos': endpoint = '/api/reportes/abonos'; break;
            case 'globales': endpoint = '/api/reportes/globales'; break;
            default: return;
        }

        fetch(`${endpoint}?${params}`)
            .then(r => {
                if (!r.ok) throw new Error(`Error al cargar ${tipo}`);
                return r.json();
            })
            .then(data => {
                datosCache[tipo] = data;
                renderizarDatos(tipo);
            })
            .catch(err => {
                console.error(`Error cargando ${tipo}:`, err);
                mostrarError(tipo);
            });
    }

    function renderizarDatos(tipo) {
        let data = datosCache[tipo];
        if (!data) {
            cargarDatos(tipo);
            return;
        }

        const moneda = monedas[tipo] || { dia: 'USD', top: 'USD', detalle: 'USD' };

        if (tipo === 'ventas') {
            actualizarTarjetasVentasFijas(data);

            const diaKey = (moneda.dia === 'USD') ? 'ventas_por_dia_usd' : 'ventas_por_dia_ves';
            actualizarGraficaDia(tipo, data[diaKey] || [], moneda.dia, data);

            actualizarGraficaMetodosPago(data);

            const topKey = (moneda.top === 'USD') ? 'top_productos_usd' : 'top_productos_ves';
            actualizarGraficaTop(data[topKey] || [], moneda.top);

            cargarDetalleProductos(moneda.detalle, data);

        } else if (tipo === 'abonos') {
            if (typeof window.cargarReportesAbonos === 'function') {
                window.cargarReportesAbonos();
            }
        } else if (tipo === 'globales') {
            if (typeof window.cargarReportesGlobales === 'function') {
                window.cargarReportesGlobales();
            }
        }

        actualizarSelectoresMoneda(tipo);
    }

    function actualizarTarjetasVentasFijas(data) {
        const totalVentasUsd = data.total_ventas_usd || 0;
        const totalVentasVes = data.total_ventas_ves || 0;

        setElementText('total-ventas-usd', `$${formatearMonto(totalVentasUsd)}`);
        setElementText('total-ventas-ves', `Bs ${formatearMonto(totalVentasVes)}`);
        setElementText('ref-ventas-ves-usd', `Ref USD: $${formatearMonto(data.referencia_ventas_ves_usd || 0)}`);
        setElementText('ref-ventas-ves-eur', `Ref EUR: €${formatearMonto(data.referencia_ventas_ves_eur || 0)}`);
        setElementText('ref-ventas-usd-ves', `Ref VES: Bs ${formatearMonto(data.referencia_ventas_usd_ves || 0)}`);
        setElementText('ref-ventas-usd-eur', `Ref EUR: €${formatearMonto(data.referencia_ventas_usd_eur || 0)}`);

        const totalGastosUsd = data.total_gastos_usd || 0;
        const totalGastosVes = data.total_gastos_ves || 0;

        setElementText('total-gastos-usd', `$${formatearMonto(totalGastosUsd)}`);
        setElementText('total-gastos-ves', `Bs ${formatearMonto(totalGastosVes)}`);
        setElementText('ref-gastos-ves-usd', `Ref USD: $${formatearMonto(data.referencia_gastos_ves_usd || 0)}`);
        setElementText('ref-gastos-ves-eur', `Ref EUR: €${formatearMonto(data.referencia_gastos_ves_eur || 0)}`);
        setElementText('ref-gastos-usd-ves', `Ref VES: Bs ${formatearMonto(data.referencia_gastos_usd_ves || 0)}`);
        setElementText('ref-gastos-usd-eur', `Ref EUR: €${formatearMonto(data.referencia_gastos_usd_eur || 0)}`);

        const gananciaUsd = data.ganancia_neta_usd || 0;
        const gananciaVes = data.ganancia_neta_ves || 0;

        setElementText('ganancia-neta-usd', `$${formatearMonto(gananciaUsd)}`);
        setElementText('ganancia-neta-ves', `Bs ${formatearMonto(gananciaVes)}`);
        setElementText('ref-ganancia-ves-usd', `Ref USD: $${formatearMonto(data.referencia_ganancia_ves_usd || 0)}`);
        setElementText('ref-ganancia-ves-eur', `Ref EUR: €${formatearMonto(data.referencia_ganancia_ves_eur || 0)}`);
        setElementText('ref-ganancia-usd-ves', `Ref VES: Bs ${formatearMonto(data.referencia_ganancia_usd_ves || 0)}`);
        setElementText('ref-ganancia-usd-eur', `Ref EUR: €${formatearMonto(data.referencia_ganancia_usd_eur || 0)}`);

        setElementText('costo-total-inventario', `$${formatearMonto(data.costo_total_inventario || 0)}`);
    }

    function setElementText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function actualizarGraficaDia(tipo, datosDia, moneda, data) {
        const ctx = document.getElementById('ventasPorDiaChart').getContext('2d');
        const labels = datosDia.map(d => d.fecha);
        let valores = datosDia.map(d => d.total || 0);
        let formatoMoneda = moneda === 'USD' ? '$' : 'Bs ';

        if (ventasPorDiaChartInstance) {
            ventasPorDiaChartInstance.destroy();
            ventasPorDiaChartInstance = null;
        }

        if (valores.length === 0 || valores.every(v => v === 0)) {
            ventasPorDiaChartInstance = new Chart(ctx, {
                type: 'line',
                data: { labels: ['Sin datos'], datasets: [{ data: [0], borderColor: '#6366F1', borderWidth: 0, backgroundColor: 'transparent', fill: false, pointRadius: 0 }] },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { enabled: false } },
                    scales: { y: { min: 0, max: 1, grid: { display: false }, ticks: { display: false } }, x: { grid: { display: false }, ticks: { display: false } } },
                    plugins: [{
                        id: 'customText',
                        afterDraw: function(chart) {
                            const { ctx, chartArea: { top, bottom, left, right } } = chart;
                            ctx.save();
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.font = '14px Inter, sans-serif';
                            ctx.fillStyle = '#94A3B8';
                            ctx.fillText('No hay datos en el período seleccionado', (left + right) / 2, (top + bottom) / 2);
                            ctx.restore();
                        }
                    }]
                }
            });
        } else {
            let gradient = ctx.createLinearGradient(0, 0, 0, 250);
            gradient.addColorStop(0, 'rgba(99, 102, 241, 0.25)');
            gradient.addColorStop(1, 'rgba(99, 102, 241, 0.00)');

            ventasPorDiaChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        data: valores,
                        borderColor: '#6366F1', borderWidth: 3, backgroundColor: gradient, fill: true, tension: 0.4,
                        pointBackgroundColor: '#6366F1', pointBorderColor: '#FFFFFF', pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 7
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: '#1E293B', titleColor: '#FFFFFF', bodyColor: '#F8FAFC', padding: 12, cornerRadius: 8,
                            callbacks: {
                                label: function(context) {
                                    const index = context.dataIndex;
                                    const monto = valores[index] || 0;
                                    let lineas = [`${formatoMoneda}${formatearMonto(monto)}`];
                                    if (data && data.tasas) {
                                        const tasaUsd = data.tasas.usd || 1;
                                        const tasaEur = data.tasas.eur || 1;
                                        if (moneda === 'USD') {
                                            lineas.push(`Ref VES: Bs ${formatearMonto(monto * tasaUsd)}`);
                                            lineas.push(`Ref EUR: €${formatearMonto(monto * tasaEur)}`);
                                        } else {
                                            lineas.push(`Ref USD: $${formatearMonto(monto / tasaUsd)}`);
                                            lineas.push(`Ref EUR: €${formatearMonto(monto / tasaEur)}`);
                                        }
                                    }
                                    return lineas;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            grid: { display: true, color: '#F1F5F9', drawBorder: false },
                            ticks: { color: '#94A3B8', font: { family: 'Inter', size: 11 }, callback: value => `${formatoMoneda}${value.toFixed(0)}` }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: '#94A3B8', font: { family: 'Inter', size: 11 } }
                        }
                    }
                }
            });
        }
    }

    function actualizarGraficaMetodosPago(data) {
        const ctx = document.getElementById('metodosPagoChart');
        if (!ctx) return;

        if (metodosPagoChartInstance) {
            metodosPagoChartInstance.destroy();
            metodosPagoChartInstance = null;
        }

        const metodos = data.metodos_pago || [];
        if (metodos.length === 0) {
            metodosPagoChartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: { labels: ['Sin datos'], datasets: [{ data: [1], backgroundColor: ['#E2E8F0'], borderWidth: 0 }] },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                    plugins: [{
                        id: 'customText',
                        afterDraw: function(chart) {
                            const { ctx, chartArea: { top, bottom, left, right } } = chart;
                            ctx.save();
                            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                            ctx.font = '14px Inter, sans-serif'; ctx.fillStyle = '#94A3B8';
                            ctx.fillText('No hay métodos de pago', (left + right) / 2, (top + bottom) / 2);
                            ctx.restore();
                        }
                    }]
                }
            });
            return;
        }

        const grouped = {};
        metodos.forEach(m => {
            const key = `${m.metodo}|${m.moneda}`;
            if (!grouped[key]) grouped[key] = { metodo: m.metodo, moneda: m.moneda, monto: 0 };
            grouped[key].monto += m.monto;
        });

        const tasaUsd = data.tasas?.usd || 1;
        const entries = Object.values(grouped);
        const chartValues = entries.map(e => e.moneda === 'USD' ? e.monto : e.monto / tasaUsd);
        const labels = entries.map(e => `${e.metodo} (${e.moneda === 'USD' ? '$' : 'Bs'})`);
        const colores = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

        metodosPagoChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: chartValues,
                    backgroundColor: colores.slice(0, labels.length),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const entry = entries[context.dataIndex];
                                if (!entry) return '';
                                const simbolo = entry.moneda === 'USD' ? '$' : 'Bs ';
                                return `${simbolo}${formatearMonto(entry.monto)}`;
                            }
                        }
                    }
                }
            }
        });
    }

    function actualizarGraficaTop(topProductos, moneda) {
        const ctx = document.getElementById('topProductosChart').getContext('2d');
        const labels = topProductos.map(p => p.nombre);
        const values = topProductos.map(p => p.vendido || 0);
        const colores = ['#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16', '#8B5CF6', '#F43F5E', '#22D3EE'];

        if (topProductosChartInstance) {
            topProductosChartInstance.destroy();
            topProductosChartInstance = null;
        }

        if (labels.length === 0 || values.every(v => v === 0)) {
            topProductosChartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: { labels: ['Sin datos'], datasets: [{ data: [1], backgroundColor: ['#E2E8F0'], borderWidth: 0 }] },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                    plugins: [{
                        id: 'customText',
                        afterDraw: function(chart) {
                            const { ctx, chartArea: { top, bottom, left, right } } = chart;
                            ctx.save();
                            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                            ctx.font = '14px Inter, sans-serif'; ctx.fillStyle = '#94A3B8';
                            ctx.fillText('No hay productos', (left + right) / 2, (top + bottom) / 2);
                            ctx.restore();
                        }
                    }]
                }
            });
        } else {
            topProductosChartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{ data: values, backgroundColor: colores.slice(0, labels.length), borderWidth: 0 }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom' },
                        tooltip: { callbacks: { label: ctx => `Cantidad: ${values[ctx.dataIndex] || 0}` } }
                    }
                }
            });
        }
    }

    function cargarDetalleProductos(moneda, dataVentas) {
        const ul = document.getElementById('top-productos');
        if (!ul) return;
        ul.innerHTML = '<li class="py-2 text-gray-400">Cargando detalle...</li>';

        const params = new URLSearchParams({
            fecha_desde: fechaDesde.value,
            fecha_hasta: fechaHasta.value,
            moneda: moneda
        });

        fetch(`/api/reportes/detalle-ventas?${params}`)
            .then(r => r.json())
            .then(detalles => {
                ul.innerHTML = '';
                if (!detalles || detalles.length === 0) {
                    ul.innerHTML = '<li class="py-2 text-gray-400">Sin ventas en este período</li>';
                    return;
                }
                const esUSD = moneda === 'USD';
                detalles.forEach(d => {
                    const li = document.createElement('li');
                    li.className = 'py-2 flex justify-between border-b border-gray-100';
                    // Cálculo robusto del monto: si es USD usa monto_usd, si es VES usa precio_unitario_ves * cantidad
                    let montoMostrar;
                    if (esUSD) {
                        montoMostrar = d.monto_usd || (d.precio_unitario_usd || 0) * (d.cantidad || 0);
                    } else {
                        // En VES, usamos precio_unitario_ves * cantidad para garantizar el total real
                        montoMostrar = (d.precio_unitario_ves || 0) * (d.cantidad || 0);
                        // Si por alguna razón no hay precio_unitario_ves, fallback a monto_ves
                        if (!montoMostrar && d.monto_ves) montoMostrar = d.monto_ves;
                    }
                    const simbolo = esUSD ? '$' : 'Bs ';
                    li.innerHTML = `
                        <span>${d.producto} - ${d.cliente} (x${d.cantidad})</span>
                        <span class="font-medium">${simbolo}${formatearMonto(montoMostrar)}</span>
                    `;
                    ul.appendChild(li);
                });
            })
            .catch(err => {
                console.error('Error cargando detalle de ventas:', err);
                ul.innerHTML = '<li class="py-2 text-red-400">Error al cargar detalle</li>';
            });
    }

    function mostrarError(tipo) {
        document.getElementById('total-ventas-usd').textContent = 'Error';
        document.getElementById('total-ventas-ves').textContent = 'Error';
        document.getElementById('total-gastos-usd').textContent = 'Error';
        document.getElementById('total-gastos-ves').textContent = 'Error';
        document.getElementById('ganancia-neta-usd').textContent = 'Error';
        document.getElementById('ganancia-neta-ves').textContent = 'Error';
        document.getElementById('costo-total-inventario').textContent = 'Error';

        if (ventasPorDiaChartInstance) { ventasPorDiaChartInstance.destroy(); ventasPorDiaChartInstance = null; }
        if (metodosPagoChartInstance) { metodosPagoChartInstance.destroy(); metodosPagoChartInstance = null; }
        if (topProductosChartInstance) { topProductosChartInstance.destroy(); topProductosChartInstance = null; }

        const ctx = document.getElementById('ventasPorDiaChart');
        if (ctx) {
            ventasPorDiaChartInstance = new Chart(ctx, {
                type: 'line',
                data: { labels: ['Error'], datasets: [{ data: [0], borderColor: '#EF4444', borderWidth: 0 }] },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    plugins: [{
                        id: 'customText',
                        afterDraw: function(chart) {
                            const { ctx, chartArea: { top, bottom, left, right } } = chart;
                            ctx.save();
                            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                            ctx.font = '14px Inter, sans-serif'; ctx.fillStyle = '#EF4444';
                            ctx.fillText('Error al cargar datos', (left + right) / 2, (top + bottom) / 2);
                            ctx.restore();
                        }
                    }]
                }
            });
        }
    }

    function abrirModalDetalleInventario() {
        const modal = document.getElementById('modal-detalle-inventario');
        const tbody = document.getElementById('tabla-detalle-inventario');
        const totalSpan = document.getElementById('detalle-inventario-total');
        modal.classList.remove('hidden');
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-400">Cargando...</td></tr>';
        totalSpan.textContent = '$0.00';

        fetch('/api/reportes/inventario-detalle')
            .then(r => {
                if (!r.ok) throw new Error('Error al obtener el detalle del inventario');
                return r.json();
            })
            .then(data => {
                tbody.innerHTML = '';
                if (data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-400">No hay productos en el inventario</td></tr>';
                    totalSpan.textContent = '$0.00';
                    return;
                }
                let totalCalculado = 0;
                data.forEach(p => {
                    const tr = document.createElement('tr');
                    tr.className = 'border-b border-gray-100';
                    tr.innerHTML = `
                        <td class="py-2 px-3">${p.nombre}</td>
                        <td class="px-3 text-right">$${formatearMonto(p.costo_usd)}</td>
                        <td class="px-3 text-center">${p.stock}</td>
                        <td class="px-3 text-right font-medium">$${formatearMonto(p.subtotal)}</td>
                    `;
                    tbody.appendChild(tr);
                    totalCalculado += p.subtotal;
                });
                totalSpan.textContent = `$${formatearMonto(totalCalculado)}`;
            })
            .catch(err => {
                console.error('Error cargando detalle de inventario:', err);
                tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-red-400">Error al cargar el detalle del inventario</td></tr>';
                totalSpan.textContent = '$0.00';
            });
    }

    window.cerrarModalDetalleInventario = function() {
        document.getElementById('modal-detalle-inventario').classList.add('hidden');
    };

    function recargarDatos() {
        datosCache[tipoActual] = null;
        cargarDatos(tipoActual);
    }

    function init() {
        const hoy = new Date();
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        fechaDesde.value = inicioMes.toISOString().split('T')[0];
        fechaHasta.value = hoy.toISOString().split('T')[0];

        cambiarPestana('ventas');

        document.getElementById('btn-filtrar').addEventListener('click', recargarDatos);
        document.getElementById('btn-ver-detalle-inventario').addEventListener('click', abrirModalDetalleInventario);

        document.querySelectorAll('[data-pestana]').forEach(btn => {
            btn.addEventListener('click', function() {
                const tipo = this.dataset.pestana;
                cambiarPestana(tipo);
                document.querySelectorAll('[data-pestana]').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
            });
        });
    }

    window.cambiarPestana = cambiarPestana;
    window.cargarReportesVentas = () => cambiarPestana('ventas');
    window.cargarReportesAbonos = () => cambiarPestana('abonos');
    window.cargarReportesGlobales = () => cambiarPestana('globales');

    init();
});