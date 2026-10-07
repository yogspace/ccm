/**
 * Only someone logged in to the admin. A plain boolean, so it also serves
 * where Payload takes no query (`access.admin`).
 */
export const authenticated = ({ req: { user } }: { req: { user?: unknown } }) =>
  Boolean(user);
