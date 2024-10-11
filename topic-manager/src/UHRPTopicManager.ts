import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { AdmittanceInstructions, TopicManager as OverlayTopicManager } from '@bsv/overlay';
import { EventEmitter } from 'events';
import PushDrop from 'pushdrop';
import { PublicKey, Signature, Hash, PrivateKey } from '@bsv/sdk';

// Get the __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const UHRP_PROTOCOL_ADDRESS = '1UHRPYnMHPuQ5Tgb3AF8JXqwKkmZVy5hG';

export class UHRPTopicManager extends EventEmitter implements OverlayTopicManager {
  
  /**
   * Validates whether a string is a valid URL.
   * @param url - The string to be validated as a URL.
   * @returns boolean - True if the string is a valid URL, false otherwise.
   */
  private isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Identify if the outputs are admissible depending on the particular protocol requirements
   * @param beef - The transaction data in BEEF format
   * @param previousCoins - The previous coins to consider
   * @returns A promise that resolves with the admittance instructions
   */
  async identifyAdmissibleOutputs(beef: number[], previousCoins: number[]): Promise<AdmittanceInstructions> {
    try {
      console.log('Evaluating admissibility of outputs...');

      const pubKey = this.getPublicKeyFromPrivateKey(); // Use derived public key from private key

      const outputScriptBuffer = Buffer.from(beef);
      const fields = this.decodeOutputScript(outputScriptBuffer); // Use the custom decoding function

      console.log('Decoded Fields:', fields);

      const isAdmissible = this.evaluateCommitment(fields, pubKey); // Use the extracted public key
      if (isAdmissible) {
        const txid = this.extractTxid(beef);
        const outputIndex = this.extractOutputIndex(beef);

        this.emitAdmissibilityEvent({
          txid,
          outputIndex,
          outputScript: outputScriptBuffer.toString('hex'),
        });

        return {
          outputsToAdmit: [outputIndex],
          coinsToRetain: [],
        };
      }

      return {
        outputsToAdmit: [],
        coinsToRetain: [],
      };
    } catch (error) {
      console.error('Error identifying admissible outputs:', error);
      throw error;
    }
  }

  /// Custom function to decode the output script into individual fields
  private decodeOutputScript(outputScript: Buffer): Buffer[] {
    const fields: Buffer[] = [];
    let i = 0;

    // Loop through the output script buffer to extract fields
    while (i < outputScript.length) {
      const length = outputScript[i]; // Assume the first byte represents the field length
      const field = outputScript.slice(i + 1, i + 1 + length); // Extract the field based on length
      fields.push(field);
      i += 1 + length; // Move to the next field
    }

    // Log the field lengths and raw data to debug potential misinterpretations
    fields.forEach((field, index) => {
      const fieldAsString = field.toString('utf8'); // For text-based fields
      const fieldAsHex = field.toString('hex');     // For fields that should be hex
      console.log(`Field ${index} length:`, field.length, 'Raw Data (UTF-8):', fieldAsString, 'Raw Data (Hex):', fieldAsHex);
    });

    return fields;
  }

