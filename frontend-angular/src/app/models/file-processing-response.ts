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
}
