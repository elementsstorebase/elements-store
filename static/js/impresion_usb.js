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
        // Caracteres por línea (32 para 58mm, 42 para 80mm)
        columnas: 32,
        // Códigos ESC/POS
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

    // -------------------- GENERADOR DE TICKET ESC/POS (CORREGIDO) --------------------
    function generarBufferTicket(datosServidor) {
        const { venta, detalles, cliente, configTicket } = datosServidor;
        const col = CONFIG.columnas;
        const encoder = new TextEncoder();
        let lines = [];

        // Extraer datos de venta
        const numeroTicket = venta.numero_ticket || 0;
        const fechaFormateada = venta.fecha_formateada || '';
        const totalUsd = venta.total_usd || 0;
        const subtotalVes = venta.subtotal_ves || 0;
        const totalVes = venta.total_ves || 0;
        const metodoPago = venta.metodo_pago || 'Efectivo';
        const tasaBcv = venta.tasa_bcv || 0;

        // Extraer datos de cliente
        const nombreCliente = cliente ? sanitizarPOS(cliente.nombre_completo || '') : 'Consumidor Final';
        const cedulaCliente = cliente ? sanitizarPOS(cliente.cedula || '-') : '-';
        const telefonoCliente = cliente ? sanitizarPOS(cliente.telefono || '') : '';
        const direccionCliente = cliente ? sanitizarPOS(cliente.direccion || '') : '';

        // Extraer configuración del ticket
        const nombreTienda = configTicket.nombre_tienda || 'ELEMENTS STORE';
        const telefonoTienda = configTicket.telefono_tienda || '';
        const direccionTienda = configTicket.direccion_tienda || '';
        const mostrarTelefono = configTicket.mostrar_telefono !== false;
        const mostrarDireccionTienda = configTicket.mostrar_direccion_tienda !== false;
        const mostrarDireccionCliente = configTicket.mostrar_direccion_cliente !== false;
        const ivaPorcentaje = configTicket.porcentaje_iva || 0; // 🔥 CAMBIO: usar porcentaje_iva
        const mensaje = configTicket.mensaje_agradecimiento || '¡Gracias por su compra!';
        const urlWeb = configTicket.url_web || '';
        const mostrarUrlWeb = configTicket.mostrar_url_web || false;

        // --- Inicialización ---
        lines.push(CONFIG.ESC + '@');                     // Resetear impresora
        lines.push(CONFIG.ESC + 'a\x01');                // Centrar

        // --- Encabezado (negrita, centrado) ---
        lines.push(CONFIG.ESC + 'E\x01');                // Negrita ON
        lines.push(centrarTexto(sanitizarPOS(nombreTienda), col));
        lines.push(CONFIG.ESC + 'E\x00');                // Negrita OFF
        if (mostrarTelefono && telefonoTienda) {
            lines.push(centrarTexto(sanitizarPOS(telefonoTienda), col));
        }
        if (mostrarDireccionTienda && direccionTienda) {
            lines.push(centrarTexto(sanitizarPOS(direccionTienda), col));
        }
        lines.push(separador(col, '-'));

        // --- Ticket y fecha ---
        lines.push(CONFIG.ESC + 'E\x01');
        lines.push(centrarTexto(`NOTA DE ENTREGA No: ${String(numeroTicket).padStart(5, '0')}`, col));
        lines.push(CONFIG.ESC + 'E\x00');
        lines.push(centrarTexto(`Fecha: ${fechaFormateada}`, col));
        lines.push(separador(col, '-'));

        // --- Cliente (alineación izquierda) ---
        lines.push(CONFIG.ESC + 'a\x00');                // Izquierda
        lines.push(`Cliente: ${nombreCliente}`);
        lines.push(`Cedula: ${cedulaCliente}`);
        if (telefonoCliente) {
            lines.push(`Telefono: ${telefonoCliente}`);
        }
        if (direccionCliente && mostrarDireccionCliente) {
            lines.push(`Direccion: ${direccionCliente}`);
        }
        lines.push(separador(col, '-'));

        // --- Cabecera de productos (2 columnas: descripción y total) ---
        lines.push(CONFIG.ESC + 'E\x01');
        lines.push(alinearIzquierdaDerecha('Cant/Producto', 'Total', col));
        lines.push(CONFIG.ESC + 'E\x00');
        lines.push(separador(col, '-'));

        // --- Productos (formato 2 líneas) ---
        detalles.forEach(item => {
            let nombre = sanitizarPOS(item.nombre_producto || 'Producto eliminado');
            const descuento = item.descuento_porcentaje || 0;
            // 🔥 Agregar indicador de descuento si existe
            if (descuento > 0) {
                nombre += ` (${descuento}% off)`;
            }
            const precioUnitario = item.precio_unitario_efectivo_usd || 0;
            const cantidad = item.cantidad || 0;
            const subtotal = item.total_linea_usd || 0;

            // Línea 1: nombre
            lines.push(nombre);

            // Línea 2: cantidad, precio unitario y total alineado a la derecha
            const detalle = `${cantidad}x @ $${precioUnitario.toFixed(2)}`;
            const totalStr = `$${subtotal.toFixed(2)}`;
            lines.push(alinearIzquierdaDerecha(detalle, totalStr, col));
        });

        lines.push(separador(col, '-'));

        // --- Totales USD ---
        lines.push(CONFIG.ESC + 'E\x01');
        lines.push(alinearIzquierdaDerecha('TOTAL USD:', `$${totalUsd.toFixed(2)}`, col));
        lines.push(CONFIG.ESC + 'E\x00');
        lines.push(separador(col, '-'));

        // --- Totales VES con IVA (CORREGIDO) ---
        lines.push(alinearIzquierdaDerecha('Tasa BCV:', `Bs ${tasaBcv.toFixed(2)}`, col));
        lines.push(alinearIzquierdaDerecha('SUBTOTAL VES:', `Bs ${formatearNumeroVES(subtotalVes)}`, col));

        // 🔥 DESGLOSE DINÁMICO DE IVA (solo si > 0%)
        if (ivaPorcentaje > 0) {
            const ivaMonto = subtotalVes * (ivaPorcentaje / 100);
            const totalConIva = subtotalVes + ivaMonto;
            lines.push(alinearIzquierdaDerecha(`IVA (${ivaPorcentaje}%):`, `Bs ${formatearNumeroVES(ivaMonto)}`, col));
            lines.push(CONFIG.ESC + 'E\x01');
            lines.push(alinearIzquierdaDerecha('TOTAL VES:', `Bs ${formatearNumeroVES(totalConIva)}`, col));
            lines.push(CONFIG.ESC + 'E\x00');
        } else {
            // Sin IVA: solo total
            lines.push(CONFIG.ESC + 'E\x01');
            lines.push(alinearIzquierdaDerecha('TOTAL VES:', `Bs ${formatearNumeroVES(totalVes)}`, col));
            lines.push(CONFIG.ESC + 'E\x00');
        }

        lines.push(alinearIzquierdaDerecha('Metodo Pago:', sanitizarPOS(metodoPago), col));
        lines.push(separador(col, '-'));

        // --- Pie de página (centrado) con word wrap ---
        lines.push(CONFIG.ESC + 'a\x01');
        if (mensaje) {
            const mensajeFormateado = formatearPalabrasPOS(mensaje, col);
            const lineasMensaje = mensajeFormateado.split('\n');
            lineasMensaje.forEach(linea => {
                lines.push(linea);
            });
        }
        if (mostrarUrlWeb && urlWeb && urlWeb.trim() !== '') {
            lines.push(sanitizarPOS(urlWeb.trim()));
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

    // -------------------- FUNCIÓN PRINCIPAL EXPUESTA (CORREGIDA) --------------------
    window.imprimirTicketUSB = async function(datosServidor) {
        // Verificar que lleguen los datos correctos
        if (!datosServidor || !datosServidor.detalles || datosServidor.detalles.length === 0) {
            alert('No hay datos del ticket para imprimir');
            return;
        }

        // Verificar compatibilidad
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