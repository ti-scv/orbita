import { forwardRef } from "react";
import type { IconProps, IconComponent } from "./types";
import { iconDefinitions } from "./definitions";
import { createDuotoneIcon } from "./createDuotoneIcon";

const iconCache: Record<string, IconComponent> = {};

export interface CentralIconProps extends IconProps {
  name: string;
}

export const Icon = forwardRef<SVGSVGElement, CentralIconProps>(({ name, ...props }, ref) => {
  if (!iconCache[name]) {
    const def = iconDefinitions[name] || iconDefinitions.CircleHelp;
    iconCache[name] = createDuotoneIcon(name, def.stroke, def.fill);
  }
  const Comp = iconCache[name];
  return <Comp ref={ref} {...props} />;
});

Icon.displayName = "Icon";
