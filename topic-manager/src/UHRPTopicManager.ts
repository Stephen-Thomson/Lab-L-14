import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { AdmittanceInstructions, TopicManager as OverlayTopicManager } from '@bsv/overlay';
import { EventEmitter } from 'events';
import PushDrop from 'pushdrop';
import { PublicKey, Signature, Hash, PrivateKey, Transaction } from '@bsv/sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const UHRP_PROTOCOL_ADDRESS = '1UHRPYnMHPuQ5Tgb3AF8JXqwKkmZVy5hG';

export class UHRPTopicManager extends EventEmitter implements OverlayTopicManager {
  
  /**
   * Identifies admissible outputs in a given transaction.
   * @param beef - The transaction data in BEEF format
   * @param previousCoins - Previous coins to consider (if needed)
   * @returns A promise that resolves with the admittance instructions
   */
  async identifyAdmissibleOutputs(beef: number[], previousCoins: number[]): Promise<AdmittanceInstructions> {
    try {
      console.log('Evaluating admissibility of outputs...');
  
      if (!beef || beef.length === 0) {
        throw new Error('The input beef array is empty or invalid.');
      }
  
      const transaction = Transaction.fromBEEF(beef);
      console.log('Parsed Transaction:', transaction);
  
      const admissibleOutputIndexes: number[] = [];
  
      // Iterate over each output to evaluate its admissibility
      transaction.outputs.forEach((output, index) => {
        console.log(`Evaluating output at index ${index}:`, output);
      
        const scriptHex = output.lockingScript.toHex();
        if (!scriptHex || !scriptHex.startsWith('21')) {
          console.warn(`Skipping decoding for non-pushdrop script at index ${index}`);
          return; // Skip if not a valid PushDrop script
        }
      
        try {
          const result = PushDrop.decode({
            script: scriptHex,
            fieldFormat: 'buffer',
          });

          const pubKey = PublicKey.fromString(result.lockingPublicKey)
          const hasValidSignature = pubKey.verify(
            Array.from(Buffer.concat(result.fields)),
            Signature.fromDER(result.signature, 'hex')
          )

          if (!hasValidSignature) {
            throw new Error('Invalid signature.');
          }
      
          const decodedFields = result.fields || [];
          if (!Array.isArray(decodedFields)) {
            throw new Error('Invalid decoded fields.');
          }
      
          console.log('Decoded Fields:', decodedFields);
          
      
          const isAdmissible = this.evaluateCommitment(decodedFields, pubKey);
          if (isAdmissible) {
            admissibleOutputIndexes.push(index);
            console.log(`Output ${index} is admissible.`);
          } else {
            console.log(`Output ${index} is not admissible.`);
          }
        } catch (error) {
          console.error(`Error decoding script for output ${index}:`, error);
        }
      });
      
  
      // Return admittance instructions with admissible outputs
      return {
        outputsToAdmit: admissibleOutputIndexes,
        coinsToRetain: [],
      };
    } catch (error) {
      console.error('Error identifying admissible outputs:', error);
      throw error;
    }
  }

  /**
   * Evaluates the commitment fields for validity.
   */
  private evaluateCommitment(fields: Buffer[], pubKey: PublicKey): boolean {
    try {
      if (fields[0].toString('utf8') !== UHRP_PROTOCOL_ADDRESS) {
        throw new Error('Invalid UHRP protocol address.');
      }
  
      const hash = fields[2]?.toString('hex');
      if (!hash || !this.isValidSHA256(hash)) {
        throw new Error('Invalid SHA256 hash.');
      }
  
      const url = fields[4]?.toString('utf8');
      if (!url || !this.isValidURL(url)) {
        throw new Error('Invalid URL.');
      }
  
      const expiryTime = parseInt(fields[5]?.toString('utf8'), 10);
      if (isNaN(expiryTime) || expiryTime <= Math.floor(Date.now() / 1000)) {
        throw new Error('Timestamp expired.');
      }
  
      const fileSize = parseInt(fields[6]?.toString('utf8'), 10);
      if (isNaN(fileSize) || fileSize <= 0) {
        throw new Error('Invalid file size.');
      }
  
      
  
      
  
      console.log('Commitment is valid.');
      return true;
    } catch (error) {
      console.error('Commitment evaluation failed:', error);
      return false;
    }
  }
  

  private getPublicKeyFromPrivateKey(): PublicKey {
    const privateKeyHex = process.env.SERVER_PRIVATE_KEY;
    if (!privateKeyHex) {
      throw new Error('Private key not found in environment variables.');
    }

    try {
      const privateKey = PrivateKey.fromString(privateKeyHex, 'hex');
      return privateKey.toPublicKey();
    } catch (error) {
      console.error('Error deriving public key:', error);
      throw new Error('Failed to derive public key.');
    }
  }

  private isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private isValidSHA256(hash: string): boolean {
    return /^[a-f0-9]{64}$/.test(hash);
  }

  async getDocumentation(): Promise<string> {
    return 'UHRP Topic Manager Documentation';
  }

  async getMetaData() {
    return {
      name: 'UHRP Topic Manager',
      shortDescription: 'Handles admissibility of outputs for the UHRP protocol.',
      version: '1.0.0',
      informationURL: 'https://example.com/uhrp-topic-manager',
    };
  }
}
