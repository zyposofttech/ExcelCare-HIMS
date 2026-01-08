export function log(level, message, meta){console.log(JSON.stringify({level,message,...(meta||{}),ts:new Date().toISOString()}));}
