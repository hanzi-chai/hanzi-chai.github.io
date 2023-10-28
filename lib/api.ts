export const endpoint = "https://api.chaifen.app/";

export interface Err {
  err: string;
  message: string;
}

const getHeader = () => {
  const token = localStorage.getItem(".token");
  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : undefined;
};

const template =
  (method: string) =>
  async <R, P>(slug: string, payload?: P) => {
    const response = await fetch(endpoint + slug, {
      method: method,
      headers: getHeader(),
      body: payload && JSON.stringify(payload),
    }).then((res) => res.json());
    return response as R | Err;
  };

export const get = template("GET");

export const post = template("POST");

export const put = template("PUT");

export const delet = template("DELETE");
