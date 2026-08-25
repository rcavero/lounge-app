"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle, Download, Home, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReservationTicketData } from "@/modules/payments/types";
import { formatEuros } from "@/lib/utils";

interface Props {
  reservation: ReservationTicketData;
  orderId: string;
}

export function ConfirmationClient({ reservation, orderId }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const hasAutoDownloaded = useRef(false);

  const eventDate = new Date(reservation.eventDate);
  const formattedDate = format(eventDate, "EEE d MMM yyyy • HH:mm", {
    locale: es,
  });

  const handleDownloadTicket = async ({
    openInNewTab = false,
  }: { openInNewTab?: boolean } = {}) => {
    setIsGenerating(true);
    try {
      const { jsPDF } = await import("jspdf");
      const QRCode = await import("qrcode");

      const reservationUrl = `${window.location.origin}/admin/reservas/${reservation.eventId}/${reservation.id}`;
      const qrDataUrl = await QRCode.toDataURL(reservationUrl, {
        width: 200,
        margin: 1,
      });

      const ticketWidth = 80;
      const margin = 5;
      const qrSize = 35;
      const seatsHeight = Math.ceil(reservation.seats.length / 3) * 5;
      // El desglose solo se imprime si hubo gastos de gestión; sin ellos el ticket queda
      // idéntico al de siempre. Las dos filas ocupan 9 mm: si no se amplía el lienzo
      // (que es de alto fijo), el QR se recorta por abajo.
      const hasFee = reservation.managementFeeCents > 0;
      const ticketHeight = 98 + seatsHeight + qrSize + (hasFee ? 9 : 0);

      const doc = new jsPDF({
        unit: "mm",
        format: [ticketWidth, ticketHeight],
      });

      let yPos = 8;

      // Header
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("THE LOUNGE", ticketWidth / 2, yPos, { align: "center" });
      yPos += 4;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text("BEERHOUSE • VALENCIA", ticketWidth / 2, yPos, {
        align: "center",
      });

      yPos += 5;
      doc.setLineWidth(0.3);
      doc.setLineDashPattern([1, 1], 0);
      doc.line(margin, yPos, ticketWidth - margin, yPos);
      doc.setLineDashPattern([], 0);

      // Match info
      yPos += 6;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(reservation.homeTeamName, ticketWidth / 2, yPos, {
        align: "center",
      });
      yPos += 4;
      doc.setFontSize(8);
      doc.text("vs", ticketWidth / 2, yPos, { align: "center" });
      yPos += 4;
      doc.setFontSize(10);
      doc.text(reservation.awayTeamName, ticketWidth / 2, yPos, {
        align: "center",
      });

      // Date and time
      const dateStr = format(eventDate, "EEE d MMM yyyy", { locale: es });
      const timeStr = format(eventDate, "HH:mm");

      yPos += 6;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`${dateStr} • ${timeStr}h`, ticketWidth / 2, yPos, {
        align: "center",
      });

      // Dashed line
      yPos += 5;
      doc.setLineDashPattern([1, 1], 0);
      doc.line(margin, yPos, ticketWidth - margin, yPos);
      doc.setLineDashPattern([], 0);

      // Reservation ID
      yPos += 5;
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(`Reserva: ${reservation.id}`, ticketWidth / 2, yPos, {
        align: "center",
      });

      // Seats
      yPos += 6;
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("ASIENTOS", ticketWidth / 2, yPos, { align: "center" });

      yPos += 4;
      doc.setFont("helvetica", "normal");
      const seatCodes = reservation.seats.map((s) => s.code);
      const seatsPerLine = 3;
      for (let i = 0; i < seatCodes.length; i += seatsPerLine) {
        const lineSeats = seatCodes.slice(i, i + seatsPerLine).join("  •  ");
        doc.text(lineSeats, ticketWidth / 2, yPos, { align: "center" });
        yPos += 5;
      }

      // Dashed line before totals
      yPos += 2;
      doc.setLineDashPattern([1, 1], 0);
      doc.line(margin, yPos, ticketWidth - margin, yPos);
      doc.setLineDashPattern([], 0);

      // Totals
      yPos += 6;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(
        `${reservation.totalSeats} asiento${reservation.totalSeats !== 1 ? "s" : ""}`,
        ticketWidth / 2,
        yPos,
        { align: "center" }
      );

      yPos += 7;
      doc.setFontSize(14);
      doc.text(`TOTAL: ${formatEuros(reservation.totalPrice)}€`, ticketWidth / 2, yPos, {
        align: "center",
      });

      // Breakdown of that total: what is discountable and what is not
      if (hasFee) {
        const seats = reservation.totalSeats;
        const seatPrice = formatEuros(reservation.seatPriceCents / 100);
        const seatTotal = formatEuros((reservation.seatPriceCents * seats) / 100);
        const fee = formatEuros(reservation.managementFeeCents / 100);
        const feeTotal = formatEuros((reservation.managementFeeCents * seats) / 100);

        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");

        yPos += 5;
        doc.text(
          `Importe de la reserva: ${seatPrice}€ x ${seats} = ${seatTotal}€`,
          ticketWidth / 2,
          yPos,
          { align: "center" }
        );

        yPos += 4;
        doc.text(
          `Gastos de gestión: ${fee}€ x ${seats} = ${feeTotal}€`,
          ticketWidth / 2,
          yPos,
          { align: "center" }
        );
      }

      // Footer
      yPos += 8;
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.text("Gracias por tu reserva", ticketWidth / 2, yPos, {
        align: "center",
      });

      // Dashed line before QR
      yPos += 6;
      doc.setLineDashPattern([1, 1], 0);
      doc.line(margin, yPos, ticketWidth - margin, yPos);
      doc.setLineDashPattern([], 0);

      // QR code
      yPos += 4;
      const qrX = (ticketWidth - qrSize) / 2;
      doc.addImage(qrDataUrl, "PNG", qrX, yPos, qrSize, qrSize);

      const filename = `ticket-${reservation.id}.pdf`;
      doc.save(filename);

      if (openInNewTab) {
        const pdfBlob = doc.output("blob");
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, "_blank");
      }
    } catch (err) {
      console.error("Error generating ticket:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (hasAutoDownloaded.current) return;
    hasAutoDownloaded.current = true;
    handleDownloadTicket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4">
      <div className="max-w-sm w-full space-y-6">
        {/* Success icon */}
        <div className="flex flex-col items-center gap-3">
          <CheckCircle className="w-16 h-16 text-[#D4AF37]" />
          <h1 className="text-white text-2xl font-bold tracking-tight">
            ¡Reserva confirmada!
          </h1>
          <p className="text-white/50 text-sm text-center">
            Tu reserva ha sido procesada correctamente.
            <br />
            Descarga el ticket y muéstralo en el local.
          </p>
        </div>

        {/* Summary card */}
        <div className="bg-[#1a1a1a] rounded-2xl p-4 space-y-3 border border-white/10">
          <div className="text-center">
            <p className="text-white font-semibold">
              {reservation.homeTeamName}{" "}
              <span className="text-white/40 font-normal">vs</span>{" "}
              {reservation.awayTeamName}
            </p>
            <p className="text-white/50 text-sm mt-0.5">{formattedDate}</p>
          </div>

          <div className="border-t border-white/10 pt-3 flex items-center justify-between">
            <div>
              <p className="text-white/40 text-xs uppercase tracking-wider">
                Asientos
              </p>
              <p className="text-white text-sm">
                {reservation.seats.map((s) => s.code).join(", ")}
              </p>
            </div>
            <div className="text-right">
              <p className="text-white/40 text-xs uppercase tracking-wider">
                Total
              </p>
              <p className="text-[#D4AF37] text-lg font-bold">
                {reservation.totalPrice.toFixed(2).replace(".", ",")}€
              </p>
            </div>
          </div>

          <p className="text-white/30 text-[10px] text-center font-mono">
            {reservation.id.slice(0, 16)}...
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            onClick={() => handleDownloadTicket({ openInNewTab: true })}
            disabled={isGenerating}
            className="w-full bg-[#D4AF37] hover:bg-[#b8972e] text-black font-semibold"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generando ticket...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Descargar ticket PDF
              </>
            )}
          </Button>

          <Link href="/" className="block">
            <Button
              variant="outline"
              className="w-full border-white/20 text-white/70 hover:text-white hover:bg-white/10"
            >
              <Home className="w-4 h-4 mr-2" />
              Volver al inicio
            </Button>
          </Link>
        </div>

        <p className="text-center text-xs text-white/30 tracking-wider">
          THE LOUNGE BEERHOUSE • VALENCIA
        </p>
      </div>
    </div>
  );
}
