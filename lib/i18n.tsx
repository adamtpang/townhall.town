"use client";
// Civic Spanish rules: usted throughout, tier names never translated, EAC glossary terms (No partidista,
// Día de las Elecciones, casilla de votación (TX) / centro de votación (NY, CA), estado de inscripción, buzones electorales).
// UI chrome translations, keyed by the exact English string. t() falls back to English, so a missing
// entry never breaks the page. Sourced text (quotes, race titles, data/*.json) is never passed through t().
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "es";

const ES: Record<string, string> = {
  // Shell
  "Your ballot, explained.": "Su boleta electoral, explicada.",
  "Nov 3, 2026": "3 de nov. de 2026",
  "Nonpartisan. Not a government site. No endorsements. Every fact links its source; confirm with your state.":
    "No partidista. No es un sitio del gobierno. No respaldamos a nadie. Cada dato enlaza su fuente; confírmelo con su estado.",
  // Search
  "ZIP code": "Código postal",
  "Enter your ZIP": "Su código postal",
  // Design p9: answer buttons
  Yes: "Sí",
  Neutral: "Neutral",
  No: "No",
  Go: "Ir",
  // Fair cards (Oct 30)
  "Strong no": "Totalmente no",
  "Strong yes": "Totalmente sí",
  "No photo found": "Sin foto",
  "Reading…": "Leyendo…",
  "New York, coming soon": "Nueva York, muy pronto",
  "New York": "Nueva York",
  "Enter a 5-digit ZIP code.": "Escriba un código postal de 5 dígitos.",
  "Austin, San Francisco, and New York 10001 for now.": "Por ahora: Austin, San Francisco y Nueva York 10001.",
  "Austin, SF and NYC for now.": "Por ahora: Austin, SF y NYC.",
  "Issue overlap with your answers": "Coincidencia de temas con sus respuestas",
  issues: "temas",
  "Using your saved answers.": "Usando sus respuestas guardadas.",
  Reset: "Borrar",
  "Office priority": "Prioridad del cargo",
  "Couldn't load your ballot right now. Please try again.": "No pudimos cargar su boleta electoral. Inténtelo de nuevo.",
  "Something went wrong talking to the agent. Please try again.": "Algo falló al hablar con el agente. Inténtelo de nuevo.",
  "Location isn't available in this browser. Type your ZIP instead.": "La ubicación no está disponible en este navegador. Escriba su código postal.",
  "Couldn't find a ZIP for your location.": "No encontramos un código postal para su ubicación.",
  "Location permission denied. Type your ZIP instead.": "Permiso de ubicación denegado. Escriba su código postal.",
  // Progress
  "Finding your districts": "Buscando sus distritos",
  "Listing every race and measure": "Listando cada contienda y medida",
  "Looking up candidates": "Buscando candidatos",
  "Pulling local Census data": "Obteniendo datos locales del Censo",
  "Writing your ballot": "Preparando su boleta electoral",
  // Ballot header
  " · Your ZIP spans two House districts. ": " · Su código postal abarca dos distritos de la Cámara. ",
  "Check which is yours": "Revise cuál es el suyo",
  " · No local problem data for this ZIP yet.": " · Aún no hay datos de problemas locales para este código postal.",
  // Race tiers
  "What matters on your ballot": "Lo que más importa en su boleta electoral",
  race: "contienda",
  races: "contiendas",
  "race source": "fuente de la contienda",
  // Issue match
  "Who lines up with you": "Quién coincide con usted",
  "What matters to you?": "¿Qué le importa?",
  "Your answers stay on this device. No sign-in, nothing sent to a server.":
    "Sus respuestas se quedan en este dispositivo. Sin registro, nada se envía a un servidor.",
  "See your issue overlap ↓": "Ver sus coincidencias ↓",
  Skip: "Omitir",
  Skipped: "Omitido",
  "Issue overlap": "Coincidencia por tema",
  "Issue overlap, not a recommendation.": "Coincidencia por tema, no una recomendación.",
  "No sourced positions on your issues.": "No hay posturas con fuente sobre sus temas.",
  "Sourced positions": "Posturas con fuente",
  source: "fuente",
  "It compares your answers with positions candidates have stated in sourced material, only where both exist. Most candidates have few or no sourced positions, so a missing score says nothing about them. Candidates are shown in ballot order.":
    "Compara sus respuestas con las posturas que los candidatos han expresado en material con fuente, solo donde existen ambas. La mayoría de los candidatos tiene pocas o ninguna postura con fuente, así que un puntaje faltante no dice nada de ellos. Los candidatos aparecen en el orden de la boleta.",
  "Talks about": "Habla de",
  "Lines up on": "Coincide en",
  of: "de",
  "compared issues": "temas comparados",
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
  "Your plan": "Su plan",
  Where: "Dónde",
  Bring: "Qué llevar",
  "Last day of early voting": "Último día de votación anticipada",
  "Election Day, 7 a.m. to 7 p.m.": "Día de las Elecciones, de 7 a.m. a 7 p.m.",
  "Your county sets locations": "Su condado fija los lugares",
  "Find your polling place": "Encuentre su casilla de votación",
  "One approved photo ID": "Una identificación con foto aprobada",
  "Accepted IDs": "Identificaciones aceptadas",
  "Last day of early voting (started Oct 24)": "Último día de votación anticipada (empezó el 24 de oct.)",
  "Last day to request a mail ballot in person": "Último día para pedir una boleta por correo en persona",
  "Election Day": "Día de las Elecciones",
  "Early voting and Election Day sites can differ": "Los lugares de votación anticipada y del Día de las Elecciones pueden ser distintos",
  "ID rules depend on how you registered": "Las reglas de identificación dependen de cómo se inscribió",
  "Election Day. Mail ballots postmarked by today": "Día de las Elecciones. Boletas por correo con matasellos de hoy",
  "Vote centers and drop boxes": "Centros de votación y buzones electorales",
  "Usually no ID needed": "Por lo general no se necesita identificación",
  "Check your voter status": "Revise su estado de inscripción",
  // Office reasons (RaceTiers.tierFor). Tier names themselves are not translated (Civic rule).
  "top federal or statewide office": "cargo federal o estatal principal",
  "statewide ballot measure": "medida electoral estatal",
  "your U.S. House seat": "su escaño en la Cámara de EE. UU.",
  "statewide executive office": "cargo ejecutivo estatal",
  "judicial seat": "cargo judicial",
  "state legislature": "legislatura estatal",
  "local office": "cargo local",
  "lower-profile office": "cargo de menor perfil",
  // Hero and search chrome (wired Oct 29 2026)
  "Know your ballot in 2 minutes.": "Conozca su boleta electoral en 2 minutos.",
  "Your vote matters.": "Su voto cuenta.",
  "Who\u2019s running, when to vote, where to go. Sourced and nonpartisan.": "Quién se postula, cuándo votar y a dónde ir. Con fuentes y no partidista.",
  "Enter a valid 5-digit ZIP": "Escriba un código postal válido de 5 dígitos",
  "Checking Polymarket prices": "Consultando precios de Polymarket",
  "Too many lookups in the last minute. Please wait a moment and try again.": "Demasiadas búsquedas en el último minuto. Espere un momento e inténtelo de nuevo.",
};

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "en", setLang: () => {} });

