require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Middleware para verificar a sessão (JWT Token) do Supabase Auth
async function verificarSessao(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Acesso negado. Token de autenticação não fornecido.' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        return res.status(403).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
    }

    req.user = user;
    next();
}

// Rota protegida para salvar ou atualizar processos
app.post('/api/processos', verificarSessao, async (req, res) => {
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
                    urgencia,
                    status,
                    historico,
                    created_at: new Date().toISOString()
                }
            ]);

        if (error) throw error;

        return res.status(200).json({ status: 'sucesso', mensagem: 'Processo atualizado com sucesso!', data });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Rota protegida para listar os processos
app.get('/api/processos', verificarSessao, async (req, res) => {
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
app.listen(PORT, () => console.log(`JurisSync AI Backend a rodar na porta ${PORT}`));
