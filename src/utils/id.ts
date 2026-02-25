import { nanoid } from "nanoid";

export function generateId(): string {
  return `rklt_${nanoid(4)}`;
}
