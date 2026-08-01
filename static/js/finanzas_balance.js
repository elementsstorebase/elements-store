// static/js/finanzas_balance.js
// SIN Bootstrap – modal nativo con Tailwind

// ============================================
// 🔥 ESTADO GLOBAL
// ============================================
let pestañaActual = 'pendiente';
let fechaDesde = '';
let fechaHasta = '';

document.addEventListener('DOMContentLoaded', function() {
    // ---- SALDOS ----
    cargarDatos();
    document.getElementById('btn-refresh').addEventListener('click', function() {
        cargarDatos();
        cargarDeudas(pestañaActual, fechaDesde, fechaHasta);
    });
    document.getElementById('btn-refresh-activos').addEventListener('click', cargarDatos);
    document.getElementById('btn-refresh-pasivos').addEventListener('click', cargarDatos);
    document.getElementById('btn-guardar-saldo').addEventListener('click', guardarSaldo);

    // ---- DEUDAS ----
    cargarDeudas('pendiente');
    document.getElementById('btn-refresh-deudas').addEventListener('click', function() {
        cargarDeudas(pestañaActual, fechaDesde, fechaHasta);
    });

    // Pestañas de deudas
    document.querySelectorAll('.tab-deuda').forEach(tab => {
        tab.addEventListener('click', function() {
            const estado = this.dataset.tab;
            cambiarPestana(estado);
        });
    });

    // Botón Nueva Deuda
    document.getElementById('btn-nueva-deuda').addEventListener('click', abrirModalNuevaDeuda);
    document.getElementById('modal-deuda-cerrar').addEventListener('click', cerrarModalNuevaDeuda);
    document.getElementById('modal-deuda-cancelar').addEventListener('click', cerrarModalNuevaDeuda);
    document.getElementById('modalNuevaDeuda').addEventListener('click', function(e) {
        if (e.target === this) cerrarModalNuevaDeuda();
    });
    document.getElementById('btn-guardar-deuda').addEventListener('click', crearDeuda);

    // Filtros de deudas
    document.getElementById('btn-filtrar-deudas').addEventListener('click', aplicarFiltros);
    document.getElementById('btn-limpiar-filtros').addEventListener('click', limpiarFiltros);
    document.getElementById('fecha-desde').addEventListener('keyup', function(e) {
        if (e.key === 'Enter') aplicarFiltros();
    });
    document.getElementById('fecha-hasta').addEventListener('keyup', function(e) {
        if (e.key === 'Enter') aplicarFiltros();
    });

    // ---- CUENTAS FINANCIERAS ----
    // Botones para agregar cuenta (activo y pasivo)
    document.getElementById('btn-agregar-cuenta-activo').addEventListener('click', function() {
        abrirModalNuevaCuenta('activo');
    });
    document.getElementById('btn-agregar-cuenta-pasivo').addEventListener('click', function() {
        abrirModalNuevaCuenta('pasivo');
    });

    // Modal de nueva cuenta
    document.getElementById('modal-cuenta-cerrar').addEventListener('click', cerrarModalNuevaCuenta);
    document.getElementById('modal-cuenta-cancelar').addEventListener('click', cerrarModalNuevaCuenta);
    document.getElementById('modalNuevaCuenta').addEventListener('click', function(e) {
        if (e.target === this) cerrarModalNuevaCuenta();
    });
    document.getElementById('btn-guardar-cuenta').addEventListener('click', crearCuenta);

    // ---- MODALES DE CONFIRMACIÓN ----
    document.getElementById('modal-confirm-cerrar').addEventListener('click', cerrarModalConfirmar);
    document.getElementById('modal-confirm-cancelar').addEventListener('click', cerrarModalConfirmar);
    document.getElementById('modalConfirmarEliminar').addEventListener('click', function(e) {
        if (e.target === this) cerrarModalConfirmar();
    });
    document.getElementById('btn-confirm-eliminar').addEventListener('click', confirmarEliminar);

    // ---- MODALES DE EDICIÓN DE SALDO ----
    document.getElementById('modal-cerrar').addEventListener('click', cerrarModal);
    document.getElementById('modal-cancelar').addEventListener('click', cerrarModal);
    document.getElementById('modalEditarSaldo').addEventListener('click', function(e) {
        if (e.target === this) cerrarModal();
    });

    // Asegurar pestaña inicial
    cambiarPestana('pendiente');
});

