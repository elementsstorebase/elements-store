document.addEventListener('DOMContentLoaded', function() {
    // ---------- REFERENCIAS A ELEMENTOS ----------
    const tablaClientes = document.getElementById('tabla-clientes');
    const filtroBuscar = document.getElementById('filtro-buscar');
    const btnFiltrar = document.getElementById('btn-filtrar');
    const btnLimpiar = document.getElementById('btn-limpiar');
    const modalEliminar = document.getElementById('modal-eliminar');
    const eliminarClienteId = document.getElementById('eliminar-cliente-id');
    const eliminarClienteNombre = document.getElementById('eliminar-cliente-nombre');

    let clientesCache = [];

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

    // ---------- CARGAR CLIENTES ----------
    function cargarClientes(filtro = '') {
        const params = new URLSearchParams();
        params.append('es_fijo', 'true');
        if (filtro) {
            params.append('buscar', filtro);
        }

        fetch(`/api/clientes?${params}`)
            .then(r => {
                if (!r.ok) throw new Error('Error al cargar clientes');
                return r.json();
            })
            .then(data => {
                clientesCache = data;
                renderizarClientes(data);
            })
            .catch(err => {
                console.error('Error cargando clientes:', err);
                tablaClientes.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-red-400">Error al cargar clientes</td></tr>`;
            });
    }

    // ---------- RENDERIZAR CLIENTES ----------
    function renderizarClientes(clientes) {
        tablaClientes.innerHTML = '';
        if (clientes.length === 0) {
            tablaClientes.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-gray-400">No hay clientes registrados</td></tr>`;
            return;
        }

        clientes.forEach(c => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-gray-100 hover:bg-gray-50 transition-colors';
            tr.innerHTML = `
                <td class="py-2 px-3 font-medium">${c.nombre || ''}</td>
                <td class="py-2 px-3">${c.apellido || ''}</td>
                <td class="py-2 px-3">${c.cedula || ''}</td>
                <td class="py-2 px-3">${c.telefono || '-'}</td>
                <td class="py-2 px-3">${c.direccion || '-'}</td>
                <td class="py-2 px-3 text-center">
                    <span class="px-2 py-1 rounded-full text-xs ${c.deudas_activas > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}">
                        ${c.deudas_activas || 0}
                    </span>
                </td>
                <td class="py-2 px-3 text-right">
                    <a href="/admin/clientes/editar/${c.id}" class="text-indigo-600 hover:text-indigo-800 mr-2" title="Editar">
                        <i class="fas fa-edit"></i>
                    </a>
                    <button onclick="abrirModalEliminar(${c.id}, '${c.nombre} ${c.apellido}')" class="text-red-500 hover:text-red-700" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tablaClientes.appendChild(tr);
        });
    }

    // ---------- FILTRAR CLIENTES ----------
    function filtrarClientes() {
        const busqueda = filtroBuscar.value.trim().toLowerCase();
        if (!busqueda) {
            renderizarClientes(clientesCache);
            return;
        }

        const filtrados = clientesCache.filter(c => {
            const nombreCompleto = `${c.nombre} ${c.apellido}`.toLowerCase();
            return nombreCompleto.includes(busqueda) ||
                   (c.cedula && c.cedula.includes(busqueda)) ||
                   (c.telefono && c.telefono.includes(busqueda));
        });
        renderizarClientes(filtrados);
    }

    // ---------- LIMPIAR FILTROS ----------
    function limpiarFiltros() {
        filtroBuscar.value = '';
        renderizarClientes(clientesCache);
    }

    // ---------- MODAL ELIMINAR ----------
    window.abrirModalEliminar = function(id, nombre) {
        eliminarClienteId.value = id;
        eliminarClienteNombre.textContent = nombre || 'sin nombre';
        modalEliminar.classList.remove('hidden');
    };

    window.cerrarModalEliminar = function() {
        modalEliminar.classList.add('hidden');
        eliminarClienteId.value = '';
    };

    window.confirmarEliminar = function() {
        const id = eliminarClienteId.value;
        if (!id) return;

        fetch(`/api/clientes/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(r => {
            if (!r.ok) {
                // Intentar obtener el mensaje de error del servidor
                return r.json().then(errData => {
                    throw new Error(errData.error || 'Error al eliminar cliente');
                });
            }
            return r.json();
        })
        .then(res => {
            alert(res.mensaje || 'Cliente eliminado correctamente');
            cerrarModalEliminar();
            cargarClientes();
        })
        .catch(err => {
            alert('❌ Error: ' + err.message);
            // No cerramos el modal para que el usuario pueda ver el error y reintentar o cancelar
            // Si el error es por apartados activos, el modal sigue abierto y el usuario puede decidir.
        });
    };

    // ---------- MANEJO DEL FORMULARIO DE CREACIÓN ----------
    const formCrear = document.getElementById('form-cliente-crear');
    if (formCrear) {
        formCrear.addEventListener('submit', function(e) {
            e.preventDefault();

            const data = {
                nombre: document.getElementById('cliente-nombre').value.trim(),
                apellido: document.getElementById('cliente-apellido').value.trim(),
                cedula: document.getElementById('cliente-cedula').value.trim(),
                telefono: document.getElementById('cliente-telefono').value.trim(),
                direccion: document.getElementById('cliente-direccion').value.trim(),
                es_fijo: true
            };

            if (!data.nombre || !data.apellido || !data.cedula) {
                alert('❌ Nombre, apellido y cédula son obligatorios');
                return;
            }

            fetch('/api/clientes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            .then(r => {
                if (!r.ok) {
                    return r.json().then(err => { throw new Error(err.error || 'Error al crear cliente'); });
                }
                return r.json();
            })
            .then(res => {
                alert(res.mensaje || '✅ Cliente creado correctamente');
                window.location.href = '/admin/clientes';
            })
            .catch(err => {
                alert('❌ Error: ' + err.message);
            });
        });
    }

    // ---------- MANEJO DEL FORMULARIO DE EDICIÓN ----------
    const formEditar = document.getElementById('form-cliente-editar');
    if (formEditar) {
        formEditar.addEventListener('submit', function(e) {
            e.preventDefault();

            const clienteId = document.getElementById('cliente-id').value;
            const data = {
                nombre: document.getElementById('cliente-nombre').value.trim(),
                apellido: document.getElementById('cliente-apellido').value.trim(),
                cedula: document.getElementById('cliente-cedula').value.trim(),
                telefono: document.getElementById('cliente-telefono').value.trim(),
                direccion: document.getElementById('cliente-direccion').value.trim(),
                es_fijo: true
            };

            if (!data.nombre || !data.apellido || !data.cedula) {
                alert('❌ Nombre, apellido y cédula son obligatorios');
                return;
            }

            fetch(`/api/clientes/${clienteId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            .then(r => {
                if (!r.ok) {
                    return r.json().then(err => { throw new Error(err.error || 'Error al actualizar cliente'); });
                }
                return r.json();
            })
            .then(res => {
                alert(res.mensaje || '✅ Cliente actualizado correctamente');
                window.location.href = '/admin/clientes';
            })
            .catch(err => {
                alert('❌ Error: ' + err.message);
            });
        });
    }

    // ---------- EVENTOS ----------
    btnFiltrar.addEventListener('click', filtrarClientes);
    btnLimpiar.addEventListener('click', limpiarFiltros);

    filtroBuscar.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            filtrarClientes();
        }
    });

    // Cerrar modal con Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            cerrarModalEliminar();
        }
    });

    // Cerrar modal al hacer clic fuera
    modalEliminar.addEventListener('click', function(e) {
        if (e.target === this) {
            cerrarModalEliminar();
        }
    });

    // ---------- INICIALIZACIÓN ----------
    cargarClientes();
});