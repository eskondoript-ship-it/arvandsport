/**
 * Forms post to the site's existing WordPress handler.
 *
 * Both forms on the live site are Elementor Pro forms, which submit to
 * wp-admin/admin-ajax.php with action=elementor_pro_forms_send_form and the
 * field names Elementor generated. Those exact ids and names are carried in
 * content/site.json and rendered onto the form element as data attributes, so
 * a submission from this front end lands in the same inbox as before.
 */
import { $, $$ } from './env.js';

const RECAPTCHA_SRC = 'https://www.google.com/recaptcha/api.js?render=';

let recaptchaPromise = null;

/** Load reCAPTCHA v3 once, and resolve to a token (or null if unavailable). */
function recaptchaToken(siteKey) {
  if (!siteKey) return Promise.resolve(null);
  if (!recaptchaPromise) {
    recaptchaPromise = new Promise((resolve) => {
      if (window.grecaptcha) return resolve(window.grecaptcha);
      const script = document.createElement('script');
      script.src = RECAPTCHA_SRC + encodeURIComponent(siteKey);
      script.async = true;
      script.onload = () => resolve(window.grecaptcha || null);
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    });
  }
  return recaptchaPromise.then((grecaptcha) => {
    if (!grecaptcha?.execute) return null;
    return new Promise((resolve) => {
      grecaptcha.ready(() => grecaptcha.execute(siteKey, { action: 'Form' }).then(resolve, () => resolve(null)));
    });
  });
}

function setStatus(form, message, kind) {
  const el = $('[data-status]', form);
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('is-error', kind === 'error');
  el.classList.toggle('is-success', kind === 'success');
}

/** Native constraint validation, surfaced inline rather than as a browser bubble. */
function validate(form) {
  let ok = true;
  for (const field of $$('.field', form)) {
    const control = field.querySelector('input:not([type=hidden]), textarea, select');
    const error = $('[data-error]', field);
    if (!control) continue;
    const valid = control.checkValidity();
    field.classList.toggle('is-invalid', !valid);
    if (error) error.textContent = valid ? '' : control.validationMessage;
    if (!valid && ok) {
      control.focus();
      ok = false;
    }
  }
  /* Radio groups live in a fieldset without a single control. */
  for (const group of $$('fieldset.field', form)) {
    const radios = $$('input[type=radio]', group);
    if (!radios.length || !radios.some((r) => r.required)) continue;
    const chosen = radios.some((r) => r.checked);
    group.classList.toggle('is-invalid', !chosen);
    const error = $('[data-error]', group);
    if (error) error.textContent = chosen ? '' : 'Please choose one.';
    if (!chosen && ok) {
      radios[0].focus();
      ok = false;
    }
  }
  return ok;
}

async function submit(form, extra) {
  const body = new FormData(form);
  for (const [key, value] of Object.entries(extra)) body.append(key, value);

  const token = await recaptchaToken(form.dataset.recaptcha);
  if (token) body.append('g-recaptcha-response', token);

  const res = await fetch(form.dataset.endpoint, {
    method: 'POST',
    body,
    credentials: 'omit',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json().catch(() => null);
  if (json && json.success === false) {
    throw new Error(json.data?.message || 'The server rejected the submission.');
  }
  return json;
}

function wire(form, extra, successMessage) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (form.classList.contains('is-busy')) return;
    if (!validate(form)) {
      setStatus(form, 'Please check the highlighted fields.', 'error');
      return;
    }
    form.classList.add('is-busy');
    setStatus(form, 'Sending…', null);
    try {
      await submit(form, extra);
      form.reset();
      setStatus(form, successMessage, 'success');
    } catch (error) {
      setStatus(form, `We could not send that (${error.message}). Please email Info@Arvandsport.com.`, 'error');
    } finally {
      form.classList.remove('is-busy');
    }
  });
}

export function initForms(root = document) {
  const registration = $('[data-wp-form]', root);
  if (registration) {
    wire(
      registration,
      {
        action: registration.dataset.action,
        post_id: registration.dataset.postId,
        form_id: registration.dataset.formId,
        referer_title: registration.dataset.refererTitle,
        queried_id: registration.dataset.queriedId,
      },
      'Thank you — your message has been sent. We will respond at the earliest possible time.',
    );
  }

  /* The footer subscribe box is the same Elementor form, id 2592ccd on post 95. */
  const subscribe = $('[data-subscribe]');
  if (subscribe && !subscribe.dataset.wired) {
    subscribe.dataset.wired = '1';
    subscribe.addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = subscribe.querySelector('input[type=email]');
      if (!input?.checkValidity()) {
        setStatus(subscribe, 'Please enter a valid email address.', 'error');
        input?.focus();
        return;
      }
      subscribe.classList.add('is-busy');
      setStatus(subscribe, 'Subscribing…', null);
      const body = new FormData();
      body.append('action', 'elementor_pro_forms_send_form');
      body.append('post_id', '95');
      body.append('form_id', '2592ccd');
      body.append('referer_title', document.title);
      body.append('queried_id', '95');
      body.append('form_fields[email]', input.value);
      try {
        const res = await fetch('https://arvandsport.com/wp-admin/admin-ajax.php', { method: 'POST', body, credentials: 'omit' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        subscribe.reset();
        setStatus(subscribe, 'Thanks — you are on the list.', 'success');
      } catch (error) {
        setStatus(subscribe, `Could not subscribe (${error.message}).`, 'error');
      } finally {
        subscribe.classList.remove('is-busy');
      }
    });
  }

  /* "Copy link" on articles. */
  for (const button of $$('[data-copy-link]', root)) {
    button.addEventListener('click', async () => {
      const original = button.textContent;
      try {
        await navigator.clipboard.writeText(button.dataset.url);
        button.textContent = 'Copied';
      } catch {
        button.textContent = 'Press ⌘/Ctrl+C';
      }
      setTimeout(() => { button.textContent = original; }, 1800);
    });
  }
}
