export const useHashRouter = import.meta.env.MODE !== "CF";

export function getCurrentId(): string {
  const pathSegments = useHashRouter
    ? location.hash.split("/")
    : location.pathname.split("/");
  return pathSegments[1] ?? "";
}

export const basePath = useHashRouter ? "/#/" : "/";
