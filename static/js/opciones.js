// opciones.js - Gestión de catálogo (Categorías, Subcategorías, Marcas, Tallas, Configuración Ticket)

// ---------- ESTADO DE PAGINACIÓN Y BÚSQUEDA ----------
const estado = {
    categorias: { page: 1, per_page: 25, search: '' },
    subcategorias: { page: 1, per_page: 25, search: '' },
    marcas: { page: 1, per_page: 25, search: '' },
    tallas: { page: 1, per_page: 25, search: '' }
};

document.addEventListener('DOMContentLoaded', function() {
    const tabs = document.querySelectorAll('.tab-btn');
    const panes = {
        categorias: document.getElementById('tab-categorias'),
        subcategorias: document.getElementById('tab-subcategorias'),
        marcas: document.getElementById('tab-marcas'),
        tallas: document.getElementById('tab-tallas'),
        ticket: document.getElementById('tab-ticket')  // Nueva pestaña
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Quitar active de todas
            tabs.forEach(t => {
                t.classList.remove('text-indigo-600', 'border-indigo-600');
                t.classList.add('text-gray-500', 'border-transparent');
            });
            // Activar esta
            this.classList.add('text-indigo-600', 'border-indigo-600');
            this.classList.remove('text-gray-500', 'border-transparent');

            // Ocultar todos los panes
            Object.values(panes).forEach(p => p.classList.add('hidden'));
            // Mostrar el pane correspondiente
            const tabName = this.dataset.tab;
            if (panes[tabName]) {
                panes[tabName].classList.remove('hidden');
                cargarDatos(tabName);
            }
        });
    });

    // Cargar datos iniciales (Categorías)
    cargarDatos('categorias');

    // Configurar eventos de formularios
    document.getElementById('form-categoria').addEventListener('submit', guardarCategoria);
    document.getElementById('form-subcategoria').addEventListener('submit', guardarSubcategoria);
    document.getElementById('form-marca').addEventListener('submit', guardarMarca);
    document.getElementById('form-talla').addEventListener('submit', guardarTalla);
    document.getElementById('form-config-ticket').addEventListener('submit', guardarConfigTicket);

    // Cargar configuración del ticket al inicio
    cargarConfigTicket();

    // ---------- EVENTOS DE BÚSQUEDA Y PAGINACIÓN ----------
    const entidades = ['categorias', 'subcategorias', 'marcas', 'tallas'];
    entidades.forEach(ent => {
        // Botón de búsqueda
        const btnBuscar = document.getElementById(`btn-buscar-${ent}`);
        if (btnBuscar) {
            btnBuscar.addEventListener('click', function() {
                const input = document.getElementById(`buscar-${ent}`);
                if (input) {
                    estado[ent].search = input.value.trim();
                    estado[ent].page = 1; // Reiniciar a primera página al buscar
                    cargarDatos(ent);
                }
            });
        }
        // Input de búsqueda: buscar al presionar Enter
        const inputBuscar = document.getElementById(`buscar-${ent}`);
        if (inputBuscar) {
            inputBuscar.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    const btn = document.getElementById(`btn-buscar-${ent}`);
                    if (btn) btn.click();
                }
            });
        }
        // Select de elementos por página
        const perPageSelect = document.getElementById(`per-page-${ent}`);
        if (perPageSelect) {
            perPageSelect.addEventListener('change', function() {
                estado[ent].per_page = parseInt(this.value);
                estado[ent].page = 1; // Reiniciar a primera página al cambiar per_page
                cargarDatos(ent);
            });
        }
        // Botón Anterior
        const prevBtn = document.getElementById(`prev-${ent}`);
        if (prevBtn) {
            prevBtn.addEventListener('click', function() {
                if (estado[ent].page > 1) {
                    estado[ent].page--;
                    cargarDatos(ent);
                }
            });
        }
        // Botón Siguiente
        const nextBtn = document.getElementById(`next-${ent}`);
        if (nextBtn) {
            nextBtn.addEventListener('click', function() {
                estado[ent].page++;
                cargarDatos(ent);
            });
        }
    });
});

