export interface TillRowData {
  id: string;
  name: string; // e.g. "Till 1", "Till 2", "Till 3", "Till 4", "YARD"
  isYard?: boolean; // Yard row might only have variance or specific fields
  col1ExpectedCash: number; // Col 1: System Cash Takings
  col2ExpectedCard: number; // Col 2: System Card Takings
  col4BankingCash: number;  // Col 4: Cash Banked
  col5FloatCash: number;    // Col 5: Cash Float / Remaining Cash
  col6ActualCard: number;   // Col 6: Card Machine PDQ Total
  customVariance?: number;  // Optional manual variance override for special rows like YARD
  prevFloat?: number;       // Previous day's float (5) carried over for this till
}

export interface SheetRecord {
  id: string;
  date: string; // YYYY-MM-DD format for input/sort, display as DD/MM/YYYY
  operator?: string; // Selected operator / cashier / manager
  isSaved: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  rows: TillRowData[];
}

export interface GrandTotals {
  totalCol1Cash: number;
  totalCol2Card: number;
  totalCol3Expected: number;
  totalCol4Banking: number;
  totalCol5Float: number;
  totalCol6Card: number;
  totalCol7Actual: number;
  totalVariance: number;
}

export interface DenominationCounts {
  fiftyPounds: number;  // £50
  twentyPounds: number; // £20
  tenPounds: number;    // £10
  fivePounds: number;   // £5
  twoPounds: number;    // £2
  onePound: number;     // £1
  fiftyPence: number;   // 50p
  twentyPence: number;  // 20p
  tenPence: number;     // 10p
  fivePence: number;    // 5p
  twoPence: number;     // 2p
  onePence: number;     // 1p
}

export type ViewMode = 'classic' | 'modern';
export type ActiveTab = 'sheet' | 'records' | 'weekly';
