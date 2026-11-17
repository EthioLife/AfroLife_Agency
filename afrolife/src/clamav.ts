import net from 'node:net';

export interface ClamAvConfig {
  host?: string;
  port?: string;
  timeoutMs?: number;
}

function environmentConfig(): ClamAvConfig {
  const timeout = Number(process.env.CLAMAV_TIMEOUT_MS);
  return {
    host: process.env.CLAMAV_HOST,
    port: process.env.CLAMAV_PORT,
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : undefined,
  };
}

export function isClamAvConfigured(config: ClamAvConfig = environmentConfig()): boolean {
  const port = Number(config.port ?? '3310');
  return Boolean(config.host?.trim()) && Number.isInteger(port) && port > 0 && port <= 65535;
}

export async function scanWithClamAv(
  content: Buffer,
  config: ClamAvConfig = environmentConfig(),
): Promise<'clean' | 'infected'> {
  if (!isClamAvConfigured(config)) throw new Error('ClamAV host and a valid port must be configured');
  const port = Number(config.port ?? '3310');
  const timeoutMs = config.timeoutMs ?? 10_000;

  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: config.host!.trim(), port });
    let response = '';
    let settled = false;
    const finish = (error?: Error, result?: 'clean' | 'infected') => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolve(result!);
    };

    socket.setTimeout(timeoutMs, () => finish(new Error('ClamAV scan timed out')));
    socket.on('error', (error) => finish(error));
    socket.on('data', (chunk: Buffer) => {
      response += chunk.toString('utf8');
      if (response.includes('\0') || response.endsWith('\n')) {
        if (/\bstream:\s+OK(?:\0|\r?\n)/i.test(response)) finish(undefined, 'clean');
        else if (/\bstream:\s+.+\s+FOUND(?:\0|\r?\n)/i.test(response)) finish(undefined, 'infected');
        else finish(new Error('ClamAV returned an unrecognized scan result'));
      }
    });
    socket.on('connect', () => {
      socket.write(Buffer.from('zINSTREAM\0', 'ascii'));
      for (let offset = 0; offset < content.length; offset += 64 * 1024) {
        const chunk = content.subarray(offset, Math.min(offset + 64 * 1024, content.length));
        const size = Buffer.alloc(4);
        size.writeUInt32BE(chunk.length);
        socket.write(size);
        socket.write(chunk);
      }
      socket.end(Buffer.alloc(4));
    });
  });
}
