import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AwsClient } from 'aws4fetch';
import { privateObjectStorageConfig } from './runtime-config.js';

type Environment = Record<string, string | undefined>;

function filePath(root: string, key: string) {
  if (!/^[0-9a-f-]{36}$/i.test(key)) throw new Error('Invalid private file key');
  const p = resolve(root, key);
  if (!p.startsWith(root + '\\') && !p.startsWith(root + '/')) throw new Error('Invalid private file path');
  return p;
}

export function createPrivateStorage(env: Environment) {
  const objectStorage = privateObjectStorageConfig(env);
  if (objectStorage) {
    const client = new AwsClient({
      accessKeyId: objectStorage.accessKeyId,
      secretAccessKey: objectStorage.secretAccessKey,
      sessionToken: objectStorage.sessionToken,
      service: 's3',
      region: objectStorage.region,
      retries: 0,
    });
    const bucketUrl = () => {
      const url = new URL(objectStorage.endpoint);
      url.pathname = `${url.pathname.replace(/\/+$/, '')}/${encodeURIComponent(objectStorage.bucket)}`;
      return url;
    };
    const objectUrl = (key: string) => {
      const url = bucketUrl();
      url.pathname = `${url.pathname}/${encodeURIComponent(key)}`;
      return url;
    };
    const send = async (
      url: URL,
      method: 'GET' | 'HEAD' | 'PUT',
      body?: Uint8Array<ArrayBuffer>,
      signal?: AbortSignal,
    ) => {
      const response = await client.fetch(url, {
        method,
        headers: method === 'PUT' ? { 'If-None-Match': '*' } : undefined,
        body,
        signal,
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`Private object storage ${method} failed (HTTP ${response.status}).`);
      }
      return response;
    };

    return {
      check: async () => { await send(bucketUrl(), 'HEAD', undefined, AbortSignal.timeout(5_000)); },
      putFile: async (key: string, content: Buffer) => {
        if (!/^[0-9a-f-]{36}$/i.test(key)) throw new Error('Invalid private file key');
        const body = new Uint8Array(content.byteLength);
        body.set(content);
        await send(objectUrl(key), 'PUT', body);
      },
      getFile: async (key: string) => {
        if (!/^[0-9a-f-]{36}$/i.test(key)) throw new Error('Invalid private file key');
        const response = await send(objectUrl(key), 'GET');
        return Buffer.from(await response.arrayBuffer());
      },
    };
  }

  const root = resolve(env.FILE_STORAGE_DIR ?? './data/private-files');
  return {
    check: async () => {
      const storageStats = await stat(root);
      if (!storageStats.isDirectory()) throw new Error('Private file storage path is not a directory');
      await access(root, fsConstants.W_OK);
    },
    putFile: async (key: string, content: Buffer) => {
      const path = filePath(root, key);
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      await writeFile(path, content, { flag: 'wx', mode: 0o600 });
    },
    getFile: async (key: string) => readFile(filePath(root, key)),
  };
}

const privateStorage = createPrivateStorage(process.env);
export const checkPrivateStorage = privateStorage.check;
export const putFile = privateStorage.putFile;
export const getFile = privateStorage.getFile;
