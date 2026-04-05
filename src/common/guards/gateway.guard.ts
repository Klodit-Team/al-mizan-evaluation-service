import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * Guard qui valide que la requête provient bien de l'API Gateway.
 * L'API Gateway valide la session Redis et injecte les headers utilisateur
 * avant de router vers ce microservice.
 */
@Injectable()
export class GatewayGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    const userId = request.headers['x-user-id'];
    const userRoles = request.headers['x-user-roles'];

    if (!userId) {
      throw new UnauthorizedException(
        'Requête non autorisée — header X-User-Id manquant (session invalide ou requête hors gateway)',
      );
    }

    // Attacher le contexte utilisateur à la requête pour usage dans les contrôleurs
    (request as any).user = {
      id: userId as string,
      roles: userRoles ? (userRoles as string).split(',') : [],
      sessionId: request.headers['x-session-id'] as string,
    };

    return true;
  }
}
