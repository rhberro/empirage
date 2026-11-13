const ERROR_MESSAGES: Record<string, string> = {
  character_not_found: 'Personagem não encontrado. Selecione outro personagem.',
  connection_replaced: 'Sessão aberta em outra janela. Recarregue para reconectar.',
  invalid_access_token: 'Sessão expirada. Entre na sua conta novamente.',
  invalid_authentication_message: 'Autenticação incompatível. Recarregue a página.',
  invalid_message: 'Protocolo incompatível. Recarregue a página.',
};

export function connectionErrorMessage(code: string): string {
  return ERROR_MESSAGES[code] || `Conexão recusada (${code}). Recarregue ou entre novamente.`;
}

export function createSocketUrl(): string {
  const baseUrl: unknown = import.meta.env.VITE_API_BASE_URL;
  if (typeof baseUrl !== 'string' || !baseUrl.trim()) {
    throw new Error('VITE_API_BASE_URL não configurada. Configure o endereço do servidor.');
  }
  const url = new globalThis.URL(baseUrl, globalThis.location.origin);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Endereço do servidor inválido. Use HTTP ou HTTPS.');
  }
  if (globalThis.location.protocol === 'https:' && url.protocol === 'http:') {
    throw new Error('Conexão insegura bloqueada. Configure o servidor com HTTPS.');
  }
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = url.pathname.replace(/\/$/u, '') + '/ws';
  url.search = '';
  url.hash = '';
  return url.toString();
}
