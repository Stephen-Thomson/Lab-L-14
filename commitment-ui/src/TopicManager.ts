import { PublicKey, Hash, Signature } from '@bsv/sdk';
import { isValidURL } from './utils/utils'; // Helper function for URL validation

const UHRP_PROTOCOL_ADDRESS = '1UHRPYnMHPuQ5Tgb3AF8JXqwKkmZVy5hG';

export class TopicManager {
  // Decodes and validates the storage commitment token
  public static evaluateCommitment(outputScript: Buffer, pubKey: PublicKey): boolean {
    try {
      console.log('Starting commitment evaluation...');

      // Step 1: Decode the output script
      const fields = this.decodeOutputScript(outputScript);
      console.log('Decoded Fields:', fields);

      console.log('Validate the fields');

      // Step 2: Validate the fields
      if (fields[0].toString('utf8') !== UHRP_PROTOCOL_ADDRESS) {
        console.log('Invalid UHRP Protocol Address:', fields[0].toString('utf8'));
        throw new Error('Invalid UHRP protocol address.');
      }

      const hash = fields[2].toString('hex');
      console.log('Extracted Hash:', hash);
      if (!this.isValidSHA256(hash)) {
        console.log('Invalid SHA256 Hash:', hash);
        throw new Error('Invalid SHA256 hash.');
      }

      const url = fields[4].toString('utf8');
      console.log('Extracted URL:', url);
      if (!isValidURL(url)) {
        console.log('Invalid URL:', url);
        throw new Error('Invalid URL.');
      }

      const expiryTime = parseInt(fields[5].toString('utf8'), 10);
      const currentTime = Math.floor(Date.now() / 1000);
      console.log('Expiry Time:', expiryTime, 'Current Time:', currentTime);
      if (expiryTime <= currentTime) {
        console.log('Timestamp expired:', expiryTime, 'is less than or equal to', currentTime);
        throw new Error('Invalid or expired timestamp.');
      }

      const fileSize = parseInt(fields[6].toString('utf8'), 10);
      console.log('File Size:', fileSize);
      if (fileSize <= 0) {
        console.log('Invalid File Size:', fileSize);
        throw new Error('Invalid file size.');
      }

      // Step 3: Verify the signature
      const signatureBuffer = fields[7];
      console.log('Signature Buffer:', signatureBuffer);

      const message = Buffer.concat(fields.slice(0, 7));
      console.log('Message to Verify (Concatenated Fields):', message);

      // Hash the message using Hash.sha256
      const sha256Message = Hash.sha256(Array.from(message)); // Convert message to number[] and hash it
      console.log('Hashed Message (SHA-256):', sha256Message);

      // Convert the signature buffer to a Signature object by converting the buffer to an array
      const signature = Signature.fromDER(Array.from(signatureBuffer)); // Convert buffer to number[] and create Signature
      console.log('Converted Signature (from DER):', signature);

      // Verify the signature using the PublicKey
      const isSignatureValid = pubKey.verify(sha256Message, signature);
      console.log('Signature Validity:', isSignatureValid);

      if (!isSignatureValid) {
        console.log('Signature Failed Verification:', signature);
        throw new Error('Invalid signature.');
      }

      console.log('Commitment is valid');
      return true;

    } catch (error) {
      if (error instanceof Error) {
        console.log('Commitment evaluation failed:', error.message);
        console.error('Commitment evaluation failed:', error.message);
      } else {
        console.log('Commitment evaluation failed:', error);
        console.error('Commitment evaluation failed:', error);
      }
      return false;
    }
  }

  // Decodes the PushDrop output script into individual fields
  private static decodeOutputScript(outputScript: Buffer): Buffer[] {
    const fields = [];
    let i = 0;

    while (i < outputScript.length) {
      const length = outputScript[i]; // Length byte
      const field = outputScript.slice(i + 1, i + 1 + length); // Extract field based on length
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

  private static isValidSHA256(hash: string): boolean {
    const isValid = /^[a-f0-9]{64}$/.test(hash);
    console.log('Is valid SHA256 hash:', isValid, 'Hash:', hash); // Log SHA256 validation result
    return isValid;
  }
}
