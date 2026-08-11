/**
 * impresora.js - Manejo de la configuración de impresora
 * Controla:
 * - Carga de configuración actual al abrir la página
 * - Guardado de configuración
 * - Prueba de impresión
 * - Carga de valores por defecto
 * - Detección automática de impresoras (Windows)
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('🖨️ impresora.js cargado correctamente');

    // Elementos del DOM
    const form = document.getElementById('form-impresora');
    const mensaje = document.getElementById('mensaje-impresora');
    const btnTest = document.getElementById('btn-test-impresora');
    const btnDefault = document.getElementById('btn-cargar-default');
    const btnDetectar = document.getElementById('btn-detectar-impresoras');
    const listaContainer = document.getElementById('lista-impresoras-container');
    const listaSelect = document.getElementById('lista-impresoras');

    // ============================================
    // 1. CARGAR CONFIGURACIÓN ACTUAL
    // ============================================
    function cargarConfiguracion() {
        mostrarMensaje('Cargando configuración...', 'info');
        
        fetch('/api/impresora/config')
            .then(res => {
                if (!res.ok) throw new Error('Error al cargar configuración');
                return res.json();
            })
            .then(data => {
                // Asignar valores a los campos del formulario
                document.getElementById('imp-nombre').value = data.nombre_impresora || '';
                document.getElementById('imp-tipo').value = data.tipo || 'termica';
                document.getElementById('imp-puerto').value = data.puerto || 'USB';
                document.getElementById('imp-velocidad').value = data.velocidad || 9600;
                document.getElementById('imp-tamano').value = data.tamano_papel || '80mm';
                document.getElementById('imp-caracteres').value = data.caracteres_por_linea || 42;
                document.getElementById('imp-margen-izq').value = data.margen_izquierdo || 0;
                document.getElementById('imp-margen-der').value = data.margen_derecho || 0;
                document.getElementById('imp-fuente').value = data.fuente || 'DejaVuSans.ttf';
                document.getElementById('imp-tam-fuente').value = data.tamaño_fuente || 10;
                document.getElementById('imp-alineacion').value = data.alineacion || 'centrado';
                document.getElementById('imp-cabecera').value = data.cabecera_extra || '';
                document.getElementById('imp-pie').value = data.pie_extra || '';
                document.getElementById('imp-copias').value = data.copias || 1;
                document.getElementById('imp-cortar').checked = data.cortar_auto || false;
                document.getElementById('imp-abrir-cajon').checked = data.abrir_cajon || false;

                mostrarMensaje('✅ Configuración cargada correctamente.', 'success');
            })
            .catch(err => {
                console.error('Error cargando configuración:', err);
                mostrarMensaje('❌ No se pudo cargar la configuración. Verifique la conexión.', 'error');
            });
    }

    // ============================================
    // 2. GUARDAR CONFIGURACIÓN
    // ============================================
    function guardarConfiguracion(e) {
        e.preventDefault();
        mostrarMensaje('Guardando configuración...', 'info');

        const data = {
            nombre_impresora: document.getElementById('imp-nombre').value.trim(),
            tipo: document.getElementById('imp-tipo').value,
            puerto: document.getElementById('imp-puerto').value.trim(),
            velocidad: parseInt(document.getElementById('imp-velocidad').value) || 9600,
            tamano_papel: document.getElementById('imp-tamano').value,
            caracteres_por_linea: parseInt(document.getElementById('imp-caracteres').value) || 42,
            margen_izquierdo: parseInt(document.getElementById('imp-margen-izq').value) || 0,
            margen_derecho: parseInt(document.getElementById('imp-margen-der').value) || 0,
            fuente: document.getElementById('imp-fuente').value.trim() || 'DejaVuSans.ttf',
            tamaño_fuente: parseInt(document.getElementById('imp-tam-fuente').value) || 10,
            alineacion: document.getElementById('imp-alineacion').value,
            cabecera_extra: document.getElementById('imp-cabecera').value.trim(),
            pie_extra: document.getElementById('imp-pie').value.trim(),
            copias: parseInt(document.getElementById('imp-copias').value) || 1,
            cortar_auto: document.getElementById('imp-cortar').checked,
            abrir_cajon: document.getElementById('imp-abrir-cajon').checked
        };

        fetch('/api/impresora/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        .then(res => {
            if (!res.ok) throw new Error('Error al guardar');
            return res.json();
        })
        .then(result => {
            mostrarMensaje('✅ ' + (result.mensaje || 'Configuración guardada correctamente.'), 'success');
        })
        .catch(err => {
            console.error('Error guardando configuración:', err);
            mostrarMensaje('❌ Error al guardar: ' + err.message, 'error');
        });
    }

    // ============================================
    // 3. PRUEBA DE IMPRESIÓN
    // ============================================
    function probarImpresion() {
        mostrarMensaje('⏳ Enviando prueba de impresión...', 'info');
        
        fetch('/api/impresora/test', {
            method: 'POST'
        })
        .then(res => {
            if (!res.ok) throw new Error('Error en la prueba');
            return res.json();
        })
        .then(data => {
            mostrarMensaje('✅ ' + (data.mensaje || 'Prueba enviada correctamente.'), 'success');
        })
        .catch(err => {
            console.error('Error en prueba de impresión:', err);
            mostrarMensaje('❌ Error en la prueba: ' + err.message, 'error');
        });
    }

    // ============================================
    // 4. CARGAR VALORES POR DEFECTO
    // ============================================
    function cargarValoresDefault() {
        if (!confirm('¿Desea cargar los valores por defecto? Se perderán los cambios no guardados.')) {
            return;
        }

        const defaults = {
            nombre_impresora: 'Impresa Térmica',
            tipo: 'termica',
            puerto: 'USB',
            velocidad: 9600,
            tamano_papel: '80mm',
            caracteres_por_linea: 42,
            margen_izquierdo: 0,
            margen_derecho: 0,
            fuente: 'DejaVuSans.ttf',
            tamaño_fuente: 10,
            alineacion: 'centrado',
            cabecera_extra: '',
            pie_extra: '',
            copias: 1,
            cortar_auto: true,
            abrir_cajon: false
        };

        document.getElementById('imp-nombre').value = defaults.nombre_impresora;
        document.getElementById('imp-tipo').value = defaults.tipo;
        document.getElementById('imp-puerto').value = defaults.puerto;
        document.getElementById('imp-velocidad').value = defaults.velocidad;
        document.getElementById('imp-tamano').value = defaults.tamano_papel;
        document.getElementById('imp-caracteres').value = defaults.caracteres_por_linea;
        document.getElementById('imp-margen-izq').value = defaults.margen_izquierdo;
        document.getElementById('imp-margen-der').value = defaults.margen_derecho;
        document.getElementById('imp-fuente').value = defaults.fuente;
        document.getElementById('imp-tam-fuente').value = defaults.tamaño_fuente;
        document.getElementById('imp-alineacion').value = defaults.alineacion;
        document.getElementById('imp-cabecera').value = defaults.cabecera_extra;
        document.getElementById('imp-pie').value = defaults.pie_extra;
        document.getElementById('imp-copias').value = defaults.copias;
        document.getElementById('imp-cortar').checked = defaults.cortar_auto;
        document.getElementById('imp-abrir-cajon').checked = defaults.abrir_cajon;

        mostrarMensaje('🔄 Valores por defecto cargados. Presione "Guardar" para aplicarlos.', 'info');
    }

    // ============================================
    // 5. DETECCIÓN DE IMPRESORAS (NUEVO)
    // ============================================
    async function detectarImpresoras() {
        mostrarMensaje('🔍 Buscando impresoras instaladas...', 'info');
        
        try {
            const response = await fetch('/api/impresora/listar');
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.mensaje || 'Error al detectar impresoras');
            }
            
            // Limpiar select
            listaSelect.innerHTML = '<option value="">-- Seleccione --</option>';
            
            if (data.impresoras && data.impresoras.length > 0) {
                // Mostrar el contenedor
                listaContainer.classList.remove('hidden');
                
                // Poblar select
                data.impresoras.forEach(imp => {
                    const option = document.createElement('option');
                    option.value = imp.nombre;
                    let texto = imp.descripcion || imp.nombre;
                    if (imp.predeterminada) {
                        texto += ' (Predeterminada)';
                    }
                    option.textContent = texto;
                    listaSelect.appendChild(option);
                });
                
                // Evento para rellenar el campo nombre al seleccionar
                listaSelect.onchange = function() {
                    if (this.value) {
                        document.getElementById('imp-nombre').value = this.value;
                        // Ocultar el contenedor después de seleccionar (opcional)
                        // listaContainer.classList.add('hidden');
                    }
                };
                
                mostrarMensaje(`✅ ${data.impresoras.length} impresora(s) encontrada(s). Seleccione una.`, 'success');
            } else {
                // Si no hay impresoras, ocultar el contenedor y mostrar mensaje
                listaContainer.classList.add('hidden');
                mostrarMensaje('ℹ️ ' + (data.mensaje || 'No se encontraron impresoras. Configure manualmente.'), 'info');
            }
        } catch (error) {
            console.error('Error detectando impresoras:', error);
            listaContainer.classList.add('hidden');
            mostrarMensaje('❌ ' + error.message, 'error');
        }
    }

    // ============================================
    // 6. UTILIDAD: MOSTRAR MENSAJE
    // ============================================
    function mostrarMensaje(texto, tipo = 'info') {
        if (!mensaje) return;
        mensaje.textContent = texto;
        mensaje.className = 'text-sm mt-2 p-3 rounded-xl ';

        switch (tipo) {
            case 'success':
                mensaje.className += 'bg-green-50 text-green-700 border border-green-200';
                break;
            case 'error':
                mensaje.className += 'bg-red-50 text-red-700 border border-red-200';
                break;
            case 'info':
            default:
                mensaje.className += 'bg-blue-50 text-blue-700 border border-blue-200';
                break;
        }
        mensaje.classList.remove('hidden');
    }

    // ============================================
    // 7. EVENTOS
    // ============================================
    // Cargar configuración al iniciar
    cargarConfiguracion();

    // Guardar formulario
    if (form) {
        form.addEventListener('submit', guardarConfiguracion);
    }

    // Prueba de impresión
    if (btnTest) {
        btnTest.addEventListener('click', probarImpresion);
    }

    // Cargar valores por defecto
    if (btnDefault) {
        btnDefault.addEventListener('click', cargarValoresDefault);
    }

    // Detectar impresoras (NUEVO)
    if (btnDetectar) {
        btnDetectar.addEventListener('click', detectarImpresoras);
    }

    // ============================================
    // 8. EXPONER FUNCIONES PARA CONSOLA (DEBUG)
    // ============================================
    window.impresora = {
        cargarConfiguracion,
        guardarConfiguracion,
        probarImpresion,
        cargarValoresDefault,
        detectarImpresoras
    };
});