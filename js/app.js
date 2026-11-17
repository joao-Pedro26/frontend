/* =====================================================================
 * app.js — LÓGICA DA INTERFACE
 *
 * Responsável por: capturar eventos (cliques/submits), ler o formulário,
 * chamar as funções de api.js e desenhar na tela os dados retornados.
 * Nenhum fetch é feito aqui — toda comunicação HTTP está em api.js.
 * ===================================================================== */

// Atalho para pegar elementos pelo id
const $ = (id) => document.getElementById(id);

const el = {
  apiUrl: $('api-url'), btnSalvarUrl: $('btn-salvar-url'), status: $('status-backend'),
  form: $('form-animal'), id: $('animal-id'), nome: $('nome'), especie: $('especie'),
  raca: $('raca'), idade: $('idade'), peso: $('peso'), erroForm: $('erro-form'),
  tituloForm: $('titulo-form'), badgeVerbo: $('badge-verbo-form'),
  btnSalvar: $('btn-salvar'), btnCancelar: $('btn-cancelar-edicao'),
  formExcluirNome: $('form-excluir-nome'), excluirNome: $('excluir-nome'),
  formBuscaId: $('form-busca-id'), buscaId: $('busca-id'),
  formBuscaNome: $('form-busca-nome'), buscaNome: $('busca-nome'),
  filtroAtivo: $('filtro-ativo'), filtroTexto: $('filtro-texto'), btnLimparFiltro: $('btn-limpar-filtro'),
  btnRecarregar: $('btn-recarregar'), tabela: $('tabela-animais'),
  estadoTabela: $('estado-tabela'), contador: $('contador'),
  log: $('log-requisicoes'), logVazio: $('log-vazio'), btnLimparLog: $('btn-limpar-log'),
  modal: $('modal'), modalTitulo: $('modal-titulo'), modalMsg: $('modal-mensagem'),
  modalReq: $('modal-requisicao'), modalOk: $('modal-confirmar'), modalCancelar: $('modal-cancelar'),
  toasts: $('toasts'),
};

/* ------------------------------------------------------------------ */
/* Utilitários de formatação e segurança                              */
/* ------------------------------------------------------------------ */

