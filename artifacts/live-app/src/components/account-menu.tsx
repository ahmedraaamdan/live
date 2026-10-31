import { useEffect, useState } from 'react';
import { LifeBuoy, Moon, Sun, UserRound, Settings, LogOut } from 'lucide-react';
import { useLocation } from 'wouter';
import { useSession } from '@/lib/session';
import { getTheme, setTheme } from '@/lib/theme';
import { Avatar } from '@/ui/avatar';
import { IconButton } from '@/ui/button';
import { ActionMenu } from '@/ui/overlay';
export function ThemeToggle() {
 const [dark,setDark]=useState(()=>getTheme()==='dark'||(getTheme()==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches));
 useEffect(()=>{const sync=()=>setDark(document.documentElement.dataset.theme==='dark'||(getTheme()==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches)); window.addEventListener('gl:theme',sync);window.addEventListener('storage',sync);return()=>{window.removeEventListener('gl:theme',sync);window.removeEventListener('storage',sync);};},[]);
 return <IconButton label={dark?'تفعيل الوضع الفاتح':'تفعيل الوضع الداكن'} onClick={()=>{setTheme(dark?'light':'dark');setDark(!dark);window.dispatchEvent(new Event('gl:theme'));}}>{dark?<Sun/>:<Moon/>}</IconButton>;
}
export function AccountMenu() {
 const {me,signOut}=useSession(); const [,navigate]=useLocation();
 if(!me)return null;
 return <ActionMenu trigger={<button type="button" className="app-account-trigger" aria-label="قائمة حسابي" title={me.user.name}><Avatar name={me.user.name} src={me.user.avatarUrl} size="sm"/></button>} items={[{label:'حسابي',icon:<UserRound/>,onSelect:()=>navigate('/me')},{label:'الإعدادات',icon:<Settings/>,onSelect:()=>{navigate('/me?section=settings');window.dispatchEvent(new Event('gl:settings-open'));}},...(me.user.role==='admin'?[]:[{label:'الدعم',icon:<LifeBuoy/>,onSelect:()=>navigate('/support')}]),{label:'تسجيل الخروج',icon:<LogOut/>,danger:true,onSelect:()=>{void signOut().then(()=>navigate('/welcome',{replace:true}));}}]}/>;
}
