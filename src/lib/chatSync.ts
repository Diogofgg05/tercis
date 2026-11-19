type Message = {id:string;created_at:string;read_at?:string|null};

/** Query snapshots may arrive after a newer realtime receipt. Never lose that receipt. */
export function mergeMessages<T extends Message>(current:T[],incoming:T[]):T[]{
 const byId=new Map(current.map(message=>[message.id,message]));
 for(const message of incoming){
  const previous=byId.get(message.id);
  byId.set(message.id,{...previous,...message,read_at:previous?.read_at||message.read_at||null});
 }
 return [...byId.values()].sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
}

export function canApplyCallUpdate(current:{id:string;status:string;updated_at?:string}|null,next:{id:string;status:string;updated_at?:string}):boolean{
 if(!current||current.id!==next.id)return false;
 if(current.updated_at&&next.updated_at&&Date.parse(next.updated_at)<Date.parse(current.updated_at))return false;
 if(current.status==='accepted'&&next.status==='ringing')return false;
 if(['ended','declined'].includes(current.status)&&!['ended','declined'].includes(next.status))return false;
 return true;
}
