import React from 'react';
import { View, Text } from 'react-native';

export type BadgeVariant = 'neutral' | 'indigo' | 'emerald' | 'amber' | 'sky';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  mono?: boolean;
}

const VARIANT_STYLES: Record<BadgeVariant, { container: string; text: string }> = {
  neutral: {
    container: 'bg-raised border-line',
    text: 'text-muted',
  },
  indigo: {
    container: 'bg-accent/15 border-accent/30',
    text: 'text-accent-soft',
  },
  emerald: {
    container: 'bg-ok/15 border-ok/30',
    text: 'text-ok',
  },
  amber: {
    container: 'bg-warm/15 border-warm/30',
    text: 'text-warm',
  },
  sky: {
    container: 'bg-info/15 border-info/30',
    text: 'text-info',
  },
};

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'neutral',
  mono = true,
}) => {
  const styles = VARIANT_STYLES[variant];
  return (
    <View
      className={`px-2 py-0.5 rounded-full border self-start flex-shrink-0 ${styles.container}`}
    >
      <Text
        numberOfLines={1}
        className={`text-[10px] font-semibold ${mono ? 'font-mono' : ''} ${styles.text}`}
      >
        {label}
      </Text>
    </View>
  );
};