// ============================================
// 🔥 FUNCIONES DE FORMATEO
// ============================================

function formatearMonto(monto, moneda) {
    const valor = Math.round(monto * 100) / 100;
    const partes = valor.toFixed(2).split('.');
    const parteEntera = partes[0];
    const parteDecimal = partes[1];
    const parteEnteraConSeparador = parteEntera.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const simbolo = moneda === 'USD' ? '$' : 'Bs';
    return `${simbolo} ${parteEnteraConSeparador},${parteDecimal}`;
}

// ============================================
// 🔥 FUNCIONES: SALDOS Y CUENTAS
// ============================================

function cargarDatos() {
    fetch('/api/finanzas/saldos')
        .then(response => {
            if (!response.ok) throw new Error('Error en la respuesta del servidor');
            return response.json();
        })
        .then(data => {
            renderizarCuentas(data.cuentas);
            actualizarResumen(data.totales);
        })
        .catch(error => {
            console.error('Error al cargar datos:', error);
            alert('Error al cargar los datos financieros. Revisa la consola para más detalles.');
        });
}

function renderizarCuentas(cuentas) {
    const activos = cuentas.filter(c => c.tipo === 'activo');
    const pasivos = cuentas.filter(c => c.tipo === 'pasivo');

    const tbodyActivos = document.getElementById('cuerpo-activos');
    tbodyActivos.innerHTML = '';
    activos.forEach(c => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-gray-50 hover:bg-gray-50';
        const esAutomatico = c.es_automatico;
        tr.innerHTML = `
            <td class="py-2">${c.nombre} ${esAutomatico ? '<span class="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Auto</span>' : ''}</td>
            <td class="py-2">${c.moneda}</td>
            <td class="py-2 text-right font-mono">${formatearMonto(c.monto, c.moneda)}</td>
            <td class="py-2 text-center">
                ${!esAutomatico ? `
                    <button class="editar-saldo text-indigo-600 hover:text-indigo-800 transition mr-1" data-id="${c.id}" data-nombre="${c.nombre}" data-monto="${c.monto}" data-moneda="${c.moneda}" title="Editar saldo"><i class="fas fa-pencil-alt"></i></button>
                    <button class="eliminar-cuenta text-red-600 hover:text-red-800 transition" data-id="${c.id}" data-nombre="${c.nombre}" title="Eliminar cuenta"><i class="fas fa-trash"></i></button>
                ` : '—'}
            </td>
        `;
        tbodyActivos.appendChild(tr);
    });

    const tbodyPasivos = document.getElementById('cuerpo-pasivos');
    tbodyPasivos.innerHTML = '';
    pasivos.forEach(c => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-gray-50 hover:bg-gray-50';
        const esAutomatico = c.es_automatico;
        tr.innerHTML = `
            <td class="py-2">${c.nombre} ${esAutomatico ? '<span class="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Auto</span>' : ''}</td>
            <td class="py-2">${c.moneda}</td>
            <td class="py-2 text-right font-mono">${formatearMonto(c.monto, c.moneda)}</td>
            <td class="py-2 text-center">
                ${!esAutomatico ? `
                    <button class="editar-saldo text-indigo-600 hover:text-indigo-800 transition mr-1" data-id="${c.id}" data-nombre="${c.nombre}" data-monto="${c.monto}" data-moneda="${c.moneda}" title="Editar saldo"><i class="fas fa-pencil-alt"></i></button>
                    <button class="eliminar-cuenta text-red-600 hover:text-red-800 transition" data-id="${c.id}" data-nombre="${c.nombre}" title="Eliminar cuenta"><i class="fas fa-trash"></i></button>
                ` : '—'}
            </td>
        `;
        tbodyPasivos.appendChild(tr);
    });

    // Eventos para editar saldo (existente)
    document.querySelectorAll('.editar-saldo').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.dataset.id;
            const nombre = this.dataset.nombre;
            const monto = parseFloat(this.dataset.monto);
            const moneda = this.dataset.moneda;
            abrirModalEditar(id, nombre, monto, moneda);
        });
    });

    // 🔥 Eventos para eliminar cuenta
    document.querySelectorAll('.eliminar-cuenta').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.dataset.id;
            const nombre = this.dataset.nombre;
            if (confirm(`¿Eliminar la cuenta "${nombre}"? Esta acción no se puede deshacer.`)) {
                eliminarCuenta(id);
            }
        });
    });

    // Totales
    const totalActivoUsd = activos.filter(c => c.moneda === 'USD').reduce((sum, c) => sum + c.monto, 0);
    const totalActivoVes = activos.filter(c => c.moneda === 'VES').reduce((sum, c) => sum + c.monto, 0);
    const totalPasivoUsd = pasivos.filter(c => c.moneda === 'USD').reduce((sum, c) => sum + c.monto, 0);
    const totalPasivoVes = pasivos.filter(c => c.moneda === 'VES').reduce((sum, c) => sum + c.monto, 0);

    document.getElementById('total-activo-usd-tabla').textContent = formatearMonto(totalActivoUsd, 'USD');
    document.getElementById('total-activo-ves-tabla').textContent = formatearMonto(totalActivoVes, 'VES');
    document.getElementById('total-pasivo-usd-tabla').textContent = formatearMonto(totalPasivoUsd, 'USD');
    document.getElementById('total-pasivo-ves-tabla').textContent = formatearMonto(totalPasivoVes, 'VES');
}

