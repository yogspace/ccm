/**
 * The admin's graphics instead of Payload's own (payload.config.ts): the
 * site's cookie and its name on the login page, the cookie alone in the
 * navigation. Styles in custom.scss.
 */
export const Logo = () => (
  <div className="ccm-logo">
    <img alt="" className="ccm-logo__icon" src="/favicon.svg" />
    <span className="ccm-logo__name">Cookie Cutter Maker</span>
  </div>
);

export const Icon = () => (
  <img alt="Cookie Cutter Maker" className="ccm-icon" src="/favicon.svg" />
);
