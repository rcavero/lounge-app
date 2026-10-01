import { SuggestionsClient } from "./client";
import { COMPETITIONS } from "@/modules/football-data/config/competitions";
import { redirectUnlessAdmin } from "@/lib/auth-guard";

export default async function SuggestionsPage() {
  await redirectUnlessAdmin();

  const competitions = COMPETITIONS.map((c) => ({
    code: c.code,
    name: c.name,
  }));

  return <SuggestionsClient competitions={competitions} />;
}
