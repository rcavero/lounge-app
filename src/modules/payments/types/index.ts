export interface InitializePaymentResult {
  success: boolean;
  error?: string;
  redsysUrl?: string;
  formBody?: {
    Ds_SignatureVersion: string;
    Ds_MerchantParameters: string;
    Ds_Signature: string;
  };
}

export interface ReservationTicketData {
  id: string;
  eventId: string;
  homeTeamName: string;
  awayTeamName: string;
  eventDate: string; // ISO string
  seats: { id: string; code: string }[];
  totalSeats: number;
  totalPrice: number;
  status: string;
}