  private evaluateCommitment(fields: Buffer[], pubKey: PublicKey): boolean {
    try {
      console.log('Starting commitment evaluation...');
  
      // Log all fields to see their contents before validation
      console.log('Logging all fields in the output script:');
      fields.forEach((field, index) => {
        console.log(`Field ${index} - Length: ${field.length}`);
        console.log(`Field ${index} Raw Data (UTF-8):`, field.toString('utf8'));
        console.log(`Field ${index} Raw Data (Hex):`, field.toString('hex'));
      });
  
      // Check each field to see if it matches the expected UHRP protocol address
      console.log('Checking for the UHRP Protocol Address...');
      let protocolAddressFieldFound = false;
  
      fields.forEach((field, index) => {
        if (field.toString('utf8') === UHRP_PROTOCOL_ADDRESS) {
          console.log(`Protocol Address found in Field ${index}: ${field.toString('utf8')}`);
          protocolAddressFieldFound = true;
        }
      });
  
      if (!protocolAddressFieldFound) {
        console.error('Protocol Address not found in any of the fields.');
        throw new Error('Invalid UHRP protocol address.');
      }
  
      // Step 1: Validate the UHRP protocol address
      console.log('Field 0 (UHRP Protocol Address) Raw Data (UTF-8):', fields[0].toString('utf8'), 'Hex:', fields[0].toString('hex'));
      if (fields[0].toString('utf8') !== UHRP_PROTOCOL_ADDRESS) {
        console.error('Invalid UHRP Protocol Address:', fields[0].toString('utf8'));
        console.error('Expected UHRP Protocol Address:', UHRP_PROTOCOL_ADDRESS);
        throw new Error('Invalid UHRP protocol address.');
      }
  
      // Step 2: Validate the SHA-256 hash
      const hash = fields[2].toString('hex');
      console.log('Extracted Hash:', hash);
      if (!this.isValidSHA256(hash)) {
        console.log('Invalid SHA256 Hash:', hash);
        throw new Error('Invalid SHA256 hash.');
      }
  
      // Step 3: Validate the URL
      const url = fields[4].toString('utf8');
      console.log('Extracted URL:', url);
      if (!this.isValidURL(url)) {
        console.log('Invalid URL:', url);
        throw new Error('Invalid URL.');
      }
  
      // Step 4: Check the expiry time
      const expiryTime = parseInt(fields[5].toString('utf8'), 10);
      const currentTime = Math.floor(Date.now() / 1000);
      console.log('Expiry Time:', expiryTime, 'Current Time:', currentTime);
      if (expiryTime <= currentTime) {
        console.log('Timestamp expired:', expiryTime, 'is less than or equal to', currentTime);
        throw new Error('Invalid or expired timestamp.');
      }
  
      // Step 5: Validate the file size
      const fileSize = parseInt(fields[6].toString('utf8'), 10);
      console.log('File Size:', fileSize);
      if (fileSize <= 0) {
        console.log('Invalid File Size:', fileSize);
        throw new Error('Invalid file size.');
      }
  
      // Step 6: Verify the signature
      const signatureBuffer = fields[7];
      console.log('Signature Buffer (Hex):', signatureBuffer.toString('hex'));
  
      const message = Buffer.concat(fields.slice(0, 7));
      console.log('Message to Verify (Concatenated Fields):', message.toString('hex'));
  
      // Hash the message using Hash.sha256
      const sha256Message = Hash.sha256(Array.from(message)); // Convert message to number[] and hash it
      console.log('Hashed Message (SHA-256):', sha256Message.toString());
  
      // Convert the signature buffer to a Signature object
      const signature = Signature.fromDER(Array.from(signatureBuffer));
      console.log('Converted Signature (from DER):', signature);
  
      // Verify the signature using the provided public key
      const isSignatureValid = pubKey.verify(sha256Message, signature);
      console.log('Signature Validity:', isSignatureValid);
  
      if (!isSignatureValid) {
        console.log('Signature Failed Verification:', signature);
        throw new Error('Invalid signature.');
      }
  
      console.log('Commitment is valid');
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
      const publicKey = privateKey.toPublicKey();
      console.log('Derived public key from private key:', publicKey.toString());
      return publicKey;
    } catch (error) {
      console.error('Error deriving public key from private key:', error);
      throw new Error('Failed to derive public key from private key.');
    }
  }

  private emitAdmissibilityEvent(eventData: any): void {
    console.log('Emitting admissibility event:', eventData);
    this.emit('admissibility', eventData);
  }

  private isValidSHA256(hash: string): boolean {
    const isValid = /^[a-f0-9]{64}$/.test(hash);
    console.log('Is valid SHA256 hash:', isValid, 'Hash:', hash);
    return isValid;
  }

  private extractTxid(beef: number[]): string {
    const txidBuffer = Buffer.from(beef.slice(0, 32));
    return txidBuffer.toString('hex');
  }

  private extractOutputIndex(beef: number[]): number {
    return beef[32];
  }

  async getDocumentation(): Promise<string> {
    return 'UHRP Topic Manager Documentation';
  }

  async getMetaData(): Promise<{ name: string; shortDescription: string; iconURL?: string; version?: string; informationURL?: string }> {
    return {
      name: 'UHRP Topic Manager',
      shortDescription: 'Handles admissibility of outputs for the UHRP protocol.',
      version: '1.0.0',
      informationURL: 'https://example.com/uhrp-topic-manager',
    };
  }
}
