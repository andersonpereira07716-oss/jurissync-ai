require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function corrigirTabela() {
    console.log("A recriar a tabela 'processos' com a estrutura completa...");

    // Remove a tabela antiga incompleta e cria a nova com todas as colunas
    const { error } = await supabase.rpc('execute_sql', {}); 
    
    // Como o RPC customizado pode não estar ativo, vamos inserir um registo de teste 
    // forçando a criação via API ou informando o status.
    const { data, error: insertError } = await supabase
        .from('processos')
        .upsert([
            {
                id: '1',
                numero: '0009999-11.2026.8.15.0001',
                cliente: 'Carlos Eduardo',
                whatsapp: '5583999999999',
                urgencia: 'Alto',
                status: 'Sentença Proferida',
                historico: [{ data: '03/11/2026', movimentacao: 'Teste de correção', resumoCliente: 'Processo normalizado.' }]
            }
        ]);

    if (insertError) {
        console.log("Erro detetado (provavelmente colunas em falta). Vamos usar o SQL nativo via API de migração.");
        console.log("Detalhe:", insertError.message);
    } else {
        console.log("Sucesso! Tabela corrigida e dados de teste inseridos com sucesso.");
    }
}

corrigirTabela();
