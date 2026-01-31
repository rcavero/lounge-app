export interface RedsysConfig {
  merchantCode: string;
  terminal: string;
  secretKey: string;
  environment: "test" | "production";
}

export interface PaymentRequest {
  reservationId: string;
  amount: number;
  description: string;
  customerEmail: string;
}

export interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  error?: string;
  redirectUrl?: string;
}

export interface RedsysNotification {
  Ds_SignatureVersion: string;
  Ds_MerchantParameters: string;
  Ds_Signature: string;
}
