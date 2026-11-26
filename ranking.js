window.PocotoRank = {
    statsPadrao() {
        return {
            pocotoScore: 0,
            poolWins: 0,
            careerOvr: 0,
            fnafNight: 0,
            defenseWave: 0
        };
    },

    calcularXP(stats = {}) {
        const s = {
            pocotoScore: Number(stats.pocotoScore || 0),
            poolWins: Number(stats.poolWins || 0),
            careerOvr: Number(stats.careerOvr || 0),
            fnafNight: Number(stats.fnafNight || 0),
            defenseWave: Number(stats.defenseWave || 0)
        };
        return (
            s.pocotoScore +
            (s.poolWins * 50) +
            (s.careerOvr * 3) +
            (s.fnafNight * 40) +
            (s.defenseWave * 15)
        );
    },

    obterPatente(xp = 0) {
        const pontos = Number(xp || 0);
        if (pontos >= 100000) return { titulo: 'Mestre Pocotó', icone: '👑', classe: 'rank-mestre' };
        if (pontos >= 10000)  return { titulo: 'Lenda do Haras', icone: '🔥', classe: 'rank-lenda' };
        if (pontos >= 5000)  return { titulo: 'Garanhão Campeão', icone: '🏆', classe: 'rank-campeao' };
        if (pontos >= 1000)  return { titulo: 'Cavalo de Corrida', icone: '🐎', classe: 'rank-corrida' };
        return { titulo: 'Pônei Iniciante', icone: '🐴', classe: 'rank-ponei' };
    },

    async registrar(campo, valor, modo = 'max') {
        if (!window.fbAuth || !window.fbDb) return;
        const user = fbAuth.currentUser;
        if (!user) return;

        const valNum = Number(valor || 0);
        if (valNum <= 0) return;

        const ref = fbDb.collection('usuarios').doc(user.uid);
        try {
            await fbDb.runTransaction(async (tx) => {
                const doc = await tx.get(ref);
                const dados = doc.exists ? doc.data() : {};
                const stats = Object.assign(this.statsPadrao(), dados.stats || {});
                const atual = Number(stats[campo] || 0);

                if (modo === 'add') {
                    stats[campo] = atual + valNum;
                } else {
                    if (valNum <= atual) return;
                    stats[campo] = valNum;
                }

                const xp = this.calcularXP(stats);
                const patente = this.obterPatente(xp);

                tx.set(ref, {
                    nome: dados.nome || user.displayName || (user.email ? user.email.split('@')[0] : 'Jogador'),
                    email: dados.email || user.email || '',
                    stats: stats,
                    xp: xp,
                    patente: patente.titulo,
                    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            });
        } catch (err) {
            console.error('Erro ao registrar pontuação no ranking:', err);
        }
    }
};