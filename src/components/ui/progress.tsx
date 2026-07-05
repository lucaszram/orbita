import { cn } from '@/lib/utils';
import * as ProgressPrimitive from '@rn-primitives/progress';
import { View } from 'react-native';

function Progress({
  className,
  value,
  indicatorClassName,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  indicatorClassName?: string;
}) {
  return (
    <ProgressPrimitive.Root
      className={cn('bg-primary/20 relative h-2 w-full overflow-hidden rounded-full', className)}
      {...props}>
      <Indicator value={value} className={indicatorClassName} />
    </ProgressPrimitive.Root>
  );
}

export { Progress };

type IndicatorProps = {
  value: number | undefined | null;
  className?: string;
};

function Indicator({ value, className }: IndicatorProps) {
  return (
    <View
      className={cn('h-full overflow-hidden', className)}
      style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }}>
      <ProgressPrimitive.Indicator className={cn('h-full w-full', className)} />
    </View>
  );
}
