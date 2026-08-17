export function redirigerVersConnexionShell(returnUrl: string): false {
  const port = location.port.startsWith('24') ? '24207' : location.port.startsWith('14') ? '14207' : '4207';
  const shell = window.parent !== window ? location.origin : `${location.protocol}//${location.hostname}:${port}`;
  window.top?.location.assign(`${shell}/connexion?returnUrl=${encodeURIComponent(returnUrl)}`);
  return false;
}
