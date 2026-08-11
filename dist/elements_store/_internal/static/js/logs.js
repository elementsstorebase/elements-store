document.addEventListener('DOMContentLoaded', function() {
    fetch('/api/logs')
        .then(r => r.json())
        .then(data => {
            const tbody = document.getElementById('tabla-logs');
            tbody.innerHTML = '';
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-400">No hay logs</td></tr>';
                return;
            }
            data.forEach(log => {
                const tr = document.createElement('tr');
                tr.className = 'border-b border-gray-100';
                tr.innerHTML = `
                    <td class="py-2">${log.fecha}</td>
                    <td><span class="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">${log.accion}</span></td>
                    <td>${log.detalle}</td>
                    <td>${log.usuario}</td>
                `;
                tbody.appendChild(tr);
            });
        });
});