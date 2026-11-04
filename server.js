require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Chave Pública DataJud API CNJ (Ambiente de Produção Público)
const DATAJUD_API_KEY = process.env.DATAJUD_API_KEY || "APIKey cjVwYXdsaWNhOmNqdnBhd2xpY2E=";

// 1. Rota de Consulta Automática ao DataJud (CNJ)
app.post('/api/processos/consultar-cnj', async (req, res) => {
    try {
        const { numeroProcesso, siglaTribunal } = req.body;

        if (!numeroProcesso) {
            return res.status(400).json({ error: 'Número do processo é obrigatório.' });
        }

        // Sanitiza o número do processo (remove traços e pontos para a busca)
        const numeroLimpo = numeroProcesso.replace(/[-.]/g, '');
        const tribunal = siglaTribunal || 'TJ';

        // Chamada à API oficial do DataJud/CNJ
        const cnjResponse = await fetch('https://api-publica.datajud.cnj.jus.br/api_v1_processo/_search', {
            method: 'POST',
            headers: {
                'Authorization': DATAJUD_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: {
                    match: {
                        "numeroProcesso": numeroLimpo
                    }
                }
            })
        });

        if (!cnjResponse.ok) {
            throw new Error(`Erro na API DataJud: status ${cnjResponse.status}`);
        }

        const cnjData = await cnjResponse.json();
        const hits = cnjData.hits?.hits || [];

        if (hits.length === 0) {
            return res.status(404).json({ mensagem: 'Nenhum andamento encontrado no DataJud/CNJ para este processo.' });
        }

        const dadosProcesso = hits[0]._source;
        const movimentacoes = dadosProcesso.movimentos || [];

        // Pega o último movimento registrado
        const ultimoMovimento = movimentacoes.length > 0 ? movimentacoes[movimentacoes.length - 1] : null;
        const textoAndamento = ultimoMovimento ? `${ultimoMovimento.nome} - ${ultimoMovimento.complementosTabelados?.[0]?.nome || ''}` : 'Sem andamento recente';

        return res.status(200).json({
            status: 'sucesso',
            numero: dadosProcesso.numeroProcesso,
            classe: dadosProcesso.classe?.nome,
            orgaoJulgador: dadosProcesso.orgaoJulgador?.nome,
            ultimaMovimentacao: textoAndamento,
            dataHora: ultimoMovimento?.dataHora || new Date().toISOString()
        });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 2. Rota para salvar ou atualizar processos
app.post('/api/processos', async (req, res) => {
    try {
        const { id, numero, cliente, whatsapp, urgencia, status, historico, tribunal } = req.body;

        const { data, error } = await supabase
            .from('processos')
            .upsert([
                {
                    id: id || Date.now().toString(),
                    numero,
                    cliente,
                    whatsapp,
                    urgencia,
                    status,
                    historico,
                    tribunal: tribunal || 'TJ',
                    ultima_consulta_at: new Date().toISOString()
                }
            ]);

        if (error) throw error;

        return res.status(200).json({ status: 'sucesso', mensagem: 'Processo atualizado com sucesso!', data });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 3. Rota para listar os processos
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
app.listen(PORT, () => console.log(`JurisSync AI Backend v2.2 (DataJud Active) na porta ${PORT}`));
