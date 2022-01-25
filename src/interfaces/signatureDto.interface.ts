export interface SignatureDto {
  blockTime: number;
  confirmationStatus: string;
  err?: any;
  memo?: string;
  signature: string;
  slot: number;
}