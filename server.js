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

// 1. Registo Protegido contra Golpes de Teste (Validação por E-mail e WhatsApp)
app.post('/api/auth/registar', async (req, res) => {
    try {
        const { nomeEscritorio, email, senha, whatsapp } = req.body;
        if (!email || !senha || !nomeEscritorio || !whatsapp) {
            return res.status(400).json({ error: 'Preencha todos os campos, incluindo o WhatsApp.' });
        }

        const emailLimpo = email.trim().toLowerCase();
        const whatsLimpo = whatsapp.replace(/\D/g, ''); // Remove formatação

        // Verifica se o e-mail já existe
        const { data: checkEmail } = await supabase
            .from('escritorios')
            .select('tenant_id')
            .eq('email', emailLimpo)
            .maybeSingle();

        if (checkEmail) {
            return res.status(400).json({ error: 'Este e-mail já possui uma conta registada.' });
        }

        // Verifica se o WhatsApp já foi usado para ativar o teste grátis
        const { data: checkWhats } = await supabase
            .from('escritorios')
            .select('tenant_id')
            .eq('whatsapp', whatsLimpo)
            .maybeSingle();

        if (checkWhats) {
            return res.status(400).json({ error: 'Este número de WhatsApp já utilizou o período de teste gratuito de 3 dias.' });
        }

        const tenantId = 'esc_' + Math.random().toString(36).substring(2, 9);
        const dataCriacao = new Date().toISOString();

        const { error } = await supabase
            .from('escritorios')
            .insert([{ 
                tenant_id: tenantId, 
                nome_escritorio: nomeEscritorio, 
                email: emailLimpo, 
                senha, 
                whatsapp: whatsLimpo,
                plano: 'solo', 
                status_assinatura: 'trial',
                created_at: dataCriacao
            }]);

        if (error) throw error;

        return res.status(200).json({ status: 'sucesso', tenantId, nomeEscritorio });
    } catch (err) {
        console.error("Erro no Registo:", err);
        return res.status(500).json({ error: 'Erro interno ao registar: ' + err.message });
    }
});

// 2. Login de Escritório
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        if (!email || !senha) {
            return res.status(400).json({ error: 'E-mail e senha obrigatórios.' });
        }

        const emailFormatado = email.trim().toLowerCase();

        const { data, error } = await supabase
            .from('escritorios')
            .select('*')
            .eq('email', emailFormatado)
            .eq('senha', senha)
            .maybeSingle();

        if (error || !data) {
            return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
        }

        let diasRestantes = 3;
        if (data.created_at) {
            const dataCriacao = new Date(data.created_at);
            const agora = new Date();
            const diffDias = Math.floor((agora - dataCriacao) / (1000 * 60 * 60 * 24));
            diasRestantes = Math.max(0, 3 - diffDias);
        }

        return res.status(200).json({
            status: 'sucesso',
            tenantId: data.tenant_id,
            nomeEscritorio: data.nome_escritorio,
            plano: data.plano || 'solo',
            diasRestantes: diasRestantes
        });
    } catch (err) {
        return res.status(500).json({ error: 'Erro ao fazer login.' });
    }
});

// 3. Redirecionamento para os Links Oficiais do Mercado Pago
app.post('/api/saas/criar-pagamento', async (req, res) => {
    try {
        const { plano } = req.body;
        
        const linksPagamento = {
            'solo': 'https://mpago.la/2sd5VTS',
            'escritorio': 'https://mpago.la/15XTnEn',
            'enterprise': 'https://mpago.la/2y4K2H9'
        };

        const linkFinal = linksPagamento[plano] || linksPagamento['solo'];

        return res.status(200).json({
            status: 'sucesso',
            init_point: linkFinal
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 4. Disparo Automático via WhatsApp
app.post('/api/processos/notificar-whatsapp', async (req, res) => {
    try {
        const { telefone, cliente, numeroProcesso, mensagem } = req.body;
        if (!telefone || !mensagem) return res.status(400).json({ error: 'Dados em falta.' });

        const mensagemTexto = `Olá, ${cliente}! Segue a atualização do seu processo nº ${numeroProcesso}:\n\n"${mensagem}"\n\nQualquer dúvida, estamos à disposição!`;

        if (WHATSAPP_API_URL && WHATSAPP_API_TOKEN) {
            const apiRes = await fetch(WHATSAPP_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': WHATSAPP_API_TOKEN },
                body: JSON.stringify({ number: telefone, text: mensagemTexto })
            });
            if (!apiRes.ok) throw new Error('Erro na API de WhatsApp');
            return res.status(200).json({ status: 'sucesso', modo: 'API_AUTOMATICO' });
        }

        const linkWhats = `https://api.whatsapp.com/send?phone=${telefone}&text=${encodeURIComponent(mensagemTexto)}`;
        return res.status(200).json({ status: 'sucesso', modo: 'DEEP_LINK', link: linkWhats });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 5. Tradução IA
app.post('/api/processos/traduzir-ia', async (req, res) => {
    try {
        const { textoTecnico } = req.body;
        if (!textoTecnico) return res.status(400).json({ error: 'Texto obrigatório.' });

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

// 6. Consulta DataJud
app.post('/api/processos/consultar-cnj', async (req, res) => {
    try {
        const { numeroProcesso } = req.body;
        if (!numeroProcesso) return res.status(400).json({ error: 'Número obrigatório.' });

        const numeroLimpo = numeroProcesso.replace(/[-.]/g, '');
        const cnjResponse = await fetch('https://api-publica.datajud.cnj.jus.br/api_v1_processo/_search', {
            method: 'POST',
            headers: { 'Authorization': DATAJUD_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: { match: { "numeroProcesso": numeroLimpo } } })
        });

        if (!cnjResponse.ok) throw new Error('Erro na API DataJud');
        const cnjData = await cnjResponse.json();
        const hits = cnjData.hits?.hits || [];

        if (hits.length === 0) return res.status(404).json({ mensagem: 'Nenhum andamento encontrado.' });

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

// 7. Salvar Processos Isolados por Tenant
app.post('/api/processos', async (req, res) => {
    try {
        const { id, numero, cliente, whatsapp, urgencia, status, historico, tenantId } = req.body;
        if (!tenantId) return res.status(400).json({ error: 'Tenant ID obrigatório.' });

        const { error } = await supabase
            .from('processos')
            .upsert([{
                id: id || Date.now().toString(),
                numero,
                cliente,
                whatsapp,
                urgencia: urgencia || 'Médio',
                status: status || 'Em Andamento',
                historico,
                tenant_id: tenantId,
                created_at: new Date().toISOString()
            }]);

        if (error) throw error;
        return res.status(200).json({ status: 'sucesso' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 8. Listar Processos estritamente do Escritório Logado
app.get('/api/processos', async (req, res) => {
    try {
        const tenantId = req.query.tenantId;
        if (!tenantId) return res.status(400).json({ error: 'Tenant ID em falta.' });

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
app.listen(PORT, () => console.log(`JurisSync AI SaaS v5.2 na porta ${PORT}`));
