export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleString('en-GB', {
    dateStyle: 'short',
    timeStyle: 'medium',
  });
}
