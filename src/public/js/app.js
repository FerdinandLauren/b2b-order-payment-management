(function () {
  const shell = document.getElementById('appShell');

  document.querySelectorAll('[data-toggle-sidebar]').forEach(function (button) {
    button.addEventListener('click', function () {
      shell.classList.toggle('sidebar-open');
    });
  });

  document.querySelectorAll('[data-close-sidebar]').forEach(function (overlay) {
    overlay.addEventListener('click', function () {
      shell.classList.remove('sidebar-open');
    });
  });

  document.addEventListener('click', function (event) {
    const dismiss = event.target.closest('[data-dismiss]');
    if (dismiss) {
      const alert = dismiss.closest('.alert');
      if (alert) alert.remove();
    }
  });

  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (event) {
      if (!window.confirm(form.getAttribute('data-confirm'))) {
        event.preventDefault();
      }
    });
  });
})();
