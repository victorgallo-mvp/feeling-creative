import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../../config.js';

/**
 * Abstração de storage. Troque o driver (S3, Google Drive na fase 2)
 * sem mexer no resto do sistema. Chaves são caminhos relativos tipo
 * "batches/12/abc.jpg".
 */
export interface Storage {
  saveBuffer(key: string, data: Buffer): Promise<void>;
  saveFromPath(key: string, tmpPath: string): Promise<void>;
  readBuffer(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  url(key: string): string;
}

const SAFE_KEY = /^[A-Za-z0-9_\-./]+$/;

class LocalStorage implements Storage {
  private rootAbs: string;
  constructor(root: string) { this.rootAbs = path.resolve(root); }

  private abs(key: string) {
    if (!SAFE_KEY.test(key) || key.includes('..')) throw new Error('Chave de arquivo inválida');
    const p = path.resolve(this.rootAbs, key);
    if (p !== this.rootAbs && !p.startsWith(this.rootAbs + path.sep)) throw new Error('Chave de arquivo inválida');
    return p;
  }

  async saveBuffer(key: string, data: Buffer) {
    const p = this.abs(key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, data);
  }

  async saveFromPath(key: string, tmpPath: string) {
    const p = this.abs(key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    try {
      await fs.rename(tmpPath, p);
    } catch {
      await fs.copyFile(tmpPath, p);
      await fs.unlink(tmpPath).catch(() => {});
    }
  }

  async readBuffer(key: string) {
    return fs.readFile(this.abs(key));
  }

  async delete(key: string) {
    await fs.unlink(this.abs(key)).catch(() => {});
  }

  url(key: string) {
    return `${config.apiUrl}/files/${key}`;
  }
}

export const storage: Storage = new LocalStorage(config.storagePath);
export const storageRoot = path.resolve(config.storagePath);
export const tmpDir = path.join(storageRoot, 'tmp');
