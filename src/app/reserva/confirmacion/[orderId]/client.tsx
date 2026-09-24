"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle, Download, Home, Receipt } from "lucide-react";
import type { jsPDF as JsPdfDoc } from "jspdf";
import { Button } from "@/components/ui/button";
import type { ReservationTicketData } from "@/modules/payments/types";
import type { MerchantInfo } from "@/lib/redsys";
import { LEGACY_CUSTOMER_NAME } from "@/modules/payments/lib/customer-name";
import { formatEuros } from "@/lib/utils";

interface Props {
  reservation: ReservationTicketData;
  orderId: string;
  /** Datos del comercio para el recibo. Vienen del servidor: son variables de entorno. */
  merchant: MerchantInfo;
}

/**
 * Línea discontinua de separación. La usan los dos documentos, y antes de extraerla
 * este mismo patrón de tres llamadas aparecía seis veces en el ticket.
 */
function dashedLine(doc: JsPdfDoc, y: number, width: number, margin: number) {
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, y, width - margin, y);
  doc.setLineDashPattern([], 0);
}

const TICKET_WIDTH = 80;
const TICKET_MARGIN = 5;

/** Fila etiqueta/valor del recibo. El guion largo marca un dato que aún no ha llegado. */
function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="text-white/40 shrink-0">{label}</span>
      <span className="text-white text-right break-all">{value}</span>
    </div>
  );
}

