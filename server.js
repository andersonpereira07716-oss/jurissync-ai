const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const DB_FILE = path.join('/tmp', 'database.json'); // /tmp é gravável na Vercel

app.use(cors());
app.use(bodyParser.json());

// Inicializar banco de dados temporário se não existir
if (!fs.existsSync(DB_FILE)) {
    const initialData = {
        processos: [
            {
                id: "1",
                numero: "0001234-88.2026.8.15.0001",
                cliente: "Maria Silva",
                whatsapp: "5583999999999",
                urgencia: "Médio",
                status: "Citado / Aguardando Prazo",
                historico: [
                    {
                        data: "01/11/2026",
                        movimentacao: "Certifico que o mandado foi cumprido positivo, com citação e intimação da parte ré.",
                        resumoCliente: "O oficial de justiça entregou a notificação para a outra parte com sucesso. Próximo passo: aguardar o prazo de defesa."
                    }
                ]
            },
            {
                id: "2",
                numero: "0004567-12.2026.8.15.0042",
                cliente: "João de Souza",
                whatsapp: "5583988888888",
                urgencia: "Alto",
                status: "Sentença Proferida",
                historico: [
                    {
                        data: "02/11/2026",
                        movimentacao: "Julgado procedente o pedido do autor na sentença.",
                        resumoCliente: "Temos uma excelente notícia! O juiz deu ganho de causa ao nosso pedido principal na sentença."
                    }
                ]
            }
        ]
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
}

function getDb() {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDb(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// API: Listar processos
app.get('/api/processos', (req, res) => {
    const db = getDb();
    res.json(db.processos);
});

// API: Adicionar novo processo ou nova movimentação
app.post('/api/processos', (req, res) => {
    const { numero, cliente, whatsapp, movimentacao } = req.body;
    const db = getDb();

    let resumoCliente = "Houve uma nova movimentação no seu processo. Estamos analisando os desdobramentos.";
    let urgencia = "Baixo";
    let status = "Em Andamento";

    const movLower = (movimentacao || "").toLowerCase();
    if (movLower.includes('positivo') || movLower.includes('citado') || movLower.includes('citação')) {
        resumoCliente = "A outra parte foi localizada e notificada oficialmente pela justiça! Agora o processo segue para as próximas etapas.";
        urgencia = "Médio";
        status = "Citado / Aguardando Prazo";
    } else if (movLower.includes('sentença') || movLower.includes('julgado') || movLower.includes('procedente')) {
        resumoCliente = "O juiz proferiu uma decisão/sentença sobre o seu caso. Já estamos verificando o teor para conversarmos.";
        urgencia = "Alto";
        status = "Sentença Proferida";
    }

    const novaMov = {
        data: new Date().toLocaleDateString('pt-BR'),
        movimentacao,
        resumoCliente
    };

    let processo = db.processos.find(p => p.numero === numero);

    if (processo) {
        processo.historico.unshift(novaMov);
        processo.urgencia = urgencia;
        processo.status = status;
        if (cliente) processo.cliente = cliente;
        if (whatsapp) processo.whatsapp = whatsapp;
    } else {
        processo = {
            id: Date.now().toString(),
            numero,
            cliente: cliente || "Cliente Anônimo",
            whatsapp: whatsapp || "5583999999999",
            urgencia,
            status,
            historico: [novaMov]
        };
        db.processos.unshift(processo);
    }

    saveDb(db);
    res.json({ success: true, processo });
});

// Exportar para a Vercel (Serverless)
module.exports = app;
