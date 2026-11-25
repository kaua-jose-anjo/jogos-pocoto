document.addEventListener('DOMContentLoaded', () => {
    const userArea = document.getElementById('user-area');
    if (!userArea) return;

    const sessao = JSON.parse(localStorage.getItem('pocoto_session') || 'null');

    if (sessao) {
        userArea.innerHTML = `
            <span style="color:#FFD700;font-weight:700;margin-right:10px;">👤 ${sessao.nome}</span>
            <button id="btn-logout" style="background:#8B5A2B;color:#fff;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-weight:700;">Sair</button>
        `;
        document.getElementById('btn-logout').addEventListener('click', () => {
            localStorage.removeItem('pocoto_session');
            window.location.reload();
        });
    } else {
        userArea.innerHTML = `
            <a href="login/index.html" style="color:#fff;text-decoration:none;background:#2E6F32;padding:7px 14px;border-radius:8px;font-weight:700;margin-right:6px;">Entrar</a>
            <a href="cadastro/index.html" style="color:#fff;text-decoration:none;background:#8B5A2B;padding:7px 14px;border-radius:8px;font-weight:700;">Cadastrar</a>
        `;
    }
});