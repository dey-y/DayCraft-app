import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { NotionIcon, NotionIconName } from './NotionIcon';

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
  const variantClasses = {
    primary: 'bg-white border border-white active:opacity-85',
    secondary: 'bg-[#1f2430] border border-[#2d3345] active:border-white',
    ghost: 'bg-transparent border border-transparent active:bg-[#1f2430]',
    dashed: 'bg-transparent border border-dashed border-[#2d3345] active:border-white',
  }[variant];

  const textClasses = {
    primary: 'text-black font-bold',
    secondary: 'text-[#e6edf3] font-semibold',
    ghost: 'text-[#8b949e] font-medium',
    dashed: 'text-[#8b949e] font-medium',
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

  const iconColor = variant === 'primary' ? '#000000' : variant === 'secondary' ? '#e6edf3' : '#8b949e';

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
