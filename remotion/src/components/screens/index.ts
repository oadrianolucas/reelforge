import type { PhoneScreenProps } from "./types";
import { SalesStats } from "./SalesStats";
import { Menu } from "./Menu";
import { OrderStatus } from "./OrderStatus";
import { StampCard } from "./StampCard";

export type { PhoneScreenProps } from "./types";

/** App screens recreated in code, shown inside <Phone> by UgcNarrated ("screen" scenes), Recorded (`{ ui }` media)
 *  and AppShowcase (`screen` shots). New screen: create <Name>.tsx here (a full-bleed component drawn at 390x844
 *  points, see SalesStats), using `theme` for every color, and register its id below. The job JSON refers to it by this id. */
export const PHONE_SCREENS: Record<string, React.FC<PhoneScreenProps>> = {
  "sales-stats": SalesStats,
  menu: Menu,
  "order-status": OrderStatus,
  "stamp-card": StampCard,
};
