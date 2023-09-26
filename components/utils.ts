export const halfToFull = (s: string) => {
  let result = "";
  for (let i = 0; i != s.length; ++i) {
    const code = s.charCodeAt(i);
    if (code <= 128) {
      result += String.fromCharCode(code + 65248);
    } else {
      result += s[i];
    }
  }
  return result;
};

export const fullToHalf = (s: string) => {
  let result = "";
  for (let i = 0; i != s.length; ++i) {
    const code = s.charCodeAt(i);
    if (65248 <= code && code <= 65248 + 128) {
      result += String.fromCharCode(code - 65248);
    } else {
      result += s[i];
    }
  }
  return result;
};
