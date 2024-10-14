import { LookupService, LookupQuestion, LookupAnswer, LookupFormula } from '@bsv/overlay';
import { Script } from '@bsv/sdk';

interface UHRPStorage {
  saveRecord(record: any): Promise<void>;
  getRecord(query: any): Promise<any>;
  deleteRecord(id: string): Promise<void>;
}

/**
 * Implements a UHRP lookup service
 */
export class UHRPLookupService implements LookupService {
  constructor(public storage: UHRPStorage) {}

  async outputAdded(
    txid: string, 
    outputIndex: number, 
    outputScript: Script, 
    topic: string
  ): Promise<void> {
    const record = {
      txid,
      outputIndex,
      script: outputScript.toHex(),
      topic,
      createdAt: new Date(),
    };
    await this.storage.saveRecord(record);
  }

  async outputSpent(txid: string, outputIndex: number, topic: string): Promise<void> {
    await this.storage.deleteRecord(`${txid}-${outputIndex}`);
  }

  async lookup(question: LookupQuestion): Promise<LookupAnswer | LookupFormula> {
    const query = question.query as Record<string, any>;
    const result = await this.storage.getRecord(query);

    if (result) {
      return {
        type: 'output-list',
        outputs: [{ outputIndex: result.outputIndex, beef: [] }],
      };
    }
    return { type: 'freeform', result: 'No matching commitments found' };
  }

  async getDocumentation(): Promise<string> {
    return 'This service supports UHRP commitments.';
  }

  async getMetaData() {
    return {
      name: 'UHRP Lookup Service',
      shortDescription: 'Manages and queries UHRP commitments',
      version: '1.0.0',
    };
  }
}
