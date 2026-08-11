document.addEventListener('DOMContentLoaded', function() {
    // ============================================================
    // VARIABLES GLOBALES
    // ============================================================
    let tasaUsd = 0;
    let tasaEur = 0;
    let tasaPersonalizada = 0;
    let clienteSeleccionado = null;
    let productoSeleccionado = null;
    let timeoutBusquedaCliente = null;
    let timeoutBusquedaProducto = null;
    let monedaSeleccionada = 'VES'; // 'VES' o 'USD'
    let abonoUsdCalculado = 0;
    let tasaAplicada = 1;

    // ============================================================
    // REFERENCIAS - PÁGINA DE LISTADO (deudas.html)
    // ============================================================
    const tablaDeudas = document.getElementById('tabla-deudas');
    const totalDeudas = document.getElementById('total-deudas');
    const filtroCliente = document.getElementById('filtro-cliente');
    const filtroEstado = document.getElementById('filtro-estado');
    const filtroFechaLimite = document.getElementById('filtro-fecha-limite');
    const btnFiltrar = document.getElementById('btn-filtrar');
    const btnLimpiar = document.getElementById('btn-limpiar');

    // ============================================================
    // REFERENCIAS - PÁGINA DE FINALIZADAS (deudas_finalizadas.html)
    // ============================================================
    const filtroFechaDesde = document.getElementById('filtro-fecha-desde');
    const filtroFechaHasta = document.getElementById('filtro-fecha-hasta');

    // ============================================================
    // REFERENCIAS - PÁGINA DE CREACIÓN (deuda_crear.html)
    // ============================================================
    const formDeudaCrear = document.getElementById('form-deuda-crear');
    const inputClienteBuscar = document.getElementById('deuda-cliente-buscar');
    const sugerenciasClientes = document.getElementById('sugerencias-clientes');
    const clienteIdHidden = document.getElementById('deuda-cliente-id');
    const clienteInfoDiv = document.getElementById('cliente-seleccionado-info');
    const clienteInfoNombre = document.getElementById('cliente-info-nombre');
    const clienteInfoApellido = document.getElementById('cliente-info-apellido');
    const clienteInfoCedula = document.getElementById('cliente-info-cedula');
    const clienteInfoTelefono = document.getElementById('cliente-info-telefono');
    const clienteInfoDireccion = document.getElementById('cliente-info-direccion');

    const inputProductoBuscar = document.getElementById('deuda-producto-buscar');
    const sugerenciasProductos = document.getElementById('sugerencias-productos');
    const productoIdHidden = document.getElementById('deuda-producto-id');
    const productoInfoDiv = document.getElementById('producto-seleccionado-info');
    const productoInfoNombre = document.getElementById('producto-info-nombre');
    const productoInfoCategoria = document.getElementById('producto-info-categoria');
    const productoInfoMarca = document.getElementById('producto-info-marca');
    const productoInfoTalla = document.getElementById('producto-info-talla');
    const productoInfoPrecio = document.getElementById('producto-info-precio');
    const productoInfoStock = document.getElementById('producto-info-stock');
    const productoInfoCosto = document.getElementById('producto-info-costo');

    const crearInputCantidad = document.getElementById('deuda-cantidad');
    const crearCheckboxDescontarStock = document.getElementById('deuda-descontar-stock');
    const crearSelectPeriodoTipo = document.getElementById('deuda-periodo-tipo');
    const crearInputFechaLimite = document.getElementById('deuda-fecha-limite');
    const crearInfoPeriodoTexto = document.getElementById('deuda-info-texto');
    const crearTotalUsdDisplay = document.getElementById('total-usd-display');

    // Elementos de las pestañas (creación)
    const crearTabVes = document.getElementById('tab-abono-ves');
    const crearTabUsd = document.getElementById('tab-abono-usd');
    const crearBtnTabs = document.querySelectorAll('.tab-abono-btn');

    // Campos VES (creación)
    const crearTotalVes = document.getElementById('deuda-total-ves');
    const crearAbonoMontoVes = document.getElementById('deuda-abono-monto-ves');
    const crearSaldoVes = document.getElementById('deuda-saldo-ves');
    const crearPorcentajeVes = document.getElementById('deuda-abono-porcentaje-ves');
    const crearPorcentajePersonalizadoVes = document.getElementById('deuda-abono-porcentaje-personalizado-ves');
    const crearPorcentajePersonalizadoContainerVes = document.getElementById('deuda-abono-porcentaje-personalizado-container-ves');
    const crearMetodoCobroVes = document.getElementById('deuda-metodo-cobro-ves');
    const crearMetodoPagoVes = document.getElementById('deuda-metodo-pago-ves');
    const crearBsPersonalizadoContainerVes = document.getElementById('bs-personalizado-container-ves');
    const crearBsPersonalizadoInputVes = document.getElementById('deuda-bs-personalizado-input-ves');
    const crearBsEquivalenteUsdVes = document.getElementById('deuda-bs-equivalente-usd-ves');
    const crearAbonoUsdEquivalenteVes = document.getElementById('deuda-abono-usd-ves');
    const crearAbonoEurEquivalenteVes = document.getElementById('deuda-abono-eur-ves');

    // Campos USD (creación)
    const crearTotalUsd = document.getElementById('deuda-total-usd');
    const crearAbonoMontoUsd = document.getElementById('deuda-abono-monto-usd');
    const crearSaldoUsd = document.getElementById('deuda-saldo-usd');
    const crearPorcentajeUsd = document.getElementById('deuda-abono-porcentaje-usd');
    const crearPorcentajePersonalizadoUsd = document.getElementById('deuda-abono-porcentaje-personalizado-usd');
    const crearPorcentajePersonalizadoContainerUsd = document.getElementById('deuda-abono-porcentaje-personalizado-container-usd');
    const crearMetodoCobroUsd = document.getElementById('deuda-metodo-cobro-usd');
    const crearMetodoPagoUsd = document.getElementById('deuda-metodo-pago-usd');
    const crearUsdPersonalizadoContainerUsd = document.getElementById('usd-personalizado-container-usd');
    const crearUsdPersonalizadoInputUsd = document.getElementById('deuda-usd-personalizado-input-usd');
    const crearUsdEquivalenteVesUsd = document.getElementById('deuda-usd-equivalente-ves-usd');
    const crearAbonoVesEquivalenteUsd = document.getElementById('deuda-abono-ves-usd');
    const crearAbonoEurEquivalenteUsd = document.getElementById('deuda-abono-eur-usd');

    // Resumen (creación)
    const crearResumenTotalUsd = document.getElementById('resumen-total-usd');
    const crearResumenAbonoUsd = document.getElementById('resumen-abono-usd');
    const crearResumenSaldoUsd = document.getElementById('resumen-saldo-usd');
    const crearResumenAbonoBsUsd = document.getElementById('resumen-abono-bs-usd');
    const crearResumenAbonoBsEur = document.getElementById('resumen-abono-bs-eur');
    const crearResumenSaldoBsUsd = document.getElementById('resumen-saldo-bs-usd');
    const crearResumenSaldoBsEur = document.getElementById('resumen-saldo-bs-eur');
    const crearResumenStock = document.getElementById('resumen-stock');

    // Tasas display (creación)
    const crearTasaUsdDisplay = document.getElementById('tasa-usd-display');
    const crearTasaEurDisplay = document.getElementById('tasa-eur-display');

    // ============================================================
    // REFERENCIAS - PÁGINA DE DETALLE (deuda_detalle.html)
    // ============================================================
    const detalleClienteNombre = document.getElementById('detalle-cliente-nombre');
    const detalleClienteCedula = document.getElementById('detalle-cliente-cedula');
    const detalleClienteTelefono = document.getElementById('detalle-cliente-telefono');
    const detalleClienteDireccion = document.getElementById('detalle-cliente-direccion');
    const detalleProductoNombre = document.getElementById('detalle-producto-nombre');
    const detalleProductoCategoria = document.getElementById('detalle-producto-categoria');
    const detalleProductoMarca = document.getElementById('detalle-producto-marca');
    const detalleProductoTalla = document.getElementById('detalle-producto-talla');
    const detalleProductoCantidad = document.getElementById('detalle-producto-cantidad');
    const detalleProductoPrecio = document.getElementById('detalle-producto-precio');
    const detalleTotal = document.getElementById('detalle-total');
    const detalleAbonado = document.getElementById('detalle-abonado');
    const detalleAbonadoBs = document.getElementById('detalle-abonado-bs');
    const detalleSaldo = document.getElementById('detalle-saldo');
    const detalleSaldoBs = document.getElementById('detalle-saldo-bs');
    const tablaAbonos = document.getElementById('tabla-abonos');
    const detalleEstadoBadge = document.getElementById('detalle-estado-badge');

    // ============================================================
    // REFERENCIAS - MODAL DE AGREGAR ABONO (dentro de deuda_detalle.html)
    // ============================================================
    const modalAbono = document.getElementById('modal-agregar-abono');
    const formAgregarAbono = document.getElementById('form-agregar-abono');
    const modalAbonoMoneda = document.getElementById('abono-moneda');
    const modalAbonoMonto = document.getElementById('abono-monto');
    const modalAbonoMontoVes = document.getElementById('abono-monto-ves');
    const modalAbonoRefVesUsd = document.getElementById('abono-ref-ves-usd');
    const modalAbonoRefVesEur = document.getElementById('abono-ref-ves-eur');
    const modalAbonoRefUsd = document.getElementById('abono-ref-usd');
    const modalAbonoRefEur = document.getElementById('abono-ref-eur');
    const modalAbonoMetodoCobro = document.getElementById('abono-metodo-cobro');
    const modalAbonoMetodoPago = document.getElementById('abono-metodo-pago');
    const modalAbonoSaldoActual = document.getElementById('abono-saldo-actual');
    const modalAbonoSaldoActualBs = document.getElementById('abono-saldo-actual-bs');
    const modalAbonoTasaUsdDisplay = document.getElementById('abono-tasa-usd-display');
    const modalAbonoTasaEurDisplay = document.getElementById('abono-tasa-eur-display');
    const modalAbonoReferenciasUsd = document.getElementById('abono-referencias-usd');
    const modalAbonoReferenciasVes = document.getElementById('abono-referencias-ves');
    const modalAbonoMontoLabel = document.getElementById('abono-monto-label');
    const modalAbonoMontoVesLabel = document.getElementById('abono-monto-ves-label');
    const btnAbrirModalAbono = document.getElementById('btn-abrir-modal-abono');
    const btnFinalizarDeuda = document.getElementById('btn-finalizar-deuda');
    const btnReintegrar = document.getElementById('btn-reintegrar');
    const finalizarApartadoId = document.getElementById('finalizar-apartado-id');

    // ============================================================
    // FUNCIONES DE UTILIDAD
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

    function formatearMontoVES(monto) {
        if (monto === undefined || monto === null || isNaN(monto)) return '0,00';
        let montoStr = monto.toFixed(2);
        let partes = montoStr.split('.');
        let enteros = partes[0];
        let decimales = partes[1];
        let enterosFormateados = enteros.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return `${enterosFormateados},${decimales}`;
    }

    // ============================================================
    // 🔥 FUNCIONES PARA LIMPIAR Y FORMATEAR INPUT (CORREGIDO)
    // ============================================================
    function limpiarMontoInput(valor) {
        if (!valor) return 0;
        let str = valor.toString().trim();
        
        // Si no tiene separadores, es un número entero
        if (/^\d+$/.test(str)) return parseFloat(str);
        
        // Encontrar la posición del último separador (coma o punto)
        let lastComma = str.lastIndexOf(',');
        let lastDot = str.lastIndexOf('.');
        let lastSep = Math.max(lastComma, lastDot);
        
        // Si no hay separadores, parsear directamente
        if (lastSep === -1) return parseFloat(str);
        
        // El separador en lastSep es el decimal
        let decimalSep = str[lastSep];
        
        // Parte entera: todo antes del último separador
        let integerPart = str.substring(0, lastSep);
        // Parte decimal: todo después del último separador
        let decimalPart = str.substring(lastSep + 1);
        
        // Eliminar cualquier otro separador en la parte entera
        integerPart = integerPart.replace(/[.,]/g, '');
        // Eliminar cualquier separador en la parte decimal (solo deben ser dígitos)
        decimalPart = decimalPart.replace(/[.,]/g, '');
        
        // Reconstruir con punto decimal
        let clean = integerPart + '.' + decimalPart;
        let numero = parseFloat(clean);
        return isNaN(numero) ? 0 : numero;
    }

    function formatearConSeparadores(numero) {
        if (numero === 0 || isNaN(numero)) return '';
        return formatearMonto(numero);
    }

    function formatearSinSeparadores(numero) {
        if (numero === 0 || isNaN(numero)) return '';
        return numero.toFixed(2).replace('.', ',');
    }

    // ============================================================
    // OBTENER TASAS
    // ============================================================
    function obtenerTasas() {
        return fetch('/api/tasas')
            .then(r => r.json())
            .then(data => {
                tasaUsd = data.bcv_usd || 1;
                tasaEur = data.bcv_eur || 1;
                tasaPersonalizada = data.personalizada || 1;
                if (crearTasaUsdDisplay) crearTasaUsdDisplay.textContent = tasaUsd.toFixed(2);
                if (crearTasaEurDisplay) crearTasaEurDisplay.textContent = tasaEur.toFixed(2);
                if (modalAbonoTasaUsdDisplay) modalAbonoTasaUsdDisplay.textContent = tasaUsd.toFixed(2);
                if (modalAbonoTasaEurDisplay) modalAbonoTasaEurDisplay.textContent = tasaEur.toFixed(2);
                return data;
            })
            .catch(err => {
                console.error('Error obteniendo tasas:', err);
                tasaUsd = 1;
                tasaEur = 1;
                tasaPersonalizada = 1;
                return { bcv_usd: 1, bcv_eur: 1, personalizada: 1 };
            });
    }

    // ============================================================
    // FUNCIONES PARA EL LISTADO DE DEUDAS (deudas.html)
    // ============================================================
    function cargarDeudas(filtros = {}) {
        const params = new URLSearchParams();
        params.append('estado', filtros.estado || 'activo');
        if (filtros.cliente) params.append('cliente_id', filtros.cliente);
        if (filtros.fecha_limite) params.append('fecha_limite', filtros.fecha_limite);

        fetch(`/api/apartados?${params}`)
            .then(r => {
                if (!r.ok) throw new Error('Error al cargar deudas');
                return r.json();
            })
            .then(data => {
                renderizarDeudas(data);
                if (totalDeudas) {
                    totalDeudas.textContent = data.length;
                }
            })
            .catch(err => {
                console.error('Error cargando deudas:', err);
                if (tablaDeudas) {
                    tablaDeudas.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-red-400">Error al cargar deudas</td></tr>`;
                }
            });
    }

    // ============================================================
    // 🔥 CORRECCIÓN: renderizarDeudas con columnas separadas "Abonado (USD)" y "Abonado Real"
    // ============================================================
    function renderizarDeudas(deudas) {
        if (!tablaDeudas) return;
        tablaDeudas.innerHTML = '';
        if (deudas.length === 0) {
            tablaDeudas.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-gray-400">No hay deudas en este estado</td></tr>`;
            return;
        }

        deudas.forEach(d => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-gray-100 hover:bg-gray-50 transition-colors';
            const estadoColor = d.estado === 'activo' ? 'bg-yellow-100 text-yellow-800' :
                                d.estado === 'pagado' ? 'bg-green-100 text-green-800' :
                                'bg-red-100 text-red-800';
            const estadoTexto = d.estado === 'activo' ? 'Activo' :
                                d.estado === 'pagado' ? 'Pagado' : 'Reintegrado';

            // 🔥 Columna "Abonado (USD)" - siempre el equivalente en USD
            const abonoUsdStr = `$${formatearMonto(d.abono_inicial_monto)}`;

            // 🔥 Columna "Abonado Real" - según metodo_cobro_inicial
            const esAbonoUSD = d.metodo_cobro_inicial && ['usd', 'usd_personalizado'].includes(d.metodo_cobro_inicial);
            let abonoRealStr;
            if (esAbonoUSD) {
                abonoRealStr = `$${formatearMonto(d.abono_inicial_monto)}`;
            } else {
                // Si es en VES, usar el monto en VES real del abono inicial (enviado por backend)
                const abonoVesReal = d.abono_inicial_monto_ves || (d.abono_inicial_monto * (d.tasa_aplicada || tasaUsd));
                abonoRealStr = `Bs ${formatearMontoVES(abonoVesReal)}`;
            }

            tr.innerHTML = `
                <td class="py-2 px-3 font-medium">${d.cliente}</td>
                <td class="py-2 px-3">${d.producto}</td>
                <td class="py-2 px-3 text-center">${d.cantidad}</td>
                <td class="py-2 px-3 text-right font-medium">$${formatearMonto(d.total_usd)}</td>
                <td class="py-2 px-3 text-right text-green-600">${abonoUsdStr}</td>
                <td class="py-2 px-3 text-right text-blue-600 font-medium">${abonoRealStr}</td>
                <td class="py-2 px-3 text-right font-bold text-amber-600">$${formatearMonto(d.saldo_restante)}</td>
                <td class="py-2 px-3 text-center text-sm">${d.fecha_limite_pago}</td>
                <td class="py-2 px-3 text-center">
                    <button onclick="verDetalleDeuda(${d.id})" class="text-indigo-600 hover:text-indigo-800 mr-2" title="Ver detalle">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${d.estado === 'activo' ? `
                    <button onclick="abrirModalAgregarAbono(${d.id})" class="text-blue-600 hover:text-blue-800 mr-2" title="Agregar abono">
                        <i class="fas fa-plus-circle"></i>
                    </button>
                    ` : ''}
                </td>
            `;
            tablaDeudas.appendChild(tr);
        });
    }

    // Funciones globales para usar desde onclick
    window.verDetalleDeuda = function(id) {
        window.location.href = `/admin/deudas/${id}`;
    };

    window.abrirModalAgregarAbono = function(id) {
        window.location.href = `/admin/deudas/${id}/agregar-abono`;
    };

    // ============================================================
    // FUNCIONES PARA EL LISTADO DE DEUDAS FINALIZADAS (deudas_finalizadas.html)
    // ============================================================
    function cargarDeudasFinalizadas(filtros = {}) {
        const params = new URLSearchParams();
        params.append('estado', filtros.estado || 'pagado');
        if (filtros.cliente) params.append('cliente_id', filtros.cliente);
        if (filtros.fecha_desde) params.append('fecha_desde', filtros.fecha_desde);
        if (filtros.fecha_hasta) params.append('fecha_hasta', filtros.fecha_hasta);

        fetch(`/api/apartados?${params}`)
            .then(r => {
                if (!r.ok) throw new Error('Error al cargar deudas finalizadas');
                return r.json();
            })
            .then(data => {
                renderizarDeudasFinalizadas(data);
                const totalEl = document.getElementById('total-finalizadas');
                if (totalEl) totalEl.textContent = data.length;
            })
            .catch(err => {
                console.error('Error cargando deudas finalizadas:', err);
                const tabla = document.getElementById('tabla-finalizadas');
                if (tabla) {
                    tabla.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-red-400">Error al cargar historial</td></tr>`;
                }
            });
    }

    function renderizarDeudasFinalizadas(deudas) {
        const tabla = document.getElementById('tabla-finalizadas');
        if (!tabla) return;
        tabla.innerHTML = '';
        if (deudas.length === 0) {
            tabla.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-gray-400">No hay deudas finalizadas</td></tr>`;
            return;
        }

        deudas.forEach(d => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-gray-100 hover:bg-gray-50 transition-colors';
            const estadoColor = d.estado === 'pagado' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
            const estadoTexto = d.estado === 'pagado' ? 'Pagado' : 'Reintegrado';

            tr.innerHTML = `
                <td class="py-2 px-3 font-medium">${d.cliente}</td>
                <td class="py-2 px-3">${d.producto}</td>
                <td class="py-2 px-3 text-center">${d.cantidad}</td>
                <td class="py-2 px-3 text-right font-medium">$${formatearMonto(d.total_usd)}</td>
                <td class="py-2 px-3 text-right">Bs ${formatearMontoVES(d.total_usd * (tasaUsd || 1))}</td>
                <td class="py-2 px-3 text-center"><span class="px-2 py-1 rounded-full text-xs ${estadoColor}">${estadoTexto}</span></td>
                <td class="py-2 px-3 text-center text-sm">${d.fecha_limite_pago || '-'}</td>
                <td class="py-2 px-3 text-center">
                    <button onclick="window.abrirModalDetalleFinalizada(${d.id})" class="text-indigo-600 hover:text-indigo-800" title="Ver detalle">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            `;
            tabla.appendChild(tr);
        });
    }

    // ============================================================
    // FUNCIONES PARA CREAR APARTADO (deuda_crear.html)
    // ============================================================
    function buscarClientes(query) {
        if (query.length < 2) {
            sugerenciasClientes.classList.add('hidden');
            return;
        }
        fetch(`/api/clientes?es_fijo=true&buscar=${encodeURIComponent(query)}`)
            .then(r => r.json())
            .then(data => {
                mostrarSugerenciasClientes(data);
            })
            .catch(err => console.error('Error buscando clientes:', err));
    }

    function mostrarSugerenciasClientes(clientes) {
        sugerenciasClientes.innerHTML = '';
        if (clientes.length === 0) {
            sugerenciasClientes.innerHTML = `<div class="px-4 py-2 text-sm text-gray-400">No se encontraron clientes fijos</div>`;
            sugerenciasClientes.classList.remove('hidden');
            return;
        }
        clientes.forEach(c => {
            const div = document.createElement('div');
            div.className = 'px-4 py-2 hover:bg-indigo-50 cursor-pointer text-sm border-b border-gray-100';
            div.textContent = `${c.nombre} ${c.apellido} - ${c.cedula}`;
            div.dataset.id = c.id;
            div.addEventListener('click', function() {
                seleccionarCliente(c);
            });
            sugerenciasClientes.appendChild(div);
        });
        sugerenciasClientes.classList.remove('hidden');
    }

    function seleccionarCliente(cliente) {
        clienteSeleccionado = cliente;
        clienteIdHidden.value = cliente.id;
        inputClienteBuscar.value = `${cliente.nombre} ${cliente.apellido}`;
        clienteInfoNombre.textContent = cliente.nombre;
        clienteInfoApellido.textContent = cliente.apellido;
        clienteInfoCedula.textContent = cliente.cedula;
        clienteInfoTelefono.textContent = cliente.telefono || '-';
        clienteInfoDireccion.textContent = cliente.direccion || '-';
        clienteInfoDiv.classList.remove('hidden');
        sugerenciasClientes.classList.add('hidden');
        actualizarResumen();
    }

    function buscarProductos(query) {
        if (query.length < 2) {
            sugerenciasProductos.classList.add('hidden');
            return;
        }
        fetch(`/api/productos/buscar?q=${encodeURIComponent(query)}`)
            .then(r => r.json())
            .then(data => {
                mostrarSugerenciasProductos(data);
            })
            .catch(err => console.error('Error buscando productos:', err));
    }

    function mostrarSugerenciasProductos(productos) {
        sugerenciasProductos.innerHTML = '';
        if (productos.length === 0) {
            sugerenciasProductos.innerHTML = `<div class="px-4 py-2 text-sm text-gray-400">No se encontraron productos</div>`;
            sugerenciasProductos.classList.remove('hidden');
            return;
        }
        productos.forEach(p => {
            const div = document.createElement('div');
            div.className = 'px-4 py-2 hover:bg-indigo-50 cursor-pointer text-sm border-b border-gray-100 flex justify-between';
            div.innerHTML = `
                <span>${p.nombre}</span>
                <span class="text-xs text-gray-400">Stock: ${p.stock} | $${p.precio_usd.toFixed(2)}</span>
            `;
            div.dataset.id = p.id;
            div.addEventListener('click', function() {
                seleccionarProducto(p);
            });
            sugerenciasProductos.appendChild(div);
        });
        sugerenciasProductos.classList.remove('hidden');
    }

    function seleccionarProducto(producto) {
        productoSeleccionado = producto;
        productoIdHidden.value = producto.id;
        inputProductoBuscar.value = producto.nombre;
        productoInfoNombre.textContent = producto.nombre;
        productoInfoCategoria.textContent = producto.categoria || '-';
        productoInfoMarca.textContent = producto.marca || '-';
        productoInfoTalla.textContent = producto.talla || '-';
        productoInfoPrecio.textContent = producto.precio_usd.toFixed(2);
        productoInfoStock.textContent = producto.stock;
        productoInfoCosto.textContent = producto.costo_usd ? producto.costo_usd.toFixed(2) : '0.00';
        productoInfoDiv.classList.remove('hidden');
        sugerenciasProductos.classList.add('hidden');
        actualizarResumen();
    }

    // ============================================================
    // ACTUALIZAR RESUMEN (CORREGIDO - REFERENCIAS CON TASAS BCV FIJAS)
    // ============================================================
    function actualizarResumen() {
        if (!productoSeleccionado) {
            // Limpiar todos los campos
            if (crearTotalVes) crearTotalVes.value = '';
            if (crearAbonoMontoVes) crearAbonoMontoVes.value = '';
            if (crearSaldoVes) crearSaldoVes.value = '';
            if (crearTotalUsd) crearTotalUsd.value = '';
            if (crearAbonoMontoUsd) crearAbonoMontoUsd.value = '';
            if (crearSaldoUsd) crearSaldoUsd.value = '';
            if (crearTotalUsdDisplay) crearTotalUsdDisplay.textContent = '$0.00';
            if (crearAbonoUsdEquivalenteVes) crearAbonoUsdEquivalenteVes.value = '';
            if (crearAbonoEurEquivalenteVes) crearAbonoEurEquivalenteVes.value = '';
            if (crearAbonoVesEquivalenteUsd) crearAbonoVesEquivalenteUsd.value = '';
            if (crearAbonoEurEquivalenteUsd) crearAbonoEurEquivalenteUsd.value = '';
            if (crearResumenTotalUsd) crearResumenTotalUsd.textContent = '$0.00';
            if (crearResumenAbonoUsd) crearResumenAbonoUsd.textContent = '$0.00';
            if (crearResumenSaldoUsd) crearResumenSaldoUsd.textContent = '$0.00';
            if (crearResumenAbonoBsUsd) crearResumenAbonoBsUsd.textContent = 'Bs 0.00';
            if (crearResumenAbonoBsEur) crearResumenAbonoBsEur.textContent = 'Bs 0.00';
            if (crearResumenSaldoBsUsd) crearResumenSaldoBsUsd.textContent = 'Bs 0.00';
            if (crearResumenSaldoBsEur) crearResumenSaldoBsEur.textContent = 'Bs 0.00';
            if (crearResumenStock) crearResumenStock.textContent = '0';
            return;
        }

        const cantidad = parseInt(crearInputCantidad.value) || 1;
        const precioUnitarioUsd = productoSeleccionado.precio_usd || 0;
        const totalUsdFijo = cantidad * precioUnitarioUsd;

        // ============================================================
        // 1. CALCULAR TASA APLICADA PARA VES
        // ============================================================
        let tasaVes = tasaUsd;
        const metodoCobroVesVal = crearMetodoCobroVes.value;
        if (metodoCobroVesVal === 'bcv_usd') {
            tasaVes = tasaUsd;
        } else if (metodoCobroVesVal === 'bcv_eur') {
            tasaVes = tasaEur;
        } else if (metodoCobroVesVal === 'personalizada') {
            tasaVes = tasaPersonalizada;
        } else if (metodoCobroVesVal === 'bs_personalizado') {
            const bsMonto = parseFloat(crearBsPersonalizadoInputVes.value) || 0;
            if (bsMonto > 0) {
                tasaVes = bsMonto / totalUsdFijo;
            } else {
                tasaVes = tasaUsd;
            }
        }

        // 🔥 Guardar la tasa aplicada globalmente para enviar al backend
        tasaAplicada = tasaVes;

        // ============================================================
        // 2. TOTAL EN VES
        // ============================================================
        let totalVesVal = 0;
        if (metodoCobroVesVal === 'bs_personalizado') {
            const bsMonto = parseFloat(crearBsPersonalizadoInputVes.value) || 0;
            totalVesVal = bsMonto > 0 ? bsMonto : totalUsdFijo * tasaUsd;
        } else {
            totalVesVal = totalUsdFijo * tasaVes;
        }

        // ============================================================
        // 3. TOTAL EN USD (TRANSACCIÓN) - CAMBIA CON LA TASA
        // ============================================================
        let totalUsdTransaccion = 0;
        if (metodoCobroVesVal === 'bs_personalizado') {
            const bsMonto = parseFloat(crearBsPersonalizadoInputVes.value) || 0;
            totalUsdTransaccion = bsMonto > 0 ? bsMonto / tasaUsd : totalUsdFijo;
        } else {
            totalUsdTransaccion = totalUsdFijo * (tasaVes / tasaUsd);
        }

        // ============================================================
        // 4. PORCENTAJE Y ABONO EN VES
        // ============================================================
        let porcentajeVesVal = 0;
        if (crearPorcentajeVes.value === 'personalizado') {
            porcentajeVesVal = parseFloat(crearPorcentajePersonalizadoVes.value) || 0;
        } else {
            porcentajeVesVal = parseFloat(crearPorcentajeVes.value) || 0;
        }
        const abonoVesVal = totalVesVal * (porcentajeVesVal / 100);
        const saldoVesVal = totalVesVal - abonoVesVal;

        // ============================================================
        // 5. REFERENCIAS DEL ABONO EN VES A USD Y EUR - USANDO TASAS BCV FIJAS
        // ============================================================
        // 🔥 CORRECCIÓN: Siempre usar tasaUsd y tasaEur (BCV) para las referencias
        const abonoUsdEquivVes = abonoVesVal / tasaUsd;   // Tasa BCV USD
        const abonoEurEquivVes = abonoVesVal / tasaEur;   // Tasa BCV EUR

        // ============================================================
        // 6. CÁLCULOS PARA LA PESTAÑA USD
        // ============================================================
        let totalUsdValFinal = totalUsdFijo;
        if (crearMetodoCobroUsd.value === 'usd_personalizado') {
            const usdPersonalizado = parseFloat(crearUsdPersonalizadoInputUsd.value) || 0;
            if (usdPersonalizado > 0) {
                totalUsdValFinal = usdPersonalizado;
            }
        }

        let porcentajeUsdVal = 0;
        if (crearPorcentajeUsd.value === 'personalizado') {
            porcentajeUsdVal = parseFloat(crearPorcentajePersonalizadoUsd.value) || 0;
        } else {
            porcentajeUsdVal = parseFloat(crearPorcentajeUsd.value) || 0;
        }
        const abonoUsdVal = totalUsdValFinal * (porcentajeUsdVal / 100);
        const saldoUsdVal = totalUsdValFinal - abonoUsdVal;

        const abonoVesEquivUsd = abonoUsdVal * tasaUsd;
        const abonoEurEquivUsd = abonoUsdVal * tasaEur;

        // ============================================================
        // 7. GUARDAR ABONO EN USD PARA EL ENVÍO
        // ============================================================
        if (monedaSeleccionada === 'VES') {
            abonoUsdCalculado = abonoUsdEquivVes;
        } else {
            abonoUsdCalculado = abonoUsdVal;
        }

        // ============================================================
        // 8. ACTUALIZAR CAMPOS EN PANTALLA
        // ============================================================

        // --- TOTAL EN USD (SUBTOTAL) - ARRIBA ---
        if (crearTotalUsdDisplay) {
            if (monedaSeleccionada === 'VES') {
                crearTotalUsdDisplay.textContent = `$${formatearMonto(totalUsdTransaccion)}`;
            } else {
                crearTotalUsdDisplay.textContent = `$${formatearMonto(totalUsdValFinal)}`;
            }
        }

        // --- CAMPOS VES ---
        if (crearTotalVes) crearTotalVes.value = `Bs ${formatearMontoVES(totalVesVal)}`;
        if (crearAbonoMontoVes) crearAbonoMontoVes.value = `Bs ${formatearMontoVES(abonoVesVal)}`;
        if (crearSaldoVes) crearSaldoVes.value = `Bs ${formatearMontoVES(saldoVesVal)}`;
        // 🔥 CORRECCIÓN: Referencias usando tasas BCV fijas (tasaUsd y tasaEur)
        if (crearAbonoUsdEquivalenteVes) crearAbonoUsdEquivalenteVes.value = `$${formatearMonto(abonoUsdEquivVes)}`;
        if (crearAbonoEurEquivalenteVes) crearAbonoEurEquivalenteVes.value = `€${formatearMonto(abonoEurEquivVes)}`;

        // --- CAMPOS USD ---
        if (crearTotalUsd) crearTotalUsd.value = `$${formatearMonto(totalUsdValFinal)}`;
        if (crearAbonoMontoUsd) crearAbonoMontoUsd.value = `$${formatearMonto(abonoUsdVal)}`;
        if (crearSaldoUsd) crearSaldoUsd.value = `$${formatearMonto(saldoUsdVal)}`;
        if (crearAbonoVesEquivalenteUsd) crearAbonoVesEquivalenteUsd.value = `Bs ${formatearMontoVES(abonoVesEquivUsd)}`;
        if (crearAbonoEurEquivalenteUsd) crearAbonoEurEquivalenteUsd.value = `€${formatearMonto(abonoEurEquivUsd)}`;

        // --- RESUMEN DEL APARTADO (TARJETAS) ---
        if (crearResumenTotalUsd) {
            if (monedaSeleccionada === 'VES') {
                crearResumenTotalUsd.textContent = `$${formatearMonto(totalUsdTransaccion)}`;
            } else {
                crearResumenTotalUsd.textContent = `$${formatearMonto(totalUsdValFinal)}`;
            }
        }
        if (crearResumenAbonoUsd) {
            if (monedaSeleccionada === 'VES') {
                crearResumenAbonoUsd.textContent = `$${formatearMonto(abonoUsdEquivVes)}`;
            } else {
                crearResumenAbonoUsd.textContent = `$${formatearMonto(abonoUsdVal)}`;
            }
        }
        if (crearResumenSaldoUsd) {
            if (monedaSeleccionada === 'VES') {
                crearResumenSaldoUsd.textContent = `$${formatearMonto((totalVesVal - abonoVesVal) / tasaUsd)}`;
            } else {
                crearResumenSaldoUsd.textContent = `$${formatearMonto(saldoUsdVal)}`;
            }
        }

        if (crearResumenAbonoBsUsd) crearResumenAbonoBsUsd.textContent = `Bs ${formatearMontoVES(abonoVesVal)}`;
        if (crearResumenAbonoBsEur) crearResumenAbonoBsEur.textContent = `Bs ${formatearMontoVES(abonoVesVal * (tasaEur / tasaUsd))}`;
        if (crearResumenSaldoBsUsd) crearResumenSaldoBsUsd.textContent = `Bs ${formatearMontoVES(saldoVesVal)}`;
        if (crearResumenSaldoBsEur) crearResumenSaldoBsEur.textContent = `Bs ${formatearMontoVES(saldoVesVal * (tasaEur / tasaUsd))}`;

        // Stock
        const stockActual = productoSeleccionado.stock || 0;
        let stockRestante = stockActual;
        if (crearCheckboxDescontarStock.checked) {
            stockRestante = stockActual - cantidad;
        }
        if (crearResumenStock) {
            if (stockRestante < 0) {
                crearResumenStock.textContent = '⚠️ Stock insuficiente';
                crearResumenStock.className = 'text-red-600 font-semibold';
            } else {
                crearResumenStock.textContent = stockRestante;
                crearResumenStock.className = 'font-semibold text-gray-800';
            }
        }

        manejarMetodoCobroVes();
        manejarMetodoCobroUsd();
    }

    // ============================================================
    // MANEJAR MÉTODOS DE COBRO PERSONALIZADOS - VES
    // ============================================================
    function manejarMetodoCobroVes() {
        const valor = crearMetodoCobroVes.value;
        crearBsPersonalizadoContainerVes.classList.toggle('hidden', valor !== 'bs_personalizado');
        if (valor === 'bs_personalizado') {
            actualizarEquivalenteBsPersonalizadoVes();
        }
    }

    function actualizarEquivalenteBsPersonalizadoVes() {
        const montoBs = parseFloat(crearBsPersonalizadoInputVes.value) || 0;
        if (montoBs > 0 && tasaUsd > 0) {
            const equivUsd = montoBs / tasaUsd;
            crearBsEquivalenteUsdVes.value = `$${formatearMonto(equivUsd)} (Tasa BCV USD)`;
        } else {
            crearBsEquivalenteUsdVes.value = '';
        }
        actualizarResumen();
    }

    // ============================================================
    // MANEJAR MÉTODOS DE COBRO PERSONALIZADOS - USD
    // ============================================================
    function manejarMetodoCobroUsd() {
        const valor = crearMetodoCobroUsd.value;
        crearUsdPersonalizadoContainerUsd.classList.toggle('hidden', valor !== 'usd_personalizado');
        if (valor === 'usd_personalizado') {
            actualizarEquivalenteUsdPersonalizadoUsd();
        }
    }

    function actualizarEquivalenteUsdPersonalizadoUsd() {
        const montoUsd = parseFloat(crearUsdPersonalizadoInputUsd.value) || 0;
        if (montoUsd > 0 && tasaUsd > 0) {
            const equivVes = montoUsd * tasaUsd;
            crearUsdEquivalenteVesUsd.value = `Bs ${formatearMontoVES(equivVes)} (Tasa BCV USD)`;
        } else {
            crearUsdEquivalenteVesUsd.value = '';
        }
        actualizarResumen();
    }

    // ============================================================
    // MANEJAR PESTAÑAS
    // ============================================================
    function cambiarPestana(moneda) {
        monedaSeleccionada = moneda;
        if (moneda === 'VES') {
            crearTabVes.classList.remove('hidden');
            crearTabUsd.classList.add('hidden');
            crearBtnTabs.forEach(btn => {
                btn.classList.remove('text-indigo-600', 'border-indigo-600');
                btn.classList.add('text-gray-500', 'border-transparent');
                if (btn.dataset.tab === 'ves') {
                    btn.classList.remove('text-gray-500', 'border-transparent');
                    btn.classList.add('text-indigo-600', 'border-indigo-600');
                }
            });
        } else {
            crearTabVes.classList.add('hidden');
            crearTabUsd.classList.remove('hidden');
            crearBtnTabs.forEach(btn => {
                btn.classList.remove('text-indigo-600', 'border-indigo-600');
                btn.classList.add('text-gray-500', 'border-transparent');
                if (btn.dataset.tab === 'usd') {
                    btn.classList.remove('text-gray-500', 'border-transparent');
                    btn.classList.add('text-indigo-600', 'border-indigo-600');
                }
            });
        }
        actualizarResumen();
    }

    // Eventos de pestañas
    crearBtnTabs.forEach(btn => {
        btn.addEventListener('click', function() {
            const moneda = this.dataset.tab === 'ves' ? 'VES' : 'USD';
            cambiarPestana(moneda);
        });
    });

    // ============================================================
    // EVENTOS - PÁGINA DE CREACIÓN
    // ============================================================
    if (inputClienteBuscar) {
        inputClienteBuscar.addEventListener('input', function() {
            const query = this.value.trim();
            if (timeoutBusquedaCliente) clearTimeout(timeoutBusquedaCliente);
            timeoutBusquedaCliente = setTimeout(() => {
                buscarClientes(query);
            }, 300);
        });

        inputClienteBuscar.addEventListener('focus', function() {
            if (this.value.trim().length > 0) {
                buscarClientes(this.value.trim());
            }
        });
    }

    if (inputProductoBuscar) {
        inputProductoBuscar.addEventListener('input', function() {
            const query = this.value.trim();
            if (timeoutBusquedaProducto) clearTimeout(timeoutBusquedaProducto);
            timeoutBusquedaProducto = setTimeout(() => {
                buscarProductos(query);
            }, 300);
        });

        inputProductoBuscar.addEventListener('focus', function() {
            if (this.value.trim().length > 0) {
                buscarProductos(this.value.trim());
            }
        });
    }

    if (crearInputCantidad) {
        crearInputCantidad.addEventListener('input', actualizarResumen);
    }

    if (crearCheckboxDescontarStock) {
        crearCheckboxDescontarStock.addEventListener('change', actualizarResumen);
    }

    // Porcentajes VES
    if (crearPorcentajeVes) {
        crearPorcentajeVes.addEventListener('change', function() {
            const valor = this.value;
            if (valor === 'personalizado') {
                crearPorcentajePersonalizadoContainerVes.classList.remove('hidden');
            } else {
                crearPorcentajePersonalizadoContainerVes.classList.add('hidden');
            }
            actualizarResumen();
        });
    }
    if (crearPorcentajePersonalizadoVes) {
        crearPorcentajePersonalizadoVes.addEventListener('input', function() {
            let valor = parseFloat(this.value) || 0;
            if (valor < 0) valor = 0;
            if (valor > 100) valor = 100;
            this.value = valor;
            actualizarResumen();
        });
    }

    // Porcentajes USD
    if (crearPorcentajeUsd) {
        crearPorcentajeUsd.addEventListener('change', function() {
            const valor = this.value;
            if (valor === 'personalizado') {
                crearPorcentajePersonalizadoContainerUsd.classList.remove('hidden');
            } else {
                crearPorcentajePersonalizadoContainerUsd.classList.add('hidden');
            }
            actualizarResumen();
        });
    }
    if (crearPorcentajePersonalizadoUsd) {
        crearPorcentajePersonalizadoUsd.addEventListener('input', function() {
            let valor = parseFloat(this.value) || 0;
            if (valor < 0) valor = 0;
            if (valor > 100) valor = 100;
            this.value = valor;
            actualizarResumen();
        });
    }

    // Métodos de cobro VES
    if (crearMetodoCobroVes) {
        crearMetodoCobroVes.addEventListener('change', function() {
            manejarMetodoCobroVes();
            actualizarResumen();
        });
    }
    if (crearBsPersonalizadoInputVes) {
        crearBsPersonalizadoInputVes.addEventListener('input', function() {
            actualizarEquivalenteBsPersonalizadoVes();
            actualizarResumen();
        });
    }

    // Métodos de cobro USD
    if (crearMetodoCobroUsd) {
        crearMetodoCobroUsd.addEventListener('change', function() {
            manejarMetodoCobroUsd();
            actualizarResumen();
        });
    }
    if (crearUsdPersonalizadoInputUsd) {
        crearUsdPersonalizadoInputUsd.addEventListener('input', function() {
            actualizarEquivalenteUsdPersonalizadoUsd();
            actualizarResumen();
        });
    }

    if (crearSelectPeriodoTipo) {
        crearSelectPeriodoTipo.addEventListener('change', function() {
            const tipo = this.value;
            const fechaContainer = document.getElementById('deuda-fecha-container');
            const infoTexto = document.getElementById('deuda-info-texto');

            if (tipo === 'personalizado') {
                if (fechaContainer) fechaContainer.style.display = 'block';
                if (infoTexto) infoTexto.textContent = 'Seleccione una fecha límite para el pago completo.';
            } else {
                if (fechaContainer) fechaContainer.style.display = 'block';
                const hoy = new Date();
                const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 2, 0);
                const fechaStr = finMes.toISOString().split('T')[0];
                if (crearInputFechaLimite) crearInputFechaLimite.value = fechaStr;
                if (infoTexto) infoTexto.textContent = `Fecha límite: ${finMes.toLocaleDateString('es-VE')} (Fin del mes siguiente)`;
            }
        });
    }

    // ============================================================
    // ENVÍO DEL FORMULARIO DE CREACIÓN
    // ============================================================
    if (formDeudaCrear) {
        formDeudaCrear.addEventListener('submit', function(e) {
            e.preventDefault();

            if (!clienteSeleccionado) {
                alert('❌ Debe seleccionar un cliente fijo');
                return;
            }
            if (!productoSeleccionado) {
                alert('❌ Debe seleccionar un producto');
                return;
            }

            const cantidad = parseInt(crearInputCantidad.value) || 0;
            if (cantidad <= 0) {
                alert('❌ La cantidad debe ser mayor a 0');
                return;
            }

            if (crearCheckboxDescontarStock.checked && cantidad > productoSeleccionado.stock) {
                alert(`❌ Stock insuficiente. Disponible: ${productoSeleccionado.stock}`);
                return;
            }

            const fechaLimite = crearInputFechaLimite.value;
            if (!fechaLimite) {
                alert('❌ Debe seleccionar una fecha límite de pago');
                return;
            }

            let metodoCobro = '';
            let metodoPago = '';
            let porcentaje = 0;
            if (monedaSeleccionada === 'VES') {
                metodoCobro = crearMetodoCobroVes.value;
                metodoPago = crearMetodoPagoVes.value;
                if (crearPorcentajeVes.value === 'personalizado') {
                    porcentaje = parseFloat(crearPorcentajePersonalizadoVes.value) || 0;
                } else {
                    porcentaje = parseFloat(crearPorcentajeVes.value) || 0;
                }
                if (metodoCobro === 'bs_personalizado') {
                    const montoBs = parseFloat(crearBsPersonalizadoInputVes.value) || 0;
                    if (montoBs <= 0) {
                        alert('❌ Ingrese un monto en Bs para el método de cobro personalizado');
                        return;
                    }
                }
            } else {
                metodoCobro = crearMetodoCobroUsd.value;
                metodoPago = crearMetodoPagoUsd.value;
                if (crearPorcentajeUsd.value === 'personalizado') {
                    porcentaje = parseFloat(crearPorcentajePersonalizadoUsd.value) || 0;
                } else {
                    porcentaje = parseFloat(crearPorcentajeUsd.value) || 0;
                }
                if (metodoCobro === 'usd_personalizado') {
                    const montoUsd = parseFloat(crearUsdPersonalizadoInputUsd.value) || 0;
                    if (montoUsd <= 0) {
                        alert('❌ Ingrese un monto en USD para el método de cobro personalizado');
                        return;
                    }
                }
            }

            if (porcentaje <= 0 || porcentaje > 100) {
                alert('❌ Ingrese un porcentaje válido (1-100)');
                return;
            }

            const data = {
                cliente_id: clienteSeleccionado.id,
                producto_id: productoSeleccionado.id,
                cantidad: cantidad,
                abono_inicial_porcentaje: porcentaje,
                metodo_cobro_inicial: metodoCobro,
                metodo_pago_inicial: metodoPago,
                periodo_tipo: crearSelectPeriodoTipo.value,
                fecha_limite_pago: fechaLimite,
                descontar_stock_al_apartar: crearCheckboxDescontarStock.checked,
                abono_inicial_monto_usd: abonoUsdCalculado,
                tasa_aplicada: tasaAplicada
            };

            if (metodoCobro === 'bs_personalizado') {
                data.total_cobro = parseFloat(crearBsPersonalizadoInputVes.value) || 0;
            }
            if (metodoCobro === 'usd_personalizado') {
                data.total_cobro = parseFloat(crearUsdPersonalizadoInputUsd.value) || 0;
            }

            fetch('/api/apartados', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            .then(r => {
                if (!r.ok) throw new Error('Error al crear apartado');
                return r.json();
            })
            .then(res => {
                alert(res.mensaje || '✅ Apartado creado correctamente');
                window.location.href = '/admin/deudas';
            })
            .catch(err => {
                alert('❌ Error: ' + err.message);
            });
        });
    }

    // ============================================================
    // FUNCIONES PARA EL DETALLE DE DEUDA (deuda_detalle.html)
    // ============================================================
    function cargarDetalleDeuda(deudaId) {
        fetch(`/api/apartados/${deudaId}`)
            .then(r => {
                if (!r.ok) throw new Error('Error al cargar detalle');
                return r.json();
            })
            .then(data => {
                renderizarDetalleDeuda(data);
            })
            .catch(err => {
                console.error('Error cargando detalle:', err);
                alert('Error al cargar el detalle de la deuda');
            });
    }

    // ============================================================
    // 🔥 CORRECCIÓN PRINCIPAL: RENDERIZAR DETALLE USANDO DATA.TOTAL_USD
    // ============================================================
    function renderizarDetalleDeuda(data) {
        if (detalleClienteNombre) detalleClienteNombre.textContent = `${data.cliente.nombre} ${data.cliente.apellido}`;
        if (detalleClienteCedula) detalleClienteCedula.textContent = data.cliente.cedula;
        if (detalleClienteTelefono) detalleClienteTelefono.textContent = data.cliente.telefono || '-';
        if (detalleClienteDireccion) detalleClienteDireccion.textContent = data.cliente.direccion || '-';

        if (detalleProductoNombre) detalleProductoNombre.textContent = data.producto.nombre;
        if (detalleProductoCategoria) detalleProductoCategoria.textContent = data.producto.categoria || '-';
        if (detalleProductoMarca) detalleProductoMarca.textContent = data.producto.marca || '-';
        if (detalleProductoTalla) detalleProductoTalla.textContent = data.producto.talla || '-';
        if (detalleProductoCantidad) detalleProductoCantidad.textContent = data.cantidad;
        if (detalleProductoPrecio) detalleProductoPrecio.textContent = data.precio_unitario_usd.toFixed(2);

        // 🔥 CORRECCIÓN: Usar data.total_usd en lugar de recalcular
        const total = data.total_usd || 0;
        if (detalleTotal) detalleTotal.textContent = total.toFixed(2);

        // Total abonado = abono inicial + todos los pagos adicionales
        const totalAbonado = data.abono_inicial_monto + data.pagos.reduce((sum, p) => sum + p.monto_usd, 0);
        if (detalleAbonado) detalleAbonado.textContent = totalAbonado.toFixed(2);

        const totalAbonadoBs = totalAbonado * tasaUsd;
        if (detalleAbonadoBs) detalleAbonadoBs.textContent = `Bs ${formatearMontoVES(totalAbonadoBs)}`;

        // 🔥 Saldo restante: usar data.saldo_restante (el backend ya lo calculó correctamente)
        const saldoRestante = data.saldo_restante || 0;
        if (detalleSaldo) detalleSaldo.textContent = saldoRestante.toFixed(2);

        const saldoRestanteBs = saldoRestante * tasaUsd;
        if (detalleSaldoBs) detalleSaldoBs.textContent = `Bs ${formatearMontoVES(saldoRestanteBs)}`;

        if (detalleEstadoBadge) {
            const estadoMap = {
                'activo': { text: 'Activo', class: 'bg-yellow-100 text-yellow-800' },
                'pagado': { text: 'Pagado', class: 'bg-green-100 text-green-800' },
                'reintegrado': { text: 'Reintegrado', class: 'bg-red-100 text-red-800' }
            };
            const estadoInfo = estadoMap[data.estado] || { text: data.estado, class: 'bg-gray-100 text-gray-800' };
            detalleEstadoBadge.textContent = estadoInfo.text;
            detalleEstadoBadge.className = `px-3 py-1 rounded-full text-sm font-medium ${estadoInfo.class}`;
        }

        if (tablaAbonos) {
            tablaAbonos.innerHTML = '';
            if (data.pagos.length === 0) {
                tablaAbonos.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-gray-400">No hay abonos registrados</td></tr>`;
            } else {
                data.pagos.forEach(p => {
                    const tr = document.createElement('tr');
                    tr.className = 'border-b border-gray-100';
                    tr.innerHTML = `
                        <td class="py-2 px-3">${p.fecha_abono}</td>
                        <td class="py-2 px-3 text-right font-medium">$${p.monto_usd.toFixed(2)}</td>
                        <!-- 🔥 CORREGIDO: Formato con separadores de miles para VES -->
                        <td class="py-2 px-3 text-right">Bs ${formatearMontoVES(p.monto_ves)}</td>
                        <td class="py-2 px-3">${p.metodo_cobro || '-'}</td>
                        <td class="py-2 px-3">${p.metodo_pago || '-'}</td>
                        <td class="py-2 px-3 text-right">${p.tasa_aplicada.toFixed(2)}</td>
                        <td class="py-2 px-3">${p.observaciones || '-'}</td>
                    `;
                    tablaAbonos.appendChild(tr);
                });
            }
        }

        if (modalAbonoSaldoActual) modalAbonoSaldoActual.textContent = saldoRestante.toFixed(2);
        if (modalAbonoSaldoActualBs) modalAbonoSaldoActualBs.textContent = `Bs ${formatearMontoVES(saldoRestanteBs)}`;
    }

    // ============================================================
    // MODAL DE AGREGAR ABONO
    // ============================================================
    function abrirModalAbono() {
        if (modalAbono) {
            const saldoText = detalleSaldo ? detalleSaldo.textContent : '0.00';
            const saldo = parseFloat(saldoText) || 0;
            if (modalAbonoSaldoActual) modalAbonoSaldoActual.textContent = saldo.toFixed(2);
            if (modalAbonoSaldoActualBs) {
                const saldoBs = saldo * tasaUsd;
                modalAbonoSaldoActualBs.textContent = `Bs ${formatearMontoVES(saldoBs)}`;
            }
            if (modalAbonoMonto) modalAbonoMonto.value = '';
            if (modalAbonoMontoVes) modalAbonoMontoVes.value = '';
            if (modalAbonoRefVesUsd) modalAbonoRefVesUsd.value = '';
            if (modalAbonoRefVesEur) modalAbonoRefVesEur.value = '';
            if (modalAbonoRefUsd) modalAbonoRefUsd.value = '';
            if (modalAbonoRefEur) modalAbonoRefEur.value = '';
            modalAbono.classList.remove('hidden');
            manejarCambioMonedaAbono();
        }
    }

    function cerrarModalAbono() {
        if (modalAbono) modalAbono.classList.add('hidden');
    }

    window.abrirModalAbono = abrirModalAbono;
    window.cerrarModalAbono = cerrarModalAbono;

    if (btnAbrirModalAbono) {
        btnAbrirModalAbono.addEventListener('click', abrirModalAbono);
    }

    // ============================================================
    // MANEJAR CAMBIO DE MONEDA EN EL MODAL DE ABONO
    // ============================================================
    function manejarCambioMonedaAbono() {
        const moneda = modalAbonoMoneda ? modalAbonoMoneda.value : 'USD';
        const esUSD = moneda === 'USD';

        if (modalAbonoReferenciasUsd) modalAbonoReferenciasUsd.classList.toggle('hidden', !esUSD);
        if (modalAbonoReferenciasVes) modalAbonoReferenciasVes.classList.toggle('hidden', esUSD);

        if (modalAbonoMontoLabel) {
            modalAbonoMontoLabel.textContent = esUSD ? 'Monto en USD *' : 'Monto en VES *';
        }
        if (modalAbonoMontoVesLabel) {
            modalAbonoMontoVesLabel.textContent = esUSD ? 'Equivalente en VES' : 'Equivalente en USD';
        }

        if (modalAbonoMonto) modalAbonoMonto.value = '';
        if (modalAbonoMontoVes) modalAbonoMontoVes.value = '';
        if (modalAbonoRefVesUsd) modalAbonoRefVesUsd.value = '';
        if (modalAbonoRefVesEur) modalAbonoRefVesEur.value = '';
        if (modalAbonoRefUsd) modalAbonoRefUsd.value = '';
        if (modalAbonoRefEur) modalAbonoRefEur.value = '';

        filtrarMetodosAbono(moneda);
    }

    function filtrarMetodosAbono(moneda) {
        if (!modalAbonoMetodoCobro || !modalAbonoMetodoPago) return;

        const cobroOptions = modalAbonoMetodoCobro.querySelectorAll('optgroup, option');
        cobroOptions.forEach(opt => {
            if (opt.tagName === 'OPTGROUP') {
                const label = opt.label;
                opt.style.display = (label === moneda) ? '' : 'none';
            }
        });
        const firstVisible = modalAbonoMetodoCobro.querySelector(`optgroup[label="${moneda}"] option`);
        if (firstVisible) modalAbonoMetodoCobro.value = firstVisible.value;

        const pagoOptions = modalAbonoMetodoPago.querySelectorAll('optgroup, option');
        pagoOptions.forEach(opt => {
            if (opt.tagName === 'OPTGROUP') {
                const label = opt.label;
                opt.style.display = (label === moneda) ? '' : 'none';
            }
        });
        const firstVisiblePago = modalAbonoMetodoPago.querySelector(`optgroup[label="${moneda}"] option`);
        if (firstVisiblePago) modalAbonoMetodoPago.value = firstVisiblePago.value;
    }

    if (modalAbonoMoneda) {
        modalAbonoMoneda.addEventListener('change', function() {
            manejarCambioMonedaAbono();
            actualizarReferenciasAbono();
        });
    }

    // ============================================================
    // ACTUALIZAR REFERENCIAS EN EL MODAL DE ABONO
    // ============================================================
    function actualizarReferenciasAbono() {
        const moneda = modalAbonoMoneda ? modalAbonoMoneda.value : 'USD';
        const montoFormateado = modalAbonoMonto ? modalAbonoMonto.value : '';
        const monto = limpiarMontoInput(montoFormateado);

        if (monto <= 0) {
            if (modalAbonoMontoVes) modalAbonoMontoVes.value = '';
            if (modalAbonoRefVesUsd) modalAbonoRefVesUsd.value = '';
            if (modalAbonoRefVesEur) modalAbonoRefVesEur.value = '';
            if (modalAbonoRefUsd) modalAbonoRefUsd.value = '';
            if (modalAbonoRefEur) modalAbonoRefEur.value = '';
            return;
        }

        if (moneda === 'USD') {
            const montoVes = monto * tasaUsd;
            const montoEur = monto * tasaEur;
            if (modalAbonoMontoVes) modalAbonoMontoVes.value = `Bs ${formatearMontoVES(montoVes)}`;
            if (modalAbonoRefVesUsd) modalAbonoRefVesUsd.value = `Bs ${formatearMontoVES(montoVes)} (Tasa USD)`;
            if (modalAbonoRefVesEur) modalAbonoRefVesEur.value = `Bs ${formatearMontoVES(montoEur)} (Tasa EUR)`;
            if (modalAbonoRefUsd) modalAbonoRefUsd.value = '';
            if (modalAbonoRefEur) modalAbonoRefEur.value = '';
        } else {
            const montoUsd = monto / tasaUsd;
            const montoEur = monto / tasaEur;
            if (modalAbonoMontoVes) modalAbonoMontoVes.value = `$${formatearMonto(montoUsd)}`;
            if (modalAbonoRefUsd) modalAbonoRefUsd.value = `$${formatearMonto(montoUsd)} (Tasa USD)`;
            if (modalAbonoRefEur) modalAbonoRefEur.value = `€${formatearMonto(montoEur)} (Tasa EUR)`;
            if (modalAbonoRefVesUsd) modalAbonoRefVesUsd.value = '';
            if (modalAbonoRefVesEur) modalAbonoRefVesEur.value = '';
        }
    }

    // ============================================================
    // 🔥 EVENTOS DE INPUT Y BLUR PARA EL CAMPO DE MONTO
    // ============================================================
    if (modalAbonoMonto) {
        // Evento input: solo actualizar referencias sin alterar el texto
        modalAbonoMonto.addEventListener('input', function() {
            actualizarReferenciasAbono();
        });

        // Evento blur: formatear con separadores de miles y dos decimales
        modalAbonoMonto.addEventListener('blur', function() {
            const valorNumerico = limpiarMontoInput(this.value);
            if (valorNumerico > 0) {
                this.value = formatearConSeparadores(valorNumerico);
            } else {
                this.value = '';
            }
            actualizarReferenciasAbono();
        });

        // Evento focus: mostrar el número con dos decimales fijos (sin separadores de miles)
        modalAbonoMonto.addEventListener('focus', function() {
            const valorNumerico = limpiarMontoInput(this.value);
            if (valorNumerico > 0) {
                // Mostrar con dos decimales y coma decimal, sin puntos de miles
                this.value = formatearSinSeparadores(valorNumerico);
            }
            // Si está vacío, dejar vacío
        });
    }

    // ============================================================
    // ENVÍO DEL FORMULARIO DE AGREGAR ABONO (MODAL)
    // ============================================================
    if (formAgregarAbono) {
        formAgregarAbono.addEventListener('submit', function(e) {
            e.preventDefault();

            const apartadoId = document.getElementById('abono-apartado-id')?.value;
            if (!apartadoId) {
                alert('❌ No se pudo identificar el apartado');
                return;
            }

            const moneda = modalAbonoMoneda ? modalAbonoMoneda.value : 'USD';
            const montoFormateado = modalAbonoMonto ? modalAbonoMonto.value : '';
            let montoIngresado = limpiarMontoInput(montoFormateado);
            if (montoIngresado <= 0) {
                alert('❌ Ingrese un monto válido');
                return;
            }

            let montoUsd = 0;
            if (moneda === 'USD') {
                montoUsd = montoIngresado;
            } else {
                montoUsd = montoIngresado / tasaUsd;
            }
            // 🔥 REDONDEAR A 2 DECIMALES PARA EVITAR ERRORES DE PRECISIÓN
            montoUsd = Math.round(montoUsd * 100) / 100;

            const saldoActual = parseFloat(modalAbonoSaldoActual ? modalAbonoSaldoActual.textContent : 0) || 0;
            if (montoUsd > saldoActual + 0.01) {
                alert(`❌ El monto ($${montoUsd.toFixed(2)}) excede el saldo restante ($${saldoActual.toFixed(2)})`);
                return;
            }

            const data = {
                monto_usd: montoUsd,
                metodo_cobro: modalAbonoMetodoCobro ? modalAbonoMetodoCobro.value : 'usd',
                metodo_pago: modalAbonoMetodoPago ? modalAbonoMetodoPago.value : 'Efectivo USD',
                observaciones: document.getElementById('abono-observaciones')?.value || ''
            };

            fetch(`/api/apartados/${apartadoId}/pago`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            .then(r => {
                if (!r.ok) throw new Error('Error al registrar el abono');
                return r.json();
            })
            .then(res => {
                alert(res.mensaje || '✅ Abono registrado correctamente');
                cerrarModalAbono();
                cargarDetalleDeuda(apartadoId);
            })
            .catch(err => {
                alert('❌ Error: ' + err.message);
            });
        });
    }

    // ============================================================
    // EVENTOS DE FILTROS - LISTADO DE DEUDAS Y FINALIZADAS
    // ============================================================
    function obtenerFiltrosSegunRuta() {
        const path = window.location.pathname;
        const esFinalizadas = path === '/admin/deudas/finalizadas';

        if (esFinalizadas) {
            return {
                cliente: filtroCliente ? filtroCliente.value.trim() : '',
                estado: filtroEstado ? filtroEstado.value : 'pagado',
                fecha_desde: filtroFechaDesde ? filtroFechaDesde.value : '',
                fecha_hasta: filtroFechaHasta ? filtroFechaHasta.value : ''
            };
        } else {
            return {
                cliente: filtroCliente ? filtroCliente.value.trim() : '',
                estado: filtroEstado ? filtroEstado.value : 'activo',
                fecha_limite: filtroFechaLimite ? filtroFechaLimite.value : ''
            };
        }
    }

    if (btnFiltrar) {
        btnFiltrar.addEventListener('click', function() {
            const path = window.location.pathname;
            const esFinalizadas = path === '/admin/deudas/finalizadas';

            if (esFinalizadas) {
                const filtros = obtenerFiltrosSegunRuta();
                cargarDeudasFinalizadas(filtros);
            } else {
                const filtros = {
                    cliente: filtroCliente ? filtroCliente.value.trim() : '',
                    estado: filtroEstado ? filtroEstado.value : 'activo',
                    fecha_limite: filtroFechaLimite ? filtroFechaLimite.value : ''
                };
                cargarDeudas(filtros);
            }
        });
    }

    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', function() {
            const path = window.location.pathname;
            const esFinalizadas = path === '/admin/deudas/finalizadas';

            if (filtroCliente) filtroCliente.value = '';
            if (filtroEstado) filtroEstado.value = esFinalizadas ? 'pagado' : 'activo';
            if (filtroFechaLimite) filtroFechaLimite.value = '';
            if (filtroFechaDesde) filtroFechaDesde.value = '';
            if (filtroFechaHasta) filtroFechaHasta.value = '';

            if (esFinalizadas) {
                cargarDeudasFinalizadas({ estado: 'pagado' });
            } else {
                cargarDeudas({ estado: 'activo' });
            }
        });
    }

    // ============================================================
    // BOTÓN FINALIZAR (deuda_detalle.html)
    // ============================================================
    if (btnFinalizarDeuda) {
        btnFinalizarDeuda.addEventListener('click', function() {
            const idSpan = document.getElementById('detalle-apartado-id');
            if (!idSpan) {
                alert('❌ No se pudo identificar el apartado.');
                return;
            }
            const id = idSpan.textContent.trim();
            if (!id) return;

            const saldoEl = detalleSaldo;
            if (saldoEl) {
                const saldo = parseFloat(saldoEl.textContent) || 0;
                if (saldo > 0.01) {
                    alert(`⚠️ El apartado aún tiene saldo pendiente ($${saldo.toFixed(2)}).\nDebe quedar en cero para finalizar.`);
                    return;
                }
            }

            const modalFinalizar = document.getElementById('modal-finalizar');
            if (modalFinalizar) {
                modalFinalizar.classList.remove('hidden');
                const finalizarSaldo = document.getElementById('finalizar-saldo');
                if (finalizarSaldo && saldoEl) {
                    finalizarSaldo.textContent = saldoEl.textContent;
                }
                if (finalizarApartadoId) finalizarApartadoId.value = id;
            }
        });
    }

    const btnConfirmarFinalizar = document.getElementById('btn-confirmar-finalizar');
    if (btnConfirmarFinalizar) {
        btnConfirmarFinalizar.addEventListener('click', function() {
            const id = finalizarApartadoId ? finalizarApartadoId.value : null;
            if (!id) {
                alert('❌ No se pudo identificar el apartado.');
                return;
            }

            this.disabled = true;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';

            fetch(`/api/apartados/${id}/finalizar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })
            .then(r => r.json())
            .then(result => {
                if (result.error) {
                    alert('❌ Error: ' + result.error);
                } else {
                    alert('✅ ' + result.mensaje + '\nTicket generado.');
                    window.location.href = '/admin/deudas';
                }
            })
            .catch(err => {
                alert('❌ Error al finalizar el apartado.');
                console.error(err);
            })
            .finally(() => {
                this.disabled = false;
                this.innerHTML = '<i class="fas fa-check-circle mr-1"></i> Sí, Finalizar';
                const modalFinalizar = document.getElementById('modal-finalizar');
                if (modalFinalizar) modalFinalizar.classList.add('hidden');
            });
        });
    }

    function cerrarModalFinalizar() {
        const modalFinalizar = document.getElementById('modal-finalizar');
        if (modalFinalizar) modalFinalizar.classList.add('hidden');
    }
    window.cerrarModalFinalizar = cerrarModalFinalizar;

    // ============================================================
    // BOTÓN REINTEGRAR (deuda_detalle.html)
    // ============================================================
    if (btnReintegrar) {
        btnReintegrar.addEventListener('click', function() {
            const idSpan = document.getElementById('detalle-apartado-id');
            if (!idSpan) {
                alert('❌ No se pudo identificar el apartado.');
                return;
            }
            const id = idSpan.textContent.trim();
            if (!id) return;

            if (!confirm('⚠️ ¿Estás seguro de reintegrar este apartado?\n\nSe devolverá el stock al inventario y se eliminarán todos los abonos.\nEsta acción no se puede deshacer.')) {
                return;
            }

            this.disabled = true;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Reintegrando...';

            fetch(`/api/apartados/${id}/reintegrar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })
            .then(r => r.json())
            .then(result => {
                if (result.error) {
                    alert('❌ Error: ' + result.error);
                } else {
                    alert('✅ ' + result.mensaje);
                    window.location.href = '/admin/deudas';
                }
            })
            .catch(err => {
                alert('❌ Error al reintegrar el apartado.');
                console.error(err);
            })
            .finally(() => {
                this.disabled = false;
                this.innerHTML = '<i class="fas fa-undo mr-1"></i> Reintegrar';
            });
        });
    }

    // ============================================================
    // INICIALIZACIÓN
    // ============================================================
    function init() {
        obtenerTasas()
            .then(() => {
                const path = window.location.pathname;

                if (path === '/admin/deudas') {
                    cargarDeudas({ estado: 'activo' });
                } else if (path === '/admin/deudas/finalizadas') {
                    cargarDeudasFinalizadas({ estado: 'pagado' });
                } else if (path.includes('/admin/deudas/') && !path.includes('/crear') && !path.includes('/agregar-abono')) {
                    const match = path.match(/\/admin\/deudas\/(\d+)/);
                    if (match) {
                        const deudaId = match[1];
                        cargarDetalleDeuda(deudaId);
                    }
                }

                if (path === '/admin/deudas/crear') {
                    const hoy = new Date();
                    const defaultFecha = new Date(hoy.getFullYear(), hoy.getMonth() + 1, hoy.getDate());
                    if (crearInputFechaLimite) {
                        crearInputFechaLimite.value = defaultFecha.toISOString().split('T')[0];
                    }
                    // Inicializar pestaña VES
                    cambiarPestana('VES');
                    manejarMetodoCobroVes();
                    manejarMetodoCobroUsd();
                }

                if (modalAbono) {
                    if (modalAbonoTasaUsdDisplay) modalAbonoTasaUsdDisplay.textContent = tasaUsd.toFixed(2);
                    if (modalAbonoTasaEurDisplay) modalAbonoTasaEurDisplay.textContent = tasaEur.toFixed(2);
                }
            })
            .catch(err => console.error('Error en inicialización:', err));
    }

    // Cerrar sugerencias al hacer clic fuera
    document.addEventListener('click', function(e) {
        if (!e.target.closest('#deuda-cliente-buscar') && !e.target.closest('#sugerencias-clientes')) {
            if (sugerenciasClientes) sugerenciasClientes.classList.add('hidden');
        }
        if (!e.target.closest('#deuda-producto-buscar') && !e.target.closest('#sugerencias-productos')) {
            if (sugerenciasProductos) sugerenciasProductos.classList.add('hidden');
        }
    });

    init();

    // ============================================================
    // FUNCIONES EXPUESTAS GLOBALMENTE PARA ONCLICK
    // ============================================================
    window.cargarDeudas = cargarDeudas;
    window.cargarDeudasFinalizadas = cargarDeudasFinalizadas;
    window.cargarDetalleDeuda = cargarDetalleDeuda;
});