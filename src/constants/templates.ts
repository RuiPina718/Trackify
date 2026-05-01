export interface SubscriptionTemplate {
  name: string;
  category: string;
  defaultAmount: number;
  icon?: string;
  color: string;
}

export const SUBSCRIPTION_TEMPLATES: SubscriptionTemplate[] = [
  { name: 'Netflix', category: 'Streaming', defaultAmount: 11.99, color: '#E50914', icon: 'Tv' },
  { name: 'Spotify', category: 'Streaming', defaultAmount: 6.99, color: '#1DB954', icon: 'Music' },
  { name: 'Disney+', category: 'Streaming', defaultAmount: 8.99, color: '#006E99', icon: 'Play' },
  { name: 'Amazon Prime', category: 'Streaming', defaultAmount: 4.99, color: '#FF9900', icon: 'ShoppingBag' },
  { name: 'YouTube Premium', category: 'Streaming', defaultAmount: 8.49, color: '#FF0000', icon: 'Youtube' },
  { name: 'iCloud+', category: 'Software', defaultAmount: 0.99, color: '#007AFF', icon: 'Cloud' },
  { name: 'ChatGPT Plus', category: 'Software', defaultAmount: 20.00, color: '#10A37F', icon: 'Cpu' },
  { name: 'PlayStation Plus', category: 'Gaming', defaultAmount: 8.99, color: '#003087', icon: 'Gamepad2' },
  { name: 'Xbox Game Pass', category: 'Gaming', defaultAmount: 10.99, color: '#107C10', icon: 'Gamepad' },
  { name: 'Gym/Ginasio', category: 'Saúde', defaultAmount: 30.00, color: '#FFD700', icon: 'Dumbbell' },
];
