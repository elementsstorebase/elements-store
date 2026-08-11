document.addEventListener('DOMContentLoaded', function() {
    console.log('🟢 gastos.js cargado correctamente');

    const formContainer = document.getElementById('form-gasto-container');
    const btnNuevo = document.getElementById('btn-nuevo-gasto');
    const btnCancelar = document.getElementById('btn-cancelar-gasto');
    const btnSubmit = document.getElementById('btn-submit-gasto');
    const form = document.getElementById('form-gasto');
    const inputId = document.getElementById('gasto-id');
    const selectCategoria = document.getElementById('gasto-categoria');
    const selectMoneda = document.getElementById('gasto-moneda');
    const inputMonto = document.getElementById('gasto-monto');
    const inputConcepto = document.getElementById('gasto-concepto');
    const labelMonto = document.getElementById('label-monto');
    const referenciaMonto = document.getElementById('referencia-monto');

    // Pestañas
    const tabVES = document.getElementById('tab-ves');
    const tabUSD = document.getElementById('tab-usd');
    const tablaVESContainer = document.getElementById('tabla-ves-container');
    const tablaUSDContainer = document.getElementById('tabla-usd-container');

    let modoEdicion = false;
    let pestañaActiva = 'VES';

    // Cache de tasas
    let tasasActuales = { tasaUsd: 1, tasaEur: 1, tasaPers: 1 };

    // ---------- FUNCIONES DE FORMATEO ----------
    function formatearMontoUSD(monto) {
        if (monto === undefined || monto === null || isNaN(monto)) return '0.00';
        return Number(monto).toFixed(2);
    }

    function formatearMontoVES(monto) {
        if (monto === undefined || monto === null || isNaN(monto)) return '0,00';
        let redondeado = Math.round(Number(monto) * 100) / 100;
        let montoStr = redondeado.toFixed(2);
        let partes = montoStr.split('.');
        let enteros = partes[0];
        let decimales = partes[1];
        let enterosFormateados = enteros.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return `${enterosFormateados},${decimales}`;
    }

    // ---------- OBTENER TASAS DESDE EL DOM ----------
    function obtenerTasas() {
        const usdEl = document.getElementById('tasa-usd-val');
        const eurEl = document.getElementById('tasa-eur-val');
        const persEl = document.getElementById('tasa-pers-val');

        const limpiar = (el) => {
            if (!el) return 0;
            let texto = el.textContent.trim();
            texto = texto.replace(',', '.');
            texto = texto.replace(/[^0-9.]/g, '');
            return parseFloat(texto) || 0;
        };

        const usd = limpiar(usdEl);
        const eur = limpiar(eurEl);
        const pers = limpiar(persEl);

        if (usd > 0) tasasActuales.tasaUsd = usd;
        if (eur > 0) tasasActuales.tasaEur = eur;
        if (pers > 0) tasasActuales.tasaPers = pers;

        return tasasActuales;
    }

    // ---------- ACTUALIZAR REFERENCIAS EN FILAS ----------
    function actualizarReferenciasFilas() {
        const { tasaUsd, tasaEur, tasaPers } = obtenerTasas();

        document.querySelectorAll('#tabla-gastos-ves tr[data-gasto-id]').forEach(tr => {
            const montoVes = parseFloat(tr.dataset.montoVes) || 0;
            const tUsd = parseFloat(tr.dataset.tasaAplicada) || tasaUsd;
            const tEur = tasaEur;

            const refUsd = tUsd > 0 ? montoVes / tUsd : 0;
            const refEur = tEur > 0 ? montoVes / tEur : 0;

            tr.querySelector('.tasa-usd').textContent = tUsd.toFixed(2);
            tr.querySelector('.tasa-eur').textContent = tEur.toFixed(2);
            tr.querySelector('.ref-usd').textContent = `$${formatearMontoUSD(refUsd)}`;
            tr.querySelector('.ref-eur').textContent = `€${formatearMontoUSD(refEur)}`;
        });

        document.querySelectorAll('#tabla-gastos-usd tr[data-gasto-id]').forEach(tr => {
            const montoUsd = parseFloat(tr.dataset.montoUsd) || 0;
            const tUsd = parseFloat(tr.dataset.tasaAplicada) || tasaUsd;
            const tEur = tasaEur;
            const tPers = tasaPers;

            const refVesUsd = montoUsd * tUsd;
            const refVesEur = montoUsd * tEur;
            const refVesPers = montoUsd * tPers;

            tr.querySelector('.tasa-usd').textContent = tUsd.toFixed(2);
            tr.querySelector('.tasa-eur').textContent = tEur.toFixed(2);
            tr.querySelector('.tasa-pers').textContent = tPers.toFixed(2);
            tr.querySelector('.ref-ves-usd').textContent = `Bs ${formatearMontoVES(refVesUsd)}`;
            tr.querySelector('.ref-ves-eur').textContent = `Bs ${formatearMontoVES(refVesEur)}`;
            tr.querySelector('.ref-ves-pers').textContent = `Bs ${formatearMontoVES(refVesPers)}`;
        });
    }

    // ---------- MUTATION OBSERVER ----------
    function iniciarObservadorTasas() {
        const elementos = ['tasa-usd-val', 'tasa-eur-val', 'tasa-pers-val']
            .map(id => document.getElementById(id))
            .filter(el => el !== null);

        if (elementos.length === 0) return;

        const observer = new MutationObserver(() => {
            actualizarReferenciasFilas();
        });

        elementos.forEach(el => {
            observer.observe(el, {
                characterData: true,
                childList: true,
                subtree: true
            });
        });
    }

    // ---------- ACTUALIZAR REFERENCIA EN TIEMPO REAL ----------
    function actualizarReferencia() {
        const moneda = selectMoneda.value;
        const monto = parseFloat(inputMonto.value) || 0;
        const { tasaUsd, tasaEur, tasaPers } = obtenerTasas();

        if (moneda === 'USD') {
            const equivalenteVes = monto * tasaUsd;
            const equivalenteEur = tasaUsd > 0 ? monto * (tasaEur / tasaUsd) : 0;
            const equivalentePers = monto * tasaPers;
            referenciaMonto.textContent = `Equivale a: Bs ${formatearMontoVES(equivalenteVes)} | € ${formatearMontoUSD(equivalenteEur)} | Bs (Pers.) ${formatearMontoVES(equivalentePers)}`;
        } else {
            const equivalenteUsd = tasaUsd > 0 ? monto / tasaUsd : 0;
            const equivalenteEur = tasaEur > 0 ? monto / tasaEur : 0;
            referenciaMonto.textContent = `Equivale a: $ ${formatearMontoUSD(equivalenteUsd)} | € ${formatearMontoUSD(equivalenteEur)}`;
        }
    }

    // ---------- CONFIGURAR FORMULARIO ----------
    function configurarFormularioSegunPestana() {
        const moneda = pestañaActiva === 'VES' ? 'VES' : 'USD';
        selectMoneda.innerHTML = '';
        const option = document.createElement('option');
        option.value = moneda;
        option.textContent = moneda === 'VES' ? 'Bolívares (VES)' : 'Dólares (USD)';
        selectMoneda.appendChild(option);
        selectMoneda.disabled = true;

        labelMonto.textContent = `Monto (${moneda})`;
        inputMonto.placeholder = `0.00 ${moneda}`;
        inputMonto.step = moneda === 'USD' ? '0.01' : '1';
        actualizarReferencia();
    }

    function actualizarLabel() {
        const moneda = selectMoneda.value;
        labelMonto.textContent = `Monto (${moneda})`;
        inputMonto.placeholder = `0.00 ${moneda}`;
        inputMonto.step = moneda === 'USD' ? '0.01' : '1';
        actualizarReferencia();
    }

    // ---------- CARGAR CATEGORÍAS ----------
    function cargarCategorias() {
        fetch('/api/categorias-gasto')
            .then(r => r.json())
            .then(data => {
                selectCategoria.innerHTML = '<option value="">Seleccionar</option>';
                data.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = c.nombre;
                    selectCategoria.appendChild(opt);
                });
            });
    }
    cargarCategorias();

    // ---------- FORMULARIO ----------
    function resetFormulario() {
        form.reset();
        inputId.value = '';
        modoEdicion = false;
        btnSubmit.textContent = 'Registrar Gasto';
        referenciaMonto.textContent = 'Equivale a: --';
        formContainer.classList.add('hidden');
    }

    btnNuevo.addEventListener('click', () => {
        resetFormulario();
        formContainer.classList.remove('hidden');
        configurarFormularioSegunPestana();
        selectCategoria.focus();
    });

    btnCancelar.addEventListener('click', resetFormulario);

    selectMoneda.addEventListener('change', actualizarLabel);
    inputMonto.addEventListener('input', actualizarReferencia);

    // ---------- ENVIAR GASTO ----------
    form.addEventListener('submit', function(e) {
        e.preventDefault();

        const moneda = selectMoneda.value;
        const monto = parseFloat(inputMonto.value) || 0;
        if (monto <= 0) {
            alert('El monto debe ser mayor a 0');
            return;
        }

        const { tasaUsd } = obtenerTasas();

        const data = {
            categoria_id: parseInt(selectCategoria.value),
            concepto: inputConcepto.value,
            moneda: moneda,
            monto: monto,
            tasa_usd: tasaUsd
        };

        const id = inputId.value;
        const url = id ? `/api/gastos/${id}` : '/api/gastos';
        const method = id ? 'PUT' : 'POST';

        fetch(url, {
            method: method,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        })
        .then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
        })
        .then(res => {
            alert(res.mensaje || (id ? 'Gasto actualizado' : 'Gasto registrado'));
            resetFormulario();
            cargarGastos();
        })
        .catch(err => alert('Error: ' + err.message));
    });

    // ---------- DETERMINAR MONEDA (CORREGIDO - PRIORIZA CAMPO DEL BACKEND) ----------
    function determinarMonedaGasto(gasto) {
        // 1. Si el backend envía moneda, usarlo directamente (prioridad absoluta)
        if (gasto.moneda) {
            return gasto.moneda;
        }

        // 2. Fallback para gastos antiguos sin campo moneda
        const usd = gasto.monto_usd || 0;
        const ves = gasto.monto_ves || 0;
        const tasaGuardada = gasto.tasa_aplicada || 1;
        const { tasaUsd } = tasasActuales;

        // Si la tasa guardada es 1.00, es casi seguro que es USD
        if (Math.abs(tasaGuardada - 1.0) < 0.01) {
            return 'USD';
        }

        // Si la tasa guardada es la tasa actual o cercana
        if (tasaGuardada > 1 && tasaGuardada === tasaUsd) {
            // Si usd * tasaGuardada ≈ ves, entonces es USD
            if (Math.abs(usd * tasaGuardada - ves) < 0.01) {
                return 'USD';
            }
            // Si ves / tasaGuardada ≈ usd, entonces es VES
            if (Math.abs(ves / tasaGuardada - usd) < 0.01) {
                return 'VES';
            }
        }

        // Fallback: redondeo
        const usdRedondeado = Math.round(usd * 100) / 100;
        const vesRedondeado = Math.round(ves * 100) / 100;
        const esUsdEntero = Number.isInteger(usdRedondeado);
        const esVesEntero = Number.isInteger(vesRedondeado);
        
        if (esUsdEntero && !esVesEntero) return 'USD';
        if (esVesEntero && !esUsdEntero) return 'VES';

        // Último recurso: comparar diferencias
        const diffUsd = Math.abs(usd * tasaUsd - ves);
        const diffVes = Math.abs(ves / tasaUsd - usd);
        return diffUsd < diffVes ? 'USD' : 'VES';
    }

    // ---------- CARGAR GASTOS ----------
    function cargarGastos() {
        obtenerTasas();

        fetch('/api/gastos')
            .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then(data => {
                const gastosVES = [];
                const gastosUSD = [];
                
                data.forEach(g => {
                    // Usar la función corregida que prioriza gasto.moneda
                    const moneda = determinarMonedaGasto(g);
                    if (moneda === 'VES') {
                        gastosVES.push(g);
                    } else {
                        gastosUSD.push(g);
                    }
                });
                
                renderTablaVES(gastosVES);
                renderTablaUSD(gastosUSD);
                actualizarReferenciasFilas();

                if (tasasActuales.tasaUsd <= 1 && tasasActuales.tasaEur <= 1 && tasasActuales.tasaPers <= 1) {
                    console.log('⏳ Tasas no disponibles en DOM, obteniendo desde API...');
                    fetch('/api/tasas')
                        .then(r => r.json())
                        .then(res => {
                            if (res.bcv_usd) {
                                tasasActuales.tasaUsd = parseFloat(res.bcv_usd) || 1;
                                tasasActuales.tasaEur = parseFloat(res.bcv_eur) || 1;
                                tasasActuales.tasaPers = parseFloat(res.personalizada) || 1;
                                const usdEl = document.getElementById('tasa-usd-val');
                                const eurEl = document.getElementById('tasa-eur-val');
                                const persEl = document.getElementById('tasa-pers-val');
                                if (usdEl) usdEl.textContent = tasasActuales.tasaUsd.toFixed(2);
                                if (eurEl) eurEl.textContent = tasasActuales.tasaEur.toFixed(2);
                                if (persEl) persEl.textContent = tasasActuales.tasaPers.toFixed(2);
                                actualizarReferenciasFilas();
                                console.log('✅ Tasas actualizadas desde API (fetch propio).');
                            }
                        })
                        .catch(err => console.warn('⚠️ Error obteniendo tasas desde API:', err));
                }
            })
            .catch(err => {
                console.error('❌ Error al cargar gastos:', err);
                document.getElementById('tabla-gastos-ves').innerHTML = `<tr><td colspan="9" class="text-center py-4 text-red-500">Error al cargar datos: ${err.message}</td></tr>`;
                document.getElementById('tabla-gastos-usd').innerHTML = `<tr><td colspan="11" class="text-center py-4 text-red-500">Error al cargar datos: ${err.message}</td></tr>`;
            });
    }

    // ---------- RENDERIZAR TABLA VES ----------
    function renderTablaVES(gastos) {
        const tbody = document.getElementById('tabla-gastos-ves');
        tbody.innerHTML = '';
        if (gastos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-gray-400">No hay gastos en bolívares registrados</td></tr>';
            return;
        }

        const { tasaUsd, tasaEur } = tasasActuales;

        gastos.forEach(g => {
            const tUsd = (g.tasa_aplicada && g.tasa_aplicada > 1) ? g.tasa_aplicada : tasaUsd;
            const tEur = tasaEur;

            const tr = document.createElement('tr');
            tr.className = 'border-b border-gray-100';
            tr.dataset.gastoId = g.id;
            tr.dataset.montoVes = g.monto_ves;
            tr.dataset.tasaAplicada = tUsd;

            tr.innerHTML = `
                <td class="py-2 px-4">${g.fecha}</td>
                <td class="py-2 px-4">${g.categoria}</td>
                <td class="py-2 px-4">${g.concepto}</td>
                <td class="py-2 px-4 text-right">Bs ${formatearMontoVES(g.monto_ves)}</td>
                <td class="py-2 px-4 text-right tasa-usd">${tUsd.toFixed(2)}</td>
                <td class="py-2 px-4 text-right tasa-eur">${tEur.toFixed(2)}</td>
                <td class="py-2 px-4 text-right ref-usd">--</td>
                <td class="py-2 px-4 text-right ref-eur">--</td>
                <td class="py-2 px-4 text-center">
                    <button class="btn-editar text-blue-500 hover:text-blue-700 mr-2" data-id="${g.id}" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-eliminar text-red-500 hover:text-red-700" data-id="${g.id}" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        asignarEventosTabla(tbody);
    }

    // ---------- RENDERIZAR TABLA USD ----------
    function renderTablaUSD(gastos) {
        const tbody = document.getElementById('tabla-gastos-usd');
        tbody.innerHTML = '';
        if (gastos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" class="text-center py-4 text-gray-400">No hay gastos en dólares registrados</td></tr>';
            return;
        }

        const { tasaUsd, tasaEur, tasaPers } = tasasActuales;

        gastos.forEach(g => {
            const tUsd = (g.tasa_aplicada && g.tasa_aplicada > 1) ? g.tasa_aplicada : tasaUsd;
            const tEur = tasaEur;
            const tPers = tasaPers;

            const tr = document.createElement('tr');
            tr.className = 'border-b border-gray-100';
            tr.dataset.gastoId = g.id;
            tr.dataset.montoUsd = g.monto_usd;
            tr.dataset.tasaAplicada = tUsd;

            tr.innerHTML = `
                <td class="py-2 px-4">${g.fecha}</td>
                <td class="py-2 px-4">${g.categoria}</td>
                <td class="py-2 px-4">${g.concepto}</td>
                <td class="py-2 px-4 text-right">$${formatearMontoUSD(g.monto_usd)}</td>
                <td class="py-2 px-4 text-right tasa-usd">${tUsd.toFixed(2)}</td>
                <td class="py-2 px-4 text-right tasa-eur">${tEur.toFixed(2)}</td>
                <td class="py-2 px-4 text-right tasa-pers">${tPers.toFixed(2)}</td>
                <td class="py-2 px-4 text-right ref-ves-usd">--</td>
                <td class="py-2 px-4 text-right ref-ves-eur">--</td>
                <td class="py-2 px-4 text-right ref-ves-pers">--</td>
                <td class="py-2 px-4 text-center">
                    <button class="btn-editar text-blue-500 hover:text-blue-700 mr-2" data-id="${g.id}" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-eliminar text-red-500 hover:text-red-700" data-id="${g.id}" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        asignarEventosTabla(tbody);
    }

    // ---------- EVENTOS DE TABLA ----------
    function asignarEventosTabla(tbody) {
        tbody.querySelectorAll('.btn-editar').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = this.dataset.id;
                cargarGastoParaEditar(id);
            });
        });
        tbody.querySelectorAll('.btn-eliminar').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = this.dataset.id;
                eliminarGasto(id);
            });
        });
    }

    // ---------- PESTAÑAS ----------
    function activarPestana(tab) {
        pestañaActiva = tab;
        tabVES.classList.remove('border-indigo-600', 'text-indigo-600');
        tabVES.classList.add('border-transparent', 'text-gray-500');
        tabUSD.classList.remove('border-indigo-600', 'text-indigo-600');
        tabUSD.classList.add('border-transparent', 'text-gray-500');

        if (tab === 'VES') {
            tabVES.classList.remove('border-transparent', 'text-gray-500');
            tabVES.classList.add('border-indigo-600', 'text-indigo-600');
            tablaVESContainer.classList.remove('hidden');
            tablaUSDContainer.classList.add('hidden');
        } else {
            tabUSD.classList.remove('border-transparent', 'text-gray-500');
            tabUSD.classList.add('border-indigo-600', 'text-indigo-600');
            tablaUSDContainer.classList.remove('hidden');
            tablaVESContainer.classList.add('hidden');
        }

        if (!formContainer.classList.contains('hidden')) {
            configurarFormularioSegunPestana();
        }
    }

    tabVES.addEventListener('click', () => activarPestana('VES'));
    tabUSD.addEventListener('click', () => activarPestana('USD'));

    // ---------- CARGAR GASTO PARA EDITAR ----------
    function cargarGastoParaEditar(id) {
        fetch(`/api/gastos/${id}`)
            .then(r => {
                if (!r.ok) throw new Error('Error al cargar gasto');
                return r.json();
            })
            .then(gasto => {
                inputId.value = gasto.id;
                selectCategoria.value = gasto.categoria_id;
                inputConcepto.value = gasto.concepto;
                
                // Usar la función que prioriza gasto.moneda
                const moneda = determinarMonedaGasto(gasto);
                pestañaActiva = moneda === 'VES' ? 'VES' : 'USD';
                activarPestana(pestañaActiva);
                configurarFormularioSegunPestana();
                if (moneda === 'USD') {
                    inputMonto.value = gasto.monto_usd;
                } else {
                    inputMonto.value = gasto.monto_ves;
                }
                modoEdicion = true;
                btnSubmit.textContent = 'Actualizar Gasto';
                formContainer.classList.remove('hidden');
                selectCategoria.focus();
            })
            .catch(err => alert('Error al cargar datos: ' + err));
    }

    // ---------- ELIMINAR GASTO ----------
    function eliminarGasto(id) {
        if (!confirm('¿Está seguro de eliminar este gasto?')) return;
        fetch(`/api/gastos/${id}`, { method: 'DELETE' })
            .then(r => r.json())
            .then(() => {
                alert('Gasto eliminado');
                cargarGastos();
            })
            .catch(err => alert('Error: ' + err));
    }

    // ---------- INICIALIZACIÓN ----------
    obtenerTasas();
    iniciarObservadorTasas();
    activarPestana('VES');
    cargarGastos();
});