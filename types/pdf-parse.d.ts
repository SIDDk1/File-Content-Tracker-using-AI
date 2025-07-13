declare module 'pdf-parse' {
  interface PDFParseOptions {
    max?: number;
    version?: string;
  }

  interface PDFInfo {
    PDFFormatVersion: string;
    IsAcroFormPresent: boolean;
    IsXFAPresent: boolean;
    IsCollectionPresent: boolean;
    IsLinearized: boolean;
  }

  interface PDFMetaData {
    [key: string]: string | undefined;
  }

  interface PDFPage {
    num: number;
    text: string;
  }

  interface PDFData {
    numpages: number;
    numrender: number;
    info: PDFInfo;
    metadata?: PDFMetaData;
    text: string;
    version: string;
    outline?: any[];
    formImage?: any;
    pages: PDFPage[];
  }

  function pdf(dataBuffer: Buffer, options?: PDFParseOptions): Promise<PDFData>;

  export = pdf;
}
