// Envolve tudo em uma função anônima em modo estrito para não vazar variáveis globais nem aceitar erros silenciosos (H5 prevenção de erros).
(() => {
  'use strict';

  // Cria atalhos para buscar um ou vários elementos, evitando repetir document.querySelector e deixando o código curto e legível.
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  // ---------- Armazenamento ----------

  // Lê e grava JSON no localStorage dentro de try/catch para o site continuar funcionando mesmo se o navegador bloquear o armazenamento (H5).
  const store = {
    get(key, fallback) {
      try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sem armazenamento: segue sem salvar */ }
    }
  };

  // ---------- Feedback ao usuário ----------

  // Mostra uma mensagem curta na região aria-live e a esconde após 3,5 s para confirmar ações sem bloquear a tela (H1 visibilidade do status).
  let toastTimer;
  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
  }

  // Liga ou desliga o estado ocupado do botão trocando o texto e o aria-busy para evitar duplo envio e avisar que algo está em andamento (H1, H5).
  function setBusy(button, busy, busyLabel) {
    button.setAttribute('aria-busy', String(busy));
    button.disabled = busy;
    button.textContent = busy ? busyLabel : button.dataset.label;
  }

  // ---------- Motor de temas (claro/escuro) ----------

  // Alterna a classe dark no html, salva a escolha e avisa por toast, para o tema valer nas próximas visitas e o usuário ver o resultado (H1, H3).
  const root = document.documentElement;
  function syncThemeButtons() {
    const dark = root.classList.contains('dark');
    $$('.js-theme').forEach(btn => btn.setAttribute('aria-pressed', String(dark)));
  }
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
    const data = new TextEncoder().encode(salt + password);
    return toHex(await crypto.subtle.digest('SHA-256', data));
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
    obrigatoria: v => v.length > 0 || 'Digite sua senha para entrar.'
  };

  // Escreve ou limpa a mensagem de erro de um campo e marca aria-invalid para o problema ficar visível na borda e audível no leitor de tela (H9).
  function setFieldError(input, message) {
    input.setAttribute('aria-invalid', String(Boolean(message)));
    $('#' + input.id + '-erro').textContent = message || '';
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
    if (linkText) {
      const a = document.createElement('a');
      a.href = linkHref;
      a.textContent = ' ' + linkText;
      a.className = 'underline';
      box.append(a);
    }
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
      const user = { id: Date.now().toString(36), username: form.elements.usuario.value.trim(), email, salt, hash: await hashPassword(form.elements.senha.value, salt) };
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

  // ---------- Rotas por hash ----------

  // Mapeia cada rota para o nome da tela, centralizando a navegação em uma tabela fácil de estender nas próximas etapas (H4 consistência).
  const ROUTES = { '': 'landing', '/': 'landing', '/login': 'auth', '/cadastro': 'auth', '/mochila': 'app' };
  let firstRender = true;

  // Mostra a tela da rota atual, protege a área logada, ajusta título e foco, para a URL sempre refletir onde o usuário está (H1, H5, H7).
  function render() {
    const path = location.hash.replace(/^#/, '');
    const session = getSession();
    let view = ROUTES[path];

    if (!view) {
      if (document.getElementById(path)) return; // deixa o navegador rolar até a âncora da seção
      view = 'landing';
    }
    if (view === 'app' && !session) { location.hash = '#/login'; return; }
    if (view === 'auth' && session) { location.hash = '#/mochila'; return; }

    $$('[data-view]').forEach(el => { el.hidden = el.dataset.view !== view; });
    const screen = $('[data-view]:not([hidden])');
    document.title = screen.dataset.title;

    if (view === 'auth') {
      const mode = path === '/cadastro' ? 'cadastro' : 'login';
      $('#form-login').hidden = mode !== 'login';
      $('#form-cadastro').hidden = mode !== 'cadastro';
      $$('[data-tab]').forEach(t => t.setAttribute('aria-current', String(t.dataset.tab === mode)));
      setFormMessage('');
      $('input', mode === 'login' ? $('#form-login') : $('#form-cadastro')).focus(); // leva o cursor ao primeiro campo
    }
    if (view === 'app') $('#user-name').textContent = session.username;

    window.scrollTo(0, 0);
    if (!firstRender && view !== 'auth') { // move o foco ao título da nova tela para leitores de tela perceberem a mudança
      const h1 = $('h1', screen);
      if (h1) h1.focus({ preventScroll: true });
    }
    firstRender = false;
  }
  window.addEventListener('hashchange', render);
  render();

  // Permite voltar da tela de acesso para o início com a tecla Esc, uma saída rápida para quem usa teclado (H3 controle, H7 eficiência).
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('[data-view="auth"]').hidden) location.hash = '#/';
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