import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { AuthService } from "../auth.service";
import { createHash } from "crypto";

@Injectable()
export class SessionActivityInterceptor implements NestInterceptor {
  constructor(private readonly authService: AuthService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    // Update session activity if token is present
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const tokenHash = createHash("sha256").update(token).digest("hex");
      // Update activity asynchronously (don't block the request)
      this.authService.updateSessionActivity(tokenHash).catch(() => {
        // Ignore errors - session might not exist or might be inactive
      });
    }

    return next.handle();
  }
}
