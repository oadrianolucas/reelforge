import type { ScreenProps } from "./types";
import { StatsDashboard } from "./StatsDashboard";

/** App screens recreated in code for the "app" scene of the elegant style. New screen: create <Name>.tsx here
 *  (tablet frame + content, see StatsDashboard), take every color from useTheme(), and register its id below.
 *  script.json refers to it by this id (scene.screen). */
export const SCREENS: Record<string, React.FC<ScreenProps>> = {
  "stats-dashboard": StatsDashboard,
};
