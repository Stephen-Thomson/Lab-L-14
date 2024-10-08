// Define the structure of a file storage commitment in the database
export interface FileCommitment {
  txid: string;                // Transaction ID where the commitment is stored
  outputIndex: number;         // Index of the output in the transaction
  uhrpUrl: string;             // UHRP URL associated with the file storage
  fileHash: string;            // Hash of the file being stored
  retentionPeriod: number;     // Duration for which the file is committed to be stored (in seconds)
  size: number;                // Size of the file in bytes
  createdAt: Date;             // Date when the commitment was created
}

// Query parameters for looking up file commitments by UHRP URL, retention period, or file hash
export interface QueryParams {
  uhrpUrl?: string;            // Optional UHRP URL for querying
  retentionPeriod?: number;    // Optional retention period for querying
  fileHash?: string;           // Optional file hash for querying
}

// Define the response format for querying file storage commitments
export interface FileCommitmentResponse {
  success: boolean;             // Whether the query was successful or not
  data?: FileCommitment | FileCommitment[]; // The file commitment(s) that match the query
  message?: string;             // Error or success message
}
