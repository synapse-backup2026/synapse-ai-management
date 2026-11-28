import AccountingWorkspace from '../../../../components/finance/accounting-workspace';
import {accountingModel} from '../../../../lib/accounting-workspace';
import BankReconciliation from '../../../../components/finance/bank-reconciliation';
import {bankModel} from '../../../../lib/bank-reconciliation';
import PaymentRequests from '../../../../components/finance/payment-requests';
import {readPaymentRequests} from '../../../../lib/payment-requests';
import {readCustomerReceipts} from '../../../../lib/finance-receipts';
import FinancialDashboard from '../../../../components/finance/financial-dashboard';
import {financeDashboardModel} from '../../../../lib/finance-dashboard';
import {notFound,redirect} from 'next/navigation';
import {workspaceUser} from '../../../../lib/workspace-user';
import {canQuote,quoteOnly} from '../../../../lib/finance-policy';
import {readFinanceData} from '../../../../lib/finance-data';
import FinanceDesk from '../../../../components/finance/finance-desk';
export const dynamic='force-dynamic';
export default async function Page({params,searchParams}:{params:Promise<{section:string}>,searchParams:Promise<Record<string,string>>}){const {section}=await params;if(!['dashboard','pricing','invoices','contracts','receipts','payables','bank','ledger','compare','tax'].includes(section))notFound();const u=await workspaceUser();if(u.laboratory)redirect('/laboratories/'+u.laboratoryType);if(section==='ledger'){try{return <AccountingWorkspace initialData={await accountingModel(u,new URLSearchParams(await searchParams))}/>}catch(e:any){return <main className="financial-page"><h1>۰۸ — حسابداری و تعرفه‌ها</h1><p>{e.status?e.message:'بارگذاری انجام نشد.'}</p></main>}}if(section==='bank'){try{return <BankReconciliation initialData={await bankModel(u,new URLSearchParams(await searchParams))}/>}catch(e:any){return <main className="financial-page"><h1>صورت‌حساب و تطبیق بانک</h1><p>{e.status?e.message:'بارگذاری دفتر بانک ممکن نشد.'}</p></main>}}if(section==='payables'){try{return <PaymentRequests initialData={await readPaymentRequests(u,new URLSearchParams(await searchParams))}/>}catch(e:any){return <main><h1>پرداخت‌ها و هزینه‌ها</h1><p>{e.status?e.message:'خواندن صفحه ممکن نشد.'}</p></main>}}if(!canQuote(u)||quoteOnly(u)&&section!=='pricing')return <main><h1>دسترسی مالی ندارید.</h1><p>این بخش به مجوز مستقل مالی نیاز دارد.</p></main>;if(section==='dashboard')return <FinancialDashboard initialData={await financeDashboardModel(u,new URLSearchParams(await searchParams))}/>;return <FinanceDesk key={section} section={section} initialData={section==='receipts'?await readCustomerReceipts(u):await readFinanceData(u,(await searchParams).company||'')}/>}