function actualizarResumen(totales) {
    document.getElementById('total-activo-usd').textContent = formatearMonto(totales.activo_usd, 'USD');
    document.getElementById('total-activo-ves').textContent = formatearMonto(totales.activo_ves, 'VES');
    document.getElementById('total-pasivo-usd').textContent = formatearMonto(totales.pasivo_usd, 'USD');
    document.getElementById('total-pasivo-ves').textContent = formatearMonto(totales.pasivo_ves, 'VES');
    document.getElementById('balance-usd').textContent = formatearMonto(totales.balance_usd, 'USD');
    document.getElementById('balance-ves').textContent = formatearMonto(totales.balance_ves, 'VES');
}

// ============================================
// 🔥 FUNCIONES: MODAL DE EDICIÓN DE SALDO
// ============================================

function abrirModalEditar(id, nombre, monto, moneda) {
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-nombre').value = `${nombre} (${moneda})`;
    document.getElementById('edit-monto').value = monto;
    document.getElementById('edit-moneda-simbolo').textContent = moneda === 'USD' ? '$' : 'Bs';
    document.getElementById('modal-titulo').textContent = `Editar Saldo - ${nombre}`;
    const modal = document.getElementById('modalEditarSaldo');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function cerrarModal() {
    const modal = document.getElementById('modalEditarSaldo');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function guardarSaldo() {
    const id = document.getElementById('edit-id').value;
    const monto = parseFloat(document.getElementById('edit-monto').value);
    if (isNaN(monto) || monto < 0) {
        alert('Ingrese un monto válido (mayor o igual a 0).');
        return;
    }

    fetch(`/api/finanzas/saldos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monto: monto })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.error || 'Error del servidor'); });
        }
        return response.json();
    })
    .then(data => {
        alert('Saldo actualizado correctamente.');
        cerrarModal();
        cargarDatos();
    })
    .catch(error => {
        console.error('Error al guardar:', error);
        alert('Error al guardar el saldo: ' + error.message);
    });
}

// ============================================
// 🔥 FUNCIONES: GESTIÓN DE CUENTAS (CREAR/ELIMINAR)
// ============================================

function abrirModalNuevaCuenta(tipo) {
    document.getElementById('cuenta-nombre').value = '';
    document.getElementById('cuenta-monto').value = '0';
    document.getElementById('cuenta-tipo').value = tipo;
    document.getElementById('cuenta-tipo-hidden').value = tipo;
    const modal = document.getElementById('modalNuevaCuenta');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => document.getElementById('cuenta-nombre').focus(), 100);
}

function cerrarModalNuevaCuenta() {
    const modal = document.getElementById('modalNuevaCuenta');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function crearCuenta() {
    const nombre = document.getElementById('cuenta-nombre').value.trim();
    const tipo = document.getElementById('cuenta-tipo').value;
    const moneda = document.getElementById('cuenta-moneda').value;
    const monto = parseFloat(document.getElementById('cuenta-monto').value) || 0;

    if (!nombre) {
        alert('El nombre de la cuenta es obligatorio.');
        document.getElementById('cuenta-nombre').focus();
        return;
    }

    const data = { nombre, tipo, moneda, monto };

    fetch('/api/finanzas/cuentas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.error || 'Error del servidor'); });
        }
        return response.json();
    })
    .then(data => {
        alert('✅ Cuenta creada correctamente.');
        cerrarModalNuevaCuenta();
        cargarDatos();
    })
    .catch(error => {
        console.error('Error al crear cuenta:', error);
        alert('Error al crear la cuenta: ' + error.message);
    });
}

function eliminarCuenta(id) {
    fetch(`/api/finanzas/cuentas/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.error || 'Error del servidor'); });
        }
        return response.json();
    })
    .then(data => {
        alert('✅ Cuenta eliminada correctamente.');
        cargarDatos();
    })
    .catch(error => {
        console.error('Error al eliminar cuenta:', error);
        alert('Error al eliminar la cuenta: ' + error.message);
    });
}

