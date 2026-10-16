/**
 * MOCHILA DE CADERNOS — APLICAÇÃO WEB
 * Aluna: Carla Vicktória | RA: 22606839 | GitHub: @cv.palmiere
 * Tecnologias: HTML5, Tailwind CSS, CSS3, Vanilla JS, Lucide Icons, jsPDF & html2canvas
 */

// ==================== ESTADO DA APLICAÇÃO ====================
let tipos = JSON.parse(localStorage.getItem('mc_tipos')) || [
  'Engenharia de Software',
  'Banco de Dados',
  'UI/UX & Heurísticas',
  'Rascunhos & Ideias'
];

let books = JSON.parse(localStorage.getItem('mc_books')) || [
  {
    id: 1710000000001,
    nome: 'Design de Interação & UI/UX',
    tipo: 'UI/UX & Heurísticas',
    capa: 'cover-wine',
    pautado: true,
    criadoEm: '16/10/2026',
    paginas: [
      {
        data: '16/10/2026',
        conteudo: '<b>Heurísticas de Nielsen aplicadas ao Projeto:</b>\n1. Visibilidade do status do sistema (indicador de salvamento e página atual).\n2. Correspondência entre o sistema e o mundo real (folha pautada, margem, post-its físicos).\n3. Liberdade e controle do usuário (edição livre, exclusão e retorno fácil).\n\nExperimente selecionar um trecho deste texto e aplicar o <span style="background-color: rgb(254, 240, 138);">marca-texto amarelo</span> na barra superior!',
        postIts: [
          {
            id: 901,
            x: 520,
            y: 90,
            cor: '#fbf2d5',
            texto: 'Lembrete: Exportar o PDF ao finalizar a revisão da matéria!'
          }
        ]
      }
    ]
  }
];

let currentBookId = null;
let currentPageIndex = 0;

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', () => {
  saveToStorage(false);
  renderTiposUI();
  renderBooks();
  lucide.createIcons();

  // Listener de digitação contínua no editor
  const paperContent = document.getElementById('paperContent');
  paperContent.addEventListener('input', () => {
    saveCurrentPage();
  });
});

// ==================== PERSISTÊNCIA ====================
function saveToStorage(showFeedback = true) {
  localStorage.setItem('mc_tipos', JSON.stringify(tipos));
  localStorage.setItem('mc_books', JSON.stringify(books));

  if (showFeedback) {
    const status = document.getElementById('saveStatus');
    if (status) {
      status.classList.remove('opacity-50');
      status.innerHTML = `<i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-olive"></i><span>Salvo agora</span>`;
      lucide.createIcons();
    }
  }
}

// ==================== GESTÃO DE MODAIS ====================
function openModal(id) {
  const modal = document.getElementById(id);
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  lucide.createIcons();
}

