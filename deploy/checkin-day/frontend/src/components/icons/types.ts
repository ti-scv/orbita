import type { SVGProps, CSSProperties, ForwardRefExoticComponent, RefAttributes } from "react";

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
  strokeWidth?: number | string;
  className?: string;
  style?: CSSProperties;
  "aria-hidden"?: boolean | "true" | "false";
  "aria-label"?: string;
  title?: string;
  role?: string;
  absoluteStrokeWidth?: boolean;
}

export type IconComponent = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;

export type SvgNode = [string, Record<string, string>];

export interface IconDefinition {
  stroke: SvgNode[];
  fill: SvgNode[];
}
