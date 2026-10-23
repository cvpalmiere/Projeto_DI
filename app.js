// Envolve tudo em uma função anônima em modo estrito para não vazar variáveis globais nem aceitar erros silenciosos (H5 prevenção de erros).
(() => {
  'use strict';

  // ---------- Utilitários ----------

  // Cria atalhos para buscar um ou vários elementos, evitando repetir document.querySelector e deixando o código curto e legível.
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  // Monta elementos pelo DOM com textContent em vez de innerHTML para textos do usuário nunca virarem HTML, evitando injeção de código (H5).
  function h(tag, props = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else if (v !== false && v != null) el.setAttribute(k, v);
    }
    el.append(...kids.flat().filter(kid => kid != null && kid !== false));
    return el;
  }

  // Cria um ícone SVG que referencia o sprite do HTML, mantendo todos os ícones vetoriais e sem emojis (H4 consistência).
  function icon(name) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(NS, 'use');
    use.setAttribute('href', '#i-' + name);
    svg.append(use);
    return svg;
  }

  // Remove acentos e maiúsculas para a busca achar "calculo" ao digitar "Cálculo", tolerando a forma como cada pessoa escreve (H7 flexibilidade).
  const norm = s => String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

  // Escolhe singular ou plural conforme o número para as mensagens soarem naturais, como uma pessoa falaria (H2 mundo real).
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

  // Limita um número a um intervalo, usado em posições, tamanhos e cores para nada sair dos limites permitidos (H5).
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // Gera ids curtos e quase únicos combinando hora e aleatório, suficientes para identificar matérias, cadernos, páginas e objetos localmente.
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // ---------- Armazenamento ----------

  // Lê e grava JSON no localStorage dentro de try/catch e informa se gravou, para o app avisar quando o armazenamento estiver cheio (H5, H9).
  const store = {
    get(key, fallback) {
      try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; }
      catch { return false; }
    }
  };

  // Guarda em memória as matérias e cadernos do usuário logado, carregados do armazenamento a cada entrada na área protegida.
  let data = { materias: [] };

  // ---------- Feedback ao usuário ----------

  // Mostra uma mensagem na região aria-live, com botão opcional de ação, e a esconde sozinha para confirmar ações sem bloquear a tela (H1, H3).
  let toastTimer;
  function toast(message, action) {
    const el = $('#toast');
    el.textContent = message;
    if (action) {
      const btn = h('button', { type: 'button', class: 'toast-action' }, action.label);
      btn.addEventListener('click', () => { action.onClick(); el.classList.remove('show'); });
      el.append(btn);
    }
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), action ? 7000 : 3500);
  }

  // Liga ou desliga o estado ocupado do botão trocando o texto e o aria-busy para evitar duplo envio e avisar que algo está em andamento (H1, H5).
  function setBusy(button, busy, busyLabel) {
    button.setAttribute('aria-busy', String(busy));
    button.disabled = busy;
    button.textContent = busy ? busyLabel : button.dataset.label;
  }

  // ---------- Motor de temas (claro/escuro) ----------

  // Sincroniza o aria-pressed de todos os botões de tema com o estado real, para leitores de tela e visual dizerem a mesma coisa (H1).
  const root = document.documentElement;
  function syncThemeButtons() {
    const dark = root.classList.contains('dark');
    $$('.js-theme').forEach(btn => btn.setAttribute('aria-pressed', String(dark)));
  }

  // Alterna a classe dark no html, salva a escolha e avisa por toast, para o tema valer nas próximas visitas e o usuário ver o resultado (H1, H3).
  function toggleTheme() {
    const dark = root.classList.toggle('dark');
    store.set('mochila_theme', dark ? 'dark' : 'light');
    syncThemeButtons();
    toast(dark ? 'Tema escuro ativado.' : 'Tema claro ativado.');
  }
  $$('.js-theme').forEach(btn => btn.addEventListener('click', toggleTheme));
  syncThemeButtons();

  // ---------- Criptografia da senha ----------

  // Converte bytes em texto hexadecimal para poder guardar o hash e o salt como string no localStorage.
  const toHex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

  // Gera um salt aleatório de 16 bytes para duas pessoas com a mesma senha não terem o mesmo hash, dificultando ataques por tabela.
  const makeSalt = () => toHex(crypto.getRandomValues(new Uint8Array(16)));

  // Calcula SHA-256 de salt + senha pela API nativa do navegador para nunca guardar a senha em texto puro (requisito de senha criptografada).
  async function hashPassword(password, salt) {
    const bytes = new TextEncoder().encode(salt + password);
    return toHex(await crypto.subtle.digest('SHA-256', bytes));
  }

  // ---------- Cores: conversões HSV, RGB e hexadecimal ----------

  // Converte matiz, saturação e valor em RGB de 0 a 255 para desenhar a roda e mostrar os números que o usuário entende (H2).
  function hsvToRgb(hue, s, v) {
    const f = n => { const k = (n + hue / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
    return [f(5), f(3), f(1)].map(x => Math.round(x * 255));
  }

  // Converte RGB em HSV mantendo o matiz anterior quando a cor é cinza ou preta, para o marcador não pular de lugar sem motivo (H1).
  function rgbToHsv(r, g, b, prevHue = 0) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let hue = prevHue;
    if (d) {
      if (max === r) hue = ((g - b) / d) % 6;
      else if (max === g) hue = (b - r) / d + 2;
      else hue = (r - g) / d + 4;
      hue *= 60;
      if (hue < 0) hue += 360;
    }
    return { h: hue, s: max ? d / max : 0, v: max };
  }

  // Formata RGB como #RRGGBB em maiúsculas, o padrão que o usuário vê em editores e que cabe no campo hexadecimal (H4 consistência).
  const toHexColor = (r, g, b) => '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();

  // Lê um hexadecimal de 6 dígitos, com ou sem #, e devolve [r, g, b] ou null, tolerando as duas formas de digitar (H7 flexibilidade).
  function parseHex(str) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(str).trim());
    return m ? [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)) : null;
  }

  // Escolhe tinta escura ou branca conforme a luminosidade da cor para o texto sobre ela sempre ter contraste legível (H6, acessibilidade).
  function inkFor(hex) {
    const [r, g, b] = parseHex(hex) || [0, 0, 0];
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#2A1D12' : '#FFFFFF';
  }

  // Mistura duas cores na proporção t, usada para gerar tons das abas a partir da cor da capa e manter a família visual (H4 consistência).
  function mixHex(hexA, hexB, t) {
    const a = parseHex(hexA) || [0, 0, 0], b = parseHex(hexB) || [255, 255, 255];
    return toHexColor(...a.map((x, i) => Math.round(x + (b[i] - x) * t)));
  }

  // ---------- Validação de campos ----------

  // Testa o formato do e-mail com uma expressão simples para barrar erros comuns de digitação antes de enviar (H5 prevenção de erros).
  const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  // Reúne as regras por nome, cada uma devolvendo true ou o texto que explica o erro e como corrigir, mantendo a lógica em um só lugar (H9).
  const RULES = {
    usuario: v => v.trim().length >= 3 || 'Digite um nome de usuário com pelo menos 3 caracteres.',
    email: v => emailOk(v.trim()) || 'Digite um e-mail válido, como nome@exemplo.com.',
    senha: v => v.length >= 8 || 'Use pelo menos 8 caracteres na senha.',
    confirma: (v, form) => v === form.elements.senha.value || 'As senhas precisam ser iguais. Digite a mesma senha nos dois campos.',
    obrigatoria: v => v.length > 0 || 'Digite sua senha para entrar.',
    nomeMateria: (v, form) => {
      const n = v.trim();
      if (n.length < 2) return 'Digite um nome com pelo menos 2 caracteres, como Cálculo.';
      const dup = data.materias.some(m => m.id !== form.dataset.editId && norm(m.nome) === norm(n));
      return !dup || 'Você já tem uma matéria com esse nome. Use outro nome ou abra a que já existe.';
    },
    tituloCaderno: (v, form) => {
      const t = v.trim();
      if (t.length < 2) return 'Digite um título com pelo menos 2 caracteres, como Lista de exercícios.';
      const m = data.materias.find(x => x.id === form.elements.materia.value);
      const dup = m && m.cadernos.some(c => c.id !== form.dataset.editId && norm(c.titulo) === norm(t));
      return !dup || 'Já existe um caderno com esse título nessa matéria. Use outro título.';
    },
    escolha: v => v !== '' || 'Escolha uma matéria para guardar o caderno.',
    hex: v => parseHex(v) !== null || 'Digite a cor com 6 dígitos hexadecimais, como #D95122.',
    pdfDe: (v, form) => {
      if (form.elements.escopo.value !== 'intervalo') return true;
      const n = ed ? ed.c.paginas.length : 1, x = Number(v);
      return (Number.isInteger(x) && x >= 1 && x <= n) || 'Digite a página inicial, um número de 1 a ' + n + '.';
    },
    pdfAte: (v, form) => {
      if (form.elements.escopo.value !== 'intervalo') return true;
      const n = ed ? ed.c.paginas.length : 1, x = Number(v), de = Number(form.elements.de.value);
      if (!(Number.isInteger(x) && x >= 1 && x <= n)) return 'Digite a página final, um número de 1 a ' + n + '.';
      return !(Number.isInteger(de) && x < de) || 'A página final não pode vir antes da inicial (' + de + ').';
    }
  };

  // Escreve ou limpa a mensagem de erro de um campo e marca aria-invalid para o problema ficar visível na borda e audível no leitor de tela (H9).
  function setFieldError(input, message) {
    input.setAttribute('aria-invalid', String(Boolean(message)));
    const out = document.getElementById(input.id + '-erro');
    if (out) out.textContent = message || '';
  }

  // Valida um campo pela regra declarada em data-rule e devolve se está correto, para reaproveitar na digitação, no blur e no envio (H5, H9).
  function checkField(input) {
    const result = RULES[input.dataset.rule](input.value, input.form);
    setFieldError(input, result === true ? '' : result);
    return result === true;
  }

  // Valida todos os campos do formulário e leva o foco ao primeiro inválido, poupando o usuário de procurar o erro na tela (H9, H7).
  function validateForm(form) {
    const inputs = $$('[data-rule]', form);
    const results = inputs.map(checkField);
    const firstBad = inputs[results.indexOf(false)];
    if (firstBad) firstBad.focus();
    return !firstBad;
  }

  // Confere o campo ao sair dele se tiver texto, e recorrige em tempo real quem já estava com erro, dando retorno imediato sem ser invasivo (H1, H5).
  $$('form').forEach(form => {
    form.addEventListener('focusout', e => {
      if (e.target.dataset.rule && e.target.value) checkField(e.target);
    });
    form.addEventListener('input', e => {
      const input = e.target;
      if (input.getAttribute('aria-invalid') === 'true') checkField(input);
      const confirm = form.elements.confirma;
      if (input.name === 'senha' && confirm && confirm.value) checkField(confirm);
    });
  });

  // Mostra uma mensagem geral do formulário, com link opcional de saída, para o usuário saber o que fazer em seguida (H9 recuperação de erros).
  function setFormMessage(text, linkText, linkHref) {
    const box = $('#auth-msg');
    box.textContent = text || '';
    if (linkText) box.append(h('a', { href: linkHref, class: 'underline' }, ' ' + linkText));
  }

  // Alterna o texto do botão de olho entre mostrar e ocultar a senha, dando ao usuário o controle de conferir o que digitou (H3, H5).
  $$('.pass-toggle').forEach(btn => btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.pass);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.setAttribute('aria-pressed', String(show));
    btn.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
  }));

  // ---------- Autenticação local (sem backend) ----------

  // Define as chaves de armazenamento num só lugar para evitar erros de digitação ao ler e gravar contas e sessão (H5).
  const USERS_KEY = 'mochila_users';
  const SESSION_KEY = 'mochila_session';
  const getSession = () => store.get(SESSION_KEY, null);

  // Grava só os dados públicos do usuário na sessão para a área logada saber quem entrou sem expor o hash da senha.
  function startSession(user) {
    store.set(SESSION_KEY, { id: user.id, username: user.username, email: user.email });
  }

  // Cadastra a conta após validar, checar e-mail repetido e gerar hash com salt, sempre mostrando carregamento e orientando em caso de erro (H1, H5, H9).
  async function handleRegister(e) {
    e.preventDefault();
    const form = e.target;
    const button = $('button[type="submit"]', form);
    setFormMessage('');
    if (!validateForm(form)) return;

    const users = store.get(USERS_KEY, []);
    const email = form.elements.email.value.trim().toLowerCase();
    if (users.some(u => u.email === email)) {
      setFieldError(form.elements.email, 'Este e-mail já tem uma conta. Use outro e-mail ou entre.');
      setFormMessage('Já tem cadastro?', 'Entrar com este e-mail', '#/login');
      form.elements.email.focus();
      return;
    }

    setBusy(button, true, 'Criando conta...');
    try {
      const salt = makeSalt();
      const user = { id: uid(), username: form.elements.usuario.value.trim(), email, salt, hash: await hashPassword(form.elements.senha.value, salt) };
      users.push(user);
      store.set(USERS_KEY, users);
      startSession(user);
      form.reset();
      toast('Conta criada. Bem-vinda(o), ' + user.username + '.');
      location.hash = '#/mochila';
    } catch {
      setFormMessage('Não foi possível proteger a senha neste navegador. Abra o site por https ou localhost e tente de novo.');
    } finally {
      setBusy(button, false);
    }
  }

  // Entra na conta comparando o hash da senha digitada com o salvo, usando uma mensagem única para e-mail ou senha errados e indicando o caminho de saída (H1, H9).
  async function handleLogin(e) {
    e.preventDefault();
    const form = e.target;
    const button = $('button[type="submit"]', form);
    setFormMessage('');
    if (!validateForm(form)) return;

    setBusy(button, true, 'Entrando...');
    try {
      const email = form.elements.email.value.trim().toLowerCase();
      const user = store.get(USERS_KEY, []).find(u => u.email === email);
      const ok = user && (await hashPassword(form.elements.senha.value, user.salt)) === user.hash;
      if (!ok) {
        setFieldError(form.elements.senha, 'E-mail ou senha incorretos. Confira os dados e tente de novo.');
        setFormMessage('Ainda não tem conta?', 'Criar conta', '#/cadastro');
        form.elements.senha.select();
        return;
      }
      startSession(user);
      form.reset();
      toast('Que bom ver você, ' + user.username + '.');
      location.hash = '#/mochila';
    } catch {
      setFormMessage('Não foi possível validar a senha neste navegador. Abra o site por https ou localhost e tente de novo.');
    } finally {
      setBusy(button, false);
    }
  }

  $('#form-cadastro').addEventListener('submit', handleRegister);
  $('#form-login').addEventListener('submit', handleLogin);

  // Encerra a sessão removendo só a chave de sessão, mantendo as contas salvas, e avisa por toast para o usuário ter certeza de que saiu (H1, H3).
  $('#btn-sair').addEventListener('click', () => {
    try { localStorage.removeItem(SESSION_KEY); } catch { /* ignora falha de armazenamento */ }
    toast('Você saiu da sua mochila.');
    location.hash = '#/';
  });

  // ---------- Armário virtual: dados e constantes ----------

  // Descreve cada tipo de folha com nome legível, para a capa e os formulários falarem a linguagem do usuário (H2 mundo real).
  const FOLHAS = {
    pauta: 'Com pauta',
    lisa: 'Sem pauta',
    quadriculado: 'Quadriculado',
    pontilhado: 'Pontilhado',
    cornell: 'Método Cornell'
  };

  // Lista as cores da paleta do projeto para sugerir uma cor diferente a cada caderno novo, dando variedade sem esforço (H7, H8).
  const PALETA = ['#896645', '#EAB05C', '#B6CFB9', '#D95122'];

  // Calcula a chave de dados por usuário para duas contas no mesmo navegador nunca verem as matérias uma da outra (H5 prevenção de erros).
  const dataKey = () => 'mochila_data_' + getSession().id;

  // Carrega as matérias do usuário e garante a estrutura esperada, protegendo o app contra dados antigos ou corrompidos (H5).
  function loadData() {
    const saved = store.get(dataKey(), null);
    data = saved && Array.isArray(saved.materias) ? saved : { materias: [] };
  }

  // Salva o armário inteiro a cada mudança e devolve se deu certo, para nada se perder em silêncio quando o navegador recusar (H1, H5).
  const saveData = () => store.set(dataKey(), data);

  // Cria atalhos de consulta por id e contagem, evitando laços repetidos pelo código (legibilidade).
  const findMateria = id => data.materias.find(m => m.id === id);
  const totalCadernos = () => data.materias.reduce((n, m) => n + m.cadernos.length, 0);
  function findCaderno(id) {
    for (const m of data.materias) {
      const c = m.cadernos.find(x => x.id === id);
      if (c) return { m, c };
    }
    return null;
  }

  // Cria uma página em branco com todos os campos que o editor espera, usada em cadernos novos, novas páginas e transbordo (H4 consistência).
  const blankPage = c => ({ id: uid(), texto: '', html: '', cue: '', summary: '', postits: [], imagens: [], folha: c.folha || 'pauta' });

  // Dá um anel de destaque temporário a um elemento, reiniciando a animação, para o usuário achar na tela o que acabou de criar ou buscar (H1).
  function flash(el) {
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 1700);
  }

  // Rola até o elemento pelo id e o destaca, usado depois de criar itens e ao abrir um resultado de busca (H1 visibilidade).
  function reveal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    flash(el);
  }

  // ---------- Armário virtual: desenho da tela ----------

  // Cria botão com ícone e texto visível a partir de telas médias, com rótulo completo para leitores de tela, evitando ícones ambíguos (H6, acessibilidade).
  function actionBtn(label, iconName, text, onclick) {
    return h('button', { type: 'button', class: 'btn btn-ghost !px-3 sm:!px-4', 'aria-label': label, title: label, onclick },
      icon(iconName), h('span', { class: 'hidden sm:inline' }, text));
  }

  // Cria botão pequeno só com ícone para as ações de cada caderno, com rótulo e dica completos para não depender de adivinhação (H6, H10).
  function miniBtn(label, iconName, onclick) {
    return h('button', { type: 'button', class: 'btn btn-ghost !px-0 w-10', 'aria-label': label, title: label, onclick }, icon(iconName));
  }

  // Desenha o cartão do caderno com capa colorida, etiqueta, abas e ações, tudo a partir dos dados salvos, para o armário parecer de verdade (H2).
  function cadernoCard(m, c) {
    return h('article', { class: 'caderno', id: 'caderno-' + c.id },
      h('button', { type: 'button', class: 'cover', style: '--cover:' + c.cor + ';--cover-ink:' + inkFor(c.cor), 'aria-label': 'Abrir caderno ' + c.titulo, onclick: () => openCaderno(c) },
        h('span', { class: 'cover-spine' }),
        h('span', { class: 'cover-tabs' }, h('i'), h('i'), h('i')),
        h('span', { class: 'cover-label' }, c.titulo),
        h('span', { class: 'cover-sheet' }, FOLHAS[c.folha] || FOLHAS.pauta)),
      h('div', { class: 'mt-3 flex items-center justify-between gap-2' },
        h('p', { class: 'text-xs text-muted' }, plural(c.paginas.length, 'página', 'páginas')),
        h('div', { class: 'flex gap-1' },
          miniBtn('Editar ' + c.titulo, 'edit', () => openCadernoDialog(c, m.id)),
          miniBtn('Excluir ' + c.titulo, 'trash', () => deleteCaderno(m.id, c.id)))));
  }

  // Desenha a prateleira de uma matéria com título, contagem, ações e cadernos, ou uma dica quando ainda não há cadernos (H6, H10).
  function materiaSection(m) {
    return h('section', { class: 'materia', id: 'materia-' + m.id, 'aria-labelledby': 'mt-' + m.id },
      h('div', { class: 'flex flex-wrap items-center justify-between gap-3 mb-5' },
        h('div', { class: 'flex items-center gap-3' },
          h('h2', { id: 'mt-' + m.id, class: 'text-2xl font-extrabold' }, m.nome),
          h('span', { class: 'badge' }, plural(m.cadernos.length, 'caderno', 'cadernos'))),
        h('div', { class: 'flex gap-2' },
          actionBtn('Novo caderno em ' + m.nome, 'plus', 'Caderno', () => openCadernoDialog(null, m.id)),
          actionBtn('Renomear ' + m.nome, 'edit', 'Renomear', () => openMateriaDialog(m)),
          actionBtn('Excluir ' + m.nome, 'trash', 'Excluir', () => deleteMateria(m.id)))),
      m.cadernos.length
        ? h('div', { class: 'shelf' }, m.cadernos.map(c => cadernoCard(m, c)))
        : h('p', { class: 'text-muted' }, 'Nenhum caderno aqui ainda. Use o botão Caderno para criar o primeiro.'));
  }

  // Redesenha o armário inteiro, atualiza o resumo e controla o estado vazio e o botão de novo caderno, mantendo a tela sempre fiel aos dados (H1).
  function renderCloset() {
    const box = $('#armario');
    box.replaceChildren(...data.materias.map(materiaSection));
    const empty = data.materias.length === 0;
    $('#armario-vazio').hidden = !empty;
    const novo = $('#btn-novo-caderno');
    novo.disabled = empty;
    novo.title = empty ? 'Crie uma matéria primeiro' : '';
    $('#armario-resumo').textContent = empty
      ? 'Organize seus estudos em matérias e cadernos.'
      : 'Você tem ' + plural(data.materias.length, 'matéria', 'matérias') + ' e ' + plural(totalCadernos(), 'caderno', 'cadernos') + '.';
  }

  // Abre o miolo do caderno pela rota dele, para o endereço refletir onde o usuário está e o botão voltar funcionar como esperado (H1, H3).
  function openCaderno(c) {
    location.hash = '#/caderno/' + c.id;
  }

  // Exclui a matéria com seus cadernos mas oferece Desfazer por 7 segundos, mais seguro e menos chato que uma janela de confirmação (H3, H5).
  function deleteMateria(id) {
    const idx = data.materias.findIndex(m => m.id === id);
    if (idx < 0) return;
    const [removed] = data.materias.splice(idx, 1);
    saveData();
    renderCloset();
    toast('Matéria "' + removed.nome + '" excluída com ' + plural(removed.cadernos.length, 'caderno', 'cadernos') + '.', {
      label: 'Desfazer',
      onClick: () => { data.materias.splice(idx, 0, removed); saveData(); renderCloset(); reveal('materia-' + removed.id); }
    });
  }

  // Exclui o caderno com Desfazer, devolvendo-o à mesma posição da matéria, para um clique errado nunca custar o trabalho (H3, H5).
  function deleteCaderno(materiaId, cadernoId) {
    const m = findMateria(materiaId);
    const idx = m ? m.cadernos.findIndex(c => c.id === cadernoId) : -1;
    if (idx < 0) return;
    const [removed] = m.cadernos.splice(idx, 1);
    saveData();
    renderCloset();
    toast('Caderno "' + removed.titulo + '" excluído.', {
      label: 'Desfazer',
      onClick: () => { m.cadernos.splice(idx, 0, removed); saveData(); renderCloset(); reveal('caderno-' + removed.id); }
    });
  }

  // ---------- Diálogos de matéria e caderno ----------

  // Liga fechamento por botão, por clique no fundo e limpeza de erros ao fechar, para todo diálogo sair do mesmo jeito e reabrir limpo (H3, H4).
  const dlgMateria = $('#dlg-materia');
  const dlgCaderno = $('#dlg-caderno');
  $$('dialog').forEach(d => {
    d.addEventListener('click', e => { if (e.target === d) d.close(); });
    $$('[data-close]', d).forEach(b => b.addEventListener('click', () => d.close()));
    d.addEventListener('close', () => $$('[data-rule]', d).forEach(i => setFieldError(i, '')));
  });

  // Abre o diálogo de matéria em modo criar ou renomear, ajustando título, botão e campo para o usuário saber o que está fazendo (H1, H4).
  const fm = $('#form-materia');
  function openMateriaDialog(m) {
    fm.reset();
    fm.dataset.editId = m ? m.id : '';
    $('#dlg-materia-titulo').textContent = m ? 'Renomear matéria' : 'Nova matéria';
    const submit = $('button[type="submit"]', fm);
    submit.dataset.label = m ? 'Salvar nome' : 'Criar matéria';
    submit.textContent = submit.dataset.label;
    fm.elements.nome.value = m ? m.nome : '';
    dlgMateria.showModal();
    fm.elements.nome.focus();
    fm.elements.nome.select();
  }

  // Salva a matéria nova ou renomeada depois de validar, fecha o diálogo e destaca o resultado, fechando o ciclo de feedback (H1, H5).
  fm.addEventListener('submit', e => {
    e.preventDefault();
    if (!validateForm(fm)) return;
    const nome = fm.elements.nome.value.trim();
    let targetId;
    if (fm.dataset.editId) {
      const m = findMateria(fm.dataset.editId);
      m.nome = nome;
      targetId = m.id;
      toast('Matéria renomeada para "' + nome + '".');
    } else {
      const m = { id: uid(), nome, cadernos: [] };
      data.materias.push(m);
      targetId = m.id;
      toast('Matéria "' + nome + '" criada. Agora adicione um caderno nela.');
    }
    saveData();
    dlgMateria.close();
    renderCloset();
    reveal('materia-' + targetId);
  });

  $('#btn-nova-materia').addEventListener('click', () => openMateriaDialog(null));
  $('#btn-primeira-materia').addEventListener('click', () => openMateriaDialog(null));
  $('#btn-novo-caderno').addEventListener('click', () => openCadernoDialog(null));

  // ---------- Seletor de cor (roda, brilho, hexadecimal e RGB) ----------

  // Guarda os elementos da roda e o estado atual da cor em HSV, fonte única da verdade para todos os controles ficarem sincronizados (H4).
  const fc = $('#form-caderno');
  const wheel = $('#wheel');
  const marker = $('#wheel-marker');
  const wctx = wheel.getContext('2d');
  let color = { h: 20, s: 0.8, v: 0.85 };
  let wheelV = -1;

  // Pinta a roda pixel a pixel com matiz pelo ângulo e saturação pelo raio no brilho atual, mostrando as cores realmente escolhíveis (H1).
  function drawWheel(v) {
    const size = wheel.width, R = size / 2;
    const img = wctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - R + 0.5, dy = y - R + 0.5, dist = Math.hypot(dx, dy), i = (y * size + x) * 4;
        if (dist > R) continue;
        const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
        const [r, g, b] = hsvToRgb(hue, dist / R, v);
        img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
      }
    }
    wctx.putImageData(img, 0, 0);
    wheelV = v;
  }

  // Atualiza a miniatura da capa com a cor e o título digitado, mostrando o resultado final enquanto o usuário escolhe (H1 visibilidade).
  function updatePreview(hex) {
    $('#cor-preview').style.cssText = 'cursor:default;pointer-events:none;--cover:' + hex + ';--cover-ink:' + inkFor(hex);
    $('#preview-label').textContent = fc.elements.titulo.value.trim() || 'Título do caderno';
  }

  // Aplica uma cor a todos os controles de uma vez, pulando o que originou a mudança, para ninguém brigar com o cursor de quem digita (H1, H4).
  function applyColor(c, from, exactRgb) {
    color = c;
    const [r, g, b] = exactRgb || hsvToRgb(c.h, c.s, c.v);
    const hex = toHexColor(r, g, b);
    if (from !== 'hex') { fc.elements.hex.value = hex; setFieldError(fc.elements.hex, ''); }
    if (from !== 'rgb') { fc.elements.r.value = r; fc.elements.g.value = g; fc.elements.b.value = b; }
    if (from !== 'slider') fc.elements.brilho.value = Math.round(c.v * 100);
    if (Math.abs(wheelV - c.v) > 0.004) drawWheel(c.v);
    const R = wheel.width / 2;
    marker.style.left = (R + c.s * R * Math.cos(c.h * Math.PI / 180)) + 'px';
    marker.style.top = (R + c.s * R * Math.sin(c.h * Math.PI / 180)) + 'px';
    updatePreview(hex);
  }

  // Converte a posição do ponteiro em matiz e saturação, limitando ao raio da roda para o marcador nunca sair do círculo (H5).
  function pickFromEvent(e) {
    const rect = wheel.getBoundingClientRect(), R = rect.width / 2;
    const dx = e.clientX - rect.left - R, dy = e.clientY - rect.top - R;
    const dist = Math.min(Math.hypot(dx, dy), R);
    applyColor({ h: (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, s: dist / R, v: color.v }, 'wheel');
  }

  // Permite arrastar com mouse, toque ou caneta usando pointer capture, para o arrasto continuar mesmo se o dedo sair da roda (H7).
  wheel.addEventListener('pointerdown', e => { wheel.setPointerCapture(e.pointerId); pickFromEvent(e); });
  wheel.addEventListener('pointermove', e => { if (wheel.hasPointerCapture(e.pointerId)) pickFromEvent(e); });

  // Oferece as setas do teclado para mover matiz e saturação, com Shift para passos maiores, alternativa ao mouse (H7, acessibilidade).
  wheel.addEventListener('keydown', e => {
    const step = e.shiftKey ? 15 : 5;
    let { h: hue, s, v } = color;
    if (e.key === 'ArrowLeft') hue = (hue - step + 360) % 360;
    else if (e.key === 'ArrowRight') hue = (hue + step) % 360;
    else if (e.key === 'ArrowUp') s = Math.min(1, s + 0.05);
    else if (e.key === 'ArrowDown') s = Math.max(0, s - 0.05);
    else return;
    e.preventDefault();
    applyColor({ h: hue, s, v }, 'wheel');
  });

  // Liga o controle de brilho à cor, mantendo matiz e saturação, para escurecer ou clarear sem perder o tom escolhido (H3 controle).
  fc.elements.brilho.addEventListener('input', e => applyColor({ ...color, v: e.target.value / 100 }, 'slider'));

  // Aplica o hexadecimal assim que ficar completo e o normaliza ao sair do campo, aceitando digitar com ou sem # (H7, H5).
  fc.elements.hex.addEventListener('input', () => {
    const rgb = parseHex(fc.elements.hex.value);
    if (rgb) applyColor(rgbToHsv(...rgb, color.h), 'hex', rgb);
  });
  fc.elements.hex.addEventListener('change', () => {
    const rgb = parseHex(fc.elements.hex.value);
    if (rgb) fc.elements.hex.value = toHexColor(...rgb);
  });

  // Lê os três campos RGB limitando cada um a 0-255 e usando o valor atual quando vazio, prevenindo cores inválidas em vez de reclamar (H5).
  function readRgb() {
    const cur = hsvToRgb(color.h, color.s, color.v);
    return ['r', 'g', 'b'].map((k, i) => {
      const raw = fc.elements[k].value;
      return raw === '' ? cur[i] : clamp(Math.round(Number(raw)) || 0, 0, 255);
    });
  }
  ['r', 'g', 'b'].forEach(k => {
    fc.elements[k].addEventListener('input', () => {
      if (['r', 'g', 'b'].some(n => fc.elements[n].value === '')) return;
      const rgb = readRgb();
      applyColor(rgbToHsv(...rgb, color.h), 'rgb', rgb);
    });
    fc.elements[k].addEventListener('change', () => {
      const rgb = readRgb();
      applyColor(rgbToHsv(...rgb, color.h), 'init', rgb);
    });
  });

  // Liga as cores da paleta como atalho de um clique e atualiza a prévia enquanto o título é digitado, dando retorno imediato (H1, H7).
  $$('.swatch').forEach(btn => btn.addEventListener('click', () => {
    const rgb = parseHex(btn.dataset.hex);
    applyColor(rgbToHsv(...rgb, color.h), 'swatch', rgb);
  }));
  fc.elements.titulo.addEventListener('input', () => updatePreview(parseHex(fc.elements.hex.value) ? toHexColor(...parseHex(fc.elements.hex.value)) : '#896645'));
  fc.elements.materia.addEventListener('change', () => { if (fc.elements.titulo.value) checkField(fc.elements.titulo); });

  // ---------- Diálogo de caderno ----------

  // Abre o diálogo em modo criar ou editar, preenchendo matéria, folha e cor, e sugerindo uma cor nova da paleta para cada caderno (H6, H7).
  function openCadernoDialog(c, materiaId) {
    if (!data.materias.length) {
      toast('Crie uma matéria primeiro para poder adicionar cadernos.');
      openMateriaDialog(null);
      return;
    }
    fc.reset();
    $$('[data-rule]', fc).forEach(i => setFieldError(i, ''));
    fc.dataset.editId = c ? c.id : '';
    const sel = fc.elements.materia;
    sel.replaceChildren(...data.materias.map(m => h('option', { value: m.id }, m.nome)));
    sel.value = materiaId || data.materias[0].id;
    fc.elements.titulo.value = c ? c.titulo : '';
    fc.elements.folha.value = c ? (c.folha || 'pauta') : 'pauta';
    const rgb = parseHex(c ? c.cor : PALETA[totalCadernos() % PALETA.length]);
    applyColor(rgbToHsv(...rgb), 'init', rgb);
    $('#dlg-caderno-titulo').textContent = c ? 'Editar caderno' : 'Novo caderno';
    const submit = $('button[type="submit"]', fc);
    submit.dataset.label = c ? 'Salvar alterações' : 'Criar caderno';
    submit.textContent = submit.dataset.label;
    dlgCaderno.showModal();
    fc.elements.titulo.focus();
  }

  // Salva o caderno novo ou editado, movendo-o de matéria se preciso, e destaca o resultado na prateleira para confirmar a ação (H1, H3, H5).
  fc.addEventListener('submit', e => {
    e.preventDefault();
    if (!validateForm(fc)) return;
    const titulo = fc.elements.titulo.value.trim();
    const cor = toHexColor(...parseHex(fc.elements.hex.value));
    const folha = fc.elements.folha.value;
    const destino = findMateria(fc.elements.materia.value);
    let id;
    if (fc.dataset.editId) {
      const found = findCaderno(fc.dataset.editId);
      Object.assign(found.c, { titulo, cor, folha });
      if (found.m.id !== destino.id) {
        found.m.cadernos = found.m.cadernos.filter(x => x !== found.c);
        destino.cadernos.push(found.c);
      }
      id = found.c.id;
      toast('Caderno "' + titulo + '" atualizado.');
    } else {
      const novo = { id: uid(), titulo, cor, folha, criadoEm: new Date().toISOString(), paginas: [] };
      novo.paginas.push(blankPage(novo));
      destino.cadernos.push(novo);
      id = novo.id;
      toast('Caderno "' + titulo + '" criado em ' + destino.nome + '.');
    }
    saveData();
    dlgCaderno.close();
    renderCloset();
    reveal('caderno-' + id);
  });

  // ---------- Busca global ("Ctrl+F da mochila") ----------

  // Guarda os elementos da busca e esconde o painel ao fechar, devolvendo o estado aria-expanded para leitores de tela acompanharem (H1).
  const busca = $('#busca');
  const painel = $('#busca-painel');
  function closeSearch() {
    painel.hidden = true;
    busca.setAttribute('aria-expanded', 'false');
  }

  // Recorta um trecho curto em volta da palavra achada, com reticências, para o resultado mostrar o contexto sem despejar a página toda (H8).
  function snippet(text, q) {
    const t = String(text).normalize('NFC');
    const i = Math.max(0, norm(t).indexOf(q));
    const start = Math.max(0, i - 30), end = Math.min(t.length, i + q.length + 50);
    return (start > 0 ? '...' : '') + t.slice(start, end) + (end < t.length ? '...' : '');
  }

  // Marca a palavra buscada com mark montando nós de texto, nunca HTML, para o destaque ser seguro mesmo com texto digitado pelo usuário (H1, H5).
  function highlight(text, q) {
    const t = String(text).normalize('NFC'), n = norm(t), frag = document.createDocumentFragment();
    let pos = 0, i;
    while ((i = n.indexOf(q, pos)) !== -1) {
      frag.append(t.slice(pos, i), h('mark', {}, t.slice(i, i + q.length)));
      pos = i + q.length;
    }
    frag.append(t.slice(pos));
    return frag;
  }

  // Procura o termo em matérias, cadernos, páginas e post-its, ignorando acentos e maiúsculas, e guarda a rota para abrir a página exata (requisito da busca global).
  function searchAll(q) {
    const out = [];
    const has = t => norm(t || '').includes(q);
    data.materias.forEach(m => {
      if (has(m.nome)) out.push({ tipo: 'Matéria', trecho: m.nome, alvo: 'materia-' + m.id });
      m.cadernos.forEach(c => {
        const ctx = m.nome + ' / ' + c.titulo;
        if (has(c.titulo)) out.push({ tipo: 'Caderno', trecho: c.titulo, ctx: m.nome, alvo: 'caderno-' + c.id, rota: '#/caderno/' + c.id });
        (c.paginas || []).forEach((p, i) => {
          const rota = '#/caderno/' + c.id + '/' + (i + 1);
          if (has(p.texto)) out.push({ tipo: 'Página ' + (i + 1), trecho: snippet(p.texto, q), ctx, alvo: 'caderno-' + c.id, rota });
          (p.postits || []).forEach(pi => { if (has(pi.texto)) out.push({ tipo: 'Post-it', trecho: snippet(pi.texto, q), ctx, alvo: 'caderno-' + c.id, rota }); });
        });
      });
    });
    return out;
  }

  // Fecha a busca e leva o usuário ao resultado: abre a página do caderno quando há rota, ou destaca a matéria no armário, com foco (H1, H7).
  function goTo(r) {
    closeSearch();
    if (r.rota) { location.hash = r.rota; return; }
    reveal(r.alvo);
    document.getElementById(r.alvo)?.querySelector('button')?.focus({ preventScroll: true });
  }

  // Monta o painel de resultados com contagem, itens clicáveis e mensagens úteis quando não há nada, ajudando a se recuperar (H1, H6, H9, H10).
  function renderSearch() {
    const term = busca.value.trim();
    painel.replaceChildren();
    if (!term) { closeSearch(); return; }
    const q = norm(term);
    const res = searchAll(q);
    painel.hidden = false;
    busca.setAttribute('aria-expanded', 'true');
    if (!res.length) {
      painel.append(h('p', { class: 'p-4 text-sm text-muted', role: 'status' }, 'Nenhum resultado para "' + term + '". Confira a grafia ou tente uma palavra mais curta. A busca olha matérias, cadernos, páginas e post-its.'));
      return;
    }
    painel.append(h('p', { class: 'px-4 pt-3 pb-1 text-xs font-semibold text-muted', role: 'status' }, plural(res.length, 'resultado', 'resultados')));
    const ul = h('ul');
    res.slice(0, 30).forEach(r => ul.append(h('li', {},
      h('button', { type: 'button', class: 'result', onclick: () => goTo(r) },
        h('span', { class: 'result-kind' }, r.tipo),
        h('span', { class: 'result-text' }, highlight(r.trecho, q)),
        r.ctx ? h('span', { class: 'result-ctx' }, r.ctx) : null))));
    if (res.length > 30) ul.append(h('li', { class: 'px-4 py-3 text-xs text-muted' }, 'Mostrando os 30 primeiros. Digite mais letras para refinar.'));
    painel.append(ul);
  }

  // Busca enquanto o usuário digita, com uma pequena espera de 120 ms para não recalcular a cada tecla e a lista não piscar (H1, performance).
  let searchTimer;
  busca.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(renderSearch, 120); });
  busca.addEventListener('focus', () => { if (busca.value.trim()) renderSearch(); });

  // Permite ir do campo aos resultados com a seta para baixo e voltar com Esc, para usar a busca inteira só pelo teclado (H7 eficiência).
  busca.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); $('button', painel)?.focus(); }
    if (e.key === 'Escape') { closeSearch(); busca.blur(); }
  });
  painel.addEventListener('keydown', e => {
    const items = $$('button', painel), i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[Math.min(i + 1, items.length - 1)]?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); if (i <= 0) busca.focus(); else items[i - 1].focus(); }
    if (e.key === 'Escape') { closeSearch(); busca.focus(); }
  });

  // Fecha o painel ao clicar fora dele, comportamento esperado de qualquer lista suspensa, devolvendo o controle ao usuário (H3, H4).
  document.addEventListener('click', e => { if (!e.target.closest('#busca-wrap')) closeSearch(); });

  // ---------- Miolo do caderno: constantes e estado ----------

  // Fixa a altura da linha em 32px e calcula o teto da fonte em 75% dela (24px), a trava matemática que impede letras de invadir a linha de cima (Baseline Lock).
  const ROW = 32;
  const MAX_FONT = Math.floor(ROW * 0.75);
  const SIZES = [12, 14, 16, 18, 20, 22, 24];

  // Define a barreira de 38px (cerca de 1 cm) entre objeto e texto e a largura mínima de 120px que o texto precisa ter, senão a linha inteira é liberada ao objeto (requisito de 1 cm).
  const BARRIER = 38;
  const MIN_TEXT = 120;

  // Guarda as três famílias homologadas com alternativas, porque Calibri não existe em todo sistema e a pauta não pode depender dela (H5).
  const FONTS = {
    montserrat: "'Montserrat', Arial, sans-serif",
    arial: 'Arial, Helvetica, sans-serif',
    calibri: "Calibri, Carlito, 'Segoe UI', Arial, sans-serif"
  };

  // Lista as cores de post-it e de fita adesiva da paleta do projeto, para as notas combinarem com o restante da interface (H4 consistência).
  const POSTIT_COLORS = [
    { nome: 'Beeswax', hex: '#EAB05C' },
    { nome: 'Darlington', hex: '#B6CFB9' },
    { nome: 'Rosa', hex: '#F2C9C0' },
    { nome: 'Creme', hex: '#F6E7B4' }
  ];
  const TAPES = ['', '#EAB05C', '#B6CFB9', '#D95122'];

  // Reúne as três zonas editáveis, a folha, o sumário, a camada de objetos e o estado do editor, usados por todas as funções abaixo.
  const ZONES = { cue: $('#z-cue'), notes: $('#z-notes'), summary: $('#z-summary') };
  const sheet = $('#sheet');
  const tocSheet = $('#toc-sheet');
  const bodyEl = $('.sheet-body', sheet);
  const layer = $('#obj-layer');
  const guide = $('#snap-guide');
  const fit = $('#sheet-fit');
  const scaleEl = $('#sheet-scale');
  let ed = null;
  let activeZone = null;
  let savedRange = null;
  let lastSize = 18;
  let hold = false;
  let saveTimer;
  let scale = 1;
  let spilling = false;
  let selId = null;
  let flowRaf = 0;
  let warnedFull = false;
  let pendingSec = null;

  // Cria um molde limpo da folha, sem ids, guia nem edição, usado para as cópias invisíveis de medição e para as páginas do PDF (requisito de fidelidade).
  function makeShell() {
    const s = sheet.cloneNode(true);
    s.removeAttribute('id');
    $$('[id]', s).forEach(n => n.removeAttribute('id'));
    $$('.snap-guide', s).forEach(n => n.remove());
    $$('.zone', s).forEach(z => { z.removeAttribute('contenteditable'); z.removeAttribute('role'); });
    return s;
  }
  const shellTpl = makeShell();

  // Cria o molde limpo da folha de sumário, usado nas páginas de Contents do PDF, para ficarem idênticas à tela (requisito do sumário no PDF).
  const tocTpl = tocSheet.cloneNode(true);
  tocTpl.removeAttribute('id');
  tocTpl.removeAttribute('hidden');
  $$('[id]', tocTpl).forEach(n => n.removeAttribute('id'));

  // Cria uma cópia invisível da folha, fora da tela, para medir quanto texto cabe nas páginas seguintes sem mexer na página que o usuário vê (requisito do transbordo).
  const ghost = shellTpl.cloneNode(true);
  $$('.obj-layer', ghost).forEach(n => n.remove());
  ghost.classList.add('ghost');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  document.body.append(ghost);
  const gz = { cue: $('.zone-cue', ghost), notes: $('.zone-notes', ghost), summary: $('.zone-summary', ghost) };

  // Limpa HTML guardado removendo scripts, atributos de evento e links javascript, para o conteúdo salvo nunca executar código ao reabrir (H5).
  function sanitize(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html || '';
    tpl.content.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach(n => n.remove());
    tpl.content.querySelectorAll('*').forEach(el => {
      [...el.attributes].forEach(a => { if (/^on/i.test(a.name) || /javascript:/i.test(a.value)) el.removeAttribute(a.name); });
    });
    return tpl.innerHTML;
  }

  // Extrai só o texto de um trecho de HTML, usado para manter o texto de busca das páginas atualizado depois do transbordo (requisito da busca).
  function textOf(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html || '';
    return tpl.content.textContent.trim();
  }

  // Descobre a qual zona editável um nó pertence, ignorando qualquer coisa fora da folha, para a barra de ferramentas só agir onde há texto (H5).
  function zoneOf(node) {
    const el = node && (node.nodeType === 3 ? node.parentElement : node);
    const z = el && el.closest ? el.closest('.zone') : null;
    return z && sheet.contains(z) ? z : null;
  }

  // Lembra a última seleção feita dentro da folha para os controles da barra, que roubam o foco, aplicarem a formatação no lugar certo (H3, H7).
  document.addEventListener('selectionchange', () => {
    if (!ed || ed.toc) return;
    const sel = getSelection();
    if (!sel.rangeCount) return;
    const z = zoneOf(sel.anchorNode);
    if (z) { activeZone = z; savedRange = sel.getRangeAt(0).cloneRange(); updateToolbarState(); }
  });

  // Devolve o foco e a seleção lembrada à zona de texto antes de formatar, retornando falso se o usuário ainda não clicou na página (H9).
  function restoreSelection() {
    if (!activeZone || !savedRange) return false;
    activeZone.focus({ preventScroll: true });
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
    return true;
  }

  // Explica o que fazer quando uma ferramenta é usada sem um lugar escolhido para escrever, em vez de falhar em silêncio (H9 recuperação de erros).
  const noSelection = () => toast('Clique na página onde quer escrever e depois escolha a formatação.');

  // Encontra o bloco (linha) onde está o cursor, filho direto da zona, para aplicar checklist, título de seção ou outros estilos de linha inteira.
  function currentBlock(zone = activeZone) {
    const sel = getSelection();
    if (!sel.rangeCount || !zone) return null;
    let n = sel.anchorNode;
    while (n && n.parentNode !== zone) n = n.parentNode;
    return n && n.nodeType === 1 && !n.classList.contains('flow') ? n : null;
  }

  // Garante que o cursor esteja dentro de um bloco de linha, criando um se a zona estiver vazia ou tiver texto solto, para estilos de linha sempre terem onde se aplicar (H5).
  function ensureBlock() {
    let block = currentBlock();
    if (block) return block;
    const hasContent = [...activeZone.childNodes].some(n => !(n.nodeType === 1 && n.classList.contains('flow')));
    if (!hasContent) {
      const d = h('div', {}, h('br'));
      activeZone.append(d);
      const r = document.createRange();
      r.setStart(d, 0);
      r.collapse(true);
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(r);
    } else {
      document.execCommand('formatBlock', false, 'div');
    }
    return currentBlock();
  }

  // Posiciona o cursor logo antes de um nó e devolve o foco à área de notas, usado para o cursor acompanhar o texto que passou para outra página (H1, H7).
  function caretBefore(node) {
    ZONES.notes.focus({ preventScroll: true });
    const r = document.createRange();
    r.setStartBefore(node);
    r.collapse(true);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  }

  // Marca a zona como vazia, para a dica "Comece a escrever" aparecer só na área de notas sem texto, mesmo havendo espaçadores dentro (H6).
  function markEmpty(zone) {
    zone.classList.toggle('is-empty', zone === ZONES.notes && !zone.textContent.trim() && !zone.querySelector('.chk-line'));
  }

  // Serializa a zona sem os espaçadores de recuo, o marcador de cursor nem o brilho de destaque, para o que é salvo ser só o conteúdo do usuário (H5, requisito de persistência).
  function serializeZone(zone, keepMarker) {
    const c = zone.cloneNode(true);
    $$('.flow', c).forEach(n => n.remove());
    $$('.sec-flash', c).forEach(n => n.classList.remove('sec-flash'));
    if (!keepMarker) $$('[data-caret]', c).forEach(n => n.remove());
    return c.innerHTML;
  }

  // ---------- Motor anticolisão: recuo de 1 cm por espaçadores flutuantes ----------

  // Calcula, linha a linha, quanto cada lado da zona deve ser reservado para os objetos, somando 1 cm, e libera a linha inteira quando sobraria pouco texto (requisito de colisão).
  function computeBands(zone, objs) {
    const zl = zone.offsetLeft, zt = zone.offsetTop, zw = zone.offsetWidth, zh = zone.clientHeight;
    const cs = getComputedStyle(zone);
    const contentL = zl + parseFloat(cs.paddingLeft), contentR = zl + zw - parseFloat(cs.paddingRight);
    const contentW = Math.max(0, contentR - contentL), center = (contentL + contentR) / 2;
    const rows = Math.round(zh / ROW);
    const left = new Array(rows).fill(0), right = new Array(rows).fill(0);
    objs.forEach(o => {
      const r0 = Math.max(0, Math.floor((o.y - zt) / ROW)), r1 = Math.min(rows - 1, Math.ceil((o.y + o.h - zt) / ROW) - 1);
      if (r1 < r0 || o.x + o.w + BARRIER <= contentL || o.x - BARRIER >= contentR) return;
      const toLeft = (o.x + o.w / 2) < center;
      for (let r = r0; r <= r1; r++) {
        if (toLeft) left[r] = Math.max(left[r], o.x + o.w + BARRIER - contentL);
        else right[r] = Math.max(right[r], contentR - (o.x - BARRIER));
      }
    });
    for (let r = 0; r < rows; r++) {
      left[r] = Math.ceil(clamp(left[r], 0, contentW));
      right[r] = Math.ceil(clamp(right[r], 0, contentW));
      if (left[r] + right[r] > contentW - MIN_TEXT && (left[r] || right[r])) { left[r] = Math.ceil(contentW); right[r] = 0; }
    }
    return { left: bandsOf(left), right: bandsOf(right) };
  }

  // Junta linhas vizinhas com a mesma largura em faixas, para criar poucos espaçadores em vez de um por linha (performance).
  function bandsOf(arr) {
    const out = [];
    let i = 0;
    while (i < arr.length) {
      if (!arr[i]) { i++; continue; }
      let j = i;
      while (j + 1 < arr.length && arr[j + 1] === arr[i]) j++;
      out.push({ r0: i, r1: j, w: arr[i] });
      i = j + 1;
    }
    return out;
  }

  // Cria os divs flutuantes de um lado: um empurrador de largura zero até a faixa e o espaçador da faixa, usando clear para empilhar na altura certa (requisito de recuo).
  function buildSide(bands, side) {
    const els = [];
    let row = 0;
    const mk = (w, hgt) => {
      const d = document.createElement('div');
      d.className = 'flow';
      d.setAttribute('contenteditable', 'false');
      d.setAttribute('aria-hidden', 'true');
      d.style.cssText = 'float:' + side + ';clear:' + (els.length ? side : 'none') + ';width:' + w + 'px;height:' + hgt + 'px';
      return d;
    };
    bands.forEach(b => {
      if (b.r0 > row) els.push(mk(0, (b.r0 - row) * ROW));
      els.push(mk(b.w, (b.r1 - b.r0 + 1) * ROW));
      row = b.r1 + 1;
    });
    return els;
  }

  // Aplica os espaçadores nas zonas visíveis só quando algo mudou, comparando uma assinatura, para o texto contornar os objetos sem refazer o DOM à toa (H1, performance).
  function applyFlow(zs, objs, force) {
    Object.values(zs).forEach(zone => {
      const have = $$(':scope > .flow', zone);
      if (zone.offsetParent === null) { have.forEach(n => n.remove()); zone._sig = ''; zone._n = 0; return; }
      const spec = computeBands(zone, objs);
      const sig = JSON.stringify(spec);
      if (!force && zone._sig === sig && have.length === zone._n) return;
      have.forEach(n => n.remove());
      const els = [...buildSide(spec.left, 'left'), ...buildSide(spec.right, 'right')];
      zone.prepend(...els);
      zone._sig = sig;
      zone._n = els.length;
    });
  }

  // Recalcula o recuo da página aberta a partir dos objetos dela e atualiza a dica de zona vazia, mantendo texto e objetos sempre separados (requisito de colisão).
  function reflowAll(force) {
    if (!ed || ed.toc) return;
    applyFlow(ZONES, objectsOf(curPage()), force);
    Object.values(ZONES).forEach(markEmpty);
  }

  // Agrupa vários recálculos de uma sequência de movimentos do ponteiro em um por quadro de animação, para o arrasto continuar fluido (performance).
  function requestFlow() {
    if (flowRaf) return;
    flowRaf = requestAnimationFrame(() => { flowRaf = 0; reflowAll(); });
  }

  // ---------- Motor de transbordo: o excedente vai para o topo da página seguinte ----------

  // Diz se o conteúdo passou da altura física da zona, o gatilho de todo o transbordo (requisito de overflow).
  const overflows = zone => zone.scrollHeight > zone.clientHeight + 1;

  // Embrulha textos soltos no topo da zona em divs, para cada linha ser um bloco que pode ser movido inteiro (requisito de blocos de linha).
  function wrapStrays(zone) {
    let run = [];
    const flush = () => {
      if (!run.length) return;
      const d = document.createElement('div');
      run[0].before(d);
      d.append(...run);
      run = [];
    };
    [...zone.childNodes].forEach(n => {
      if (n.nodeType === 1 && (n.classList.contains('flow') || n.tagName === 'DIV')) flush();
      else if (n.nodeType === 3 && !n.data.trim() && !run.length) n.remove();
      else run.push(n);
    });
    flush();
  }

  // Acha o início da última palavra do bloco, para separar o texto que não cabe palavra por palavra sem cortar no meio (requisito de transbordo).
  function lastWordPos(block) {
    const tw = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let last = null, n;
    while ((n = tw.nextNode())) if (/\S/.test(n.data)) last = n;
    if (!last) return null;
    return { node: last, offset: /\S+\s*$/.exec(last.data).index };
  }

  // Tira do fim da zona os blocos e palavras que passam da última linha e devolve em HTML, preservando negrito, cores, títulos e checklist, para irem à página seguinte (requisito de overflow).
  function spillZone(zone) {
    if (!overflows(zone)) return '';
    wrapStrays(zone);
    const tail = document.createElement('div');
    let guard = 0;
    while (overflows(zone) && guard++ < 6000) {
      const blocks = $$(':scope > div:not(.flow)', zone);
      const last = blocks[blocks.length - 1];
      if (!last) break;
      if (last.offsetTop - zone.offsetTop >= zone.clientHeight || !lastWordPos(last)) { tail.prepend(last); continue; }
      const part = last.cloneNode(false);
      part.classList.remove('chk-line', 'sec-title');
      part.removeAttribute('data-done');
      while (overflows(zone)) {
        const pos = lastWordPos(last);
        if (!pos) break;
        const r = document.createRange();
        r.setStart(pos.node, pos.offset);
        r.setEnd(last, last.childNodes.length);
        part.prepend(r.extractContents());
      }
      if (part.childNodes.length) tail.prepend(part);
      if (!last.textContent.trim() && !last.querySelector('[data-caret]')) last.remove();
    }
    return tail.innerHTML;
  }

  // Carrega uma página na cópia invisível, aplica os objetos dela, tira o que não cabe e guarda o conteúdo ajustado, devolvendo o excedente para a próxima (requisito de cascata).
  function measureAndSpill(pg) {
    ghost.className = 'sheet ghost f-' + (pg.folha || ed.c.folha || 'pauta');
    gz.notes.innerHTML = sanitize(pg.html);
    applyFlow(gz, objectsOf(pg), true);
    const out = spillZone(gz.notes);
    pg.html = serializeZone(gz.notes, true);
    pg.texto = [textOf(pg.cue), gz.notes.innerText.trim(), textOf(pg.summary)].filter(Boolean).join('\n');
    return out;
  }

  // Insere um marcador invisível no cursor antes de mover texto, para depois levar o cursor junto com a palavra que mudou de página (H1, H7).
  function dropMarker() {
    const sel = getSelection();
    if (!sel.rangeCount) return null;
    const r = sel.getRangeAt(0);
    if (!r.collapsed || !ZONES.notes.contains(r.endContainer)) return null;
    const m = document.createElement('span');
    m.setAttribute('data-caret', '');
    r.insertNode(m);
    return m;
  }

  // Resolve o transbordo da área de notas: move o excedente para o topo da próxima página, cria páginas se preciso, repete em cascata e leva o cursor junto (requisito de overflow engine).
  function resolveOverflow() {
    const notes = ZONES.notes;
    if (!ed || ed.toc || spilling || notes.offsetParent === null || !overflows(notes)) return false;
    spilling = true;
    try {
      const marker = dropMarker();
      let html = spillZone(notes);
      if (!html) { marker?.remove(); return false; }
      collectPage();
      let k = ed.i + 1;
      while (html && k < 500) {
        if (k >= ed.c.paginas.length) ed.c.paginas.push(blankPage(ed.c));
        const pg = ed.c.paginas[k];
        pg.html = html + (pg.html || '');
        html = measureAndSpill(pg);
        k++;
      }
      let moved = -1;
      if (marker) {
        if (notes.contains(marker)) { caretBefore(marker); marker.remove(); notes.normalize(); }
        else moved = ed.c.paginas.findIndex((p, i) => i > ed.i && (p.html || '').includes('data-caret'));
      }
      saveData();
      if (moved > -1) {
        ed.i = moved;
        loadPage(true);
        const m = notes.querySelector('[data-caret]');
        if (m) { caretBefore(m); m.remove(); notes.normalize(); }
        collectPage();
        saveData();
        toast('O texto passou do fim da página e continuou na página ' + (moved + 1) + '.');
      } else {
        updatePageChrome();
        toast('Parte do texto passou do fim da página e foi para a página ' + (ed.i + 2) + '.');
      }
      updateTocBadge();
      setSaveStatus('Salvo às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } finally {
      spilling = false;
    }
    return true;
  }

  // ---------- Miolo do caderno: formatação com baseline travada ----------

  // Converte as marcas que o navegador cria (font size 7, cor automática, tamanhos acima do teto) em estilos controlados, mantendo tudo dentro da linha de 32px (Baseline Lock, H5).
  function normalizeZone(zone, selectResult) {
    const made = [];
    $$('font[size]', zone).forEach(f => {
      const span = h('span', { style: 'font-size:' + Math.min(lastSize, MAX_FONT) + 'px' });
      span.append(...f.childNodes);
      f.replaceWith(span);
      made.push(span);
    });
    $$('span[style]', zone).forEach(s => {
      if (s.style.color === 'rgb(1, 2, 3)') s.style.color = 'var(--ink)';
      if (parseFloat(s.style.fontSize) > MAX_FONT) s.style.fontSize = MAX_FONT + 'px';
    });
    if (made.length) {
      const r = document.createRange();
      if (selectResult) { r.setStartBefore(made[0]); r.setEndAfter(made[made.length - 1]); }
      else { r.selectNodeContents(made[made.length - 1]); r.collapse(false); }
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      savedRange = r.cloneRange();
    }
  }

  // Desfaz a última digitação nas zonas laterais do Cornell quando passam da altura física e avisa com atalho para criar outra página, prevenindo texto cortado (H5, H9).
  function guardOverflow(zone) {
    if (!zone || !overflows(zone)) return false;
    document.execCommand('undo');
    zone.scrollTop = 0;
    toast('Esta área está cheia. Use a área de notas ou crie uma nova página.', { label: 'Nova página', onClick: newPage });
    return true;
  }

  // Fecha toda edição resolvendo transbordo, agendando o salvamento e atualizando a barra, para o estado mostrado sempre bater com o texto sob o cursor (H1).
  function afterEdit() {
    const z = activeZone;
    const handled = z === ZONES.notes ? resolveOverflow() : guardOverflow(z);
    if (!handled) scheduleSave();
    updateToolbarState();
  }

  // Executa um comando de formatação na seleção lembrada, usando estilos CSS em vez de tags antigas, e marca espera quando só há cursor (H3, H7).
  function exec(cmd, value) {
    if (!restoreSelection()) { noSelection(); return false; }
    document.execCommand('styleWithCSS', false, true);
    const ok = document.execCommand(cmd, false, value);
    const collapsed = getSelection().isCollapsed;
    if (collapsed) hold = true;
    normalizeZone(activeZone, !collapsed);
    afterEdit();
    return ok;
  }

  // Aplica o tamanho em pixels respeitando o teto de 24px, passando pelo tamanho 7 do navegador e convertendo depois para px exatos (Baseline Lock).
  function applySize(px) {
    lastSize = px;
    if (!restoreSelection()) { noSelection(); return; }
    document.execCommand('styleWithCSS', false, false);
    document.execCommand('fontSize', false, '7');
    document.execCommand('styleWithCSS', false, true);
    const collapsed = getSelection().isCollapsed;
    if (collapsed) hold = true;
    normalizeZone(activeZone, !collapsed);
    afterEdit();
  }

  // Reflete na barra a fonte, o tamanho, o negrito e o título de seção do trecho sob o cursor, para o usuário ver o estado atual sem adivinhar (H1 visibilidade).
  function updateToolbarState() {
    if (!ed || ed.toc) return;
    const sel = getSelection();
    if (!sel.rangeCount) return;
    const node = sel.anchorNode;
    const el = node && (node.nodeType === 3 ? node.parentElement : node);
    if (!el || !zoneOf(el)) return;
    $('#tb-negrito').setAttribute('aria-pressed', String(document.queryCommandState('bold')));
    const blk = currentBlock(zoneOf(el));
    $('#tb-secao').setAttribute('aria-pressed', String(Boolean(blk && blk.classList.contains('sec-title'))));
    if (hold) return;
    const cs = getComputedStyle(el);
    const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim().toLowerCase();
    $('#tb-fonte').value = fam === 'calibri' || fam === 'carlito' ? 'calibri' : fam === 'arial' ? 'arial' : 'montserrat';
    const px = Math.round(parseFloat(cs.fontSize));
    $('#tb-tamanho').value = String(SIZES.reduce((a, b) => Math.abs(b - px) < Math.abs(a - px) ? b : a));
  }

  // Liga cada controle da barra ao seu comando, mantendo a seleção do texto ao clicar em botões para a formatação pegar no trecho certo (H3, H7).
  $('#toolbar').addEventListener('mousedown', e => { if (!e.target.closest('select, input')) e.preventDefault(); });
  $('#tb-negrito').addEventListener('click', () => exec('bold'));
  $('#tb-fonte').addEventListener('change', e => exec('fontName', FONTS[e.target.value]));
  $('#tb-tamanho').addEventListener('change', e => applySize(Math.min(Number(e.target.value), MAX_FONT)));
  $$('[data-fore]').forEach(b => b.addEventListener('click', () => exec('foreColor', b.dataset.fore === 'auto' ? '#010203' : b.dataset.fore)));
  $('#tb-cor-livre').addEventListener('change', e => exec('foreColor', e.target.value));
  $$('[data-hl]').forEach(b => b.addEventListener('click', () => exec('hiliteColor', b.dataset.hl)));
  $('#tb-checklist').addEventListener('click', toggleChecklist);
  $('#tb-secao').addEventListener('click', toggleSection);
  $('#tb-postit').addEventListener('click', addPostit);
  $('#tb-imagem').addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) await addImageFile(f);
  });

  // Transforma a linha do cursor em item de checklist ou volta ao normal, usando só uma classe para o marcador ficar alinhado à pauta (H3, H5).
  function toggleChecklist() {
    if (!restoreSelection()) { noSelection(); return; }
    const block = ensureBlock();
    if (!block) return;
    const on = block.classList.toggle('chk-line');
    if (on) block.classList.remove('sec-title');
    else block.removeAttribute('data-done');
    afterEdit();
  }

  // Marca ou desmarca a linha como título de seção, que entra sozinho no sumário clicável, e explica o resultado, inclusive quando a linha ainda está vazia (H1, H9, requisito do sumário).
  function toggleSection() {
    if (!restoreSelection()) { noSelection(); return; }
    const block = ensureBlock();
    if (!block) return;
    const on = block.classList.toggle('sec-title');
    if (on) { block.classList.remove('chk-line'); block.removeAttribute('data-done'); }
    afterEdit();
    $('#tb-secao').setAttribute('aria-pressed', String(on));
    toast(on
      ? (block.textContent.trim() ? 'Linha marcada como título de seção. Ela já aparece no sumário.' : 'Escreva o título nesta linha. Ele aparece no sumário assim que tiver texto.')
      : 'A linha voltou a ser texto comum e saiu do sumário.');
  }

  // Marca ou desmarca o item de checklist como concluído, trocando um atributo que o CSS usa para riscar e preencher o círculo (H1 visibilidade).
  function toggleDone(block) {
    if (block.dataset.done === 'true') block.removeAttribute('data-done');
    else block.setAttribute('data-done', 'true');
    scheduleSave();
  }

  // ---------- Miolo do caderno: comportamento das zonas de texto ----------

  // Configura cada zona com defesas e atalhos, mantendo a escrita limpa e dentro da página, sem depender de memorizar regras (H3, H5, H7).
  document.execCommand('defaultParagraphSeparator', false, 'div');
  Object.values(ZONES).forEach(zone => {
    // Normaliza a cada digitação, recompõe espaçadores apagados sem querer, resolve o transbordo e agenda o salvamento, para nada quebrar a pauta nem se perder (H1, H5).
    zone.addEventListener('input', () => {
      hold = false;
      normalizeZone(zone, false);
      if ($$(':scope > .flow', zone).length !== (zone._n || 0)) reflowAll(true);
      markEmpty(zone);
      const handled = zone === ZONES.notes ? resolveOverflow() : guardOverflow(zone);
      if (!handled) scheduleSave();
    });

    // Cola imagens como objetos da página e texto sempre como texto puro, para formatações de fora nunca quebrarem a linha de 32px (H5, Baseline Lock).
    zone.addEventListener('paste', e => {
      e.preventDefault();
      const cd = e.clipboardData || window.clipboardData;
      const img = cd && [...cd.files].find(f => f.type.startsWith('image/'));
      if (img) { addImageFile(img); return; }
      document.execCommand('insertText', false, cd.getData('text/plain'));
    });

    // Bloqueia soltar conteúdo rico dentro do texto, pois arquivos de imagem são tratados pela folha como objetos, e o resto quebraria a formatação (H5).
    zone.addEventListener('drop', e => e.preventDefault());

    // Alterna o item de checklist ao clicar na área do círculo, a faixa de 28px à esquerda da linha, sem inserir elementos extras (H6, H7).
    zone.addEventListener('click', e => {
      const t = e.target;
      if (t.classList && t.classList.contains('chk-line') && e.offsetX <= 28) toggleDone(t);
    });

    // Trata Enter em checklist e título: continua a lista, sai dela em linha vazia, conclui com Ctrl+Enter e não herda a marca de título na linha nova, no ritmo de quem digita (H7 eficiência).
    zone.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      activeZone = zone;
      const block = currentBlock(zone);
      if (!block) return;
      const isChk = block.classList.contains('chk-line'), isSec = block.classList.contains('sec-title');
      if (!isChk && !isSec) return;
      if (isChk && (e.ctrlKey || e.metaKey)) { e.preventDefault(); toggleDone(block); return; }
      if (isChk && !block.textContent.trim()) {
        e.preventDefault();
        block.classList.remove('chk-line');
        block.removeAttribute('data-done');
        scheduleSave();
        return;
      }
      setTimeout(() => {
        const nb = currentBlock(zone);
        if (nb && nb !== block) { nb.removeAttribute('data-done'); if (isSec) nb.classList.remove('sec-title'); }
      }, 0);
    });
  });

  // ---------- Objetos: post-its e imagens com snap-to-line ----------

  // Calcula o tamanho útil da área de escrita, com valores de reserva quando a folha está escondida, para limitar posições e tamanhos sem quebrar no sumário (H5 prevenção de erros).
  const dims = () => ({ W: bodyEl.clientWidth || 778, H: bodyEl.clientHeight || ROW * 20 });

  // Devolve a página aberta e a lista dos seus objetos, para as demais funções não repetirem a mesma consulta (legibilidade).
  const curPage = () => ed.c.paginas[ed.i];
  const allObjs = p => [...(p.postits || []), ...(p.imagens || [])];
  const objectsOf = p => allObjs(p).map(o => ({ x: o.x, y: o.y, w: o.w, h: o.h }));

  // Corrige qualquer objeto vindo do armazenamento para tamanhos em linhas inteiras, posição dentro da folha e cores válidas, protegendo o editor de dados antigos ou alterados (H5).
  function normalizeObj(o, tipo) {
    const { W, H } = dims();
    o.tipo = tipo;
    o.h = clamp(Math.round((o.h || 4 * ROW) / ROW) * ROW, ROW, H);
    o.w = clamp(Math.round(o.w || 150), 48, W);
    o.x = clamp(Math.round(o.x || 0), 0, W - o.w);
    o.y = clamp(Math.round((o.y || 0) / ROW) * ROW, 0, H - o.h);
    if (tipo === 'postit') { if (!/^#[0-9a-f]{6}$/i.test(o.cor || '')) o.cor = POSTIT_COLORS[0].hex; o.texto = String(o.texto || ''); }
    else { if (!/^data:image\//.test(o.src || '')) o.src = ''; if (!/^#[0-9a-f]{6}$/i.test(o.fita || '')) o.fita = ''; o.ratio = o.ratio > 0 ? o.ratio : 1; }
    return o;
  }

  // Posiciona o elemento do objeto pelas coordenadas e vira a barra de ações para a esquerda quando o objeto está na metade direita, evitando que ela saia da folha (H5).
  function place(el, o) {
    el.style.left = o.x + 'px';
    el.style.top = o.y + 'px';
    el.style.width = o.w + 'px';
    el.style.height = o.h + 'px';
    $('.obj-bar', el)?.classList.toggle('bar-right', o.x > dims().W / 2);
  }

  // Seleciona um objeto, mostrando o contorno e a barra de ações dele, e desmarca os outros, para ficar claro com qual deles o usuário está mexendo (H1).
  function selectObj(id) {
    selId = id;
    $$('.obj', layer).forEach(el => el.classList.toggle('sel', el.id === 'obj-' + id));
  }
  document.addEventListener('pointerdown', e => { if (ed && !e.target.closest('.obj')) selectObj(null); });

  // Reduz a fonte do post-it de 18px até 9px até o texto caber, e devolve se coube, para a escrita nunca vazar do quadrado (requisito de auto-resize).
  function fitText(el) {
    let fs = 18;
    el.style.fontSize = fs + 'px';
    while (fs > 9 && el.scrollHeight > el.clientHeight + 1) { fs--; el.style.fontSize = fs + 'px'; }
    return el.scrollHeight <= el.clientHeight + 1;
  }

  // Procura a primeira linha livre onde o objeto não bate em outro, começando pela segunda linha da página, para novos objetos não nascerem empilhados (H5).
  function freeY(p, o) {
    const { H } = dims();
    const others = allObjs(p);
    for (let y = ROW; y + o.h <= H; y += ROW) {
      if (!others.some(q => o.x < q.x + q.w && o.x + o.w > q.x && y < q.y + q.h && y + o.h > q.y)) return y;
    }
    return ROW;
  }

  // Aplica a mudança de objetos: recalcula o recuo do texto, resolve o transbordo se o texto passou do fim e agenda o salvamento, o ciclo completo do motor (requisito anticolisão).
  function settleObjects() {
    reflowAll();
    if (!resolveOverflow()) scheduleSave();
  }

  // Desenha todos os objetos da página aberta na camada, ajustando a fonte dos post-its, para a tela refletir exatamente os dados salvos (H1).
  function renderObjects() {
    const p = curPage();
    p.postits.forEach(o => normalizeObj(o, 'postit'));
    p.imagens.forEach(o => normalizeObj(o, 'imagem'));
    layer.replaceChildren(guide, ...allObjs(p).map(buildObj));
    $$('.pit-text', layer).forEach(fitText);
    selId = null;
  }

  // Monta a barra de ações do objeto: cores ou fita, diminuir, aumentar e remover, sempre com rótulo e dica, dentro do alcance do objeto selecionado (H6, H7).
  function buildBar(o, el) {
    const btn = (label, ic, fn) => h('button', { type: 'button', class: 'obj-btn', 'aria-label': label, title: label, onclick: fn }, icon(ic));
    const bar = h('div', { class: 'obj-bar', role: 'toolbar', 'aria-label': 'Ações do objeto' });
    if (o.tipo === 'postit') {
      POSTIT_COLORS.forEach(c => bar.append(h('button', {
        type: 'button', class: 'sw', style: 'background:' + c.hex, 'aria-label': 'Cor do post-it: ' + c.nome, title: c.nome,
        onclick: () => { o.cor = c.hex; el.style.background = c.hex; scheduleSave(); }
      })));
    } else {
      const tapeBtn = btn('Fita adesiva decorativa. Clique para trocar a cor ou remover.', 'tape', () => cycleTape(o, el, tapeBtn));
      tapeBtn.setAttribute('aria-pressed', String(Boolean(o.fita)));
      bar.append(tapeBtn);
    }
    bar.append(btn('Diminuir uma linha', 'minus', () => resizeObj(o, -1)), btn('Aumentar uma linha', 'plus', () => resizeObj(o, 1)), btn('Remover', 'trash', () => deleteObj(o)));
    return bar;
  }

  // Troca a fita do topo da imagem entre as cores da paleta e nenhuma, criando ou removendo o elemento decorativo, e salva (requisito de washi tape).
  function cycleTape(o, el, btn) {
    o.fita = TAPES[(TAPES.indexOf(o.fita || '') + 1) % TAPES.length];
    let t = $('.obj-tape', el);
    if (o.fita) {
      if (!t) { t = h('span', { class: 'obj-tape' }); el.append(t); }
      t.style.background = o.fita;
    } else if (t) t.remove();
    btn.setAttribute('aria-pressed', String(Boolean(o.fita)));
    scheduleSave();
  }

  // Cria o elemento de um objeto, post-it com faixa de arraste e texto editável ou imagem com fita, ligando arrastar, selecionar e teclado (requisitos de post-it e imagem).
  function buildObj(o) {
    const isPit = o.tipo === 'postit';
    const el = h('div', { class: 'obj ' + (isPit ? 'pit' : 'img-obj'), id: 'obj-' + o.id, tabindex: '0', role: 'group', 'aria-label': isPit ? 'Post-it' : 'Imagem colada' });
    if (isPit) {
      el.style.background = o.cor;
      const grip = h('div', { class: 'pit-grip', title: 'Arraste para mover o post-it', 'aria-hidden': 'true' }, h('span', { class: 'grip-dots' }));
      const text = h('div', { class: 'pit-text', contenteditable: 'true', role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Texto do post-it', 'data-ph': 'Escreva uma nota' });
      text.textContent = o.texto;
      grip.addEventListener('pointerdown', e => startDrag(e, o, el));
      text.addEventListener('input', () => {
        o.texto = text.innerText.replace(/\n$/, '');
        if (!fitText(text)) {
          document.execCommand('undo');
          o.texto = text.innerText.replace(/\n$/, '');
          toast('Este post-it está cheio. Use o botão + para aumentá-lo.');
        }
        scheduleSave();
      });
      text.addEventListener('paste', e => {
        e.preventDefault();
        document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain'));
      });
      el.append(grip, text);
    } else {
      const img = h('img', { src: o.src, alt: 'Imagem colada na página', draggable: 'false' });
      img.addEventListener('pointerdown', e => startDrag(e, o, el));
      el.append(img);
      if (o.fita) el.append(h('span', { class: 'obj-tape', style: 'background:' + o.fita }));
    }
    el.append(buildBar(o, el));
    place(el, o);
    el.addEventListener('focusin', () => selectObj(o.id));
    el.addEventListener('pointerdown', () => selectObj(o.id));
    el.addEventListener('keydown', e => objKey(e, o, el));
    return el;
  }

  // Move, remove ou desmarca o objeto pelo teclado quando ele mesmo está em foco, setas por linha ou 10 pixels, dando a mesma função do mouse a quem não o usa (H7, acessibilidade).
  function objKey(e, o, el) {
    if (e.target !== el) return;
    const { W, H } = dims();
    const big = e.shiftKey ? 4 : 1;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteObj(o); return; }
    if (e.key === 'Escape') { selectObj(null); return; }
    if (e.key === 'ArrowUp') o.y = clamp(o.y - ROW, 0, H - o.h);
    else if (e.key === 'ArrowDown') o.y = clamp(o.y + ROW, 0, H - o.h);
    else if (e.key === 'ArrowLeft') o.x = clamp(o.x - 10 * big, 0, W - o.w);
    else if (e.key === 'ArrowRight') o.x = clamp(o.x + 10 * big, 0, W - o.w);
    else return;
    e.preventDefault();
    place(el, o);
    settleObjects();
  }

  // Arrasta o objeto com o ponteiro: ele segue a mão, o guia mostra as linhas do encaixe, o texto recua ao vivo e ao soltar o objeto trava no múltiplo de 32px (requisito de snap-to-line).
  function startDrag(e, o, el) {
    if (e.button !== 0) return;
    e.preventDefault();
    selectObj(o.id);
    const { W, H } = dims();
    const start = { px: e.clientX, py: e.clientY, x: o.x, y: o.y };
    el.setPointerCapture(e.pointerId);
    el.classList.add('dragging');
    guide.hidden = false;
    guide.style.top = o.y + 'px';
    guide.style.height = o.h + 'px';
    const move = ev => {
      const rawX = clamp(start.x + (ev.clientX - start.px) / scale, 0, W - o.w);
      const rawY = clamp(start.y + (ev.clientY - start.py) / scale, 0, H - o.h);
      o.x = Math.round(rawX);
      o.y = clamp(Math.round(rawY / ROW) * ROW, 0, H - o.h);
      el.style.left = o.x + 'px';
      el.style.top = rawY + 'px';
      guide.style.top = o.y + 'px';
      requestFlow();
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.classList.remove('dragging');
      guide.hidden = true;
      place(el, o);
      settleObjects();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  // Aumenta ou diminui o objeto uma linha por vez, mantendo altura em múltiplos de 32px, proporção da imagem e limites da folha, e avisa quando chega ao limite (H1, H9).
  function resizeObj(o, delta) {
    const el = $('#obj-' + o.id);
    const rows = o.h / ROW + delta;
    const { W, H } = dims();
    if (o.tipo === 'postit') {
      if (rows < 2 || rows > 10) { toast(rows < 2 ? 'Este é o menor tamanho do post-it.' : 'Este é o maior tamanho do post-it.'); return; }
      o.h = rows * ROW;
      o.w = 110 + rows * 10;
    } else {
      const w = Math.round(rows * ROW * o.ratio);
      if (rows < 1 || w < 48) { toast('Esta é a menor imagem possível.'); return; }
      if (rows > 18 || w > 560) { toast('Esta é a maior imagem possível.'); return; }
      o.h = rows * ROW;
      o.w = w;
    }
    o.x = clamp(o.x, 0, W - o.w);
    o.y = clamp(o.y, 0, H - o.h);
    place(el, o);
    const text = $('.pit-text', el);
    if (text) fitText(text);
    settleObjects();
  }

  // Remove o objeto da página oferecendo Desfazer, devolvendo-o à mesma posição da lista, igual ao padrão do resto do app (H3, H5).
  function deleteObj(o) {
    const p = curPage();
    const arr = o.tipo === 'postit' ? p.postits : p.imagens;
    const i = arr.indexOf(o);
    if (i < 0) return;
    arr.splice(i, 1);
    renderObjects();
    settleObjects();
    toast(o.tipo === 'postit' ? 'Post-it removido.' : 'Imagem removida.', {
      label: 'Desfazer',
      onClick: () => {
        arr.splice(i, 0, o);
        if (ed && !ed.toc && curPage() === p) { renderObjects(); settleObjects(); } else saveData();
      }
    });
  }

  // Cola um post-it novo na lateral direita, na primeira linha livre, com cor da paleta e foco no texto, pronto para escrever (H7, requisito de post-it).
  function addPostit() {
    if (!ed || ed.toc) return;
    const p = curPage(), rows = 4, w = 110 + rows * 10, { W } = dims();
    const o = { id: uid(), tipo: 'postit', x: W - w - 24, y: 0, w, h: rows * ROW, cor: POSTIT_COLORS[p.postits.length % POSTIT_COLORS.length].hex, texto: '' };
    o.y = freeY(p, o);
    p.postits.push(o);
    renderObjects();
    selectObj(o.id);
    $('#obj-' + o.id + ' .pit-text')?.focus();
    settleObjects();
    toast('Post-it criado. Arraste pela faixa de cima: ele encaixa nas linhas e o texto recua 1 cm.');
  }

  // Lê o arquivo de imagem, reduz o lado maior a 720px e o recodifica, mantendo PNG e GIF com transparência e JPEG nos demais, para caber no armazenamento do navegador (H5, performance).
  async function readImage(file) {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error('tipo');
    const url = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const s = Math.min(1, 720 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * s));
    c.height = Math.max(1, Math.round(img.naturalHeight * s));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const keepAlpha = file.type === 'image/png' || file.type === 'image/gif';
    return { src: c.toDataURL(keepAlpha ? 'image/png' : 'image/jpeg', 0.82), ratio: c.width / c.height };
  }

  // Cola a imagem na página com altura em linhas inteiras, no ponto solto ou na primeira linha livre, para o encaixe valer desde o primeiro instante (requisito de upload e snap).
  async function addImageFile(file, at) {
    if (!ed || ed.toc) return;
    try {
      const { src, ratio } = await readImage(file);
      const p = curPage(), { W, H } = dims();
      let rows = clamp(Math.round(240 / ratio / ROW), 1, 18);
      let w = Math.round(rows * ROW * ratio);
      while (w > 560 && rows > 1) { rows--; w = Math.round(rows * ROW * ratio); }
      const o = { id: uid(), tipo: 'imagem', src, ratio, fita: '', w, h: rows * ROW, x: W - w - 24, y: 0 };
      if (at) {
        o.x = clamp(Math.round(at.x - w / 2), 0, W - w);
        o.y = clamp(Math.round((at.y - o.h / 2) / ROW) * ROW, 0, H - o.h);
      } else {
        o.y = freeY(p, o);
      }
      p.imagens.push(o);
      renderObjects();
      selectObj(o.id);
      toast('Imagem colada. Arraste para mover: ela encaixa nas linhas e o texto recua 1 cm.');
      settleObjects();
    } catch {
      toast('Não consegui abrir essa imagem. Use um arquivo PNG, JPG, WEBP ou GIF.');
    }
  }

  // Aceita imagens arrastadas do computador para a folha, calculando o ponto de soltura pela escala atual, outra forma de fazer a mesma tarefa (H7 flexibilidade).
  sheet.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  sheet.addEventListener('drop', e => {
    const f = e.dataTransfer && [...e.dataTransfer.files].find(x => x.type.startsWith('image/'));
    if (!f) return;
    e.preventDefault();
    const r = bodyEl.getBoundingClientRect();
    addImageFile(f, { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale });
  });

  // Ajusta a escala da folha ou do sumário de 780px para caber na largura da tela e reserva o espaço já reduzido, mantendo o texto quebrando igual em qualquer aparelho (UX responsivo, Baseline Lock).
  function fitSheet() {
    const avail = document.documentElement.clientWidth - 40 - 48;
    scale = Math.min(1, Math.max(0.3, avail / 780));
    scaleEl.style.transform = scale < 1 ? 'scale(' + scale + ')' : '';
    fit.style.width = Math.round(780 * scale) + 'px';
    const visible = ed && ed.toc ? tocSheet : sheet;
    fit.style.height = Math.round(visible.offsetHeight * scale) + 'px';
  }
  window.addEventListener('resize', () => { if (ed) fitSheet(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (ed) { reflowAll(true); fitSheet(); } });

  // ---------- Sumário dinâmico ----------

  // Lê o HTML salvo de todas as páginas e lista os títulos de seção com texto, na ordem do caderno, incluindo as zonas do Cornell só nas páginas Cornell, para o sumário nunca mostrar algo escondido (requisito do sumário automático).
  function tocEntries() {
    const out = [];
    ed.c.paginas.forEach((p, i) => {
      const cornell = (p.folha || ed.c.folha || 'pauta') === 'cornell';
      let ord = 0;
      [cornell ? p.cue : '', p.html, cornell ? p.summary : ''].forEach(html => {
        const tpl = document.createElement('template');
        tpl.innerHTML = html || '';
        tpl.content.querySelectorAll('.sec-title').forEach(b => {
          const txt = b.textContent.replace(/\s+/g, ' ').trim();
          if (txt) out.push({ titulo: txt, pagina: i + 1, ord: ord++ });
        });
      });
    });
    return out;
  }

  // Desenha as linhas do sumário como links com título, pontilhado e número da página, ou uma explicação quando está vazio, servindo tanto à tela quanto ao PDF (H6, H10, requisito de link clicável).
  function fillToc(box, entries, hrefOf, onPick) {
    if (!entries.length) {
      box.replaceChildren(h('p', { class: 'toc-empty' }, 'Ainda não há títulos de seção. Marque uma linha com o botão Título de seção e ela aparece aqui, com link para a página.'));
      return;
    }
    box.replaceChildren(...entries.map(e => h('a', { class: 'toc-row', href: hrefOf(e), title: 'Ir para a página ' + e.pagina, onclick: () => { if (onPick) onPick(e); } },
      h('span', { class: 'toc-title' }, e.titulo),
      h('span', { class: 'toc-dots', 'aria-hidden': 'true' }),
      h('span', { class: 'toc-num' }, String(e.pagina)))));
  }

  // Atualiza o texto da aba do sumário com a quantidade de títulos, para o usuário ver que marcar uma linha já alimentou o índice sem abri-lo (H1 visibilidade).
  function updateTocBadge() {
    const tab = $('#tab-toc');
    if (!tab || !ed) return;
    const n = tocEntries().length;
    const label = n ? 'Sumário, ' + plural(n, 'título de seção', 'títulos de seção') : 'Sumário, ainda sem títulos de seção';
    tab.title = label;
    tab.setAttribute('aria-label', label);
  }

  // Lista os blocos de título de seção visíveis na folha, na mesma ordem do sumário, para localizar o título que o link do sumário abriu (requisito de link direto).
  const secBlocks = () => Object.values(ZONES).filter(z => z.offsetParent !== null).flatMap(z => $$('.sec-title', z)).filter(b => b.textContent.trim());

  // Faz o título aberto pelo sumário brilhar por instantes, para o usuário ver exatamente onde o link o levou (H1 visibilidade).
  function flashSection(ord) {
    const b = secBlocks()[ord];
    if (!b) return;
    b.classList.remove('sec-flash');
    void b.offsetWidth;
    b.classList.add('sec-flash');
    setTimeout(() => b.classList.remove('sec-flash'), 1900);
  }

  // Mostra a página de Contents no início do caderno, salvando antes o que está aberto e montando a lista com links para as páginas, sem criar uma página de verdade que atrapalhe a numeração (requisito do sumário).
  function showToc() {
    if (!ed) return;
    flushSave();
    ed.toc = true;
    selectObj(null);
    sheet.hidden = true;
    tocSheet.hidden = false;
    $('#toolbar-wrap').hidden = true;
    $('.toc-crumb', tocSheet).textContent = ed.m.nome + ' / ' + ed.c.titulo;
    fillToc($('#toc-list'), tocEntries(), e => '#/caderno/' + ed.c.id + '/' + e.pagina, e => { pendingSec = { i: e.pagina - 1, ord: e.ord }; });
    history.replaceState(null, '', '#/caderno/' + ed.c.id + '/sumario');
    document.title = 'Sumário | ' + ed.c.titulo;
    updatePageChrome();
    fitSheet();
  }

  // ---------- Miolo do caderno: páginas, abas e salvamento ----------

  // Mostra o estado do salvamento em texto curto, para o usuário saber se o que digitou já está guardado (H1 visibilidade do status).
  const setSaveStatus = text => { $('#save-status-text').textContent = text; };

  // Copia o conteúdo das zonas para os dados da página, guardando HTML para reabrir igual e texto puro para a busca global achar, exceto no sumário, onde nada é editado (requisito da busca).
  function collectPage() {
    if (!ed || ed.toc) return;
    const p = curPage();
    p.html = serializeZone(ZONES.notes);
    p.cue = serializeZone(ZONES.cue);
    p.summary = serializeZone(ZONES.summary);
    p.texto = [ZONES.cue, ZONES.notes, ZONES.summary].map(z => z.innerText.trim()).filter(Boolean).join('\n');
  }

  // Grava o caderno, atualiza o sumário e confirma com a hora, ou avisa claramente se o navegador recusou por falta de espaço, para nada se perder em silêncio (H1, H5, H9).
  function flushSave() {
    clearTimeout(saveTimer);
    if (!ed) return;
    collectPage();
    const ok = saveData();
    setSaveStatus(ok ? 'Salvo às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Não foi possível salvar');
    if (!ok && !warnedFull) toast('O armazenamento do navegador está cheio. Remova imagens grandes ou libere espaço para continuar salvando.');
    warnedFull = !ok;
    updateTocBadge();
  }

  // Agenda o salvamento 500 ms após a última digitação, agrupando teclas para não gravar a cada letra e avisando "Salvando..." (H1, performance).
  function scheduleSave() {
    setSaveStatus('Salvando...');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 500);
  }
  window.addEventListener('beforeunload', flushSave);
  window.addEventListener('pagehide', flushSave);

  // Desenha a aba do sumário no topo e as abas numeradas das páginas, cada uma num tom derivado da cor da capa, destacando a atual, para acesso rápido a qualquer ponto do caderno (H1, H7, H6).
  function renderTabs() {
    const nav = $('#tabs');
    const shades = [0, 0.3, 0.5, 0.15, 0.4, 0.6];
    const tocTab = h('button', { type: 'button', id: 'tab-toc', class: 'tab-page' + (ed.toc ? ' on' : ''), style: '--tab:#896645;color:#FFFFFF', 'aria-current': ed.toc ? 'page' : false, onclick: showToc }, icon('list'));
    nav.replaceChildren(tocTab, ...ed.c.paginas.map((p, i) => {
      const hex = mixHex(ed.c.cor, '#FFFFFF', shades[i % shades.length]);
      const on = !ed.toc && i === ed.i;
      return h('button', { type: 'button', class: 'tab-page' + (on ? ' on' : ''), style: '--tab:' + hex + ';color:' + inkFor(hex), 'aria-label': 'Ir para a página ' + (i + 1), 'aria-current': on ? 'page' : false, title: 'Página ' + (i + 1), onclick: () => goPage(i) }, String(i + 1));
    }));
    updateTocBadge();
    const cur = $('.on', nav);
    if (cur) nav.scrollTop = cur.offsetTop - nav.clientHeight / 2;
  }

  // Atualiza número, indicador, botões e abas conforme a página atual, o total e o modo sumário, mantendo os controles coerentes com o que está na tela (H1 visibilidade).
  function updatePageChrome() {
    const c = ed.c;
    $('#sheet-num').textContent = 'Página ' + (ed.i + 1);
    $('#page-ind').textContent = ed.toc ? 'Sumário' : 'Página ' + (ed.i + 1) + ' de ' + c.paginas.length;
    $('#pg-prev').disabled = ed.toc;
    $('#pg-next').disabled = !ed.toc && ed.i === c.paginas.length - 1;
    $('#pg-new').disabled = ed.toc;
    $('#pg-del').disabled = ed.toc || c.paginas.length <= 1;
    $('#pg-del').title = c.paginas.length <= 1 ? 'Um caderno precisa ter pelo menos uma página' : 'Excluir página atual';
    renderTabs();
  }

  // Carrega a página atual na folha: modo de escrita, fundo, zonas, objetos, recuo, indicadores e endereço, e pisca o título aberto pelo sumário, deixando a tela fiel aos dados (H1, H4).
  function loadPage(focus) {
    const c = ed.c, p = c.paginas[ed.i];
    p.postits = p.postits || [];
    p.imagens = p.imagens || [];
    ed.toc = false;
    sheet.hidden = false;
    tocSheet.hidden = true;
    $('#toolbar-wrap').hidden = false;
    const folha = p.folha || c.folha || 'pauta';
    sheet.className = 'sheet f-' + folha;
    $('#tb-folha').value = folha;
    ZONES.notes.innerHTML = sanitize(p.html);
    ZONES.cue.innerHTML = sanitize(p.cue);
    ZONES.summary.innerHTML = sanitize(p.summary);
    $('#sheet-crumb').textContent = ed.m.nome + ' / ' + c.titulo;
    history.replaceState(null, '', '#/caderno/' + c.id + '/' + (ed.i + 1));
    document.title = c.titulo + ' | Mochila Inteligente';
    savedRange = null;
    activeZone = null;
    hold = false;
    updatePageChrome();
    fitSheet();
    reflowAll(true);
    renderObjects();
    if (focus) ZONES.notes.focus();
    if (pendingSec && pendingSec.i === ed.i) flashSection(pendingSec.ord);
    pendingSec = null;
  }

  // Abre o caderno pelo id e página da rota, ou direto no sumário, devolvendo falso se não existir, para o roteador avisar em vez de mostrar tela vazia (H9).
  function openEditor(id, pageIdx, toc) {
    const found = findCaderno(id);
    if (!found) return false;
    ed = { m: found.m, c: found.c, i: 0, toc: false };
    ed.c.paginas.forEach(p => { if (!p.id) p.id = uid(); });
    ed.i = clamp(pageIdx || 0, 0, ed.c.paginas.length - 1);
    $('#ed-titulo').textContent = ed.c.titulo;
    $('#ed-materia').textContent = ed.m.nome;
    setSaveStatus('Salvo');
    loadPage(false);
    if (toc) showToc();
    return true;
  }

  // Troca de página salvando a atual antes, inclusive saindo do sumário, para a navegação nunca custar texto, e mantendo um limite seguro de índices (H5).
  function goPage(i) {
    if (!ed || i < 0 || i >= ed.c.paginas.length || (i === ed.i && !ed.toc)) return;
    flushSave();
    ed.i = i;
    loadPage(false);
  }

  // Anda uma página para trás ou para frente tratando o sumário como a página zero do caderno, para anterior e próxima sempre fazerem o que o usuário espera (H4 consistência).
  function stepPage(d) {
    if (!ed) return;
    if (ed.toc) { if (d > 0) goPage(0); return; }
    if (ed.i + d < 0) { showToc(); return; }
    goPage(ed.i + d);
  }

  // Cria uma página nova logo depois da atual, com a folha padrão do caderno, e leva o cursor a ela, pronta para escrever (H7, H1).
  function newPage() {
    if (!ed || ed.toc) return;
    flushSave();
    ed.c.paginas.splice(ed.i + 1, 0, blankPage(ed.c));
    ed.i += 1;
    saveData();
    loadPage(true);
    toast('Página ' + (ed.i + 1) + ' criada.');
  }

  // Exclui a página atual oferecendo Desfazer, mantendo sempre ao menos uma página no caderno, igual ao padrão do armário (H3, H5).
  function deletePage() {
    if (!ed || ed.toc || ed.c.paginas.length <= 1) return;
    flushSave();
    const c = ed.c, at = ed.i;
    const [removed] = c.paginas.splice(at, 1);
    ed.i = Math.min(at, c.paginas.length - 1);
    saveData();
    loadPage(false);
    toast('Página ' + (at + 1) + ' excluída.', {
      label: 'Desfazer',
      onClick: () => {
        c.paginas.splice(at, 0, removed);
        saveData();
        if (ed && ed.c === c) { ed.i = at; loadPage(false); }
      }
    });
  }

  $('#pg-prev').addEventListener('click', () => stepPage(-1));
  $('#pg-next').addEventListener('click', () => stepPage(1));
  $('#pg-new').addEventListener('click', newPage);
  $('#pg-del').addEventListener('click', deletePage);

  // Troca o fundo só da página atual e recusa a troca se o texto não couber no novo layout, explicando o motivo e mantendo o fundo anterior (H5, H9).
  $('#tb-folha').addEventListener('change', e => {
    if (!ed || ed.toc) return;
    const p = curPage();
    const before = p.folha || ed.c.folha || 'pauta', next = e.target.value;
    sheet.className = 'sheet f-' + next;
    const over = Object.values(ZONES).some(z => z.offsetParent !== null && overflows(z));
    if (over) {
      sheet.className = 'sheet f-' + before;
      e.target.value = before;
      toast('O texto desta página não cabe nesse fundo. Mantive "' + FOLHAS[before] + '".');
      return;
    }
    p.folha = next;
    reflowAll(true);
    saveData();
    updateTocBadge();
    const hidden = before === 'cornell' && next !== 'cornell' && (ZONES.cue.innerText.trim() || ZONES.summary.innerText.trim());
    toast('Fundo alterado para ' + FOLHAS[next] + '.' + (hidden ? ' Os tópicos e o resumo ficam guardados e voltam no Cornell.' : ''));
  });

  // ---------- Exportação em PDF ----------

  // Guarda a área de impressão, o diálogo, o formulário e o estado da impressão em andamento, usados por todas as funções de exportação.
  const printRoot = $('#print-root');
  const dlgPdf = $('#dlg-pdf');
  const fp = $('#form-pdf');
  let printing = false;
  let printTimer;

  // Calcula as páginas a exportar pelo escopo escolhido (todas, atual ou intervalo) e diz se o plano é válido, base do resumo e da geração (H1, H5).
  function pdfPlan() {
    const n = ed.c.paginas.length, esc = fp.elements.escopo.value;
    let from = 0, to = n - 1;
    if (esc === 'atual') from = to = ed.toc ? 0 : ed.i;
    if (esc === 'intervalo') { from = Number(fp.elements.de.value) - 1; to = Number(fp.elements.ate.value) - 1; }
    const valid = Number.isInteger(from) && Number.isInteger(to) && from >= 0 && to < n && from <= to;
    return { from, to, valid };
  }

  // Sincroniza o formulário: habilita o intervalo só quando escolhido, sugere valores iniciais e reescreve o resumo do que será exportado, para o usuário ver o efeito antes de confirmar (H1, H5, H6).
  function syncPdfForm() {
    const n = ed.c.paginas.length;
    const range = fp.elements.escopo.value === 'intervalo';
    fp.elements.de.disabled = !range;
    fp.elements.ate.disabled = !range;
    if (range && !fp.elements.de.value) { fp.elements.de.value = ed.toc ? 1 : ed.i + 1; fp.elements.ate.value = n; }
    const plan = pdfPlan();
    const toc = fp.elements.toc.checked && !fp.elements.toc.disabled;
    $('#pdf-resumo').textContent = plan.valid
      ? plural(plan.to - plan.from + 1, 'página', 'páginas') + ' (da ' + (plan.from + 1) + ' à ' + (plan.to + 1) + ')' + (toc ? ', com sumário.' : '.')
      : 'Digite um intervalo válido para ver o resumo.';
  }

  // Abre o diálogo de exportação com valores sensatos: todas as páginas, sumário ligado quando há títulos e opção da página atual desativada no sumário, poupando decisões ao usuário (H5, H6, H7).
  function openPdfDialog() {
    if (!ed || $('dialog[open]')) return;
    flushSave();
    const n = ed.c.paginas.length;
    fp.reset();
    $$('[data-rule]', fp).forEach(i => setFieldError(i, ''));
    fp.elements.de.max = n;
    fp.elements.ate.max = n;
    fp.elements.de.value = '';
    fp.elements.ate.value = '';
    $('#pdf-escopo-atual').disabled = ed.toc;
    const entries = tocEntries();
    fp.elements.toc.disabled = entries.length === 0;
    fp.elements.toc.checked = entries.length > 0;
    $('#pdf-toc-hint').textContent = entries.length
      ? plural(entries.length, 'título de seção será listado', 'títulos de seção serão listados') + ' com links para as páginas.'
      : 'Marque linhas como título de seção para gerar o sumário.';
    syncPdfForm();
    dlgPdf.showModal();
  }

  $('#btn-pdf').addEventListener('click', openPdfDialog);
  fp.addEventListener('change', e => {
    syncPdfForm();
    if (e.target.name === 'escopo' && e.target.value === 'intervalo') fp.elements.de.focus();
  });
  fp.addEventListener('input', e => {
    syncPdfForm();
    if (e.target.name === 'de' && fp.elements.ate.getAttribute('aria-invalid') === 'true') checkField(fp.elements.ate);
  });

  // Cria a versão estática de um objeto para o PDF, sem barra, edição nem arrasto, na mesma posição e tamanho da tela, para post-its e imagens saírem exatamente onde estão (requisito de fidelidade).
  function staticObj(o) {
    const isPit = o.tipo === 'postit';
    const el = h('div', { class: 'obj ' + (isPit ? 'pit' : 'img-obj') });
    el.style.cssText = 'left:' + o.x + 'px;top:' + o.y + 'px;width:' + o.w + 'px;height:' + o.h + 'px;pointer-events:none;';
    if (isPit) {
      el.style.background = o.cor;
      const t = h('div', { class: 'pit-text' });
      t.textContent = o.texto;
      el.append(h('div', { class: 'pit-grip' }, h('span', { class: 'grip-dots' })), t);
    } else {
      el.append(h('img', { src: o.src, alt: '' }));
      if (o.fita) el.append(h('span', { class: 'obj-tape', style: 'background:' + o.fita }));
    }
    return el;
  }

  // Monta uma página do PDF a partir dos dados salvos, com cabeçalho, zonas, fundo próprio e objetos, usando o molde limpo, para o PDF refletir a página e não a tela (requisito de fidelidade).
  function printPageEl(i) {
    const c = ed.c, p = c.paginas[i], folha = p.folha || c.folha || 'pauta';
    const s = shellTpl.cloneNode(true);
    s.className = 'sheet f-' + folha;
    s.id = 'pdf-p-' + (i + 1);
    const [crumb, num] = $('.sheet-head', s).children;
    crumb.textContent = ed.m.nome + ' / ' + c.titulo;
    num.textContent = 'Página ' + (i + 1);
    const zs = { cue: $('.zone-cue', s), notes: $('.zone-notes', s), summary: $('.zone-summary', s) };
    zs.cue.innerHTML = sanitize(p.cue);
    zs.notes.innerHTML = sanitize(p.html);
    zs.summary.innerHTML = sanitize(p.summary);
    const lay = $('.obj-layer', s);
    (p.postits || []).forEach(o => lay.append(staticObj(normalizeObj(o, 'postit'))));
    (p.imagens || []).forEach(o => lay.append(staticObj(normalizeObj(o, 'imagem'))));
    return { wrap: h('section', { class: 'pdf-page' }, s), s, zs, p };
  }

  // Monta uma página de sumário para o PDF com links internos para as páginas exportadas, para o índice continuar clicável no arquivo (requisito de links clicáveis).
  function printTocEl(chunk) {
    const s = tocTpl.cloneNode(true);
    $('.toc-crumb', s).textContent = ed.m.nome + ' / ' + ed.c.titulo;
    fillToc($('.toc-list', s), chunk, e => '#pdf-p-' + e.pagina);
    return h('section', { class: 'pdf-page' }, s);
  }

  // Constrói todo o conteúdo do PDF fora da tela: classe de tema claro, papel, escala para caber na folha, sumário filtrado pelo intervalo, páginas, recuo do texto e fonte dos post-its (requisitos de PDF).
  function buildPrint({ from, to, toc, lines, land }) {
    const pw = land ? 1122 : 794, ph = land ? 794 : 1122;
    const sheetH = sheet.offsetHeight || 706;
    printRoot.replaceChildren();
    printRoot.className = 'print-light ' + (land ? 'pdf-land' : 'pdf-port') + (lines ? '' : ' no-lines');
    printRoot.style.setProperty('--k', Math.min((pw - 24) / 780, (ph - 24) / sheetH).toFixed(4));
    const entries = toc ? tocEntries().filter(e => e.pagina - 1 >= from && e.pagina - 1 <= to) : [];
    for (let i = 0; i < entries.length; i += 17) printRoot.append(printTocEl(entries.slice(i, i + 17)));
    const built = [];
    for (let i = from; i <= to; i++) built.push(printPageEl(i));
    printRoot.append(...built.map(b => b.wrap));
    built.forEach(b => {
      applyFlow(b.zs, objectsOf(b.p), true);
      $$('.pit-text', b.s).forEach(fitText);
    });
  }

  // Encerra a impressão limpando a área de PDF e o tamanho de papel, chamado ao fechar a janela de impressão ou após um tempo limite, para não deixar páginas escondidas na memória (H5, performance).
  function endPrint() {
    if (!printing) return;
    printing = false;
    clearTimeout(printTimer);
    document.documentElement.classList.remove('is-printing');
    printRoot.replaceChildren();
    $('#print-page-style').textContent = '';
  }
  window.addEventListener('afterprint', endPrint);

  // Gera o PDF: monta as páginas, define o papel A4, ativa o modo de impressão e abre a janela do navegador, avisando antes qual opção escolher, e recuperando-se se algo falhar (H1, H9, H10).
  async function exportPdf(opts) {
    try {
      buildPrint(opts);
      $('#print-page-style').textContent = '@page { size: A4 ' + (opts.land ? 'landscape' : 'portrait') + '; margin: 0; }';
      document.documentElement.classList.add('is-printing');
      printing = true;
      toast('Preparando o PDF. Na janela de impressão, escolha Salvar como PDF.');
      clearTimeout(printTimer);
      printTimer = setTimeout(endPrint, 180000);
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      window.print();
    } catch {
      endPrint();
      toast('Não foi possível preparar o PDF. Tente de novo ou exporte um intervalo menor.');
    }
  }

  // Valida o formulário, fecha o diálogo e inicia a exportação com as escolhas feitas, sem dar passo em falso com intervalos inválidos (H5, H9).
  fp.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateForm(fp)) return;
    const plan = pdfPlan();
    if (!plan.valid) return;
    dlgPdf.close();
    await exportPdf({
      from: plan.from,
      to: plan.to,
      toc: fp.elements.toc.checked && !fp.elements.toc.disabled,
      lines: fp.elements.linhas.checked,
      land: fp.elements.papel.value === 'land'
    });
  });

  // ---------- Rotas por hash ----------

  // Mapeia cada rota fixa para o nome da tela, centralizando a navegação em uma tabela fácil de estender nas próximas etapas (H4 consistência).
  const ROUTES = { '': 'landing', '/': 'landing', '/login': 'auth', '/cadastro': 'auth', '/mochila': 'app' };
  let firstRender = true;

  // Interpreta a rota, incluindo a do caderno com número de página ou sumário, para cada página ter um endereço que dá para guardar e reabrir (H1, H3).
  function parseRoute(path) {
    const m = /^\/caderno\/([^/]+)(?:\/(\d+|sumario))?$/.exec(path);
    if (m) return { view: 'editor', id: m[1], toc: m[2] === 'sumario', page: m[2] && m[2] !== 'sumario' ? Number(m[2]) - 1 : 0 };
    return { view: ROUTES[path] };
  }

  // Mostra a tela da rota atual, protege áreas logadas, salva o caderno ao sair e ajusta título e foco, para a URL refletir onde o usuário está (H1, H5, H7).
  function render() {
    const path = location.hash.replace(/^#/, '');
    const session = getSession();
    const route = parseRoute(path);
    let view = route.view;

    if (!view) {
      if (document.getElementById(path)) return; // deixa o navegador rolar até a âncora da seção
      view = 'landing';
    }
    if ((view === 'app' || view === 'editor') && !session) { location.hash = '#/login'; return; }
    if (view === 'auth' && session) { location.hash = '#/mochila'; return; }

    if (ed) { flushSave(); if (view !== 'editor') ed = null; }
    if (view !== 'editor') pendingSec = null;
    $$('dialog[open]').forEach(d => d.close());
    $$('[data-view]').forEach(el => { el.hidden = el.dataset.view !== view; });
    const screen = $('[data-view]:not([hidden])');

    if (view === 'editor') {
      loadData();
      if (!openEditor(route.id, route.page, route.toc)) {
        toast('Não encontramos esse caderno. Ele pode ter sido excluído.');
        location.hash = '#/mochila';
        return;
      }
    }
    document.title = view === 'editor' ? (ed.toc ? 'Sumário | ' : '') + ed.c.titulo + ' | Mochila Inteligente' : screen.dataset.title;

    if (view === 'auth') {
      const mode = path === '/cadastro' ? 'cadastro' : 'login';
      $('#form-login').hidden = mode !== 'login';
      $('#form-cadastro').hidden = mode !== 'cadastro';
      $$('[data-tab]').forEach(t => t.setAttribute('aria-current', String(t.dataset.tab === mode)));
      setFormMessage('');
      $('input', mode === 'login' ? $('#form-login') : $('#form-cadastro')).focus(); // leva o cursor ao primeiro campo
    }
    if (view === 'app') {
      $('#user-name').textContent = session.username;
      loadData();
      busca.value = '';
      closeSearch();
      renderCloset();
    }

    window.scrollTo(0, 0);
    if (!firstRender && view !== 'auth') { // move o foco ao título da nova tela para leitores de tela perceberem a mudança
      const h1 = $('h1', screen);
      if (h1) h1.focus({ preventScroll: true });
    }
    firstRender = false;
  }
  window.addEventListener('hashchange', render);
  render();

  // ---------- Atalhos de teclado ----------

  // Volta ao início com Esc no acesso, abre a busca com / ou Ctrl+K no armário, troca de página com Alt+PageUp ou PageDown e abre a exportação com Ctrl+P no caderno (H3, H7 eficiência).
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('[data-view="auth"]').hidden) location.hash = '#/';
    if (ed && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      openPdfDialog();
      return;
    }
    if (ed && e.altKey && (e.key === 'PageUp' || e.key === 'PageDown')) {
      e.preventDefault();
      stepPage(e.key === 'PageDown' ? 1 : -1);
      return;
    }
    if ($('[data-view="app"]').hidden) return;
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    const modalOpen = $('dialog[open]');
    if ((e.key === '/' && !typing && !modalOpen) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !modalOpen)) {
      e.preventDefault();
      busca.focus();
      busca.select();
    }
  });

  // ---------- Rolagem suave até as seções da landing ----------

  // Intercepta os links do menu para rolar suavemente até a seção sem alterar o hash de rota, evitando que o roteador troque de tela (H4).
  $$('[data-scroll]').forEach(link => link.addEventListener('click', e => {
    e.preventDefault();
    document.getElementById(link.dataset.scroll)?.scrollIntoView({ behavior: 'smooth' });
  }));

  // ---------- Carrossel de folhas ----------

  // Desativa os botões do carrossel quando a rolagem chega ao começo ou ao fim para o usuário saber que não há mais folhas ali (H1 visibilidade).
  const carousel = $('#carousel');
  const prevBtn = $('#car-prev');
  const nextBtn = $('#car-next');
  function syncCarousel() {
    prevBtn.disabled = carousel.scrollLeft <= 2;
    nextBtn.disabled = carousel.scrollLeft >= carousel.scrollWidth - carousel.clientWidth - 2;
  }

  // Rola o carrossel 280px por clique ou pelas setas do teclado, dando duas formas de navegar conforme a preferência de cada pessoa (H7 flexibilidade).
  function scrollCarousel(direction) {
    carousel.scrollBy({ left: direction * 280, behavior: 'smooth' });
  }
  $$('[data-car]').forEach(btn => btn.addEventListener('click', () => scrollCarousel(Number(btn.dataset.car))));
  carousel.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); scrollCarousel(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); scrollCarousel(-1); }
  });
  carousel.addEventListener('scroll', syncCarousel, { passive: true });
  window.addEventListener('resize', syncCarousel);
  syncCarousel();
})();