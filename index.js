// ============================================
// HANNACORE v0.1.0
// Núcleo de memória para Hanna
// Resumos salvos no IndexedDB
// ============================================

import { getContext, saveMetadataDebounced } from '../../../../public/scripts/extensions.js';
import { eventSource, event_types, setExtensionPrompt } from '../../../../public/scripts/script.js';

const LS = 'hannacore-settings';
let saved = {};
try {
    const raw = localStorage.getItem(LS);
    if (raw) saved = JSON.parse(raw);
} catch(e) { console.warn('[HannaCore] Config corrompida'); localStorage.removeItem(LS); }

let apiKey         = saved.apiKey         || '';
let menteModel     = saved.menteModel     || 'deepseek-v3.2';
let menteInterval  = saved.menteInterval  || 50;
let menteAtiva     = saved.menteAtiva !== undefined ? saved.menteAtiva : true;
let mentePrompt    = saved.mentePrompt    || defaultPrompt();
let injetarNoRP    = saved.injetarNoRP !== undefined ? saved.injetarNoRP : false;

let ultimoProcessamento = 0;
let running = false;

function defaultPrompt() {
    return `Você é um analista de narrativa. Leia o bloco de mensagens deste roleplay entre Hanna (coordenadora, 32 anos, controladora, observadora, mãe ensinou que vulnerabilidade é brecha) e Senna (estagiário, 18 anos).

Produza um resumo denso em português com:
1. ARCO PRINCIPAL: O que aconteceu de mais importante neste bloco? Qual foi a evolução emocional ou de poder entre os dois?
2. MOMENTOS-CHAVE: 2-3 momentos específicos que definiram este bloco (eventos, diálogos, silêncios)
3. ESTADO DA HANNA: Como ela está no final deste bloco? Mais aberta ou mais fechada? Mais no controle ou mais vulnerável?
4. PADRÕES: Algum padrão novo detectado no comportamento do Senna ou no dela mesma?
5. SINAL SOMÁTICO: Alguma reação corporal significativa da Hanna (contração, expansão, ausência)?

Formato: texto corrido, 3-5 parágrafos. Sem markdown, sem títulos.`;
}

// ==================== EXTRATOR DE RESUMO ====================

function construirPrompt(ctx) {
    const total = ctx.chat.length;
    const inicio = Math.max(0, total - menteInterval);
    const msgs = ctx.chat.slice(inicio, total).filter(m => m.mes?.trim());
    const cena = msgs.map(m => {
        const nome = m.is_user ? 'Senna' : (m.name || 'Hanna');
        return `${nome}: ${m.mes.replace(/<[^>]+>/g, '').trim()}`;
    }).join('\n');
    return `${mentePrompt}\n\nÚLTIMAS ${msgs.length} MENSAGENS:\n${cena}`;
}

async function extrairResumo(ctx) {
    if (!apiKey) { $('#mv_status').text('✕ sem API Key'); return null; }
    const prompt = construirPrompt(ctx);
    try {
        const res = await fetch('https://nano-gpt.com/api/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model: menteModel, messages: [{ role: 'user', content: prompt }], max_tokens: 800, temperature: 0.4 })
        });
        if (!res.ok) { $('#mv_status').text(`✕ HTTP ${res.status}`); return null; }
        const data = await res.json();
        const text = (data.choices?.[0]?.message?.content || data.choices?.[0]?.message?.reasoning_content || '').trim();
        if (!text) { $('#mv_status').text('✕ API retornou vazio'); return null; }
        return text;
    } catch(e) { $('#mv_status').text(`✕ ${e.message.substring(0,40)}`); return null; }
}

// ==================== INDEXEDDB ====================

function abrirDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('HannaCoreDB', 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('resumos')) {
                db.createObjectStore('resumos', { keyPath: 'bloco' });
            }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

async function salvarResumo(bloco, texto) {
    const db = await abrirDB();
    const tx = db.transaction('resumos', 'readwrite');
    tx.objectStore('resumos').put({ bloco, texto, data: new Date().toISOString() });
    return new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = reject;
    });
}

