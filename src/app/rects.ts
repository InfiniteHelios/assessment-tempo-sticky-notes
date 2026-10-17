import type { AxisRect } from '../domain/geometry';

export function axisRectFromElement(element: Element | null): AxisRect | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
  };
}
