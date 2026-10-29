import { forwardRef, createElement } from "react";
import type { IconProps, IconComponent, SvgNode } from "./types";

function toKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

export function createDuotoneIcon(
  displayName: string,
  strokeNodes: SvgNode[],
  fillNodes: SvgNode[] = []
): IconComponent {
  const Component = forwardRef<SVGSVGElement, IconProps>((props, ref) => {
    const {
      size = 20,
      color = "currentColor",
      strokeWidth = 1.85,
      className = "",
      style,
      "aria-hidden": ariaHiddenProp,
      "aria-label": ariaLabel,
      title,
      role,
      children,
      absoluteStrokeWidth,
      ...rest
    } = props;

    const numSize = typeof size === "number" ? size : parseFloat(String(size)) || 20;
    const computedStrokeWidth = absoluteStrokeWidth
      ? (Number(strokeWidth) * 24) / numSize
      : Number(strokeWidth);

    const hasAccessibleName = Boolean(ariaLabel || title);
    const ariaHidden = ariaHiddenProp !== undefined ? ariaHiddenProp : hasAccessibleName ? undefined : true;
    const computedRole = role || (hasAccessibleName ? "img" : undefined);

    const fillChildren = fillNodes.length > 0 ? createElement(
      "g",
      {
        className: "orbita-icon-fill",
        fill: color,
        fillOpacity: ["Activity", "Lightbulb"].includes(displayName) ? 0.28 : 0.20,
        stroke: "none",
        "aria-hidden": "true",
      },
      fillNodes.map(([tag, attrs], idx) => createElement(tag, { ...attrs, key: `f-${idx}` }))
    ) : null;

    const softLine = ["Activity", "MessageCircle", "Settings2", "Lightbulb"].includes(displayName)
      ? createElement("g", {fill: "none", stroke: color, strokeWidth: 5, strokeOpacity: 0.18, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true},
          strokeNodes.map(([tag, attrs], idx) => createElement(tag, {...attrs, key: `soft-${idx}`})))
      : null;
    const strokeChildren = createElement(
      "g",
      {
        className: "orbita-icon-stroke",
        fill: "none",
        stroke: color,
        strokeWidth: computedStrokeWidth,
        strokeLinecap: "round",
        strokeLinejoin: "round",
      },
      strokeNodes.map(([tag, attrs], idx) => createElement(tag, { ...attrs, key: `s-${idx}` }))
    );

    const kebab = toKebab(displayName);
    const combinedClass = `orbita-icon orbita-icon-${kebab} lucide lucide-${kebab} ${className}`.trim();

    return createElement(
      "svg",
      {
        ref,
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "0 0 24 24",
        width: size,
        height: size,
        className: combinedClass,
        style,
        role: computedRole,
        "aria-label": ariaLabel,
        "aria-hidden": ariaHidden,
        ...rest,
      },
      title ? createElement("title", { key: "title" }, title) : null,
      fillChildren,
      softLine,
      strokeChildren,
      children
    );
  });

  Component.displayName = displayName;
  return Component;
}