// ============================================
// 🔥 FUNCIONES: GESTIÓN DE DEUDAS
// ============================================

function cambiarPestana(estado) {
    pestañaActual = estado;
    document.querySelectorAll('.tab-deuda').forEach(tab => {
        tab.classList.remove('text-amber-600', 'border-amber-600');
        tab.classList.add('text-gray-500', 'border-transparent');
        if (tab.dataset.tab === estado) {
            tab.classList.remove('text-gray-500', 'border-transparent');
            tab.classList.add('text-amber-600', 'border-amber-600');
        }
    });
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    const targetId = estado === 'pendiente' ? 'tab-content-pendientes' : 'tab-content-finalizadas';
    const target = document.getElementById(targetId);
    if (target) target.classList.remove('hidden');
    cargarDeudas(estado, fechaDesde, fechaHasta);
}

function cargarDeudas(estado, fechaDesde = '', fechaHasta = '') {
    const tbodyId = estado === 'pendiente' ? 'cuerpo-deudas-pendientes' : 'cuerpo-deudas-finalizadas';
    const tbody = document.getElementById(tbodyId);
    if (!tbody) {
        console.error(`No se encontró el tbody con id: ${tbodyId}`);
        return;
    }
    
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-400">Cargando...</td></tr>';

    let url = `/api/deudas?estado=${estado}`;
    if (fechaDesde) url += `&fecha_desde=${fechaDesde}`;
    if (fechaHasta) url += `&fecha_hasta=${fechaHasta}`;

    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error('Error al cargar deudas');
            return response.json();
        })
        .then(deudas => {
            renderizarDeudas(deudas, estado);
        })
        .catch(error => {
            console.error('Error al cargar deudas:', error);
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-red-500">Error al cargar deudas</td></tr>`;
        });
}

