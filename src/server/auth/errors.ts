/** Erro esperado de regra de negócio: a mensagem (em português) pode ser exibida ao usuário. */
export class BusinessError extends Error {
  readonly field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = 'BusinessError';
    this.field = field;
  }
}

export class NotFoundError extends BusinessError {
  constructor(what = 'Registro') {
    super(`${what} não encontrado.`);
    this.name = 'NotFoundError';
  }
}

/** Usuário autenticado sem a permissão necessária. */
export class PermissionError extends Error {
  constructor(message = 'Você não tem permissão para executar esta ação.') {
    super(message);
    this.name = 'PermissionError';
  }
}
