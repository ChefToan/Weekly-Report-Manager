export interface Resident {
  id: string;
  emplId: string;
  name: string;
  email?: string;
  room?: string;
  floor?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Interaction {
  id: string;
  residentId: string;
  residentEmplId: string;
  date: Date;
  details: string;
  isSubmitted: boolean;
  weekStarting: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface WeeklyReport {
  weekStarting: Date;
  requiredInteractions: Interaction[];
  additionalInteractions: Interaction[];
}

export interface ProgressStats {
  totalResidents: number;
  totalInteractions: number;
  requiredInteractions: number;
  completionPercentage: number;
  interactionsPerResident: { [residentId: string]: number };
}

export interface ImportResult {
  success: boolean;
  imported: number;
  errors: string[];
}