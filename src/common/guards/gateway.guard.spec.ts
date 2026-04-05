import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { GatewayGuard } from './gateway.guard';

describe('GatewayGuard', () => {
  let guard: GatewayGuard;

  beforeEach(() => {
    guard = new GatewayGuard();
  });

  const createMockContext = (
    headers: Record<string, string>,
  ): ExecutionContext => {
    const mockRequest = {
      headers,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;
  };

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should return true when X-User-Id header is present', () => {
      const context = createMockContext({
        'x-user-id': 'user-123',
        'x-user-roles': 'ADMIN,USER',
        'x-session-id': 'session-abc',
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should attach user context to request', () => {
      const headers = {
        'x-user-id': 'user-123',
        'x-user-roles': 'ADMIN,USER',
        'x-session-id': 'session-abc',
      };
      const context = createMockContext(headers);

      guard.canActivate(context);

      const request = context.switchToHttp().getRequest();
      expect((request as any).user).toEqual({
        id: 'user-123',
        roles: ['ADMIN', 'USER'],
        sessionId: 'session-abc',
      });
    });

    it('should handle empty roles', () => {
      const context = createMockContext({
        'x-user-id': 'user-123',
      });

      guard.canActivate(context);

      const request = context.switchToHttp().getRequest();
      expect((request as any).user.roles).toEqual([]);
    });

    it('should throw UnauthorizedException when X-User-Id is missing', () => {
      const context = createMockContext({
        'x-user-roles': 'ADMIN',
      });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException with correct message', () => {
      const context = createMockContext({});

      expect(() => guard.canActivate(context)).toThrow(
        'Requête non autorisée — header X-User-Id manquant (session invalide ou requête hors gateway)',
      );
    });
  });
});
