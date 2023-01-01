interface Env {
  CHAI: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { searchParams } = new URL(context.request.url);
  const key = searchParams.get('char');
  if (key) {
    const value = key && await context.env.CHAI.get(key);
    console.log(value);
    return new Response(value);
  } else {
    const list = await context.env.CHAI.list();
    const keys = list.keys.map(({ name }) => name);
    return new Response(JSON.stringify(keys));
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { key, value } = await context.request.json() as Record<string, any>;
  await context.env.CHAI.put(key, value);
  return new Response(JSON.stringify({ success: true }));
}
