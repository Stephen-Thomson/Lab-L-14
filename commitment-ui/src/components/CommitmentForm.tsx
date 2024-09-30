import React, { useState } from 'react';
import { Container, Typography, Box, TextField, Button } from '@mui/material';
import { publishCommitment } from '../utils/publishCommitment';
import { PrivateKey, PublicKey } from '@bsv/sdk';
import crypto from 'crypto';
import bs58 from 'bs58'; // Base58 encoding library

// Function to manually derive a Bitcoin address from the public key
function deriveAddressFromPublicKey(publicKey: PublicKey): string {
  const publicKeyHex = publicKey.toString(); // Get public key as a hex string
  const publicKeyBuffer = Buffer.from(publicKeyHex, 'hex'); // Convert the hex string to a buffer

  // Hash public key with SHA-256, then RIPEMD-160 using Node.js's crypto module
  const sha256Hash = crypto.createHash('sha256').update(publicKeyBuffer).digest();
  const ripemd160Hash = crypto.createHash('ripemd160').update(sha256Hash).digest();

  // Base58Check encode the RIPEMD-160 hash to get the address
  const address = bs58.encode(ripemd160Hash);
  return address;
}

// Utility function to validate URL format
const isValidURL = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch (_) {
    return false;
  }
};

const CommitmentForm: React.FC = () => {
  // State variables to store form input values
  const [fileURL, setFileURL] = useState('');
  const [hostingTime, setHostingTime] = useState('');

  // Ninja Wallet Private Key
  const privateKeyHex = 'bf4d159ac007184e0d458b7d6e3deb0e645269f55f13ba10f24e654ffc194daa';

  // Create PrivateKey object and derive the public key
  const privateKey = PrivateKey.fromString(privateKeyHex, 'hex'); // Convert private key from hex
  const publicKey = PublicKey.fromPrivateKey(privateKey); // Derive public key from private key
  const address = deriveAddressFromPublicKey(publicKey); // Derive Bitcoin address from public key

  // Added console logs to track key and address generation
  console.log('Private Key:', privateKeyHex);
  console.log('Derived Public Key:', publicKey.toString());
  console.log('Derived Address:', address);

  // Form submit handler to publish the file hosting commitment
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
  
    // Validate inputs
    if (!fileURL || !hostingTime) {
      alert('Please provide valid inputs for the file URL and hosting time.');
      return;
    }
  
    // Validate the URL format
    if (!isValidURL(fileURL)) {
      alert('Please provide a valid URL.');
      return;
    }
  
    // Validate hosting time (must be greater than 0)
    const hostingDays = parseInt(hostingTime);
    if (hostingDays <= 0) {
      alert('Hosting time must be greater than 0.');
      return;
    }
  
    try {
      // Convert hosting time to minutes
      const hostingMinutes = hostingDays * 24 * 60;
  
      console.log('File URL:', fileURL);
      console.log('Hosting Time (in days):', hostingTime);
      console.log('Hosting Time (in minutes):', hostingMinutes);
      console.log('Address:', address);
  
      // Call the publishCommitment utility function to submit the commitment
      console.log('Calling publishCommitment with data:');
      console.log({ fileURL, hostingMinutes, address });
  
      const result = await publishCommitment({
        url: fileURL,
        hostingMinutes,
        address, // Use derived address
        serviceURL: 'https://staging-overlay.babbage.systems',
      });
  
      console.log('publishCommitment result:', result);
  
      alert('File storage commitment submitted successfully!');
    } catch (error) {
      // Enhanced error logging
      if (error instanceof Error) {
        console.error('Error submitting file storage commitment:', error.message);
      } else {
        console.error('Unknown error:', error);
      }
      alert('There was an error submitting the commitment.');
    }
  };
  

  return (
    <Container maxWidth="sm">
      <Box mt={5} p={3} border={1} borderRadius={4} borderColor="grey.300">
        <Typography variant="h4" gutterBottom>
          Create File Storage Commitment
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
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
            >
              Submit Commitment
            </Button>
          </Box>
        </form>
      </Box>
    </Container>
  );
};

export default CommitmentForm;
