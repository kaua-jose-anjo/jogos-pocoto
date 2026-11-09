/* =========================================================
   POCOTO GAMES - SCRIPT DE CADASTRO (cadastro/cad.js)
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
    const formCad = document.getElementById('form-cadastro');

    if (formCad) {
        formCad.addEventListener('submit', (event) => {
            event.preventDefault();

            const nome = document.getElementById('cad-nome').value.trim();
            const email = document.getElementById('cad-email').value.trim();
            const senha = document.getElementById('cad-senha').value;
            const confirma = document.getElementById('cad-confirma').value;

            // Validações
            if (senha !== confirma) {
                alert('⚠️ As senhas digitadas não coincidem. Tente novamente.');
                return;
            }

            if (senha.length < 4) {
                alert('⚠️ A senha deve ter pelo menos 4 caracteres.');
                return;
            }

            // Armazenamento local
            const contas = JSON.parse(localStorage.getItem('pocotoUsuarios') || '[]');
            const usuarioExiste = contas.some(u => u.email === email);

            if (usuarioExiste) {
                alert('⚠️ Este e-mail já está cadastrado. Faça login ou use outro e-mail.');
                return;
            }

            contas.push({ nome, email, senha });
            localStorage.setItem('pocotoUsuarios', JSON.stringify(contas));

            alert(`🎉 Conta criada com sucesso! Seja bem-vindo à Arena, ${nome}. Redirecionando para a tela de login...`);
            window.location.href = '../login/index_login.html';
        });
    }
});