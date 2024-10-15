import { LookupService, LookupQuestion, LookupAnswer, LookupFormula } from '@bsv/overlay';
import { Script } from '@bsv/sdk';
import { getURLForFile } from 'uhrp-url';

interface UHRPStorage {
  saveRecord(record: any): Promise<void>;
  getRecord(query: any): Promise<any>;
  deleteRecord(id: string): Promise<void>;
}

export class UHRPLookupService implements LookupService {
  constructor(public storage: UHRPStorage) {}

  async outputAdded(
    txid: string,
    outputIndex: number,
    outputScript: Script,
    topic: string
  ): Promise<void> {
    const scriptBuffer = Buffer.from(outputScript.toHex(), 'hex');
    const record = {
      txid,
      outputIndex,
      script: outputScript.toHex(),
      topic,
      uhrpUrl: getURLForFile(scriptBuffer),
      createdAt: new Date(),
    };
    console.log('Saving new UTXO metadata:', record);
    await this.storage.saveRecord(record);
  }

  async outputSpent(txid: string, outputIndex: number): Promise<void> {
    const id = `${txid}-${outputIndex}`;
    console.log(`Deleting UTXO metadata with ID: ${id}`);
    await this.storage.deleteRecord(id);
  }

  async lookup(question: LookupQuestion): Promise<LookupAnswer | LookupFormula> {
    const query: Record<string, any> = {};

    // Validate query structure
    if (isLookupQuery(question.query)) {
      if (question.query.txid) query.txid = question.query.txid;
      if (question.query.uhrpUrl) query.uhrpUrl = question.query.uhrpUrl;
      if (question.query.outputIndex !== undefined) query.outputIndex = question.query.outputIndex;
    } else {
      console.error('Invalid query structure:', question.query);
      return { type: 'freeform', result: 'Invalid query format' };
    }

    console.log('Executing lookup with query:', query);
    const result = await this.storage.getRecord(query);

    if (result) {
      console.log('Matching commitment found:', result);
      const metadataBuffer = Buffer.from(
        JSON.stringify({ uhrpUrl: result.uhrpUrl })
      );
      const beefData = Array.from(metadataBuffer);

      return {
        type: 'output-list',
        outputs: [{ outputIndex: result.outputIndex, beef: beefData }],
      };
    }

    console.log('No matching commitments found');
    return { type: 'freeform', result: 'No matching commitments found' };
  }

  async getDocumentation(): Promise<string> {
    return 'This service supports UHRP commitments and allows querying by UHRP URL.';
  }

  async getMetaData() {
    return {
      name: 'UHRP Lookup Service',
      shortDescription: 'Manages and queries UHRP commitments',
      version: '1.0.0',
    };
  }
}

/**
 * Type guard to validate the structure of the lookup query.
 */
function isLookupQuery(
  query: unknown
): query is { txid?: string; uhrpUrl?: string; outputIndex?: number } {
  if (typeof query !== 'object' || query === null) return false;

  const q = query as Record<string, unknown>;
  return (
    (q.txid === undefined || typeof q.txid === 'string') &&
    (q.uhrpUrl === undefined || typeof q.uhrpUrl === 'string') &&
    (q.outputIndex === undefined || typeof q.outputIndex === 'number')
  );
}
