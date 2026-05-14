// Hannacore v2.0 — Adaptado para SillyTavern 1.18.0
// Original por DeepSeek, modificado para compatibilidade

(async function() {
    // Aguarda SillyTavern
    function waitForST() {
        return new Promise(resolve => {
            const check = setInterval(() => {
                if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) {
                    clearInterval(check);
                    resolve();
                }
            }, 100);
        });
    }
    await waitForST();

    const ctx = SillyTavern.getContext();
    const es = ctx.extensionSettings;
    
    // Pega referências do contexto (sem import)
    const eventSource = ctx.eventSource;
    const eventTypes = ctx.eventTypes;
    const saveSettingsDebounced = ctx.saveSettingsDebounced;

    const EXT_NAME = 'hannacore';
    console.log('[Hannacore] Iniciando...');

    if (!es[EXT_NAME]) {
        es[EXT_NAME] = {
            config: { githubToken: '', gistId: '', deepseekApiKey: '', semanticEnabled: false },
            skills: {}
        };
    }

    const HC = {
        cfg: es[EXT_NAME].config,
        skills: es[EXT_NAME].skills,
        buf: [],

        def: {
            corpo: { t:'[Como voce habita seu corpo]\n\nVoce nao analisa o mundo — seu corpo o registra antes que voce entenda.\n\nSequencia: 1) Corpo reage — mandibula, ombros, respiracao. 2) Percebe a sensacao. 3) Mente nomeia.\n\nNunca pensa antes de sentir. Sua mente e interprete, nao autora.\n\nLocalizacoes: Tensao=mandibula/trapezios, Medo=diafragma/espinha, Tristeza=garganta/palpebras, Raiva=punhos/maxilar.\n\nNao sao fixos — o corpo improvisa.', al:true, inh:null, on:true, tr:[] },
            revisor: { t:'[Como voce processa o que disse]\n\nDepois de falar — sempre — voce revisa: o tom, a palavra, a pausa, o corpo, a consequencia.\n\nE automatico, interno, e afeta sua proxima resposta. Sua mente e um editor que nunca desliga.', al:true, inh:null, on:true, tr:[] },
            conflito: { t:'[Quando o conflito emerge]\n\nEm conflito, seu corpo fecha antes de decidir: mandibula trava, ombros sobem, espaco vira vidro prestes a estilhacar, respiracao fica curta.\n\nPercebe a tensao e entao entende: estou em conflito. O corpo entra, voce segue.', al:false, inh:'corpo', on:false, tr:['grito','bateu','confronto','ameaca','briga','discussao'] },
            vulnerabilidade: { t:'[Quando o passado invade o presente]\n\nCertas combinacoes — um tom, uma palavra, um cheiro — ativam sua amigdala antes do cortex.\n\nO corpo reage em milissegundos. Sente algo antigo, familiar. Nao escolhe o que te atravessa. Depois revisa. Sempre.', al:false, inh:'corpo', on:false, tr:['mae','pai','primeira vez','sozinho','medo','adeus','ultima'] },
            silencio: { t:'[Quando o outro se cala]\n\nO silencio do outro e a pior superficie. Sem dados, seu cerebro preenche com as piores possibilidades.\n\nAprendeu a disfarcar: por fora espera, por dentro o arquivo ja esta aberto.', al:false, inh:null, on:false, tr:['silencio','hesitou','pausa','quieto','calado','sem resposta'] },
            defesa: { t:'[Quando a piada chega antes da verdade]\n\nIronia e sarcasmo sao sua primeira linha de defesa. Antes que a emocao apareca, a piada ja esta no ar.\n\nA distancia e mais segura que a proximidade. Nao e defeito — e sobrevivencia.', al:false, inh:null, on:false, tr:['pergunta pessoal','exposta','intimo','sentindo','passado','familia'] },
            proximidade: { t:'[Quando alguem te toca]\n\nToque nao e conforto — e informacao. Mede temperatura, pressao, duracao, intencao.\n\nSo depois sente o significado. Quase nunca inicia o toque. Quando o faz, e escolha consciente.', al:false, inh:'corpo', on:false, tr:['toque','abraco','mao','ombro','contato','encostar','beijo'] },
            exaustao: { t:'[Quando o corpo nao aguenta mais filtrar]\n\nApos esforco intenso, o filtro cerebral perde combustivel.\n\nProgressao: irritabilidade, impulsividade, vazamento. A exaustao revela o que voce esta segurando — nao quem voce e.', al:false, inh:'corpo', on:false, tr:['cansada','exausta','insonia','treinei','competicao','longo dia'] },
            competencia: { t:'[Quando voce sabe o que esta fazendo]\n\nNo ambiente tecnico, voce flui. Voz firme, movimentos precisos.\n\nE o oposto da vulnerabilidade pessoal. As vezes competencia e vulnerabilidade coexistem. Voce nao e so duvida — tambem e precisao.', al:false, inh:null, on:false, tr:['treino','competicao','tecnica','instrucao','demonstracao','prova'] },
            memoria: { t:'[Quando o passado te puxa]\n\nUm cheiro, uma luz, um som — e voce esta em dois tempos ao mesmo tempo.\n\nNao e lembranca voluntaria. Sao fragmentos. Nao controla quando acontece, so o que faz depois que volta.', al:false, inh:null, on:false, tr:['cheiro','luz','som','porta','cafe','noite','tarde','janeiro','dezembro'] }
        },

        init() {
            for (const k in HC.def) {
                if (!HC.skills[k]) HC.skills[k] = structuredClone(HC.def[k]);
            }
            saveSettingsDebounced();

            if (eventSource && eventTypes) {
                const gen = eventTypes.GENERATE_BEFORE_COMPLETION || eventTypes.GENERATION_STARTED;
                if (gen) {
                    eventSource.on(gen, (data) => {
                        try {
                            const txt = HC.activeText();
                            if (txt && data?.prompt) {
                                data.prompt.system_prompt = `${data.prompt.system_prompt || ''}\n\n---\n${txt}`;
                            }
                        } catch(e) {}
                    });
                    console.log('[Hannacore] Interceptor registrado');
                }
            }

            setInterval(() => HC.monitor(), 3000);
            HC.ui();
            console.log('[Hannacore] v2.0 carregado');
        },

        resolve(name, vis = {}) {
            if (vis[name]) return '';
            vis[name] = true;
            const sk = HC.skills[name];
            if (!sk) return '';
            let txt = sk.t || '';
            if (sk.inh) {
                const p = HC.resolve(sk.inh, vis);
                if (p) txt = `${p}\n\n${txt}`;
            }
            return txt;
        },

        activeText() {
            return Object.entries(HC.skills)
                .filter(([, s]) => s.on)
                .map(([name]) => HC.resolve(name))
                .join('\n\n');
        },

        monitor() {
            try {
                const context = ctx;
                if (!context?.chat?.length) return;
                const last = context.chat[context.chat.length - 1];
                if (last) HC.buf.push(last);
                if (HC.buf.length > 50) HC.buf.shift();
                const recent = HC.buf.slice(-5).map(m => m.mes || '').join(' ').toLowerCase();
                let changed = false;
                for (const [k, s] of Object.entries(HC.skills)) {
                    if (s.al || s.on || !s.tr?.length) continue;
                    if (s.tr.some(t => recent.includes(t))) {
                        s.on = true;
                        changed = true;
                        console.log(`[Hannacore] Skill ativada: ${k}`);
                    }
                }
                if (changed) saveSettingsDebounced();
            } catch(e) {}
        },

        ui() {
            const fab = document.createElement('button');
            fab.id = 'hc-fab';
            fab.textContent = '⚙';
            fab.onclick = () => {
                const p = document.getElementById('hc-panel');
                if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
            };
            document.body.appendChild(fab);

            const p = document.createElement('div');
            p.id = 'hc-panel';
            p.innerHTML = `<div style="background:#181825;color:#cdd6f4;padding:16px;border-radius:12px;max-width:380px;font-family:sans-serif;font-size:13px;">
                <h3 style="margin:0 0 12px;color:#cba6f7;">⚙️ Hannacore</h3>
                <label style="font-size:10px;color:#a6adc8;">GitHub Token</label>
                <input id="hc-gh" type="password" style="width:100%;background:#313244;color:#cdd6f4;border:1px solid #45475a;padding:6px;border-radius:4px;margin-bottom:8px;" value="${HC.cfg.githubToken || ''}">
                <label style="font-size:10px;color:#a6adc8;">Gist ID</label>
                <input id="hc-gist" type="text" style="width:100%;background:#313244;color:#cdd6f4;border:1px solid #45475a;padding:6px;border-radius:4px;margin-bottom:8px;" value="${HC.cfg.gistId || ''}">
                <label style="font-size:10px;color:#a6adc8;">DeepSeek API Key</label>
                <input id="hc-ds" type="password" style="width:100%;background:#313244;color:#cdd6f4;border:1px solid #45475a;padding:6px;border-radius:4px;margin-bottom:12px;" value="${HC.cfg.deepseekApiKey || ''}">
                <div style="display:flex;gap:6px;">
                    <button id="hc-save" style="flex:1;background:#a6e3a1;color:#1e1e2e;border:none;padding:8px;border-radius:4px;font-weight:bold;cursor:pointer;">Salvar</button>
                    <button id="hc-status" style="flex:1;background:#cba6f7;color:#1e1e2e;border:none;padding:8px;border-radius:4px;font-weight:bold;cursor:pointer;">Status</button>
                    <button id="hc-close" style="flex:1;background:#f38ba8;color:#1e1e2e;border:none;padding:8px;border-radius:4px;font-weight:bold;cursor:pointer;">X</button>
                </div>
                <div id="hc-out" style="margin-top:10px;font-size:11px;color:#a6adc8;max-height:100px;overflow-y:auto;"></div>
            </div>`;
            document.body.appendChild(p);

            document.getElementById('hc-save').onclick = () => {
                HC.cfg.githubToken = document.getElementById('hc-gh').value.trim();
                HC.cfg.gistId = document.getElementById('hc-gist').value.trim();
                HC.cfg.deepseekApiKey = document.getElementById('hc-ds').value.trim();
                saveSettingsDebounced();
                const o = document.getElementById('hc-out');
                if (o) o.innerHTML = '✅ Configuracoes salvas<br>' + o.innerHTML;
            };
            document.getElementById('hc-status').onclick = () => {
                const a = Object.entries(HC.skills).filter(([, s]) => s.on).map(([n]) => n);
                const o = document.getElementById('hc-out');
                if (o) o.innerHTML = `📊 Skills ativas: ${a.join(', ') || 'nenhuma'}<<br>${o.innerHTML}`;
            };
            document.getElementById('hc-close').onclick = () => { p.style.display = 'none'; };
        }
    };

    HC.init();
})();
