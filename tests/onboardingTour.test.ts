/**
 * Render harness for the first-run wizard's frame.
 *
 * Step one is the screen the user meets before anything else, so what it must show (the time, the
 * progress, the promise that an alarm gets created) and what it must not offer (a way out) are
 * pinned here. The four steps themselves are stateful; this covers the first step in both modes.
 */
(async () => {
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { OnboardingTour } = await import('../src/components/OnboardingTour');
  const { createElement: h } = React;

  const results: [string, boolean, string][] = [];
  const check = (name: string, ok: boolean, info = '') => results.push([name, ok, info]);

  const render = (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(
      h(OnboardingTour, { onComplete: () => {}, onClose: () => {}, ...props })
    );

  const firstRun = render({ mandatory: true });
  const reRun = render({ mandatory: false });
  const defaultMode = render();

  // --- the first-run frame ---------------------------------------------------
  check('first run: step one of four', firstRun.includes('1/4'));
  check('first run: the time picker is the hero', firstRun.includes('Set your start time'));
  check('first run: hour, minute and period fields', firstRun.includes('07') && firstRun.includes('00') && firstRun.includes('AM'));
  check('first run: progress bar at 25%', firstRun.includes('width:25%'));
  check('first run: promises the alarm', firstRun.includes('your first alarm is created at the end of these four steps'));
  check('first run: next button', firstRun.includes('Next'));

  // --- what must be absent while the alarm does not exist yet ----------------
  check('first run: no close button', !firstRun.includes('btn-onboarding-close'));
  check('first run: no Close label at all', !firstRun.includes('aria-label="Close"'));
  check('first run: no undo on the first step', !firstRun.includes('btn-onboarding-back'));

  // --- a wizard re-opened from Settings behaves like the old tour ------------
  check('re-run: closable', reRun.includes('btn-onboarding-close'));
  check('re-run: does not claim it is the first alarm', !reRun.includes('your first alarm is created'));
  check('re-run: still sets an alarm', reRun.includes('Next'));

  // --- default props must not force anything --------------------------------
  check('default: closable', defaultMode.includes('btn-onboarding-close'));
  check('default: not mandatory', !defaultMode.includes('your first alarm is created'));

  // --- shared bits ----------------------------------------------------------
  check('both modes keep the four-step progress', firstRun.includes('1/4') && reRun.includes('1/4'));
  check('both modes render the period toggle', firstRun.includes('>AM<') && reRun.includes('>AM<'));

  // --- Report ---------------------------------------------------------------
  let pass = 0;
  for (const [name, ok, info] of results) {
    if (ok) pass++;
    console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${info ? `  (${info})` : ''}`);
  }
  console.log(`\n${pass}/${results.length} checks passed`);
  process.exit(pass === results.length ? 0 : 1);
})();
