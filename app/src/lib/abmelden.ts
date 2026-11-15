// Abmelden immer in zwei Schritten: Knopf drücken, dann in der Rückfrage bestätigen
import { auth } from "./auth.svelte";
import { frage } from "./frage.svelte";

export async function abmeldenFragen() {
  if (!(await frage("Abmelden?", "Du wirst auf diesem Gerät abgemeldet. Danach meldest du dich mit Passwort und Bestätigungscode neu an.", "Abmelden", true))) return;
  await auth.abmelden();
}
