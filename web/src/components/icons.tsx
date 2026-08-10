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
  GlobeIcon,
  SentIcon,
  Menu01Icon,
  Cancel01Icon,
  ReceiptDollarIcon,
  LockKeyIcon,
  AiNetworkIcon,
  ArrowDown01Icon
} from "hugeicons-react"

export type IconName = "arrow" | "spark" | "wallet" | "shield" | "bolt" | "link" | "chart" | "check" | "copy" | "invoice" | "users" | "globe" | "send" | "menu" | "close" | "receipt" | "lock" | "network" | "chevron"

const components: Record<IconName, typeof ArrowRight01Icon> = {
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
  globe: GlobeIcon,
  send: SentIcon,
  menu: Menu01Icon,
  close: Cancel01Icon,
  receipt: ReceiptDollarIcon,
  lock: LockKeyIcon,
  network: AiNetworkIcon,
  chevron: ArrowDown01Icon,
}

export function Icon({ name, size = 20, ...props }: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  const Comp = components[name] || ArrowRight01Icon;
  // Strip SVG attributes that conflict with HugeiconsIconProps in the spread.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { color, strokeWidth, ...cleanProps } = props;
  return <Comp size={size} color="currentColor" strokeWidth={1.8} {...cleanProps} />
}
