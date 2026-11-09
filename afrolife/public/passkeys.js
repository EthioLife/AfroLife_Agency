function base64UrlToBytes(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new TypeError('Invalid WebAuthn option encoding.');
  }
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - base64.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytesToBase64Url(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function preparePasskeyCreationOptions(options) {
  return {
    ...options,
    challenge: base64UrlToBytes(options.challenge),
    user: { ...options.user, id: base64UrlToBytes(options.user.id) },
    excludeCredentials: (options.excludeCredentials ?? []).map((credential) => ({
      ...credential,
      id: base64UrlToBytes(credential.id),
    })),
  };
}

export function serializePasskeyRegistration(credential) {
  const response = credential?.response;
  if (credential?.type !== 'public-key'
    || !response?.attestationObject
    || !response?.clientDataJSON
    || !credential.rawId) {
    throw new TypeError('The device returned an invalid passkey registration response.');
  }
  return {
    id: credential.id,
    rawId: bytesToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      attestationObject: bytesToBase64Url(response.attestationObject),
      clientDataJSON: bytesToBase64Url(response.clientDataJSON),
      transports: typeof response.getTransports === 'function' ? response.getTransports() : [],
    },
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: credential.authenticatorAttachment,
  };
}
