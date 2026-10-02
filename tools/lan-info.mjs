/* Affiche les adresses réseau du PC et les commandes à essayer quand Expo Go n'arrive pas à se connecter.
   Usage : npm run lan */
import os from 'node:os';

const nets = Object.entries(os.networkInterfaces()).flatMap(([name, list]) => (list || []).filter((i) => i.family === 'IPv4' && !i.internal).map((i) => ({ name, ip: i.address })));
const virtual = /vethernet|virtual|vmware|vbox|wsl|docker|hyper-v|loopback|tailscale|zerotier|vpn/i;
console.log('\nAdresses IPv4 de ce PC :');
nets.forEach((n) => console.log(`  ${n.ip.padEnd(16)} ${n.name}${virtual.test(n.name) ? '   <- carte virtuelle/VPN : le téléphone ne pourra pas l\'atteindre' : ''}`));
const best = nets.find((n) => !virtual.test(n.name) && /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(n.ip));
console.log('\nLe téléphone doit être sur le MÊME Wi-Fi que ce PC.');
if (best) {
  console.log(`\nAdresse probable à utiliser : ${best.ip}`);
  console.log('\nPowerShell :');
  console.log(`  $env:REACT_NATIVE_PACKAGER_HOSTNAME="${best.ip}"; npx expo start --lan --clear`);
  console.log('\nCmd :');
  console.log(`  set REACT_NATIVE_PACKAGER_HOSTNAME=${best.ip} && npx expo start --lan --clear`);
  console.log(`\nSi le QR code ne fonctionne pas : dans Expo Go, « Enter URL manually » puis tapez :  exp://${best.ip}:8081`);
} else console.log('\nAucune adresse de réseau local évidente : essayez  npm run start:tunnel');
console.log('\nPare-feu Windows (PowerShell en administrateur), pour autoriser le port d\'Expo :');
console.log('  netsh advfirewall firewall add rule name="Expo Metro" dir=in action=allow protocol=TCP localport=8081\n');
