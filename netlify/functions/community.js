const {getStore}=require("@netlify/blobs");
const crypto=require("node:crypto");
const namespace=process.env.CONTEXT==="production"?"credit-match-affiliates":"credit-match-affiliates-"+(process.env.CONTEXT||"dev").replace(/[^a-z0-9-]/gi,"-");
const store=()=>getStore(namespace);
const respond=(statusCode,data)=>({statusCode,headers:{"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"},body:JSON.stringify(data)});
function isAdmin(e){const configured=process.env.CREDIT_MATCH_ADMIN_KEY||"",provided=e.headers?.["x-admin-key"]||e.headers?.["X-Admin-Key"]||"";const a=Buffer.from(configured),b=Buffer.from(provided);return !!configured&&a.length===b.length&&crypto.timingSafeEqual(a,b)}
function safeUrl(value){const u=new URL(value);if(u.protocol!=="https:"||u.hostname!=="www.skool.com"&&u.hostname!=="skool.com"||u.username||u.password||!/^\/[a-z0-9-]+\/?$/i.test(u.pathname))throw Error("Enter an official Skool community URL, such as the one copied from Settings > Invite.");u.search="";u.hash="";return u.href}
exports.handler=async(event)=>{
 try{
  if(event.httpMethod==="GET"){
   const saved=await store().get("community/config",{type:"json",consistency:"strong"})||{};
   return respond(200,{name:"All The Sauce",connected:!!saved.url,url:saved.url||null,paidTier:"THE KITCHEN",note:"Community memberships and payments are managed on Skool. Credit Match does not collect Skool membership fees."});
  }
  if(event.httpMethod!=="POST")return respond(405,{error:"Method not allowed"});
  if(!isAdmin(event))return respond(401,{error:"Owner authentication required"});
  if((event.body||"").length>1000)return respond(413,{error:"Request too large"});
  const data=JSON.parse(event.body||"{}");
  const url=safeUrl(String(data.url||""));
  await store().setJSON("community/config",{url,updatedAt:new Date().toISOString()});
  return respond(200,{saved:true,url});
 }catch(err){return respond(400,{error:String(err.message||"Unable to configure community")});}
};
