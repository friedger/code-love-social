import { useMemo } from "react";
import { minidenticon } from "minidenticons";

interface ContractIdenticonProps {
  /** Contract identifier to hash (e.g., "principal.contractName") */
  value: string;
  /** Size in pixels */
  size?: number;
  /** Saturation 0-100, default 95 */
  saturation?: number;
  /** Lightness 0-100, default 45 */
  lightness?: number;
  className?: string;
}

export function ContractIdenticon({
  value,
  size = 20,
  saturation = 95,
  lightness = 45,
  className,
}: ContractIdenticonProps) {
  const svgURI = useMemo(
    () =>
      "data:image/svg+xml;utf8," +
      encodeURIComponent(minidenticon(value, saturation, lightness)),
    [value, saturation, lightness]
  );

  return (
    <img
      src={svgURI}
      alt={value}
      width={size}
      height={size}
      className={className}
    />
  );
}
