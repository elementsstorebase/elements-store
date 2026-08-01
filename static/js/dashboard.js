document.addEventListener('DOMContentLoaded', function() {
    // Variables globales para tasas
    let tasaUsd = 0;
    let tasaEur = 0;
    let ventasChartInstance = null;
    let topProductosChartInstance = null;

    // ---------- NUEVA PALETA DE COLORES VARIADA PARA TOP PRODUCTOS ----------
    const coloresTop = [
        '#FF6B6B',   // Rojo coral
        '#4ECDC4',   // Turquesa
        '#FFE66D',   // Amarillo
        '#1A535C',   // Azul oscuro
        '#FF9F1C',   // Naranja
        '#B980F0',   // Púrpura claro
        '#FF85A1',   // Rosa
        '#00D2FF',   // Celeste brillante
        '#FF5733',   // Rojo anaranjado
        '#33FF57',   // Verde lima
        '#33A2FF',   // Azul cielo
        '#FF33A2',   // Magenta
    ];

    // ---------- FUNCIÓN DE FORMATEO UNIFICADA ----------
    function formatearMonto(monto) {
        if (monto === undefined || monto === null || isNaN(monto)) return '0,00';
        let montoStr = monto.toFixed(2);
        let partes = montoStr.split('.');
        let enteros = partes[0];
        let decimales = partes[1];
        let enterosFormateados = enteros.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return `${enterosFormateados},${decimales}`;
    }

    // ---------- OBTENER TASAS DEL DOM ----------
    function obtenerTasasDelDOM() {
        const usdEl = document.getElementById('tasa-usd-val');
        const eurEl = document.getElementById('tasa-eur-val');
        if (usdEl && eurEl) {
            tasaUsd = parseFloat(usdEl.textContent) || 1;
            tasaEur = parseFloat(eurEl.textContent) || 1;
        }
        console.log(`📊 Tasas cargadas: USD=${tasaUsd}, EUR=${tasaEur}`);
    }

    // ---------- ACTUALIZAR REFERENCIAS ----------
    function actualizarReferencias() {
        // Obtener los montos USD de los elementos
        const diarioUsdEl = document.getElementById('venta-diaria-usd');
        const semanalUsdEl = document.getElementById('venta-semanal-usd');
        const mensualUsdEl = document.getElementById('venta-mensual-usd');

        // Obtener los montos VES de los elementos
        const diarioVesEl = document.getElementById('venta-diaria-ves');
        const semanalVesEl = document.getElementById('venta-semanal-ves');
        const mensualVesEl = document.getElementById('venta-mensual-ves');

        // Extraer valores numéricos (formato: puntos miles, coma decimal)
        const diarioUsd = parseFloat(diarioUsdEl?.textContent.replace('$', '').replace(/\./g, '').replace(',', '.')) || 0;
        const semanalUsd = parseFloat(semanalUsdEl?.textContent.replace('$', '').replace(/\./g, '').replace(',', '.')) || 0;
        const mensualUsd = parseFloat(mensualUsdEl?.textContent.replace('$', '').replace(/\./g, '').replace(',', '.')) || 0;

        const diarioVes = parseFloat(diarioVesEl?.textContent.replace('Bs', '').replace(/\./g, '').replace(',', '.')) || 0;
        const semanalVes = parseFloat(semanalVesEl?.textContent.replace('Bs', '').replace(/\./g, '').replace(',', '.')) || 0;
        const mensualVes = parseFloat(mensualVesEl?.textContent.replace('Bs', '').replace(/\./g, '').replace(',', '.')) || 0;

        // Calcular referencias
        const refVesDiario = diarioUsd * tasaUsd;
        const refVesSemanal = semanalUsd * tasaUsd;
        const refVesMensual = mensualUsd * tasaUsd;
        const refEurDiario = diarioUsd * tasaEur;
        const refEurSemanal = semanalUsd * tasaEur;
        const refEurMensual = mensualUsd * tasaEur;

        const refUsdDiario = tasaUsd > 0 ? diarioVes / tasaUsd : 0;
        const refUsdSemanal = tasaUsd > 0 ? semanalVes / tasaUsd : 0;
        const refUsdMensual = tasaUsd > 0 ? mensualVes / tasaUsd : 0;
        const refEurDiarioDesdeVes = tasaEur > 0 ? diarioVes / tasaEur : 0;
        const refEurSemanalDesdeVes = tasaEur > 0 ? semanalVes / tasaEur : 0;
        const refEurMensualDesdeVes = tasaEur > 0 ? mensualVes / tasaEur : 0;

        // Actualizar elementos de referencia en USD
        const refDiarioUsdVes = document.getElementById('venta-diaria-usd-ref-ves');
        const refSemanalUsdVes = document.getElementById('venta-semanal-usd-ref-ves');
        const refMensualUsdVes = document.getElementById('venta-mensual-usd-ref-ves');
        const refDiarioUsdEur = document.getElementById('venta-diaria-usd-ref-eur');
        const refSemanalUsdEur = document.getElementById('venta-semanal-usd-ref-eur');
        const refMensualUsdEur = document.getElementById('venta-mensual-usd-ref-eur');

        if (refDiarioUsdVes) refDiarioUsdVes.textContent = `Bs ${formatearMonto(refVesDiario)}`;
        if (refSemanalUsdVes) refSemanalUsdVes.textContent = `Bs ${formatearMonto(refVesSemanal)}`;
        if (refMensualUsdVes) refMensualUsdVes.textContent = `Bs ${formatearMonto(refVesMensual)}`;
        if (refDiarioUsdEur) refDiarioUsdEur.textContent = `€ ${formatearMonto(refEurDiario)}`;
        if (refSemanalUsdEur) refSemanalUsdEur.textContent = `€ ${formatearMonto(refEurSemanal)}`;
        if (refMensualUsdEur) refMensualUsdEur.textContent = `€ ${formatearMonto(refEurMensual)}`;

        // Actualizar elementos de referencia en VES
        const refDiarioVesUsd = document.getElementById('venta-diaria-ves-ref-usd');
        const refSemanalVesUsd = document.getElementById('venta-semanal-ves-ref-usd');
        const refMensualVesUsd = document.getElementById('venta-mensual-ves-ref-usd');
        const refDiarioVesEur = document.getElementById('venta-diaria-ves-ref-eur');
        const refSemanalVesEur = document.getElementById('venta-semanal-ves-ref-eur');
        const refMensualVesEur = document.getElementById('venta-mensual-ves-ref-eur');

        if (refDiarioVesUsd) refDiarioVesUsd.textContent = `$${formatearMonto(refUsdDiario)}`;
        if (refSemanalVesUsd) refSemanalVesUsd.textContent = `$${formatearMonto(refUsdSemanal)}`;
        if (refMensualVesUsd) refMensualVesUsd.textContent = `$${formatearMonto(refUsdMensual)}`;
        if (refDiarioVesEur) refDiarioVesEur.textContent = `€ ${formatearMonto(refEurDiarioDesdeVes)}`;
        if (refSemanalVesEur) refSemanalVesEur.textContent = `€ ${formatearMonto(refEurSemanalDesdeVes)}`;
        if (refMensualVesEur) refMensualVesEur.textContent = `€ ${formatearMonto(refEurMensualDesdeVes)}`;

        console.log('🔄 Referencias actualizadas');
    }

    // ---------- CARGAR MÉTRICAS DEL DASHBOARD ----------
    function cargarMetricas() {
        fetch('/api/dashboard/metricas')
            .then(res => {
                if (!res.ok) throw new Error('Error en la respuesta de métricas');
                return res.json();
            })
            .then(data => {
                // Diario
                document.getElementById('venta-diaria-ves').textContent = `Bs ${formatearMonto(data.diario.ves)}`;
                document.getElementById('venta-diaria-usd').textContent = `$${formatearMonto(data.diario.usd)}`;
                
                // Semanal
                document.getElementById('venta-semanal-ves').textContent = `Bs ${formatearMonto(data.semanal.ves)}`;
                document.getElementById('venta-semanal-usd').textContent = `$${formatearMonto(data.semanal.usd)}`;
                
                // Mensual
                document.getElementById('venta-mensual-ves').textContent = `Bs ${formatearMonto(data.mensual.ves)}`;
                document.getElementById('venta-mensual-usd').textContent = `$${formatearMonto(data.mensual.usd)}`;
                
                // Stock crítico
                document.getElementById('stock-critico').textContent = data.stock_critico;

                // Actualizar tasas en el badge
                const tasaUsdEl = document.getElementById('tasa-usd-val');
                const tasaEurEl = document.getElementById('tasa-eur-val');
                if (tasaUsdEl) tasaUsdEl.textContent = data.tasa_usd.toFixed(2);
                if (tasaEurEl) tasaEurEl.textContent = data.tasa_eur.toFixed(2);

                obtenerTasasDelDOM();
                setTimeout(() => {
                    actualizarReferencias();
                }, 100);
            })
            .catch(err => console.error('Error cargando métricas:', err));
    }

    // ---------- GRÁFICO DE VENTAS ----------
    function cargarGraficoVentas() {
        const canvas = document.getElementById('ventasChart');
        if (!canvas) {
            console.error('Canvas ventasChart no encontrado');
            return;
        }

        const ctx = canvas.getContext('2d');
        const hoy = new Date();
        const hace7Dias = new Date(hoy);
        hace7Dias.setDate(hoy.getDate() - 7);
        const desde = hace7Dias.toISOString().split('T')[0];
        const hasta = hoy.toISOString().split('T')[0];

        fetch(`/api/reportes/resumen?fecha_desde=${desde}&fecha_hasta=${hasta}`)
            .then(res => {
                if (!res.ok) throw new Error('Error en la respuesta del reporte');
                return res.json();
            })
            .then(data => {
                const ventas = data.ventas_por_dia || [];
                const labels = ventas.map(d => d.fecha);
                const valoresVes = ventas.map(d => d.total_ves);
                const valoresUsd = ventas.map(d => d.total_usd);
                const valoresEur = valoresUsd.map(usd => usd * (tasaEur / tasaUsd));

                if (ventasChartInstance) {
                    ventasChartInstance.destroy();
                    ventasChartInstance = null;
                }

                if (valoresVes.length === 0) {
                    ventasChartInstance = new Chart(ctx, {
                        type: 'line',
                        data: {
                            labels: ['Sin datos'],
                            datasets: [{
                                data: [0],
                                borderColor: '#6366F1',
                                borderWidth: 0,
                                backgroundColor: 'transparent',
                                fill: false,
                                pointRadius: 0
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { display: false },
                                tooltip: { enabled: false }
                            },
                            scales: {
                                y: {
                                    min: 0,
                                    max: 1,
                                    grid: { display: true, color: '#F1F5F9', drawBorder: false },
                                    ticks: { display: false }
                                },
                                x: {
                                    grid: { display: false },
                                    ticks: { display: false }
                                }
                            },
                            plugins: [{
                                id: 'customText',
                                afterDraw: function(chart) {
                                    const { ctx, chartArea: { top, bottom, left, right } } = chart;
                                    ctx.save();
                                    ctx.textAlign = 'center';
                                    ctx.textBaseline = 'middle';
                                    ctx.font = '14px Inter, sans-serif';
                                    ctx.fillStyle = '#94A3B8';
                                    ctx.fillText('No hay ventas registradas en los últimos 7 días', (left + right) / 2, (top + bottom) / 2);
                                    ctx.restore();
                                }
                            }]
                        }
                    });
                    return;
                }

                let gradient = ctx.createLinearGradient(0, 0, 0, 250);
                gradient.addColorStop(0, 'rgba(99, 102, 241, 0.25)');
                gradient.addColorStop(1, 'rgba(99, 102, 241, 0.00)');

                let minValor = Math.min(...valoresVes, 0);
                let maxValor = Math.max(...valoresVes, 10);
                let rango = maxValor - minValor;
                let yMin = Math.max(0, minValor - rango * 0.1);
                let yMax = maxValor + rango * 0.1;

                ventasChartInstance = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: valoresVes,
                            borderColor: '#6366F1',
                            borderWidth: 3,
                            backgroundColor: gradient,
                            fill: true,
                            tension: 0.4,
                            pointBackgroundColor: '#6366F1',
                            pointBorderColor: '#FFFFFF',
                            pointBorderWidth: 2,
                            pointRadius: 4,
                            pointHoverRadius: 7
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                backgroundColor: '#1E293B',
                                titleColor: '#FFFFFF',
                                bodyColor: '#F8FAFC',
                                padding: 12,
                                cornerRadius: 8,
                                callbacks: {
                                    label: function(context) {
                                        let montoBs = context.parsed.y;
                                        let index = context.dataIndex;
                                        let montoUsd = valoresUsd[index] || 0;
                                        let montoEur = valoresEur[index] || 0;
                                        return [
                                            ` Monto: Bs ${formatearMonto(montoBs)}`,
                                            ` Ref: $ ${formatearMonto(montoUsd)}`,
                                            ` Ref: € ${formatearMonto(montoEur)}`
                                        ];
                                    }
                                }
                            }
                        },
                        scales: {
                            y: {
                                min: yMin,
                                max: yMax,
                                grid: {
                                    display: true,
                                    color: '#F1F5F9',
                                    drawBorder: false
                                },
                                ticks: {
                                    color: '#94A3B8',
                                    font: { family: 'Inter', size: 11 },
                                    stepSize: Math.ceil(rango / 8) || 5,
                                    callback: value => `Bs ${value.toFixed(0)}`
                                }
                            },
                            x: {
                                grid: { display: false },
                                ticks: {
                                    color: '#94A3B8',
                                    font: { family: 'Inter', size: 11 }
                                }
                            }
                        }
                    }
                });
            })
            .catch(err => {
                console.error('Error cargando gráfico de ventas:', err);
                if (ventasChartInstance) {
                    ventasChartInstance.destroy();
                    ventasChartInstance = null;
                }
                ventasChartInstance = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: ['Error'],
                        datasets: [{
                            data: [0],
                            borderColor: '#6366F1',
                            borderWidth: 0,
                            backgroundColor: 'transparent',
                            fill: false,
                            pointRadius: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: { enabled: false }
                        },
                        scales: {
                            y: {
                                min: 0,
                                max: 1,
                                grid: { display: true, color: '#F1F5F9', drawBorder: false },
                                ticks: { display: false }
                            },
                            x: {
                                grid: { display: false },
                                ticks: { display: false }
                            }
                        },
                        plugins: [{
                            id: 'customText',
                            afterDraw: function(chart) {
                                const { ctx, chartArea: { top, bottom, left, right } } = chart;
                                ctx.save();
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'middle';
                                ctx.font = '14px Inter, sans-serif';
                                ctx.fillStyle = '#94A3B8';
                                ctx.fillText('Error al cargar los datos', (left + right) / 2, (top + bottom) / 2);
                                ctx.restore();
                            }
                        }]
                    }
                });
            });
    }

    // ---------- GRÁFICO TOP PRODUCTOS ----------
    function cargarTopProductos() {
        const canvas = document.getElementById('topProductosChart');
        if (!canvas) {
            console.error('Canvas topProductosChart no encontrado');
            return;
        }
        const ctx = canvas.getContext('2d');

        const hoy = new Date();
        const hace30Dias = new Date(hoy);
        hace30Dias.setDate(hoy.getDate() - 30);
        const desde = hace30Dias.toISOString().split('T')[0];
        const hasta = hoy.toISOString().split('T')[0];

        fetch(`/api/reportes/resumen?fecha_desde=${desde}&fecha_hasta=${hasta}`)
            .then(res => {
                if (!res.ok) throw new Error('Error en la respuesta del reporte');
                return res.json();
            })
            .then(data => {
                const top = data.top_productos || [];
                const labels = top.map(p => p.nombre);
                const values = top.map(p => p.vendido);
                
                const ul = document.getElementById('top-productos-dashboard');
                if (ul) {
                    ul.innerHTML = '';
                    if (top.length === 0) {
                        ul.innerHTML = '<li class="py-2 text-gray-500">Sin productos vendidos</li>';
                    } else {
                        top.forEach((p, i) => {
                            const color = coloresTop[i % coloresTop.length];
                            const li = document.createElement('li');
                            li.className = 'py-2 flex justify-between items-center border-b border-gray-100';
                            li.innerHTML = `
                                <span class="flex items-center text-gray-800">
                                    <span class="w-3 h-3 rounded-full mr-2 inline-block" style="background-color: ${color};"></span>
                                    ${i+1}. ${p.nombre}
                                </span>
                                <span class="font-medium text-gray-800">${p.vendido} unidades</span>
                            `;
                            ul.appendChild(li);
                        });
                    }
                }

                if (topProductosChartInstance) {
                    topProductosChartInstance.destroy();
                    topProductosChartInstance = null;
                }

                if (labels.length === 0) {
                    topProductosChartInstance = new Chart(ctx, {
                        type: 'doughnut',
                        data: {
                            labels: ['Sin datos'],
                            datasets: [{
                                data: [1],
                                backgroundColor: ['#E2E8F0'],
                                borderWidth: 0
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { position: 'bottom', labels: { color: '#94A3B8' } }
                            },
                            plugins: [{
                                id: 'customText',
                                afterDraw: function(chart) {
                                    const { ctx, chartArea: { top, bottom, left, right } } = chart;
                                    ctx.save();
                                    ctx.textAlign = 'center';
                                    ctx.textBaseline = 'middle';
                                    ctx.font = '14px Inter, sans-serif';
                                    ctx.fillStyle = '#94A3B8';
                                    ctx.fillText('No hay productos vendidos', (left + right) / 2, (top + bottom) / 2);
                                    ctx.restore();
                                }
                            }]
                        }
                    });
                    return;
                }

                const coloresAsignados = [];
                for (let i = 0; i < labels.length; i++) {
                    coloresAsignados.push(coloresTop[i % coloresTop.length]);
                }

                topProductosChartInstance = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: values,
                            backgroundColor: coloresAsignados,
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { 
                                position: 'bottom',
                                labels: {
                                    color: '#1E293B'
                                }
                            }
                        }
                    }
                });
            })
            .catch(err => {
                console.error('Error cargando top productos:', err);
                if (topProductosChartInstance) {
                    topProductosChartInstance.destroy();
                    topProductosChartInstance = null;
                }
                topProductosChartInstance = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Error'],
                        datasets: [{
                            data: [1],
                            backgroundColor: ['#E2E8F0'],
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom', labels: { color: '#94A3B8' } }
                        },
                        plugins: [{
                            id: 'customText',
                            afterDraw: function(chart) {
                                const { ctx, chartArea: { top, bottom, left, right } } = chart;
                                ctx.save();
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'middle';
                                ctx.font = '14px Inter, sans-serif';
                                ctx.fillStyle = '#94A3B8';
                                ctx.fillText('Error al cargar datos', (left + right) / 2, (top + bottom) / 2);
                                ctx.restore();
                            }
                        }]
                    }
                });

                const ul = document.getElementById('top-productos-dashboard');
                if (ul) {
                    ul.innerHTML = '<li class="py-2 text-red-500">Error al cargar datos</li>';
                }
            });
    }

    // ---------- INICIALIZACIÓN ----------
    function inicializar() {
        obtenerTasasDelDOM();
        cargarMetricas();
        
        setTimeout(() => {
            obtenerTasasDelDOM();
            cargarGraficoVentas();
            cargarTopProductos();
        }, 500);
    }

    inicializar();

    setInterval(() => {
        obtenerTasasDelDOM();
        cargarMetricas();
        cargarGraficoVentas();
        cargarTopProductos();
    }, 120000);
});