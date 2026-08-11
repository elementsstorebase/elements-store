/**
 * Módulo de Listado de Tickets
 * Permite listar, filtrar, ver detalles y eliminar ventas (tickets).
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('🟢 tickets.js cargado correctamente');

    // ---------- REFERENCIAS ----------
    const filtroTicket = document.getElementById('filtro-ticket');
    const filtroFechaDesde = document.getElementById('filtro-fecha-desde');
    const filtroFechaHasta = document.getElementById('filtro-fecha-hasta');
    const btnFiltrar = document.getElementById('btn-filtrar');
    const btnLimpiar = document.getElementById('btn-limpiar');
    const tbody = document.getElementById('tabla-tickets-body');

    // Modal
    const modal = document.getElementById('modal-detalle');
    const modalCerrar = document.getElementById('modal-cerrar');
    const modalCerrarBtn = document.getElementById('modal-cerrar-btn');
    const modalTicketNumero = document.getElementById('modal-ticket-numero');
    const modalContenido = document.getElementById('modal-contenido');
    const modalDescargarPng = document.getElementById('modal-descargar-png');

    let ventaIdActual = null;

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

    // ---------- FUNCIONES ----------
    function cargarVentas(filtros = {}) {
        const params = new URLSearchParams();
        if (filtros.numero_ticket) params.append('numero_ticket', filtros.numero_ticket);
        if (filtros.fecha_desde) params.append('fecha_desde', filtros.fecha_desde);
        if (filtros.fecha_hasta) params.append('fecha_hasta', filtros.fecha_hasta);

        const url = `/api/ventas?${params.toString()}`;
        console.log('📡 Cargando ventas desde:', url);

        tbody.innerHTML = `<tr><td colspan="9" class="px-6 py-4 text-center text-gray-400">Cargando tickets...</td></tr>`;

        fetch(url)
            .then(response => {
                console.log('📨 Respuesta recibida, status:', response.status);
                if (!response.ok) throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
                return response.json();
            })
            .then(data => {
                console.log('✅ Datos recibidos:', data.length, 'ventas');
                renderTabla(data);
            })
            .catch(err => {
                console.error('❌ Error al cargar ventas:', err.message);
                tbody.innerHTML = `<tr><td colspan="9" class="px-6 py-4 text-center text-red-500">Error al cargar los tickets: ${err.message}</td></tr>`;
            });
    }

    function renderTabla(ventas) {
        if (!ventas || ventas.length === 0) {
            console.warn('⚠️ No hay ventas para mostrar');
            tbody.innerHTML = `<tr><td colspan="9" class="px-6 py-4 text-center text-gray-400">No hay tickets para mostrar</td></tr>`;
            return;
        }

        let html = '';
        ventas.forEach(v => {
            const fecha = new Date(v.fecha);
            const fechaFormateada = fecha.toLocaleString('es-VE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            html += `
                <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${String(v.numero_ticket).padStart(5, '0')}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${fechaFormateada}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${v.cliente}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${v.cedula || '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">$${formatearMonto(v.total_usd)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">Bs ${formatearMonto(v.total_ves)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">${v.metodo_pago || '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">${v.metodo_cobro || '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-center">
                        <div class="flex justify-center space-x-2">
                            <button class="btn-ver-ticket text-indigo-600 hover:text-indigo-900 font-medium" data-id="${v.id}">
                                Ver
                            </button>
                            <button class="btn-eliminar-ticket text-red-600 hover:text-red-900 font-medium" data-id="${v.id}" title="Eliminar venta y reintegrar stock">
                                Eliminar
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

        // Listeners para botones Ver
        document.querySelectorAll('.btn-ver-ticket').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = this.dataset.id;
                abrirDetalle(id);
            });
        });

        // Listeners para botones Eliminar
        document.querySelectorAll('.btn-eliminar-ticket').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = this.dataset.id;
                const fila = this.closest('tr');
                confirmarEliminarTicket(id, fila);
            });
        });
    }

    function confirmarEliminarTicket(ventaId, fila) {
        // Confirmación con cuadro de diálogo nativo
        if (!confirm('¿Está seguro de eliminar este ticket?\n\n⚠️ Esta acción es irreversible: se eliminará la venta y se reintegrará el stock al inventario. La información financiera asociada desaparecerá de los reportes.')) {
            return;
        }

        // Deshabilitar botones mientras se procesa
        const botones = fila.querySelectorAll('button');
        botones.forEach(b => b.disabled = true);

        // Mostrar estado en la fila
        const celdaAccion = fila.lastElementChild;
        const textoOriginal = celdaAccion.innerHTML;
        celdaAccion.innerHTML = '<span class="text-yellow-600 text-xs">Eliminando...</span>';

        fetch(`/api/ventas/${ventaId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.error || 'Error del servidor'); });
            }
            return response.json();
        })
        .then(data => {
            console.log('✅ Ticket eliminado:', data.mensaje);
            // Remover la fila de la tabla con una pequeña animación
            fila.style.transition = 'opacity 0.3s';
            fila.style.opacity = '0';
            setTimeout(() => {
                fila.remove();
                // Si no quedan filas, mostrar mensaje
                if (tbody.querySelectorAll('tr').length === 0) {
                    tbody.innerHTML = `<tr><td colspan="9" class="px-6 py-4 text-center text-gray-400">No hay tickets para mostrar</td></tr>`;
                }
            }, 300);
        })
        .catch(err => {
            console.error('❌ Error al eliminar ticket:', err.message);
            alert('Error al eliminar el ticket: ' + err.message);
            // Restaurar botones y texto original
            celdaAccion.innerHTML = textoOriginal;
            botones.forEach(b => b.disabled = false);
        });
    }

    function abrirDetalle(ventaId) {
        ventaIdActual = ventaId;
        modal.classList.remove('hidden');
        modalTicketNumero.textContent = '';
        modalContenido.innerHTML = '<div class="text-center py-4">Cargando detalles...</div>';
        modalDescargarPng.disabled = true;

        fetch(`/api/ventas/${ventaId}`)
            .then(response => {
                if (!response.ok) throw new Error('Error al cargar detalle');
                return response.json();
            })
            .then(data => {
                renderDetalle(data);
                modalTicketNumero.textContent = `#${String(data.numero_ticket).padStart(5, '0')}`;
                modalDescargarPng.disabled = false;
            })
            .catch(err => {
                console.error('❌ Error en detalle:', err);
                modalContenido.innerHTML = `<div class="text-center py-4 text-red-500">Error al cargar detalle: ${err.message}</div>`;
            });
    }

    function renderDetalle(data) {
        const fecha = new Date(data.fecha);
        const fechaFormateada = fecha.toLocaleString('es-VE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        let itemsHtml = '';
        data.items.forEach(item => {
            const subtotalUsd = item.subtotal_usd || 0;
            const subtotalVes = item.subtotal_ves || 0;
            const descuento = item.descuento_porcentaje || 0;
            const nombreProducto = descuento > 0 ? `${item.producto_nombre} (${descuento}% off)` : item.producto_nombre;

            itemsHtml += `
                <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-4 py-2 text-sm text-gray-900">${nombreProducto}</td>
                    <td class="px-4 py-2 text-sm text-center text-gray-900">${item.cantidad}</td>
                    <td class="px-4 py-2 text-sm text-right text-gray-900">$${formatearMonto(item.precio_unitario_usd)}</td>
                    <td class="px-4 py-2 text-sm text-right text-gray-900">Bs ${formatearMonto(item.precio_unitario_ves)}</td>
                    <td class="px-4 py-2 text-sm text-right text-gray-900">$${formatearMonto(subtotalUsd)}</td>
                    <td class="px-4 py-2 text-sm text-right text-gray-900">Bs ${formatearMonto(subtotalVes)}</td>
                </tr>
            `;
        });

        const html = `
            <div class="grid grid-cols-2 gap-4 mb-4 text-gray-900">
                <div><span class="font-medium">Cliente:</span> ${data.cliente}</div>
                <div><span class="font-medium">Cédula:</span> ${data.cedula || '-'}</div>
                <div><span class="font-medium">Teléfono:</span> ${data.telefono || '-'}</div>
                <div><span class="font-medium">Dirección:</span> ${data.direccion || '-'}</div>
                <div><span class="font-medium">Fecha:</span> ${fechaFormateada}</div>
                <div><span class="font-medium">Método Pago:</span> ${data.metodo_pago || '-'}</div>
                <div><span class="font-medium">Método Cobro:</span> ${data.metodo_cobro || '-'}</div>
                <div><span class="font-medium">Moneda Cobro:</span> ${data.moneda_cobro || '-'}</div>
                <div><span class="font-medium">Tasa Aplicada:</span> ${data.tasa_aplicada ? formatearMonto(data.tasa_aplicada) : '-'}</div>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                            <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Cant</th>
                            <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Precio USD</th>
                            <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Precio VES</th>
                            <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Subtotal USD</th>
                            <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Subtotal VES</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                        ${itemsHtml}
                    </tbody>
                    <tfoot class="bg-gray-50">
                        <tr>
                            <td colspan="4" class="px-4 py-2 text-right font-medium text-gray-900">Totales:</td>
                            <td class="px-4 py-2 text-right font-bold text-gray-900">$${formatearMonto(data.total_usd)}</td>
                            <td class="px-4 py-2 text-right font-bold text-gray-900">Bs ${formatearMonto(data.total_ves)}</td>
                        </tr>
                        <tr>
                            <td colspan="5" class="px-4 py-2 text-right font-medium text-gray-900">Total Cobrado (${data.moneda_cobro}):</td>
                            <td class="px-4 py-2 text-right font-bold text-gray-900">
                                ${data.moneda_cobro === 'USD' ? '$' : 'Bs '} ${formatearMonto(data.total_cobro)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;

        modalContenido.innerHTML = html;
    }

    function descargarPng() {
        if (!ventaIdActual) return;
        window.location.href = `/api/generar-ticket/${ventaIdActual}`;
    }

    function limpiarFiltros() {
        filtroTicket.value = '';
        filtroFechaDesde.value = '';
        filtroFechaHasta.value = '';
        cargarVentas({});
    }

    function aplicarFiltros() {
        const filtros = {};
        const ticket = filtroTicket.value.trim();
        if (ticket) filtros.numero_ticket = ticket;

        const desde = filtroFechaDesde.value;
        if (desde) filtros.fecha_desde = desde;

        const hasta = filtroFechaHasta.value;
        if (hasta) filtros.fecha_hasta = hasta;

        console.log('🔍 Aplicando filtros:', filtros);
        cargarVentas(filtros);
    }

    // ---------- INICIALIZACIÓN ----------
    function init() {
        console.log('📅 Cargando todos los tickets sin filtro de fecha');
        cargarVentas({});
    }

    // ---------- EVENTOS ----------
    btnFiltrar.addEventListener('click', aplicarFiltros);
    btnLimpiar.addEventListener('click', limpiarFiltros);

    filtroTicket.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') aplicarFiltros();
    });
    filtroFechaDesde.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') aplicarFiltros();
    });
    filtroFechaHasta.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') aplicarFiltros();
    });

    modalCerrar.addEventListener('click', function() {
        modal.classList.add('hidden');
    });
    modalCerrarBtn.addEventListener('click', function() {
        modal.classList.add('hidden');
    });
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });

    modalDescargarPng.addEventListener('click', descargarPng);

    init();
});