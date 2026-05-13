import type { Token } from '@dnd/shared';

export function canEditToken(token: Pick<Token, 'ownerId'> | null | undefined, userId: string | undefined, isDM: boolean): boolean {
  return isDM || (!!userId && token?.ownerId === userId);
}
