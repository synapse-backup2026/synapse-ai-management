import {db,json} from '../../../../../lib/staff-server';
import {publicSupportLimit,requirePublicSupport,supportUuid} from '../../../../../lib/public-support';
import {assert,storeTicketFile} from '../../../../../lib/ticket-support-upload';

export const dynamic='force-dynamic';

export async function POST(req:Request){
 try{
  requirePublicSupport(req);
  const code=req.headers.get('x-support-tracking-code')||'';
  assert(supportUuid.test(code),'کد پیگیری معتبر نیست',400);
  const ticket=await db().prepare("SELECT id,attachments,revision,created_at FROM ops_items WHERE id=? AND archived_at IS NULL AND CAST(json_extract(source_labels,'$.ticket_public') AS TEXT)='1'").bind(code).first<any>();
  assert(ticket,'درخواست پیدا نشد',404);
  assert(Date.parse(ticket.created_at)>Date.now()-30*60*1000,'مهلت بارگذاری پیوست این درخواست به پایان رسیده است.',403);
  await publicSupportLimit('files',code,15);
  return storeTicketFile(req,async id=>{
   assert(id===ticket.id,'درخواست پیدا نشد',404);
   return {ticket,actor:'support-website'};
  });
 }catch(error){
  const failure=error as {status?:number;message?:string};
  return json({error:failure.status?failure.message:'ذخیره پیوست انجام نشد.'},failure.status||500);
 }
}
