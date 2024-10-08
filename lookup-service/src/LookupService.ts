import { Db } from 'mongodb';
import { PushDrop } from 'pushdrop'; // Ensure PushDrop is correctly imported
import { FileCommitment, QueryParams, FileCommitmentResponse } from './types.js'; // Import the types created in types.d.ts
import { LookupQuestion, LookupAnswer, LookupFormula } from '@bsv/overlay'; // Ensure these types are correctly imported

export class LookupService {
  private db: Db; // MongoDB instance
  private collectionName = 'fileCommitments'; // Name of the collection in MongoDB

  constructor(db: Db) {
    this.db = db;
  }

  /**
   * Lookup file commitments using specified criteria
   * This method allows the Engine to look up file storage commitments
   */
  public async lookup(question: LookupQuestion): Promise<LookupAnswer | LookupFormula> {
    try {
      const queryParams = this.convertQuestionToQueryParams(question); // Convert the question to your QueryParams format
      const results = await this.db
        .collection<FileCommitment>(this.collectionName)
        .find(queryParams)
        .toArray();
  
        if (results.length > 0) {
          return {
              type: 'output-list', // Set the response type as an output list
              outputs: results.map(result => ({
                  beef: [], // Assuming 'beef' data is not directly available in the results; adjust as needed
                  outputIndex: result.outputIndex
              }))
          }; // Return the data in the format expected by LookupAnswer
      } else {
          return {
              type: 'freeform', // Set the response type as freeform for error messages
              result: 'No matching file commitments found'
          }; // Return a message in case of no results
      }
    } catch (error) {
      console.error('Error looking up file commitments:', error);
      return {
        type: 'freeform', // Set the response type as freeform for error messages
        result: 'Error looking up file commitments'
      }; // Return an error message in case of an exception
    }
  }
  
  /**
 * Utility method to convert a LookupQuestion to QueryParams format
 * This function maps the properties from the LookupQuestion to QueryParams.
 */
private convertQuestionToQueryParams(question: LookupQuestion): QueryParams {
  // Initialize the query parameters object
  const queryParams: QueryParams = {};

  // Check if the question contains a query object
  if (question.query && typeof question.query === 'object') {
    // Cast the query to a known format for QueryParams (this can vary based on requirements)
    const queryObject = question.query as Record<string, any>;

    // Map specific fields from the question's query to the QueryParams fields as needed
    if (queryObject.uhrpUrl) {
      queryParams.uhrpUrl = queryObject.uhrpUrl;
    }

    if (queryObject.retentionPeriod) {
      queryParams.retentionPeriod = queryObject.retentionPeriod;
    }

    if (queryObject.fileHash) {
      queryParams.fileHash = queryObject.fileHash;
    }
  }

  // Return the constructed QueryParams object
  return queryParams;
}

  /**
   * Get the documentation associated with the LookupService
   * This method provides a description of the LookupService functionality
   */
  public async getDocumentation(): Promise<string> {
    return 'This service handles the lookup of UHRP commitments and supports queries by URL or retention period.';
  }

  /**
   * Get metadata about the LookupService
   * Provides details about the service's name, description, and version
   */
  public async getMetaData(): Promise<{
    name: string;
    shortDescription: string;
    version?: string;
    informationURL?: string;
  }> {
    return {
      name: 'UHRP Lookup Service',
      shortDescription: 'A service for looking up UHRP commitments',
      version: '1.0.0',
      informationURL: 'https://example.com/lookup-service-info',
    };
  }

  /**
   * Handle admissibility events by processing and storing commitments
   * This method is triggered by the Topic Manager when an admissibility event is detected
   */
  public async handleAdmissibilityEvent(eventData: any): Promise<void> {
    try {
      const { txid, outputIndex, outputScript } = eventData;

      // Decode the output script using PushDrop to extract the metadata
      const decoded = PushDrop.decode(outputScript);

      const uhrpUrl = decoded.fields[3]; // Assuming URL is in the 4th field
      const retentionPeriod = parseInt(decoded.fields[5], 10); // Retention period as integer
      const fileHash = decoded.fields[2]; // Assuming file hash is in the 3rd field
      const size = parseInt(decoded.fields[6], 10); // File size as integer

      // Create a new file commitment entry
      const commitment: FileCommitment = {
        txid,
        outputIndex,
        uhrpUrl,
        fileHash,
        retentionPeriod,
        size,
        createdAt: new Date(),
      };

      // Insert into MongoDB
      await this.db.collection(this.collectionName).insertOne(commitment);
      console.log('Admitted new file storage commitment:', commitment);
    } catch (error) {
      console.error('Error processing admissibility event:', error);
    }
  }

  /**
   * Handle spend events to remove commitments from the database
   * This method is triggered by the Topic Manager when a spend event is detected
   */
  public async handleSpendEvent(txid: string, outputIndex: number): Promise<void> {
    try {
      const result = await this.db.collection(this.collectionName).deleteOne({ txid, outputIndex });
      if (result.deletedCount > 0) {
        console.log(`Removed spent file commitment with txid: ${txid}, outputIndex: ${outputIndex}`);
      } else {
        console.log(`No file commitment found for txid: ${txid}, outputIndex: ${outputIndex}`);
      }
    } catch (error) {
      console.error('Error processing spend event:', error);
    }
  }

  /**
   * Query file commitments by UHRP URL
   * This method allows the Engine to look up file storage commitments by URL
   */
  public async findByUHRPUrl(uhrpUrl: string): Promise<FileCommitmentResponse> {
    try {
      const result = await this.db.collection<FileCommitment>(this.collectionName).findOne({ uhrpUrl });
      if (result) {
        return { success: true, data: result as FileCommitment };
      } else {
        return { success: false, message: 'File commitment not found' };
      }
    } catch (error) {
      console.error('Error querying by UHRP URL:', error);
      return { success: false, message: 'Error querying data' };
    }
  }

  /**
   * Query file commitments by retention period
   * This method allows the Engine to find file storage commitments by retention period
   */
  public async findByRetentionPeriod(retentionPeriod: number): Promise<FileCommitmentResponse> {
    try {
      const results = await this.db.collection<FileCommitment>(this.collectionName).find({ retentionPeriod }).toArray();
      if (results.length > 0) {
        return { success: true, data: results as FileCommitment[] };
      } else {
        return { success: false, message: 'No file commitments found for the given retention period' };
      }
    } catch (error) {
      console.error('Error querying by retention period:', error);
      return { success: false, message: 'Error querying data' };
    }
  }

  /**
   * Integrate with the Topic Manager
   * This method is used by the Topic Manager to handle events such as admissibility and spend
   */
  public async handleEvent(event: any): Promise<void> {
    try {
      if (event.type === 'admissibility') {
        await this.handleAdmissibilityEvent(event.data);
      } else if (event.type === 'spend') {
        await this.handleSpendEvent(event.txid, event.outputIndex);
      } else {
        console.error('Unknown event type:', event.type);
      }
    } catch (error) {
      console.error('Error handling event:', error);
    }
  }
}
