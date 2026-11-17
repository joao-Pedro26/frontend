/* =====================================================================
 * api.js — CAMADA DE COMUNICAÇÃO COM O BACKEND (Spring Boot)
 *
 * Toda requisição HTTP do frontend passa por aqui. Cada função
 * corresponde a UM endpoint do AnimalController.java:
 *
 *   listar()            GET    /api/animais
 *   buscarPorId(id)     GET    /api/animais/{id}
 *   buscarPorNome(nome) GET    /api/animais/busca?nome={nome}
 *   criar(animal)       POST   /api/animais
 *   atualizar(id, a)    PUT    /api/animais/{id}
 *   excluir(id)         DELETE /api/animais/{id}
 *   excluirPorNome(n)   DELETE /api/animais/nome/{nome}
 * ===================================================================== */

// URL padrão do backend. Pode ser alterada pela interface (fica salva no localStorage).
const API_URL_PADRAO = 'http://localhost:8080/api/animais';

const Api = (() => {
  let baseUrl = lerUrlSalva() || API_URL_PADRAO;

  // Função "ouvinte" chamada a cada requisição concluída (usada pelo painel de log).
  let aoRegistrar = () => {};

  function lerUrlSalva() {
    try { return localStorage.getItem('apiUrl'); } catch { return null; }
  }

  /** Erro com o status HTTP anexado, para a interface decidir a mensagem. */
  class ApiError extends Error {
    constructor(mensagem, status) {
      super(mensagem);
      this.status = status; // 0 = falha de rede (backend desligado / CORS)
    }
  }

  /**
   * Função central que executa TODAS as requisições.
   *
   * 1. Monta a URL completa (baseUrl + caminho).
   * 2. Se houver corpo, converte o objeto JS em texto JSON (JSON.stringify)
   *    e envia o cabeçalho Content-Type: application/json — é isso que
   *    permite ao Spring converter o JSON no objeto Animal (@RequestBody).
   * 3. Usa fetch() e espera (await) a resposta.
   * 4. Se o status for 204 (No Content) não existe corpo → retorna null.
   *    Caso contrário converte o texto JSON da resposta em objeto JS.
   * 5. Se o status não for 2xx (response.ok === false), lança ApiError.
   */
  async function request(metodo, caminho = '', corpo) {
    const url = baseUrl + caminho;
    const opcoes = {
      method: metodo,
      headers: { 'Accept': 'application/json' },
    };

    if (corpo !== undefined) {
      opcoes.headers['Content-Type'] = 'application/json';
      opcoes.body = JSON.stringify(corpo);
    }

    const inicio = performance.now();
    const registro = { metodo, url, corpoEnviado: corpo, status: 0, corpoRecebido: null };

    let response;
    try {
      response = await fetch(url, opcoes);
    } catch (erroDeRede) {
      // fetch só "falha" (rejeita) quando NÃO houve resposta: servidor fora do ar, CORS, URL inválida.
      registro.duracao = Math.round(performance.now() - inicio);
      registro.erro = 'Falha de rede';
      aoRegistrar(registro);
      throw new ApiError(
        `Não foi possível conectar ao backend em ${new URL(url).origin}. ` +
        'Verifique se a aplicação Spring Boot está rodando.', 0);
    }

    registro.status = response.status;
    registro.duracao = Math.round(performance.now() - inicio);

    // 204 No Content (DELETE ou busca sem resultado) e corpo vazio → null
    let dados = null;
    const texto = response.status === 204 ? '' : await response.text();
    if (texto) {
      try { dados = JSON.parse(texto); } catch { dados = texto; }
    }
    registro.corpoRecebido = dados;
    aoRegistrar(registro);

    if (!response.ok) {
      throw new ApiError(mensagemPorStatus(response.status), response.status);
    }
    return dados;
  }

  function mensagemPorStatus(status) {
    if (status === 404) return 'Registro não encontrado (404).';
    if (status === 400) return 'Dados inválidos enviados ao servidor (400).';
    if (status >= 500)  return `Erro interno no servidor (${status}).`;
    return `Erro inesperado (${status}).`;
  }

  // ---------------- Funções públicas: uma por endpoint ----------------
  return {
    ApiError,

    getBaseUrl: () => baseUrl,
    setBaseUrl(url) {
      baseUrl = url.replace(/\/+$/, ''); // remove barra final
      try { localStorage.setItem('apiUrl', baseUrl); } catch { /* ignore */ }
    },
    onRequest(fn) { aoRegistrar = fn; },

    /** GET /api/animais → 200 + lista */
    listar: () => request('GET'),

    /** GET /api/animais/{id} → 200 + animal | 404 */
    buscarPorId: (id) => request('GET', `/${encodeURIComponent(id)}`),

    /** GET /api/animais/busca?nome= → 200 + lista | 204 (nenhum) */
    buscarPorNome: async (nome) =>
      (await request('GET', `/busca?nome=${encodeURIComponent(nome)}`)) ?? [],

    /** POST /api/animais (corpo = animal sem id) → 201 + animal criado */
    criar: (animal) => request('POST', '', animal),

    /** PUT /api/animais/{id} (corpo = campos) → 200 + animal atualizado | 404 */
    atualizar: (id, animal) => request('PUT', `/${encodeURIComponent(id)}`, animal),

    /** DELETE /api/animais/{id} → 204 | 404 */
    excluir: (id) => request('DELETE', `/${encodeURIComponent(id)}`),

    /** DELETE /api/animais/nome/{nome} → 204 | 404 */
    excluirPorNome: (nome) => request('DELETE', `/nome/${encodeURIComponent(nome)}`),
  };
})();
