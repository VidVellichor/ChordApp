import type { ComponentProps } from 'react';
import { Separator as SeparatorPrimitive } from 'radix-ui';

// Official shadcn new-york-v4 Separator, with local CSS instead of Tailwind utilities.
export function Separator({ className = '', orientation = 'horizontal', decorative = true, ...props }: ComponentProps<typeof SeparatorPrimitive.Root>) {
  return <SeparatorPrimitive.Root data-slot="separator" decorative={decorative} orientation={orientation} className={`separator ${className}`} {...props}/>;
}
