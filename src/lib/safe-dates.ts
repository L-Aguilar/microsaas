import { format } from "date-fns";
import { es } from "date-fns/locale";

/**
 * Safely creates a Date object from a Unix timestamp
 * @param timestamp Unix timestamp (seconds since epoch) or null
 * @returns Date object or null if invalid
 */
export function safeTimestampToDate(timestamp: number | null | undefined): Date | null {
  if (timestamp === null || timestamp === undefined) {
    return null;
  }
  
  try {
    // Convert Unix timestamp (seconds) to milliseconds
    const date = new Date(timestamp * 1000);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid timestamp:', timestamp);
      return null;
    }
    
    return date;
  } catch (error) {
    console.warn('Error converting timestamp:', timestamp, error);
    return null;
  }
}

/**
 * Safely formats a Unix timestamp
 * @param timestamp Unix timestamp (seconds since epoch) or null
 * @param formatString Format string for date-fns
 * @param fallback Fallback string if date is invalid
 * @returns Formatted date string
 */
export function safeFormatTimestamp(
  timestamp: number | null | undefined, 
  formatString: string = 'dd/MM/yyyy',
  fallback: string = 'N/A'
): string {
  const date = safeTimestampToDate(timestamp);
  
  if (!date) {
    return fallback;
  }
  
  try {
    return format(date, formatString, { locale: es });
  } catch (error) {
    console.warn('Error formatting date:', date, error);
    return fallback;
  }
}

/**
 * Safely sorts an array by a timestamp field
 * @param array Array to sort
 * @param getTimestamp Function to extract timestamp from item
 * @param descending Sort order (newest first by default)
 * @returns Sorted array
 */
export function safeSortByTimestamp<T>(
  array: T[],
  getTimestamp: (item: T) => number | null | undefined,
  descending: boolean = true
): T[] {
  return [...array].sort((a, b) => {
    const timestampA = getTimestamp(a) || 0;
    const timestampB = getTimestamp(b) || 0;
    
    return descending ? timestampB - timestampA : timestampA - timestampB;
  });
}

/**
 * Gets current timestamp as Unix timestamp (seconds)
 * @returns Current Unix timestamp
 */
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}