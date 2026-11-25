/* =========================================================
   POCOTO GAMES - RANKING GLOBAL NA NUVEM (FIRESTORE)
   ========================================================= */
window.PocotoRank = {
    calcularXP(stats = {}) {
        const s = {
            pocotoScore: Number(stats.pocotoScore || 0),
            poolWins: Number(stats.poolWins || 0),
            careerOvr: Number(stats.careerOvr || 0),
            fnafNight: Number(stats.fnafNight || 0)
        };
        return s.pocotoScore + (s.poolWins * 50) + (s.careerOvr * 3) + (s.fnafNight * 40);
    },

    obterPatente(xp = 0) {
        const pontos = Number(xp || 0);
        if (pontos >= 1500) return { titulo: 'Mestre Pocotó', icone: '👑', classe: 'rank-mestre' };
        if (pontos >= 800)  return { titulo: 'Lenda do Haras', icone: '🔥', classe: 'rank-lenda' };
        if (pontos >= 400)  return { titulo: 'Garanhão Campeão', icone: '🏆', classe: 'rank-campeao' };
        if (pontos >= 150)  return { titulo: 'Cavalo de Corrida', icone: '🐎', classe: 'rank-corrida' };
        return { titulo: 'Pônei Iniciante', icone: '🐴', classe: 'rank-ponei' };
    },

    // Atualiza estatística do jogador logado no Firestore
    // mode: 'max' (mantém o maior recorde) | 'add' (soma +1 vitória)
    async registrar(campo, valor, mode = 'max') {
        const user = window.fbAuth && fbAuth.currentUser;
        if (!user) return false;

        const ref = fbDb.collection('usuarios').doc(user.uid);
        const snap = await ref.get();
        const dados = snap.exists ? snap.data() : {};
        const stats = Object.assign(
            { pocotoScore: 0, poolWins: 0, careerOvr: 0, fnafNight: 0 },
            dados.stats || {}
        );

        const atual = Number(stats[campo] || 0);
        stats[campo] = mode === 'add' ? atual + Number(valor) : Math.max(atual, Number(valor));
        const xp = this.calcularXP(stats);

        await ref.set({
            nome: dados.nome || user.displayName || user.email.split('@')[0],
            email: user.email,
            stats,
            xp,
            atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        return true;
    },

    // Busca todos os jogadores do Firestore ordenados por categoria
    async obterRanking(categoria = 'geral') {
        const snap = await fbDb.collection('usuarios').limit(100).get();
        const lista = [];

        snap.forEach(doc => {
            const d = doc.data();
            const stats = Object.assign(
                { pocotoScore: 0, poolWins: 0, careerOvr: 0, fnafNight: 0 },
                d.stats || {}
            );
            const xp = this.calcularXP(stats);
            lista.push({
                uid: doc.id,
                nome: d.nome || 'Jogador',
                stats,
                xp,
                patente: this.obterPatente(xp)
            });
        });

        return lista.sort((a, b) => {
            if (categoria === 'geral') return b.xp - a.xp;
            return (b.stats[categoria] || 0) - (a.stats[categoria] || 0);
        });
    }
};