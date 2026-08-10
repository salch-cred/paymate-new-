import type { SVGProps } from "react"
import {
  ArrowRight01Icon,
  SparklesIcon,
  Wallet01Icon,
  Shield01Icon,
  FlashIcon,
  Link01Icon,
  Analytics01Icon,
  Tick01Icon,
  Copy01Icon,
  Invoice01Icon,
  UserGroupIcon,
  Globe01Icon,
  SentIcon,
  Menu01Icon,
  Cancel01Icon,
  Receipt01Icon,
  LockKeyIcon,
  NodesIcon,
  ArrowDown01Icon
} from "hugeicons-react"

export type IconName = "arrow" | "spark" | "wallet" | "shield" | "bolt" | "link" | "chart" | "check" | "copy" | "invoice" | "users" | "globe" | "send" | "menu" | "close" | "receipt" | "lock" | "network" | "chevron"

const components: Record<IconName, React.FC<any>> = {
  arrow: ArrowRight01Icon,
  spark: SparklesIcon,
  wallet: Wallet01Icon,
  shield: Shield01Icon,
  bolt: FlashIcon,
  link: Link01Icon,
  chart: Analytics01Icon,
  check: Tick01Icon,
  copy: Copy01Icon,
  invoice: Invoice01Icon,
  users: UserGroupIcon,
  globe: Globe01Icon,
  send: SentIcon,
  menu: Menu01Icon,
  close: Cancel01Icon,
  receipt: Receipt01Icon,
  lock: LockKeyIcon,
  network: NodesIcon,
  chevron: ArrowDown01Icon,
}

export function Icon({ name, size = 20, ...props }: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  const Comp = components[name] || ArrowRight01Icon;
  return <Comp size={size} color="currentColor" strokeWidth={1.8} {...props} />
}
