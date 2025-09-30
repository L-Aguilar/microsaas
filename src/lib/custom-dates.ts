/**
 * CUSTOM DATE SYSTEM - NO EXTERNAL DEPENDENCIES
 * Built specifically to avoid RangeError issues
 */

export class SafeDate {
  private timestamp: number;
  
  constructor(input?: string | number | Date | null) {
    if (input === null || input === undefined) {
      this.timestamp = Date.now();
    } else if (typeof input === 'number') {
      // Unix timestamp in seconds - convert to milliseconds
      this.timestamp = input > 9999999999 ? input : input * 1000;
    } else if (typeof input === 'string') {
      // Handle string dates safely
      try {
        if (input.includes('/')) {
          // DD/MM/YYYY format
          const [day, month, year] = input.split('/').map(Number);
          this.timestamp = new Date(year, month - 1, day).getTime();
        } else if (input.includes('-')) {
          // ISO format or YYYY-MM-DD
          this.timestamp = Date.parse(input);
        } else {
          this.timestamp = Date.now();
        }
      } catch {
        this.timestamp = Date.now();
      }
    } else if (input instanceof Date) {
      this.timestamp = input.getTime();
    } else {
      this.timestamp = Date.now();
    }
    
    // Validate timestamp
    if (isNaN(this.timestamp) || this.timestamp < 0) {
      this.timestamp = Date.now();
    }
  }
  
  /**
   * Format to DD/MM/YYYY
   */
  toDisplayString(): string {
    try {
      const date = new Date(this.timestamp);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return 'N/A';
    }
  }
  
  /**
   * Format to DD MMM (for kanban cards)
   */
  toShortString(): string {
    try {
      const date = new Date(this.timestamp);
      const day = String(date.getDate()).padStart(2, '0');
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 
                     'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const month = months[date.getMonth()];
      return `${day} ${month}`;
    } catch {
      return 'N/A';
    }
  }
  
  /**
   * Format to DD de MMMM, YYYY (for detailed views)
   */
  toLongString(): string {
    try {
      const date = new Date(this.timestamp);
      const day = date.getDate();
      const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                     'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      return `${day} de ${month}, ${year}`;
    } catch {
      return 'N/A';
    }
  }
  
  /**
   * Get Unix timestamp (seconds)
   */
  toUnixTimestamp(): number {
    return Math.floor(this.timestamp / 1000);
  }
  
  /**
   * Compare with another SafeDate
   */
  isAfter(other: SafeDate): boolean {
    return this.timestamp > other.timestamp;
  }
  
  isBefore(other: SafeDate): boolean {
    return this.timestamp < other.timestamp;
  }
  
  /**
   * Get native Date object (use with caution)
   */
  toDate(): Date {
    return new Date(this.timestamp);
  }
}

/**
 * Safe date creation from any input
 */
export function createSafeDate(input?: string | number | Date | null): SafeDate {
  return new SafeDate(input);
}

/**
 * Safe date formatting
 */
export function formatSafeDate(input?: string | number | Date | null, format: 'display' | 'short' | 'long' = 'display'): string {
  const safeDate = createSafeDate(input);
  
  switch (format) {
    case 'short':
      return safeDate.toShortString();
    case 'long':
      return safeDate.toLongString();
    default:
      return safeDate.toDisplayString();
  }
}

/**
 * Safe sorting by date
 */
export function sortByDate<T>(
  array: T[], 
  getDateValue: (item: T) => string | number | Date | null,
  descending: boolean = true
): T[] {
  return [...array].sort((a, b) => {
    const dateA = createSafeDate(getDateValue(a));
    const dateB = createSafeDate(getDateValue(b));
    
    return descending 
      ? dateB.toUnixTimestamp() - dateA.toUnixTimestamp()
      : dateA.toUnixTimestamp() - dateB.toUnixTimestamp();
  });
}