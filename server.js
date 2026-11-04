require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const DATAJUD_API_KEY = process.env.DATAJUD_API_KEY || "APIKey cjVwYXdsaWNhOmNqdnBhd2xpY2E=";

// 1. Rota de Tradução Inteligente com IA (Resumo Humanizado para o Cliente)
app.post('/api/processos/traduzir-ia', async (req, res) => {
    try {
        const { textoTecnico } = req.body;

        if (!textoTecnico) {
            return res.status(400).json({ error: 'Texto técnico é obrigatório.' });
        }

        // Simulação avançada do Motor LLM jurídico (Podes conectar OpenAI/Gemini futuramente)
        // Aqui geramos a tradução humanizada estruturada para o cliente
        let resumoCliente = "Houve uma nova movimentação importante no seu processo. A nossa equipa jurídica está a acompanhar de perto.";
        let urgenciaCalculada = "Média";

        const textoLower = textoTecnico.toLowerCase();
        if (textoLower.includes('sentença') || textoLower.includes('julgado') || textoLower.includes('procedente')) {
            resumoCust = "O juiz proferiu uma decisão/sentença no seu processo. Temos novidades importantes sobre o desfecho da causa!";
            urgenciaCalculada = "Alta";
        } else if (textoLower.includes('citação') || textoLower.includes('intimados') || textoLower.includes('prazo')) {
            resumoCliente = "Recebemos uma nova intimação com prazos processuais que já estão a ser rigorosamente tratados pela nossa equipa.";
            urgenciaCalculada = "Alta";
        } else if (textoLower.includes('concluso') || textoLower.includes('conclusos')) {
            resumoCliente = "O seu processo foi enviado para a mesa do juiz e está a aguardar análise e despacho breve.";
            urgenciaCalculada = "Baixa";
        } else {
            resumoCliente = `Foi registado um novo andamento oficial: "${textoTecnico}". O processo segue o seu ritmo normal.`;
        }

        return res.status(200).json({
            status: 'sucesso',
            resumoTraduzido: resumoCliente,
            urgencia: urgenciaCalculada
        });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 2. Rota de Consulta Automática ao DataJud (CNJ)
app.post('/api/processos/consultar-cnj', async (req, res) => {
    try {
        const { numeroProcesso } = req.body;
        if (!numeroProcesso) return res.status(400).json({ error: 'Número obrigatório.' });

        const numeroLimpo = numeroProcesso.replace(/[-.]/g, '');

        const cnjResponse = await fetch('https://api-publica.datajud.cnj.jus.br/api_v1_processo/_search', {
            method: 'POST',
            headers: {
                'Authorization': DATAJUD_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: { match: { "numeroProcesso": numeroLimpo } } })
        });

        if (!cnjResponse.ok) throw new Error(`Erro na API DataJud: status ${cnjResponse.status}`);

        const cnjData = await cnjResponse.json();
        const hits = cnjData.hits?.hits || [];

        if (hits.length === 0) {
            return res.status(404).json({ mensagem: 'Nenhum andamento encontrado no DataJud/CNJ.' });
        }

        const dadosProcesso = hits[0]._source;
        const movimentacoes = dadosProcesso.movimentos || [];
        const ultimoMovimento = movimentacoes.length > 0 ? movimentacoes[movimentacoes.length - 1] : null;
        const textoAndamento = ultimoMovimento ? `${ultimoMovimento.nome} - ${ultimoMovimento.complementosTabelados?.[0]?.nome || ''}` : 'Sem andamento recente';

        return res.status(200).json({
            status: 'sucesso',
            numero: dadosProcesso.numeroProcesso,
            orgaoJulgador: dadosProcesso.orgaoJulgador?.nome,
            ultimaMovimentacao: textoAndamento
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 3. Rota para salvar ou atualizar processos
app.post('/api/processos', async (req, res) => {
    try {
        const { id, numero, cliente, whatsapp, urgencia, status, historico } = req.body;

        const { data, error } = await supabase
            .from('processos')
            .upsert([
                {
                    id: id || Date.now().toString(),
                    numero,
                    cliente,
                    whatsapp,
                    urgencia: urgencia || 'Médio',
                    status: status || 'Em Andamento',
                    historico,
                    created_at: new Date().toISOString()
                }
            ]);

        if (error) throw error;
        return res.status(200).json({ status: 'sucesso', mensagem: 'Processo atualizado com sucesso!' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 4. Rota para listar os processos
app.get('/api/processos', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('processos')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return res.status(200).json(data);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`JurisSync AI Backend v2.3 (AI Engine Active) na porta ${PORT}`));
