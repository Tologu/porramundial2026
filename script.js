document.querySelectorAll('.partido-card').forEach(card => {
    const confirmarBtn = card.querySelector('.btn-confirmar');
    const cambiarBtn = card.querySelector('.btn-cambiar');
    const marcadores = card.querySelectorAll('.marcador');

    confirmarBtn.addEventListener('click', () => {
        marcadores.forEach(input => input.setAttribute('readonly', true));
        confirmarBtn.disabled = true;
        cambiarBtn.disabled = false;
    });

    cambiarBtn.addEventListener('click', () => {
        marcadores.forEach(input => input.removeAttribute('readonly'));
        confirmarBtn.disabled = false;
        cambiarBtn.disabled = true;
    });
});
