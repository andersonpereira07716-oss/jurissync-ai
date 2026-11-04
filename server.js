require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const DATAJUD_API_KEY = process.env.DATAJUD_API_KEY || "APIKey cjVwYXdsaWNhOmNqdnBhd2xpY2E=";
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || "";
const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN || "";

// 1. Rota de Gestão de Assinatura e Planos SaaS (Stripe / Asaas Mock)
app.post('/api/saas/assinar', async (req, res) => {
    try {
        const { escritorioId, plano, email } = req.body;
        
        if (!escritorioId || !plano) {
            return res.status(400).json({ error: 'ID do escritório e plano são obrigatórios.' });
        }

        // Simulação de criação de checkout ou ativação de licença SaaS
        const planosValidos = {
            'solo': { limiteProcessos: 50, valor: 'R$ 97/mês' },
            'escritorio': { limiteProcessos: 300, valor: 'R$ 197/mês' },
            'enterprise': { limiteProcessos: 9999, valor: 'R$ 497/mês' }
        };

        const dadosPlano = planosValidos[plano] || planosValidos['solo'];

        return res.status(200).json({
            status: 'sucesso',
            mensagem: `Assinatura do plano ${plano.toUpperCase()} ativada com sucesso!`,
            detalhes: {
                escritorioId,
                email: email || 'advogado@escritorio.com',
                limiteProcessos: dadosPlano.limiteProcessos,
                valorMensal: dadosPlano.valor,
                renovacaoAutomatica: true
            }
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 2. Rota de Disparo Automático via API do WhatsApp
app.post('/api/processos/notificar-whatsapp', async (req, res) => {
    try {
        const { telefone, cliente, numeroProcesso, mensagem } = req.body;

        if (!telefone || !mensagem) {
            return res.status(400).json({ error: 'Telefone e mensagem são obrigatórios.' });
        }

        const mensagemTexto = `Olá, ${cliente}! Segue a atualização do seu processo nº ${numeroProcesso}:\n\n"${mensagem}"\n\nQualquer dúvida, estamos à disposição!`;

        if (WHATSAPP_API_URL && WHATSAPP_API_TOKEN) {
            const apiRes = await fetch(WHATSAPP_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': WHATSAPP_API_TOKEN
                },
                body: JSON.stringify({ number: telefone, text: mensagemTexto })
            });

            if (!apiRes.ok) throw new Error(`Falha no Gateway de WhatsApp: status ${apiRes.status}`);

            return res.status(200).json({ status: 'sucesso', modo: 'API_AUTOMATICO', mensagem: 'Mensagem enviada automaticamente!' });
        }

        const linkWhats = `https://api.whatsapp.com/send?phone=${telefone}&text=${encodeURIComponent(mensagemTexto)}`;
        return res.status(200).json({ status: 'sucesso', modo: 'DEEP_LINK', link: linkWhats });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 3. Rota de Tradução Inteligente com IA
app.post('/api/processos/traduzir-ia', async (req, res) => {
    try {
        const { textoTecnico } = req.body;
        if (!textoTecnico) return res.status(400).json({ error: 'Texto técnico é obrigatório.' });

        let resumoCliente = "Houve uma nova movimentação importante no seu processo. A nossa equipa jurídica está a acompanhar de perto.";
        let urgenciaCalculada = "Média";

        const textoLower = textoTecnico.toLowerCase();
        if (textoLower.includes('sentença') || textoLower.includes('julgado') || textoLower.includes('procedente')) {
            resumoCliente = "O juiz proferiu uma decisão/sentença no seu processo. Temos novidades importantes sobre o desfecho da causa!";
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

        return res.status(200).json({ status: 'sucesso', resumoTraduzido: resumoCliente, urgencia: urgenciaCalculada });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 4. Rota de Consulta Automática ao DataJud (CNJ)
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

// 5. Rota para salvar ou atualizar processos com Multi-tenancy (tenant_id)
app.post('/api/processos', async (req, res) => {
    try {
        const { id, numero, cliente, whatsapp, urgencia, status, historico, tenantId } = req.body;

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
                    tenant_id: tenantId || 'escritorio_padrao',
                    created_at: new Date().toISOString()
                }
            ]);

        if (error) throw error;
        return res.status(200).json({ status: 'sucesso', mensagem: 'Processo guardado com sucesso!' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 6. Rota para listar os processos por tenant/escritório
app.get('/api/processos', async (req, res) => {
    try {
        const tenantId = req.query.tenantId || 'escritorio_padrao';

        const { data, error } = await supabase
            .from('processos')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return res.status(200).json(data);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`JurisSync AI Backend v4.0 (SaaS Multi-Tenant Active) na porta ${PORT}`));
