export const decimalTransformer = {
  to: (value?: number | null): number | null =>
    value === undefined || value === null ? null : value,
  from: (value?: string | null): number | null =>
    value === undefined || value === null ? null : Number.parseFloat(value),
};
