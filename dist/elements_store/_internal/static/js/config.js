document.addEventListener('DOMContentLoaded', function() {
    // Cargar configuración actual
    fetch('/api/config')
        .then(r => r.json())
        .then(data => {
            document.getElementById('tasa-personalizada').value = data.tasa_personalizada || '';
        });

    // Guardar configuración
    document.getElementById('form-config').addEventListener('submit', function(e) {
        e.preventDefault();
        const valor = document.getElementById('tasa-personalizada').value;
        if (!valor) {
            alert('Ingrese un valor');
            return;
        }
        fetch('/api/config', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ clave: 'tasa_personalizada', valor: valor })
        })
        .then(r => r.json())
        .then(res => {
            alert(res.mensaje || 'Configuración guardada');
        })
        .catch(err => alert('Error: ' + err));
    });
});