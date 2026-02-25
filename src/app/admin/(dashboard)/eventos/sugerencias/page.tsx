import { SuggestionsClient } from "./client";
import { COMPETITIONS } from "@/modules/football-data/config/competitions";

export default function SuggestionsPage() {
  const competitions = COMPETITIONS.map((c) => ({
    code: c.code,
    name: c.name,
  }));

  return <SuggestionsClient competitions={competitions} />;
}
