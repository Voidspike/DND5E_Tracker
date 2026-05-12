export function canEditToken(token: any, userId: string | undefined, isDM: boolean): boolean {
  return isDM || (!!userId && token?.ownerId === userId);
}