function closeModal(id) {
  const modal = document.getElementById(id);
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

// ==================== GESTÃO DE TIPOS DE CADERNO ====================
function renderTiposUI() {
  // Atualiza Select do Modal de Criação
  const selectBookTipo = document.getElementById('selectBookTipo');
  selectBookTipo.innerHTML = tipos
    .map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`)
    .join('');

  // Atualiza Select de Filtro na Estante
  const filterTipo = document.getElementById('filterTipo');
  const currentFilter = filterTipo.value || 'TODOS';
  filterTipo.innerHTML = `<option value="TODOS">Todos os Tipos</option>` +
    tipos.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
  filterTipo.value = tipos.includes(currentFilter) ? currentFilter : 'TODOS';

  // Atualiza Lista dentro do Modal de Tipos
  const tiposList = document.getElementById('tiposList');
  if (tipos.length === 0) {
    tiposList.innerHTML = `<li class="text-xs text-darkolive/60 italic py-2">Nenhum tipo cadastrado.</li>`;
    return;
  }

  tiposList.innerHTML = tipos
    .map((t, index) => `
      <li class="flex items-center justify-between bg-white px-3.5 py-2 rounded-lg border border-darkolive/15 shadow-2xs">
        <span class="text-sm font-medium text-darkolive">${escapeHtml(t)}</span>
        <button onclick="deleteTipo(${index})" class="text-kiss hover:text-wine p-1 rounded transition" title="Remover Tipo">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </li>
    `)
    .join('');

  lucide.createIcons();
}

function addTipo() {
  const input = document.getElementById('inputTipoNome');
  const nome = input.value.trim();

  if (!nome) {
    alert('Digite um nome para o tipo de caderno.');
    return;
  }
  if (tipos.includes(nome)) {
    alert('Este tipo já está cadastrado.');
    return;
  }

  tipos.push(nome);
  input.value = '';
  saveToStorage();
  renderTiposUI();
}

function deleteTipo(index) {
  if (tipos.length <= 1) {
    alert('Mantenha pelo menos 1 tipo cadastrado.');
    return;
  }
  tipos.splice(index, 1);
  saveToStorage();
  renderTiposUI();
  renderBooks();
}

// ==================== GESTÃO DE CADERNOS (ESTANTE) ====================
function renderBooks() {
  const grid = document.getElementById('booksGrid');
  const filtro = document.getElementById('filterTipo').value;

  const filteredBooks = filtro === 'TODOS'
    ? books
    : books.filter(b => b.tipo === filtro);

  if (filteredBooks.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full bg-cream/60 border-2 border-dashed border-darkolive/25 rounded-2xl p-12 text-center">
        <div class="w-12 h-12 rounded-full bg-wine/10 text-wine mx-auto flex items-center justify-center mb-3">
          <i data-lucide="book-open" class="w-6 h-6"></i>
        </div>
        <h3 class="text-lg font-bold text-wine">Nenhum caderno encontrado</h3>
        <p class="text-sm text-darkolive/75 mt-1 mb-4">Crie seu primeiro caderno personalizado clicando no botão abaixo.</p>
        <button onclick="openModal('bookModal')" class="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-wine text-cream text-sm font-semibold hover:bg-kiss transition">
          <i data-lucide="plus" class="w-4 h-4"></i>
          <span>Novo Caderno</span>
        </button>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  grid.innerHTML = filteredBooks.map(book => `
    <article class="bg-cream rounded-2xl overflow-hidden shadow-md hover:shadow-xl border border-darkolive/15 transition-all duration-200 flex flex-col group hover:-translate-y-1">
      <!-- Capa do Caderno -->
      <div onclick="openBook(${book.id})" class="${book.capa} h-44 relative p-6 flex flex-col justify-between cursor-pointer">
        <div class="notebook-spine"></div>
        
        <div class="pl-3 flex items-center justify-between">
          <span class="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-black/25 backdrop-blur-xs">
            ${escapeHtml(book.tipo)}
          </span>
          <span class="text-xs opacity-85 flex items-center gap-1" title="${book.pautado ? 'Folha Pautada' : 'Sem Pauta'}">
            <i data-lucide="${book.pautado ? 'align-justify' : 'square'}" class="w-3.5 h-3.5"></i>
          </span>
        </div>

        <div class="pl-3">
          <h3 class="font-bold text-xl leading-snug line-clamp-2 group-hover:underline">${escapeHtml(book.nome)}</h3>
        </div>
      </div>

      <!-- Rodapé do Card -->
      <div class="p-4 flex-1 flex flex-col justify-between bg-cream">
        <div class="flex items-center justify-between text-xs text-darkolive/75 mb-4">
          <span class="flex items-center gap-1 font-medium">
            <i data-lucide="file-text" class="w-3.5 h-3.5 text-kiss"></i>
            ${book.paginas.length} ${book.paginas.length === 1 ? 'página' : 'páginas'}
          </span>
          <span>${book.criadoEm || 'Recente'}</span>
        </div>

        <div class="flex items-center justify-between gap-2 pt-2 border-t border-darkolive/10">
          <button onclick="openBook(${book.id})" class="flex-1 py-2 px-3 rounded-lg bg-wine hover:bg-kiss text-cream text-xs font-bold flex items-center justify-center space-x-1.5 transition">
            <i data-lucide="pen-tool" class="w-3.5 h-3.5"></i>
            <span>Abrir Caderno</span>
          </button>
          <button onclick="deleteBook(${book.id})" class="p-2 rounded-lg bg-sand/60 hover:bg-kiss hover:text-white text-wine transition" title="Excluir Caderno">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    </article>
  `).join('');

  lucide.createIcons();
}

function createBook() {
  const nomeInput = document.getElementById('inputBookNome');
  const tipoSelect = document.getElementById('selectBookTipo');
  const capaRadio = document.querySelector('input[name="bookCover"]:checked');
  const pautaRadio = document.querySelector('input[name="bookPauta"]:checked');

  const nome = nomeInput.value.trim();
  if (!nome) {
    alert('Por favor, defina um nome para o caderno.');
    nomeInput.focus();
    return;
  }

  const hoje = new Date().toLocaleDateString('pt-BR');

  const novoCaderno = {
    id: Date.now(),
    nome: nome,
    tipo: tipoSelect.value || 'Geral',
    capa: capaRadio ? capaRadio.value : 'cover-wine',
    pautado: pautaRadio ? pautaRadio.value === 'true' : true,
    criadoEm: hoje,
    paginas: [
      {
        data: hoje,
        conteudo: '',
        postIts: []
      }
    ]
  };

  books.unshift(novoCaderno);
  nomeInput.value = '';
  saveToStorage();
  closeModal('bookModal');
  renderBooks();
}

function deleteBook(id) {
  const target = books.find(b => b.id === id);
  if (!target) return;

  if (confirm(`Tem certeza que deseja excluir o caderno "${target.nome}"?`)) {
    books = books.filter(b => b.id !== id);
    saveToStorage();
    renderBooks();
  }
}

// ==================== EDITOR DO CADERNO ====================
function getCurrentBook() {
  return books.find(b => b.id === currentBookId);
}

function openBook(id) {
  currentBookId = id;
  currentPageIndex = 0;

  const book = getCurrentBook();
  if (!book) return;

  // Alterna Views
  document.getElementById('homeView').classList.add('hidden');
  document.getElementById('navHomeActions').classList.add('hidden');

  document.getElementById('editorView').classList.remove('hidden');
  const navEditor = document.getElementById('navEditorActions');
  navEditor.classList.remove('hidden');
  navEditor.classList.add('flex');

  // Preenche metadados do topo do editor
  document.getElementById('editorBookTitle').innerText = book.nome;
  document.getElementById('editorBookType').innerText = book.tipo;
  document.getElementById('editorBookBadge').className = `w-3.5 h-3.5 rounded-full inline-block ${book.capa}`;

  loadPage();
}

function backHome() {
  saveCurrentPage();
  currentBookId = null;

  document.getElementById('editorView').classList.add('hidden');
  const navEditor = document.getElementById('navEditorActions');
  navEditor.classList.add('hidden');
  navEditor.classList.remove('flex');

  document.getElementById('homeView').classList.remove('hidden');
  document.getElementById('navHomeActions').classList.remove('hidden');

  renderBooks();
}

function loadPage() {
  const book = getCurrentBook();
  if (!book) return;

  // Normaliza páginas antigas caso sejam strings simples
  if (typeof book.paginas[currentPageIndex] === 'string') {
    book.paginas[currentPageIndex] = {
      data: new Date().toLocaleDateString('pt-BR'),
      conteudo: book.paginas[currentPageIndex],
      postIts: []
    };
  }

  const pagina = book.paginas[currentPageIndex];
  const paperContainer = document.getElementById('paperContainer');
  const paperContent = document.getElementById('paperContent');
  const pageDate = document.getElementById('pageDate');

  // Configura estilo pautado ou liso
  if (book.pautado) {
    paperContainer.classList.add('paper-pautado');
  } else {
    paperContainer.classList.remove('paper-pautado');
  }

  // Carrega conteúdo HTML rico e data
  paperContent.innerHTML = pagina.conteudo || '';
  pageDate.value = pagina.data || '';

  // Atualiza indicadores de página
  document.getElementById('pageIndicator').innerText = `Página ${currentPageIndex + 1} de ${book.paginas.length}`;
  document.getElementById('sheetPageNumber').innerText = `PÁG. ${String(currentPageIndex + 1).padStart(2, '0')}`;

  document.getElementById('btnPrevPage').disabled = currentPageIndex === 0;
  document.getElementById('btnNextPage').disabled = currentPageIndex === book.paginas.length - 1;

  renderPostIts();
  lucide.createIcons();
}

function saveCurrentPage() {
  const book = getCurrentBook();
  if (!book) return;

  const paperContent = document.getElementById('paperContent');
  const pageDate = document.getElementById('pageDate');

  const pagina = book.paginas[currentPageIndex];
  pagina.conteudo = paperContent.innerHTML;
  pagina.data = pageDate.value;

  saveToStorage(true);
}

function prevPage() {
  if (currentPageIndex > 0) {
    saveCurrentPage();
    currentPageIndex--;
    loadPage();
  }
}

function nextPage() {
  const book = getCurrentBook();
  if (book && currentPageIndex < book.paginas.length - 1) {
    saveCurrentPage();
    currentPageIndex++;
    loadPage();
  }
}

function newPage() {
  const book = getCurrentBook();
  if (!book) return;

  saveCurrentPage();
  book.paginas.push({
    data: new Date().toLocaleDateString('pt-BR'),
    conteudo: '',
    postIts: []
  });
  currentPageIndex = book.paginas.length - 1;
  saveToStorage();
  loadPage();
}

function deleteCurrentPage() {
  const book = getCurrentBook();
  if (!book) return;

  if (book.paginas.length <= 1) {
    if (confirm('Deseja limpar todo o conteúdo desta página?')) {
      book.paginas[0].conteudo = '';
      book.paginas[0].postIts = [];
      saveToStorage();
      loadPage();
    }
    return;
  }

  if (confirm(`Excluir a Página ${currentPageIndex + 1}?`)) {
    book.paginas.splice(currentPageIndex, 1);
    if (currentPageIndex >= book.paginas.length) {
      currentPageIndex = book.paginas.length - 1;
    }
    saveToStorage();
    loadPage();
  }
}

// ==================== FERRAMENTAS RICH TEXT (COR, MARCA-TEXTO, IMAGEM) ====================
function formatDoc(cmd, value = null) {
  document.getElementById('paperContent').focus();
  document.execCommand(cmd, false, value);
  saveCurrentPage();
}

function setTextColor(color) {
  formatDoc('foreColor', color);
}

function setHighlight(color) {
  formatDoc('hiliteColor', color);
}

function insertImage(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const imgHtml = `<img src="${e.target.result}" alt="Imagem Anexada" /><div><br></div>`;
    const paperContent = document.getElementById('paperContent');
    paperContent.focus();
    document.execCommand('insertHTML', false, imgHtml);
    saveCurrentPage();
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

// ==================== POST-ITS FLUTUANTES (DRAG & DROP) ====================
function renderPostIts() {
  const book = getCurrentBook();
  if (!book) return;

  const layer = document.getElementById('postItsLayer');
  const postIts = book.paginas[currentPageIndex].postIts || [];

  layer.innerHTML = postIts.map(p => `
    <div class="post-it-note" id="postit-${p.id}" style="left: ${p.x}px; top: ${p.y}px; background-color: ${p.cor};">
      <div class="post-it-header" onmousedown="startDragPostIt(event, ${p.id})">
        <div class="flex items-center space-x-1">
          <i data-lucide="grip-horizontal" class="w-4 h-4 text-wine/70"></i>
          <span class="text-[10px] font-bold uppercase tracking-wider text-wine/80">Post-it</span>
        </div>
        <div class="flex items-center space-x-1">
          <button onclick="changePostItColor(${p.id}, '#fbf2d5')" class="w-3 h-3 rounded-full bg-[#fbf2d5] border border-black/30" title="Creme"></button>
          <button onclick="changePostItColor(${p.id}, '#dac9b5')" class="w-3 h-3 rounded-full bg-[#dac9b5] border border-black/30" title="Sand"></button>
          <button onclick="changePostItColor(${p.id}, '#fef08a')" class="w-3 h-3 rounded-full bg-yellow-200 border border-black/30" title="Amarelo"></button>
          <button onclick="deletePostIt(${p.id})" class="text-wine hover:text-kiss ml-1" title="Remover Post-it">
            <i data-lucide="x" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
      <div class="post-it-body" contenteditable="true" oninput="updatePostItText(${p.id}, this.innerText)">${escapeHtml(p.texto)}</div>
    </div>
  `).join('');

  lucide.createIcons();
}

function addPostIt(cor = '#fbf2d5') {
  const book = getCurrentBook();
  if (!book) return;

  const pagina = book.paginas[currentPageIndex];
  if (!pagina.postIts) pagina.postIts = [];

  const offset = (pagina.postIts.length * 25) % 150;
  pagina.postIts.push({
    id: Date.now(),
    x: 480 - offset,
    y: 120 + offset,
    cor: cor,
    texto: 'Digite sua nota rápida aqui...'
  });

  saveToStorage();
  renderPostIts();
}

function updatePostItText(id, texto) {
  const book = getCurrentBook();
  if (!book) return;

  const postIt = book.paginas[currentPageIndex].postIts.find(p => p.id === id);
  if (postIt) {
    postIt.texto = texto;
    saveToStorage();
  }
}

function changePostItColor(id, novaCor) {
  const book = getCurrentBook();
  if (!book) return;

  const postIt = book.paginas[currentPageIndex].postIts.find(p => p.id === id);
  if (postIt) {
    postIt.cor = novaCor;
    saveToStorage();
    renderPostIts();
  }
}

function deletePostIt(id) {
  const book = getCurrentBook();
  if (!book) return;

  const pagina = book.paginas[currentPageIndex];
  pagina.postIts = pagina.postIts.filter(p => p.id !== id);
  saveToStorage();
  renderPostIts();
}

// Lógica de Arrastar Post-it dentro da folha
let draggedPostItId = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

function startDragPostIt(e, id) {
  if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;

  draggedPostItId = id;
  const el = document.getElementById(`postit-${id}`);
  const containerRect = document.getElementById('paperContainer').getBoundingClientRect();
  const elRect = el.getBoundingClientRect();

  dragOffsetX = e.clientX - elRect.left;
  dragOffsetY = e.clientY - elRect.top;

  function onMouseMove(ev) {
    if (!draggedPostItId) return;

    let newX = ev.clientX - containerRect.left - dragOffsetX;
    let newY = ev.clientY - containerRect.top - dragOffsetY;

    // Limita às bordas da folha
    newX = Math.max(10, Math.min(newX, containerRect.width - el.offsetWidth - 10));
    newY = Math.max(10, Math.min(newY, containerRect.height - el.offsetHeight - 10));

    el.style.left = `${newX}px`;
    el.style.top = `${newY}px`;

    const book = getCurrentBook();
    const postIt = book.paginas[currentPageIndex].postIts.find(p => p.id === draggedPostItId);
    if (postIt) {
      postIt.x = Math.round(newX);
      postIt.y = Math.round(newY);
    }
  }

  function onMouseUp() {
    if (draggedPostItId) {
      saveToStorage();
      draggedPostItId = null;
    }
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

// ==================== EXPORTAÇÃO EM PDF (TODAS AS PÁGINAS) ====================
async function exportPDF() {
  const book = getCurrentBook();
  if (!book) return;

  saveCurrentPage();

  const btn = document.getElementById('btnExportPDF');
  const originalBtnHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i><span>Gerando PDF...</span>`;
  lucide.createIcons();

  const originalPageIndex = currentPageIndex;
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF('p', 'mm', 'a4');

  const paperContainer = document.getElementById('paperContainer');

  try {
    for (let i = 0; i < book.paginas.length; i++) {
      currentPageIndex = i;
      loadPage();

      // Aguarda renderização do DOM e ícones
      await new Promise(r => setTimeout(r, 150));

      const canvas = await html2canvas(paperContainer, {
        scale: 2,
        useCORS: true,
        backgroundColor: book.pautado ? '#fffdf7' : '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, 0, 210, 297);
    }

    const fileName = `${book.nome.replace(/\s+/g, '_')}.pdf`;
    pdf.save(fileName);
  } catch (err) {
    console.error('Erro ao exportar PDF:', err);
    alert('Ocorreu um erro ao gerar o PDF.');
  } finally {
    currentPageIndex = originalPageIndex;
    loadPage();
    btn.disabled = false;
    btn.innerHTML = originalBtnHtml;
    lucide.createIcons();
  }
}

// ==================== UTILITÁRIOS ====================
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}