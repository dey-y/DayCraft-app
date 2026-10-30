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
    container: 'bg-[#1f2430] border-[#2d3345]',
    text: 'text-[#8b949e]',
  },
  indigo: {
    container: 'bg-indigo-500/15 border-indigo-500/30',
    text: 'text-indigo-300',
  },
  emerald: {
    container: 'bg-emerald-500/15 border-emerald-500/30',
    text: 'text-emerald-400',
  },
  amber: {
    container: 'bg-amber-500/15 border-amber-500/30',
    text: 'text-amber-400',
  },
  sky: {
    container: 'bg-sky-500/15 border-sky-500/30',
    text: 'text-sky-400',
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