/** Escapa caracteres HTML para impedir XSS ao exibir dados vindos da API. */
function escapeHtml(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const fmtIdade = (i) => (i == null ? '—' : `${i} ${i === 1 ? 'ano' : 'anos'}`);
const fmtPeso = (p) => (p == null ? '—'
  : `${Number(p).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`);
function fmtSexo(s) {
  if (s === 'M') return '<span class="tag tag-m">♂ Macho</span>';
  if (s === 'F') return '<span class="tag tag-f">♀ Fêmea</span>';
  return '—';
}

/* ------------------------------------------------------------------ */
/* Notificações (toast)                                               */
/* ------------------------------------------------------------------ */
function toast(mensagem, tipo = 'sucesso') {
  const t = document.createElement('div');
  t.className = `toast toast-${tipo}`;
  t.textContent = mensagem;
  el.toasts.appendChild(t);
  setTimeout(() => t.classList.add('saindo'), 3500);
  setTimeout(() => t.remove(), 4000);
}

/** Mostra o erro adequado: rede, 404 ou outro status. */
function tratarErro(erro, contexto) {
  console.error(contexto, erro);
  toast(`${contexto}: ${erro.message}`, 'erro');
  if (erro.status === 0) definirStatus(false);
}

/* ------------------------------------------------------------------ */
/* Modal de confirmação (retorna uma Promise<boolean>)                */
/* ------------------------------------------------------------------ */
function confirmar({ titulo, mensagem, requisicao }) {
  el.modalTitulo.textContent = titulo;
  el.modalMsg.textContent = mensagem;
  el.modalReq.textContent = requisicao;
  el.modal.hidden = false;
  el.modalCancelar.focus();

  return new Promise((resolve) => {
    const fechar = (resultado) => {
      el.modal.hidden = true;
      el.modalOk.onclick = el.modalCancelar.onclick = el.modal.onclick = document.onkeydown = null;
      resolve(resultado);
    };
    el.modalOk.onclick = () => fechar(true);
    el.modalCancelar.onclick = () => fechar(false);
    el.modal.onclick = (e) => { if (e.target === el.modal) fechar(false); };
    document.onkeydown = (e) => { if (e.key === 'Escape') fechar(false); };
  });
}

/* ------------------------------------------------------------------ */
/* Status do backend                                                  */
/* ------------------------------------------------------------------ */
function definirStatus(online) {
  el.status.className = `status ${online ? 'status-online' : 'status-offline'}`;
  el.status.textContent = online ? 'online' : 'offline';
}

/* ------------------------------------------------------------------ */
/* Renderização da tabela                                             */
/* ------------------------------------------------------------------ */
function renderizarTabela(animais, msgVazio = 'Nenhum animal cadastrado.') {
  el.tabela.innerHTML = animais.map((a) => `
    <tr>
      <td class="col-id">#${escapeHtml(a.id)}</td>
      <td class="col-nome">${escapeHtml(a.nome)}</td>
      <td>${escapeHtml(a.especie) || '—'}</td>
      <td>${escapeHtml(a.raca) || '—'}</td>
      <td>${fmtIdade(a.idade)}</td>
      <td>${fmtPeso(a.peso)}</td>
      <td>${fmtSexo(a.sexo)}</td>
      <td class="col-acoes">
        <button class="btn btn-sm btn-secondary" data-acao="editar" data-id="${escapeHtml(a.id)}">Editar</button>
        <button class="btn btn-sm btn-danger-ghost" data-acao="excluir" data-id="${escapeHtml(a.id)}">Excluir</button>
      </td>
    </tr>`).join('');

  el.estadoTabela.textContent = animais.length ? '' : msgVazio;
  el.contador.textContent = animais.length
    ? `${animais.length} ${animais.length > 1 ? 'animais exibidos' : 'animal exibido'}`
    : '';
}

function mostrarFiltro(texto) {
  el.filtroAtivo.hidden = !texto;
  el.filtroTexto.textContent = texto || '';
}

/* ------------------------------------------------------------------ */
/* GET /api/animais — listar todos                                    */
/* ------------------------------------------------------------------ */
async function carregarAnimais() {
  el.estadoTabela.textContent = 'Carregando…';
  mostrarFiltro('');
  try {
    const animais = await Api.listar();   // ← requisição GET
    definirStatus(true);
    renderizarTabela(animais);            // ← resposta JSON (lista) desenhada na tabela
  } catch (erro) {
    el.tabela.innerHTML = '';
    el.contador.textContent = '';
    el.estadoTabela.textContent = erro.message;
    tratarErro(erro, 'Erro ao listar');
  }
}

/* ------------------------------------------------------------------ */
/* Formulário: POST (cadastrar) e PUT (editar)                        */
/* ------------------------------------------------------------------ */

/** Lê os campos do formulário e monta o objeto que vira o JSON da requisição. */
function lerFormulario() {
  const sexo = el.form.querySelector('input[name="sexo"]:checked');
  return {
    nome: el.nome.value.trim(),
    especie: el.especie.value,
    raca: el.raca.value.trim() || null,
    idade: el.idade.value === '' ? null : Number(el.idade.value),
    peso: el.peso.value.trim() === '' ? null : Number(el.peso.value.replace(',', '.')),
    sexo: sexo ? sexo.value : null,   // Character no Java → string de 1 caractere
  };
}

function validar(a) {
  if (!a.nome) return 'Informe o nome do animal.';
  if (!a.especie) return 'Selecione a espécie.';
  if (a.idade == null || !Number.isInteger(a.idade) || a.idade < 0) return 'Idade deve ser um número inteiro ≥ 0.';
  if (a.peso == null || Number.isNaN(a.peso) || a.peso < 0) return 'Peso deve ser um número ≥ 0 (ex.: 12,5).';
  if (!a.sexo) return 'Selecione o sexo.';
  return '';
}

function modoCadastro() {
  el.form.reset();
  el.id.value = '';
  el.erroForm.textContent = '';
  el.tituloForm.textContent = 'Cadastrar animal';
  el.badgeVerbo.textContent = 'POST';
  el.badgeVerbo.className = 'method method-POST';
  el.btnSalvar.textContent = 'Cadastrar';
  el.btnCancelar.hidden = true;
}

function modoEdicao(animal) {
  el.id.value = animal.id;
  el.nome.value = animal.nome ?? '';
  el.especie.value = animal.especie ?? '';
  el.raca.value = animal.raca ?? '';
  el.idade.value = animal.idade ?? '';
  el.peso.value = animal.peso != null ? String(animal.peso).replace('.', ',') : '';
  el.form.querySelectorAll('input[name="sexo"]').forEach((r) => { r.checked = r.value === animal.sexo; });

  el.erroForm.textContent = '';
  el.tituloForm.textContent = `Editando animal #${animal.id}`;
  el.badgeVerbo.textContent = 'PUT';
  el.badgeVerbo.className = 'method method-PUT';
  el.btnSalvar.textContent = 'Salvar alterações';
  el.btnCancelar.hidden = false;
  el.nome.focus();
  el.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function salvarAnimal(evento) {
  evento.preventDefault();  // impede o navegador de recarregar a página
  const animal = lerFormulario();
  const erro = validar(animal);
  el.erroForm.textContent = erro;
  if (erro) return;

  const id = el.id.value;
  el.btnSalvar.disabled = true;
  try {
    if (id) {
      const atualizado = await Api.atualizar(id, animal);   // ← PUT /api/animais/{id}
      toast(`"${atualizado.nome}" atualizado com sucesso.`);
    } else {
      const criado = await Api.criar(animal);               // ← POST /api/animais
      toast(`"${criado.nome}" cadastrado com o ID #${criado.id}.`);
    }
    modoCadastro();
    await carregarAnimais();
  } catch (e) {
    tratarErro(e, id ? 'Erro ao atualizar' : 'Erro ao cadastrar');
  } finally {
    el.btnSalvar.disabled = false;
  }
}

/* ------------------------------------------------------------------ */
/* Ações da tabela: Editar (GET /{id}) e Excluir (DELETE /{id})        */
/* ------------------------------------------------------------------ */
async function aoClicarTabela(evento) {
  const botao = evento.target.closest('button[data-acao]');
  if (!botao) return;
  const id = botao.dataset.id;

  if (botao.dataset.acao === 'editar') {
    try {
      // Busca os dados mais recentes no backend antes de editar
      const animal = await Api.buscarPorId(id);             // ← GET /api/animais/{id}
      modoEdicao(animal);
    } catch (e) {
      tratarErro(e, 'Erro ao carregar animal');
    }
  }

  if (botao.dataset.acao === 'excluir') {
    const nome = botao.closest('tr').querySelector('.col-nome').textContent;
    const ok = await confirmar({
      titulo: 'Excluir animal',
      mensagem: `Deseja realmente excluir "${nome}" (ID #${id})? Esta ação não pode ser desfeita.`,
      requisicao: `DELETE ${Api.getBaseUrl()}/${id}`,
    });
    if (!ok) return;
    try {
      await Api.excluir(id);                                // ← DELETE /api/animais/{id}
      toast(`"${nome}" excluído.`);
      if (el.id.value === String(id)) modoCadastro();
      await carregarAnimais();
    } catch (e) {
      tratarErro(e, 'Erro ao excluir');
    }
  }
}

/* ------------------------------------------------------------------ */
/* Buscas: GET /{id} e GET /busca?nome=                               */
/* ------------------------------------------------------------------ */
async function buscarPorId(evento) {
  evento.preventDefault();
  const id = el.buscaId.value.trim();
  if (!id) return;
  try {
    const animal = await Api.buscarPorId(id);               // ← GET /api/animais/{id}
    renderizarTabela([animal]);
    mostrarFiltro(`Resultado da busca pelo ID #${id}`);
  } catch (e) {
    if (e.status === 404) {
      renderizarTabela([], `Animal com ID #${id} não encontrado.`);
      mostrarFiltro(`Busca pelo ID #${id}`);
    } else tratarErro(e, 'Erro na busca');
  }
}

async function buscarPorNome(evento) {
  evento.preventDefault();
  const nome = el.buscaNome.value.trim();
  if (!nome) return;
  try {
    const animais = await Api.buscarPorNome(nome);          // ← GET /api/animais/busca?nome=
    renderizarTabela(animais, `Nenhum animal encontrado com o nome "${nome}".`);
    mostrarFiltro(`Busca pelo nome "${nome}"`);
  } catch (e) {
    tratarErro(e, 'Erro na busca');
  }
}

/* ------------------------------------------------------------------ */
/* DELETE /api/animais/nome/{nome}                                    */
/* ------------------------------------------------------------------ */
async function excluirPorNome(evento) {
  evento.preventDefault();
  const nome = el.excluirNome.value.trim();
  if (!nome) return;
  const ok = await confirmar({
    titulo: 'Excluir por nome',
    mensagem: `Todos os animais com o nome exato "${nome}" serão excluídos. Deseja continuar?`,
    requisicao: `DELETE ${Api.getBaseUrl()}/nome/${encodeURIComponent(nome)}`,
  });
  if (!ok) return;
  try {
    await Api.excluirPorNome(nome);                         // ← DELETE /api/animais/nome/{nome}
    toast(`Animais com o nome "${nome}" excluídos.`);
    el.excluirNome.value = '';
    modoCadastro();
    await carregarAnimais();
  } catch (e) {
    if (e.status === 404) toast(`Nenhum animal com o nome "${nome}".`, 'erro');
    else tratarErro(e, 'Erro ao excluir');
  }
}

/* ------------------------------------------------------------------ */
/* Painel "Requisições HTTP" — recebe cada registro feito por api.js   */
/* ------------------------------------------------------------------ */
function registrarRequisicao(r) {
  const hora = new Date().toLocaleTimeString('pt-BR');
  const classeStatus = r.status === 0 ? 'st-erro' : r.status < 300 ? 'st-ok' : 'st-falha';
  const textoStatus = r.status === 0 ? 'ERRO DE REDE' : r.status;
  const json = (v) => (v == null ? '(sem corpo)' : escapeHtml(JSON.stringify(v, null, 2)));

  const li = document.createElement('li');
  li.innerHTML = `
    <details>
      <summary>
        <span class="log-hora">${hora}</span>
        <span class="method method-${r.metodo}">${r.metodo}</span>
        <span class="log-url">${escapeHtml(r.url)}</span>
        <span class="log-status ${classeStatus}">${textoStatus}</span>
        <span class="log-tempo">${r.duracao} ms</span>
      </summary>
      <div class="log-corpos">
        <div><h4>Corpo enviado (request body)</h4><pre>${json(r.corpoEnviado)}</pre></div>
        <div><h4>Corpo recebido (response body)</h4><pre>${json(r.corpoRecebido)}</pre></div>
      </div>
    </details>`;
  el.log.prepend(li);
  el.logVazio.hidden = true;
}

/* ------------------------------------------------------------------ */
/* Inicialização: liga eventos e faz a primeira carga                  */
/* ------------------------------------------------------------------ */
function iniciar() {
  Api.onRequest(registrarRequisicao);
  el.apiUrl.value = Api.getBaseUrl();

  el.form.addEventListener('submit', salvarAnimal);
  el.btnCancelar.addEventListener('click', modoCadastro);
  el.tabela.addEventListener('click', aoClicarTabela);
  el.formBuscaId.addEventListener('submit', buscarPorId);
  el.formBuscaNome.addEventListener('submit', buscarPorNome);
  el.formExcluirNome.addEventListener('submit', excluirPorNome);
  el.btnRecarregar.addEventListener('click', carregarAnimais);
  el.btnLimparFiltro.addEventListener('click', () => {
    el.buscaId.value = ''; el.buscaNome.value = '';
    carregarAnimais();
  });
  el.btnLimparLog.addEventListener('click', () => { el.log.innerHTML = ''; el.logVazio.hidden = false; });
  el.btnSalvarUrl.addEventListener('click', () => {
    Api.setBaseUrl(el.apiUrl.value.trim() || API_URL_PADRAO);
    el.apiUrl.value = Api.getBaseUrl();
    carregarAnimais();
  });

  carregarAnimais(); // primeiro GET ao abrir a página (também testa o status do backend)
}

document.addEventListener('DOMContentLoaded', iniciar);
