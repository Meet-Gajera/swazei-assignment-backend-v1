import { CreateTenancySchema1700000000001 } from './1700000000001-CreateTenancySchema';
import { CreateCatalogAndInventorySchema1700000000002 } from './1700000000002-CreateCatalogAndInventorySchema';
import { CreateSalesSchema1700000000003 } from './1700000000003-CreateSalesSchema';

export const MIGRATIONS = [
  CreateTenancySchema1700000000001,
  CreateCatalogAndInventorySchema1700000000002,
  CreateSalesSchema1700000000003,
];

export {
  CreateTenancySchema1700000000001,
  CreateCatalogAndInventorySchema1700000000002,
  CreateSalesSchema1700000000003,
};
