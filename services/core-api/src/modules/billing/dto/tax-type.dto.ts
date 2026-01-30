export const TAX_TYPES = ["GST", "TDS", "OTHER"] as const;
export type TaxType = (typeof TAX_TYPES)[number];