async function carregarResumos() {
    const db = await abrirDB();
    const tx = db.transaction('resumos', 'readonly');
    const store = tx.objectStore('resumos');
    const req = store.getAll();
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result.sort((a, b) => a.bloco - b.bloco));
        req.onerror = reject;
    });
}

// ==================== INJEÇÃO NO RP ====================

function extrairEstado(texto) {
    const estado = { vulnerabilidade: 0, testeLimite: false, contencao: 0 };
    if (/vulner[áa]vel|expost[ao]|abriu|confess|admitiu/i.test(texto)) estado.vulnerabilidade = 7;
    if (/desafi|insubordin|testou|provoc/i.test(texto)) estado.testeLimite = true;
    if (/cont[ée]m|recuou|fechou|sil[êe]ncio|controle/i.test(texto)) estado.contencao = 1;
    if (/mais aberta|cedeu|relaxou|expans|sorriu/i.test(texto)) estado.contencao = 0;
    return estado;
}

async function injetarEstado() {
    if (!injetarNoRP) { setExtensionPrompt('HANNACORE_ESTADO', '', 1, 1); return; }
    const resumos = await carregarResumos();
    if (resumos.length === 0) { setExtensionPrompt('HANNACORE_ESTADO', '', 1, 1); return; }

    const textoCompleto = resumos.slice(-10).map(r => `[Bloco ${r.bloco}]: ${r.texto}`).join('\n\n');
    const estadoGeral = extrairEstado(textoCompleto);

    let instrucao = '';
    if (estadoGeral.vulnerabilidade >= 7) instrucao += 'histórico de vulnerabilidade — instinto de proteção ativo. ';
    if (estadoGeral.testeLimite) instrucao += 'padrão de teste de limites recorrente no histórico. ';
    if (estadoGeral.contencao >= 1) instrucao += 'tendência geral a contenção e silêncio. ';

    if (instrucao) {
        setExtensionPrompt('HANNACORE_ESTADO', `[Memória acumulada: ${instrucao.trim()}]`, 1, 1);
    } else {
        setExtensionPrompt('HANNACORE_ESTADO', '', 1, 1);
    }
}

// ==================== PROCESSAMENTO ====================

async function processarBloco() {
    if (!menteAtiva || !apiKey || running) return;
    running = true;
    try {
        const ctx = getContext();
        if (!ctx.chat?.length) { $('#mv_status').text('— chat vazio'); return; }
        const blocoAtual = Math.floor(ctx.chat.length / menteInterval);
        $('#mv_status').text(`⟳ resumindo bloco ${blocoAtual}...`);
        const resumo = await extrairResumo(ctx);
        if (!resumo) {
            if ($('#mv_status').text().includes('resumindo')) $('#mv_status').text('— nada relevante');
            return;
        }
        await salvarResumo(blocoAtual, resumo);
        $('#mv_status').text(`✓ bloco ${blocoAtual} salvo`);
        await injetarEstado();
        carregarListaNaUI();
    } catch(e) { $('#mv_status').text(`✕ ${e.message.substring(0,50)}`); }
    finally { running = false; }
}

// ==================== UI ====================

async function carregarListaNaUI() {
    try {
        const resumos = await carregarResumos();
        const lista = resumos.slice(-5).reverse().map(r => {
            const data = new Date(r.data);
            const hora = `${String(data.getHours()).padStart(2,'0')}:${String(data.getMinutes()).padStart(2,'0')}`;
            return `<div style="font-size:0.78em;color:#888;margin:2px 0;padding:3px 0;border-bottom:1px solid #222">
              📝 <b>Bloco ${r.bloco}</b> · ${hora}<br>
              ${r.texto?.substring(0, 100)}${(r.texto?.length > 100) ? '...' : ''}
            </div>`;
        }).join('');
        $('#mv_lista').html(lista || '<div style="color:#555;font-size:0.78em">nenhum resumo ainda</div>');
        $('#mv_contador').text(resumos.length);
    } catch(e) {
        $('#mv_lista').html('<div style="color:#a55;font-size:0.78em">erro ao carregar</div>');
    }
}

