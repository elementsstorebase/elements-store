document.addEventListener('DOMContentLoaded', function() {
    // ---------- FUNCIÓN DE UTILIDAD (formateo de montos VES) ----------
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

    // ---------- MAPEO DE MÉTODOS DE COBRO PARA MOSTRAR TEXTO AMIGABLE ----------
    const MAPEO_METODO_COBRO = {
        'usd': 'Precio en USD',
        'bcv_usd': 'Tasa BCV USD',
        'bcv_eur': 'Tasa BCV EUR',
        'personalizada': 'Tasa Personalizada',
        'bs_personalizado': 'Bs Personalizado',
        'usd_personalizado': 'USD Personalizado'
    };

    // ---------- CARGAR FILTROS ----------
    cargarFiltros();

    // ---------- EVENTOS ----------
    document.getElementById('btn-filtrar').addEventListener('click', function() {
        cargarProductos();
    });

    document.getElementById('filtro-categoria').addEventListener('change', function() {
        const catId = this.value;
        cargarSubcategoriasFiltro(catId);
    });

    document.getElementById('edit-categoria').addEventListener('change', function() {
        const catId = this.value;
        cargarSubcategoriasEdit(catId);
    });

    document.getElementById('edit-subcategoria').addEventListener('change', function() {
        const subcatId = this.value;
        cargarTallasEdit(subcatId);
    });

    document.getElementById('form-editar-producto').addEventListener('submit', function(e) {
        e.preventDefault();
        guardarEdicionProducto();
    });

    document.getElementById('btn-historial-filtrar').addEventListener('click', function() {
        cargarHistorialTasas();
    });

    // Cargar productos iniciales
    cargarProductos();

    // ---------- FUNCIONES ----------
    function cargarFiltros() {
        fetch('/api/categorias')
            .then(r => r.json())
            .then(data => {
                const selectCat = document.getElementById('filtro-categoria');
                selectCat.innerHTML = '<option value="">Todas</option>';
                data.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = c.nombre;
                    selectCat.appendChild(opt);
                });
            });

        fetch('/api/marcas')
            .then(r => r.json())
            .then(data => {
                const selectMarca = document.getElementById('filtro-marca');
                selectMarca.innerHTML = '<option value="">Todas</option>';
                data.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.id;
                    opt.textContent = m.nombre;
                    selectMarca.appendChild(opt);
                });
            });

        fetch('/api/tallas')
            .then(r => r.json())
            .then(data => {
                const selectTalla = document.getElementById('filtro-talla');
                selectTalla.innerHTML = '<option value="">Todas</option>';
                data.forEach(t => {
                    const opt = document.createElement('option');
                    opt.value = t.id;
                    opt.textContent = t.nombre;
                    selectTalla.appendChild(opt);
                });
            });
    }

    function cargarSubcategoriasFiltro(categoriaId) {
        const select = document.getElementById('filtro-subcategoria');
        select.innerHTML = '<option value="">Todas</option>';
        if (!categoriaId) return;
        fetch(`/api/subcategorias?categoria_id=${categoriaId}`)
            .then(r => r.json())
            .then(data => {
                data.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.id;
                    opt.textContent = s.nombre;
                    select.appendChild(opt);
                });
            });
    }

    function cargarProductos() {
        const params = new URLSearchParams();
        const nombre = document.getElementById('filtro-nombre').value;
        const categoria = document.getElementById('filtro-categoria').value;
        const subcategoria = document.getElementById('filtro-subcategoria').value;
        const talla = document.getElementById('filtro-talla').value;
        const marca = document.getElementById('filtro-marca').value;
        const soloStock = document.getElementById('filtro-stock').checked;

        if (nombre) params.append('nombre', nombre);
        if (categoria) params.append('categoria', categoria);
        if (subcategoria) params.append('subcategoria', subcategoria);
        if (talla) params.append('talla', talla);
        if (marca) params.append('marca', marca);
        if (soloStock) params.append('solo_stock', 'true');

        fetch(`/api/productos?${params}`)
            .then(r => r.json())
            .then(data => {
                const tbody = document.getElementById('tabla-inventario');
                tbody.innerHTML = '';
                if (data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-gray-400">No hay productos</td></tr>';
                    return;
                }
                data.forEach(p => {
                    const tr = document.createElement('tr');
                    tr.className = 'border-b border-gray-100';
                    const stockClass = p.stock > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
                    const stockText = p.stock > 0 ? p.stock : 'Sin stock';
                    const costoMostrar = p.costo_usd ? `$${p.costo_usd.toFixed(2)}` : '-';
                    tr.innerHTML = `
                        <td class="py-2">${p.nombre}</td>
                        <td>${p.marca || ''}</td>
                        <td>${p.categoria || ''}</td>
                        <td>${p.subcategoria || ''}</td>
                        <td>${p.talla || ''}</td>
                        <td class="text-right">${costoMostrar}</td>
                        <td class="text-right">$${p.precio_usd.toFixed(2)}</td>
                        <td class="text-center">
                            <span class="px-2 py-1 rounded-full text-xs ${stockClass}">
                                ${stockText}
                            </span>
                        </td>
                        <td class="text-right">
                            <button onclick="editarProducto(${p.id})" class="text-indigo-600 hover:text-indigo-800 mr-2" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="eliminarProducto(${p.id})" class="text-red-500 hover:text-red-700 mr-2" title="Eliminar">
                                <i class="fas fa-trash"></i>
                            </button>
                            <button onclick="verHistorial(${p.id})" class="text-blue-500 hover:text-blue-700 mr-2" title="Historial de Tasas">
                                <i class="fas fa-history"></i>
                            </button>
                            <button onclick="verHistorialVentas(${p.id})" class="text-green-500 hover:text-green-700" title="Historial de Ventas">
                                <i class="fas fa-shopping-cart"></i>
                            </button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            })
            .catch(err => console.error('Error cargando productos:', err));
    }

    // ---------- EDITAR PRODUCTO ----------
    window.editarProducto = function(id) {
        fetch(`/api/productos/${id}`)
            .then(r => r.json())
            .then(data => {
                document.getElementById('edit-producto-id').value = data.id;
                document.getElementById('edit-nombre').value = data.nombre;
                document.getElementById('edit-costo_usd').value = data.costo_usd || '';
                document.getElementById('edit-precio_usd').value = data.precio_usd;
                document.getElementById('edit-stock').value = data.stock;
                document.getElementById('edit-control_serial').checked = data.control_serial;
                document.getElementById('edit-serial_number').value = data.serial_number || '';
                document.getElementById('edit-serial_div').style.display = data.control_serial ? 'block' : 'none';

                cargarSelectsEdit(data);
                document.getElementById('modal-editar').classList.remove('hidden');
            })
            .catch(err => console.error('Error cargando producto para editar:', err));
    };

    function cargarSelectsEdit(producto) {
        fetch('/api/categorias')
            .then(r => r.json())
            .then(data => {
                const select = document.getElementById('edit-categoria');
                select.innerHTML = '<option value="">Seleccionar</option>';
                data.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = c.nombre;
                    if (c.id === producto.categoria_id) opt.selected = true;
                    select.appendChild(opt);
                });
                if (producto.categoria_id) {
                    cargarSubcategoriasEdit(producto.categoria_id, producto.subcategoria_id);
                    cargarMarcasEdit(producto.categoria_id, producto.marca_id);
                    if (producto.subcategoria_id) {
                        cargarTallasEdit(producto.subcategoria_id, producto.talla_id);
                    }
                }
            });
    }

    function cargarSubcategoriasEdit(categoriaId, selectedId = null) {
        const select = document.getElementById('edit-subcategoria');
        select.innerHTML = '<option value="">Seleccionar</option>';
        if (!categoriaId) return;
        fetch(`/api/subcategorias?categoria_id=${categoriaId}`)
            .then(r => r.json())
            .then(data => {
                data.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.id;
                    opt.textContent = s.nombre;
                    if (s.id === selectedId) opt.selected = true;
                    select.appendChild(opt);
                });
            });
    }

    function cargarMarcasEdit(categoriaId, selectedId = null) {
        const select = document.getElementById('edit-marca');
        select.innerHTML = '<option value="">Seleccionar</option>';
        if (!categoriaId) return;
        fetch(`/api/marcas?categoria_id=${categoriaId}`)
            .then(r => r.json())
            .then(data => {
                data.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.id;
                    opt.textContent = m.nombre;
                    if (m.id === selectedId) opt.selected = true;
                    select.appendChild(opt);
                });
            });
    }

    function cargarTallasEdit(subcategoriaId, selectedId = null) {
        const select = document.getElementById('edit-talla');
        select.innerHTML = '<option value="">Seleccionar</option>';
        if (!subcategoriaId) return;
        fetch(`/api/tallas?subcategoria_id=${subcategoriaId}`)
            .then(r => r.json())
            .then(data => {
                data.forEach(t => {
                    const opt = document.createElement('option');
                    opt.value = t.id;
                    opt.textContent = t.nombre;
                    if (t.id === selectedId) opt.selected = true;
                    select.appendChild(opt);
                });
            });
    }

    function guardarEdicionProducto() {
        const id = document.getElementById('edit-producto-id').value;
        const data = {
            nombre: document.getElementById('edit-nombre').value.trim(),
            marca_id: parseInt(document.getElementById('edit-marca').value) || null,
            categoria_id: parseInt(document.getElementById('edit-categoria').value) || null,
            subcategoria_id: parseInt(document.getElementById('edit-subcategoria').value) || null,
            talla_id: parseInt(document.getElementById('edit-talla').value) || null,
            costo_usd: parseFloat(document.getElementById('edit-costo_usd').value) || 0,
            precio_usd: parseFloat(document.getElementById('edit-precio_usd').value) || 0,
            stock: parseInt(document.getElementById('edit-stock').value) || 0,
            control_serial: document.getElementById('edit-control_serial').checked,
            serial_number: document.getElementById('edit-serial_number').value.trim()
        };

        fetch(`/api/productos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        .then(r => r.json())
        .then(res => {
            alert(res.mensaje || 'Producto actualizado');
            cerrarModal('modal-editar');
            cargarProductos();
        })
        .catch(err => alert('Error: ' + err));
    }

    // ---------- ELIMINAR PRODUCTO ----------
    window.eliminarProducto = function(id) {
        // Primero se consulta QUÉ va a pasar, para avisar con claridad.
        fetch(`/api/productos/${id}/previsualizar-eliminacion`, { credentials: 'same-origin' })
            .then(function (r) {
                const tipo = r.headers.get('Content-Type') || '';
                if (tipo.indexOf('application/json') === -1) {
                    throw new Error('El servidor respondió con un error ' + r.status + '.');
                }
                return r.json();
            })
            .then(function (info) {
                if (info.error) throw new Error(info.motivo || info.error);

                const nombre = (info.producto && info.producto.nombre) || 'este producto';

                // Bloqueo único: alguien está pagando el producto ahora mismo.
                if (!info.puede_eliminar) {
                    const b = (info.bloqueos && info.bloqueos[0]) || {};
                    alert('No se puede eliminar todavía\n\n' +
                          (b.mensaje || 'Hay un apartado en curso.') +
                          '\n\n💡 Finaliza o reintegra ese apartado y luego podrás eliminarlo.');
                    return;
                }

                const c = info.se_conserva || {};
                let msg = '¿Eliminar "' + nombre + '" del inventario?\n\n';
                if (c.ventas > 0 || c.apartados_total > 0) {
                    msg += 'Se CONSERVA en el historial:\n';
                    if (c.ventas > 0) msg += '  • ' + c.ventas + ' línea(s) de venta en tickets ya emitidos\n';
                    if (c.apartados_finalizados > 0) msg += '  • ' + c.apartados_finalizados + ' apartado(s) finalizados (Deudas Finalizadas)\n';
                    msg += '\nEsos registros seguirán mostrando el nombre del producto.\n\n';
                }
                msg += 'DESAPARECE del inventario de forma permanente.\n\nEsta acción no se puede deshacer.';

                if (!confirm(msg)) return;
                ejecutarEliminacionProducto(id);
            })
            .catch(function (err) { alert('Error: ' + err.message); });
    };

    function ejecutarEliminacionProducto(id) {
        fetch(`/api/productos/${id}`, { method: 'DELETE', credentials: 'same-origin' })
            .then(function (r) {
                // 🔥 Si el servidor devuelve HTML, r.json() lanzaba:
                // Unexpected token '<', "<!doctype "...  Ahora se comprueba antes.
                const tipo = r.headers.get('Content-Type') || '';
                if (tipo.indexOf('application/json') === -1) {
                    if (r.status === 401 || r.status === 403) {
                        throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
                    }
                    throw new Error('El servidor respondió con un error ' + r.status + '.');
                }
                return r.json().then(function (cuerpo) {
                    return { ok: r.ok, status: r.status, cuerpo: cuerpo };
                });
            })
            .then(function (res) {
                if (!res.ok) {
                    let msg = res.cuerpo.error || 'No se pudo eliminar el producto';
                    if (res.cuerpo.motivo) msg += '\n\n' + res.cuerpo.motivo;
                    if (res.cuerpo.sugerencia) msg += '\n\n💡 ' + res.cuerpo.sugerencia;
                    alert(msg);
                    return;
                }
                alert('✅ ' + (res.cuerpo.detalle || res.cuerpo.mensaje || 'Producto eliminado'));
                cargarProductos();
            })
            .catch(function (err) { alert('Error: ' + err.message); });
    }

    // ---------- HISTORIAL DE TASAS ----------
    window.verHistorial = function(productoId) {
        document.getElementById('modal-historial').classList.remove('hidden');
        document.getElementById('tabla-historial').innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-400">Cargando historial...</td></tr>';
        const hoy = new Date();
        const hace30Dias = new Date(hoy);
        hace30Dias.setDate(hoy.getDate() - 30);
        document.getElementById('historial-fecha-desde').value = hace30Dias.toISOString().split('T')[0];
        document.getElementById('historial-fecha-hasta').value = hoy.toISOString().split('T')[0];
        cargarHistorialTasas();
    };

    function cargarHistorialTasas() {
        const desde = document.getElementById('historial-fecha-desde').value;
        const hasta = document.getElementById('historial-fecha-hasta').value;
        if (!desde || !hasta) {
            alert('Seleccione un rango de fechas');
            return;
        }

        fetch(`/api/historial/tasas?fecha_desde=${desde}&fecha_hasta=${hasta}`)
            .then(r => r.json())
            .then(data => {
                const tbody = document.getElementById('tabla-historial');
                tbody.innerHTML = '';
                if (data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-400">No hay registros de tasas en este período</td></tr>';
                    return;
                }
                data.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.className = 'border-b border-gray-100';
                    tr.innerHTML = `
                        <td class="py-2 px-3">${item.fecha}</td>
                        <td class="px-3 text-right">${item.usd_bcv.toFixed(2)}</td>
                        <td class="px-3 text-right">${item.eur_bcv.toFixed(2)}</td>
                        <td class="px-3 text-right">${item.personalizada.toFixed(2)}</td>
                    `;
                    tbody.appendChild(tr);
                });
            })
            .catch(err => {
                console.error('Error cargando historial:', err);
                document.getElementById('tabla-historial').innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-400">Error al cargar historial</td></tr>';
            });
    }

    // ---------- HISTORIAL DE VENTAS DE UN PRODUCTO (CORREGIDO) ----------
    window.verHistorialVentas = function(productoId) {
        const modal = document.getElementById('modal-historial-ventas');
        const tbody = document.getElementById('tabla-historial-ventas');
        tbody.innerHTML = '<tr><td colspan="10" class="text-center py-4 text-gray-400">Cargando historial de ventas...</td></tr>';
        modal.classList.remove('hidden');

        fetch(`/api/productos/${productoId}`)
            .then(r => r.json())
            .then(producto => {
                document.getElementById('hv-producto-nombre').textContent = producto.nombre;
                document.getElementById('hv-producto-precio').textContent = producto.precio_usd.toFixed(2);
            })
            .catch(err => console.error('Error obteniendo producto:', err));

        fetch(`/api/productos/${productoId}/ventas`)
            .then(r => r.json())
            .then(data => {
                tbody.innerHTML = '';
                if (data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="10" class="text-center py-4 px-4 text-gray-400">Este producto no tiene ventas registradas</td></tr>';
                    return;
                }
                data.forEach(v => {
                    const tr = document.createElement('tr');
                    tr.className = 'border-b border-gray-100';
                    let totalMostrar = '';
                    if (v.moneda_cobro === 'USD') {
                        totalMostrar = `$${v.total_cobro.toFixed(2)}`;
                    } else {
                        totalMostrar = `Bs ${formatearMontoVES(v.total_cobro)}`;
                    }

                    // Mapear método de cobro a texto amigable
                    const metodoCobroLegible = MAPEO_METODO_COBRO[v.metodo_cobro] || v.metodo_cobro;

                    tr.innerHTML = `
                        <td class="py-2 px-4">${v.fecha}</td>
                        <td class="px-4">${v.cliente}</td>
                        <td class="px-4">${v.cedula}</td>
                        <td class="px-4 text-right">${v.cantidad}</td>
                        <td class="px-4 text-right">$${v.precio_unitario_usd.toFixed(2)}</td>
                        <td class="px-4 text-right whitespace-nowrap">Bs ${formatearMontoVES(v.precio_unitario_ves)}</td>
                        <td class="px-4">${v.metodo_pago || '-'}</td>
                        <td class="px-4">${metodoCobroLegible}</td>
                        <td class="px-4 text-right">${v.tasa_aplicada ? v.tasa_aplicada.toFixed(2) : '-'}</td>
                        <td class="px-4 text-right font-medium whitespace-nowrap">${totalMostrar}</td>
                    `;
                    tbody.appendChild(tr);
                });
            })
            .catch(err => {
                console.error('Error cargando historial de ventas:', err);
                tbody.innerHTML = '<tr><td colspan="10" class="text-center py-4 px-4 text-red-400">Error al cargar historial de ventas</td></tr>';
            });
    };

    // ---------- UTILIDAD ----------
    window.cerrarModal = function(id) {
        document.getElementById(id).classList.add('hidden');
    };
});
