import React, { useState } from 'react';
import { Container, Typography, Box, TextField, Button } from '@mui/material';
import { publishCommitment } from '../utils/publishCommitment';
import { UHRPLookupService } from '../../../lookup-service/src/UHRPLookupService'; // Import the service
import { PrivateKey, PublicKey } from '@bsv/sdk';
import crypto from 'crypto';
import bs58 from 'bs58';

// Mock storage for testing purposes
const mockStorage = {
  saveRecord: async (record: any) => console.log('Saved:', record),
  getRecord: async (query: any) => ({ outputIndex: 0, uhrpUrl: query.uhrpUrl }),
  deleteRecord: async (id: string) => console.log('Deleted:', id),
};

// Initialize UHRPLookupService with the mock storage
const lookupService = new UHRPLookupService(mockStorage);

// Function to derive a Bitcoin address from a public key
function deriveAddressFromPublicKey(publicKey: PublicKey): string {
  const publicKeyBuffer = Buffer.from(publicKey.toString(), 'hex');
  const sha256Hash = crypto.createHash('sha256').update(publicKeyBuffer).digest();
  const ripemd160Hash = crypto.createHash('ripemd160').update(sha256Hash).digest();
  return bs58.encode(ripemd160Hash);
}

// Utility function to validate URLs
const isValidURL = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const CommitmentForm: React.FC = () => {
  const [fileURL, setFileURL] = useState('');
  const [hostingTime, setHostingTime] = useState('');
  const [uhrpUrl, setUhrpUrl] = useState(''); // Store the UHRP URL
  const [lookupResult, setLookupResult] = useState<any>(null);

  const privateKeyHex = 'bf4d159ac007184e0d458b7d6e3deb0e645269f55f13ba10f24e654ffc194daa';
  const privateKey = PrivateKey.fromString(privateKeyHex, 'hex');
  const publicKey = PublicKey.fromPrivateKey(privateKey);
  const address = deriveAddressFromPublicKey(publicKey);

  console.log('Derived Address:', address);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!fileURL || !hostingTime || !isValidURL(fileURL)) {
      alert('Please provide valid inputs.');
      return;
    }

    const hostingMinutes = parseInt(hostingTime) * 24 * 60;

    try {
      console.log('Submitting commitment:', { fileURL, hostingMinutes, address });

      const result = await publishCommitment({
        url: fileURL,
        hostingMinutes,
        address,
        topics: ['tm_uhrp'],
        serviceURL: 'http://localhost:8081',
      });

      console.log('Publish result:', result);
      setUhrpUrl(result); // Store the UHRP URL for lookup
      alert('Commitment submitted successfully!');
    } catch (error) {
      console.error('Error submitting commitment:', error);
      alert('Failed to submit the commitment.');
    }
  };

  const handleLookup = async () => {
    try {
      console.log('Looking up commitment with UHRP URL:', uhrpUrl);
      const question = { service: 'UHRPLookupService', query: { uhrpUrl } };
      const result = await lookupService.lookup(question); // Perform lookup using UHRP URL
      setLookupResult(result);
      console.log('Lookup result:', result);
    } catch (error) {
      console.error('Error performing lookup:', error);
      alert('Lookup failed.');
    }
  };

  return (
    <Container maxWidth="sm">
      <Box mt={5} p={3} border={1} borderRadius={4} borderColor="grey.300">
        <Typography variant="h4" gutterBottom>
          Create & Lookup File Storage Commitment
        </Typography>
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="File URL"
            value={fileURL}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFileURL(e.target.value)}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Hosting Time (in days)"
            type="number"
            value={hostingTime}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHostingTime(e.target.value)}
            margin="normal"
            required
          />
          <Box mt={3}>
            <Button type="submit" variant="contained" color="primary" fullWidth>
              Submit Commitment
            </Button>
          </Box>
        </form>

        <Box mt={3}>
          <Button variant="outlined" color="secondary" fullWidth onClick={handleLookup}>
            Lookup Commitment by UHRP URL
          </Button>
        </Box>

        {lookupResult && (
          <Box mt={3} p={2} border={1} borderRadius={4} borderColor="grey.400">
            <Typography variant="h6">Lookup Result:</Typography>
            <pre>{JSON.stringify(lookupResult, null, 2)}</pre>
          </Box>
        )}
      </Box>
    </Container>
  );
};

export default CommitmentForm;
