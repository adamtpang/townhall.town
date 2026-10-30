// Design 10:14 AM CT Oct 30: the accountability ("Record") line sits behind ONE flag so it can be switched off in one
// change. Adam asked for it, so it is ON unless NEXT_PUBLIC_SHOW_ACCOUNTABILITY is "0" or "false" at build time.
// To switch off without env access: change DEFAULT_SHOW_ACCOUNTABILITY to false (one line) and redeploy a preview.
const DEFAULT_SHOW_ACCOUNTABILITY = true;
const raw = process.env.NEXT_PUBLIC_SHOW_ACCOUNTABILITY;
export const SHOW_ACCOUNTABILITY = raw === "0" || raw === "false" ? false : raw === "1" || raw === "true" ? true : DEFAULT_SHOW_ACCOUNTABILITY;

// PR #32 (party + FEC money under each candidate) is OFF unless NEXT_PUBLIC_SHOW_FINANCE is "1" at build time.
// Civic is holding the finance data until their FEC sweep (~2:15 PM CT Oct 30) and QA found P1s in it.
export const SHOW_FINANCE = process.env.NEXT_PUBLIC_SHOW_FINANCE === "1";
