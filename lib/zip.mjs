/** Exact 5-digit ZIP only, no trimming (QA P1/P2): 787011, "78701'<script>", 00000, "" and abc are all rejected. Shared by client and server. */
export const validZip = (raw) => { const z = String(raw ?? ""); return /^\d{5}$/.test(z) && z !== "00000" ? z : null; };
