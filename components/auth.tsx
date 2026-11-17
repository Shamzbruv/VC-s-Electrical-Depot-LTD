'use client';

import {useEffect,useState} from 'react';
import {api,ArrowRight} from './ui';

type Mode='auth'|'reset'|'activate'|'new_password';
export function getSession(){try{return JSON.parse(sessionStorage.getItem('vc-session')||'null');}catch{return null;}}
export function authFragment(){return new URLSearchParams(window.location.hash.slice(1));}

export default function Auth({onLogin}:{onLogin:()=>void}) {
  const [mode,setMode]=useState<Mode>('auth');
  const [message,setMessage]=useState('');
  const [failed,setFailed]=useState(false);
  const [busy,setBusy]=useState(false);
  const [setup,setSetup]=useState<{token_hash:string;type:string}>();
  useEffect(()=>{
    const fragment=authFragment();
    const token=fragment.get('access_token');
    const type=fragment.get('type');
    const hash=fragment.get('token_hash');
    if(hash&&['invite','recovery','magiclink','email'].includes(type||'')){
      setSetup({token_hash:hash,type:type!});setMode('new_password');
    }
    if(token){
      sessionStorage.setItem('vc-session',JSON.stringify({access_token:token,refresh_token:fragment.get('refresh_token'),expires_at:Number(fragment.get('expires_at'))||undefined}));
      if(type==='recovery'||type==='invite')setMode('new_password');
      else onLogin();
    }
    if(fragment.has('error_description')){
      setMessage(fragment.get('error_description')||'Request a new sign-in link.');setFailed(true);
    }
    if(token||fragment.has('error'))history.replaceState(null,'',location.pathname+location.search);
  },[onLogin]);
  const titles={auth:'Welcome back.',reset:'Reset your password.',activate:'Activate your staff account.',new_password:'Choose a new password.'};
  const buttons={auth:'Sign in',reset:'Request reset link',activate:'Send activation link',new_password:'Save password'};
  function changeMode(next:Mode){setMode(next);setMessage('');setFailed(false);}
  return <form className="form-card auth-card" onSubmit={async e=>{
    e.preventDefault();setBusy(true);setMessage('');setFailed(false);
    const form=Object.fromEntries(new FormData(e.currentTarget));
    try{
      if(mode==='new_password'&&setup){
        const session=await api('staff_verify',setup);
        sessionStorage.setItem('vc-session',JSON.stringify(session));
        setSetup(undefined);
        history.replaceState(null,'',location.pathname+location.search);
      }
      const result=await api(mode==='new_password'?'update_password':mode,form,mode==='new_password'?getSession()?.access_token:undefined);
      if(mode==='auth'){sessionStorage.setItem('vc-session',JSON.stringify(result));onLogin();}
      if(mode==='new_password'){sessionStorage.removeItem('vc-session');setMode('auth');setMessage('Password updated. Sign in with your new password.');}
      if(mode==='reset')setMessage('If your account exists, check your email for the reset link.');
      if(mode==='activate')setMessage('If your email is approved, check your inbox for the activation link.');
    }catch(error){setFailed(true);setMessage(error instanceof Error?error.message:'Sign-in failed.');}
    finally{setBusy(false);}
  }}>
    <span className="eyebrow">VC’S ELECTRICAL · STAFF</span><h1>{titles[mode]}</h1>
    <p>{mode==='activate'?'Use the email address approved by the owner.':'Access the staff workspaces assigned to you.'}</p>
    {mode!=='new_password'&&<label className="field">Email address<input name="email" type="email" required autoComplete="email"/></label>}
    {mode!=='reset'&&<label className="field">Password<input key={mode} name="password" type="password" required minLength={mode==='auth'?1:10} autoComplete={mode==='auth'?'current-password':'new-password'}/></label>}
    <button className="button blue" disabled={busy}>{busy?'Please wait…':buttons[mode]} <ArrowRight size={18}/></button>
    {message&&<p className="notice" role={failed?'alert':'status'}>{message}</p>}
    <div className="auth-links">{mode==='auth'?<><button type="button" onClick={()=>changeMode('reset')}>Forgot password?</button><button type="button" onClick={()=>changeMode('activate')}>Activate account</button></>:<button type="button" onClick={()=>changeMode('auth')}>Back to sign in</button>}</div>
  </form>;
}
