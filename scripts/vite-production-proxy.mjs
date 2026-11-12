export const PRODUCTION_ORIGIN = 'https://ducky-land.pages.dev';

function localOrigin(request) {
  try {
    const origin=new URL(request.headers.origin);
    return origin.protocol==='http:' && origin.host===request.headers.host &&
      ['localhost','127.0.0.1','[::1]'].includes(origin.hostname);
  } catch {return false;}
}

export function productionProxy(target=PRODUCTION_ORIGIN) {
  return {
    '/api': {
      target, changeOrigin:true, ws:true,
      configure(proxy) {
        const forwardOrigin=(outgoing,request)=>{
          if(localOrigin(request)) outgoing.setHeader('Origin',target);
        };
        proxy.on('proxyReq',forwardOrigin);
        proxy.on('proxyReqWs',forwardOrigin);
      },
    },
  };
}

export function productionSignIn() {
  return {name:'production-sign-in',apply:'serve',configureServer(server) {
    server.middlewares.use((request,response,next)=>{
      if(request.method==='GET' && request.url?.startsWith('/auth/github/')) {
        response.writeHead(302,{Location:PRODUCTION_ORIGIN+request.url});response.end();
      } else next();
    });
  }};
}
