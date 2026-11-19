import type { SVGProps } from "react";

/** Small line icons, 24 grid, 1.8 stroke (as in the prototype). Decorative by default. */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 18, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const CheckIcon = (p: IconProps) => <Base {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Base>;
export const ArrowRightIcon = (p: IconProps) => <Base {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Base>;
export const ArrowLeftIcon = (p: IconProps) => <Base {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></Base>;
export const CloseIcon = (p: IconProps) => <Base {...p}><path d="M6 6l12 12M18 6L6 18" /></Base>;
export const ChevronDownIcon = (p: IconProps) => <Base {...p}><path d="M6 9l6 6 6-6" /></Base>;
export const SearchIcon = (p: IconProps) => <Base {...p}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4-4" /></Base>;
export const PlusIcon = (p: IconProps) => <Base {...p}><path d="M12 5v14M5 12h14" /></Base>;
export const InfoIcon = (p: IconProps) => <Base {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Base>;
export const AlertIcon = (p: IconProps) => <Base {...p}><path d="M12 3.5L2.5 20h19L12 3.5z" /><path d="M12 10v4M12 17h.01" /></Base>;
export const DownloadIcon = (p: IconProps) => <Base {...p}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></Base>;
export const PinIcon = (p: IconProps) => <Base {...p}><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></Base>;
export const SparkIcon = (p: IconProps) => <Base {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" /></Base>;
export const InboxIcon = (p: IconProps) => <Base {...p}><path d="M3 13l3-8h12l3 8v6H3v-6z" /><path d="M3 13h5l1.5 2.5h5L16 13h5" /></Base>;
export const UserIcon = (p: IconProps) => <Base {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></Base>;
export const PlayIcon = (p: IconProps) => <Base {...p} fill="currentColor" stroke="none"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></Base>;
export const PauseIcon = (p: IconProps) => <Base {...p} fill="currentColor" stroke="none"><rect x="6.5" y="5" width="4" height="14" rx="1.2" /><rect x="13.5" y="5" width="4" height="14" rx="1.2" /></Base>;
export const ExpandIcon = (p: IconProps) => <Base {...p}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></Base>;
export const GridIcon = (p: IconProps) => <Base {...p}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></Base>;
export const ChevronLeftIcon = (p: IconProps) => <Base {...p}><path d="M15 6l-6 6 6 6" /></Base>;
export const ChevronRightIcon = (p: IconProps) => <Base {...p}><path d="M9 6l6 6-6 6" /></Base>;
export const CommandIcon = (p: IconProps) => <Base {...p}><path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6z" /></Base>;
