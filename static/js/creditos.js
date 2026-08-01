document.addEventListener('DOMContentLoaded', function() {
    // Cargar clientes para el selector
    fetch('/api/clientes').then(r=>r.json()).then(data => {
        const select = document.getElementById('cliente-credito');
        data.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = `${c.nombre} ${c.apellido} - Deuda: $${c.saldo_deudor.toFixed(2)}`;
            select.appendChild(opt);
        });
    });

    // Otorgar crédito
    document.getElementById('form-credito').addEventListener('submit', function(e) {
        e.preventDefault();
        const clienteId = document.getElementById('cliente-credito').value;
        const monto = parseFloat(document.getElementById('monto-credito').value);
        if (!clienteId || !monto) {
            alert('Complete todos los campos');
            return;
        }
        fetch('/api/creditos', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ cliente_id: parseInt(clienteId), monto: monto })
        })
        .then(r => r.json())
        .then(res => {
            alert(res.mensaje || 'Crédito otorgado');
            this.reset();
        })
        .catch(err => alert('Error: ' + err));
    });

    // Registrar abono
    document.getElementById('form-abono').addEventListener('submit', function(e) {
        e.preventDefault();
        const creditoId = document.getElementById('credito-id').value;
        const monto = parseFloat(document.getElementById('monto-abono').value);
        const tasa = parseFloat(document.getElementById('tasa-abono').value) || 1;
        if (!creditoId || !monto) {
            alert('Complete todos los campos');
            return;
        }
        fetch('/api/abonos', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ credito_id: parseInt(creditoId), monto: monto, tasa_cambio: tasa })
        })
        .then(r => r.json())
        .then(res => {
            alert(res.mensaje || 'Abono registrado');
            this.reset();
        })
        .catch(err => alert('Error: ' + err));
    });

    // Cargar créditos (para seleccionar en abono)
    // En una implementación real, se cargaría un listado de créditos activos.
});