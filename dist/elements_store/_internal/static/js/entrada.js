document.addEventListener('DOMContentLoaded', function() {
    // Variables globales
    let tasaUsd = 0;
    let tasaEur = 0;
    let tasaPersonalizada = 0;
    let productosCache = [];
    let timeoutBusqueda = null;

    // Referencias a elementos
    const form = document.getElementById('form-entrada');
    const inputNombre = document.getElementById('nombre');
    const sugerenciasDiv = document.getElementById('sugerencias');
    const selectCategoria = document.getElementById('categoria');
    const selectSubcategoria = document.getElementById('subcategoria');
    const selectMarca = document.getElementById('marca');
    const selectTalla = document.getElementById('talla');
    const inputCosto = document.getElementById('costo_usd'); // NUEVO
    const inputPrecioUSD = document.getElementById('precio_usd');
    const inputPrecioVesBcvUsd = document.getElementById('precio_ves_bcv_usd');
    const inputPrecioVesBcvEur = document.getElementById('precio_ves_bcv_eur');
    const inputPrecioVesPersonalizada = document.getElementById('precio_ves_personalizada');
    const inputStock = document.getElementById('stock');
    const checkSerial = document.getElementById('control_serial');
    const inputSerial = document.getElementById('serial_number');
    const serialDiv = document.getElementById('serial_div');
    const btnLimpiar = document.getElementById('btn-limpiar');

    // ---------- CARGA DE DATOS MAESTROS ----------
    function cargarCategorias() {
        fetch('/api/categorias')
            .then(res => res.json())
            .then(data => {
                selectCategoria.innerHTML = '<option value="">Seleccionar</option>';
                data.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = c.nombre;
                    selectCategoria.appendChild(opt);
                });
                const saved = sessionStorage.getItem('entrada_categoria');
                if (saved) {
                    selectCategoria.value = saved;
                    if (selectCategoria.value) {
                        cargarSubcategorias(selectCategoria.value);
                        cargarMarcas(selectCategoria.value);
                    }
                }
            })
            .catch(err => console.error('Error cargando categorías:', err));
    }

    function cargarSubcategorias(categoriaId) {
        if (!categoriaId) {
            selectSubcategoria.innerHTML = '<option value="">Seleccionar</option>';
            return;
        }
        fetch(`/api/subcategorias?categoria_id=${categoriaId}`)
            .then(res => res.json())
            .then(data => {
                selectSubcategoria.innerHTML = '<option value="">Seleccionar</option>';
                data.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.id;
                    opt.textContent = s.nombre;
                    selectSubcategoria.appendChild(opt);
                });
                const saved = sessionStorage.getItem('entrada_subcategoria');
                if (saved) {
                    selectSubcategoria.value = saved;
                    if (selectSubcategoria.value) {
                        cargarTallas(selectSubcategoria.value);
                        const savedTalla = sessionStorage.getItem('entrada_talla');
                        if (savedTalla) {
                            setTimeout(() => { selectTalla.value = savedTalla; }, 200);
                        }
                    }
                }
            })
            .catch(err => console.error('Error cargando subcategorías:', err));
    }

    function cargarMarcas(categoriaId) {
        if (!categoriaId) {
            selectMarca.innerHTML = '<option value="">Seleccionar</option>';
            return;
        }
        fetch(`/api/marcas?categoria_id=${categoriaId}`)
            .then(res => res.json())
            .then(data => {
                selectMarca.innerHTML = '<option value="">Seleccionar</option>';
                data.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.id;
                    opt.textContent = m.nombre;
                    selectMarca.appendChild(opt);
                });
                const saved = sessionStorage.getItem('entrada_marca');
                if (saved) selectMarca.value = saved;
            })
            .catch(err => console.error('Error cargando marcas:', err));
    }

    function cargarTallas(subcategoriaId = null) {
        const url = subcategoriaId ? `/api/tallas?subcategoria_id=${subcategoriaId}` : '/api/tallas';
        fetch(url)
            .then(res => res.json())
            .then(data => {
                selectTalla.innerHTML = '<option value="">Seleccionar talla</option>';
                data.forEach(t => {
                    const opt = document.createElement('option');
                    opt.value = t.id;
                    opt.textContent = t.nombre;
                    selectTalla.appendChild(opt);
                });
                const saved = sessionStorage.getItem('entrada_talla');
                if (saved) selectTalla.value = saved;
            })
            .catch(err => console.error('Error cargando tallas:', err));
    }

    // ---------- OBTENER TASAS ----------
    function obtenerTasas() {
        fetch('/api/tasas')
            .then(res => res.json())
            .then(data => {
                tasaUsd = data.bcv_usd;
                tasaEur = data.bcv_eur;
                tasaPersonalizada = data.personalizada;
                if (inputPrecioUSD.value) {
                    calcularPrecios();
                }
            })
            .catch(err => console.error('Error obteniendo tasas:', err));
    }

    // ---------- CÁLCULO DE PRECIOS ----------
    function calcularPrecios() {
        const usd = parseFloat(inputPrecioUSD.value) || 0;
        if (usd > 0 && tasaUsd > 0 && tasaEur > 0 && tasaPersonalizada > 0) {
            const vesBcvUsd = usd * tasaUsd;
            const vesBcvEur = usd * tasaEur;
            const vesPersonalizada = usd * tasaPersonalizada;
            inputPrecioVesBcvUsd.value = formatearMontoVES(vesBcvUsd);
            inputPrecioVesBcvEur.value = formatearMontoVES(vesBcvEur);
            inputPrecioVesPersonalizada.value = formatearMontoVES(vesPersonalizada);
        } else {
            inputPrecioVesBcvUsd.value = '';
            inputPrecioVesBcvEur.value = '';
            inputPrecioVesPersonalizada.value = '';
        }
    }

    function formatearMontoVES(monto) {
        if (monto === undefined || monto === null || isNaN(monto)) {
            return '0,00';
        }
        let montoStr = monto.toFixed(2);
        let partes = montoStr.split('.');
        let enteros = partes[0];
        let decimales = partes[1];
        let enterosFormateados = enteros.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return `${enterosFormateados},${decimales}`;
    }

    // ---------- AUTOCOMPLETADO DE PRODUCTOS ----------
    function buscarProductos(query) {
        if (query.length < 2) {
            sugerenciasDiv.classList.add('hidden');
            return;
        }
        fetch(`/api/productos/buscar?q=${encodeURIComponent(query)}`)
            .then(res => res.json())
            .then(data => {
                productosCache = data;
                mostrarSugerencias(data);
            })
            .catch(err => console.error('Error buscando productos:', err));
    }

    function mostrarSugerencias(productos) {
        sugerenciasDiv.innerHTML = '';
        if (productos.length === 0) {
            sugerenciasDiv.classList.add('hidden');
            return;
        }
        productos.forEach(p => {
            const div = document.createElement('div');
            div.className = 'px-4 py-2 hover:bg-indigo-50 cursor-pointer text-sm border-b border-gray-100';
            div.textContent = `${p.nombre} (Stock: ${p.stock})`;
            div.dataset.id = p.id;
            div.addEventListener('click', function() {
                seleccionarProducto(p);
            });
            sugerenciasDiv.appendChild(div);
        });
        sugerenciasDiv.classList.remove('hidden');
    }

    function seleccionarProducto(producto) {
        inputNombre.value = producto.nombre;
        // El costo no viene en la respuesta de búsqueda, lo dejamos vacío
        inputCosto.value = '';
        if (producto.categoria_id) {
            selectCategoria.value = producto.categoria_id;
            cargarSubcategorias(producto.categoria_id);
            cargarMarcas(producto.categoria_id);
            setTimeout(() => {
                if (producto.subcategoria_id) {
                    selectSubcategoria.value = producto.subcategoria_id;
                    cargarTallas(producto.subcategoria_id);
                    setTimeout(() => {
                        if (producto.talla_id) {
                            selectTalla.value = producto.talla_id;
                        }
                    }, 200);
                }
                if (producto.marca_id) {
                    selectMarca.value = producto.marca_id;
                }
                inputPrecioUSD.value = producto.precio_usd || '';
                inputStock.value = producto.stock > 0 ? 1 : 0;
                checkSerial.checked = producto.control_serial || false;
                if (producto.control_serial) {
                    serialDiv.style.display = 'block';
                    inputSerial.value = producto.serial_number || '';
                } else {
                    serialDiv.style.display = 'none';
                    inputSerial.value = '';
                }
                calcularPrecios();
                guardarEstadoFormulario();
            }, 350);
        }
        sugerenciasDiv.classList.add('hidden');
    }

    // ---------- PERSISTENCIA DE FORMULARIO ----------
    function guardarEstadoFormulario() {
        const data = {
            nombre: inputNombre.value,
            categoria: selectCategoria.value,
            subcategoria: selectSubcategoria.value,
            marca: selectMarca.value,
            talla: selectTalla.value,
            costo_usd: inputCosto.value,        // NUEVO
            precio_usd: inputPrecioUSD.value,
            stock: inputStock.value,
            control_serial: checkSerial.checked,
            serial_number: inputSerial.value
        };
        sessionStorage.setItem('entrada_form', JSON.stringify(data));
        sessionStorage.setItem('entrada_categoria', selectCategoria.value);
        sessionStorage.setItem('entrada_subcategoria', selectSubcategoria.value);
        sessionStorage.setItem('entrada_marca', selectMarca.value);
        sessionStorage.setItem('entrada_talla', selectTalla.value);
    }

    function restaurarEstadoFormulario() {
        const saved = sessionStorage.getItem('entrada_form');
        if (!saved) return;
        try {
            const data = JSON.parse(saved);
            inputNombre.value = data.nombre || '';
            inputCosto.value = data.costo_usd || '';   // NUEVO
            if (data.categoria) {
                selectCategoria.value = data.categoria;
                cargarSubcategorias(data.categoria);
                cargarMarcas(data.categoria);
            }
            setTimeout(() => {
                if (data.subcategoria) {
                    selectSubcategoria.value = data.subcategoria;
                    if (data.subcategoria) {
                        cargarTallas(data.subcategoria);
                        setTimeout(() => {
                            if (data.talla) {
                                selectTalla.value = data.talla;
                            }
                        }, 200);
                    }
                }
                if (data.marca) selectMarca.value = data.marca;
                if (data.precio_usd) {
                    inputPrecioUSD.value = data.precio_usd;
                    calcularPrecios();
                }
                inputStock.value = data.stock || '';
                checkSerial.checked = data.control_serial || false;
                if (data.control_serial) {
                    serialDiv.style.display = 'block';
                    inputSerial.value = data.serial_number || '';
                }
            }, 400);
        } catch (e) {
            console.warn('Error restaurando formulario:', e);
        }
    }

    // ---------- VALIDACIÓN DE CAMPOS OBLIGATORIOS ----------
    function validarCampos() {
        if (!inputNombre.value.trim()) {
            alert('❌ El nombre del producto es obligatorio.');
            inputNombre.focus();
            return false;
        }
        if (!selectCategoria.value) {
            alert('❌ Debe seleccionar una categoría.');
            selectCategoria.focus();
            return false;
        }
        if (!selectSubcategoria.value) {
            alert('❌ Debe seleccionar una subcategoría.');
            selectSubcategoria.focus();
            return false;
        }
        if (!selectMarca.value) {
            alert('❌ Debe seleccionar una marca.');
            selectMarca.focus();
            return false;
        }
        if (!selectTalla.value) {
            alert('❌ Debe seleccionar una talla.');
            selectTalla.focus();
            return false;
        }
        // El costo no es obligatorio, pero si se ingresa debe ser >= 0
        const costo = parseFloat(inputCosto.value);
        if (inputCosto.value && (costo < 0 || isNaN(costo))) {
            alert('❌ El costo debe ser un número positivo o cero.');
            inputCosto.focus();
            return false;
        }
        const precio = parseFloat(inputPrecioUSD.value);
        if (!precio || precio <= 0) {
            alert('❌ El precio debe ser mayor a 0.');
            inputPrecioUSD.focus();
            return false;
        }
        const cantidad = parseInt(inputStock.value);
        if (!cantidad || cantidad <= 0) {
            alert('❌ La cantidad debe ser mayor a 0.');
            inputStock.focus();
            return false;
        }
        return true;
    }

    // ---------- EVENTOS ----------
    inputNombre.addEventListener('input', function() {
        const query = this.value.trim();
        if (timeoutBusqueda) clearTimeout(timeoutBusqueda);
        timeoutBusqueda = setTimeout(() => {
            buscarProductos(query);
        }, 300);
        guardarEstadoFormulario();
    });

    selectCategoria.addEventListener('change', function() {
        const catId = this.value;
        cargarSubcategorias(catId);
        cargarMarcas(catId);
        selectTalla.innerHTML = '<option value="">Seleccionar talla</option>';
        guardarEstadoFormulario();
    });

    selectSubcategoria.addEventListener('change', function() {
        const subcatId = this.value;
        if (subcatId) {
            cargarTallas(subcatId);
        } else {
            selectTalla.innerHTML = '<option value="">Seleccionar talla</option>';
        }
        guardarEstadoFormulario();
    });

    selectMarca.addEventListener('change', guardarEstadoFormulario);
    selectTalla.addEventListener('change', guardarEstadoFormulario);
    inputCosto.addEventListener('input', guardarEstadoFormulario);  // NUEVO
    inputPrecioUSD.addEventListener('input', function() {
        calcularPrecios();
        guardarEstadoFormulario();
    });
    inputStock.addEventListener('input', guardarEstadoFormulario);

    checkSerial.addEventListener('change', function() {
        if (this.checked) {
            serialDiv.style.display = 'block';
            inputSerial.required = true;
        } else {
            serialDiv.style.display = 'none';
            inputSerial.value = '';
            inputSerial.required = false;
        }
        guardarEstadoFormulario();
    });

    inputSerial.addEventListener('input', guardarEstadoFormulario);

    btnLimpiar.addEventListener('click', function(e) {
        e.preventDefault();
        sessionStorage.removeItem('entrada_form');
        sessionStorage.removeItem('entrada_categoria');
        sessionStorage.removeItem('entrada_subcategoria');
        sessionStorage.removeItem('entrada_marca');
        sessionStorage.removeItem('entrada_talla');
        form.reset();
        serialDiv.style.display = 'none';
        inputPrecioVesBcvUsd.value = '';
        inputPrecioVesBcvEur.value = '';
        inputPrecioVesPersonalizada.value = '';
        sugerenciasDiv.classList.add('hidden');
        selectTalla.innerHTML = '<option value="">Seleccionar talla</option>';
        cargarCategorias();
    });

    // ---------- ENVÍO DEL FORMULARIO ----------
    form.addEventListener('submit', function(e) {
        e.preventDefault();

        if (!validarCampos()) {
            return;
        }

        const data = {
            nombre: inputNombre.value.trim(),
            marca_id: parseInt(selectMarca.value) || null,
            categoria_id: parseInt(selectCategoria.value) || null,
            subcategoria_id: parseInt(selectSubcategoria.value) || null,
            talla_id: parseInt(selectTalla.value) || null,
            costo_usd: parseFloat(inputCosto.value) || 0,   // NUEVO
            precio_usd: parseFloat(inputPrecioUSD.value) || 0,
            stock: parseInt(inputStock.value) || 0,
            control_serial: checkSerial.checked,
            serial_number: inputSerial.value.trim() || null
        };

        fetch('/api/productos', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        })
        .then(res => res.json())
        .then(res => {
            if (res.actualizado) {
                alert(res.mensaje || `✅ Stock actualizado. Nuevo stock total: ${res.stock}`);
            } else {
                alert(res.mensaje || '✅ Producto registrado correctamente');
            }
            if (res.id) {
                sessionStorage.removeItem('entrada_form');
                sessionStorage.removeItem('entrada_categoria');
                sessionStorage.removeItem('entrada_subcategoria');
                sessionStorage.removeItem('entrada_marca');
                sessionStorage.removeItem('entrada_talla');
                form.reset();
                serialDiv.style.display = 'none';
                inputPrecioVesBcvUsd.value = '';
                inputPrecioVesBcvEur.value = '';
                inputPrecioVesPersonalizada.value = '';
                sugerenciasDiv.classList.add('hidden');
                selectTalla.innerHTML = '<option value="">Seleccionar talla</option>';
                cargarCategorias();
            }
        })
        .catch(err => alert('Error: ' + err));
    });

    document.addEventListener('click', function(e) {
        if (!e.target.closest('#nombre') && !e.target.closest('#sugerencias')) {
            sugerenciasDiv.classList.add('hidden');
        }
    });

    // ---------- INICIALIZACIÓN ----------
    function init() {
        obtenerTasas();
        cargarCategorias();
        cargarTallas();
        restaurarEstadoFormulario();
        if (inputPrecioUSD.value) {
            setTimeout(calcularPrecios, 200);
        }
    }

    init();

    setInterval(() => {
        obtenerTasas();
        if (inputPrecioUSD.value) calcularPrecios();
    }, 60000);
});