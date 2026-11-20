export function isMalformedJsonRequestError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'type' in error
    && error.type === 'entity.parse.failed';
}
