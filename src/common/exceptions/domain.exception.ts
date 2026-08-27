import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Business rule violation with a stable machine readable code so clients can
 * localize the message instead of parsing English text.
 */
export class DomainException extends HttpException {
  constructor(
    readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    readonly details?: Record<string, unknown>,
  ) {
    super({ code, message, details }, status);
  }
}

export class EntityNotFoundException extends DomainException {
  constructor(entity: string, identifier: string) {
    super(
      `${entity.toUpperCase()}_NOT_FOUND`,
      `${entity} ${identifier} was not found`,
      HttpStatus.NOT_FOUND,
      { entity, identifier },
    );
  }
}

export class ForbiddenActionException extends DomainException {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, HttpStatus.FORBIDDEN, details);
  }
}

export class ConflictActionException extends DomainException {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, HttpStatus.CONFLICT, details);
  }
}
