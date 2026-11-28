'use client';
import {useRef,useState,type Dispatch,type SetStateAction} from 'react';
import './archive-list-action.css';

type Row={id:string;revision:number;title:string};
type Props={rows:Row[];archive:(row:Row,reason:string)=>Promise<void>;after:()=>Promise<unknown>|void;disabled?:boolean};
const count=(n:number)=>n.toLocaleString('fa-IR');

async function sendArchive(url:string,body:object){
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const result=await response.json() as {ok?:boolean;error?:string};
 if(!response.ok||result.ok!==true)throw Error(result.error||'بایگانی انجام نشد.');
}
export const archiveOperation=(row:Row,reason:string)=>sendArchive('/api/operations',{action:'delete',id:row.id,revision:row.revision,reason,confirmed:true});
export const archiveProject=(row:Row,reason:string)=>sendArchive('/api/laboratory-center',{action:'case_archive',id:row.id,revision:row.revision,reason,key:crypto.randomUUID()});

export default function ArchiveListAction({rows,archive,after,disabled=false,compact=false}:Props&{compact?:boolean}){
 const running=useRef(false);
 const [busy,setBusy]=useState(false);
 const [feedback,setFeedback]=useState('');
 async function run(){
  if(running.current||disabled||!rows.length)return;
  const reason=window.prompt('دلیل حذف از فهرست را وارد کنید. سوابق در بایگانی حفظ می‌شوند.')?.trim();
  if(reason===undefined)return;
  if(reason.length<5||reason.length>1000){setFeedback('دلیل باید بین ۵ تا ۱٬۰۰۰ نویسه باشد.');return;}
  if(!window.confirm(rows.length===1?'«'+rows[0].title+'» از فهرست حذف شود؟':count(rows.length)+' مورد انتخاب‌شده از فهرست حذف شوند؟'))return;
  running.current=true;setBusy(true);setFeedback('');
  const failures:string[]=[];
  let archived=0;
  try{
   for(const row of rows){
    try{await archive(row,reason);archived++;}
    catch(error){failures.push(row.title+' — '+(error instanceof Error?error.message:'بایگانی انجام نشد.'));}
   }
   if(archived){try{await after();}catch{failures.push('بازخوانی فهرست انجام نشد. صفحه را تازه کنید.');}}
   setFeedback([archived?count(archived)+' مورد بایگانی شد.':'',...failures].filter(Boolean).join(' | '));
  }finally{running.current=false;setBusy(false);}
 }
 return <div className={compact?'archive-list-inline':'archive-list-action'}>
  <button type="button" className="secondary archive-list-button" disabled={disabled||busy||!rows.length} onClick={()=>void run()}>
   {busy?'در حال بایگانی…':compact?'حذف از فهرست':'حذف موارد انتخاب‌شده'+(rows.length?' ('+count(rows.length)+')':'')}
  </button>
  {feedback&&<small role="status">{feedback}</small>}
 </div>;
}

export function ArchiveSelection({rows,picked,setPicked,after,...props}:Props&{picked:Record<string,number>;setPicked:Dispatch<SetStateAction<Record<string,number>>>}){
 if(!rows.length)return null;
 const selected=rows.filter(row=>Object.hasOwn(picked,row.id)).map(row=>({...row,revision:picked[row.id]}));
 return <div className="archive-list-toolbar">
  <label><input type="checkbox" disabled={props.disabled} checked={selected.length===rows.length}
   onChange={e=>setPicked(e.target.checked?Object.fromEntries(rows.map(row=>[row.id,row.revision])):{})}/>
   انتخاب همهٔ موارد این فهرست</label>
  <ArchiveListAction {...props} rows={selected} after={async()=>{setPicked({});await after();}}/>
 </div>;
}
