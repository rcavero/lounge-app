import { PrismaClient } from "../src/generated/prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create Teams - All major European leagues
  const teamsData = [
    // La Liga (20 teams)
    { id: "real-madrid", name: "Real Madrid CF", shortName: "Real Madrid", league: "La Liga" },
    { id: "barcelona", name: "FC Barcelona", shortName: "Barcelona", league: "La Liga" },
    { id: "atletico-madrid", name: "Atlético de Madrid", shortName: "Atlético", league: "La Liga" },
    { id: "athletic-bilbao", name: "Athletic Club", shortName: "Athletic", league: "La Liga" },
    { id: "real-sociedad", name: "Real Sociedad", shortName: "Real Sociedad", league: "La Liga" },
    { id: "real-betis", name: "Real Betis", shortName: "Betis", league: "La Liga" },
    { id: "villarreal", name: "Villarreal CF", shortName: "Villarreal", league: "La Liga" },
    { id: "sevilla", name: "Sevilla FC", shortName: "Sevilla", league: "La Liga" },
    { id: "valencia", name: "Valencia CF", shortName: "Valencia", league: "La Liga" },
    { id: "girona", name: "Girona FC", shortName: "Girona", league: "La Liga" },
    { id: "celta-vigo", name: "RC Celta de Vigo", shortName: "Celta", league: "La Liga" },
    { id: "osasuna", name: "CA Osasuna", shortName: "Osasuna", league: "La Liga" },
    { id: "rayo-vallecano", name: "Rayo Vallecano", shortName: "Rayo", league: "La Liga" },
    { id: "mallorca", name: "RCD Mallorca", shortName: "Mallorca", league: "La Liga" },
    { id: "getafe", name: "Getafe CF", shortName: "Getafe", league: "La Liga" },
    { id: "alaves", name: "Deportivo Alavés", shortName: "Alavés", league: "La Liga" },
    { id: "las-palmas", name: "UD Las Palmas", shortName: "Las Palmas", league: "La Liga" },
    { id: "espanyol", name: "RCD Espanyol", shortName: "Espanyol", league: "La Liga" },
    { id: "real-valladolid", name: "Real Valladolid", shortName: "Valladolid", league: "La Liga" },
    { id: "leganes", name: "CD Leganés", shortName: "Leganés", league: "La Liga" },

    // Premier League (20 teams)
    { id: "manchester-city", name: "Manchester City", shortName: "Man City", league: "Premier League" },
    { id: "arsenal", name: "Arsenal FC", shortName: "Arsenal", league: "Premier League" },
    { id: "liverpool", name: "Liverpool FC", shortName: "Liverpool", league: "Premier League" },
    { id: "chelsea", name: "Chelsea FC", shortName: "Chelsea", league: "Premier League" },
    { id: "manchester-united", name: "Manchester United", shortName: "Man United", league: "Premier League" },
    { id: "tottenham", name: "Tottenham Hotspur", shortName: "Tottenham", league: "Premier League" },
    { id: "newcastle", name: "Newcastle United", shortName: "Newcastle", league: "Premier League" },
    { id: "aston-villa", name: "Aston Villa", shortName: "Aston Villa", league: "Premier League" },
    { id: "brighton", name: "Brighton & Hove Albion", shortName: "Brighton", league: "Premier League" },
    { id: "west-ham", name: "West Ham United", shortName: "West Ham", league: "Premier League" },
    { id: "bournemouth", name: "AFC Bournemouth", shortName: "Bournemouth", league: "Premier League" },
    { id: "crystal-palace", name: "Crystal Palace", shortName: "Crystal Palace", league: "Premier League" },
    { id: "fulham", name: "Fulham FC", shortName: "Fulham", league: "Premier League" },
    { id: "wolverhampton", name: "Wolverhampton Wanderers", shortName: "Wolves", league: "Premier League" },
    { id: "everton", name: "Everton FC", shortName: "Everton", league: "Premier League" },
    { id: "brentford", name: "Brentford FC", shortName: "Brentford", league: "Premier League" },
    { id: "nottingham-forest", name: "Nottingham Forest", shortName: "Nottingham", league: "Premier League" },
    { id: "ipswich", name: "Ipswich Town", shortName: "Ipswich", league: "Premier League" },
    { id: "leicester", name: "Leicester City", shortName: "Leicester", league: "Premier League" },
    { id: "southampton", name: "Southampton FC", shortName: "Southampton", league: "Premier League" },

    // Serie A (20 teams)
    { id: "inter-milan", name: "Inter Milan", shortName: "Inter", league: "Serie A" },
    { id: "ac-milan", name: "AC Milan", shortName: "Milan", league: "Serie A" },
    { id: "juventus", name: "Juventus FC", shortName: "Juventus", league: "Serie A" },
    { id: "napoli", name: "SSC Napoli", shortName: "Napoli", league: "Serie A" },
    { id: "roma", name: "AS Roma", shortName: "Roma", league: "Serie A" },
    { id: "lazio", name: "SS Lazio", shortName: "Lazio", league: "Serie A" },
    { id: "atalanta", name: "Atalanta BC", shortName: "Atalanta", league: "Serie A" },
    { id: "fiorentina", name: "ACF Fiorentina", shortName: "Fiorentina", league: "Serie A" },
    { id: "bologna", name: "Bologna FC", shortName: "Bologna", league: "Serie A" },
    { id: "torino", name: "Torino FC", shortName: "Torino", league: "Serie A" },
    { id: "monza", name: "AC Monza", shortName: "Monza", league: "Serie A" },
    { id: "udinese", name: "Udinese Calcio", shortName: "Udinese", league: "Serie A" },
    { id: "genoa", name: "Genoa CFC", shortName: "Genoa", league: "Serie A" },
    { id: "cagliari", name: "Cagliari Calcio", shortName: "Cagliari", league: "Serie A" },
    { id: "empoli", name: "Empoli FC", shortName: "Empoli", league: "Serie A" },
    { id: "parma", name: "Parma Calcio", shortName: "Parma", league: "Serie A" },
    { id: "como", name: "Como 1907", shortName: "Como", league: "Serie A" },
    { id: "verona", name: "Hellas Verona", shortName: "Verona", league: "Serie A" },
    { id: "lecce", name: "US Lecce", shortName: "Lecce", league: "Serie A" },
    { id: "venezia", name: "Venezia FC", shortName: "Venezia", league: "Serie A" },

    // Bundesliga (18 teams)
    { id: "bayern-munich", name: "Bayern München", shortName: "Bayern", league: "Bundesliga" },
    { id: "borussia-dortmund", name: "Borussia Dortmund", shortName: "Dortmund", league: "Bundesliga" },
    { id: "rb-leipzig", name: "RB Leipzig", shortName: "Leipzig", league: "Bundesliga" },
    { id: "bayer-leverkusen", name: "Bayer Leverkusen", shortName: "Leverkusen", league: "Bundesliga" },
    { id: "eintracht-frankfurt", name: "Eintracht Frankfurt", shortName: "Frankfurt", league: "Bundesliga" },
    { id: "vfb-stuttgart", name: "VfB Stuttgart", shortName: "Stuttgart", league: "Bundesliga" },
    { id: "wolfsburg", name: "VfL Wolfsburg", shortName: "Wolfsburg", league: "Bundesliga" },
    { id: "borussia-monchengladbach", name: "Borussia Mönchengladbach", shortName: "Gladbach", league: "Bundesliga" },
    { id: "freiburg", name: "SC Freiburg", shortName: "Freiburg", league: "Bundesliga" },
    { id: "hoffenheim", name: "TSG Hoffenheim", shortName: "Hoffenheim", league: "Bundesliga" },
    { id: "werder-bremen", name: "Werder Bremen", shortName: "Bremen", league: "Bundesliga" },
    { id: "union-berlin", name: "Union Berlin", shortName: "Union Berlin", league: "Bundesliga" },
    { id: "mainz", name: "1. FSV Mainz 05", shortName: "Mainz", league: "Bundesliga" },
    { id: "augsburg", name: "FC Augsburg", shortName: "Augsburg", league: "Bundesliga" },
    { id: "heidenheim", name: "1. FC Heidenheim", shortName: "Heidenheim", league: "Bundesliga" },
    { id: "st-pauli", name: "FC St. Pauli", shortName: "St. Pauli", league: "Bundesliga" },
    { id: "holstein-kiel", name: "Holstein Kiel", shortName: "Holstein", league: "Bundesliga" },
    { id: "bochum", name: "VfL Bochum", shortName: "Bochum", league: "Bundesliga" },

    // Ligue 1 (18 teams)
    { id: "psg", name: "Paris Saint-Germain", shortName: "PSG", league: "Ligue 1" },
    { id: "monaco", name: "AS Monaco", shortName: "Monaco", league: "Ligue 1" },
    { id: "marseille", name: "Olympique de Marseille", shortName: "Marseille", league: "Ligue 1" },
    { id: "lyon", name: "Olympique Lyonnais", shortName: "Lyon", league: "Ligue 1" },
    { id: "lille", name: "LOSC Lille", shortName: "Lille", league: "Ligue 1" },
    { id: "nice", name: "OGC Nice", shortName: "Nice", league: "Ligue 1" },
    { id: "lens", name: "RC Lens", shortName: "Lens", league: "Ligue 1" },
    { id: "rennes", name: "Stade Rennais", shortName: "Rennes", league: "Ligue 1" },
    { id: "brest", name: "Stade Brestois", shortName: "Brest", league: "Ligue 1" },
    { id: "strasbourg", name: "RC Strasbourg", shortName: "Strasbourg", league: "Ligue 1" },
    { id: "reims", name: "Stade de Reims", shortName: "Reims", league: "Ligue 1" },
    { id: "toulouse", name: "Toulouse FC", shortName: "Toulouse", league: "Ligue 1" },
    { id: "nantes", name: "FC Nantes", shortName: "Nantes", league: "Ligue 1" },
    { id: "montpellier", name: "Montpellier HSC", shortName: "Montpellier", league: "Ligue 1" },
    { id: "auxerre", name: "AJ Auxerre", shortName: "Auxerre", league: "Ligue 1" },
    { id: "angers", name: "Angers SCO", shortName: "Angers", league: "Ligue 1" },
    { id: "saint-etienne", name: "AS Saint-Étienne", shortName: "Saint-Étienne", league: "Ligue 1" },
    { id: "le-havre", name: "Le Havre AC", shortName: "Le Havre", league: "Ligue 1" },
  ];

  const teams = await Promise.all(
    teamsData.map((team) =>
      prisma.team.upsert({
        where: { id: team.id },
        update: { league: team.league },
        create: {
          id: team.id,
          name: team.name,
          shortName: team.shortName,
          league: team.league,
          logo: null,
        },
      })
    )
  );

  console.log(`✅ Created ${teams.length} teams`);

  // Create Events (upcoming matches)
  const now = new Date();
  const events = await Promise.all([
    prisma.event.upsert({
      where: { id: "el-clasico-2026" },
      update: {},
      create: {
        id: "el-clasico-2026",
        title: "El Clásico",
        description: "El partido más esperado de La Liga",
        sport: "football",
        competition: "La Liga",
        homeTeamId: "real-madrid",
        awayTeamId: "barcelona",
        eventDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        status: "UPCOMING",
        screens: "TV1,TV2,PROYECTOR",
      },
    }),
    prisma.event.upsert({
      where: { id: "city-liverpool-2026" },
      update: {},
      create: {
        id: "city-liverpool-2026",
        title: "Manchester City vs Liverpool",
        description: "Choque de titanes en la Premier League",
        sport: "football",
        competition: "Premier League",
        homeTeamId: "manchester-city",
        awayTeamId: "liverpool",
        eventDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
        status: "UPCOMING",
        screens: "TV1,PROYECTOR",
      },
    }),
    prisma.event.upsert({
      where: { id: "ucl-semifinal-2026" },
      update: {},
      create: {
        id: "ucl-semifinal-2026",
        title: "Semifinal Champions League",
        description: "Ida de semifinales de la UEFA Champions League",
        sport: "football",
        competition: "Champions League",
        homeTeamId: "bayern-munich",
        awayTeamId: "real-madrid",
        eventDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
        status: "UPCOMING",
        screens: "PROYECTOR",
      },
    }),
    prisma.event.upsert({
      where: { id: "inter-juve-2026" },
      update: {},
      create: {
        id: "inter-juve-2026",
        title: "Derby d'Italia",
        description: "Inter vs Juventus - El clásico italiano",
        sport: "football",
        competition: "Serie A",
        homeTeamId: "inter-milan",
        awayTeamId: "juventus",
        eventDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
        status: "UPCOMING",
        screens: "TV2,PROYECTOR",
      },
    }),
  ]);

  console.log(`✅ Created ${events.length} events`);

  // Create Seats with exact positions (47 total)
  const seatsToCreate = [
    // TV1 zone - 10 seats
    { id: "T1-A1", code: "T1-A1", zone: "TV1" as const, row: "A", number: 1, posX: 18, posY: 10, capacity: 1 },
    { id: "T1-A2", code: "T1-A2", zone: "TV1" as const, row: "A", number: 2, posX: 27, posY: 9, capacity: 1 },
    { id: "T1-A3", code: "T1-A3", zone: "TV1" as const, row: "A", number: 3, posX: 40, posY: 8, capacity: 1 },
    { id: "T1-A4", code: "T1-A4", zone: "TV1" as const, row: "A", number: 4, posX: 53, posY: 6, capacity: 1 },
    { id: "T1-A5", code: "T1-A5", zone: "TV1" as const, row: "A", number: 5, posX: 65, posY: 5, capacity: 1 },
    { id: "T1-B1", code: "T1-B1", zone: "TV1" as const, row: "B", number: 1, posX: 18, posY: 15, capacity: 1 },
    { id: "T1-B2", code: "T1-B2", zone: "TV1" as const, row: "B", number: 2, posX: 33, posY: 14, capacity: 1 },
    { id: "T1-B3", code: "T1-B3", zone: "TV1" as const, row: "B", number: 3, posX: 26, posY: 19, capacity: 1 },
    { id: "T1-B4", code: "T1-B4", zone: "TV1" as const, row: "B", number: 4, posX: 44, posY: 18, capacity: 1 },
    { id: "T1-B5", code: "T1-B5", zone: "TV1" as const, row: "B", number: 5, posX: 57, posY: 16, capacity: 1 },
    // TV2 zone - 12 seats
    { id: "T2-A1", code: "T2-A1", zone: "TV2" as const, row: "A", number: 1, posX: 38, posY: 28, capacity: 1 },
    { id: "T2-A2", code: "T2-A2", zone: "TV2" as const, row: "A", number: 2, posX: 65, posY: 34, capacity: 1 },
    { id: "T2-A3", code: "T2-A3", zone: "TV2" as const, row: "A", number: 3, posX: 63, posY: 25, capacity: 1 },
    { id: "T2-A4", code: "T2-A4", zone: "TV2" as const, row: "A", number: 4, posX: 78, posY: 20, capacity: 1 },
    { id: "T2-A5", code: "T2-A5", zone: "TV2" as const, row: "A", number: 5, posX: 76, posY: 16, capacity: 1 },
    { id: "T2-A6", code: "T2-A6", zone: "TV2" as const, row: "A", number: 6, posX: 69, posY: 15, capacity: 1 },
    { id: "T2-B1", code: "T2-B1", zone: "TV2" as const, row: "B", number: 1, posX: 68, posY: 38, capacity: 1 },
    { id: "T2-B2", code: "T2-B2", zone: "TV2" as const, row: "B", number: 2, posX: 81, posY: 36, capacity: 1 },
    { id: "T2-B3", code: "T2-B3", zone: "TV2" as const, row: "B", number: 3, posX: 79, posY: 32, capacity: 1 },
    { id: "T2-B4", code: "T2-B4", zone: "TV2" as const, row: "B", number: 4, posX: 64, posY: 29, capacity: 1 },
    { id: "T2-B5", code: "T2-B5", zone: "TV2" as const, row: "B", number: 5, posX: 77, posY: 28, capacity: 1 },
    { id: "T2-B6", code: "T2-B6", zone: "TV2" as const, row: "B", number: 6, posX: 75, posY: 24, capacity: 1 },
    // PROJECTOR zone - 25 seats
    { id: "P-A1", code: "P-A1", zone: "PROJECTOR" as const, row: "A", number: 1, posX: 35, posY: 36, capacity: 1 },
    { id: "P-A2", code: "P-A2", zone: "PROJECTOR" as const, row: "A", number: 2, posX: 42, posY: 39, capacity: 1 },
    { id: "P-A3", code: "P-A3", zone: "PROJECTOR" as const, row: "A", number: 3, posX: 50, posY: 38, capacity: 1 },
    { id: "P-A4", code: "P-A4", zone: "PROJECTOR" as const, row: "A", number: 4, posX: 58, posY: 46, capacity: 1 },
    { id: "P-A5", code: "P-A5", zone: "PROJECTOR" as const, row: "A", number: 5, posX: 59, posY: 55, capacity: 1 },
    { id: "P-A6", code: "P-A6", zone: "PROJECTOR" as const, row: "A", number: 6, posX: 79, posY: 52, capacity: 1 },
    { id: "P-A7", code: "P-A7", zone: "PROJECTOR" as const, row: "A", number: 7, posX: 54, posY: 34, capacity: 1 },
    { id: "P-A8", code: "P-A8", zone: "PROJECTOR" as const, row: "A", number: 8, posX: 46, posY: 27, capacity: 1 },
    { id: "P-B1", code: "P-B1", zone: "PROJECTOR" as const, row: "B", number: 1, posX: 48, posY: 76, capacity: 1 },
    { id: "P-B2", code: "P-B2", zone: "PROJECTOR" as const, row: "B", number: 2, posX: 57, posY: 77, capacity: 1 },
    { id: "P-B3", code: "P-B3", zone: "PROJECTOR" as const, row: "B", number: 3, posX: 65, posY: 79, capacity: 1 },
    { id: "P-B4", code: "P-B4", zone: "PROJECTOR" as const, row: "B", number: 4, posX: 73, posY: 80, capacity: 1 },
    { id: "P-B5", code: "P-B5", zone: "PROJECTOR" as const, row: "B", number: 5, posX: 92, posY: 57, capacity: 1 },
    { id: "P-B6", code: "P-B6", zone: "PROJECTOR" as const, row: "B", number: 6, posX: 79, posY: 67, capacity: 1 },
    { id: "P-B7", code: "P-B7", zone: "PROJECTOR" as const, row: "B", number: 7, posX: 79, posY: 62, capacity: 1 },
    { id: "P-B8", code: "P-B8", zone: "PROJECTOR" as const, row: "B", number: 8, posX: 79, posY: 57, capacity: 1 },
    { id: "P-C1", code: "P-C1", zone: "PROJECTOR" as const, row: "C", number: 1, posX: 88, posY: 74, capacity: 1 },
    { id: "P-C2", code: "P-C2", zone: "PROJECTOR" as const, row: "C", number: 2, posX: 46, posY: 81, capacity: 1 },
    { id: "P-C3", code: "P-C3", zone: "PROJECTOR" as const, row: "C", number: 3, posX: 54, posY: 82, capacity: 1 },
    { id: "P-C4", code: "P-C4", zone: "PROJECTOR" as const, row: "C", number: 4, posX: 63, posY: 83, capacity: 1 },
    { id: "P-C5", code: "P-C5", zone: "PROJECTOR" as const, row: "C", number: 5, posX: 71, posY: 85, capacity: 1 },
    { id: "P-C6", code: "P-C6", zone: "PROJECTOR" as const, row: "C", number: 6, posX: 91, posY: 68, capacity: 1 },
    { id: "P-C7", code: "P-C7", zone: "PROJECTOR" as const, row: "C", number: 7, posX: 92, posY: 63, capacity: 1 },
    { id: "P-C8", code: "P-C8", zone: "PROJECTOR" as const, row: "C", number: 8, posX: 91, posY: 52, capacity: 1 },
    { id: "P-D1", code: "P-D1", zone: "PROJECTOR" as const, row: "D", number: 1, posX: 85, posY: 81, capacity: 1 },
  ];

  for (const seat of seatsToCreate) {
    await prisma.seat.upsert({
      where: { id: seat.id },
      update: {
        posX: seat.posX,
        posY: seat.posY,
      },
      create: seat,
    });
  }

  console.log(`✅ Created ${seatsToCreate.length} seats`);

  // Initialize seat statuses for all events
  for (const event of events) {
    const existingStatuses = await prisma.seatStatus.count({
      where: { eventId: event.id },
    });

    if (existingStatuses === 0) {
      await prisma.seatStatus.createMany({
        data: seatsToCreate.map((seat) => ({
          eventId: event.id,
          seatId: seat.id,
          status: "AVAILABLE" as const,
        })),
      });
      console.log(`✅ Initialized seat statuses for event: ${event.title}`);
    }
  }

  // Mark some seats as reserved for demo
  await prisma.seatStatus.updateMany({
    where: {
      eventId: "el-clasico-2026",
      seatId: { in: ["P-A1", "P-A2", "P-B3", "T1-A1"] },
    },
    data: { status: "RESERVED" },
  });

  console.log("✅ Marked some seats as reserved for demo");

  // Create Admin User
  const hashedPassword = await bcrypt.hash("12345678", 12);
  await prisma.adminUser.upsert({
    where: { email: "ramoncaveroaras@gmail.com" },
    update: {},
    create: {
      email: "ramoncaveroaras@gmail.com",
      password: hashedPassword,
    },
  });
  console.log("✅ Created admin user");

  console.log("🎉 Seeding completed!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
