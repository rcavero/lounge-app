import { create } from "zustand";
import type { SeatWithStatus } from "@/modules/seating/types";
import type { EventWithTeams } from "@/modules/events/types";
import { SEAT_PRICE } from "@/modules/events/types";

interface ReservationState {
  // Current event
  event: EventWithTeams | null;
  setEvent: (event: EventWithTeams | null) => void;

  // Selected seats
  selectedSeats: string[];
  selectSeat: (seatId: string) => void;
  deselectSeat: (seatId: string) => void;
  toggleSeat: (seatId: string) => void;
  clearSelection: () => void;

  // Seat data (for calculating prices)
  seatsData: SeatWithStatus[];
  setSeatsData: (seats: SeatWithStatus[]) => void;

  // Customer info
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  setCustomerInfo: (info: { name: string; email: string; phone: string }) => void;

  // Computed values
  getTotalPrice: () => number;
  getSelectedSeatsData: () => SeatWithStatus[];

  // Reset
  reset: () => void;
}

const initialState = {
  event: null,
  selectedSeats: [],
  seatsData: [],
  customerName: "",
  customerEmail: "",
  customerPhone: "",
};

export const useReservationStore = create<ReservationState>((set, get) => ({
  ...initialState,

  setEvent: (event) => set({ event }),

  selectSeat: (seatId) =>
    set((state) => ({
      selectedSeats: state.selectedSeats.includes(seatId)
        ? state.selectedSeats
        : [...state.selectedSeats, seatId],
    })),

  deselectSeat: (seatId) =>
    set((state) => ({
      selectedSeats: state.selectedSeats.filter((id) => id !== seatId),
    })),

  toggleSeat: (seatId) =>
    set((state) => ({
      selectedSeats: state.selectedSeats.includes(seatId)
        ? state.selectedSeats.filter((id) => id !== seatId)
        : [...state.selectedSeats, seatId],
    })),

  clearSelection: () => set({ selectedSeats: [] }),

  setSeatsData: (seats) => set({ seatsData: seats }),

  setCustomerInfo: ({ name, email, phone }) =>
    set({
      customerName: name,
      customerEmail: email,
      customerPhone: phone,
    }),

  // Total que ve el cliente: ya incluye los gastos de gestión, igual que el cargo que
  // hará Redsys. El importe autoritativo lo recalcula el servidor en initializePayment.
  getTotalPrice: () => {
    const { selectedSeats, event } = get();
    const seatPriceCents = (event?.pricePerSeat ?? SEAT_PRICE) * 100;
    const feeCents = event?.managementFeeCents ?? 0;
    return (selectedSeats.length * (seatPriceCents + feeCents)) / 100;
  },

  getSelectedSeatsData: () => {
    const { selectedSeats, seatsData } = get();
    return seatsData.filter((seat) => selectedSeats.includes(seat.id));
  },

  reset: () => set(initialState),
}));
