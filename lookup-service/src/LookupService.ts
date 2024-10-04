import { Db } from 'mongodb';
import { PushDrop } from 'pushdrop'; // Ensure PushDrop is correctly imported
import { FileCommitment, QueryParams, FileCommitmentResponse } from './types.js'; // Import the types created in types.d.ts

export class LookupService {
  private db: Db; // MongoDB instance
  private collectionName = 'fileCommitments'; // Name of the collection in MongoDB

  constructor(db: Db) {
    this.db = db;
  }

  // Handle admissibility events
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

  // Handle spend events (remove spent commitments)
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

  // Handle lookup queries by UHRP URL
  public async findByUHRPUrl(uhrpUrl: string): Promise<FileCommitmentResponse> {
    try {
      const result = await this.db.collection(this.collectionName).findOne({ uhrpUrl });
      if (result) {
        return { success: true, data: result };
      } else {
        return { success: false, message: 'File commitment not found' };
      }
    } catch (error) {
      console.error('Error querying by UHRP URL:', error);
      return { success: false, message: 'Error querying data' };
    }
  }

  // Handle lookup queries by retention period
  public async findByRetentionPeriod(retentionPeriod: number): Promise<FileCommitmentResponse> {
    try {
      const results = await this.db.collection(this.collectionName).find({ retentionPeriod }).toArray();
      if (results.length > 0) {
        return { success: true, data: results };
      } else {
        return { success: false, message: 'No file commitments found for the given retention period' };
      }
    } catch (error) {
      console.error('Error querying by retention period:', error);
      return { success: false, message: 'Error querying data' };
    }
  }

  // Integrate with the Topic Manager
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
