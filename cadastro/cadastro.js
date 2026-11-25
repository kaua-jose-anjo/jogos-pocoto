document.getElementById('form-cadastro').addEventListener('submit', async (e) => {
    e.preventDefault();

    const nome = document.getElementById('nome').value.trim();
    const email = document.getElementById('email').value.trim().toLowerCase();
    const senha = document.getElementById('senha').value;
    const confirmar = document.getElementById('confirmar').value;
    const feedback = document.getElementById('feedback');
    const btn = document.getElementById('btn-submit');

    if (senha !== confirmar) {
        feedback.textContent = 'As senhas não coincidem.';
        feedback.className = 'msg-feedback erro';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Criando conta...';

    try {
        const cred = await fbAuth.createUserWithEmailAndPassword(email, senha);
        await cred.user.updateProfile({ displayName: nome });

        await fbDb.collection('usuarios').doc(cred.user.uid).set({
            nome,
            email,
            stats: {
                pocotoScore: 0,
                poolWins: 0,
                careerOvr: 0,
                fnafNight: 0
            },
            xp: 0,
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });

        feedback.textContent = 'Conta criada na nuvem! Redirecionando...';
        feedback.className = 'msg-feedback sucesso';

        setTimeout(() => {
            window.location.href = '../index.html';
        }, 900);
    } catch (err) {
        let msg = 'Erro ao cadastrar. Tente novamente.';
        if (err.code === 'auth/email-already-in-use') msg = 'Este e-mail já está cadastrado.';
        else if (err.code === 'auth/invalid-email') msg = 'E-mail inválido.';
        else if (err.code === 'auth/weak-password') msg = 'A senha deve ter pelo menos 6 caracteres.';

        feedback.textContent = msg;
        feedback.className = 'msg-feedback erro';
        btn.disabled = false;
        btn.textContent = 'Cadastrar e Entrar';
    }
});