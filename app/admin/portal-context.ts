'use client';

import {createContext,useContext} from 'react';
import {ops} from '../../lib/ops-client';

export const PortalContext=createContext({request:ops,preview:false});
export const useOps=()=>useContext(PortalContext);
