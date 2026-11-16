/* MatCan: small behaviours of the team pages (Pages/Teams). No inline handlers: everything is wired by data attributes.
     select[data-autosubmit]            submits its form when the choice changes (the role of a member)
     form[data-delete-team]             the button "Team endgültig löschen" is enabled only while the typed text equals the name of the team (input[data-confirm-name]); the server checks the name again
   The invitation dialog (data-dialog-open / data-autoopen), copy buttons (data-copy) and confirmations (data-confirm) are MatUi's. */
(function () {
  'use strict';

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t && t.matches && t.matches('select[data-autosubmit]') && t.form) {
      if (t.form.requestSubmit) { t.form.requestSubmit(); } else { t.form.submit(); }
    }
  });

  var form = document.querySelector('form[data-delete-team]');
  if (form) {
    var input = form.querySelector('input[data-confirm-name]');
    var button = form.querySelector('[data-delete-team-button]');
    var sync = function () { button.disabled = input.value.trim() !== input.getAttribute('data-confirm-name'); };
    input.addEventListener('input', sync);
    sync();
  }
})();
