/**
 * impresion_usb.js
 * 
 * Módulo para imprimir tickets mediante WebUSB API (ESC/POS)
 * Compatible con Chrome/Edge 89+
 * 
 * Uso:
 *   window.imprimirTicketUSB(datos)
 */

(function() {
    'use strict';

    // -------------------- CONFIGURACIÓN DE IMPRESORA --------------------
    const CONFIG = {
        // Caracteres por línea (ajustar según ancho: 32 para 58mm, 42 para 80mm)
        columnas: 32,
        // Códigos ESC/POS
        ESC: '\x1B',
        GS: '\x1D',
        LF: '\x0A',
        CR: '\x0D'
    };

    // -------------------- GENERADOR DE TICKET ESC/POS --------------------
    function generarBufferTicket(datos) {
        const { carrito, cliente, totalUsd, subtotalVes, metodoPago, tasa, configTicket, numeroTicket, fecha } = datos;
        const col = CONFIG.columnas;
        const encoder = new TextEncoder();
        let lines = [];

        // --- Inicialización ---
        lines.push(CONFIG.ESC + '@');                     // Resetear impresora
        lines.push(CONFIG.ESC + 'a\x01');                // Centrar

        // --- Encabezado (negrita, centrado) ---
        lines.push(CONFIG.ESC + 'E\x01');                // Negrita ON
        lines.push(centrarTexto(configTicket.tiendaNombre || 'ELEMENTS STORE', col));
        lines.push(CONFIG.ESC + 'E\x00');                // Negrita OFF
        if (configTicket.mostrarTelefono && configTicket.telefonoTienda) {
            lines.push(centrarTexto(configTicket.telefonoTienda, col));
        }
        if (configTicket.mostrarDireccionTienda && configTicket.direccionTienda) {
            lines.push(centrarTexto(configTicket.direccionTienda, col));
        }
        lines.push(separador(col, '-'));

        // --- Ticket y fecha ---
        lines.push(CONFIG.ESC + 'E\x01');
        lines.push(centrarTexto(`NOTA DE ENTREGA No: ${String(numeroTicket).padStart(5, '0')}`, col));
        lines.push(CONFIG.ESC + 'E\x00');
        lines.push(centrarTexto(`Fecha: ${fecha}`, col));
        lines.push(separador(col, '-'));

        // --- Cliente (alineación izquierda) ---
        lines.push(CONFIG.ESC + 'a\x00');                // Izquierda
        const nombreCliente = cliente ? `${cliente.nombre} ${cliente.apellido}`.trim() : 'Consumidor Final';
        lines.push(`Cliente: ${nombreCliente}`);
        lines.push(`Cédula: ${cliente ? cliente.cedula : '-'}`);
        if (cliente && cliente.telefono) {
            lines.push(`Teléfono: ${cliente.telefono}`);
        }
        if (cliente && cliente.direccion && configTicket.mostrarDireccionCliente) {
            lines.push(`Dirección: ${cliente.direccion}`);
        }
        lines.push(separador(col, '-'));

        // --- Cabecera de productos (2 columnas: descripción y total) ---
        lines.push(CONFIG.ESC + 'E\x01');
        lines.push(alinearIzquierdaDerecha('Cant/Producto', 'Total', col));
        lines.push(CONFIG.ESC + 'E\x00');
        lines.push(separador(col, '-'));

        // --- Productos (formato 2 líneas) ---
        carrito.forEach(item => {
            const nombre = item.nombre || 'Producto eliminado';
            const descuento = item.descuento || 0;
            const nombreConOferta = descuento > 0 ? `${nombre} (${descuento}% off)` : nombre;
            const precioUnitario = item.precio;
            const cantidad = item.cantidad;
            const subtotal = precioUnitario * cantidad;

            // Línea 1: nombre
            lines.push(nombreConOferta);

            // Línea 2: cantidad, precio unitario y total alineado a la derecha
            const detalle = `${cantidad}x @ $${precioUnitario.toFixed(2)}`;
            const totalStr = `$${subtotal.toFixed(2)}`;
            lines.push(alinearIzquierdaDerecha(detalle, totalStr, col));
        });

        lines.push(separador(col, '-'));

        // --- Totales ---
        lines.push(CONFIG.ESC + 'E\x01');
        lines.push(alinearIzquierdaDerecha('TOTAL USD:', `$${totalUsd.toFixed(2)}`, col));
        lines.push(CONFIG.ESC + 'E\x00');
        lines.push(separador(col, '-'));

        // --- Subtotales en VES ---
        lines.push(alinearIzquierdaDerecha('Tasa BCV:', `Bs ${tasa.toFixed(2)}`, col));
        const subtotalVesStr = formatearNumeroVES(subtotalVes);
        lines.push(alinearIzquierdaDerecha('SUBTOTAL VES:', `Bs ${subtotalVesStr}`, col));

        if (configTicket.ivaPorcentaje > 0) {
            const ivaMonto = subtotalVes * (configTicket.ivaPorcentaje / 100);
            const totalVes = subtotalVes + ivaMonto;
            lines.push(alinearIzquierdaDerecha(`IVA (${configTicket.ivaPorcentaje}%):`, `Bs ${formatearNumeroVES(ivaMonto)}`, col));
            lines.push(CONFIG.ESC + 'E\x01');
            lines.push(alinearIzquierdaDerecha('TOTAL VES:', `Bs ${formatearNumeroVES(totalVes)}`, col));
            lines.push(CONFIG.ESC + 'E\x00');
        } else {
            lines.push(CONFIG.ESC + 'E\x01');
            lines.push(alinearIzquierdaDerecha('TOTAL VES:', `Bs ${formatearNumeroVES(subtotalVes)}`, col));
            lines.push(CONFIG.ESC + 'E\x00');
        }

        lines.push(alinearIzquierdaDerecha('Método Pago:', metodoPago, col));
        lines.push(separador(col, '-'));

        // --- Pie de página (centrado) ---
        lines.push(CONFIG.ESC + 'a\x01');
        lines.push(configTicket.mensaje || '¡Gracias por su compra!');
        if (configTicket.url) {
            lines.push(configTicket.url);
        }

        // --- Avanzar y cortar papel ---
        lines.push(CONFIG.ESC + 'd\x03');
        lines.push(CONFIG.GS + 'V\x00');

        const text = lines.join(CONFIG.LF);
        return encoder.encode(text);
    }

    // -------------------- FUNCIONES DE FORMATEO --------------------
    function centrarTexto(texto, ancho) {
        const pad = Math.max(0, ancho - texto.length);
        const left = Math.floor(pad / 2);
        const right = pad - left;
        return ' '.repeat(left) + texto + ' '.repeat(right);
    }

    function alinearIzquierdaDerecha(izq, der, ancho) {
        const disponible = ancho - der.length - 1;
        const izqTrunc = izq.substring(0, disponible);
        const espacios = Math.max(0, disponible - izqTrunc.length);
        return izqTrunc + ' '.repeat(espacios) + der;
    }

    function separador(col, char) {
        return char.repeat(col);
    }

    function formatearNumeroVES(valor) {
        return valor.toFixed(2)
            .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
            .replace('.', 'X')
            .replace(',', '.')
            .replace('X', ',');
    }

    // -------------------- ENVÍO POR WEBUSB --------------------
    async function enviarPorUSB(buffer) {
        try {
            // Solicitar dispositivo USB (filtro vacío para mostrar todos)
            const device = await navigator.usb.requestDevice({ filters: [] });
            await device.open();

            // Si el dispositivo tiene múltiples configuraciones, seleccionar la #1
            if (device.configuration === null) {
                await device.selectConfiguration(1);
            }

            // Reclamar el primer endpoint OUT (generalmente el 2 o 3)
            const endpointOut = device.configuration.interfaces[0]?.alternate?.endpoints?.find(e => e.direction === 'out');
            if (!endpointOut) {
                throw new Error('No se encontró un endpoint OUT en el dispositivo.');
            }
            await device.claimInterface(device.configuration.interfaces[0].interfaceNumber);

            // Escribir el buffer en el endpoint OUT
            const result = await device.transferOut(endpointOut.endpointNumber, buffer);
            if (result.status !== 'ok') {
                throw new Error('Error al transferir datos: ' + result.status);
            }

            await device.close();
            return { success: true };
        } catch (err) {
            console.error('Error en WebUSB:', err);
            throw err;
        }
    }

    // -------------------- FUNCIÓN PRINCIPAL EXPUESTA --------------------
    window.imprimirTicketUSB = async function(datos) {
        if (!datos.carrito || datos.carrito.length === 0) {
            alert('No hay productos en el carrito para imprimir');
            return;
        }

        // Verificar compatibilidad
        if (!('usb' in navigator)) {
            alert('❌ Tu navegador no soporta WebUSB.\nUsa Chrome/Edge 89+.\n\nSe usará la impresión HTML alternativa.');
            if (window.imprimirNotaEntrega && datos.ventaId) {
                window.imprimirNotaEntrega(datos.ventaId);
            }
            return;
        }

        try {
            const buffer = generarBufferTicket(datos);
            const resultado = await enviarPorUSB(buffer);
            if (resultado.success) {
                alert('✅ Ticket enviado a la impresora por USB.');
            }
        } catch (err) {
            alert('❌ Error al imprimir: ' + err.message);
            if (confirm('Falló la impresión por USB. ¿Desea intentar con la impresión HTML?')) {
                if (window.imprimirNotaEntrega && datos.ventaId) {
                    window.imprimirNotaEntrega(datos.ventaId);
                }
            }
        }
    };
})();