// Reference ClamAV gateway for a trusted isolated host/container.
// Requires a TLS reverse proxy, private networking and a strong shared secret.
// Binds 127.0.0.1 by default and does not expose clamd directly to the Internet.
// Compatible with ClamAV clamd INSTREAM (zINSTREAM\0).
import http from 'node:http';
import net from 'node:net';
import { timingSafeEqual } from 'node:crypto';

function requireEnv(key) {
  const value=process.env[key];
  if(!value)throw new Error(`Missing environment variable: ${key}`);
  return value;
}
const TOKEN=requireEnv('CLAMAV_GATEWAY_SECRET');
if(TOKEN.length<32)throw new Error('Gateway secret should have at least 32 characters');
const CLAMD_HOST=process.env.CLAMD_HOST || '127.0.0.1';
const CLAMD_PORT=Number(process.env.CLAMD_PORT || 3310);
const HOST=process.env.GATEWAY_BIND || '127.0.0.1';
const PORT=Number(process.env.GATEWAY_PORT || 8787);
const MAX=10*1024*1024;
const equal=(a,b)=>{
  const left=Buffer.from(a),right=Buffer.from(b);
  return left.length===right.length && timingSafeEqual(left,right);
};
function response(res,status,object) {
  res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});
  res.end(JSON.stringify(object));
}
function scanClamd(buffer) {
  return new Promise((resolve,reject)=>{
    const socket=net.createConnection({host:CLAMD_HOST,port:CLAMD_PORT});
    let output='';
    let finished=false;
    const finish=(error,value)=>{
      if(finished)return;
      finished=true; socket.destroy();
      error?reject(error):resolve(value);
    };
    socket.setTimeout(25000,()=>finish(new Error('ClamAV timeout')));
    socket.on('error',err=>finish(err));
    socket.on('data',chunk=>{
      output+=chunk.toString('utf8');
      if(output.length>2048)return finish(new Error('ClamAV response too large'));
      if(!output.includes('\0')&&!output.includes('\n'))return;
      const line=output.replaceAll('\0','').trim();
      if(line.endsWith(' OK'))finish(null,{status:'clean',engine:'clamav'});
      else if(line.endsWith(' FOUND'))finish(null,{
        status:'infected',engine:'clamav',signature:line.slice(0,255),
      });
      else finish(new Error('ClamAV did not return a recognized verdict'));
    });
    socket.on('connect',()=>{
      socket.write(Buffer.from('zINSTREAM\0','utf8'));
      for(let offset=0;offset<buffer.length;offset+=65536) {
        const chunk=buffer.subarray(offset,Math.min(buffer.length,offset+65536));
        const header=Buffer.alloc(4);
        header.writeUInt32BE(chunk.length,0);
        socket.write(header);socket.write(chunk);
      }
      socket.end(Buffer.alloc(4));
    });
    socket.on('close',()=>{if(!finished)finish(new Error('ClamAV connection closed before verdict'));});
  });
}
const server=http.createServer(async(req,res)=>{
  if(req.url!=='/scan'||req.method!=='POST')return response(res,404,{error:'Not found'});
  const provided=String(req.headers.authorization||'').replace(/^Bearer /,'');
  if(!provided||!equal(provided,TOKEN))return response(res,401,{error:'Unauthorized'});
  if(req.headers['content-type']!=='application/octet-stream')
    return response(res,415,{error:'Unsupported content type'});
  const claimedSize=Number(req.headers['content-length']);
  if(!Number.isFinite(claimedSize)||claimedSize<1||claimedSize>MAX)
    return response(res,413,{error:'Invalid attachment size'});
  const chunks=[];let read=0;
  for await (const part of req){
    read+=part.length;
    if(read>MAX){req.destroy();return;}
    chunks.push(part);
  }
  if(read!==claimedSize)return response(res,400,{error:'Incomplete upload'});
  try {
    const verdict=await scanClamd(Buffer.concat(chunks,read));
    return response(res,200,verdict);
  } catch(err) {
    return response(res,503,{error:'Scanner unavailable'});
  }
});
server.requestTimeout=35000;
server.headersTimeout=10000;
server.listen(PORT,HOST,()=>console.log(`ClamAV gateway listening on ${HOST}:${PORT}`));
