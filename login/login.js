document.getElementById('form-login').addEventListener('submit', (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim().toLowerCase();
    const senha = document.getElementById('senha').value;
    const feedback = document.getElementById('feedback');

    const usuarios = JSON.parse(localStorage.getItem('pocoto_users') || '[]');
    const usuario = usuarios.find(u => u.email === email && u.senha === btoa(senha));

    if (!usuario) {
        feedback.textContent = 'E-mail ou senha incorretos.';
        feedback.className = 'msg-feedback erro';
        return;
    }

    localStorage.setItem('pocoto_session', JSON.stringify({
        nome: usuario.nome,
        email: usuario.email
    }));

    feedback.textContent = `Bem-vindo de volta, ${usuario.nome}!`;
    feedback.className = 'msg-feedback sucesso';

    setTimeout(() => {
        window.location.href = '../index.html';
    }, 800);
});