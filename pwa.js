/* Installation is optional; all existing website features work without it. */
(function () {
  'use strict';
  const installButton = document.getElementById('installApp');
  const dialog = document.getElementById('installHelp');
  const installNow = document.getElementById('installNow');
  const connectionNote = document.getElementById('connectionNote');
  const updateNote = document.getElementById('appUpdate');
  const standalone = window.matchMedia('(display-mode: standalone)');
  let installPrompt = null;
  let waitingWorker = null;

  function showInstallState() {
    installButton.hidden = standalone.matches || window.navigator.standalone === true;
  }
  showInstallState();
  if (standalone.addEventListener) standalone.addEventListener('change', showInstallState);

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    installPrompt = event;
    installNow.hidden = false;
  });
  window.addEventListener('appinstalled', function () {
    installPrompt = null;
    installNow.hidden = true;
    installButton.hidden = true;
    if (dialog.open) dialog.close();
  });

  async function requestInstall() {
    if (!installPrompt) return;
    const prompt = installPrompt;
    installPrompt = null;
    installNow.hidden = true;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') {
        installButton.hidden = true;
        if (dialog.open) dialog.close();
      }
    } catch (error) {
      if (!dialog.open) dialog.showModal();
    }
  }
  installButton.addEventListener('click', function () {
    if (installPrompt) requestInstall();
    else if (!dialog.open) dialog.showModal();
  });
  installNow.addEventListener('click', requestInstall);
  document.getElementById('installClose').addEventListener('click', function () { dialog.close(); });

  function showConnectionState() {
    connectionNote.hidden = navigator.onLine;
  }
  window.addEventListener('online', showConnectionState);
  window.addEventListener('offline', showConnectionState);
  showConnectionState();

  document.getElementById('refreshApp').addEventListener('click', function () {
    if (waitingWorker) waitingWorker.postMessage({type: 'SKIP_WAITING'});
  });

  if ('serviceWorker' in navigator && window.isSecureContext) {
    // No forced reload while a student is reading. A waiting update needs a click.
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (waitingWorker && !refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js', {scope: './', updateViaCache: 'none'})
        .then(function (registration) {
          function offerUpdate(worker) {
            if (!worker || !navigator.serviceWorker.controller) return;
            waitingWorker = worker;
            updateNote.hidden = false;
          }
          offerUpdate(registration.waiting);
          registration.addEventListener('updatefound', function () {
            const incoming = registration.installing;
            if (!incoming) return;
            incoming.addEventListener('statechange', function () {
              if (incoming.state === 'installed') offerUpdate(registration.waiting || incoming);
            });
          });
        }).catch(function () {
          // Browser installation and the normal online website remain usable.
        });
    });
  }
})();