export function ConfirmationClient({ reservation, orderId, merchant }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);
  const hasAutoDownloaded = useRef(false);

  const eventDate = new Date(reservation.eventDate);
  const formattedDate = format(eventDate, "EEE d MMM yyyy • HH:mm", {
    locale: es,
  });

  // Las reservas anteriores a esta funcionalidad guardan el literal "Cliente": sin
  // nombre real, el ticket se genera con el mismo layout que ha tenido siempre.
  const hasName =
    Boolean(reservation.customerName) &&
    reservation.customerName !== LEGACY_CUSTOMER_NAME;

  // Desglose del snapshot de la reserva, con el mismo cálculo y la misma redacción que
  // el detalle de admin, para que las dos pantallas no puedan divergir.
  const hasFee = reservation.managementFeeCents > 0;
  const seatsTotal = (reservation.seatPriceCents * reservation.totalSeats) / 100;
  const feeTotal = (reservation.managementFeeCents * reservation.totalSeats) / 100;

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

      const ticketWidth = TICKET_WIDTH;
      const margin = TICKET_MARGIN;
      const qrSize = 35;
      const seatsHeight = Math.ceil(reservation.seats.length / 3) * 5;
      // El lienzo es de alto fijo: todo lo que se añada hay que sumarlo aquí o se sale
      // del PDF, y lo primero que se recorta es el QR de abajo.
      //   · desglose de gastos de gestión: 9 mm (solo si el evento los cobra)
      //   · nombre del cliente: 6 mm, que es justo lo que avanza su bloque
      const nameHeight = hasName ? 6 : 0;
      const ticketHeight = 98 + seatsHeight + qrSize + (hasFee ? 9 : 0) + nameHeight;

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
      dashedLine(doc, yPos, ticketWidth, margin);

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
      dashedLine(doc, yPos, ticketWidth, margin);

      // Reservation ID
      yPos += 5;
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(`Reserva: ${reservation.id}`, ticketWidth / 2, yPos, {
        align: "center",
      });

      // Customer name — lo que permite a la camarera localizar la reserva. Va solo, sin
      // etiqueta: en un ticket de 80 mm un nombre centrado ya se lee como lo que es.
      if (hasName) {
        yPos += 6;
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        // splitTextToSize(...)[0] es la red de seguridad: aunque algún día llegue un
        // nombre más largo del máximo, se recorta en vez de desbordar los 80 mm.
        const [nameLine] = doc.splitTextToSize(
          reservation.customerName,
          ticketWidth - margin * 2,
        );
        doc.text(nameLine, ticketWidth / 2, yPos, { align: "center" });
      }

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
      dashedLine(doc, yPos, ticketWidth, margin);

      // Totals
      yPos += 6;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(
        `${reservation.totalSeats} asiento${reservation.totalSeats !== 1 ? "s" : ""}`,
        ticketWidth / 2,
        yPos,
        { align: "center" },
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
          { align: "center" },
        );

        yPos += 4;
        doc.text(
          `Gastos de gestión: ${fee}€ x ${seats} = ${feeTotal}€`,
          ticketWidth / 2,
          yPos,
          { align: "center" },
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
      dashedLine(doc, yPos, ticketWidth, margin);

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

  /**
   * Recibo de pago imprimible. Es un requisito de CaixaBank para poder activar la
   * redirección automática a esta pantalla: los datos que lleva son los que ellos
   * piden, ni más ni menos.
   *
   * No se autodescarga (el ticket sí): es un documento de respaldo, no lo que el
   * cliente enseña en la barra.
   */
  const handleDownloadReceipt = async () => {
    setIsGeneratingReceipt(true);
    try {
      const { jsPDF } = await import("jspdf");

      const ticketWidth = TICKET_WIDTH;
      const margin = TICKET_MARGIN;
      const contentWidth = ticketWidth - margin * 2;

      const rows: { label: string; value: string }[] = [
        { label: "Comercio", value: merchant.name },
        { label: "FUC", value: merchant.fuc },
        { label: "URL", value: merchant.url },
        { label: "Importe", value: `${formatEuros(reservation.totalPrice)} EUR` },
        { label: "Cód. autorización", value: reservation.authorisationCode ?? "-" },
        { label: "Fecha / hora", value: reservation.paymentDateTime ?? "-" },
        { label: "Nº de pedido", value: orderId },
        { label: "Producto", value: merchant.productDescription },
      ];

      // Todos los valores van alineados a la derecha. Los que no quepan al lado de su
      // etiqueta bajan a la línea siguiente, partidos pero igualmente a la derecha: con
      // un dominio largo, forzarlos a una sola línea los sacaría de los 80 mm.
      //
      // El alto se calcula ANTES de crear el documento, con las líneas ya medidas: igual
      // que el ticket, este lienzo es de alto fijo y no crece solo. Las métricas se
      // reutilizan al dibujar, así que medida y dibujo no pueden divergir.
      const measure = new jsPDF({ unit: "mm", format: [ticketWidth, 100] });
      const layout = rows.map((row) => {
        measure.setFontSize(7);
        measure.setFont("helvetica", "normal");
        const labelWidth = measure.getTextWidth(row.label);

        measure.setFontSize(8);
        measure.setFont("helvetica", "bold");
        const fitsBesideLabel =
          measure.getTextWidth(row.value) <= contentWidth - labelWidth - 3;

        return {
          ...row,
          inline: fitsBesideLabel,
          lines: fitsBesideLabel
            ? [row.value]
            : (measure.splitTextToSize(row.value, contentWidth) as string[]),
        };
      });

      const rowsHeight = layout.reduce(
        (total, row) => total + (row.inline ? 5 : 5 + row.lines.length * 4),
        0,
      );
      const receiptHeight = 52 + rowsHeight;

      const doc = new jsPDF({
        unit: "mm",
        format: [ticketWidth, receiptHeight],
      });

      let yPos = 8;

      // Header — el mismo que el ticket, para que los dos documentos se lean iguales
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("THE LOUNGE", ticketWidth / 2, yPos, { align: "center" });
      yPos += 4;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text("BEERHOUSE • VALENCIA", ticketWidth / 2, yPos, { align: "center" });

      yPos += 5;
      dashedLine(doc, yPos, ticketWidth, margin);

      yPos += 6;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("RECIBO DE PAGO", ticketWidth / 2, yPos, { align: "center" });

      yPos += 4;
      dashedLine(doc, yPos, ticketWidth, margin);

      yPos += 6;
      layout.forEach((row) => {
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text(row.label, margin, yPos);

        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");

        if (row.inline) {
          doc.text(row.lines[0], ticketWidth - margin, yPos, { align: "right" });
          yPos += 5;
        } else {
          yPos += 4;
          row.lines.forEach((line) => {
            doc.text(line, ticketWidth - margin, yPos, { align: "right" });
            yPos += 4;
          });
          yPos += 1;
        }
      });

      yPos += 2;
      dashedLine(doc, yPos, ticketWidth, margin);

      yPos += 5;
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.text("Documento generado automáticamente", ticketWidth / 2, yPos, {
        align: "center",
      });

      doc.save(`recibo-${orderId}.pdf`);
    } catch (err) {
      console.error("Error generating receipt:", err);
    } finally {
      setIsGeneratingReceipt(false);
    }
  };

  useEffect(() => {
    if (hasAutoDownloaded.current) return;
    hasAutoDownloaded.current = true;
    handleDownloadTicket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    // Sin `justify-center`: desde que hay tarjeta de recibo el contenido es más alto que
    // la pantalla en un móvil, y centrar verticalmente algo que desborda pega el icono al
    // borde de arriba (y deja esa parte fuera del scroll). El padding hace de margen.
    <div className="min-h-screen bg-black flex flex-col items-center px-4 py-12">
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
        <div
          data-testid="ticket"
          className="bg-[#1a1a1a] rounded-2xl p-4 space-y-3 border border-white/10"
        >
          <div className="text-center">
            <p className="text-white font-semibold">
              {reservation.homeTeamName}{" "}
              <span className="text-white/40 font-normal">vs</span>{" "}
              {reservation.awayTeamName}
            </p>
            <p className="text-white/50 text-sm mt-0.5">{formattedDate}</p>
          </div>

          {hasName && (
            <div className="border-t border-white/10 pt-3">
              <p className="text-white/40 text-xs uppercase tracking-wider">
                Nombre / Alias
              </p>
              <p className="text-white text-sm font-semibold break-words">
                {reservation.customerName}
              </p>
            </div>
          )}

          <div className="border-t border-white/10 pt-3 flex items-center justify-between">
            <div>
              <p className="text-white/40 text-xs uppercase tracking-wider">Asientos</p>
              <p data-testid="ticket-seats" className="text-white text-sm">
                {reservation.seats.map((s) => s.code).join(", ")}
              </p>
            </div>
            <div className="text-right">
              <p className="text-white/40 text-xs uppercase tracking-wider">Total</p>
              <p data-testid="ticket-total" className="text-[#D4AF37] text-lg font-bold">
                {formatEuros(reservation.totalPrice)}€
              </p>
            </div>
          </div>

          {hasFee && (
            <div className="space-y-1">
              <div className="flex items-center justify-end gap-3 text-xs">
                <span className="text-white/40">
                  Importe de la reserva{" "}
                  <span className="text-white/30">(descontable)</span>
                </span>
                <span className="text-white tabular-nums">
                  {formatEuros(seatsTotal)}€
                </span>
              </div>
              <div className="flex items-center justify-end gap-3 text-xs">
                <span className="text-white/40">Gastos de gestión</span>
                <span className="text-white tabular-nums">{formatEuros(feeTotal)}€</span>
              </div>
            </div>
          )}

          <p className="text-white/30 text-[10px] text-center font-mono">
            {reservation.id.slice(0, 16)}...
          </p>
        </div>

        {/* Recibo del pago — datos que exige CaixaBank en la URL OK */}
        <div className="bg-[#1a1a1a] rounded-2xl p-4 space-y-2 border border-white/10">
          <p className="text-white/40 text-xs uppercase tracking-wider text-center mb-1">
            Recibo del pago
          </p>
          <ReceiptRow label="Comercio" value={merchant.name} />
          <ReceiptRow label="FUC" value={merchant.fuc} />
          <ReceiptRow label="URL" value={merchant.url} />
          <ReceiptRow label="Importe" value={`${formatEuros(reservation.totalPrice)}€`} />
          <ReceiptRow
            label="Cód. autorización"
            value={reservation.authorisationCode ?? "—"}
          />
          <ReceiptRow label="Fecha / hora" value={reservation.paymentDateTime ?? "—"} />
          <ReceiptRow label="Nº de pedido" value={orderId} />
          <ReceiptRow label="Producto" value={merchant.productDescription} />
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            data-testid="ticket-pdf"
            onClick={() => handleDownloadTicket({ openInNewTab: true })}
            loading={isGenerating}
            className="w-full bg-[#D4AF37] hover:bg-[#b8972e] text-black font-semibold"
          >
            {isGenerating ? (
              "Generando ticket..."
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Descargar ticket PDF
              </>
            )}
          </Button>

          <Button
            data-testid="receipt-pdf"
            onClick={() => handleDownloadReceipt()}
            loading={isGeneratingReceipt}
            className="w-full bg-[#1a1a1a] hover:bg-[#242424] text-white border border-white/15"
          >
            {isGeneratingReceipt ? (
              "Generando recibo..."
            ) : (
              <>
                <Receipt className="w-4 h-4 mr-2" />
                Descargar recibo del pago
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
