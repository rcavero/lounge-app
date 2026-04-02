"use client";

import { Calendar, Download, FileText } from "lucide-react";
import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Accordion } from "@/components/ui/accordion";
import { EventRowWithBadge } from "@/modules/events/components/event-row-with-badge";
import type {
  EventWithReservationCount,
  ReportMonth,
  MonthlyReportEvent,
} from "@/modules/reservations/actions";
import { getMonthlyReportData } from "@/modules/reservations/actions";

interface ReservasClientProps {
  upcomingEvents: EventWithReservationCount[];
  pastEvents: EventWithReservationCount[];
  reportMonths: ReportMonth[];
  isAdmin: boolean;
}

export function ReservasClient({
  upcomingEvents,
  pastEvents,
  reportMonths,
  isAdmin,
}: ReservasClientProps) {
  const generatePDF = async (year: number, month: number, label: string) => {
    const events = await getMonthlyReportData(year, month);

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(`Informe de Reservas - ${label}`, pageWidth / 2, y, {
      align: "center",
    });
    y += 8;

    // Subtitle
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("THE LOUNGE BEERHOUSE", pageWidth / 2, y, { align: "center" });
    y += 15;

    let totalGeneral = 0;
    let totalSeatsGeneral = 0;

    for (const event of events) {
      // Check if we need a new page
      if (y > 250) {
        doc.addPage();
        y = 20;
      }

      const eventDate = new Date(event.eventDate);
      const formattedDate = format(eventDate, "EEEE d 'de' MMMM, HH:mm", {
        locale: es,
      });

      // Event header
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(
        `${event.homeTeam?.shortName ?? event.homeTeamName ?? ""} vs ${event.awayTeam?.shortName ?? event.awayTeamName ?? ""}`,
        14,
        y
      );
      y += 5;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`${formattedDate}`, 14, y);
      doc.setTextColor(128);
      doc.text(`ID: ${event.id}`, pageWidth - 14, y, { align: "right" });
      doc.setTextColor(0);
      y += 8;

      if (event.reservations.length === 0) {
        doc.setFontSize(9);
        doc.setTextColor(128);
        doc.text("Sin reservas", 14, y);
        doc.setTextColor(0);
        y += 10;
        continue;
      }

      // Table header
      doc.setFillColor(240, 240, 240);
      doc.rect(14, y - 4, pageWidth - 28, 7, "F");
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("ID Reserva", 16, y);
      doc.text("Asientos", 90, y);
      doc.text("Importe", pageWidth - 16, y, { align: "right" });
      y += 6;

      // Table rows
      doc.setFont("helvetica", "normal");
      let subtotal = 0;
      let subtotalSeats = 0;

      for (const res of event.reservations) {
        const price = Number(res.totalPrice);
        subtotal += price;
        subtotalSeats += res.numberOfSeats;

        doc.text(res.id.substring(0, 12) + "...", 16, y);
        doc.text(String(res.numberOfSeats), 90, y);
        doc.text(`${price.toFixed(2)} EUR`, pageWidth - 16, y, {
          align: "right",
        });
        y += 5;

        if (y > 270) {
          doc.addPage();
          y = 20;
        }
      }

      // Subtotal
      doc.setFont("helvetica", "bold");
      doc.setFillColor(245, 245, 245);
      doc.rect(14, y - 3, pageWidth - 28, 6, "F");
      doc.text(`Subtotal: ${event.reservations.length} reservas, ${subtotalSeats} asientos`, 16, y);
      doc.text(`${subtotal.toFixed(2)} EUR`, pageWidth - 16, y, {
        align: "right",
      });
      y += 12;

      totalGeneral += subtotal;
      totalSeatsGeneral += subtotalSeats;
    }

    // Total general
    y += 5;
    if (y > 260) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(212, 175, 55);
    doc.rect(14, y - 5, pageWidth - 28, 10, "F");
    doc.setTextColor(0);
    doc.text(`TOTAL ${label.toUpperCase()}`, 16, y);
    doc.text(`${totalSeatsGeneral} asientos`, 90, y);
    doc.text(`${totalGeneral.toFixed(2)} EUR`, pageWidth - 16, y, {
      align: "right",
    });

    // Footer with generation date
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(128);
      doc.text(
        `Generado el ${format(new Date(), "dd/MM/yyyy HH:mm")} - Página ${i} de ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
    }

    // Open PDF in new tab
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Upcoming Events Section */}
      {upcomingEvents.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-white/70 text-xs font-medium uppercase tracking-wider px-1">
            Próximos eventos
          </h2>
          {upcomingEvents.map((event) => (
            <EventRowWithBadge key={event.id} event={event} />
          ))}
        </div>
      )}

      {/* No events message */}
      {upcomingEvents.length === 0 && pastEvents.length === 0 && (
        <div className="text-center py-16">
          <Calendar className="w-12 h-12 text-white/30 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">
            No hay eventos programados
          </h3>
          <p className="text-white/50">
            Crea un evento primero para poder gestionar reservas.
          </p>
        </div>
      )}

      {/* Past Events Accordion */}
      {pastEvents.length > 0 && (
        <Accordion
          title="Reservas de eventos pasados"
          badge={
            <span className="bg-white/10 text-white/70 text-xs px-2 py-0.5 rounded-full">
              {pastEvents.length}
            </span>
          }
        >
          <div className="space-y-3 pt-2">
            {pastEvents.map((event) => (
              <EventRowWithBadge key={event.id} event={event} />
            ))}
          </div>
        </Accordion>
      )}

      {/* Reports Accordion - Only for admins */}
      {isAdmin && reportMonths.length > 0 && (
        <Accordion
          title="Informes de reservas"
          badge={
            <FileText className="w-4 h-4 text-white/50" />
          }
        >
          <div className="space-y-2 pt-2">
            {reportMonths.map((month) => (
              <button
                key={`${month.year}-${month.month}`}
                onClick={() => generatePDF(month.year, month.month, month.label)}
                className="w-full flex items-center justify-between bg-[#222] hover:bg-[#2a2a2a] rounded-xl px-4 py-3 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-[#D4AF37]" />
                  <div className="text-left">
                    <span className="text-white text-sm font-medium block">
                      {month.label}
                    </span>
                    <span className="text-white/50 text-xs">
                      {month.eventCount} evento{month.eventCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <Download className="w-5 h-5 text-white/50" />
              </button>
            ))}
          </div>
        </Accordion>
      )}
    </div>
  );
}
