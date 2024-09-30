import { LookupService, LookupQuestion, LookupAnswer, LookupFormula } from '@bsv/overlay'
import { Script } from '@bsv/sdk'
// import pushdrop from 'pushdrop'

/**
 * Implements a UHRP lookup service
 *
 * @public
 */
export class UHRPLookupService implements LookupService {
  /**
   * Constructs a new UHRP Lookup Service instance
   * @param storage - The storage instance to use for managing records
   */
  constructor(public storage: UHRPStorage) { }

  /**
   * Notifies the lookup service of a new output added.
   *
   * @param {string} txid - The transaction ID containing the output.
   * @param {number} outputIndex - The index of the output in the transaction.
   * @param {Script} outputScript - The script of the output to be processed.
   * @param {string} topic - The topic associated with the output.
   *
   * @returns {Promise<void>} A promise that resolves when the processing is complete.
   * @throws Will throw an error if there is an issue with storing the record in the storage engine.
   */
  async outputAdded?(txid: string, outputIndex: number, outputScript: Script, topic: string): Promise<void> {
    throw new Error('Method not implemented.')
  }

  /**
   * Notifies the lookup service that an output was spent
   * @param txid - The transaction ID of the spent output
   * @param outputIndex - The index of the spent output
   * @param topic - The topic associated with the spent output
   */
  async outputSpent?(txid: string, outputIndex: number, topic: string): Promise<void> {
    throw new Error('Method not implemented.')
  }

  /**
   * Notifies the lookup service that an output has been deleted
   * @param txid - The transaction ID of the deleted output
   * @param outputIndex - The index of the deleted output
   * @param topic - The topic associated with the deleted output
   */
  async outputDeleted?(txid: string, outputIndex: number, topic: string): Promise<void> {
    throw new Error('Method not implemented.')
  }

  /**
   * Answers a lookup query
   * @param question - The lookup question to be answered
   * @returns A promise that resolves to a lookup answer or formula
   */
  async lookup(question: LookupQuestion): Promise<LookupAnswer | LookupFormula> {
    throw new Error('Method not implemented.')
  }

  /**
   * Returns documentation specific to this overlay lookup service
   * @returns A promise that resolves to the documentation string
   */
  async getDocumentation(): Promise<string> {
    throw new Error('Method not implemented.')
  }

  /**
   * Returns metadata associated with this lookup service
   * @returns A promise that resolves to an object containing metadata
   * @throws An error indicating the method is not implemented
   */
  async getMetaData(): Promise<{
    name: string
    shortDescription: string
    iconURL?: string
    version?: string
    informationURL?: string
  }> {
    throw new Error('Method not implemented.')
  }
}
