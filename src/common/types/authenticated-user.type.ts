import { UserRole } from '../enums';

/**
 * The principal attached to the request by the JWT strategy.
 *
 * `merchantId` and `storeId` are the *authorised scope* of the token. Every
 * repository query is filtered by these values, which is what enforces
 * multi-tenant isolation at the data layer (not just at the controller).
 */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  merchantId: string;
  storeId: string | null;
}
