import { Db } from 'mongodb';
import pushdrop from 'pushdrop';
import { Script } from '@bsv/sdk';
import { 
  FileCommitment, 
  QueryParams, 
  FileCommitmentResponse 
} from './types.js';
import { 
  LookupService as ILookupService, 
  LookupQuestion, 
  LookupAnswer, 
  LookupFormula 
} from '@bsv/overlay';
import { getURLForHash} from 'uhrp-url';


const { PushDrop } = pushdrop;

export class LookupService implements ILookupService {
  private db: Db;
  private collectionName = 'commitments';

  constructor(db: Db) {
    this.db = db;
    this.ensureIndexes();
  }

  /**
   * Add a new output to the database.
   */
  public async outputAdded(
    txid: string,
    outputIndex: number,
    outputScript: Script,
    topic: string
  ): Promise<void> {
    try {
      // Convert the output script to a buffer
      const scriptHex = outputScript.toHex();
      if (!scriptHex || !scriptHex.startsWith('21')) {  // Check if it's a valid PushDrop script
        console.warn(`Skipping decoding for non-pushdrop script at index ${outputIndex}`);
        return; // Skip decoding if it's not a PushDrop script
      }
  
      // Decode the script using PushDrop
      let decoded;
      try {
        decoded = pushdrop.decode({script:scriptHex, fieldFormat:'buffer'}); // Ensure decode only happens here
        console.log('Decoded PushDrop output:', decoded);
      } catch (decodeError) {
        console.error('Error decoding script with PushDrop:', decodeError);
        return; // Skip further processing if decoding fails
      }
  
      // Validate the decoded fields
      const decodedFields = decoded.fields || [];
      if (!Array.isArray(decodedFields) || decodedFields.length < 7) {
        console.error('Decoded fields missing or invalid:', decoded);
        return; // Skip this output if fields are invalid
      }
  
      // Log all fields to inspect the contents
      decodedFields.forEach((field: Buffer, index: number) => {
        console.log(`Field ${index}:`, field ? field.toString('utf8') : 'undefined');
      });
  
      // Extract and parse the necessary fields
      const fileHash = decodedFields[2]?.toString('hex');
      const uhrpUrl = getURLForHash(fileHash);
      const retentionPeriod = parseInt(decodedFields[5]?.toString('utf8'), 10);
      const size = parseInt(decodedFields[6]?.toString('utf8'), 10);
  
      console.log('Parsed values:', { uhrpUrl, fileHash, retentionPeriod, size });
  
      // Validate parsed data to avoid insertion of invalid entries
      if (!uhrpUrl || !fileHash || isNaN(retentionPeriod) || isNaN(size)) {
        console.error('Invalid parsed data:', { uhrpUrl, fileHash, retentionPeriod, size });
        return; // Skip insertion if the parsed data is invalid
      }
  
      // Create the commitment object to be inserted into the database
      const commitment: FileCommitment = {
        txid,
        outputIndex,
        uhrpUrl,
        fileHash,
        retentionPeriod,
        size,
        createdAt: new Date(),
      };
  
      // Insert the parsed data into the database
      await this.db.collection(this.collectionName).insertOne(commitment);
      console.log('Output added successfully:', commitment);
  
    } catch (error) {
      console.error('Error adding output:', error);
    }
  }
  
  
  
  

  /**
   * Remove an output when it is spent.
   */
  public async outputSpent(
    txid: string, 
    outputIndex: number, 
    topic: string
  ): Promise<void> {
    try {
      const result = await this.db
        .collection(this.collectionName)
        .deleteOne({ txid, outputIndex });

      if (result.deletedCount > 0) {
        console.log(`Removed spent commitment: txid=${txid}, outputIndex=${outputIndex}`);
      } else {
        console.log(`No commitment found for txid=${txid}, outputIndex=${outputIndex}`);
      }
    } catch (error) {
      console.error('Error removing spent output:', error);
    }
  }

  /**
   * Lookup commitments based on the given query.
   */
  public async lookup(
    question: LookupQuestion
  ): Promise<LookupAnswer | LookupFormula> {
    try {
      const queryParams = this.convertQuestionToQueryParams(question);
      const results = await this.db
        .collection<FileCommitment>(this.collectionName)
        .find(queryParams)
        .toArray();

      if (results.length > 0) {
        return {
          type: 'output-list',
          outputs: results.map(result => ({
            beef: [],
            outputIndex: result.outputIndex,
          })),
        };
      } else {
        return { type: 'freeform', result: 'No matching file commitments found' };
      }
    } catch (error) {
      console.error('Error during lookup:', error);
      return { type: 'freeform', result: 'Error during lookup' };
    }
  }

  /**
   * Convert a LookupQuestion to QueryParams.
   */
  private convertQuestionToQueryParams(
    question: LookupQuestion
  ): QueryParams {
    const queryParams: QueryParams = {};

    if (question.query && typeof question.query === 'object') {
      const queryObject = question.query as Record<string, any>;
      if (queryObject.uhrpUrl) queryParams.uhrpUrl = queryObject.uhrpUrl;
      if (queryObject.retentionPeriod) queryParams.retentionPeriod = queryObject.retentionPeriod;
      if (queryObject.fileHash) queryParams.fileHash = queryObject.fileHash;
    }

    return queryParams;
  }

  /**
   * Get metadata about the service.
   */
  public async getMetaData() {
    return {
      name: 'UHRP Lookup Service',
      shortDescription: 'Service for looking up UHRP commitments',
      version: '1.0.0',
      informationURL: 'https://example.com/lookup-service-info',
    };
  }

  /**
   * Get service documentation.
   */
  public async getDocumentation(): Promise<string> {
    return 'This service handles UHRP commitments and supports queries by URL and retention period.';
  }

  /**
   * Handle events such as admissibility or spend.
   */
  public async handleEvent(event: any): Promise<void> {
    try {
      if (event.type === 'admissibility') {
        await this.outputAdded(
          event.data.txid,
          event.data.outputIndex,
          event.data.outputScript,
          event.data.topic
        );
      } else if (event.type === 'spend') {
        await this.outputSpent(event.txid, event.outputIndex, event.topic);
      } else {
        console.error('Unknown event type:', event.type);
      }
    } catch (error) {
      console.error('Error handling event:', error);
    }
  }

  /**
   * Create unique indexes on (txid, outputIndex) to prevent duplicates.
   */
  private async ensureIndexes(): Promise<void> {
    try {
      await this.db.collection(this.collectionName).createIndex(
        { txid: 1, outputIndex: 1 },
        { unique: true }
      );
      console.log('Indexes ensured.');
    } catch (error) {
      console.error('Error ensuring indexes:', error);
    }
  }
}