function injectUI() {
    const $t = $('#extensions_settings2').length ? $('#extensions_settings2') : $('#extensions_settings');
    if (!$t.length) { setTimeout(injectUI, 1000); return; }
    const html = `<div class="inline-drawer"><div class="inline-drawer-toggle inline-drawer-header"><b>🧠 HannaCore</b> <span style="font-size:0.7em;color:#555">v0.1.0</span><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div><div class="inline-drawer-content" style="display:flex;flex-direction:column;gap:8px;padding:8px 0"><div style="display:flex;gap:12px;align-items:center"><span style="font-size:2em;font-weight:bold;color:#8b7355" id="mv_contador">0</span><span style="font-size:0.8em;color:#666">blocos</span></div><input id="mv_api_key" type="password" class="text_pole" placeholder="API Key NanoGPT"><input id="mv_interval" type="number" class="text_pole" value="50" min="10" max="200" placeholder="Mensagens por bloco"><label style="display:flex;align-items:center;gap:8px;font-size:0.85em;color:#aaa"><input type="checkbox" id="mv_ativa" checked> Módulo ativo</label><label style="display:flex;align-items:center;gap:8px;font-size:0.85em;color:#e8a0a0"><input type="checkbox" id="mv_injetar_rp"> Injetar estado no RP</label><div style="display:flex;gap:6px;flex-wrap:wrap"><input id="mv_save" type="button" class="menu_button" value="💾 Salvar"><input id="mv_now" type="button" class="menu_button" value="↺ Resumir agora"></div><div id="mv_status" style="font-size:0.82em;color:#aaa">pronto</div><div style="font-size:0.75em;text-transform:uppercase;color:#666;letter-spacing:1px;margin-top:4px">Últimos resumos</div><div id="mv_lista" style="max-height:200px;overflow-y:auto"><div style="color:#555;font-size:0.78em">nenhum resumo ainda</div></div></div></div>`;
    $t.append(html);

    $('#mv_save').on('click', () => {
        apiKey = $('#mv_api_key').val().trim();
        menteInterval = parseInt($('#mv_interval').val()) || 50;
        menteAtiva = $('#mv_ativa').prop('checked');
        injetarNoRP = $('#mv_injetar_rp').prop('checked');
        localStorage.setItem(LS, JSON.stringify({ apiKey, menteModel, menteInterval, menteAtiva, mentePrompt, injetarNoRP }));
        $('#mv_status').text('✓ salvo');
        carregarListaNaUI();
    });

    $('#mv_now').on('click', () => {
        ultimoProcessamento = Math.max(0, (getContext().chat?.length || 0) - menteInterval);
        processarBloco();
    });

    $('#mv_injetar_rp').on('change', async () => {
        injetarNoRP = $('#mv_injetar_rp').prop('checked');
        const config = JSON.parse(localStorage.getItem(LS) || '{}');
        config.injetarNoRP = injetarNoRP;
        localStorage.setItem(LS, JSON.stringify(config));
        if (!injetarNoRP) {
            setExtensionPrompt('HANNACORE_ESTADO', '', 1, 1);
            $('#mv_status').text('⚠ injeção DESLIGADA');
        } else {
            await injetarEstado();
            carregarListaNaUI();
            $('#mv_status').text('⚠ injeção LIGADA');
        }
    });
}

// ==================== INICIALIZAÇÃO ====================
function syncUltimoProcessamento() { ultimoProcessamento = getContext().chat?.length || 0; }
eventSource.on(event_types.APP_READY, () => { syncUltimoProcessamento(); carregarListaNaUI(); });
eventSource.on(event_types.CHAT_CHANGED, () => { syncUltimoProcessamento(); carregarListaNaUI(); });
eventSource.on(event_types.MESSAGE_RECEIVED, () => {
    const total = getContext().chat?.length || 0;
    if (total - ultimoProcessamento >= menteInterval) { ultimoProcessamento = total; processarBloco(); }
});
setTimeout(injectUI, 3000);
console.log('[HannaCore] Módulo carregado — v0.1.0');
