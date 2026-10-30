// Shared heading scale (design p7). One place for H1/H2/H3 so the home hero, block titles and /card stay in step.
// H1 56/40, H2 block titles 40/28, H3 24/20; all weight 530. Body copy stays 16px.
export const H1 = "font-sans text-[40px] font-[530] leading-none tracking-[-0.02em] text-black md:text-[56px]";
export const H2 = "font-sans text-[28px] font-[530] leading-[1.1] tracking-[-0.02em] text-black md:text-[40px]";
export const H3 = "font-sans text-xl font-[530] md:text-2xl";
// Inline-link hit area: a 44px-tall pseudo element without changing layout.
export const HIT = "relative after:absolute after:-inset-x-3 after:-inset-y-4 after:content-['']";
