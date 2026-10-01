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
  /** Nombre o alias que escribió el cliente. "Cliente" en las reservas antiguas. */
  customerName: string;
  homeTeamName: string;
  awayTeamName: string;
  eventDate: string; // ISO string
  seats: { id: string; code: string }[];
  totalSeats: number;
  totalPrice: number;
  // Desglose congelado en la reserva (céntimos por asiento), para el ticket
  seatPriceCents: number;
  managementFeeCents: number;
  status: string;
  /**
   * Cobrada y anulada: el pago llegó con la reserva caducada y sus asientos ya eran de
   * otro. Hay que devolver el dinero (RCA-276).
   */
  needsRefund: boolean;
  // Recibo de pago (Ds_AuthorisationCode, Ds_Date + Ds_Hour, Ds_Response). Son null
  // mientras no llegue una notificación firmada de Redsys: en las reservas anteriores
  // a esta funcionalidad y en los entornos donde el webhook no alcanza al servidor.
  authorisationCode: string | null;
  paymentDateTime: string | null;
  paymentResponseCode: string | null;
}
