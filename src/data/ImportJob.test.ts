import { describe, expect, it } from 'vitest';
import { runImportJob, type ImportJobStatus } from './ImportJob';
import type { DatasetProvider } from './DatasetProvider';
import { DatasetProviderError } from './DatasetProvider';

class SucceedingProvider implements DatasetProvider {
  readonly id = 'fixture-provider';
  async discover() {
    return [];
  }
  async fetch() {
    return { features: [1, 2, 3] };
  }
}

class FailingProvider implements DatasetProvider {
  readonly id = 'failing-provider';
  async discover() {
    return [];
  }
  async fetch(): Promise<unknown> {
    throw new DatasetProviderError('upstream unavailable', 'FETCH_FAILED');
  }
}

describe('runImportJob', () => {
  it('walks through every real state on success and records recordsProcessed', async () => {
    const seen: ImportJobStatus[] = [];
    const job = await runImportJob(
      new SucceedingProvider(),
      'ds_1',
      (raw) => ({ recordsProcessed: (raw as { features: unknown[] }).features.length }),
      (status) => seen.push(status)
    );
    expect(job.status).toBe('COMPLETED');
    expect(job.recordsProcessed).toBe(3);
    expect(job.error).toBeNull();
    expect(seen).toEqual(['VALIDATING', 'INGESTING', 'PROCESSING', 'COMPLETED']);
  });

  it('a failed provider ends the job FAILED with the real error — never fake progress or fake records', async () => {
    const job = await runImportJob(new FailingProvider(), 'ds_1', () => ({ recordsProcessed: 999 }));
    expect(job.status).toBe('FAILED');
    expect(job.recordsProcessed).toBe(0);
    expect(job.error).toMatch(/upstream unavailable/);
  });

  it('always sets endedAt, whether it succeeded or failed', async () => {
    const success = await runImportJob(new SucceedingProvider(), 'ds_1', () => ({ recordsProcessed: 1 }));
    const failure = await runImportJob(new FailingProvider(), 'ds_1', () => ({ recordsProcessed: 1 }));
    expect(success.endedAt).not.toBeNull();
    expect(failure.endedAt).not.toBeNull();
  });
});
