import { useEffect,useState } from 'react';
import { supabase } from '../lib/supabase';
import { initials } from '../lib/messaging';

export function ProfileImage({path,name,className='',bucket='tercis-profile-media'}:{path?:string|null;name:string;className?:string;bucket?:string}) {
 const [src,setSrc]=useState('');
 useEffect(()=>{
  let active=true;let url='';setSrc('');
  if(path && !path.includes('://'))void supabase.storage.from(bucket).download(path).then(({data,error})=>{
   if(active&&data&&!error){url=URL.createObjectURL(data);setSrc(url);}
  });
  return()=>{active=false;if(url)URL.revokeObjectURL(url);};
 },[path,bucket]);
 return <span className={`profile-image ${className}`}>{src?<img src={src} alt={name}/>:initials(name)}</span>;
}
