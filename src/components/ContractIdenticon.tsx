import { useMemo } from "react";
import { minidenticon } from "minidenticons";
import { getContractIdenticonSeed, type ContractRef } from "@/lib/utils";

interface ContractIdenticonProps {
  /**
   * Typed contract reference. The identicon is always seeded from
   * `principal.contractName` to guarantee a single source of truth across
   * every place a contract is rendered.
   */
  contract: ContractRef;
  /** Size in pixels */
  size?: number;
  /** Saturation 0-100, default 95 */
  saturation?: number;
  /** Lightness 0-100, default 45 */
  lightness?: number;
  className?: string;
}

export function ContractIdenticon({
  contract,
  size = 20,
  saturation = 95,
  lightness = 45,
  className,
}: ContractIdenticonProps) {
  const { svgURI, seed } = useMemo(() => {
    const seed = getContractIdenticonSeed(contract);
    return {
      seed,
      svgURI:
        "data:image/svg+xml;utf8," +
        encodeURIComponent(minidenticon(seed, saturation, lightness)),
    };
  }, [contract, saturation, lightness]);

  return (
    <img
      src={svgURI}
      alt={seed}
      width={size}
      height={size}
      className={className}
    />
  );
}
