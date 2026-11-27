import {workspaceUser} from '../../../lib/workspace-user';
import {readResearchIntake} from '../../../lib/researcher-sample-intake';
import ResearcherSampleIntake from '../../../components/laboratory/researcher-sample-intake';
import IndependentSampleIntake from '../../../components/laboratory/independent-sample-intake';
import {hasDataAccess} from '../../../lib/auth-policy';
import {canCoordinate} from '../../../lib/lab-execution-policy';
export const dynamic='force-dynamic';
export default async function SampleIntake({searchParams}:{searchParams:Promise<Record<string,string>>}){
 const user=await workspaceUser();
 if(user.laboratory)return <IndependentSampleIntake/>;
 const params=await searchParams;
 const linked=params.legacy==='1'||!!params.id;
 const canOpenResearcherForm=hasDataAccess(user,'sample_intake')||canCoordinate(user)||hasDataAccess(user,'research_supervision');
 return <>{canOpenResearcherForm&&<div className="legacy-linked-intake"><a href="/synapse-sample-form.html">فرم اطلاعات نمونه‌های پژوهشی</a></div>}<IndependentSampleIntake/>{linked?<details open className="legacy-linked-intake"><summary>پذیرش مرتبط با پرونده و فاکتور موجود (روش قبلی و اختیاری)</summary><ResearcherSampleIntake initialData={await readResearchIntake(user,new URLSearchParams(params))}/></details>:<div className="legacy-linked-intake"><a href="/sample-intake?legacy=1">مشاهده سوابق و فرم پذیرش پرونده‌های دارای فاکتور</a></div>}</>;
}
