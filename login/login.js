document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim().toLowerCase();
    const senha = document.getElementById('senha').value;
    const feedback = document.getElementById('feedback');
    const btn = document.getElementById('btn-submit');

    btn.disabled = true;
    btn.textContent = 'Entrando...';

    try {
        const cred = await fbAuth.signInWithEmailAndPassword(email, senha);
        const nome = cred.user.displayName || email.split('@')[0];

        feedback.textContent = `Bem-vindo de volta, ${nome}!`;
        feedback.className = 'msg-feedback sucesso';

        setTimeout(() => {
            window.location.href = '../index.html';
        }, 800);
    } catch (err) {
        feedback.textContent = 'E-mail ou senha incorretos.';
        feedback.className = 'msg-feedback erro';
        btn.disabled = false;
        btn.textContent = 'Entrar';
    }
});