const colors: Readonly<Record<string, string>> = {
  jade: '#376d62', blue: '#406591', vermilion: '#a43f34', gold: '#806020', violet: '#66528f', teal: '#216c69',
  rose: '#a04660', slate: '#506471', olive: '#56682f', copper: '#92552e', indigo: '#435293', sand: '#806139'
};

export function gamePlayerColor(color?: string): string { return colors[color ?? 'jade'] ?? colors['jade']; }
