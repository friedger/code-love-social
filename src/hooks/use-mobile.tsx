import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const DESKTOP_XL_BREAKPOINT = 1280;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}

export function useIsDesktopXL() {
  const [isDesktopXL, setIsDesktopXL] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${DESKTOP_XL_BREAKPOINT}px)`);
    const onChange = () => {
      setIsDesktopXL(window.innerWidth >= DESKTOP_XL_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsDesktopXL(window.innerWidth >= DESKTOP_XL_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isDesktopXL;
}
