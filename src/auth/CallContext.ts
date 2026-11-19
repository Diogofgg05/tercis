import { createContext,useContext } from 'react';
import type { ChatContact } from '../lib/messaging';

type CallsContextValue={start:(peer:ChatContact,kind:'audio'|'video')=>Promise<void>;busy:boolean;available:boolean};
export const CallsContext=createContext<CallsContextValue>({start:async()=>{},busy:false,available:false});
export const useCalls=()=>useContext(CallsContext);
