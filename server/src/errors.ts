export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
export const notFound = (msg = 'Não encontrado') => new HttpError(404, msg);
export const badRequest = (msg: string) => new HttpError(400, msg);
export const forbidden = (msg = 'Sem permissão') => new HttpError(403, msg);
