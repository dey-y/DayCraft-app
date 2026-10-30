import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { NotionIcon, NotionIconName } from './NotionIcon';
import { useTheme } from '@/store/useThemeStore';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'dashed';
  size?: 'xs' | 'sm' | 'md';
  icon?: NotionIconName;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'secondary',
  size = 'sm',
  icon,
  fullWidth = false,
}) => {
  const { colors } = useTheme();
  const variantClasses = {
    primary: 'bg-ink border border-ink active:opacity-85',
    secondary: 'bg-raised border border-line active:border-ink',
    ghost: 'bg-transparent border border-transparent active:bg-raised',
    dashed: 'bg-transparent border border-dashed border-line active:border-ink',
  }[variant];

  const textClasses = {
    primary: 'text-canvas font-bold',
    secondary: 'text-ink font-semibold',
    ghost: 'text-muted font-medium',
    dashed: 'text-muted font-medium',
  }[variant];

  const sizeClasses = {
    xs: 'px-2 py-1 rounded-lg',
    sm: 'px-3 py-1.5 rounded-xl',
    md: 'px-4 py-2.5 rounded-xl',
  }[size];

  const fontSizeClasses = {
    xs: 'text-[10px]',
    sm: 'text-xs',
    md: 'text-sm',
  }[size];

  const iconColor = variant === 'primary' ? colors.canvas : variant === 'secondary' ? colors.ink : colors.muted;

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center justify-center gap-1.5 ${variantClasses} ${sizeClasses} ${
        fullWidth ? 'w-full' : 'self-start'
      }`}
    >
      {icon ? (
        <View>
          <NotionIcon name={icon} size={size === 'xs' ? 12 : 14} color={iconColor} />
        </View>
      ) : null}
      <Text numberOfLines={1} className={`${textClasses} ${fontSizeClasses}`}>
        {label}
      </Text>
    </Pressable>
  );
};
