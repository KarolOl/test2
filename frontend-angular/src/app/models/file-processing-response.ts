export interface FileProcessingResponse {
  firstPdfFile: File;
  secondFile: File | null;
  jsonResult: ProcessingJsonResult;
}

export interface ProcessingJsonResult {
  id: string;
  overallStatus: 'VALID' | 'INVALID';
  warns: string[];
  records: ProcessingRecord[];
}

export interface ProcessingRecord {
  id: string;
  status: string;
  subject: string;
  preson: string;
  optinalData?: ProcessingOptionalData | null;
}

export interface ProcessingOptionalData {
  firstName: string;
  lastName: string;
  surname: string;
  age: number;
  city: string;
  postalCode: string;
}
