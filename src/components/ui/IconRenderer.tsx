import React from 'react';
import * as LucideIcons from 'lucide-react';
import { LucideProps } from 'lucide-react';

interface IconRendererProps extends LucideProps {
  name?: string;
  fallback?: React.ReactNode;
}

export const IconRenderer: React.FC<IconRendererProps> = ({ name, fallback, ...props }) => {
  if (!name) return <>{fallback}</>;

  const IconComponent = (LucideIcons as any)[name];

  if (!IconComponent) {
    return <>{fallback}</>;
  }

  return <IconComponent {...props} />;
};
