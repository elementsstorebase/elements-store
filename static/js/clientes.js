document.addEventListener('DOMContentLoaded', function() {
    // ---------- REFERENCIAS A ELEMENTOS ----------
    const tablaClientes = document.getElementById('tabla-clientes');
    const filtroBuscar = document.getElementById('filtro-buscar');
    const btnFiltrar = document.getElementById('btn-filtrar');
    const btnLimpiar = document.getElementById('btn-limpiar');
    const modalAccion = document.getElementById('modal-accion');
    const modalTitulo = document.getElementById('modal-titulo');
    const modalMensaje = document.getElementById('modal-mensaje');
    const modalBtnConfirmar = document.getElementById('modal-btn-confirmar');
    const modalIcono = document.getElementById('modal-icono');
    const clienteIdAccion = document.getElementById('cliente-id-accion');
    const tipoAccion = document.getElementById('tipo-accion');
    const clienteNombreAccion = document.getElementById('cliente-nombre-accion');

    let clientesCache = [];
    let estadoActual = 'activos'; // 'activos' o 'inactivos'

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

    // ---------- CAMBIAR PESTAÑA ----------
    window.cambiarPestana = function(tab) {
        estadoActual = tab;
        // Actualizar estilo de pestañas
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('border-indigo-500', 'text-indigo-600');
            btn.classList.add('border-transparent', 'text-gray-500');
        });
        const tabActiva = document.getElementById(`tab-${tab}`);
        if (tabActiva) {
            tabActiva.classList.remove('border-transparent', 'text-gray-500');
            tabActiva.classList.add('border-indigo-500', 'text-indigo-600');
        }
        cargarClientes();
    };

    // ---------- CARGAR CLIENTES ----------
    function cargarClientes(filtro = '') {
        const params = new URLSearchParams();
        params.append('es_fijo', 'true');
        // 🔥 NUEVO: pasar el estado actual
        params.append('activo', estadoActual === 'activos' ? 'true' : 'false');
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
            tablaClientes.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-gray-400">No hay clientes ${estadoActual === 'activos' ? 'activos' : 'inactivos'}</td></tr>`;
            return;
        }

        clientes.forEach(c => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-gray-100 hover:bg-gray-50 transition-colors';
            
            let acciones = '';
            if (estadoActual === 'activos') {
                // Botón Desactivar
                acciones = `
                    <a href="/admin/clientes/editar/${c.id}" class="text-indigo-600 hover:text-indigo-800 mr-2" title="Editar">
                        <i class="fas fa-edit"></i>
                    </a>
                    <button onclick="abrirModalAccion(${c.id}, '${c.nombre} ${c.apellido}', 'desactivar')" 
                            class="text-red-500 hover:text-red-700" title="Desactivar">
                        <i class="fas fa-user-slash"></i>
                    </button>
                `;
            } else {
                // Botón Reactivar
                acciones = `
                    <button onclick="abrirModalAccion(${c.id}, '${c.nombre} ${c.apellido}', 'reactivar')" 
                            class="text-green-500 hover:text-green-700 mr-3" title="Reactivar">
                        <i class="fas fa-user-check"></i> Reactivar
                    </button>
                    <button onclick="abrirModalEliminar(${c.id}, '${(c.nombre + ' ' + c.apellido).replace(/'/g, "\\'")}')" 
                            class="text-red-600 hover:text-red-800" title="Eliminar definitivamente">
                        <i class="fas fa-trash-alt"></i> Eliminar
                    </button>
                `;
            }

            tr.innerHTML = `
                <td class="py-2 px-3 font-medium">${c.nombre || ''}</td>
                <td class="py-2 px-3">${c.apellido || ''}</td>
                <td class="py-2 px-3">${c.cedula || ''}</td>
                <td class="py-2 px-3">${c.telefono || '-'}</td>
                <td class="py-2 px-3">${c.direccion || '-'}</td>
                <td class="py-2 px-3 text-center">
                    <span class="px-2 py-1 rounded-full text-xs ${(c.deudas_activas || 0) > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}">
                        ${c.deudas_activas || 0}
                    </span>
                </td>
                <td class="py-2 px-3 text-right">${acciones}</td>
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

    // ---------- MODAL ACCIÓN (Desactivar/Reactivar) ----------
    window.abrirModalAccion = function(id, nombre, tipo) {
        clienteIdAccion.value = id;
        clienteNombreAccion.value = nombre;
        tipoAccion.value = tipo;

        if (tipo === 'desactivar') {
            modalTitulo.textContent = 'Confirmar Desactivación';
            modalMensaje.textContent = `¿Estás seguro de desactivar al cliente "${nombre}"? Podrás reactivarlo después.`;
            modalBtnConfirmar.className = 'btn-primary bg-red-600 hover:bg-red-700 flex-1';
            modalIcono.className = 'fas fa-user-slash mr-1';
            modalBtnConfirmar.innerHTML = '<i class="fas fa-user-slash mr-1"></i> Desactivar';
        } else {
            modalTitulo.textContent = 'Confirmar Reactivación';
            modalMensaje.textContent = `¿Estás seguro de reactivar al cliente "${nombre}"? Volverá a estar disponible.`;
            modalBtnConfirmar.className = 'btn-primary bg-green-600 hover:bg-green-700 flex-1';
            modalIcono.className = 'fas fa-user-check mr-1';
            modalBtnConfirmar.innerHTML = '<i class="fas fa-user-check mr-1"></i> Reactivar';
        }

        modalAccion.classList.remove('hidden');
    };

    window.cerrarModalAccion = function() {
        modalAccion.classList.add('hidden');
        clienteIdAccion.value = '';
        tipoAccion.value = '';
        clienteNombreAccion.value = '';
    };

    window.confirmarAccion = function() {
        const id = clienteIdAccion.value;
        const tipo = tipoAccion.value;
        if (!id) return;

        // 🔥 USAR LOS ENDPOINTS ESPECÍFICOS: /desactivar o /reactivar
        const url = `/api/clientes/${id}/${tipo}`;
        const method = 'PUT';

        fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' }
        })
        .then(r => {
            if (!r.ok) {
                return r.json().then(errData => {
                    throw new Error(errData.error || 'Error al procesar la acción');
                });
            }
            return r.json();
        })
        .then(res => {
            alert(res.mensaje || `✅ Cliente ${tipo === 'desactivar' ? 'desactivado' : 'reactivado'} correctamente`);
            cerrarModalAccion();
            cargarClientes(); // Recargar la lista actual
        })
        .catch(err => {
            alert('❌ Error: ' + err.message);
            // El modal queda abierto para que el usuario vea el error y pueda cancelar o reintentar
        });
    };


    // ============================================================
    // 🔥 NUEVO: ELIMINACIÓN DEFINITIVA DE CLIENTE
    // Antes de borrar consulta al servidor qué va a pasar y se lo
    // muestra a la usuaria de forma clara.
    // ============================================================
    let clienteIdEliminar = null;

    window.abrirModalEliminar = function(id, nombre) {
        clienteIdEliminar = id;
        const modal = document.getElementById('modal-eliminar-cliente');
        const cuerpo = document.getElementById('modal-eliminar-cuerpo');
        const btnOk  = document.getElementById('modal-eliminar-confirmar');
        if (!modal) { alert('No se encontró el diálogo de eliminación.'); return; }

        document.getElementById('modal-eliminar-nombre').textContent = nombre;
        cuerpo.innerHTML = '<p class="text-gray-500 text-sm py-4 text-center">' +
                           '<i class="fas fa-spinner fa-spin mr-2"></i>Revisando la información del cliente...</p>';
        btnOk.disabled = true;
        btnOk.classList.add('opacity-50', 'cursor-not-allowed');
        modal.classList.remove('hidden');

        fetch(`/api/clientes/${id}/previsualizar-eliminacion`)
            .then(r => r.json())
            .then(info => {
                const c = info.se_conserva || {};
                const totalHist = (c.apartados_finalizados || 0) + (c.apartados_reintegrados || 0) + (c.ventas || 0);

                if (!info.puede_eliminar) {
                    const lista = (info.bloqueos || [])
                        .map(b => `<li class="ml-4">Apartado #${b.id} — faltan $${b.saldo.toFixed(2)} por pagar</li>`)
                        .join('');
                    cuerpo.innerHTML = `
                        <div class="bg-yellow-50 border border-yellow-300 rounded-lg p-3 text-sm">
                            <p class="font-semibold text-yellow-800 mb-1">
                                <i class="fas fa-exclamation-triangle mr-1"></i>No se puede eliminar todavía
                            </p>
                            <p class="text-yellow-900 mb-2">Este cliente tiene un apartado en curso:</p>
                            <ul class="list-disc text-yellow-900 mb-2">${lista}</ul>
                            <p class="text-yellow-900">
                                Ve a <strong>Deudas Activas</strong> y finaliza el apartado (si terminó de pagar)
                                o usa <strong>Reintegrar</strong> (si ya no lo quiere). Después podrás eliminarlo.
                            </p>
                        </div>`;
                    return;
                }

                cuerpo.innerHTML = `
                    <div class="space-y-3 text-sm">
                        <div class="bg-red-50 border border-red-200 rounded-lg p-3">
                            <p class="font-semibold text-red-800 mb-1">
                                <i class="fas fa-trash-alt mr-1"></i>Lo que se BORRA para siempre
                            </p>
                            <p class="text-red-900">
                                La ficha del cliente: nombre, cédula, teléfono y dirección.
                                Desaparece de la lista y no se puede recuperar.
                            </p>
                        </div>

                        <div class="bg-green-50 border border-green-200 rounded-lg p-3">
                            <p class="font-semibold text-green-800 mb-1">
                                <i class="fas fa-shield-alt mr-1"></i>Lo que SE CONSERVA
                            </p>
                            <ul class="text-green-900 list-disc ml-4 space-y-1">
                                <li><strong>${c.apartados_finalizados || 0}</strong> apartado(s) finalizado(s) en Deudas Finalizadas</li>
                                <li><strong>${c.apartados_reintegrados || 0}</strong> apartado(s) reintegrado(s)</li>
                                <li><strong>${c.ventas || 0}</strong> venta(s) y sus tickets</li>
                            </ul>
                            <p class="text-green-900 mt-2">
                                ${totalHist > 0
                                    ? 'Estos registros seguirán mostrando el nombre del cliente, aunque su ficha ya no exista.'
                                    : 'Este cliente no tiene historial, así que no queda nada guardado.'}
                            </p>
                        </div>

                        <p class="text-gray-600">
                            <i class="fas fa-info-circle mr-1"></i>
                            El historial solo se borra desde el propio módulo de Deudas Finalizadas.
                        </p>
                    </div>`;

                btnOk.disabled = false;
                btnOk.classList.remove('opacity-50', 'cursor-not-allowed');
            })
            .catch(() => {
                cuerpo.innerHTML = '<p class="text-red-600 text-sm">No se pudo consultar la información del cliente. Intenta de nuevo.</p>';
            });
    };

    window.cerrarModalEliminar = function() {
        const modal = document.getElementById('modal-eliminar-cliente');
        if (modal) modal.classList.add('hidden');
        clienteIdEliminar = null;
    };

    window.confirmarEliminar = function() {
        if (!clienteIdEliminar) return;
        const btnOk = document.getElementById('modal-eliminar-confirmar');
        btnOk.disabled = true;
        btnOk.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Eliminando...';

        fetch(`/api/clientes/${clienteIdEliminar}`, { method: 'DELETE' })
            .then(r => r.json().then(d => ({ ok: r.ok, d })))
            .then(({ ok, d }) => {
                if (!ok) throw new Error(d.error || 'No se pudo eliminar');
                alert('✅ ' + (d.mensaje || 'Cliente eliminado correctamente'));
                cerrarModalEliminar();
                cargarClientes();
            })
            .catch(err => alert('❌ ' + err.message))
            .finally(() => {
                btnOk.disabled = false;
                btnOk.innerHTML = '<i class="fas fa-trash-alt mr-1"></i> Sí, eliminar';
            });
    };

    // ---------- Manual de ayuda ----------
    window.abrirAyudaClientes = function() {
        const m = document.getElementById('modal-ayuda-clientes');
        if (m) m.classList.remove('hidden');
    };
    window.cerrarAyudaClientes = function() {
        const m = document.getElementById('modal-ayuda-clientes');
        if (m) m.classList.add('hidden');
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
            cerrarModalAccion();
        }
    });

    // Cerrar modal al hacer clic fuera
    modalAccion.addEventListener('click', function(e) {
        if (e.target === this) {
            cerrarModalAccion();
        }
    });

    // ---------- INICIALIZACIÓN ----------
    // Por defecto, cargar activos
    estadoActual = 'activos';
    // Asegurar que la pestaña activa esté resaltada
    const tabActiva = document.getElementById('tab-activos');
    if (tabActiva) {
        tabActiva.classList.remove('border-transparent', 'text-gray-500');
        tabActiva.classList.add('border-indigo-500', 'text-indigo-600');
    }
    cargarClientes();
});
