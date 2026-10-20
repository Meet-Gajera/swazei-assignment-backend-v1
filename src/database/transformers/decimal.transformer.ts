import { ValueTransformer } from 'typeorm';

/**
 * PostgreSQL returns `numeric`/`decimal` columns as strings to preserve
 * precision. This transformer converts them to JS numbers for the API layer
 * (and back to strings on write, which keeps the driver happy).
 */
export const decimalTransformer: ValueTransformer = {
  to: (value?: number | null): number | null =>
    value === null || value === undefined ? null : value,
  from: (value?: string | null): number | null =>
    value === null || value === undefined ? null : parseFloat(value),
};
