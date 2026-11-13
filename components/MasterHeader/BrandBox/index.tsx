import type { BrandBoxProps } from "./types";
import VerticalBrandBox from "./VerticalBrandBox";

export default function BrandBox(props: Omit<BrandBoxProps, "variant">) {
  return <VerticalBrandBox {...props} />;
}
