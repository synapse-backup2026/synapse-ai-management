'use client';
import {useId,useState} from 'react';
import {Paperclip,X} from 'lucide-react';
import type {WizardStepProps} from '../../types/support-wizard';
import {maxSupportDescriptionWords,supportDescriptionWordCount} from '../../lib/support-description';
import {validateFiles} from '../../lib/validations/support-wizard-validation';
export function Step3Details({data,updateData,isInternalStaff,live=false}:WizardStepProps & {live?:boolean}){
 const [fileError,setFileError]=useState('');
 const descriptionHintId=useId();
 const wordCount=supportDescriptionWordCount(data.description);
 const overWordLimit=wordCount>maxSupportDescriptionWords;
 return <section><h2>تکمیل اطلاعات درخواست</h2><div className="sw-fields">
 <label>نام و نام خانوادگی *<input autoComplete="name" required maxLength={160} value={data.name} onChange={e=>updateData({name:e.target.value})}/></label>
 <label>شماره موبایل *<input dir="ltr" type="tel" autoComplete="tel" required maxLength={30} value={data.mobile} onChange={e=>updateData({mobile:e.target.value})}/></label>
 <label>ایمیل *<input dir="ltr" type="email" autoComplete="email" required maxLength={200} value={data.email} onChange={e=>updateData({email:e.target.value})}/></label>
 <label>دانشگاه / شرکت / سازمان (اختیاری)<input maxLength={240} value={data.organization} onChange={e=>updateData({organization:e.target.value})}/></label>
 <label>شماره فاکتور یا سفارش (اختیاری)<input maxLength={160} value={data.orderNumber} onChange={e=>updateData({orderNumber:e.target.value})}/></label>
 {isInternalStaff&&<label>موعد پیگیری (داخلی)<input type="date" value={data.followUpDate} onChange={e=>updateData({followUpDate:e.target.value})}/></label>}
 </div><div className="sw-files"><label className="sw-file-picker"><Paperclip size={18}/> انتخاب پیوست (اختیاری)<input type="file" multiple accept={live?'.pdf,.docx,.png,.jpg,.jpeg':'.pdf,.doc,.docx,.png,.jpg,.jpeg'} onChange={e=>{const combined=[...data.files,...Array.from(e.target.files||[])];const error=live&&combined.some(file=>/\.doc$/i.test(file.name))?'فایل Word را به صورت DOCX وارد کنید.':validateFiles(combined);setFileError(error);if(!error)updateData({files:combined});e.target.value=''}}/></label><p>PDF، JPEG، PNG و Word ({live?'DOCX':'DOCX یا DOC'}) · حداکثر ۵ فایل، هر فایل تا ۸ مگابایت. {live?'فایل‌ها پس از ثبت تیکت برای بررسی امنیتی ذخیره می‌شوند.':'فایل‌ها فعلاً فقط روی دستگاه انتخاب می‌شوند.'}</p>{fileError&&<p role="alert" className="sw-error">{fileError}</p>}<ul>{data.files.map((file,i)=><li key={i}><span>{file.name} ({(file.size/1048576).toFixed(2)} MB)</span><button type="button" aria-label={'حذف '+file.name} onClick={()=>{updateData({files:data.files.filter((_,j)=>j!==i)});setFileError('')}}><X size={16}/></button></li>)}</ul></div>
 <div className="sw-fields sw-request-details">
 <label className="sw-wide sw-description">
  شرح درخواست *
  <textarea required placeholder="درخواست خود را اینجا بنویسید…" rows={8} maxLength={16000} aria-describedby={descriptionHintId} aria-invalid={overWordLimit||undefined} value={data.description} onChange={e=>updateData({description:e.target.value})}/>
  <small id={descriptionHintId} className="sw-description-count" data-over-limit={overWordLimit}>
   {wordCount.toLocaleString('fa-IR')} کلمه · حداکثر {maxSupportDescriptionWords.toLocaleString('fa-IR')} کلمه
  </small>
 </label>
 </div></section>
}