// ---------- UTILIDADES ----------
function cerrarModal(id) {
    document.getElementById(id).classList.add('hidden');
}

function abrirModal(modalId, titleId, title, formId, data = null) {
    const modal = document.getElementById(modalId);
    const titleEl = document.getElementById(titleId);
    const form = document.getElementById(formId);
    
    form.reset();
    const hiddenInput = form.querySelector('input[type="hidden"]');
    if (hiddenInput) hiddenInput.value = '';
    
    titleEl.textContent = title;
    
    if (data) {
        const inputs = form.querySelectorAll('input, select');
        inputs.forEach(input => {
            let fieldName = input.id;
            if (fieldName) {
                const prefix = formId.split('-')[1] + '-';
                if (fieldName.startsWith(prefix)) {
                    fieldName = fieldName.substring(prefix.length);
                }
                if (fieldName === 'categoria' && data.categoria_id !== undefined) {
                    input.value = data.categoria_id;
                } else if (fieldName === 'subcategoria' && data.subcategoria_id !== undefined) {
                    input.value = data.subcategoria_id;
                } else if (data[fieldName] !== undefined) {
                    input.value = data[fieldName];
                }
            }
        });
        if (data.id && hiddenInput) {
            hiddenInput.value = data.id;
        }
    }
    
    modal.classList.remove('hidden');
}

