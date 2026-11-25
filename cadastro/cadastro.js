document.getElementById('form-cadastro').addEventListener('submit', (e) => {
    e.preventDefault();

    const nome = document.getElementById('nome').value.trim();
    const email = document.getElementById('email').value.trim().toLowerCase();
    const senha = document.getElementById('senha').value;
    const confirmar = document.getElementById('confirmar').value;
    const feedback = document.getElementById('feedback');

    if (senha !== confirmar) {
        feedback.textContent = 'As senhas não coincidem.';
        feedback.className = 'msg-feedback erro';
        return;
    }

    const usuarios = JSON.parse(localStorage.getItem('pocoto_users') || '[]');

    if (usuarios.some(u => u.email === email)) {
        feedback.textContent = 'Este e-mail já está cadastrado.';
        feedback.className = 'msg-feedback erro';
        return;
    }

    const novoUsuario = {
        nome,
        email,
        senha: btoa(senha),
        criadoEm: new Date().toISOString()
    };

    usuarios.push(novoUsuario);
    localStorage.setItem('pocoto_users', JSON.stringify(usuarios));
    localStorage.setItem('pocoto_session', JSON.stringify({ nome, email }));

    feedback.textContent = 'Conta criada! Redirecionando para o portal...';
    feedback.className = 'msg-feedback sucesso';

    setTimeout(() => {
        window.location.href = '../index.html';
    }, 1000);
});