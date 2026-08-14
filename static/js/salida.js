document.addEventListener('DOMContentLoaded', function() {
    // ---------- VARIABLES GLOBALES ----------
    let carrito = [];
    let productoSeleccionado = null;
    let tasaUsd = 0;
    let tasaEur = 0;
    let tasaPersonalizada = 0;
    let tasaSeleccionada = 'usd';
    let numeroTicket = '00000';
    let factorAjuste = 1;
    let montoRecibido = 0;
    let montoUsdPersonalizado = 0;

    // Configuración del ticket
    let configTicket = {
        mostrarSubtotalUsd: true,
        mensaje: '¡Gracias por su compra!',
        url: 'www.elementsstore.com',
        ivaPorcentaje: 0,
        tiendaNombre: 'ELEMENTS STORE',
        rif: 'J-12345678-9',
        telefonoTienda: '0412-1234567',
        direccionTienda: 'Calle Principal, Local 1, Ciudad',
        mostrarRif: true,
        mostrarTelefono: true,
        mostrarDireccionCliente: true,
        mostrarDireccionTienda: true
    };

    // ---------- REFERENCIAS A ELEMENTOS ----------
    const inputNombre = document.getElementById('cliente-nombre');
    const inputApellido = document.getElementById('cliente-apellido');
    const inputCedula = document.getElementById('cliente-cedula');
    const inputTelefono = document.getElementById('cliente-telefono');
    const inputDireccion = document.getElementById('cliente-direccion');
    const inputBuscar = document.getElementById('buscar-producto');
    const sugerenciasDiv = document.getElementById('sugerencias-productos');
    const checkSerial = document.getElementById('buscar-por-serial');
    const inputSerial = document.getElementById('buscar-serial');
    const productoEncontrado = document.getElementById('producto-encontrado');
    const prodNombre = document.getElementById('prod-nombre');
    const prodStock = document.getElementById('prod-stock');
    const prodPrecio = document.getElementById('prod-precio');
    const prodSerialInfo = document.getElementById('prod-serial-info');
    const prodCantidad = document.getElementById('prod-cantidad');
    const btnAgregar = document.getElementById('btn-agregar-carrito');
    const btnBuscar = document.getElementById('btn-buscar-producto');
    const carritoItems = document.getElementById('carrito-items');
    const totalCarrito = document.getElementById('total-carrito');
    const metodoCobro = document.getElementById('metodo-cobro');
    const metodoPago = document.getElementById('metodo-pago');
    
    const bsPersonalizadoContainer = document.getElementById('bs-personalizado-container');
    const bsPersonalizadoInput = document.getElementById('bs-personalizado-input');
    const usdPersonalizadoContainer = document.getElementById('usd-personalizado-container');
    const usdPersonalizadoInput = document.getElementById('usd-personalizado-input');
    
    const equivalenteUsdContainer = document.getElementById('equivalente-usd-container');
    const equivalenteUsd = document.getElementById('equivalente-usd');
    const equivalenteVesContainer = document.getElementById('equivalente-ves-container');
    const equivalenteVes = document.getElementById('equivalente-ves');
    
    const btnProcesar = document.getElementById('btn-procesar-venta');
    const btnGenerarTicket = document.getElementById('btn-generar-ticket');
    const btnActualizarTasas = document.getElementById('btn-actualizar-tasas');
    const btnGenerarTicketFisico = document.getElementById('btn-generar-ticket-fisico');

    // ---------- REFERENCIAS AL TICKET ----------
    const ticketNumero = document.getElementById('ticket-numero');
    const ticketFecha = document.getElementById('ticket-fecha');
    const ticketCliente = document.getElementById('ticket-cliente');
    const ticketCedula = document.getElementById('ticket-cedula');
    const ticketTelefono = document.getElementById('ticket-telefono');
    const ticketDireccion = document.getElementById('ticket-direccion');
    const ticketItems = document.getElementById('ticket-items');
    const ticketSubtotal = document.getElementById('ticket-subtotal');
    const ticketIva = document.getElementById('ticket-iva');
    const ticketTotal = document.getElementById('ticket-total');
    const ticketMetodoPagoLabel = document.getElementById('ticket-metodo-pago-label');
    const ticketMontoPago = document.getElementById('ticket-monto-pago');
    const ticketMontoRecibido = document.getElementById('ticket-monto-recibido');
    const ticketCambio = document.getElementById('ticket-cambio');
    const ticketCajero = document.getElementById('ticket-cajero');

    const ticketTiendaNombre = document.getElementById('ticket-tienda-nombre');
    const ticketRif = document.getElementById('ticket-rif');
    const ticketTelefonoTienda = document.getElementById('ticket-telefono-tienda');
    const ticketDireccionTienda = document.getElementById('ticket-direccion-tienda');
    const ticketSubtotalUsdContainer = document.getElementById('ticket-subtotal-usd-container');
    const ticketSubtotalUsd = document.getElementById('ticket-subtotal-usd');
    const ticketSubtotalVes = document.getElementById('ticket-subtotal-ves');
    const ticketPago = document.getElementById('ticket-pago');
    const ticketMetodoCobroContainer = document.getElementById('ticket-metodo-cobro-container');
    const ticketMetodoCobro = document.getElementById('ticket-metodo-cobro');
    const ticketTasa = document.getElementById('ticket-tasa');
    const ticketMensaje = document.getElementById('ticket-mensaje');
    const ticketUrl = document.getElementById('ticket-url');

    // ---------- FUNCIÓN DE FORMATEO ----------
    function formatearMonto(monto) {
        if (monto === undefined || monto === null || isNaN(monto)) return '0,00';
        let montoStr = monto.toFixed(2);
        let partes = montoStr.split('.');
        let enteros = partes[0];
        let decimales = partes[1];
        let enterosFormateados = enteros.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return `${enterosFormateados},${decimales}`;
    }

    function parseMontoVES(valorFormateado) {
        let limpio = valorFormateado.replace(/\./g, '').replace(',', '.');
        return parseFloat(limpio) || 0;
    }

    function formatearCampoBs(input) {
        let valor = input.value;
        valor = valor.replace(/[^0-9,.]/g, '');
        let numero = parseFloat(valor.replace(',', '.')) || 0;
        input.value = formatearMonto(numero);
    }

    function formatearCampoUsd(input) {
        let valor = input.value;
        valor = valor.replace(/[^0-9,.]/g, '');
        let numero = parseFloat(valor.replace(',', '.')) || 0;
        input.value = numero.toFixed(2);
    }

    // ---------- EVENTOS DE INPUT ----------
    bsPersonalizadoInput.addEventListener('blur', function() {
        if (this.value.trim() !== '') {
            formatearCampoBs(this);
            this.dispatchEvent(new Event('input'));
        }
    });

    bsPersonalizadoInput.addEventListener('input', function() {
        recalcularFactorAjuste();
        renderCarrito();
        actualizarTicket();
        actualizarEquivalenteUsd();
        guardarEstado();
    });

    usdPersonalizadoInput.addEventListener('blur', function() {
        if (this.value.trim() !== '') {
            formatearCampoUsd(this);
            this.dispatchEvent(new Event('input'));
        }
    });

    usdPersonalizadoInput.addEventListener('input', function() {
        montoUsdPersonalizado = parseFloat(this.value) || 0;
        recalcularFactorAjuste();
        renderCarrito();
        actualizarTicket();
        actualizarEquivalenteVes();
        guardarEstado();
    });

    // ---------- FUNCIONES DE INICIALIZACIÓN ----------
    function cargarConfiguracionTicket() {
        fetch('/api/config/ticket')
            .then(r => r.json())
            .then(data => {
                configTicket.mostrarSubtotalUsd = data.ticket_subtotal_usd !== 'false';
                configTicket.mensaje = data.ticket_mensaje || '¡Gracias por su compra!';
                configTicket.url = data.ticket_url || 'www.elementsstore.com';
                configTicket.ivaPorcentaje = parseFloat(data.ticket_iva_porcentaje) || 0;
                configTicket.tiendaNombre = data.ticket_tienda_nombre || 'ELEMENTS STORE';
                configTicket.rif = data.ticket_rif || 'J-12345678-9';
                configTicket.telefonoTienda = data.ticket_telefono_tienda || '0412-1234567';
                configTicket.direccionTienda = data.ticket_direccion_tienda || 'Calle Principal, Local 1, Ciudad';
                configTicket.mostrarRif = data.ticket_mostrar_rif !== 'false';
                configTicket.mostrarTelefono = data.ticket_mostrar_telefono !== 'false';
                configTicket.mostrarDireccionCliente = data.ticket_mostrar_direccion_cliente !== 'false';
                configTicket.mostrarDireccionTienda = data.ticket_mostrar_direccion_tienda !== 'false';

                actualizarConfigTicket();
                actualizarTicket();
            })
            .catch(err => console.error('Error cargando configuración del ticket:', err));
    }

    function actualizarConfigTicket() {
        if (ticketTiendaNombre) ticketTiendaNombre.textContent = configTicket.tiendaNombre;
        if (ticketRif) {
            if (configTicket.mostrarRif) {
                ticketRif.style.display = 'block';
                ticketRif.textContent = `RIF: ${configTicket.rif}`;
            } else {
                ticketRif.style.display = 'none';
            }
        }
        if (ticketTelefonoTienda) {
            if (configTicket.mostrarTelefono) {
                ticketTelefonoTienda.style.display = 'block';
                ticketTelefonoTienda.textContent = `Tel: ${configTicket.telefonoTienda}`;
            } else {
                ticketTelefonoTienda.style.display = 'none';
            }
        }
        if (ticketDireccionTienda) {
            if (configTicket.mostrarDireccionTienda) {
                ticketDireccionTienda.style.display = 'block';
                ticketDireccionTienda.textContent = `Dir: ${configTicket.direccionTienda}`;
            } else {
                ticketDireccionTienda.style.display = 'none';
            }
        }
        if (ticketMensaje) ticketMensaje.textContent = configTicket.mensaje;
        if (ticketUrl) ticketUrl.textContent = configTicket.url;
    }

    function obtenerTasas() {
        return fetch('/api/tasas')
            .then(r => r.json())
            .then(data => {
                tasaUsd = data.bcv_usd;
                tasaEur = data.bcv_eur;
                tasaPersonalizada = data.personalizada;
                actualizarTicket();
                actualizarEquivalenteUsd();
                actualizarEquivalenteVes();
                return data;
            })
            .catch(err => {
                console.error('Error obteniendo tasas:', err);
                throw err;
            });
    }

    function inicializarFecha() {
        const hoy = new Date();
        const fechaStr = hoy.toLocaleString('es-VE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        if (ticketFecha) ticketFecha.textContent = fechaStr;
    }

    // ---------- AUTOCOMPLETADO DE PRODUCTOS ----------
    function buscarProductos(query) {
        if (query.length < 1) {
            sugerenciasDiv.classList.add('hidden');
            return;
        }
        fetch(`/api/productos/buscar?q=${encodeURIComponent(query)}`)
            .then(r => r.json())
            .then(data => {
                mostrarSugerencias(data);
            })
            .catch(err => console.error('Error buscando productos:', err));
    }

    function mostrarSugerencias(productos) {
        sugerenciasDiv.innerHTML = '';
        if (productos.length === 0) {
            sugerenciasDiv.innerHTML = '<div class="px-4 py-2 text-sm text-gray-400">No se encontraron productos</div>';
            sugerenciasDiv.classList.remove('hidden');
            return;
        }
        productos.forEach(p => {
            const div = document.createElement('div');
            div.className = 'px-4 py-2 hover:bg-indigo-50 cursor-pointer text-sm border-b border-gray-100 flex justify-between';
            div.innerHTML = `
                <span>${p.nombre}</span>
                <span class="text-xs text-gray-400">Stock: ${p.stock} | $${formatearMonto(p.precio_usd)}</span>
            `;
            div.dataset.id = p.id;
            div.addEventListener('click', function() {
                seleccionarProducto(p);
                sugerenciasDiv.classList.add('hidden');
            });
            sugerenciasDiv.appendChild(div);
        });
        sugerenciasDiv.classList.remove('hidden');
    }

    function seleccionarProducto(producto) {
        productoSeleccionado = producto;
        prodNombre.textContent = producto.nombre;
        prodStock.textContent = producto.stock;
        prodPrecio.textContent = formatearMonto(producto.precio_usd);
        prodSerialInfo.textContent = producto.control_serial ? `Serial: ${producto.serial_number || 'No asignado'}` : 'Sin serial';
        prodCantidad.value = 1;
        productoEncontrado.classList.remove('hidden');
        inputBuscar.value = producto.nombre;
    }

    // ---------- BUSCAR POR SERIAL ----------
    checkSerial.addEventListener('change', function() {
        if (this.checked) {
            inputSerial.classList.remove('hidden');
            inputBuscar.disabled = true;
            inputSerial.focus();
        } else {
            inputSerial.classList.add('hidden');
            inputBuscar.disabled = false;
            inputBuscar.focus();
        }
    });

    inputSerial.addEventListener('input', function() {
        const serial = this.value.trim();
        if (serial.length < 2) return;
        fetch(`/api/productos/buscar?serial=${encodeURIComponent(serial)}`)
            .then(r => r.json())
            .then(data => {
                if (data.length > 0) {
                    seleccionarProducto(data[0]);
                } else {
                    productoEncontrado.classList.add('hidden');
                }
            })
            .catch(err => console.error('Error buscando por serial:', err));
    });

    // ---------- BUSCAR PRODUCTO ----------
    inputBuscar.addEventListener('input', function() {
        const query = this.value.trim();
        if (query.length === 0) {
            sugerenciasDiv.classList.add('hidden');
            productoEncontrado.classList.add('hidden');
            return;
        }
        buscarProductos(query);
    });

    inputBuscar.addEventListener('focus', function() {
        if (this.value.trim().length > 0) {
            buscarProductos(this.value.trim());
        }
    });

    btnBuscar.addEventListener('click', function() {
        const query = inputBuscar.value.trim();
        if (query.length > 0) {
            buscarProductos(query);
        }
    });

    document.addEventListener('click', function(e) {
        if (!e.target.closest('#buscar-producto') && !e.target.closest('#sugerencias-productos')) {
            sugerenciasDiv.classList.add('hidden');
        }
    });

    // ---------- AGREGAR AL CARRITO ----------
    btnAgregar.addEventListener('click', function() {
        if (!productoSeleccionado) {
            alert('Primero seleccione un producto');
            return;
        }
        const cantidad = parseInt(prodCantidad.value) || 1;
        if (cantidad > productoSeleccionado.stock) {
            alert(`Stock insuficiente. Disponible: ${productoSeleccionado.stock}`);
            return;
        }
        agregarItemCarrito(productoSeleccionado, cantidad);
        productoEncontrado.classList.add('hidden');
        inputBuscar.value = '';
        inputBuscar.focus();
    });

    function agregarItemCarrito(producto, cantidad) {
        const existente = carrito.find(item => item.id === producto.id);
        if (existente) {
            existente.cantidad += cantidad;
        } else {
            carrito.push({
                id: producto.id,
                nombre: producto.nombre,
                precio: producto.precio_usd,
                cantidad: cantidad,
                control_serial: producto.control_serial,
                serial_number: producto.serial_number || '',
                descuento: 0,
                ofertaActiva: false
            });
        }
        recalcularFactorAjuste();
        renderCarrito();
        actualizarTicket();
        guardarEstado();
    }

    function eliminarItemCarrito(index) {
        carrito.splice(index, 1);
        recalcularFactorAjuste();
        renderCarrito();
        actualizarTicket();
        guardarEstado();
    }

    // ---------- CALCULAR PRECIO CON DESCUENTO ----------
    function getPrecioConDescuento(item, precioBaseOverride) {
        if (!item) return 0;
        const descuento = item.descuento || 0;
        const base = precioBaseOverride !== undefined ? precioBaseOverride : item.precio;
        return base * (1 - descuento / 100);
    }

    // ---------- RECALCULAR FACTOR DE AJUSTE ----------
    function recalcularFactorAjuste() {
        if (carrito.length === 0) {
            factorAjuste = 1;
            return;
        }

        // Para bs_personalizado, el precio base en USD es montoBs / tasaUsd
        let precioBaseUsd = null;
        if (tasaSeleccionada === 'bs_personalizado') {
            const montoBs = parseMontoVES(bsPersonalizadoInput.value) || 0;
            if (montoBs > 0 && tasaUsd > 0) {
                precioBaseUsd = montoBs / tasaUsd;
            }
        }

        let subtotalUsdOriginal = 0;
        if (precioBaseUsd !== null && precioBaseUsd > 0) {
            // Usar precio base personalizado para todos los productos
            carrito.forEach(item => {
                const precioConDesc = getPrecioConDescuento(item, precioBaseUsd);
                subtotalUsdOriginal += precioConDesc * item.cantidad;
            });
        } else {
            // Comportamiento normal
            carrito.forEach(item => {
                const precioConDesc = getPrecioConDescuento(item);
                subtotalUsdOriginal += precioConDesc * item.cantidad;
            });
        }

        let subtotalUsdAjustado = subtotalUsdOriginal;

        if (tasaSeleccionada === 'personalizada') {
            const totalBs = subtotalUsdOriginal * tasaPersonalizada;
            subtotalUsdAjustado = totalBs / tasaUsd;
            factorAjuste = subtotalUsdAjustado / subtotalUsdOriginal;
        } else if (tasaSeleccionada === 'bs_personalizado') {
            // Ya tenemos el precio base personalizado, no se necesita factor extra
            factorAjuste = 1;
        } else if (tasaSeleccionada === 'usd_personalizado') {
            factorAjuste = 1;
        } else if (tasaSeleccionada === 'bcv_eur') {
            if (tasaUsd > 0 && tasaEur > 0) {
                factorAjuste = tasaEur / tasaUsd;
            } else {
                factorAjuste = 1;
            }
        } else {
            factorAjuste = 1;
        }
        sessionStorage.setItem('factorAjuste', factorAjuste);
    }

    // ---------- RENDERIZAR CARRITO ----------
    function renderCarrito() {
        carritoItems.innerHTML = '';
        if (carrito.length === 0) {
            carritoItems.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-gray-400">Carrito vacío</td></tr>';
            totalCarrito.textContent = '$0,00';
            return;
        }

        let total = 0;
        // Para bs_personalizado: precio base en USD = montoBs / tasaUsd
        let precioBaseUsd = null;
        if (tasaSeleccionada === 'bs_personalizado') {
            const montoBs = parseMontoVES(bsPersonalizadoInput.value) || 0;
            if (montoBs > 0 && tasaUsd > 0) {
                precioBaseUsd = montoBs / tasaUsd;
            }
        }
        // Para usd_personalizado: precio base = montoUsdPersonalizado
        const usarPrecioUsdPersonalizado = (tasaSeleccionada === 'usd_personalizado') && montoUsdPersonalizado > 0;

        carrito.forEach((item, index) => {
            let precioBase = item.precio;
            if (precioBaseUsd !== null && precioBaseUsd > 0) {
                precioBase = precioBaseUsd;
            } else if (usarPrecioUsdPersonalizado) {
                precioBase = montoUsdPersonalizado;
            }
            const precioConDesc = precioBase * (1 - (item.descuento || 0) / 100);
            const precioEfectivo = Number((precioConDesc * factorAjuste).toFixed(2));
            const subtotal = Number((precioEfectivo * item.cantidad).toFixed(2));
            total += subtotal;

            const tr = document.createElement('tr');
            tr.className = 'border-b border-gray-100';
            tr.innerHTML = `
                <td class="py-2">${item.nombre}</td>
                <td class="text-center">
                    <input type="number" class="cantidad-item w-16 input-field text-center" value="${item.cantidad}" min="1" data-index="${index}">
                </td>
                <td class="text-right">$${formatearMonto(precioBase)}</td>
                <td class="text-center" style="padding-left: 8px;">
                    <input type="checkbox" class="oferta-checkbox" data-index="${index}" ${item.ofertaActiva ? 'checked' : ''}>
                </td>
                <td class="text-center">
                    <input type="text" inputmode="numeric" class="descuento-input w-16 input-field text-center" value="${item.descuento}" data-index="${index}" ${item.ofertaActiva ? '' : 'disabled'}>
                </td>
                <td class="text-right">$${formatearMonto(subtotal)}</td>
                <td class="text-right">
                    <button class="btn-eliminar text-red-500 hover:text-red-700" data-index="${index}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            carritoItems.appendChild(tr);
        });

        totalCarrito.textContent = `$${formatearMonto(total)}`;

        // Eventos...
        document.querySelectorAll('.cantidad-item').forEach(input => {
            input.addEventListener('input', function() {
                const index = parseInt(this.dataset.index);
                let nuevaCant = parseInt(this.value) || 1;
                if (nuevaCant < 1) nuevaCant = 1;
                carrito[index].cantidad = nuevaCant;
                recalcularFactorAjuste();
                renderCarrito();
                actualizarTicket();
                guardarEstado();
            });
        });

        document.querySelectorAll('.oferta-checkbox').forEach(chk => {
            chk.addEventListener('input', function() {
                const index = parseInt(this.dataset.index);
                const estaActiva = this.checked;
                carrito[index].ofertaActiva = estaActiva;
                if (!estaActiva) {
                    carrito[index].descuento = 0;
                }
                renderCarrito();
                recalcularFactorAjuste();
                actualizarTicket();
                guardarEstado();
            });
        });

        document.querySelectorAll('.descuento-input').forEach(input => {
            input.addEventListener('input', function() {
                const index = parseInt(this.dataset.index);
                let valor = parseFloat(this.value) || 0;
                if (valor < 0) valor = 0;
                if (valor > 100) valor = 100;
                carrito[index].descuento = valor;
                if (valor > 0 && !carrito[index].ofertaActiva) {
                    carrito[index].ofertaActiva = true;
                    const chk = this.closest('tr').querySelector('.oferta-checkbox');
                    if (chk) chk.checked = true;
                }
                actualizarTicket();
                guardarEstado();
            });

            input.addEventListener('blur', function() {
                let valor = parseFloat(this.value) || 0;
                if (valor < 0) valor = 0;
                if (valor > 100) valor = 100;
                this.value = valor;
                const index = parseInt(this.dataset.index);
                carrito[index].descuento = valor;
                renderCarrito();
                recalcularFactorAjuste();
                actualizarTicket();
                guardarEstado();
            });
        });

        document.querySelectorAll('.btn-eliminar').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.dataset.index);
                eliminarItemCarrito(index);
            });
        });
    }

    // ---------- MÉTODO DE COBRO ----------
    metodoCobro.addEventListener('change', function() {
        tasaSeleccionada = this.value;
        bsPersonalizadoContainer.classList.add('hidden');
        usdPersonalizadoContainer.classList.add('hidden');
        equivalenteUsdContainer.classList.add('hidden');
        equivalenteVesContainer.classList.add('hidden');

        if (this.value === 'bs_personalizado') {
            bsPersonalizadoContainer.classList.remove('hidden');
            if (bsPersonalizadoInput.value.trim() !== '') {
                formatearCampoBs(bsPersonalizadoInput);
            }
        } else if (this.value === 'usd_personalizado') {
            usdPersonalizadoContainer.classList.remove('hidden');
            if (usdPersonalizadoInput.value.trim() !== '') {
                formatearCampoUsd(usdPersonalizadoInput);
                montoUsdPersonalizado = parseFloat(usdPersonalizadoInput.value) || 0;
            } else {
                montoUsdPersonalizado = 0;
            }
        } else {
            montoUsdPersonalizado = 0;
        }
        recalcularFactorAjuste();
        renderCarrito();
        actualizarTicket();
        actualizarEquivalenteUsd();
        actualizarEquivalenteVes();
        guardarEstado();
    });

    // ---------- EQUIVALENTES ----------
    function actualizarEquivalenteUsd() {
        const mostrar = tasaSeleccionada === 'personalizada' || tasaSeleccionada === 'bs_personalizado';
        if (mostrar) {
            equivalenteUsdContainer.classList.remove('hidden');
            let subtotalUsd = 0;
            // Calcular con las mismas reglas
            let precioBaseUsd = null;
            if (tasaSeleccionada === 'bs_personalizado') {
                const montoBs = parseMontoVES(bsPersonalizadoInput.value) || 0;
                if (montoBs > 0 && tasaUsd > 0) {
                    precioBaseUsd = montoBs / tasaUsd;
                }
            }
            carrito.forEach(item => {
                const base = precioBaseUsd !== null ? precioBaseUsd : item.precio;
                const precioConDesc = getPrecioConDescuento(item, base);
                subtotalUsd += precioConDesc * item.cantidad;
            });
            let totalMostrar = 0;
            if (tasaSeleccionada === 'personalizada') {
                totalMostrar = subtotalUsd * tasaPersonalizada / tasaUsd;
            } else if (tasaSeleccionada === 'bs_personalizado') {
                totalMostrar = subtotalUsd;
            }
            equivalenteUsd.textContent = `$${formatearMonto(totalMostrar)}`;
        } else {
            equivalenteUsdContainer.classList.add('hidden');
        }
    }

    function actualizarEquivalenteVes() {
        const mostrar = tasaSeleccionada === 'usd_personalizado';
        if (mostrar) {
            equivalenteVesContainer.classList.remove('hidden');
            const montoUsd = parseFloat(usdPersonalizadoInput.value) || 0;
            const equivalenteVesMonto = montoUsd * tasaUsd;
            equivalenteVes.textContent = `Bs ${formatearMonto(equivalenteVesMonto)}`;
        } else {
            equivalenteVesContainer.classList.add('hidden');
        }
    }

    // ---------- CONTROL DE VISIBILIDAD DEL SUBTOTAL ----------
    function controlarVisibilidadSubtotal() {
        if (ticketSubtotalUsdContainer) {
            if (configTicket.mostrarSubtotalUsd) {
                ticketSubtotalUsdContainer.style.display = 'flex';
            } else {
                ticketSubtotalUsdContainer.style.display = 'none';
            }
        }
    }

    // ============================================================
    // 🔥 FUNCIÓN ACTUALIZAR TICKET (CORREGIDA DEFINITIVA)
    // ============================================================
    function actualizarTicket() {
        controlarVisibilidadSubtotal();

        if (ticketNumero) ticketNumero.textContent = numeroTicket;
        inicializarFecha();
        if (ticketCajero) ticketCajero.textContent = 'Jhoan Villazar';

        const clienteNombre = `${inputNombre.value} ${inputApellido.value}`.trim() || 'Consumidor Final';
        if (ticketCliente) ticketCliente.textContent = clienteNombre;
        if (ticketCedula) ticketCedula.textContent = inputCedula.value || '-';
        if (ticketTelefono) ticketTelefono.textContent = inputTelefono.value || '-';
        if (ticketDireccion) {
            ticketDireccion.textContent = inputDireccion.value || '-';
            ticketDireccion.style.display = configTicket.mostrarDireccionCliente ? 'block' : 'none';
        }

        // ---------- CALCULAR SUBTOTAL EN USD CON DESCUENTOS Y PRECIO BASE PERSONALIZADO ----------
        let subtotalUsd = 0;
        // Precio base para bs_personalizado
        let precioBaseUsd = null;
        if (tasaSeleccionada === 'bs_personalizado') {
            const montoBs = parseMontoVES(bsPersonalizadoInput.value) || 0;
            if (montoBs > 0 && tasaUsd > 0) {
                precioBaseUsd = montoBs / tasaUsd;
            }
        }
        const usarPrecioUsdPersonalizado = (tasaSeleccionada === 'usd_personalizado') && montoUsdPersonalizado > 0;

        carrito.forEach(item => {
            let precioBase = item.precio;
            if (precioBaseUsd !== null && precioBaseUsd > 0) {
                precioBase = precioBaseUsd;
            } else if (usarPrecioUsdPersonalizado) {
                precioBase = montoUsdPersonalizado;
            }
            const precioConDesc = precioBase * (1 - (item.descuento || 0) / 100);
            const precioEfectivo = Number((precioConDesc * factorAjuste).toFixed(2));
            const subtotalItem = Number((precioEfectivo * item.cantidad).toFixed(2));
            subtotalUsd += subtotalItem;
        });
        subtotalUsd = Number(subtotalUsd.toFixed(2));

        // ---------- CALCULAR TOTAL EN VES Y TOTAL FINAL SEGÚN MÉTODO DE COBRO ----------
        let subtotalVes = 0;
        let totalMostrar = 0;
        let simbolo = '$';
        let tasaAplicada = tasaUsd;

        switch(tasaSeleccionada) {
            case 'usd':
                subtotalVes = subtotalUsd * tasaUsd;
                totalMostrar = subtotalUsd;
                simbolo = '$';
                tasaAplicada = tasaUsd;
                break;
            case 'bcv_usd':
                subtotalVes = subtotalUsd * tasaUsd;
                totalMostrar = subtotalUsd * tasaUsd;
                simbolo = 'Bs ';
                tasaAplicada = tasaUsd;
                break;
            case 'bcv_eur':
                subtotalVes = subtotalUsd * tasaEur;
                totalMostrar = subtotalUsd * tasaEur;
                simbolo = 'Bs ';
                tasaAplicada = tasaEur;
                break;
            case 'personalizada':
                // ✅ CORRECCIÓN: Subtotal VES con tasa BCV, TOTAL = Subtotal VES (más IVA si aplica)
                subtotalVes = subtotalUsd * tasaUsd;
                totalMostrar = subtotalVes;               // ¡Ahora el TOTAL es el equivalente BCV!
                simbolo = 'Bs ';
                tasaAplicada = tasaUsd;                   // Mostrar la tasa BCV, no la personalizada
                break;
            case 'bs_personalizado':
                // ✅ CORRECTO: El total en Bs = subtotalUsd * tasaUsd (con descuentos aplicados)
                subtotalVes = subtotalUsd * tasaUsd;
                totalMostrar = subtotalUsd * tasaUsd;
                simbolo = 'Bs ';
                tasaAplicada = tasaUsd;
                break;
            case 'usd_personalizado':
                subtotalVes = subtotalUsd * tasaUsd;
                totalMostrar = subtotalUsd;
                simbolo = '$';
                tasaAplicada = tasaUsd;
                break;
        }

        // ---------- RENDERIZAR ITEMS DEL TICKET ----------
        const tbody = ticketItems;
        if (tbody) {
            tbody.innerHTML = '';
            if (carrito.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" class="text-center py-2 text-gray-400">Sin productos</td></tr>`;
                if (ticketSubtotal) ticketSubtotal.textContent = '$0,00';
                if (ticketIva) ticketIva.textContent = '$0,00';
                if (ticketTotal) ticketTotal.textContent = '$0,00';
                if (ticketMontoPago) ticketMontoPago.textContent = '$0,00';
                if (ticketMontoRecibido) ticketMontoRecibido.textContent = '$0,00';
                if (ticketCambio) ticketCambio.textContent = '$0,00';
                controlarVisibilidadSubtotal();
                if (ticketTasa && tasaSeleccionada === 'usd') {
                    ticketTasa.style.display = 'none';
                } else if (ticketTasa) {
                    ticketTasa.style.display = 'inline';
                }
                const ivaElement = document.getElementById('ticket-iva-ves');
                if (ivaElement) ivaElement.style.display = 'none';
                return;
            }

            let subtotalUsdDisplay = 0;
            carrito.forEach(item => {
                let precioBase = item.precio;
                if (precioBaseUsd !== null && precioBaseUsd > 0) {
                    precioBase = precioBaseUsd;
                } else if (usarPrecioUsdPersonalizado) {
                    precioBase = montoUsdPersonalizado;
                }
                const precioConDesc = precioBase * (1 - (item.descuento || 0) / 100);
                const precioEfectivo = Number((precioConDesc * factorAjuste).toFixed(2));
                const subtotalItem = Number((precioEfectivo * item.cantidad).toFixed(2));
                subtotalUsdDisplay += subtotalItem;

                const tr = document.createElement('tr');
                let nombreConOferta = item.nombre;
                if (item.descuento > 0) {
                    nombreConOferta += ` (${item.descuento}% off)`;
                }
                tr.innerHTML = `
                    <td class="text-left py-1">${nombreConOferta}</td>
                    <td class="text-center py-1">${item.cantidad}</td>
                    <td class="text-right py-1">$${formatearMonto(precioEfectivo)}</td>
                    <td class="text-right py-1">$${formatearMonto(subtotalItem)}</td>
                `;
                tbody.appendChild(tr);
            });
            subtotalUsdDisplay = Number(subtotalUsdDisplay.toFixed(2));

            // IVA
            const ivaPorcentaje = configTicket.ivaPorcentaje || 0;
            const ivaMonto = Number((subtotalUsdDisplay * (ivaPorcentaje / 100)).toFixed(2));
            const totalConIva = Number((subtotalUsdDisplay + ivaMonto).toFixed(2));

            if (ticketSubtotalUsd) ticketSubtotalUsd.textContent = `$${formatearMonto(subtotalUsdDisplay)}`;
            if (ticketSubtotalVes) ticketSubtotalVes.textContent = `Bs ${formatearMonto(subtotalVes)}`;
            if (ticketIva) ticketIva.textContent = `$${formatearMonto(ivaMonto)}`;
            if (simbolo === '$') {
                if (ticketTotal) ticketTotal.textContent = `$${formatearMonto(totalMostrar)}`;
            } else {
                if (ticketTotal) ticketTotal.textContent = `Bs ${formatearMonto(totalMostrar)}`;
            }

            // Monto recibido y cambio
            const metodoPagoTexto = metodoPago.options[metodoPago.selectedIndex].text;
            if (ticketMetodoPagoLabel) ticketMetodoPagoLabel.textContent = `${metodoPagoTexto}:`;
            if (ticketMontoPago) ticketMontoPago.textContent = (simbolo === '$') ? `$${formatearMonto(totalMostrar)}` : `Bs ${formatearMonto(totalMostrar)}`;
            if (montoRecibido === 0) {
                montoRecibido = totalMostrar;
            }
            if (ticketMontoRecibido) ticketMontoRecibido.textContent = (simbolo === '$') ? `$${formatearMonto(montoRecibido)}` : `Bs ${formatearMonto(montoRecibido)}`;
            const cambio = Math.max(0, montoRecibido - totalMostrar);
            if (ticketCambio) ticketCambio.textContent = (simbolo === '$') ? `$${formatearMonto(cambio)}` : `Bs ${formatearMonto(cambio)}`;
        }

        // ---------- MÉTODO DE COBRO Y TASA ----------
        if (ticketPago) ticketPago.textContent = metodoPago.options[metodoPago.selectedIndex].text;

        const ocultarCobro = tasaSeleccionada === 'personalizada' || tasaSeleccionada === 'bs_personalizado' || tasaSeleccionada === 'usd_personalizado';
        if (ticketMetodoCobroContainer) {
            if (ocultarCobro) {
                ticketMetodoCobroContainer.style.display = 'none';
            } else {
                ticketMetodoCobroContainer.style.display = 'block';
                let metodoCobroTexto = metodoCobro.options[metodoCobro.selectedIndex].text;
                if (ticketMetodoCobro) ticketMetodoCobro.textContent = metodoCobroTexto;

                let tasaTexto = '-';
                if (tasaSeleccionada === 'usd') {
                    if (ticketTasa) ticketTasa.style.display = 'none';
                } else {
                    if (ticketTasa) {
                        ticketTasa.style.display = 'inline';
                        switch(tasaSeleccionada) {
                            case 'bcv_usd': tasaTexto = `${formatearMonto(tasaUsd)} (BCV USD)`; break;
                            case 'bcv_eur': tasaTexto = `${formatearMonto(tasaEur)} (BCV EUR)`; break;
                            case 'personalizada': tasaTexto = `${formatearMonto(tasaPersonalizada)} (Personalizada)`; break;
                            default: tasaTexto = '-';
                        }
                        ticketTasa.textContent = tasaTexto;
                    }
                }
            }
        }

        // ---------- LÍNEA DE IVA EN VES (si aplica) ----------
        const ivaPorcentaje = configTicket.ivaPorcentaje || 0;
        const esMetodoVes = tasaSeleccionada !== 'usd' && tasaSeleccionada !== 'usd_personalizado';
        let totalContainer = document.querySelector('.border-b-2.border-black.pb-2.mb-2');
        if (!totalContainer) {
            totalContainer = document.querySelector('.ticket-totales') || 
                             document.querySelector('#ticket-virtual > div:nth-child(4)');
        }
        if (totalContainer) {
            let ivaElement = document.getElementById('ticket-iva-ves');
            if (!ivaElement) {
                ivaElement = document.createElement('div');
                ivaElement.id = 'ticket-iva-ves';
                ivaElement.className = 'flex justify-between';
                const totalDivs = totalContainer.querySelectorAll('.flex.justify-between');
                let lastTotalDiv = null;
                for (let div of totalDivs) {
                    if (div.textContent.includes('TOTAL')) {
                        lastTotalDiv = div;
                        break;
                    }
                }
                if (lastTotalDiv && lastTotalDiv.parentNode === totalContainer) {
                    totalContainer.insertBefore(ivaElement, lastTotalDiv);
                } else {
                    totalContainer.appendChild(ivaElement);
                }
            }
            if (ivaPorcentaje > 0 && esMetodoVes) {
                const ivaVes = subtotalVes * (ivaPorcentaje / 100);
                ivaElement.style.display = 'flex';
                ivaElement.innerHTML = `<span>IVA (${ivaPorcentaje}%):</span><span>Bs ${formatearMonto(ivaVes)}</span>`;
            } else {
                ivaElement.style.display = 'none';
            }
        }

        controlarVisibilidadSubtotal();
    }

    // ---------- FUNCIÓN AUXILIAR PARA LIMPIAR VENTA ----------
    function limpiarVenta() {
        carrito = [];
        factorAjuste = 1;
        montoUsdPersonalizado = 0;
        sessionStorage.removeItem('factorAjuste');
        renderCarrito();
        actualizarTicket();
        productoEncontrado.classList.add('hidden');
        inputBuscar.value = '';
        bsPersonalizadoInput.value = '';
        usdPersonalizadoInput.value = '';
        inputNombre.value = '';
        inputApellido.value = '';
        inputCedula.value = '';
        inputTelefono.value = '';
        inputDireccion.value = '';
        sessionStorage.removeItem('venta_estado');
        guardarEstado();
    }

    // ---------- FUNCIÓN PARA VERIFICAR IMPRESORA CONFIGURADA ----------
    function verificarImpresoraConfigurada() {
        return fetch('/api/impresora/config')
            .then(r => r.json())
            .then(data => {
                return data && data.nombre_impresora && data.nombre_impresora.trim() !== '';
            })
            .catch(() => false);
    }

    // ============================================================
    // 🔥 FUNCIÓN PARA OBTENER DATOS DEL CLIENTE
    // ============================================================
    function obtenerDatosCliente() {
        return {
            nombre: inputNombre.value.trim(),
            apellido: inputApellido.value.trim(),
            cedula: inputCedula.value.trim(),
            telefono: inputTelefono.value.trim(),
            direccion: inputDireccion.value.trim()
        };
    }

    // ============================================================
    // 🔥 FUNCIÓN MEJORADA PARA ABRIR EL TICKET HTML (window.print)
    // ============================================================
    function imprimirNotaEntrega(ventaId) {
        if (!ventaId) {
            console.warn('No se proporcionó ventaId para imprimir nota de entrega');
            return;
        }
        const url = `/ventas/ticket/${ventaId}`;
        const ventana = window.open(
            url,
            '_blank',
            'width=400,height=600,location=no,menubar=no,toolbar=no,scrollbars=no,resizable=yes'
        );
        if (ventana) {
            ventana.focus();
            console.info('📄 Para obtener la mejor calidad, en el diálogo de impresión:');
            console.info('   - Desactive "Encabezados y pies de página"');
            console.info('   - Ajuste los márgenes a "Ninguno"');
        } else {
            window.location.href = url;
        }
    }

    // ---------- PROCESAR VENTA (FUNCIÓN REUTILIZABLE) ----------
    function procesarVenta(clienteId, clienteData) {
        const items = carrito.map(item => ({
            producto_id: item.id,
            cantidad: item.cantidad,
            descuento_porcentaje: item.descuento || 0
        }));

        const data = {
            cliente_id: clienteId,
            items: items,
            metodo_pago: metodoPago.value,
            metodo_cobro: tasaSeleccionada
        };

        if (clienteData) {
            data.cliente_nombre = clienteData.nombre;
            data.cliente_apellido = clienteData.apellido;
            data.cliente_cedula = clienteData.cedula;
            data.cliente_telefono = clienteData.telefono;
            data.cliente_direccion = clienteData.direccion;
        }

        if (tasaSeleccionada === 'bs_personalizado') {
            // Calcular total en Bs con descuentos aplicados
            let precioBaseUsd = null;
            const montoBs = parseMontoVES(bsPersonalizadoInput.value) || 0;
            if (montoBs > 0 && tasaUsd > 0) {
                precioBaseUsd = montoBs / tasaUsd;
            }
            let totalUsd = 0;
            carrito.forEach(item => {
                const base = precioBaseUsd !== null ? precioBaseUsd : item.precio;
                const precioConDesc = base * (1 - (item.descuento || 0) / 100);
                totalUsd += precioConDesc * item.cantidad;
            });
            data.total_cobro = totalUsd * tasaUsd;
        } else if (tasaSeleccionada === 'usd_personalizado') {
            let total = 0;
            carrito.forEach(item => {
                let precioBase = montoUsdPersonalizado;
                const precioConDesc = precioBase * (1 - (item.descuento || 0) / 100);
                total += precioConDesc * item.cantidad;
            });
            data.total_cobro = total;
        }

        return fetch('/api/ventas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        .then(r => {
            if (!r.ok) {
                return r.json().then(err => { throw new Error(err.error || 'Error en el servidor'); });
            }
            return r.json();
        })
        .then(res => {
            if (!res.venta_id) throw new Error('No se pudo registrar la venta');
            if (res.numero_ticket) {
                numeroTicket = String(res.numero_ticket).padStart(5, '0');
                if (ticketNumero) ticketNumero.textContent = numeroTicket;
            }
            return res;
        });
    }

    // ---------- BOTÓN "PROCESAR VENTA" ----------
    btnProcesar.addEventListener('click', function() {
        const clienteData = obtenerDatosCliente();
        if (!clienteData.nombre || !clienteData.apellido || !clienteData.cedula) {
            alert('Nombre, apellido y cédula son obligatorios');
            return;
        }

        if (carrito.length === 0) {
            alert('El carrito está vacío');
            return;
        }

        if (tasaSeleccionada === 'bs_personalizado') {
            const montoBs = parseMontoVES(bsPersonalizadoInput.value) || 0;
            if (montoBs <= 0) {
                alert('Ingrese un monto en Bs para el método de cobro personalizado');
                return;
            }
        }

        if (tasaSeleccionada === 'usd_personalizado') {
            const montoUsd = parseFloat(usdPersonalizadoInput.value) || 0;
            if (montoUsd <= 0) {
                alert('Ingrese un monto en USD para el método de cobro personalizado');
                return;
            }
        }

        fetch(`/api/clientes?cedula=${encodeURIComponent(clienteData.cedula)}`)
            .then(r => r.json())
            .then(clientes => {
                let clienteId = null;
                if (clientes.length > 0) {
                    clienteId = clientes[0].id;
                    return clienteId;
                } else {
                    return fetch('/api/clientes', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(clienteData)
                    }).then(r => r.json()).then(res => res.id);
                }
            })
            .then(clienteId => {
                if (!clienteId) throw new Error('No se pudo obtener/crear el cliente');
                return procesarVenta(clienteId, clienteData);
            })
            .then(res => {
                alert(res.mensaje || '✅ Venta registrada exitosamente');
                imprimirNotaEntrega(res.venta_id);
                limpiarVenta();
            })
            .catch(err => {
                alert('❌ Error al procesar venta: ' + err.message);
            });
    });

    // ---------- GENERAR TICKET PNG ----------
    btnGenerarTicket.addEventListener('click', function() {
        if (carrito.length === 0) {
            alert('No hay productos en el carrito para generar un ticket');
            return;
        }

        btnGenerarTicket.textContent = 'Procesando venta...';
        btnGenerarTicket.disabled = true;

        const clienteData = obtenerDatosCliente();
        if (!clienteData.nombre || !clienteData.apellido || !clienteData.cedula) {
            alert('Nombre, apellido y cédula son obligatorios');
            btnGenerarTicket.textContent = 'Generar Ticket (PNG)';
            btnGenerarTicket.disabled = false;
            return;
        }

        if (carrito.length === 0) {
            alert('El carrito está vacío');
            btnGenerarTicket.textContent = 'Generar Ticket (PNG)';
            btnGenerarTicket.disabled = false;
            return;
        }

        if (tasaSeleccionada === 'bs_personalizado') {
            const montoBs = parseMontoVES(bsPersonalizadoInput.value) || 0;
            if (montoBs <= 0) {
                alert('Ingrese un monto en Bs para el método de cobro personalizado');
                btnGenerarTicket.textContent = 'Generar Ticket (PNG)';
                btnGenerarTicket.disabled = false;
                return;
            }
        }

        if (tasaSeleccionada === 'usd_personalizado') {
            const montoUsd = parseFloat(usdPersonalizadoInput.value) || 0;
            if (montoUsd <= 0) {
                alert('Ingrese un monto en USD para el método de cobro personalizado');
                btnGenerarTicket.textContent = 'Generar Ticket (PNG)';
                btnGenerarTicket.disabled = false;
                return;
            }
        }

        fetch(`/api/clientes?cedula=${encodeURIComponent(clienteData.cedula)}`)
            .then(r => r.json())
            .then(clientes => {
                let clienteId = null;
                if (clientes.length > 0) {
                    clienteId = clientes[0].id;
                    return clienteId;
                } else {
                    return fetch('/api/clientes', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(clienteData)
                    }).then(r => r.json()).then(res => res.id);
                }
            })
            .then(clienteId => {
                if (!clienteId) throw new Error('No se pudo obtener/crear el cliente');
                const items = carrito.map(item => ({
                    producto_id: item.id,
                    cantidad: item.cantidad,
                    descuento_porcentaje: item.descuento || 0
                }));

                const data = {
                    cliente_id: clienteId,
                    items: items,
                    metodo_pago: metodoPago.value,
                    metodo_cobro: tasaSeleccionada,
                    cliente_nombre: clienteData.nombre,
                    cliente_apellido: clienteData.apellido,
                    cliente_cedula: clienteData.cedula,
                    cliente_telefono: clienteData.telefono,
                    cliente_direccion: clienteData.direccion
                };

                if (tasaSeleccionada === 'bs_personalizado') {
                    let precioBaseUsd = null;
                    const montoBs = parseMontoVES(bsPersonalizadoInput.value) || 0;
                    if (montoBs > 0 && tasaUsd > 0) {
                        precioBaseUsd = montoBs / tasaUsd;
                    }
                    let totalUsd = 0;
                    carrito.forEach(item => {
                        const base = precioBaseUsd !== null ? precioBaseUsd : item.precio;
                        const precioConDesc = base * (1 - (item.descuento || 0) / 100);
                        totalUsd += precioConDesc * item.cantidad;
                    });
                    data.total_cobro = totalUsd * tasaUsd;
                } else if (tasaSeleccionada === 'usd_personalizado') {
                    let total = 0;
                    carrito.forEach(item => {
                        let precioBase = montoUsdPersonalizado;
                        const precioConDesc = precioBase * (1 - (item.descuento || 0) / 100);
                        total += precioConDesc * item.cantidad;
                    });
                    data.total_cobro = total;
                }

                return fetch('/api/ventas', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
            })
            .then(res => res.json())
            .then(res => {
                if (!res.venta_id) throw new Error('No se pudo registrar la venta');
                const ventaId = res.venta_id;
                if (res.numero_ticket) {
                    numeroTicket = String(res.numero_ticket).padStart(5, '0');
                }
                btnGenerarTicket.textContent = 'Descargando ticket...';
                window.location.href = `/api/generar-ticket/${ventaId}`;
                imprimirNotaEntrega(ventaId);
                setTimeout(() => {
                    limpiarVenta();
                    btnGenerarTicket.textContent = 'Generar Ticket (PNG)';
                    btnGenerarTicket.disabled = false;
                    alert('✅ Ticket PNG generado y descargado exitosamente');
                }, 1500);
            })
            .catch(err => {
                alert('❌ Error: ' + err.message);
                btnGenerarTicket.textContent = 'Generar Ticket (PNG)';
                btnGenerarTicket.disabled = false;
            });
    });

    // ---------- BOTÓN "GENERAR TICKET FÍSICO" ----------
    btnGenerarTicketFisico.addEventListener('click', function() {
        if (carrito.length === 0) {
            alert('No hay productos en el carrito para generar un ticket físico');
            return;
        }

        verificarImpresoraConfigurada().then(impresoraConfigurada => {
            if (!impresoraConfigurada) {
                const irConfig = confirm(
                    '⚠️ No hay una impresora configurada.\n\n' +
                    '¿Desea ir a la configuración de impresora ahora?\n' +
                    '(Si cancela, la venta se registrará sin imprimir ticket físico)'
                );
                if (irConfig) {
                    window.location.href = '/config/impresora';
                } else {
                    return procesarVentaSinImpresion();
                }
                return;
            }
            return procesarVentaConImpresion();
        }).catch(err => {
            alert('❌ Error al verificar impresora: ' + err.message);
        });
    });

    function procesarVentaConImpresion() {
        btnGenerarTicketFisico.textContent = 'Procesando...';
        btnGenerarTicketFisico.disabled = true;

        const clienteData = obtenerDatosCliente();
        if (!clienteData.nombre || !clienteData.apellido || !clienteData.cedula) {
            alert('Nombre, apellido y cédula son obligatorios');
            btnGenerarTicketFisico.textContent = 'Generar Ticket Físico';
            btnGenerarTicketFisico.disabled = false;
            return;
        }

        if (tasaSeleccionada === 'bs_personalizado') {
            const montoBs = parseMontoVES(bsPersonalizadoInput.value) || 0;
            if (montoBs <= 0) {
                alert('Ingrese un monto en Bs para el método de cobro personalizado');
                btnGenerarTicketFisico.textContent = 'Generar Ticket Físico';
                btnGenerarTicketFisico.disabled = false;
                return;
            }
        }

        if (tasaSeleccionada === 'usd_personalizado') {
            const montoUsd = parseFloat(usdPersonalizadoInput.value) || 0;
            if (montoUsd <= 0) {
                alert('Ingrese un monto en USD para el método de cobro personalizado');
                btnGenerarTicketFisico.textContent = 'Generar Ticket Físico';
                btnGenerarTicketFisico.disabled = false;
                return;
            }
        }

        fetch(`/api/clientes?cedula=${encodeURIComponent(clienteData.cedula)}`)
            .then(r => r.json())
            .then(clientes => {
                let clienteId = null;
                if (clientes.length > 0) {
                    clienteId = clientes[0].id;
                    return clienteId;
                } else {
                    return fetch('/api/clientes', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(clienteData)
                    }).then(r => r.json()).then(res => res.id);
                }
            })
            .then(clienteId => {
                if (!clienteId) throw new Error('No se pudo obtener/crear el cliente');
                const items = carrito.map(item => ({
                    producto_id: item.id,
                    cantidad: item.cantidad,
                    descuento_porcentaje: item.descuento || 0
                }));

                const data = {
                    cliente_id: clienteId,
                    items: items,
                    metodo_pago: metodoPago.value,
                    metodo_cobro: tasaSeleccionada,
                    cliente_nombre: clienteData.nombre,
                    cliente_apellido: clienteData.apellido,
                    cliente_cedula: clienteData.cedula,
                    cliente_telefono: clienteData.telefono,
                    cliente_direccion: clienteData.direccion
                };

                if (tasaSeleccionada === 'bs_personalizado') {
                    let precioBaseUsd = null;
                    const montoBs = parseMontoVES(bsPersonalizadoInput.value) || 0;
                    if (montoBs > 0 && tasaUsd > 0) {
                        precioBaseUsd = montoBs / tasaUsd;
                    }
                    let totalUsd = 0;
                    carrito.forEach(item => {
                        const base = precioBaseUsd !== null ? precioBaseUsd : item.precio;
                        const precioConDesc = base * (1 - (item.descuento || 0) / 100);
                        totalUsd += precioConDesc * item.cantidad;
                    });
                    data.total_cobro = totalUsd * tasaUsd;
                } else if (tasaSeleccionada === 'usd_personalizado') {
                    let total = 0;
                    carrito.forEach(item => {
                        let precioBase = montoUsdPersonalizado;
                        const precioConDesc = precioBase * (1 - (item.descuento || 0) / 100);
                        total += precioConDesc * item.cantidad;
                    });
                    data.total_cobro = total;
                }

                return fetch('/api/ventas', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
            })
            .then(res => res.json())
            .then(res => {
                if (!res.venta_id) throw new Error('No se pudo registrar la venta');
                if (res.numero_ticket) {
                    numeroTicket = String(res.numero_ticket).padStart(5, '0');
                }
                alert('✅ Venta registrada. El ticket físico se ha enviado a la impresora.');
                imprimirNotaEntrega(res.venta_id);
                limpiarVenta();
                btnGenerarTicketFisico.textContent = 'Generar Ticket Físico';
                btnGenerarTicketFisico.disabled = false;
            })
            .catch(err => {
                alert('❌ Error: ' + err.message);
                btnGenerarTicketFisico.textContent = 'Generar Ticket Físico';
                btnGenerarTicketFisico.disabled = false;
            });
    }

    function procesarVentaSinImpresion() {
        btnGenerarTicketFisico.textContent = 'Procesando...';
        btnGenerarTicketFisico.disabled = true;

        const clienteData = obtenerDatosCliente();
        if (!clienteData.nombre || !clienteData.apellido || !clienteData.cedula) {
            alert('Nombre, apellido y cédula son obligatorios');
            btnGenerarTicketFisico.textContent = 'Generar Ticket Físico';
            btnGenerarTicketFisico.disabled = false;
            return;
        }

        if (tasaSeleccionada === 'bs_personalizado') {
            const montoBs = parseMontoVES(bsPersonalizadoInput.value) || 0;
            if (montoBs <= 0) {
                alert('Ingrese un monto en Bs para el método de cobro personalizado');
                btnGenerarTicketFisico.textContent = 'Generar Ticket Físico';
                btnGenerarTicketFisico.disabled = false;
                return;
            }
        }

        if (tasaSeleccionada === 'usd_personalizado') {
            const montoUsd = parseFloat(usdPersonalizadoInput.value) || 0;
            if (montoUsd <= 0) {
                alert('Ingrese un monto en USD para el método de cobro personalizado');
                btnGenerarTicketFisico.textContent = 'Generar Ticket Físico';
                btnGenerarTicketFisico.disabled = false;
                return;
            }
        }

        fetch(`/api/clientes?cedula=${encodeURIComponent(clienteData.cedula)}`)
            .then(r => r.json())
            .then(clientes => {
                let clienteId = null;
                if (clientes.length > 0) {
                    clienteId = clientes[0].id;
                    return clienteId;
                } else {
                    return fetch('/api/clientes', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(clienteData)
                    }).then(r => r.json()).then(res => res.id);
                }
            })
            .then(clienteId => {
                if (!clienteId) throw new Error('No se pudo obtener/crear el cliente');
                const items = carrito.map(item => ({
                    producto_id: item.id,
                    cantidad: item.cantidad,
                    descuento_porcentaje: item.descuento || 0
                }));

                const data = {
                    cliente_id: clienteId,
                    items: items,
                    metodo_pago: metodoPago.value,
                    metodo_cobro: tasaSeleccionada,
                    cliente_nombre: clienteData.nombre,
                    cliente_apellido: clienteData.apellido,
                    cliente_cedula: clienteData.cedula,
                    cliente_telefono: clienteData.telefono,
                    cliente_direccion: clienteData.direccion
                };

                if (tasaSeleccionada === 'bs_personalizado') {
                    let precioBaseUsd = null;
                    const montoBs = parseMontoVES(bsPersonalizadoInput.value) || 0;
                    if (montoBs > 0 && tasaUsd > 0) {
                        precioBaseUsd = montoBs / tasaUsd;
                    }
                    let totalUsd = 0;
                    carrito.forEach(item => {
                        const base = precioBaseUsd !== null ? precioBaseUsd : item.precio;
                        const precioConDesc = base * (1 - (item.descuento || 0) / 100);
                        totalUsd += precioConDesc * item.cantidad;
                    });
                    data.total_cobro = totalUsd * tasaUsd;
                } else if (tasaSeleccionada === 'usd_personalizado') {
                    let total = 0;
                    carrito.forEach(item => {
                        let precioBase = montoUsdPersonalizado;
                        const precioConDesc = precioBase * (1 - (item.descuento || 0) / 100);
                        total += precioConDesc * item.cantidad;
                    });
                    data.total_cobro = total;
                }

                return fetch('/api/ventas', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
            })
            .then(res => res.json())
            .then(res => {
                if (!res.venta_id) throw new Error('No se pudo registrar la venta');
                if (res.numero_ticket) {
                    numeroTicket = String(res.numero_ticket).padStart(5, '0');
                }
                alert('✅ Venta registrada (sin impresión física porque no hay impresora configurada).');
                imprimirNotaEntrega(res.venta_id);
                limpiarVenta();
                btnGenerarTicketFisico.textContent = 'Generar Ticket Físico';
                btnGenerarTicketFisico.disabled = false;
            })
            .catch(err => {
                alert('❌ Error: ' + err.message);
                btnGenerarTicketFisico.textContent = 'Generar Ticket Físico';
                btnGenerarTicketFisico.disabled = false;
            });
    }

    // ---------- PERSISTENCIA ----------
    function guardarEstado() {
        const estado = {
            cliente: {
                nombre: inputNombre.value,
                apellido: inputApellido.value,
                cedula: inputCedula.value,
                telefono: inputTelefono.value,
                direccion: inputDireccion.value
            },
            carrito: carrito.map(item => ({
                id: item.id,
                nombre: item.nombre,
                precio: item.precio,
                cantidad: item.cantidad,
                control_serial: item.control_serial,
                serial_number: item.serial_number,
                descuento: item.descuento || 0,
                ofertaActiva: item.ofertaActiva || false
            })),
            metodo_cobro: metodoCobro.value,
            metodo_pago: metodoPago.value,
            bs_personalizado: bsPersonalizadoInput.value,
            usd_personalizado: usdPersonalizadoInput.value,
            factorAjuste: factorAjuste,
            montoUsdPersonalizado: montoUsdPersonalizado
        };
        sessionStorage.setItem('venta_estado', JSON.stringify(estado));
        sessionStorage.setItem('factorAjuste', factorAjuste);
    }

    function restaurarEstado() {
        const saved = sessionStorage.getItem('venta_estado');
        const factorGuardado = sessionStorage.getItem('factorAjuste');
        if (factorGuardado) {
            factorAjuste = parseFloat(factorGuardado) || 1;
        }
        if (!saved) {
            factorAjuste = 1;
            montoUsdPersonalizado = 0;
            return;
        }
        try {
            const estado = JSON.parse(saved);
            if (estado.cliente) {
                inputNombre.value = estado.cliente.nombre || '';
                inputApellido.value = estado.cliente.apellido || '';
                inputCedula.value = estado.cliente.cedula || '';
                inputTelefono.value = estado.cliente.telefono || '';
                inputDireccion.value = estado.cliente.direccion || '';
            }
            if (estado.carrito && estado.carrito.length > 0) {
                carrito = estado.carrito;
                renderCarrito();
                if (estado.metodo_cobro) {
                    metodoCobro.value = estado.metodo_cobro;
                    if (estado.metodo_cobro === 'bs_personalizado') {
                        bsPersonalizadoContainer.classList.remove('hidden');
                        if (estado.bs_personalizado) {
                            bsPersonalizadoInput.value = estado.bs_personalizado;
                            formatearCampoBs(bsPersonalizadoInput);
                        }
                    } else if (estado.metodo_cobro === 'usd_personalizado') {
                        usdPersonalizadoContainer.classList.remove('hidden');
                        if (estado.usd_personalizado) {
                            usdPersonalizadoInput.value = estado.usd_personalizado;
                            formatearCampoUsd(usdPersonalizadoInput);
                            montoUsdPersonalizado = parseFloat(estado.usd_personalizado) || 0;
                        }
                    }
                }
                if (estado.factorAjuste) {
                    factorAjuste = estado.factorAjuste;
                }
                if (estado.montoUsdPersonalizado !== undefined) {
                    montoUsdPersonalizado = estado.montoUsdPersonalizado;
                }
                recalcularFactorAjuste();
                actualizarTicket();
            } else {
                metodoCobro.value = 'usd';
                tasaSeleccionada = 'usd';
                bsPersonalizadoContainer.classList.add('hidden');
                bsPersonalizadoInput.value = '';
                usdPersonalizadoContainer.classList.add('hidden');
                usdPersonalizadoInput.value = '';
                carrito = [];
                factorAjuste = 1;
                montoUsdPersonalizado = 0;
                renderCarrito();
                actualizarTicket();
            }
            if (estado.metodo_pago) {
                metodoPago.value = estado.metodo_pago;
            }
            actualizarEquivalenteUsd();
            actualizarEquivalenteVes();
        } catch (e) {
            console.warn('Error restaurando estado:', e);
        }
    }

    // ---------- EVENTOS ADICIONALES ----------
    [inputNombre, inputApellido, inputCedula, inputTelefono, inputDireccion].forEach(el => {
        el.addEventListener('input', function() {
            guardarEstado();
            actualizarTicket();
        });
    });

    metodoPago.addEventListener('change', function() {
        guardarEstado();
        actualizarTicket();
    });

    if (btnActualizarTasas) {
        btnActualizarTasas.addEventListener('click', function() {
            const originalText = this.innerHTML;
            this.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Actualizando...';
            this.disabled = true;

            obtenerTasas()
                .then(() => {
                    this.innerHTML = '<i class="fas fa-check-circle mr-1"></i> ¡Actualizado!';
                    setTimeout(() => {
                        this.innerHTML = originalText;
                        this.disabled = false;
                    }, 1500);
                })
                .catch(() => {
                    this.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i> Error';
                    setTimeout(() => {
                        this.innerHTML = originalText;
                        this.disabled = false;
                    }, 2000);
                });
        });
    }

    // ---------- INICIALIZACIÓN ----------
    function init() {
        cargarConfiguracionTicket();
        obtenerTasas();
        inicializarFecha();
        restaurarEstado();
        actualizarTicket();
        actualizarEquivalenteUsd();
        actualizarEquivalenteVes();
    }

    init();

    setInterval(() => {
        obtenerTasas();
    }, 60000);

    // ==================================================================
    //  INTEGRACIÓN CON IMPRESIÓN POR WEBUSB
    // ==================================================================

    function sanitizarPOS(texto) {
        if (!texto) return '';
        return texto.toString()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/ñ/g, "n")
            .replace(/Ñ/g, "N")
            .replace(/á/g, "a")
            .replace(/é/g, "e")
            .replace(/í/g, "i")
            .replace(/ó/g, "o")
            .replace(/ú/g, "u")
            .replace(/Á/g, "A")
            .replace(/É/g, "E")
            .replace(/Í/g, "I")
            .replace(/Ó/g, "O")
            .replace(/Ú/g, "U");
    }

    function agregarBotonUSB() {
        if (!('usb' in navigator)) return;

        const btnFisico = document.getElementById('btn-generar-ticket-fisico');
        if (!btnFisico) return;

        if (document.getElementById('btn-imprimir-usb')) return;

        const btn = document.createElement('button');
        btn.id = 'btn-imprimir-usb';
        btn.innerHTML = '🖨️ Imprimir por USB (WebUSB)';
        btn.className = 'btn-primary w-full mt-2 text-sm';
        btn.style.background = '#0d9488';
        btn.style.color = 'white';
        btn.style.padding = '10px 24px';
        btn.style.border = 'none';
        btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer';
        btn.style.fontSize = '16px';
        btn.style.transition = 'background 0.2s';

        btn.addEventListener('mouseenter', function() {
            this.style.background = '#0f766e';
        });
        btn.addEventListener('mouseleave', function() {
            this.style.background = '#0d9488';
        });

        btn.addEventListener('click', async function() {
            btn.disabled = true;
            btn.innerHTML = '⏳ Procesando venta...';

            try {
                const clienteData = obtenerDatosCliente();
                if (!clienteData.nombre || !clienteData.apellido || !clienteData.cedula) {
                    alert('Nombre, apellido y cédula son obligatorios');
                    btn.disabled = false;
                    btn.innerHTML = '🖨️ Imprimir por USB (WebUSB)';
                    return;
                }

                if (carrito.length === 0) {
                    alert('El carrito está vacío');
                    btn.disabled = false;
                    btn.innerHTML = '🖨️ Imprimir por USB (WebUSB)';
                    return;
                }

                if (tasaSeleccionada === 'bs_personalizado') {
                    const montoBs = parseMontoVES(bsPersonalizadoInput.value) || 0;
                    if (montoBs <= 0) {
                        alert('Ingrese un monto en Bs para el método de cobro personalizado');
                        btn.disabled = false;
                        btn.innerHTML = '🖨️ Imprimir por USB (WebUSB)';
                        return;
                    }
                }

                if (tasaSeleccionada === 'usd_personalizado') {
                    const montoUsd = parseFloat(usdPersonalizadoInput.value) || 0;
                    if (montoUsd <= 0) {
                        alert('Ingrese un monto en USD para el método de cobro personalizado');
                        btn.disabled = false;
                        btn.innerHTML = '🖨️ Imprimir por USB (WebUSB)';
                        return;
                    }
                }

                let clienteId = null;
                const clientesResp = await fetch(`/api/clientes?cedula=${encodeURIComponent(clienteData.cedula)}`);
                const clientes = await clientesResp.json();
                if (clientes.length > 0) {
                    clienteId = clientes[0].id;
                } else {
                    const crearResp = await fetch('/api/clientes', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(clienteData)
                    });
                    const nuevoCliente = await crearResp.json();
                    clienteId = nuevoCliente.id;
                }

                const items = carrito.map(item => ({
                    producto_id: item.id,
                    cantidad: item.cantidad,
                    descuento_porcentaje: item.descuento || 0
                }));

                const data = {
                    cliente_id: clienteId,
                    items: items,
                    metodo_pago: metodoPago.value,
                    metodo_cobro: tasaSeleccionada,
                    cliente_nombre: clienteData.nombre,
                    cliente_apellido: clienteData.apellido,
                    cliente_cedula: clienteData.cedula,
                    cliente_telefono: clienteData.telefono,
                    cliente_direccion: clienteData.direccion
                };

                if (tasaSeleccionada === 'bs_personalizado') {
                    let precioBaseUsd = null;
                    const montoBs = parseMontoVES(bsPersonalizadoInput.value) || 0;
                    if (montoBs > 0 && tasaUsd > 0) {
                        precioBaseUsd = montoBs / tasaUsd;
                    }
                    let totalUsd = 0;
                    carrito.forEach(item => {
                        const base = precioBaseUsd !== null ? precioBaseUsd : item.precio;
                        const precioConDesc = base * (1 - (item.descuento || 0) / 100);
                        totalUsd += precioConDesc * item.cantidad;
                    });
                    data.total_cobro = totalUsd * tasaUsd;
                } else if (tasaSeleccionada === 'usd_personalizado') {
                    let total = 0;
                    carrito.forEach(item => {
                        let precioBase = montoUsdPersonalizado;
                        const precioConDesc = precioBase * (1 - (item.descuento || 0) / 100);
                        total += precioConDesc * item.cantidad;
                    });
                    data.total_cobro = total;
                }

                const ventaResp = await fetch('/api/ventas', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                if (!ventaResp.ok) {
                    const errData = await ventaResp.json();
                    throw new Error(errData.error || 'Error al registrar la venta');
                }

                const ventaData = await ventaResp.json();
                const { venta, detalles, cliente, config_ticket } = ventaData;

                if (typeof window.imprimirTicketUSB === 'function') {
                    if (venta.numero_ticket) {
                        numeroTicket = String(venta.numero_ticket).padStart(5, '0');
                        if (ticketNumero) ticketNumero.textContent = numeroTicket;
                    }

                    alert('✅ Venta registrada exitosamente. Enviando ticket a la impresora...');
                    await window.imprimirTicketUSB({
                        venta: venta,
                        detalles: detalles,
                        cliente: cliente,
                        configTicket: config_ticket
                    });

                    limpiarVenta();
                } else {
                    alert('❌ Módulo de impresión USB no cargado. El ticket se generó pero no se imprimió.');
                }

            } catch (err) {
                alert('❌ Error: ' + err.message);
                console.error('Error en flujo WebUSB:', err);
            } finally {
                btn.disabled = false;
                btn.innerHTML = '🖨️ Imprimir por USB (WebUSB)';
            }
        });

        btnFisico.parentNode.insertBefore(btn, btnFisico.nextSibling);
    }

    setTimeout(agregarBotonUSB, 500);
});