import {receiptRange,callDayExpression,tehranDay} from './operations-date-filter';
import {filterCategorySQL,filterGroupSQL,filterRoleSQL,filterTopicSQL} from './operations-filter-classification';
import {canManualAssignOperations} from './operations-manual-assignment';
import {ticketNoteVisible,ticketCommunicationVisible,redactRequest,mayReadRequestSource} from './dispatch-policy';
import {dispatchReady} from './dispatch-engine';
import {organizationReady} from './org-access';
import {channelSQL} from './communication-policy';
import {db} from './staff-server';
import {operationCategories,privateSubtypes,canSeeOps,operationsScope,canUseOpsCategory,requestedAccessScope} from './ops-policy';
import {opsRow} from './ops-server';
import {operationPayments} from './finance-data';
import {hasDataAccess} from './auth-policy';
import {intakeMembers} from './intake-server';
import {ticketSQL,isTicket} from './intake-policy';
import {siteTicketCategories,directTicketCategories,getTicketCategories} from './ticket-support-taxonomy';
import {legacyCategoryForSite} from './operations-intake-ui';
import {intakeCategory,unifiedIntakeCategories,intakeResponsibleRoles,seniorResearchMayReview} from './unified-intake-taxonomy';
export async function readOperationsData(u:any,p:URLSearchParams){
 const routingReady=await dispatchReady();const {sql:permitted,args:scopeArgs}=operationsScope(u,routingReady);
 // Legacy Hostinger databases may not yet have routing columns. Optional counters must never break page reads.
 const unassignedSQL=routingReady?"(trim(assignee)='' OR json_extract(routing,'$.acceptanceNeedsAssignment')=1)":"trim(assignee)=''";
 const assignmentStateSQL=routingReady?"request_state='awaiting_assignment'":"trim(assignee)=''";
 const view=p.get('view')||'',contact=(p.get('contact')||'').trim().slice(0,200);
 let where=permitted;const args:any[]=[...scopeArgs];
 if(view==='history'&&contact){where+=' AND (lower(email)=? OR phone=?)';args.push(contact.toLowerCase(),contact)}else{where+=' AND direction=?';args.push(p.get('direction')||'inbound')}
 if(view==='tickets'){
  where+=' AND '+ticketSQL;
  const source=(p.get('ticketSource')||'').trim().slice(0,20);
  const ticketCategory=(p.get('ticketCategory')||'').trim().slice(0,80);
  const ticketTopic=(p.get('ticketTopic')||'').trim().slice(0,160);
  if(source==='legacy'){where+=" AND (source_type='gmail' OR channel IN ('gmail','whatsapp','telegram','bale','rubika','instagram','linkedin'))"}
  else if(source==='site'||source==='direct'){
   where+=" AND json_extract(source_labels,'$.ticket_source')=?";
   args.push(source);
   if(source==='site')where+=" AND COALESCE(json_extract(source_labels,'$.website_form'),'') NOT IN ('research_order','quick_request','collaboration','contact')";
  }
  else if(source==='gmail'){where+=" AND (source_type='gmail' OR channel='gmail')"}
  else if(['research_order','quick_request','collaboration','contact'].includes(source)){
   // Explicit verified form metadata only; unknown historical forms stay in all sources.
   where+=" AND channel='website' AND json_extract(source_labels,'$.website_form')=?";args.push(source)
  }
  else if(source){where+=' AND 1=0'}
  if(ticketCategory){
   const cat=(source==='direct'?getTicketCategories('direct'):siteTicketCategories).find(c=>c.id===ticketCategory);
   const legacyGroups:Record<string,string>={orders:'customers',invoices:'billing',payments:'billing',results:'results',projects:'projects',internal:'internal',system:'system'};
   if(intakeCategory(ticketCategory)){where+=" AND json_extract(source_labels,'$.ticket_category')=?";args.push(ticketCategory)}
   else if(!cat){where+=' AND 1=0'}
   else if(source==='site'||source==='direct'){where+=" AND json_extract(source_labels,'$.ticket_category')=?";args.push(ticketCategory)}
   else{
    where+=" AND (json_extract(source_labels,'$.ticket_category')=?"+(legacyGroups[ticketCategory]?" OR (COALESCE(json_extract(source_labels,'$.ticket_v'),0)=0 AND category=?)":"")+")";
    args.push(ticketCategory);if(legacyGroups[ticketCategory])args.push(legacyGroups[ticketCategory]);
   }
  }
  if(ticketTopic){
   const cat=(source==='direct'?getTicketCategories('direct'):siteTicketCategories).find(c=>c.id===ticketCategory);
   if(intakeCategory(ticketCategory)){
    if(!intakeCategory(ticketCategory)!.topics.some(t=>t.title===ticketTopic))where+=' AND 1=0';
    else{where+=" AND json_extract(source_labels,'$.ticket_topic')=?";args.push(ticketTopic)}
   }else if(!cat||!cat.topics.some(topic=>topic===ticketTopic)){where+=' AND 1=0'}
   else{
    // Never guess a precise topic for a legacy message: only exact historic subtype matches.
    where+=" AND (json_extract(source_labels,'$.ticket_topic')=?"+(!source||source==='legacy'?" OR (COALESCE(json_extract(source_labels,'$.ticket_v'),0)=0 AND subtype=?)":"")+")";
    args.push(ticketTopic);if(!source||source==='legacy')args.push(ticketTopic);
   }
  }
}
 const unifiedGroup=(p.get('unifiedGroup')||'').slice(0,30),unifiedCategory=(p.get('unifiedCategory')||'').slice(0,80),unifiedTopic=(p.get('unifiedTopic')||'').slice(0,160);
 const unifiedRole=(p.get('unifiedRole')||'').slice(0,80);
 const roleFacetSeed=where,roleFacetSeedArgs=[...args];
 if(unifiedRole){if(view==='tickets'&&unifiedRole==='director'){/* Management view is the existing authorized scope, not a new permission. */}else if(view==='tickets'&&unifiedRole==='senior_research'){const ids=unifiedIntakeCategories.filter(c=>seniorResearchMayReview(c.id)).map(c=>c.id);where+=' AND '+filterCategorySQL+' IN ('+ids.map(()=>'?').join(',')+')';args.push(...ids)}else if(unifiedRole==='unclassified')where+=' AND '+filterRoleSQL+' IS NULL';else if(intakeResponsibleRoles.some(r=>r.id===unifiedRole)){where+=' AND '+filterRoleSQL+'=?';args.push(unifiedRole)}else where+=' AND 1=0'}
 const roleFacetPrefix=where,roleFacetPrefixArgs=[...args];

 if(view!=='tickets'&&p.get('opsGroup')){
  const group=String(p.get('opsGroup')||'').slice(0,90);
  const [kind,id]=group.split(':');
  const directLegacy:Record<string,string>={collaboration:'internal',proposal:'projects',organization:'internal',general:'system'};
  const canonical=kind==='site'?legacyCategoryForSite[id]:kind==='direct'?directLegacy[id]:undefined;
  const match=kind==='site'?siteTicketCategories.find(c=>c.id===id):kind==='direct'?directTicketCategories.find(c=>c.id===id):undefined;
  if(!canonical||!match){where+=' AND 1=0'}
  else{where+=' AND category=?';args.push(canonical);
   const topic=(p.get('opsTopic')||'').slice(0,160);
   if(topic){if(!match.topics.some(t=>t===topic))where+=' AND 1=0';else{where+=" AND (source_body LIKE ? ESCAPE '\\' OR subtype=?)";const literal=topic.replace(/[\\%_]/g,'\\$&');args.push('%'+String.fromCharCode(10)+'موضوع درخواست: '+literal+String.fromCharCode(10)+'%',topic)}}
  }
 }
 if(p.get('channel')){where+=' AND '+channelSQL+'=?';args.push(p.get('channel'))}
 for(const [key,column] of [['category','category'],['subtype','subtype'],['status','status'],['source','source_type'],['requestType','request_type'],['assignee','assignee'],['intakeState',"COALESCE(NULLIF(intake_state,''),'unreviewed')"]]){const value=p.get(key);if(value&&!(view==='tickets'&&key==='status')){where+=key==='status'&&value==='awaiting_assignment'?" AND "+assignmentStateSQL:' AND '+column+'=?';if(!(key==='status'&&value==='awaiting_assignment'))args.push(value)}}
 const query=(p.get('q')||'').trim().slice(0,200);if(query){where+=" AND (title LIKE ? ESCAPE '\\' OR client_name LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR reference LIKE ? ESCAPE '\\' OR organization LIKE ? ESCAPE '\\' OR representative LIKE ? ESCAPE '\\' OR source_body LIKE ? ESCAPE '\\')";const escaped='%'+query.replace(/[\\%_]/g,'\\$&')+'%';args.push(...Array(8).fill(escaped))}
 // A date-only telephone record uses its original local call day, not import time.
 const phoneSQL="(source_type='incoming' OR channel='phone')";
 const dates=(await db().prepare("SELECT DISTINCT call_date FROM ops_items WHERE ("+permitted+") AND "+phoneSQL+" AND COALESCE(call_date,'')<>''").bind(...scopeArgs).all()).results as any[];
 const originalDay=callDayExpression(dates.map(r=>r.call_date));
 const originalStamp=callDayExpression(dates.map(r=>r.call_date),true);
 const callDaySQL="("+phoneSQL+" AND "+originalDay+" IS NOT NULL)";
 const receivedSQL="COALESCE(NULLIF(source_at,''),created_at)";
 const range=receiptRange(p);let dateWhere='';const dateArgs:any[]=[];
 if(range?.invalid)dateWhere=' AND 1=0';
 else if(range){dateWhere=" AND (("+callDaySQL+" AND "+originalDay+">=? AND "+originalDay+"<=?) OR (NOT "+callDaySQL+" AND ((length("+receivedSQL+")=10 AND "+receivedSQL+">=? AND "+receivedSQL+"<=?) OR (length("+receivedSQL+")>10 AND "+receivedSQL+">=? AND "+receivedSQL+"<?))))";dateArgs.push(range.from,range.to,range.from,range.to,range.start,range.end)}
 where+=dateWhere;args.push(...dateArgs);
 const orderSQL="CASE WHEN "+callDaySQL+" THEN "+originalStamp+" ELSE "+receivedSQL+" END";
 const orderDirection=p.get('sortOrder')==='asc'?' ASC':' DESC';
 const ticketBaseWhere=where,ticketBaseArgs=[...args];
 if(view==='tickets'&&p.get('status')){if(p.get('status')==='awaiting_assignment')where+=" AND "+assignmentStateSQL;else{where+=' AND status=?';args.push(p.get('status'))}}
 const baseWhere=where,baseArgs=[...args];
 const today=tehranDay();
 const followup=p.get('followup');if(followup==='today'){where+=" AND status!='closed' AND due=?";args.push(today)}else if(followup==='overdue'){where+=" AND status!='closed' AND due!='' AND due<?";args.push(today)}else if(followup==='unassigned'){where+=" AND status!='closed' AND "+unassignedSQL}else if(followup==='unanswered'){where+=" AND status!='closed' AND trim(resolution)=''"}else if(followup==='calls_pending'){where+=" AND status!='closed' AND "+channelSQL+"='phone' AND trim(resolution)=''"}
 // Category facets share the exact authorized result predicate, excluding only their own selection.
 if(unifiedGroup){if(['services','consultation'].includes(unifiedGroup)){where+=' AND '+filterGroupSQL+'=?';args.push(unifiedGroup)}else where+=' AND 1=0'}
 const facetWhere=where,facetArgs=[...args];
 if(unifiedCategory){if(unifiedCategory==='unclassified')where+=' AND '+filterCategorySQL+' IS NULL';else if(intakeCategory(unifiedCategory)){where+=' AND '+filterCategorySQL+'=?';args.push(unifiedCategory)}else where+=' AND 1=0'}
 if(unifiedTopic){if(intakeCategory(unifiedCategory)?.topics.some(t=>t.title===unifiedTopic)){where+=' AND '+filterTopicSQL+'=?';args.push(unifiedTopic)}else where+=' AND 1=0'}
 const offset=Math.max(0,Number(p.get('offset'))||0);
 const initialPageSize=view==='tickets'?(p.get('pageSize')==='10'?10:p.get('pageSize')==='5'?5:100):50;
 const columns=(routingReady?'routing,request_state,':'')+(await organizationReady()?'access_scope,':'')+'request_type,client_kind,organization,representative,intake_state,intake_notes,is_ticket,ticket_kind,direction,channel,visit_purpose,id,source_key,category,subtype,title,substr(source_body,1,200) AS source_body,client_name,phone,email,reference,call_date,source_type,source_url,source_at,source_labels,attachments,assignee,due,status,priority,resolution,payment_state,manager_only,created_by,created_at,updated_at,revision';
 const statements=[db().prepare('SELECT '+columns+(view==='tickets'?','+filterRoleSQL+' AS display_role':'')+' FROM ops_items WHERE '+where+' ORDER BY '+orderSQL+orderDirection+', id'+orderDirection+' LIMIT '+initialPageSize+' OFFSET ?').bind(...args,offset),db().prepare('SELECT COUNT(*) AS total FROM ops_items WHERE '+where).bind(...args),db().prepare('SELECT category,COUNT(*) AS total FROM ops_items WHERE '+permitted+dateWhere+' GROUP BY category').bind(...scopeArgs,...dateArgs),db().prepare("SELECT COUNT(*) AS all_count,SUM(CASE WHEN status!='closed' AND due=? THEN 1 ELSE 0 END) AS today,SUM(CASE WHEN status!='closed' AND due!='' AND due<? THEN 1 ELSE 0 END) AS overdue,SUM(CASE WHEN status!='closed' AND "+unassignedSQL+" THEN 1 ELSE 0 END) AS unassigned,SUM(CASE WHEN status!='closed' AND trim(resolution)='' THEN 1 ELSE 0 END) AS unanswered,SUM(CASE WHEN status!='closed' AND "+channelSQL+"='phone' AND trim(resolution)='' THEN 1 ELSE 0 END) AS calls_pending FROM ops_items WHERE "+baseWhere).bind(today,today,...baseArgs),db().prepare('SELECT source,created,updated,finished_at FROM ops_sync_runs WHERE ?=1 ORDER BY finished_at DESC LIMIT 4').bind(u.manager?1:0)];
 if(view==='tickets')statements.push(db().prepare("SELECT COUNT(*) AS all_count,SUM(CASE WHEN status!='closed' AND due=? THEN 1 ELSE 0 END) AS today_count,SUM(CASE WHEN status='open' THEN 1 ELSE 0 END) AS new_count,SUM(CASE WHEN status='waiting' THEN 1 ELSE 0 END) AS waiting_count,SUM(CASE WHEN status!='closed' AND due!='' AND due<? THEN 1 ELSE 0 END) AS overdue_count,SUM(CASE WHEN status!='closed' AND "+unassignedSQL+" THEN 1 ELSE 0 END) AS unassigned_count FROM ops_items WHERE "+ticketBaseWhere).bind(today,today,...ticketBaseArgs));
 const selected=p.get('id');if(selected)statements.push(db().prepare('SELECT * FROM ops_items WHERE id=? AND '+permitted).bind(selected,...scopeArgs));
 // Rows and count are essential; stats/sync summaries are optional and isolated from the primary read.
 const essential=await db().batch(statements.slice(0,2));
 const optional=await Promise.all(statements.slice(2).map(async (statement,index)=>{
  try{return await db().batch([statement]).then(rows=>rows[0])}
  catch(e:any){console.error('operations optional read failed',index+2,e?.code||e?.message||'unknown');return {results:[]} as any}
 }));
 const rr=[...essential,...optional];const item=selected?(rr[view==='tickets'?6:5]?.results?.[0] as any):null;const allowedItem=item&&canSeeOps(u,item)?item:null;const events=allowedItem?(await db().prepare('SELECT * FROM staff_events WHERE record_id=? ORDER BY created_at ASC LIMIT 200').bind(selected).all()).results.filter((e:any)=>ticketNoteVisible(u,e)):[];
 const communications=allowedItem&&routingReady&&mayReadRequestSource(u,allowedItem)?
  (await db().prepare('SELECT id,direction,body,delivery_status,created_by,created_at,metadata FROM ops_communications WHERE request_id=? ORDER BY created_at,id').bind(selected).all()).results
   .filter(c=>ticketCommunicationVisible(u,c))
   .map(({metadata, ...message})=>message):[];
 let payments=new Map<string,any>(),financialDataUnavailable=false;try{payments=await operationPayments([...new Set([...rr[0].results,...(allowedItem?[allowedItem]:[])].map((r:any)=>r.id))])}catch(e:any){financialDataUnavailable=true;console.error('operations finance summary unavailable',e?.code||e?.message||'unknown')}
 const map=(raw:any)=>{const r=redactRequest(u,raw),x=opsRow(r),financial=payments.get(r.id)||null;const paymentState=financialDataUnavailable?'unknown':financial?.paid_rial>0?'verified':r.payment_state==='reported'?'reported':r.category==='billing'?'pending':'unknown';return {...x,displayRole:mayReadRequestSource(u,raw)?raw.display_role:null,payment_state:paymentState,paymentState,financial:u.manager||hasDataAccess(u,'billing_ops')?financial:null,isTicket:isTicket(x)}};
 let facetRows:any[]=[];try{facetRows=(await db().prepare("SELECT "+filterCategorySQL+" AS id,COUNT(*) AS n FROM ops_items WHERE "+facetWhere+" GROUP BY 1").bind(...facetArgs).all()).results as any[]}catch(e:any){console.error('operations category summary unavailable',e?.code||e?.message||'unknown')}
 const unifiedCounts=Object.fromEntries([...unifiedIntakeCategories.map(c=>[c.id,Number(facetRows.find(x=>x.id===c.id)?.n||0)]),['unclassified',Number(facetRows.find(x=>x.id==null)?.n||0)]]);
 const total=Number((rr[1].results[0] as any)?.total||0);const counts=Object.fromEntries(operationCategories.map(c=>[c.id,Number((rr[2].results.find((r:any)=>r.category===c.id) as any)?.total||0)]));
 let roleCounts:Record<string,number>|null=null;
 if(view==='tickets'){try{
  const roleWhere=roleFacetSeed+where.slice(roleFacetPrefix.length);
  const roleArgs=[...roleFacetSeedArgs,...args.slice(roleFacetPrefixArgs.length)];
  const rows=(await db().prepare("SELECT "+filterRoleSQL+" AS id,COUNT(*) AS n FROM ops_items WHERE "+roleWhere+" GROUP BY 1").bind(...roleArgs).all()).results as any[];
  roleCounts=Object.fromEntries(intakeResponsibleRoles.map(r=>[r.id,Number(rows.find(x=>x.id===r.id)?.n||0)]));
  roleCounts.all=rows.reduce((n,x)=>n+Number(x.n||0),0);
  roleCounts.director=roleCounts.all;
  roleCounts.unclassified=Number(rows.find(x=>x.id==null)?.n||0);
  const ids=unifiedIntakeCategories.filter(c=>seniorResearchMayReview(c.id)).map(c=>c.id);
  const senior=await db().prepare('SELECT COUNT(*) AS n FROM ops_items WHERE '+roleWhere+' AND '+filterCategorySQL+' IN ('+ids.map(()=>'?').join(',')+')').bind(...roleArgs,...ids).first<any>();roleCounts.senior_research=Number(senior?.n||0);
 }catch(e:any){console.error('operations role summary unavailable',e?.code||'unknown')}}
 let coverage:any=null;try{coverage=await db().prepare("SELECT MAX("+originalDay+") AS lastCallDate,MAX(source_at) AS lastSourceAt,COUNT(*) AS count FROM ops_items WHERE "+permitted+" AND source_type='incoming' AND source_key LIKE 'calls:incoming:%'").bind(...scopeArgs).first()}catch(e:any){console.error('operations coverage unavailable',e?.code||e?.message||'unknown')}
 return {coverage,roleCounts,unifiedCounts,financialDataUnavailable,manualAssignment:canManualAssignOperations(u),user:u,items:rr[0].results.filter((r:any)=>canSeeOps(u,r)).map(map),total,offset,nextOffset:offset+initialPageSize<total?offset+initialPageSize:null,counts,followups:rr[3]?.results?.[0]||{},ticketSummary:view==='tickets'?{all:Number((rr[5]?.results?.[0] as any)?.all_count||0),today:Number((rr[5]?.results?.[0] as any)?.today_count||0),new:Number((rr[5]?.results?.[0] as any)?.new_count||0),waiting:Number((rr[5]?.results?.[0] as any)?.waiting_count||0),overdue:Number((rr[5]?.results?.[0] as any)?.overdue_count||0),unassigned:Number((rr[5]?.results?.[0] as any)?.unassigned_count||0)}:null,categories:operationCategories.map(c=>({...c,allowed:u.manager||c.items.some(subtype=>canUseOpsCategory(u,{category:c.id,subtype,access_scope:requestedAccessScope(u,{category:c.id,subtype},'')})),items:c.items.filter(subtype=>u.manager||canUseOpsCategory(u,{category:c.id,subtype,access_scope:requestedAccessScope(u,{category:c.id,subtype},'')}))})),selected:allowedItem?map(allowedItem):null,communications,events:allowedItem&&!mayReadRequestSource(u,allowedItem)?events.map((e:any)=>({...e,body:'{}'})):events,members:await intakeMembers(),sync:u.manager?rr[4]?.results||[]:[]};
}
