// Page titles, shared by each route's metadata and its RouteTitle so the two can't drift apart.

export const SITE_TITLE = "ProofLoop — is your skincare working? Run a fair test.";

/** The layout's title template ("%s · ProofLoop") applied by hand, for setting document.title on the client. */
export const titled = (page: string) => `${page} · ProofLoop`;
