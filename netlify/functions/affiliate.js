const {getStore}=require("@netlify/blobs");const crypto=require("node:crypto");
const links={tradeline:'https://www.tkqlhce.com/click-101773653-13503362',monitoring:'https://mandrillapp.com/track/click/31267418/myfreescorenow.com?p=eyJzIjoiTHVmZ1FwbllvVnlZOWpTZjF0SW1Fc29KNzAwIiwidiI6MSwicCI6IntcInVcIjozMTI2NzQxOCxcInZcIjoxLFwidXJsXCI6XCJodHRwczpcXFwvXFxcL215ZnJlZXNjb3Jlbm93LmNvbVxcXC9yZWZlcmVuY2VBZmZpbGlhdGVSZXF1ZXN0XFxcL2JsWmxabkZ0V1RrPVwiLFwiaWRcIjpcImI0MWNiMjliNjgwZTQxNmE4MGFiNDMyNjU2NzEyYTJiXCIsXCJ1cmxfaWRzXCI6W1wiZjVmN2Y1NjA2ZTIyNjRlMmFkMTk0OTJkMTRhYTUyYjEzMzAwNWJhZFwiXX0ifQ',dispute:'https://disputebee.com/?ref=mzllmgy'};
const seed=[
{id:"credit-monitoring",name:"Credit Monitoring",category:"monitoring",description:"Compare credit monitoring plans and fees.",url:links.monitoring,active:true,priority:90,goals:[],negativeRequired:false,monitoringRequired:true,disclosure:"Free reports are available at AnnualCreditReport.com. Compare renewal and cancellation terms."},
{id:"dispute-tools",name:"Negative Item Review",category:"disputes",description:"Optional tools to organize credit report disputes.",url:links.dispute,active:true,priority:80,goals:[],negativeRequired:true,monitoringRequired:false,disclosure:"Disputing inaccurate information yourself is free. Accurate negative items are not automatically removable."},
{id:"tradelines",name:"Tradeline Options",category:"credit_building",description:"Compare authorized-user tradeline services and risks.",url:links.tradeline,active:true,priority:50,goals:["Build credit"],negativeRequired:false,monitoringRequired:false,disclosure:"Paid authorized-user tradelines offer no guarantee of a score increase or lender acceptance."}];
const namespace=process.env.CONTEXT==="production"?"credit-match-affiliates":"credit-match-affiliates-"+(process.env.CONTEXT||"dev").replace(/[^a-z0-9-]/gi,"-");
const store=()=>getStore(namespace);
const response=(statusCode,data)=>({statusCode,headers:{"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"},body:JSON.stringify(data)});
const authorized=e=>{const key=process.env.CREDIT_MATCH_ADMIN_KEY||"",v=e.headers?.["x-admin-key"]||e.headers?.["X-Admin-Key"]||"";const a=Buffer.from(key),b=Buffer.from(v);return !!key&&a.length===b.length&&crypto.timingSafeEqual(a,b)};
const offers=async()=>await store().get("catalog",{type:"json",consistency:"strong"})||seed;
const safeOffer=o=>({id:o.id,name:o.name,description:o.description,disclosure:o.disclosure,category:o.category,clickUrl:"/.netlify/functions/affiliate?action=click&id="+encodeURIComponent(o.id)});
function validate(o){
const id=String(o.id||"");if(!/^[a-z0-9-]{2,60}$/.test(id))throw Error("Invalid offer ID");
const name=String(o.name||"").trim();if(name.length<2||name.length>100)throw Error("Invalid name");
const u=new URL(o.url);if(u.protocol!=="https:"||u.username||u.password||["localhost","127.0.0.1"].includes(u.hostname))throw Error("A public HTTPS link is required");
const allowed=["Build credit","Personal loan","Business funding","Credit card","Debt consolidation"];
return {id,name,url:u.href,category:String(o.category||"other").slice(0,60),description:String(o.description||"").slice(0,600),disclosure:String(o.disclosure||"").slice(0,600),active:o.active===true,priority:Math.max(0,Math.min(100,Number(o.priority)||0)),goals:Array.isArray(o.goals)?o.goals.filter(x=>allowed.includes(x)):[],negativeRequired:o.negativeRequired===true,monitoringRequired:o.monitoringRequired===true};
}
function fits(o,p){
if(!o.active)return false;
if(o.goals.length&&!o.goals.includes(p.goalType))return false;
if(o.negativeRequired&&!(Array.isArray(p.negativeItems)&&p.negativeItems.some(x=>x!=="None")))return false;
if(o.monitoringRequired&&!(p.creditMonitoring==="No"||["Never","Only before applying"].includes(p.creditCheckFrequency)))return false;
return true;
}
async function records(prefix){const s=store();const r=await s.list({prefix});return Promise.all(r.blobs.slice(0,10000).map(x=>s.get(x.key,{type:"json"})));}
exports.handler=async(e)=>{
const action=e.queryStringParameters?.action||"";
try{
if(action==="match"&&e.httpMethod==="POST"){
if((e.body||"").length>10000)return response(413,{error:"Too large"});
const profile=JSON.parse(e.body||"{}");
const applicable=(await offers()).filter(x=>fits(x,profile)).sort((a,b)=>b.priority-a.priority).slice(0,5).map(safeOffer);
return response(200,{offers:applicable,notice:"Recommendations based on self-reported needs, not eligibility or approval likelihood."});
}
if(action==="click"&&e.httpMethod==="GET"){
const id=String(e.queryStringParameters?.id||"");
const o=(await offers()).find(x=>x.id===id&&x.active);
if(!o)return response(404,{error:"Offer unavailable"});
const u=new URL(o.url);if(u.protocol!=="https:")return response(400,{error:"Invalid destination"});
const idempotency=crypto.randomUUID();await store().setJSON("clicks/"+Date.now()+"-"+idempotency,{id:idempotency,offerId:id,date:new Date().toISOString()},{onlyIfNew:true});
return {statusCode:302,headers:{Location:u.href,"Cache-Control":"no-store","Referrer-Policy":"no-referrer"},body:""};
}
if(!authorized(e))return response(401,{error:"Owner access required. Set CREDIT_MATCH_ADMIN_KEY in Netlify."});
if(action==="offers"&&e.httpMethod==="GET")return response(200,{offers:await offers()});
if(action==="offers"&&e.httpMethod==="POST"){
const o=validate(JSON.parse(e.body||"{}"));const s=store();
const current=await s.getWithMetadata("catalog",{type:"json",consistency:"strong"});const data=current?.data||[...seed];
const i=data.findIndex(x=>x.id===o.id);if(i<0)data.push(o);else data[i]=o;
if(data.length>100)return response(400,{error:"Maximum 100 offers"});
const r=await s.setJSON("catalog",data,current?{onlyIfMatch:current.etag}:{onlyIfNew:true});
if(!r.modified)return response(409,{error:"Catalog changed. Refresh and retry."});
return response(200,{saved:true,offers:data});
}
if(action==="commission"&&e.httpMethod==="POST"){
const p=JSON.parse(e.body||"{}"),amount=Number(p.amount);
if(!(await offers()).some(o=>o.id===p.offerId)||!Number.isFinite(amount)||amount<0||amount>1000000||!["pending","approved","paid","reversed"].includes(p.status))return response(400,{error:"Invalid commission record"});
const r={id:crypto.randomUUID(),offerId:p.offerId,amount:Math.round(amount*100)/100,status:p.status,reference:String(p.reference||"").slice(0,120),date:new Date().toISOString()};
await store().setJSON("commissions/"+Date.now()+"-"+r.id,r,{onlyIfNew:true});return response(201,{saved:true,record:r});
}
if(action==="report"&&e.httpMethod==="GET"){
const [cs,ps,os]=await Promise.all([records("clicks/"),records("commissions/"),offers()]);
const report=os.map(o=>{const r=ps.filter(x=>x?.offerId===o.id);return {id:o.id,name:o.name,clicks:cs.filter(x=>x?.offerId===o.id).length,conversions:r.length,pending:r.filter(x=>x.status==="pending").reduce((n,x)=>n+x.amount,0),approved:r.filter(x=>x.status==="approved").reduce((n,x)=>n+x.amount,0),paid:r.filter(x=>x.status==="paid").reduce((n,x)=>n+x.amount,0)}});
return response(200,{report,records:ps.slice(-100),note:"Manual commissions only, not verified affiliate-network conversions. Counts capped at 10,000 per category."});
}
return response(405,{error:"Unsupported action/method"});
}catch(err){return response(400,{error:String(err.message||"Request failed").slice(0,200)})}
};