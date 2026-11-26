import { en, type Messages } from './en';

/** Every dotted path into Messages, e.g. 'nav.home' or 'pages.home.title'. */
type Leaves<T, Prefix extends string = ''> = T extends string
  ? Prefix
  : {
      [K in keyof T & string]: Leaves<T[K], Prefix extends '' ? K : `${Prefix}.${K}`>;
    }[keyof T & string];

export type MessageKey = Leaves<Messages>;

/** The active message catalogue. Switch here when hi.ts exists. */
export const messages: Messages = en;

/** Looks up a dotted key, e.g. t('nav.home'). Keys are checked at compile time. */
export function t(key: MessageKey): string {
  let node: unknown = messages;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null || !(part in node)) {
      throw new Error(`Missing i18n key: ${key}`);
    }
    node = (node as Record<string, unknown>)[part];
  }
  if (typeof node !== 'string') {
    throw new Error(`i18n key is not a string: ${key}`);
  }
  return node;
}
