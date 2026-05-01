import { Subscription, UserProfile } from '../types';

export function exportToCSV(data: any[], filename: string) {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const val = row[header];
        if (typeof val === 'string' && val.includes(',')) {
          return `"${val}"`;
        }
        return val;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export function exportSubscriptionsToCSV(subscriptions: Subscription[], filename: string = 'subs.csv') {
  const data = subscriptions.map(s => ({
    Nome: s.name,
    Valor: s.amount,
    Moeda: s.currency || 'EUR',
    Ciclo: s.billingCycle,
    Dia: s.billingDay,
    Categoria: s.category,
    Status: s.status
  }));
  exportToCSV(data, filename);
}

export function exportUsersToCSV(users: UserProfile[], subscriptions: Subscription[], filename: string = 'utilizadores.csv') {
  const data = users.map(user => {
    const userSubs = subscriptions.filter(s => s.userId === user.uid);
    const totalAmount = userSubs.reduce((acc, s) => acc + s.amount, 0);
    return {
      Email: user.email,
      Nome: user.displayName || 'Sem nome',
      Subscricoes: userSubs.length,
      'Total Mensal (Estimado)': totalAmount.toFixed(2),
      'Data Registo': user.createdAt
    };
  });
  exportToCSV(data, filename);
}

export function exportUserDataToJSON(profile: UserProfile, subscriptions: Subscription[]) {
  const exportData = {
    profile,
    subscriptions,
    exportedAt: new Date().toISOString(),
    version: '1.0'
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `trackify-data-${profile.uid.slice(0, 5)}.json`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
