"use client";
// UI chrome translations, keyed by the exact English string. t() falls back to English, so a missing
// entry never breaks the page. Sourced text (quotes, race titles, data/*.json) is never passed through t().
import { createContext, useContext, useState, type ReactNode } from "react";

export type Lang = "en" | "es";

const ES: Record<string, string> = {
  // Shell
  "Your ballot, explained.": "Tu boleta, explicada.",
  "Nov 3, 2026": "3 de nov. de 2026",
  "Nonpartisan. Not a government site. No endorsements. Every fact links its source; confirm with your state.":
    "Imparcial. No es un sitio del gobierno. No respaldamos a nadie. Cada dato enlaza su fuente; confírmalo con tu estado.",
  // Search
  "ZIP code": "Código postal",
  "Enter your ZIP": "Escribe tu código postal",
  Go: "Ir",
  "Reading…": "Leyendo…",
  "New York, coming soon": "Nueva York, muy pronto",
  "New York": "Nueva York",
  "Enter a 5-digit ZIP code.": "Escribe un código postal de 5 dígitos.",
  "Austin, San Francisco, and New York 10001 for now.": "Por ahora: Austin, San Francisco y Nueva York 10001.",
  "Couldn't load your ballot right now. Please try again.": "No pudimos cargar tu boleta. Inténtalo de nuevo.",
  "Something went wrong talking to the agent. Please try again.": "Algo falló al hablar con el agente. Inténtalo de nuevo.",
  "Location isn't available in this browser. Type your ZIP instead.": "La ubicación no está disponible en este navegador. Escribe tu código postal.",
  "Couldn't find a ZIP for your location.": "No encontramos un código postal para tu ubicación.",
  "Location permission denied. Type your ZIP instead.": "Permiso de ubicación denegado. Escribe tu código postal.",
  // Progress
  "Finding your districts": "Buscando tus distritos",
  "Listing every race and measure": "Listando cada contienda y medida",
  "Looking up candidates": "Buscando candidatos",
  "Checking prediction markets": "Revisando mercados de predicción",
  "Pulling local Census data": "Obteniendo datos locales del Censo",
  "Writing your ballot": "Escribiendo tu boleta",
  // Ballot header
  " · Your ZIP spans two House districts. ": " · Tu código postal abarca dos distritos de la Cámara. ",
  "Check which is yours": "Revisa cuál es el tuyo",
  " · No local problem data for this ZIP yet.": " · Aún no hay datos de problemas locales para este código postal.",
  // Race tiers
  "What matters on your ballot": "Lo que más importa en tu boleta",
  // Candidate details
  "Tap a candidate for their issues, money and links.": "Toca a un candidato para ver sus temas, dinero y enlaces.",
  "Party: unsure": "Partido: no se sabe",
  Incumbent: "En el cargo",
  "Incumbent: unsure": "En el cargo: no se sabe",
  Close: "Cerrar",
  mention: "mención",
  mentions: "menciones",
  "keyword match in their own campaign text": "coincidencia de palabras en su propio texto de campaña",
  "Tap an issue to see their own words.": "Toca un tema para ver sus propias palabras.",
  "Unsure: no campaign themes on file.": "No se sabe: no hay temas de campaña registrados.",
  "Campaign money": "Dinero de campaña",
  Raised: "Recaudado",
  Spent: "Gastado",
  "Cash on hand": "Efectivo disponible",
  "From small donors (under $200)": "De donantes pequeños (menos de $200)",
  "From in-state donors (itemized)": "De donantes del estado (detallados)",
  "Top employers of donors": "Principales empleadores de donantes",
  "Top PACs and committees": "Principales PAC y comités",
  report: "informe",
  "FEC report": "Informe de la FEC",
  through: "hasta el",
  "Individual donors are not named.": "No nombramos a donantes individuales.",
  "No FEC data for this race.": "No hay datos de la FEC para esta contienda.",
  "Texas Ethics Commission": "Comisión de Ética de Texas",
  "Finance records": "Registros financieros",
  "Campaign site": "Sitio de campaña",
  "Official site": "Sitio oficial",
  "Office impact × how close the race is. Ranks races, never candidates.":
    "Impacto del cargo × qué tan reñida está la contienda. Clasifica contiendas, nunca candidatos.",
  race: "contienda",
  races: "contiendas",
  "race source": "fuente de la contienda",
  market: "mercado",
  "No market odds yet": "Aún no hay probabilidades de mercado",
  // Issue match
  "Who lines up with you": "Quién coincide contigo",
  "What matters to you?": "¿Qué te importa?",
  "Your answers stay on this device. No sign-in, nothing sent to a server.":
    "Tus respuestas se quedan en este dispositivo. Sin registro, nada se envía a un servidor.",
  "See your issue overlap ↓": "Ver tus coincidencias ↓",
  Skip: "Omitir",
  Skipped: "Omitido",
  "Issue overlap": "Coincidencia por tema",
  "Issue overlap, not a recommendation.": "Coincidencia por tema, no una recomendación.",
  "Answer at least one issue above to see overlap and candidate tiers. With no answers, nothing is tiered.":
    "Responde al menos un tema arriba para ver coincidencias y niveles. Sin respuestas, no se clasifica nada.",
  "Not enough sourced positions to compare candidates in this race yet.":
    "Aún no hay suficientes posturas con fuente para comparar candidatos en esta contienda.",
  "No sourced positions on your issues.": "No hay posturas con fuente sobre tus temas.",
  "Tier based on your answers and sourced records.": "Nivel basado en tus respuestas y registros con fuente.",
  "Sourced positions": "Posturas con fuente",
  source: "fuente",
  "It compares your answers with positions candidates have stated in sourced material, only where both exist. Most candidates have few or no sourced positions, so a missing score says nothing about them. Candidates are shown in ballot order.":
    "Compara tus respuestas con las posturas que los candidatos han expresado en material con fuente, solo donde existen ambas. La mayoría de los candidatos tiene pocas o ninguna postura con fuente, así que un puntaje faltante no dice nada de ellos. Los candidatos aparecen en el orden de la boleta.",
  "Talks about": "Habla de",
  "Lines up on": "Coincide en",
  of: "de",
  "compared issues": "temas comparados",
  "sourced position on your issues. Not tiered.": "postura con fuente sobre tus temas. Sin nivel.",
  "sourced positions on your issues. Not tiered.": "posturas con fuente sobre tus temas. Sin nivel.",
  "Oct 30": "30 de oct.",
  "Nov 1": "1 de nov.",
  "Nov 2": "2 de nov.",
  "Nov 3": "3 de nov.",
  // Issues (lib/issues.ts labels and slider ends)
  "Housing costs": "Costo de la vivienda",
  "Healthcare access": "Acceso a la salud",
  "Jobs and wages": "Empleo y salarios",
  Taxes: "Impuestos",
  "Public safety": "Seguridad pública",
  Education: "Educación",
  "Energy and grid": "Energía y red eléctrica",
  "Immigration and border": "Inmigración y frontera",
  "Wealth tax (Prop 40)": "Impuesto a la riqueza (Prop. 40)",
  "Water and infrastructure": "Agua e infraestructura",
  "Government should stay out of housing costs": "El gobierno no debe intervenir en el costo de la vivienda",
  "Government should act to lower housing costs": "El gobierno debe actuar para bajar el costo de la vivienda",
  "Smaller government role in healthcare": "Menor papel del gobierno en la salud",
  "Government should expand healthcare access": "El gobierno debe ampliar el acceso a la salud",
  "Leave wages to the market": "Dejar los salarios al mercado",
  "Government should act to raise wages": "El gobierno debe actuar para subir los salarios",
  "Lower taxes, fewer public services": "Menos impuestos, menos servicios públicos",
  "Higher taxes, more public services": "Más impuestos, más servicios públicos",
  "More emphasis on diversion and prevention": "Más énfasis en alternativas y prevención",
  "More emphasis on detention and enforcement": "Más énfasis en detención y aplicación de la ley",
  "Keep public school money in public schools": "Mantener el dinero de las escuelas públicas en las escuelas públicas",
  "Let public school money follow students to private schools": "Que el dinero escolar público siga a los estudiantes a escuelas privadas",
  "Prioritize oil and gas": "Priorizar el petróleo y el gas",
  "Prioritize environmental protection and renewables": "Priorizar la protección ambiental y las renovables",
  "Less border enforcement": "Menos control fronterizo",
  "More border enforcement": "Más control fronterizo",
  "No new tax on very large fortunes": "Ningún impuesto nuevo a las grandes fortunas",
  "A new tax on very large fortunes": "Un impuesto nuevo a las grandes fortunas",
  "Less public spending on water and infrastructure": "Menos gasto público en agua e infraestructura",
  "More public spending on water and infrastructure": "Más gasto público en agua e infraestructura",
  // Measure math
  "The measures, by the numbers": "Las medidas, en números",
  "Cost, who pays and what changes, from official analyses. “unsure” means the official text gives no figure.":
    "Costo, quién paga y qué cambia, según análisis oficiales. “unsure” significa que el texto oficial no da una cifra.",
  Cost: "Costo",
  "Who pays": "Quién paga",
  "What changes": "Qué cambia",
  "official source": "fuente oficial",
  // Plan
  "Your plan": "Tu plan",
  Where: "Dónde",
  Bring: "Qué llevar",
  "Last day of early voting": "Último día de votación anticipada",
  "Election Day, 7 a.m. to 7 p.m.": "Día de la elección, de 7 a.m. a 7 p.m.",
  "Your county sets locations": "Tu condado fija los lugares",
  "Find your polling place": "Encuentra tu lugar de votación",
  "One approved photo ID": "Una identificación con foto aprobada",
  "Accepted IDs": "Identificaciones aceptadas",
  "Last day of early voting (started Oct 24)": "Último día de votación anticipada (empezó el 24 de oct.)",
  "Last day to request a mail ballot in person": "Último día para pedir una boleta por correo en persona",
  "Election Day": "Día de la elección",
  "Early voting and Election Day sites can differ": "Los lugares de votación anticipada y del día de la elección pueden ser distintos",
  "ID rules depend on how you registered": "Las reglas de identificación dependen de cómo te registraste",
  "Election Day. Mail ballots postmarked by today": "Día de la elección. Boletas por correo con matasellos de hoy",
  "Vote centers and drop boxes": "Centros de votación y buzones",
  "Usually no ID needed": "Por lo general no se necesita identificación",
  "Check your voter status": "Revisa tu estado de votante",
  // Tier reasons (RaceTiers.tierFor)
  "top federal or statewide office": "cargo federal o estatal principal",
  "statewide ballot measure": "medida electoral estatal",
  "your U.S. House seat": "tu escaño en la Cámara de EE. UU.",
  "statewide executive office": "cargo ejecutivo estatal",
  "judicial seat": "cargo judicial",
  "state legislature": "legislatura estatal",
  "local office": "cargo local",
  "lower-profile office": "cargo de menor perfil",
  "market leader at": "líder del mercado en",
  close: "reñida",
  leaning: "inclinada",
  lopsided: "desigual",
  "no market, so no competitiveness boost": "sin mercado, así que sin aumento por competencia",
};

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "en", setLang: () => {} });

export function LangProvider({ children }: { children: ReactNode }) {
  // English on every fresh load: the choice is kept in memory only.
  const [lang, setLang] = useState<Lang>("en");
  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <div lang={lang}>{children}</div>
    </LangContext.Provider>
  );
}

export function useT() {
  const { lang } = useContext(LangContext);
  return (s: string) => (lang === "es" ? ES[s] ?? s : s);
}

/** Inline translation for server components. */
export function T({ children }: { children: string }) {
  return <>{useT()(children)}</>;
}

export function LangToggle() {
  const { lang, setLang } = useContext(LangContext);
  return (
    <button type="button" onClick={() => setLang(lang === "en" ? "es" : "en")} className="text-sm text-black/60 underline-offset-4 hover:underline" aria-label={lang === "en" ? "Ver en español" : "View in English"}>
      {lang === "en" ? "Español" : "English"}
    </button>
  );
}