function renderizarDeudas(deudas, estado) {
    const tbodyId = estado === 'pendiente' ? 'cuerpo-deudas-pendientes' : 'cuerpo-deudas-finalizadas';
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    if (!deudas || deudas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-gray-400">No hay deudas ${estado === 'pendiente' ? 'pendientes' : 'finalizadas'}</td></tr>`;
        return;
    }

    let html = '';
    deudas.forEach(d => {
        const montoFormateado = formatearMonto(d.monto, d.moneda);
        const fechaCreacion = d.fecha_creacion || 'N/A';
        const fechaFinalizacion = d.fecha_finalizacion || 'N/A';
        const observaciones = d.observaciones ? `<span class="text-xs text-gray-400">${d.observaciones}</span>` : '';

        let acciones = '';
        if (estado === 'pendiente') {
            acciones = `
                <button class="btn-finalizar-deuda text-green-600 hover:text-green-800 transition mr-2" data-id="${d.id}" title="Finalizar"><i class="fas fa-check-circle"></i></button>
                <button class="btn-eliminar-deuda text-red-600 hover:text-red-800 transition" data-id="${d.id}" data-desc="${d.descripcion}" title="Eliminar"><i class="fas fa-trash"></i></button>
            `;
        } else {
            acciones = `
                <button class="btn-eliminar-deuda text-red-600 hover:text-red-800 transition" data-id="${d.id}" data-desc="${d.descripcion}" title="Eliminar"><i class="fas fa-trash"></i></button>
            `;
        }

        html += `
            <tr class="border-b border-gray-50 hover:bg-gray-50">
                <td class="py-2">${d.descripcion} ${observaciones}</td>
                <td class="py-2">${d.moneda}</td>
                <td class="py-2 text-right font-mono">${montoFormateado}</td>
                <td class="py-2 text-sm">${fechaCreacion}</td>
                ${estado === 'finalizada' ? `<td class="py-2 text-sm">${fechaFinalizacion}</td>` : ''}
                <td class="py-2 text-center">${acciones}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;

    tbody.querySelectorAll('.btn-finalizar-deuda').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.dataset.id;
            if (confirm('¿Finalizar esta deuda? Se moverá a "Finalizadas".')) {
                finalizarDeuda(id);
            }
        });
    });

    tbody.querySelectorAll('.btn-eliminar-deuda').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.dataset.id;
            const desc = this.dataset.desc || 'esta deuda';
            abrirModalConfirmarEliminar(id, desc);
        });
    });
}

function abrirModalNuevaDeuda() {
    document.getElementById('deuda-descripcion').value = '';
    document.getElementById('deuda-monto').value = '';
    document.getElementById('deuda-observaciones').value = '';
    document.getElementById('deuda-moneda').value = 'USD';
    const modal = document.getElementById('modalNuevaDeuda');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => document.getElementById('deuda-descripcion').focus(), 100);
}

function cerrarModalNuevaDeuda() {
    const modal = document.getElementById('modalNuevaDeuda');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function crearDeuda() {
    const descripcion = document.getElementById('deuda-descripcion').value.trim();
    const moneda = document.getElementById('deuda-moneda').value;
    const monto = parseFloat(document.getElementById('deuda-monto').value);
    const observaciones = document.getElementById('deuda-observaciones').value.trim();

    if (!descripcion) {
        alert('La descripción es obligatoria.');
        document.getElementById('deuda-descripcion').focus();
        return;
    }
    if (isNaN(monto) || monto <= 0) {
        alert('Ingrese un monto válido mayor a 0.');
        document.getElementById('deuda-monto').focus();
        return;
    }

    const data = { descripcion, moneda, monto, observaciones };

    fetch('/api/deudas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.error || 'Error del servidor'); });
        }
        return response.json();
    })
    .then(data => {
        alert('✅ Deuda creada correctamente.');
        cerrarModalNuevaDeuda();
        cargarDatos();
        cargarDeudas(pestañaActual, fechaDesde, fechaHasta);
    })
    .catch(error => {
        console.error('Error al crear deuda:', error);
        alert('Error al crear la deuda: ' + error.message);
    });
}

function finalizarDeuda(id) {
    fetch(`/api/deudas/${id}/finalizar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.error || 'Error del servidor'); });
        }
        return response.json();
    })
    .then(data => {
        alert('✅ Deuda finalizada correctamente.');
        cargarDatos();
        cargarDeudas(pestañaActual, fechaDesde, fechaHasta);
    })
    .catch(error => {
        console.error('Error al finalizar deuda:', error);
        alert('Error al finalizar la deuda: ' + error.message);
    });
}

// ============================================
// 🔥 MODAL DE CONFIRMACIÓN (para deudas y cuentas)
// ============================================

let deudaAEliminar = null;

function abrirModalConfirmarEliminar(id, descripcion) {
    deudaAEliminar = id;
    document.getElementById('confirm-deuda-id').value = id;
    document.getElementById('confirm-deuda-info').textContent = `Deuda: "${descripcion}"`;
    const modal = document.getElementById('modalConfirmarEliminar');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function cerrarModalConfirmar() {
    const modal = document.getElementById('modalConfirmarEliminar');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    deudaAEliminar = null;
}

function confirmarEliminar() {
    const id = document.getElementById('confirm-deuda-id').value;
    if (!id) return;

    fetch(`/api/deudas/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.error || 'Error del servidor'); });
        }
        return response.json();
    })
    .then(data => {
        alert('✅ Deuda eliminada correctamente.');
        cerrarModalConfirmar();
        cargarDatos();
        cargarDeudas(pestañaActual, fechaDesde, fechaHasta);
    })
    .catch(error => {
        console.error('Error al eliminar deuda:', error);
        alert('Error al eliminar la deuda: ' + error.message);
        cerrarModalConfirmar();
    });
}

// ============================================
// 🔥 FILTROS DE DEUDAS
// ============================================

function aplicarFiltros() {
    fechaDesde = document.getElementById('fecha-desde').value;
    fechaHasta = document.getElementById('fecha-hasta').value;
    cargarDeudas(pestañaActual, fechaDesde, fechaHasta);
}

function limpiarFiltros() {
    document.getElementById('fecha-desde').value = '';
    document.getElementById('fecha-hasta').value = '';
    fechaDesde = '';
    fechaHasta = '';
    cargarDeudas(pestañaActual, '', '');
}