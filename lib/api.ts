export const endpoint = "https://api.chaifen.app/";

export const get = async <T>(slug: string) => {
  const data = await fetch(endpoint + slug).then((res) => res.json());
  return data as T;
};

interface Err {
  err: string;
  message: string;
}

export const post = async <R, P>(slug: string, payload: P) => {
  const response = await fetch(endpoint + slug, {
    method: "POST",
    body: JSON.stringify(payload),
  }).then((res) => res.json());
  return response as R | Err;
};
