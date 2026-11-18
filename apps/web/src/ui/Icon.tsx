/** Small line icons drawn for TakaLeaf (24px grid, 1.8 stroke), so no icon font is needed. */
const PATHS = {
  home: "M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z",
  list: "M8 7h11M8 12h11M8 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01",
  wallet: "M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3M4 7.5V17a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 1 4 7.5ZM16 13.5h.01",
  people: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM3 20a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.5a6 6 0 0 1 3 5.5",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 12h.01",
  repeat: "M17 2.5 20.5 6 17 9.5M3.5 12V10a4 4 0 0 1 4-4h13M7 21.5 3.5 18 7 14.5M20.5 12v2a4 4 0 0 1-4 4h-13",
  chart: "M5 20V10M12 20V4M19 20v-7",
  tag: "M4 12.6V5a1 1 0 0 1 1-1h7.6l7.1 7.1a1.4 1.4 0 0 1 0 2l-5.6 5.6a1.4 1.4 0 0 1-2 0zM8.5 8.5h.01",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2.1-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2.1 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2.1 1.2L10 21h4l.5-2.6a7 7 0 0 0 2.1-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z",
  plus: "M12 5v14M5 12h14",
  left: "m14.5 6-6 6 6 6",
  right: "m9.5 6 6 6-6 6",
  down: "m6 9.5 6 6 6-6",
  out: "M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10",
  transfer: "M6 8h12l-3.5-3.5M18 16H6l3.5 3.5",
  arrowDown: "M12 5v14m0 0-5-5m5 5 5-5",
  arrowUp: "M12 19V5m0 0-5 5m5-5 5 5",
  /** Money in (down-left) and money out (up-right), as on the design's stat tiles and rows. */
  moneyIn: "M17 7 7 17M7 9v8h8",
  moneyOut: "M7 17 17 7M9 7h8v8",
  more: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  filter: "M4 6h16M7 12h10M10 18h4",
  sync: "M4 12a8 8 0 0 1 14-5l2 2M20 12a8 8 0 0 1-14 5l-2-2M20 4v5h-5M4 20v-5h5",
  download: "M12 4v11M7 11l5 5 5-5M5 20h14",
  close: "M6 6l12 12M18 6 6 18",
  backspace: "M9 6h11v12H9l-5-6zM12 10l4 4M16 10l-4 4",
  moon: "M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z",
  sun: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  lock: "M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3",
  device: "M8 3h8v18H8zM11 18h2",
  card: "M3 6h18v12H3zM3 10h18M7 15h3",
  bank: "M3 10h18L12 4zM5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18",
  phone: "M8 3h8v18H8zM11 18h2",
  cash: "M3 7h18v10H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 10v.01M18 14v.01",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  loan: "M4 9l8-5 8 5M5 9v9M19 9v9M3 20h18M9.5 12.5c0-1 1-1.5 2.5-1.5s2.5.6 2.5 1.6c0 2.4-5 1.2-5 3.6 0 1 1 1.8 2.5 1.8s2.5-.6 2.5-1.6M12 10v1M12 18v1",
  flag: "M5 21V4h11l-2 4 2 4H5",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v6M12 7.5h.01",
  edit: "M4 20h4L19 9l-4-4L4 16zM13 7l4 4",
  /** Savings and insurance: a safe (FDR), stacked coins (DPS), a certificate, a prize bond, a policy. */
  safe: "M4 5h16v14H4zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM16.5 12h1.5M6 19v2M18 19v2",
  coins: "M12 4c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 7v5c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5",
  certificate: "M5 4h14v12H5zM8 8h8M8 11h5M10 16l-1 5 3-2 3 2-1-5",
  ticket: "M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4zM14 6v12",
  shield: "M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6zM9 12l2 2 4-4",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  car: "M5 16h14v-4l-2-5H7l-2 5zM5 12h14M7 19v-3M17 19v-3",
  trophy: "M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8",
  percent: "M19 5 5 19M7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  check: "M5 12l5 5 9-10",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, className = "" }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
