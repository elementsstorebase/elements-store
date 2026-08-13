/**
 * impresion_usb.js
 * 
 * Módulo para imprimir tickets mediante WebUSB API (ESC/POS)
 * Compatible con Chrome/Edge 89+
 * 
 * Uso:
 *   window.imprimirTicketUSB(datosServidor)
 *   donde datosServidor = { venta, detalles, cliente, configTicket }
 */

(function() {
    'use strict';

    // -------------------- CONFIGURACIÓN DE IMPRESORA --------------------
    const CONFIG = {
        columnas: 32,   // 32 para 58mm, 42 para 80mm
        ESC: '\x1B',
        GS: '\x1D',
        LF: '\x0A',
        CR: '\x0D'
    };

    // -------------------- SANITIZADOR ASCII --------------------
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

    // -------------------- WORD WRAP (respeta palabras) --------------------
    function formatearPalabrasPOS(texto, anchoMax = 32) {
        if (!texto) return '';
        const palabras = sanitizarPOS(texto).split(' ');
        let lineas = [];
        let lineaActual = '';

        palabras.forEach(palabra => {
            if ((lineaActual + ' ' + palabra).trim().length <= anchoMax) {
                lineaActual = (lineaActual + ' ' + palabra).trim();
            } else {
                if (lineaActual) lineas.push(lineaActual);
                lineaActual = palabra;
            }
        });
        if (lineaActual) lineas.push(lineaActual);
        return lineas.join('\n');
    }

    // -------------------- GENERADOR ESC/POS (CORREGIDO) --------------------
    function generarBufferTicket(datosServidor) {
        const { venta, detalles, cliente, configTicket } = datosServidor;
        const col = CONFIG.columnas;
        const encoder = new TextEncoder();
        let lines = [];

        // --- Inicialización ---
        lines.push(CONFIG.ESC + '@');
        lines.push(CONFIG.ESC + 'a\x01'); // centrar

        // --- Encabezado (negrita, centrado) ---
        lines.push(CONFIG.ESC + 'E\x01');
        lines.push(centrarTexto(sanitizarPOS(configTicket.nombre_tienda || 'ELEMENTS STORE'), col));
        lines.push(CONFIG.ESC + 'E\x00');
        if (configTicket.mostrar_telefono && configTicket.telefono_tienda) {
            lines.push(centrarTexto(sanitizarPOS(configTicket.telefono_tienda), col));
        }
        if (configTicket.mostrar_direccion_tienda && configTicket.direccion_tienda) {
            lines.push(centrarTexto(sanitizarPOS(configTicket.direccion_tienda), col));
        }
        lines.push(separador(col, '-'));

        // --- Número de ticket y fecha ---
        lines.push(CONFIG.ESC + 'E\x01');
        const numTicket = String(venta.numero_ticket).padStart(5, '0');
        lines.push(centrarTexto(`NOTA DE ENTREGA No: ${numTicket}`, col));
        lines.push(CONFIG.ESC + 'E\x00');
        lines.push(centrarTexto(`Fecha: ${venta.fecha_formateada}`, col));
        lines.push(separador(col, '-'));

        // --- Cliente (izquierda) ---
        lines.push(CONFIG.ESC + 'a\x00');
        if (cliente) {
            const nombreCompleto = sanitizarPOS(cliente.nombre_completo || '');
            lines.push(`Cliente: ${nombreCompleto}`);
            lines.push(`Cedula: ${sanitizarPOS(cliente.cedula || '-')}`);
            if (cliente.telefono) {
                lines.push(`Telefono: ${sanitizarPOS(cliente.telefono)}`);
            }
            if (cliente.direccion && configTicket.mostrar_direccion_cliente) {
                lines.push(`Direccion: ${sanitizarPOS(cliente.direccion)}`);
            }
        } else {
            lines.push('Cliente: Consumidor Final');
            lines.push('Cedula: -');
        }
        lines.push(separador(col, '-'));

        // --- Productos ---
        lines.push(CONFIG.ESC + 'E\x01');
        lines.push(alinearIzquierdaDerecha('Cant/Producto', 'Total', col));
        lines.push(CONFIG.ESC + 'E\x00');
        lines.push(separador(col, '-'));

        detalles.forEach(item => {
            let nombre = sanitizarPOS(item.nombre_producto || 'Producto');
            // 🔥 Agregar indicador de descuento si existe
            if (item.descuento_porcentaje && item.descuento_porcentaje > 0) {
                nombre += ` (${item.descuento_porcentaje}% off)`;
            }
            const precio = item.precio_unitario_efectivo_usd || 0;
            const cantidad = item.cantidad || 0;
            const totalLinea = item.total_linea_usd || 0;

            lines.push(nombre);
            const detalle = `${cantidad}x @ $${precio.toFixed(2)}`;
            const totalStr = `$${totalLinea.toFixed(2)}`;
            lines.push(alinearIzquierdaDerecha(detalle, totalStr, col));
        });

        lines.push(separador(col, '-'));

        // --- Totales USD ---
        lines.push(CONFIG.ESC + 'E\x01');
        lines.push(alinearIzquierdaDerecha('TOTAL USD:', `$${venta.total_usd.toFixed(2)}`, col));
        lines.push(CONFIG.ESC + 'E\x00');
        lines.push(separador(col, '-'));

        // --- Totales VES CON IVA (CORREGIDO) ---
        const subtotalVes = venta.subtotal_ves || 0;
        const totalVes = venta.total_ves || 0;
        const ivaPorcentaje = configTicket.porcentaje_iva || 0; // 🔥 CAMBIO: usar porcentaje_iva

        lines.push(alinearIzquierdaDerecha('Tasa BCV:', `Bs ${venta.tasa_bcv.toFixed(2)}`, col));
        lines.push(alinearIzquierdaDerecha('SUBTOTAL VES:', `Bs ${formatearNumeroVES(subtotalVes)}`, col));

        // 🔥 DESGLOSE DINÁMICO DE IVA (solo si > 0)
        if (ivaPorcentaje > 0) {
            const ivaMonto = subtotalVes * (ivaPorcentaje / 100);
            const totalConIva = subtotalVes + ivaMonto;
            lines.push(alinearIzquierdaDerecha(`IVA (${ivaPorcentaje}%):`, `Bs ${formatearNumeroVES(ivaMonto)}`, col));
            lines.push(CONFIG.ESC + 'E\x01');
            lines.push(alinearIzquierdaDerecha('TOTAL VES:', `Bs ${formatearNumeroVES(totalConIva)}`, col));
            lines.push(CONFIG.ESC + 'E\x00');
        } else {
            lines.push(CONFIG.ESC + 'E\x01');
            lines.push(alinearIzquierdaDerecha('TOTAL VES:', `Bs ${formatearNumeroVES(totalVes)}`, col));
            lines.push(CONFIG.ESC + 'E\x00');
        }

        lines.push(alinearIzquierdaDerecha('Metodo Pago:', sanitizarPOS(venta.metodo_pago || '-'), col));
        lines.push(separador(col, '-'));

        // --- Pie de página con word wrap ---
        lines.push(CONFIG.ESC + 'a\x01');
        if (configTicket.mensaje_agradecimiento) {
            const mensajeFormateado = formatearPalabrasPOS(configTicket.mensaje_agradecimiento, col);
            const lineasMensaje = mensajeFormateado.split('\n');
            lineasMensaje.forEach(linea => {
                lines.push(linea);
            });
        }
        if (configTicket.mostrar_url_web && configTicket.url_web && configTicket.url_web.trim() !== '') {
            lines.push(sanitizarPOS(configTicket.url_web.trim()));
        }

        // --- Avanzar y cortar ---
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
            const device = await navigator.usb.requestDevice({ filters: [] });
            await device.open();
            if (device.configuration === null) {
                await device.selectConfiguration(1);
            }
            const endpointOut = device.configuration.interfaces[0]?.alternate?.endpoints?.find(e => e.direction === 'out');
            if (!endpointOut) {
                throw new Error('No se encontró un endpoint OUT en el dispositivo.');
            }
            await device.claimInterface(device.configuration.interfaces[0].interfaceNumber);
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

    // -------------------- FUNCIÓN PRINCIPAL EXPUESTA (CORREGIDA) --------------------
    window.imprimirTicketUSB = async function(datosServidor) {
        // Verificar que lleguen los datos correctos
        if (!datosServidor || !datosServidor.detalles || datosServidor.detalles.length === 0) {
            alert('No hay datos del ticket para imprimir');
            return;
        }

        if (!('usb' in navigator)) {
            alert('❌ Tu navegador no soporta WebUSB.\nUsa Chrome/Edge 89+.\n\nSe usará la impresión HTML alternativa.');
            if (window.imprimirNotaEntrega && datosServidor.venta && datosServidor.venta.id) {
                window.imprimirNotaEntrega(datosServidor.venta.id);
            }
            return;
        }

        try {
            const buffer = generarBufferTicket(datosServidor);
            const resultado = await enviarPorUSB(buffer);
            if (resultado.success) {
                alert('✅ Ticket enviado a la impresora por USB.');
            }
        } catch (err) {
            alert('❌ Error al imprimir: ' + err.message);
            if (confirm('Falló la impresión por USB. ¿Desea intentar con la impresión HTML?')) {
                if (window.imprimirNotaEntrega && datosServidor.venta && datosServidor.venta.id) {
                    window.imprimirNotaEntrega(datosServidor.venta.id);
                }
            }
        }
    };
})();