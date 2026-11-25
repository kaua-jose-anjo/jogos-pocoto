document.addEventListener('DOMContentLoaded', () => {
    const userArea = document.getElementById('user-area');
    if (!userArea) return;

    fbAuth.onAuthStateChanged(async (user) => {
        if (user) {
            let nome = user.displayName || user.email.split('@')[0];
            let xp = 0;

            try {
                const doc = await fbDb.collection('usuarios').doc(user.uid).get();
                if (doc.exists) {
                    const data = doc.data();
                    if (data.nome) nome = data.nome;
                    if (typeof data.xp === 'number') xp = data.xp;
                }
            } catch (e) {}

            const patente = window.PocotoRank ? PocotoRank.obterPatente(xp) : { icone: '🐴', titulo: 'Pônei' };

            userArea.innerHTML = `
                <span style="background:rgba(0,0,0,0.28);border:1px solid #FFD700;color:#FFD700;padding:5px 11px;border-radius:20px;font-weight:700;font-size:0.88rem;margin-right:8px;">
                    ${patente.icone} ${nome} • ${xp} XP
                </span>
                <button id="btn-logout" style="background:#8B5A2B;color:#fff;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-weight:700;">Sair</button>
            `;

            document.getElementById('btn-logout').addEventListener('click', async () => {
                await fbAuth.signOut();
                window.location.reload();
            });
        } else {
            userArea.innerHTML = `
                <a href="login/index.html" style="color:#fff;text-decoration:none;background:#2E6F32;padding:7px 14px;border-radius:8px;font-weight:700;margin-right:6px;">Entrar</a>
                <a href="cadastro/index.html" style="color:#fff;text-decoration:none;background:#8B5A2B;padding:7px 14px;border-radius:8px;font-weight:700;">Cadastrar</a>
            `;
        }
    });
});