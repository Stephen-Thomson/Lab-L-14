import { createAction, toBEEFfromEnvelope, EnvelopeEvidenceApi } from '@babbage/sdk-ts';
import { getURLForFile, getHashFromURL } from 'uhrp-url';
import pushdrop from 'pushdrop';
import { Buffer } from 'buffer';
import { v4 as uuidv4 } from 'uuid'; // Import uuidv4 to generate unique key IDs

// Define the expected structure of the result
interface UHRPResponse {
  uhrpURL: string; // The UHRP URL returned from the server
}

// 1. Generate a unique key ID for each commitment
const generateUniqueKeyID = () => {
  return uuidv4();
};

/**
 * Publishes a file hosting commitment.
 * @param {string} url - The URL of the file to be committed.
 * @param {number} hostingMinutes - Duration for committing to hosting the file at the given url.
 * @param {string} address - Address associated with the commitment.
 * @param {string} serviceURL - The overlay service URL where the commitment is submitted.
 * @returns {Promise<string>} - The UHRP URL of the published commitment.
 */
export async function publishCommitment({
  url,
  hostingMinutes,
  address,
  serviceURL = 'https://staging-overlay.babbage.systems',
}: {
  url: string;
  hostingMinutes: number;
  address: string;
  serviceURL?: string;
}): Promise<string> {
  console.log('publishCommitment function is being called');
  try {
    console.log('Step 1: Fetching file from URL:', url);
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch the file');
    const fileBlob = await response.blob();
    console.log('File fetched successfully, size:', fileBlob.size);

    console.log('Step 2: Converting Blob to Buffer');
    const arrayBuffer = await fileBlob.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    console.log('Buffer created, size:', fileBuffer.length);

    console.log('Step 3: Generating UHRP URL');
    const uhrpURL = getURLForFile(fileBuffer);
    console.log('UHRP URL generated:', uhrpURL);

    console.log('Step 4: Generating hash from UHRP URL');
    const hash = getHashFromURL(uhrpURL);
    console.log('Hash generated:', hash);

    console.log('Step 5: Calculating expiry time');
    const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
    const expiryTime = currentTime + hostingMinutes * 60;
    console.log('Expiry time calculated:', expiryTime);

    // Validate if the expiry time is in the past or invalid
    if (expiryTime <= currentTime) {
      console.log('Invalid or expired timestamp:', expiryTime);
      throw new Error('Invalid or expired timestamp.');
    }

    console.log('Step 6: Generating unique key ID for the commitment');
    const keyID = generateUniqueKeyID();
    console.log('Key ID generated:', keyID);

    console.log('Step 7: Creating output script using pushdrop');
    const outputScript = await pushdrop.create({
      fields: [
        '1UHRPYnMHPuQ5Tgb3AF8JXqwKkmZVy5hG', // Add UHRP protocol address as the first field
        address,
        hash,
        'advertise',
        url,
        expiryTime.toString(),
        fileBuffer.length.toString(),
      ],
      protocolID: 'UHRP File Commitment',
      keyID,
    });
    console.log('Output script created:', outputScript.toString('hex'));

    console.log('Step 8: Building blockchain transaction using createAction');
    const action = await createAction({
      outputs: [
        {
          satoshis: 1000,
          script: outputScript,
          basket: 'tm_uhrp',
          customInstructions: JSON.stringify({ url, hostingMinutes, address }),
        },
      ],
      description: 'Submitting a new file storage commitment',
    });
    console.log('Action created:', action);

    // Check if action includes rawTx, inputs, and txid
    if (!action.rawTx || !action.txid) {
      throw new Error('Missing values in action: rawTx or txid');
    }

    const inputs: Record<string, EnvelopeEvidenceApi> = action.inputs
      ? (action.inputs as Record<string, EnvelopeEvidenceApi>)
      : {};

    console.log('Action rawTx:', action.rawTx);
    console.log('Action inputs:', inputs);
    console.log('Action txid:', action.txid);

    // Convert the action to BEEF format before submitting
    console.log('Step 9: Converting action to BEEF format');
    const beef = toBEEFfromEnvelope({
      rawTx: action.rawTx,
      inputs: inputs,
      txid: action.txid,
    }).beef;

    console.log('BEEF format generated:', beef);
    console.log('BEEF data to submit:', beef);
    console.log('Submitting to serviceURL:', serviceURL);

    // Submitting UHRP advertisement token data to the overlay in BEEF format
    console.log('Step 10: Submitting BEEF data to overlay');
    console.log('BEEF data being submitted:', beef);
    console.log('Request Headers:', {
      'Content-Type': 'application/octet-stream',
      'X-Topics': JSON.stringify(['tm_uhrp']),
    });
    console.log('Submitting to serviceURL:', `${serviceURL}/submit`);

    const responseData = await fetch(`${serviceURL}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Topics': JSON.stringify(['tm_uhrp']),
      },
      body: Buffer.isBuffer(beef) ? beef : Buffer.from(beef), 
    });

    console.log('Response status:', responseData.status);
    console.log('Response headers:', responseData.headers);

    const responseBody = await responseData.text();
    console.log('Response body:', responseBody);

    if (!responseData.ok) {
      console.log('Error details: Response not OK, status:', responseData.status);
      throw new Error('Failed to submit UHRP advertisement');
    }

    let result: UHRPResponse;
    try {
      result = JSON.parse(responseBody) as UHRPResponse;
    } catch (error) {
      console.error('Failed to parse response as JSON:', error);
      throw new Error('Unexpected response format');
    }

    console.log('Response received from overlay:', result);

    return result.uhrpURL;

  } catch (error) {
    console.error('Error creating commitment:', error);
    throw error;
  }
}

