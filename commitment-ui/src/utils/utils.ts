/**
 * Validates whether a string is a valid URL.
 * @param url - The string to be validated as a URL.
 * @returns boolean - True if the string is a valid URL, false otherwise.
 */
export function isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  }
  