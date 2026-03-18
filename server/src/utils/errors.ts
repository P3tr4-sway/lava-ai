export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const errors = {
  notFound: (resource: string) => new AppError(404, `${resource} not found`, 'NOT_FOUND'),
  badRequest: (msg: string) => new AppError(400, msg, 'BAD_REQUEST'),
  unauthorized: () => new AppError(401, 'Unauthorized', 'UNAUTHORIZED'),
  internal: (msg = 'Internal server error') => new AppError(500, msg, 'INTERNAL_ERROR'),
}
