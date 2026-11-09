

document.addEventListener('DOMContentLoaded', () => {
    console.log("Pocoto Games - Página Inicial carregada com sucesso!");

    // 1. Configura a navegação com rolagem suave no menu
    configurarNavegacaoSuave();

    // 2. Configura a janela modal (sub-aba) com as informações do site na Seção 1
    configurarModalSobre();

    // 3. Configura a validação do formulário de agendamentos na Seção 4
    configurarFormularioAgendamento();
});

/**
 * Adiciona transição de rolagem suave ao clicar nos links da barra de navegação
 */
function configurarNavegacaoSuave() {
    const navLinks = document.querySelectorAll('.navbar a[href^="#"]');

    navLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const targetId = link.getAttribute('href');
            const targetSection = document.querySelector(targetId);

            if (targetSection) {
                targetSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

/**
 * Controla a exibição e os eventos da sub-aba (modal) sobre o propósito da plataforma
 */
function configurarModalSobre() {
    const modal = document.getElementById('modal-sobre');
    const btnAbrir = document.getElementById('btn-abrir-sobre');
    const btnFechar = document.getElementById('btn-fechar-modal');
    const btnEntendido = document.getElementById('btn-entendido');

    if (btnAbrir && modal) {
        // Abrir a janela modal
        btnAbrir.addEventListener('click', () => {
            modal.style.display = 'flex';
        });

        // Fechar no ícone "X"
        if (btnFechar) {
            btnFechar.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        // Fechar no botão "Entendido"
        if (btnEntendido) {
            btnEntendido.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        // Fechar ao clicar fora da caixa do modal
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
}

/**
 * Processa a confirmação de inscrição/agendamento de torneios
 */
function configurarFormularioAgendamento() {
    const formAgendamento = document.querySelector('.appointment-form');

    if (formAgendamento) {
        formAgendamento.addEventListener('submit', (event) => {
            event.preventDefault();

            const dataInput = document.getElementById('data-agendamento').value;
            const horaInput = document.getElementById('hora-agendamento').value;

            if (!dataInput || !horaInput) {
                alert('Por favor, selecione a data e o horário para confirmar a sua inscrição.');
                return;
            }

            // Formatação de data no padrão brasileiro (DD/MM/AAAA)
            const [ano, mes, dia] = dataInput.split('-');
            const dataFormatada = `${dia}/${mes}/${ano}`;

            // Salva o último agendamento no navegador do usuário
            const agendamento = { data: dataFormatada, hora: horaInput };
            localStorage.setItem('ultimoAgendamentoPocoto', JSON.stringify(agendamento));

            // Notificação de confirmação
            alert(`🎉 Inscrição confirmada com sucesso!\n\nData: ${dataFormatada}\nHorário: ${horaInput}\n\nEsperamos por você na Arena Pocoto Games!`);

            formAgendamento.reset();
        });
    }
}