// ---------- CRUD CATEGORÍAS ----------
function cargarCategorias() {
    const params = new URLSearchParams();
    params.append('page', estado.categorias.page);
    params.append('per_page', estado.categorias.per_page);
    if (estado.categorias.search) params.append('search', estado.categorias.search);

    fetch('/api/categorias?' + params.toString())
        .then(res => res.json())
        .then(data => {
            const tbody = document.getElementById('tabla-categorias');
            tbody.innerHTML = '';
            if (data.items && data.items.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-400">No hay categorías</td></tr>';
            } else if (data.items) {
                data.items.forEach(c => {
                    const tr = document.createElement('tr');
                    tr.className = 'border-b border-gray-100';
                    tr.innerHTML = `
                        <td class="py-2">${c.id}</td>
                        <td>${c.nombre}</td>
                        <td>${c.subcategorias_count || 0}</td>
                        <td>${c.marcas_count || 0}</td>
                        <td class="text-right">
                            <button onclick="editarCategoria(${c.id})" class="text-indigo-600 hover:text-indigo-800 mr-2">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="eliminarCategoria(${c.id})" class="text-red-500 hover:text-red-700">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                // Fallback si la respuesta no tiene paginación (ej. lista plana)
                if (data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-400">No hay categorías</td></tr>';
                } else {
                    data.forEach(c => {
                        const tr = document.createElement('tr');
                        tr.className = 'border-b border-gray-100';
                        tr.innerHTML = `
                            <td class="py-2">${c.id}</td>
                            <td>${c.nombre}</td>
                            <td>${c.subcategorias_count || 0}</td>
                            <td>${c.marcas_count || 0}</td>
                            <td class="text-right">
                                <button onclick="editarCategoria(${c.id})" class="text-indigo-600 hover:text-indigo-800 mr-2">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button onclick="eliminarCategoria(${c.id})" class="text-red-500 hover:text-red-700">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        `;
                        tbody.appendChild(tr);
                    });
                }
                // Actualizar info de paginación si no hay metadatos
                actualizarInfoPaginacion('categorias', data.length, 1, 1, data.length);
                return;
            }

            // Actualizar controles de paginación
            actualizarInfoPaginacion('categorias', data.total, data.page, data.pages, data.per_page);
        })
        .catch(err => {
            console.error('Error cargando categorías:', err);
            document.getElementById('tabla-categorias').innerHTML = '<tr><td colspan="5" class="text-center py-4 text-red-500">Error al cargar datos</td></tr>';
        });
}

function abrirModalCategoria(data = null) {
    abrirModal('modal-categoria', 'modal-categoria-title', data ? 'Editar Categoría' : 'Nueva Categoría', 'form-categoria', data);
}

function editarCategoria(id) {
    fetch(`/api/categorias/${id}`)
        .then(res => res.json())
        .then(data => {
            abrirModalCategoria({ id: data.id, nombre: data.nombre });
        })
        .catch(err => console.error('Error obteniendo categoría:', err));
}

function eliminarCategoria(id) {
    if (!confirm('¿Estás seguro de eliminar esta categoría? Se eliminarán también sus subcategorías y marcas asociadas.')) return;
    fetch(`/api/categorias/${id}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(data => {
            alert(data.mensaje || 'Categoría eliminada');
            cargarCategorias();
            cargarSelectsCategorias();
            cargarSelectsSubcategorias();
        })
        .catch(err => alert('Error: ' + err));
}

function guardarCategoria(e) {
    e.preventDefault();
    const id = document.getElementById('categoria-id').value;
    const nombre = document.getElementById('categoria-nombre').value.trim();
    if (!nombre) {
        alert('El nombre es requerido');
        return;
    }
    const url = id ? `/api/categorias/${id}` : '/api/categorias';
    const method = id ? 'PUT' : 'POST';
    fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.mensaje || 'Categoría guardada');
        cerrarModal('modal-categoria');
        cargarCategorias();
        cargarSelectsCategorias();
        cargarSelectsSubcategorias();
    })
    .catch(err => alert('Error: ' + err));
}

// ---------- CRUD SUBCATEGORÍAS ----------
function cargarSubcategorias() {
    const params = new URLSearchParams();
    params.append('page', estado.subcategorias.page);
    params.append('per_page', estado.subcategorias.per_page);
    if (estado.subcategorias.search) params.append('search', estado.subcategorias.search);

    fetch('/api/subcategorias?' + params.toString())
        .then(res => res.json())
        .then(data => {
            const tbody = document.getElementById('tabla-subcategorias');
            tbody.innerHTML = '';
            if (data.items && data.items.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-400">No hay subcategorías</td></tr>';
            } else if (data.items) {
                data.items.forEach(s => {
                    const tr = document.createElement('tr');
                    tr.className = 'border-b border-gray-100';
                    tr.innerHTML = `
                        <td class="py-2">${s.id}</td>
                        <td>${s.nombre}</td>
                        <td>${s.categoria_nombre || 'Sin categoría'}</td>
                        <td class="text-right">
                            <button onclick="editarSubcategoria(${s.id})" class="text-indigo-600 hover:text-indigo-800 mr-2">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="eliminarSubcategoria(${s.id})" class="text-red-500 hover:text-red-700">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                if (data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-400">No hay subcategorías</td></tr>';
                } else {
                    data.forEach(s => {
                        const tr = document.createElement('tr');
                        tr.className = 'border-b border-gray-100';
                        tr.innerHTML = `
                            <td class="py-2">${s.id}</td>
                            <td>${s.nombre}</td>
                            <td>${s.categoria_nombre || 'Sin categoría'}</td>
                            <td class="text-right">
                                <button onclick="editarSubcategoria(${s.id})" class="text-indigo-600 hover:text-indigo-800 mr-2">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button onclick="eliminarSubcategoria(${s.id})" class="text-red-500 hover:text-red-700">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        `;
                        tbody.appendChild(tr);
                    });
                }
                actualizarInfoPaginacion('subcategorias', data.length, 1, 1, data.length);
                return;
            }
            actualizarInfoPaginacion('subcategorias', data.total, data.page, data.pages, data.per_page);
        })
        .catch(err => {
            console.error('Error cargando subcategorías:', err);
            document.getElementById('tabla-subcategorias').innerHTML = '<tr><td colspan="4" class="text-center py-4 text-red-500">Error al cargar datos</td></tr>';
        });
}

function abrirModalSubcategoria(data = null) {
    cargarSelectsCategorias('subcategoria-categoria');
    abrirModal('modal-subcategoria', 'modal-subcategoria-title', data ? 'Editar Subcategoría' : 'Nueva Subcategoría', 'form-subcategoria', data);
}

function editarSubcategoria(id) {
    fetch(`/api/subcategorias/${id}`)
        .then(res => res.json())
        .then(data => {
            abrirModalSubcategoria({
                id: data.id,
                nombre: data.nombre,
                categoria_id: data.categoria_id
            });
        })
        .catch(err => console.error('Error obteniendo subcategoría:', err));
}

function eliminarSubcategoria(id) {
    if (!confirm('¿Estás seguro de eliminar esta subcategoría?')) return;
    fetch(`/api/subcategorias/${id}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(data => {
            alert(data.mensaje || 'Subcategoría eliminada');
            cargarSubcategorias();
            cargarSelectsSubcategorias();
        })
        .catch(err => alert('Error: ' + err));
}

function guardarSubcategoria(e) {
    e.preventDefault();
    const id = document.getElementById('subcategoria-id').value;
    const nombre = document.getElementById('subcategoria-nombre').value.trim();
    const categoria_id = document.getElementById('subcategoria-categoria').value;
    if (!nombre || !categoria_id) {
        alert('Nombre y categoría son requeridos');
        return;
    }
    const url = id ? `/api/subcategorias/${id}` : '/api/subcategorias';
    const method = id ? 'PUT' : 'POST';
    fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, categoria_id: parseInt(categoria_id) })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.mensaje || 'Subcategoría guardada');
        cerrarModal('modal-subcategoria');
        cargarSubcategorias();
        cargarSelectsSubcategorias();
    })
    .catch(err => alert('Error: ' + err));
}

// ---------- CRUD MARCAS ----------
function cargarMarcas() {
    const params = new URLSearchParams();
    params.append('page', estado.marcas.page);
    params.append('per_page', estado.marcas.per_page);
    if (estado.marcas.search) params.append('search', estado.marcas.search);

    fetch('/api/marcas?' + params.toString())
        .then(res => res.json())
        .then(data => {
            const tbody = document.getElementById('tabla-marcas');
            tbody.innerHTML = '';
            if (data.items && data.items.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-400">No hay marcas</td></tr>';
            } else if (data.items) {
                data.items.forEach(m => {
                    const tr = document.createElement('tr');
                    tr.className = 'border-b border-gray-100';
                    tr.innerHTML = `
                        <td class="py-2">${m.id}</td>
                        <td>${m.nombre}</td>
                        <td>${m.categoria_nombre || 'Sin categoría'}</td>
                        <td class="text-right">
                            <button onclick="editarMarca(${m.id})" class="text-indigo-600 hover:text-indigo-800 mr-2">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="eliminarMarca(${m.id})" class="text-red-500 hover:text-red-700">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                if (data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-400">No hay marcas</td></tr>';
                } else {
                    data.forEach(m => {
                        const tr = document.createElement('tr');
                        tr.className = 'border-b border-gray-100';
                        tr.innerHTML = `
                            <td class="py-2">${m.id}</td>
                            <td>${m.nombre}</td>
                            <td>${m.categoria_nombre || 'Sin categoría'}</td>
                            <td class="text-right">
                                <button onclick="editarMarca(${m.id})" class="text-indigo-600 hover:text-indigo-800 mr-2">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button onclick="eliminarMarca(${m.id})" class="text-red-500 hover:text-red-700">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        `;
                        tbody.appendChild(tr);
                    });
                }
                actualizarInfoPaginacion('marcas', data.length, 1, 1, data.length);
                return;
            }
            actualizarInfoPaginacion('marcas', data.total, data.page, data.pages, data.per_page);
        })
        .catch(err => {
            console.error('Error cargando marcas:', err);
            document.getElementById('tabla-marcas').innerHTML = '<tr><td colspan="4" class="text-center py-4 text-red-500">Error al cargar datos</td></tr>';
        });
}

function abrirModalMarca(data = null) {
    cargarSelectsCategorias('marca-categoria');
    abrirModal('modal-marca', 'modal-marca-title', data ? 'Editar Marca' : 'Nueva Marca', 'form-marca', data);
}

function editarMarca(id) {
    fetch(`/api/marcas/${id}`)
        .then(res => res.json())
        .then(data => {
            abrirModalMarca({
                id: data.id,
                nombre: data.nombre,
                categoria_id: data.categoria_id
            });
        })
        .catch(err => console.error('Error obteniendo marca:', err));
}

function eliminarMarca(id) {
    if (!confirm('¿Estás seguro de eliminar esta marca?')) return;
    fetch(`/api/marcas/${id}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(data => {
            alert(data.mensaje || 'Marca eliminada');
            cargarMarcas();
        })
        .catch(err => alert('Error: ' + err));
}

function guardarMarca(e) {
    e.preventDefault();
    const id = document.getElementById('marca-id').value;
    const nombre = document.getElementById('marca-nombre').value.trim();
    const categoria_id = document.getElementById('marca-categoria').value;
    if (!nombre || !categoria_id) {
        alert('Nombre y categoría son requeridos');
        return;
    }
    const url = id ? `/api/marcas/${id}` : '/api/marcas';
    const method = id ? 'PUT' : 'POST';
    fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, categoria_id: parseInt(categoria_id) })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.mensaje || 'Marca guardada');
        cerrarModal('modal-marca');
        cargarMarcas();
    })
    .catch(err => alert('Error: ' + err));
}

// ---------- CRUD TALLAS ----------
function cargarTallas() {
    const params = new URLSearchParams();
    params.append('page', estado.tallas.page);
    params.append('per_page', estado.tallas.per_page);
    if (estado.tallas.search) params.append('search', estado.tallas.search);

    fetch('/api/tallas?' + params.toString())
        .then(res => res.json())
        .then(data => {
            const tbody = document.getElementById('tabla-tallas');
            tbody.innerHTML = '';
            if (data.items && data.items.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-400">No hay tallas</td></tr>';
            } else if (data.items) {
                data.items.forEach(t => {
                    const tr = document.createElement('tr');
                    tr.className = 'border-b border-gray-100';
                    tr.innerHTML = `
                        <td class="py-2">${t.id}</td>
                        <td>${t.nombre}</td>
                        <td>${t.subcategoria_nombre || 'Sin subcategoría'}</td>
                        <td class="text-right">
                            <button onclick="editarTalla(${t.id})" class="text-indigo-600 hover:text-indigo-800 mr-2">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="eliminarTalla(${t.id})" class="text-red-500 hover:text-red-700">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                if (data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-400">No hay tallas</td></tr>';
                } else {
                    data.forEach(t => {
                        const tr = document.createElement('tr');
                        tr.className = 'border-b border-gray-100';
                        tr.innerHTML = `
                            <td class="py-2">${t.id}</td>
                            <td>${t.nombre}</td>
                            <td>${t.subcategoria_nombre || 'Sin subcategoría'}</td>
                            <td class="text-right">
                                <button onclick="editarTalla(${t.id})" class="text-indigo-600 hover:text-indigo-800 mr-2">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button onclick="eliminarTalla(${t.id})" class="text-red-500 hover:text-red-700">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        `;
                        tbody.appendChild(tr);
                    });
                }
                actualizarInfoPaginacion('tallas', data.length, 1, 1, data.length);
                return;
            }
            actualizarInfoPaginacion('tallas', data.total, data.page, data.pages, data.per_page);
        })
        .catch(err => {
            console.error('Error cargando tallas:', err);
            document.getElementById('tabla-tallas').innerHTML = '<tr><td colspan="4" class="text-center py-4 text-red-500">Error al cargar datos</td></tr>';
        });
}

function abrirModalTalla(data = null) {
    cargarSelectsSubcategorias('talla-subcategoria');
    abrirModal('modal-talla', 'modal-talla-title', data ? 'Editar Talla' : 'Nueva Talla', 'form-talla', data);
}

function editarTalla(id) {
    fetch(`/api/tallas/${id}`)
        .then(res => res.json())
        .then(data => {
            abrirModalTalla({
                id: data.id,
                nombre: data.nombre,
                subcategoria_id: data.subcategoria_id
            });
        })
        .catch(err => console.error('Error obteniendo talla:', err));
}

function eliminarTalla(id) {
    if (!confirm('¿Estás seguro de eliminar esta talla?')) return;
    fetch(`/api/tallas/${id}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(data => {
            alert(data.mensaje || 'Talla eliminada');
            cargarTallas();
        })
        .catch(err => alert('Error: ' + err));
}

function guardarTalla(e) {
    e.preventDefault();
    const id = document.getElementById('talla-id').value;
    const nombre = document.getElementById('talla-nombre').value.trim();
    const subcategoria_id = document.getElementById('talla-subcategoria').value;
    if (!nombre || !subcategoria_id) {
        alert('Nombre y subcategoría son requeridos');
        return;
    }
    const url = id ? `/api/tallas/${id}` : '/api/tallas';
    const method = id ? 'PUT' : 'POST';
    fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, subcategoria_id: parseInt(subcategoria_id) })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.mensaje || 'Talla guardada');
        cerrarModal('modal-talla');
        cargarTallas();
    })
    .catch(err => alert('Error: ' + err));
}

// ---------- CONFIGURACIÓN DEL TICKET VIRTUAL (AMPLIADA con dirección de tienda) ----------
function cargarConfigTicket() {
    fetch('/api/config/ticket')
        .then(res => res.json())
        .then(data => {
            // Datos de la tienda
            document.getElementById('ticket-tienda-nombre').value = data.ticket_tienda_nombre || '';
            document.getElementById('ticket-rif').value = data.ticket_rif || '';
            document.getElementById('ticket-telefono-tienda').value = data.ticket_telefono_tienda || '';
            // NUEVO: Dirección de la tienda
            document.getElementById('ticket-direccion-tienda').value = data.ticket_direccion_tienda || '';

            // Visibilidad
            document.getElementById('ticket-mostrar-rif').checked = data.ticket_mostrar_rif === 'true';
            document.getElementById('ticket-mostrar-telefono').checked = data.ticket_mostrar_telefono === 'true';
            document.getElementById('ticket-mostrar-direccion-cliente').checked = data.ticket_mostrar_direccion_cliente === 'true';
            // NUEVO: Mostrar dirección de la tienda
            document.getElementById('ticket-mostrar-direccion-tienda').checked = data.ticket_mostrar_direccion_tienda === 'true';

            // Mensaje, URL, Subtotal USD, IVA
            document.getElementById('ticket-mensaje').value = data.ticket_mensaje || '';
            document.getElementById('ticket-url').value = data.ticket_url || '';
            document.getElementById('ticket-subtotal-usd').checked = data.ticket_subtotal_usd === 'true';
            document.getElementById('ticket-iva-porcentaje').value = data.ticket_iva_porcentaje || '0';
        })
        .catch(err => console.error('Error cargando configuración del ticket:', err));
}

function guardarConfigTicket(e) {
    e.preventDefault();
    const data = {
        ticket_tienda_nombre: document.getElementById('ticket-tienda-nombre').value.trim(),
        ticket_rif: document.getElementById('ticket-rif').value.trim(),
        ticket_telefono_tienda: document.getElementById('ticket-telefono-tienda').value.trim(),
        ticket_direccion_tienda: document.getElementById('ticket-direccion-tienda').value.trim(),
        ticket_mostrar_rif: document.getElementById('ticket-mostrar-rif').checked ? 'true' : 'false',
        ticket_mostrar_telefono: document.getElementById('ticket-mostrar-telefono').checked ? 'true' : 'false',
        ticket_mostrar_direccion_cliente: document.getElementById('ticket-mostrar-direccion-cliente').checked ? 'true' : 'false',
        ticket_mostrar_direccion_tienda: document.getElementById('ticket-mostrar-direccion-tienda').checked ? 'true' : 'false',
        ticket_mensaje: document.getElementById('ticket-mensaje').value.trim(),
        ticket_url: document.getElementById('ticket-url').value.trim(),
        ticket_subtotal_usd: document.getElementById('ticket-subtotal-usd').checked ? 'true' : 'false',
        ticket_iva_porcentaje: document.getElementById('ticket-iva-porcentaje').value || '0'
    };
    fetch('/api/config/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(res => {
        alert(res.mensaje || 'Configuración guardada correctamente');
    })
    .catch(err => alert('Error: ' + err));
}

// ---------- UTILIDADES DE SELECTS ----------
function cargarSelectsCategorias(selectId = null) {
    const selects = selectId ? [selectId] : ['subcategoria-categoria', 'marca-categoria'];
    fetch('/api/categorias')
        .then(res => res.json())
        .then(data => {
            selects.forEach(id => {
                const select = document.getElementById(id);
                if (!select) return;
                const currentValue = select.value;
                select.innerHTML = '<option value="">Seleccionar</option>';
                data.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = c.nombre;
                    select.appendChild(opt);
                });
                if (currentValue) select.value = currentValue;
            });
        })
        .catch(err => console.error('Error cargando categorías para selects:', err));
}

