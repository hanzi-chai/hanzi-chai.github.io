export function loadString(value: any, defaultValue?: string): string {
  if (typeof value === "string") {
    return value;
  } else {
    return defaultValue || "";
  }
}

export function loadNumber(value: any, defaultValue?: number): number {
  if (typeof value === "number") {
    return value;
  } else {
    return defaultValue || 0;
  }
}

export function asBoolean(value: any): boolean {
  return value ? true : false;
}