/** Spanish toggle is visible by default (Adam, Oct 29 2026; overrides the earlier Civic "hidden until native review" rule).
 *  NEXT_PUBLIC_SPANISH=0 at build time hides it again. Strings without a translation stay in English:
 *  see notes/spanish-untranslated.md. Candidate facts and sourced text are never translated. */
export const SPANISH_ENABLED = process.env.NEXT_PUBLIC_SPANISH !== "0";

export const LANG_KEY = "th-lang";

export function LangProvider({ children }: { children: ReactNode }) {
  // QA 4e15da7: ?lang=es (or ?lang=en) works, and the choice is remembered on this device (localStorage th-lang).
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    try {
      const q = new URLSearchParams(location.search).get("lang");
      const pick = q === "es" || q === "en" ? q : localStorage.getItem(LANG_KEY);
      if (SPANISH_ENABLED && (pick === "es" || pick === "en")) setLangState(pick);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = (l: Lang) => { setLangState(l); try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ } };
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
  if (!SPANISH_ENABLED) return null;
  return (
    <button type="button" onClick={() => setLang(lang === "en" ? "es" : "en")} className="inline-flex min-h-11 items-center text-sm text-black/60 underline underline-offset-4" aria-label={lang === "en" ? "Ver en español" : "View in English"}>
      {lang === "en" ? "Español" : "English"}
    </button>
  );
}
export const ES_FOR_TEST = ES;
