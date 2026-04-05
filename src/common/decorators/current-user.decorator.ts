import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface GatewayUser {
  id: string;
  roles: string[];
  sessionId: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): GatewayUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
