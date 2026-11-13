// The shell's own pages follow the phone's language: German when it is set to German, else English.
// T(text) translates one string; static text in the page is swapped when the page loads.
(function () {
  const DE = {
    "Connect to your Pulse": "Mit deinem Pulse verbinden",
    "Pulse is self-hosted. Enter the address of the Pulse server you sign in to.": "Pulse läuft auf deinem eigenen Server. Gib die Adresse des Pulse-Servers ein, bei dem du dich anmeldest.",
    "Server address": "Serveradresse",
    "Connect": "Verbinden",
    "Cancel": "Abbrechen",
    "Checking…": "Wird geprüft…",
    "Enter your Pulse server’s address.": "Gib die Adresse deines Pulse-Servers ein.",
    "That isn’t a web address.": "Das ist keine Webadresse.",
    "Use an https:// address. The app only connects over HTTPS.": "Nutze eine https://-Adresse. Die App verbindet sich nur über HTTPS.",
    "Couldn’t reach that server. Check the address and your connection.": "Der Server ist nicht erreichbar. Prüfe die Adresse und deine Verbindung.",
    "Can’t reach Pulse": "Pulse nicht erreichbar",
    "Check your connection, or whether the server is up.": "Prüfe deine Verbindung oder ob der Server läuft.",
    "Try again": "Erneut versuchen",
    "Change server": "Server wechseln",
    "This phone’s Android System WebView is too old to open your server safely. Update it from the Play Store, then try again.":
      "Das Android System WebView auf diesem Handy ist zu alt, um deinen Server sicher zu öffnen. Aktualisiere es im Play Store und versuche es dann erneut.",
    "{0} didn’t answer. Check your connection, or whether the server is up.": "{0} hat nicht geantwortet. Prüfe deine Verbindung oder ob der Server läuft.",
  };
  const de = (navigator.language || "").toLowerCase().startsWith("de");
  window.T = (s, ...args) => (de && DE[s] ? DE[s] : s).replace(/\{(\d+)\}/g, (m, i) => (i < args.length ? String(args[i]) : m));
  if (!de) return;
  document.documentElement.lang = "de";
  document.title = T(document.title);
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walk.nextNode()) {
    const n = walk.currentNode;
    const key = n.textContent.trim();
    if (key && DE[key]) n.textContent = n.textContent.replace(key, DE[key]);
  }
})();
