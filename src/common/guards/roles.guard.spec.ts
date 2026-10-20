import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserRole } from '../enums';
import { AuthenticatedUser } from '../types/authenticated-user.type';

function buildContext(user: Partial<AuthenticatedUser>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const guard = new RolesGuard(reflector);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows the request when no roles are required', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    expect(guard.canActivate(buildContext({}))).toBe(true);
  });

  it('allows a MERCHANT_ADMIN regardless of the required role', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserRole.CASHIER,
    ]);
    expect(
      guard.canActivate(buildContext({ role: UserRole.MERCHANT_ADMIN })),
    ).toBe(true);
  });

  it('allows a user that holds the required role', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserRole.CASHIER,
      UserRole.STORE_MANAGER,
    ]);
    expect(
      guard.canActivate(buildContext({ role: UserRole.STORE_MANAGER })),
    ).toBe(true);
  });

  it('rejects a user without the required role', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserRole.MERCHANT_ADMIN,
    ]);
    expect(() =>
      guard.canActivate(buildContext({ role: UserRole.CASHIER })),
    ).toThrow(ForbiddenException);
  });

  it('rejects an unauthenticated request', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserRole.CASHIER,
    ]);
    expect(() => guard.canActivate(buildContext({}))).toThrow(
      ForbiddenException,
    );
  });
});