function cargarSelectsSubcategorias(selectId = null) {
    const selects = selectId ? [selectId] : ['talla-subcategoria'];
    fetch('/api/subcategorias')
        .then(res => res.json())
        .then(data => {
            selects.forEach(id => {
                const select = document.getElementById(id);
                if (!select) return;
                const currentValue = select.value;
                select.innerHTML = '<option value="">Seleccionar subcategoría</option>';
                data.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.id;
                    opt.textContent = `${s.nombre} (${s.categoria_nombre || 'Sin categoría'})`;
                    select.appendChild(opt);
                });
                if (currentValue) select.value = currentValue;
            });
        })
        .catch(err => console.error('Error cargando subcategorías para selects:', err));
}

// ---------- CARGA DE DATOS SEGÚN PESTAÑA ----------
function cargarDatos(tabName) {
    switch(tabName) {
        case 'categorias':
            cargarCategorias();
            break;
        case 'subcategorias':
            cargarSubcategorias();
            break;
        case 'marcas':
            cargarMarcas();
            break;
        case 'tallas':
            cargarTallas();
            break;
        case 'ticket':
            cargarConfigTicket();
            break;
    }
}

// ---------- ACTUALIZACIÓN DE CONTROLES DE PAGINACIÓN ----------
function actualizarInfoPaginacion(entidad, total, page, pages, per_page) {
    const infoSpan = document.getElementById(`info-${entidad}`);
    const pageInfoSpan = document.getElementById(`page-info-${entidad}`);
    const prevBtn = document.getElementById(`prev-${entidad}`);
    const nextBtn = document.getElementById(`next-${entidad}`);

    if (infoSpan) {
        const start = total === 0 ? 0 : (page - 1) * per_page + 1;
        const end = Math.min(page * per_page, total);
        infoSpan.textContent = `Mostrando ${start} - ${end} de ${total}`;
    }

    if (pageInfoSpan) {
        pageInfoSpan.textContent = `Página ${page} de ${pages || 1}`;
    }

    if (prevBtn) {
        prevBtn.disabled = page <= 1;
    }
    if (nextBtn) {
        nextBtn.disabled = page >= pages;
    }
}