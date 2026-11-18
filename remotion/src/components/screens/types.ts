import type { Theme } from "../theme";

/** Props of every app screen recreated in code and shown inside <Phone> (UgcNarrated "screen" scenes and the
 *  Recorded `{ ui }` panel). Anything extra comes from the job JSON (`props`), spread on top. Times are seconds
 *  since the screen entered. */
export type PhoneScreenProps = {
  theme: Theme;
  icon?: string; // URL (staticFile) of the app icon (favicon.svg of the job)
  appName?: string;
  store?: { name: string; email?: string }; // store/business shown inside the screen (script.json → store)
  duration: number; // seconds the screen stays on
  value?: number; // the "headline" number of the screen, when it has one
  [key: string]: unknown;
};
