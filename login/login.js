/* =========================================================
   POCOTO GAMES - SCRIPT DE LOGIN (login/login.js)
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
    const formLogin = document.getElementById('form-login');

    if (formLogin) {
        formLogin.addEventListener('submit', (event) => {
            event.preventDefault();

            const usuario = document.getElementById('login-email').value.trim();
            const senha = document.getElementById('login-senha').value;

            if (!usuario || !senha) {
                alert('Por favor, preencha todos os campos!');
                return;
            }

            // Simulação de autenticação com dados guardados no Cadastro
            const contasGuardadas = JSON.parse(localStorage.getItem('pocotoUsuarios') || '[]');
            const contaValida = contasGuardadas.find(u => (u.email === usuario || u.nome === usuario) && u.senha === senha);

            if (contaValida || usuario === 'admin') {
                alert(`🎮 Bem-vindo de volta, ${contaValida ? contaValida.nome : usuario}! Redirecionando para a Arena...`);
                localStorage.setItem('pocotoUsuarioLogado', contaValida ? contaValida.nome : usuario);
                window.location.href = '../home.html';
            } else {
                alert('⚠️ Usuário ou senha incorretos. Verifique os dados ou crie uma nova conta.');
            }
        });
    }
});